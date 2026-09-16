'use server';

/**
 * Server Actions for the Students module — this is now the data layer the
 * real `/students` page (src/app/(dashboard)/students/page.tsx) runs on,
 * not a parallel pilot. Every query runs as the signed-in user through the
 * anon key + RLS (supabase/server.ts), not the service-role client
 * `/api/sync/state` used to use for this data.
 *
 * SCHEMA NOTE: the real `students` table only has a handful of top-level
 * columns — `id, org_id, first_name, last_name, full_name, phone, email` —
 * confirmed by an existing comment in `student-store.ts` describing a real
 * production bug (`PGRST204: Could not find the 'birth_date' column`) from
 * assuming otherwise. Everything else the UI needs (gender, birth_date,
 * dance_style, medical_cert_expires_at, photo_url, social_links, qr_code,
 * nfc_uid, enrolled_group_ids, notes, parent_name, discount info, status,
 * ...) lives in the `data` JSONB column and is passed through mostly
 * untyped here rather than re-declared field by field — `StudentModal`
 * (unchanged by this migration) already owns that shape.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function requireOrgId(): Promise<{ orgId: string; userId: string }> {
    const supabase = await createClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) throw new Error('Not authenticated');

    const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', userData.user.id)
        .maybeSingle();
    if (profileErr || !profile?.org_id) throw new Error('No org for this user');

    return { orgId: profile.org_id, userId: userData.user.id };
}

// ─── Search / list (search_students RPC — 20260916_search_students_rpc.sql) ───

const searchParamsSchema = z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(24),
    search: z.string().trim().max(200).optional(),
    status: z.enum(['all', 'active', 'inactive']).default('all'),
    gender: z.enum(['all', 'male', 'female']).default('all'),
    groupId: z.string().optional(),
    visibleGroupIds: z.array(z.string()).optional(),
    sortBy: z.enum(['none', 'first_name', 'last_name', 'gender']).default('none'),
});

export type StudentSubscriptionSummary = {
    status: string;
    sessions_total: number | null;
    sessions_used: number;
    expires_at: string | null;
};

export type StudentRow = {
    id: string;
    full_name: string;
    first_name: string | null;
    last_name: string | null;
    phone: string;
    email: string | null;
    subscription: StudentSubscriptionSummary | null;
    [key: string]: unknown; // everything from the `data` JSONB column (gender, birth_date, photo_url, ...)
};

type RawRpcRow = {
    id: string; full_name: string; first_name: string | null; last_name: string | null;
    phone: string; email: string | null; data: Record<string, unknown> | null;
    sub_status: string | null; sub_sessions_total: number | null; sub_sessions_used: number | null;
    sub_expires_at: string | null; total_count: number;
};

function rowFromRpc(r: RawRpcRow): StudentRow {
    return {
        ...(r.data || {}),
        id: r.id,
        full_name: r.full_name,
        first_name: r.first_name,
        last_name: r.last_name,
        phone: r.phone,
        email: r.email,
        subscription: r.sub_status ? {
            status: r.sub_status,
            sessions_total: r.sub_sessions_total,
            sessions_used: r.sub_sessions_used ?? 0,
            expires_at: r.sub_expires_at,
        } : null,
    };
}

export type SearchStudentsResult = { rows: StudentRow[]; total: number; page: number; pageSize: number };

/**
 * Search/filter/sort/paginate students, each with its current subscription
 * summary — all computed by the `search_students` RPC (a LATERAL join +
 * window count), not fetched in bulk and filtered in the browser.
 */
export async function searchStudents(rawParams: unknown): Promise<SearchStudentsResult> {
    const p = searchParamsSchema.parse(rawParams);
    await requireOrgId();

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('search_students', {
        p_search: p.search || null,
        p_status: p.status,
        p_gender: p.gender,
        p_group_id: p.groupId || null,
        p_visible_group_ids: p.visibleGroupIds && p.visibleGroupIds.length > 0 ? p.visibleGroupIds : null,
        p_sort_by: p.sortBy,
        p_page: p.page,
        p_page_size: p.pageSize,
    });
    if (error) throw new Error(error.message);

    const rows = ((data as RawRpcRow[]) || []).map(rowFromRpc);
    const total = data && data.length > 0 ? Number((data[0] as RawRpcRow).total_count) : 0;
    return { rows, total, page: p.page, pageSize: p.pageSize };
}

// ─── Save (create or update) ───────────────────────────────────────────────

const GEO_TO_LAT: Record<string, string> = {
    'ა': 'A', 'ბ': 'B', 'გ': 'G', 'დ': 'D', 'ე': 'E', 'ვ': 'V', 'ზ': 'Z', 'თ': 'T', 'ი': 'I', 'კ': 'K', 'ლ': 'L', 'მ': 'M', 'ნ': 'N', 'ო': 'O', 'პ': 'P', 'ჟ': 'ZH', 'რ': 'R', 'ს': 'S', 'ტ': 'T', 'უ': 'U', 'ფ': 'F', 'ქ': 'K', 'ღ': 'GH', 'ყ': 'Q', 'შ': 'SH', 'ჩ': 'CH', 'ც': 'TS', 'ძ': 'DZ', 'წ': 'TS', 'ჭ': 'CH', 'ხ': 'KH', 'ჯ': 'J', 'ჰ': 'H',
};
function initialFor(name: string): string {
    if (!name) return 'X';
    const ch = name.trim()[0];
    return GEO_TO_LAT[ch] || ch.toUpperCase();
}

/** Mirrors student-store.ts's generateFormattedStudentId(), but checks uniqueness against the DB instead of a localStorage-loaded list. */
async function generateStudentId(supabase: Awaited<ReturnType<typeof createClient>>, firstName: string, lastName: string): Promise<string> {
    const prefix = `${initialFor(firstName)}${initialFor(lastName)}`.slice(0, 2).toUpperCase();
    for (let i = 0; i < 10; i++) {
        const suffix = String(Math.floor(1000000 + Math.random() * 9000000));
        const candidate = `${prefix}${suffix}`;
        const { data } = await supabase.from('students').select('id').eq('id', candidate).maybeSingle();
        if (!data) return candidate;
    }
    return `ST${Date.now().toString().slice(-7)}`;
}

const saveStudentSchema = z.object({
    id: z.string().optional(),
    full_name: z.string().trim().min(1).max(200),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().trim().min(3).max(30),
    email: z.string().optional(),
}).passthrough(); // everything else (gender, birth_date, photo_url, social_links, ...) rides along into `data`

/**
 * Create-or-update, matching the legacy page's `handleSave()` semantics
 * exactly: an id present -> update (merging into the existing `data` blob
 * so fields this call doesn't send survive), no id -> generate one and
 * insert. Legacy also unconditionally set `status: 'active'` on every save
 * (edit included) — kept as-is rather than "fixed" silently.
 */
export async function saveStudentAction(rawInput: unknown): Promise<{ id: string }> {
    const input = saveStudentSchema.parse(rawInput) as Record<string, unknown> & { id?: string; full_name: string; first_name?: string; last_name?: string; phone: string; email?: string };
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    const { id: inputId, full_name, first_name, last_name, phone, email, ...rest } = input;
    const resolvedFirst = first_name || full_name.split(' ')[0] || '';
    const resolvedLast = last_name || full_name.split(' ').slice(1).join(' ') || '';

    let id = inputId;
    let existingData: Record<string, unknown> = {};
    if (id) {
        const { data: existing } = await supabase.from('students').select('data').eq('id', id).maybeSingle();
        existingData = (existing?.data as Record<string, unknown>) || {};
    } else {
        id = await generateStudentId(supabase, resolvedFirst, resolvedLast);
    }

    const mergedData = { ...existingData, ...rest, status: 'active' };

    const { error } = await supabase.from('students').upsert({
        id, org_id: orgId, first_name: resolvedFirst, last_name: resolvedLast,
        full_name, phone, email: email || null, data: mergedData,
    }, { onConflict: 'id' });
    if (error) throw new Error(error.message);

    revalidatePath('/students');
    return { id };
}

// ─── Duplicate check ────────────────────────────────────────────────────────

const duplicateCheckSchema = z.object({
    full_name: z.string(),
    phone: z.string(),
    birth_date: z.string().optional(),
    excludeId: z.string().optional(),
});

/** Same match rule as the legacy `checkDuplicateStudent()`: same name, and either same birth date or same phone. */
export async function checkDuplicateStudentAction(rawInput: unknown): Promise<{ id: string; full_name: string } | null> {
    const input = duplicateCheckSchema.parse(rawInput);
    await requireOrgId();
    const supabase = await createClient();
    const normalizedPhone = input.phone.replace(/\D/g, '');

    const { data, error } = await supabase.from('students').select('id, full_name, phone, data').ilike('full_name', input.full_name);
    if (error) throw new Error(error.message);

    const match = (data || []).find((s) => {
        if (input.excludeId && s.id === input.excludeId) return false;
        if ((s.full_name || '').toLowerCase() !== input.full_name.toLowerCase()) return false;
        const sBirth = (s.data as Record<string, unknown> | null)?.birth_date as string | undefined;
        if (input.birth_date && sBirth) return sBirth === input.birth_date;
        return (s.phone || '').replace(/\D/g, '') === normalizedPhone;
    });
    return match ? { id: match.id, full_name: match.full_name } : null;
}

// ─── Delete (soft — moves to trash, mirroring legacy deleteStudent()) ──────

const idSchema = z.object({ id: z.string().min(1) });

export async function deleteStudentAction(rawInput: unknown): Promise<{ id: string }> {
    const { id } = idSchema.parse(rawInput);
    const { orgId, userId } = await requireOrgId();

    const supabase = await createClient();
    const { data: existing, error: readErr } = await supabase
        .from('students')
        .select('*')
        .eq('id', id)
        .single();
    if (readErr) throw new Error(readErr.message);

    const { error: trashErr } = await supabase.from('trash').insert({
        id: `trash_${id}_${Date.now()}`,
        org_id: orgId,
        type: 'student',
        data: existing,
        deletedAt: new Date().toISOString(),
        deletedBy: userId,
    });
    if (trashErr) throw new Error(trashErr.message);

    const { error: deleteErr } = await supabase.from('students').delete().eq('id', id);
    if (deleteErr) throw new Error(deleteErr.message);

    revalidatePath('/students');
    return { id };
}

// ─── Groups (for the filter dropdown) ──────────────────────────────────────

export type GroupRow = {
    id: string;
    name: string;
    teacherId?: string;
    secondaryTeacherId?: string;
    enrolled?: number;
    [key: string]: unknown;
};

/** Full group shape (not just id/name) — the page's teacher-visibility check (access.ts's getVisibleGroupIds) needs teacherId/secondaryTeacherId. */
export async function getGroupsForOrg(): Promise<GroupRow[]> {
    await requireOrgId();
    const supabase = await createClient();
    const { data, error } = await supabase.from('groups').select('id, name, data').order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map((g) => ({ ...(g.data as Record<string, unknown> || {}), id: g.id, name: g.name }));
}
