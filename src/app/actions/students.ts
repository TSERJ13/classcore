'use server';

/**
 * Pilot Server Actions for the Students module (see
 * docs/architecture-migration.md). Deliberately NOT wired into the live
 * `/students` page yet — this lives alongside the existing localStorage +
 * `/api/sync/*` system as a parallel, additive reference implementation
 * (`/students-v2`) so it can be reviewed and tested without touching a page
 * every studio currently depends on.
 *
 * The one thing this is actually demonstrating: every query here runs as
 * the signed-in user through the anon key + RLS (supabase/server.ts), NOT
 * through the service-role client `/api/sync/state` uses. There is no
 * `.eq('org_id', ...)` anywhere below — Postgres enforces that via the RLS
 * policy in `20260915_students_rls_pilot.sql`. A missing filter here simply
 * can't leak another studio's students, which is exactly the property the
 * old bulk-fetch/service-role pattern doesn't have.
 *
 * SCHEMA NOTE: the real `students` table only has a handful of top-level
 * columns — `id, org_id, first_name, last_name, full_name, phone, email` —
 * confirmed by an existing comment in `student-store.ts` describing a real
 * production bug (`PGRST204: Could not find the 'birth_date' column`) from
 * assuming otherwise. Everything else (parent_name, notes, status,
 * enrolled_group_ids, birth_date, ...) lives in the `data` JSONB column.
 * This file follows that same shape rather than guessing at new columns.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE_DEFAULT = 20;

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

type StudentData = {
    parent_name?: string;
    notes?: string;
    status?: 'active' | 'inactive' | 'lead';
    birth_date?: string;
    enrolled_group_ids?: string[];
};

const listParamsSchema = z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(PAGE_SIZE_DEFAULT),
    search: z.string().trim().max(200).optional(),
});

export type StudentsPageRow = {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    parent_name: string | null;
    notes: string | null;
    status: 'active' | 'inactive' | 'lead';
    enrolled_group_ids: string[];
};

export type StudentsPageResult = {
    rows: StudentsPageRow[];
    total: number;
    page: number;
    pageSize: number;
};

function rowFromDbRecord(r: { id: string; full_name: string; phone: string; email: string | null; data: StudentData | null }): StudentsPageRow {
    const d = r.data || {};
    return {
        id: r.id,
        full_name: r.full_name,
        phone: r.phone,
        email: r.email,
        parent_name: d.parent_name || null,
        notes: d.notes || null,
        status: d.status || 'active',
        enrolled_group_ids: d.enrolled_group_ids || [],
    };
}

/**
 * Server-side paginated + searched student list. RLS (not this function)
 * is what actually confines results to the caller's studio — see the file
 * header. `search` is a plain `ilike` on name/phone for the pilot; a real
 * rollout would add a Postgres full-text index once search patterns are
 * known.
 */
export async function getStudentsPage(rawParams: unknown): Promise<StudentsPageResult> {
    const { page, pageSize, search } = listParamsSchema.parse(rawParams);
    await requireOrgId(); // throws if unauthenticated; RLS still governs visibility

    const supabase = await createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from('students')
        .select('id, full_name, phone, email, data', { count: 'exact' })
        .order('full_name', { ascending: true })
        .range(from, to);

    if (search) {
        const term = search.replace(/[%_]/g, '');
        query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return { rows: (data ?? []).map(rowFromDbRecord), total: count ?? 0, page, pageSize };
}

function splitName(fullName: string): { first_name: string; last_name: string } {
    const trimmed = fullName.trim();
    const idx = trimmed.indexOf(' ');
    if (idx === -1) return { first_name: trimmed, last_name: '' };
    return { first_name: trimmed.slice(0, idx), last_name: trimmed.slice(idx + 1) };
}

const studentInputSchema = z.object({
    full_name: z.string().trim().min(2).max(200),
    phone: z.string().trim().min(5).max(30),
    email: z.string().trim().email().optional().or(z.literal('')),
    parent_name: z.string().trim().max(200).optional().or(z.literal('')),
    notes: z.string().trim().max(2000).optional().or(z.literal('')),
    status: z.enum(['active', 'inactive', 'lead']).default('active'),
});

export type CreateStudentInput = z.infer<typeof studentInputSchema>;

/**
 * Creates a student in one atomic insert. Zod validates shape before it
 * ever reaches Postgres; the RLS INSERT policy's WITH CHECK is the actual
 * backstop guaranteeing `org_id` can't be spoofed even if this function's
 * own logic had a bug.
 */
export async function createStudentAction(rawInput: unknown): Promise<{ id: string }> {
    const input = studentInputSchema.parse(rawInput);
    const { orgId } = await requireOrgId();
    const { first_name, last_name } = splitName(input.full_name);

    const dataBlob: StudentData = {
        parent_name: input.parent_name || undefined,
        notes: input.notes || undefined,
        status: input.status,
        enrolled_group_ids: [],
    };

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('students')
        .insert({
            org_id: orgId,
            first_name,
            last_name,
            full_name: input.full_name,
            phone: input.phone,
            email: input.email || null,
            data: dataBlob,
        })
        .select('id')
        .single();

    if (error) throw new Error(error.message);

    revalidatePath('/students-v2');
    return { id: data.id };
}

const updateStudentSchema = studentInputSchema.extend({
    id: z.string().min(1),
});

/**
 * Reads the row first so the JSONB `data` merge doesn't clobber fields this
 * form doesn't know about (e.g. birth_date, enrolled_group_ids) — RLS still
 * governs whether the read/write is even visible to this caller.
 */
export async function updateStudentAction(rawInput: unknown): Promise<{ id: string }> {
    const input = updateStudentSchema.parse(rawInput);
    await requireOrgId();
    const { first_name, last_name } = splitName(input.full_name);

    const supabase = await createClient();
    const { data: existing, error: readErr } = await supabase
        .from('students')
        .select('data')
        .eq('id', input.id)
        .single();
    if (readErr) throw new Error(readErr.message);

    const mergedData: StudentData = {
        ...(existing?.data || {}),
        parent_name: input.parent_name || undefined,
        notes: input.notes || undefined,
        status: input.status,
    };

    const { error } = await supabase
        .from('students')
        .update({
            first_name,
            last_name,
            full_name: input.full_name,
            phone: input.phone,
            email: input.email || null,
            data: mergedData,
        })
        .eq('id', input.id);

    if (error) throw new Error(error.message);

    revalidatePath('/students-v2');
    return { id: input.id };
}

const idSchema = z.object({ id: z.string().min(1) });

/**
 * Soft-deletes to `trash` first, then removes from `students` — mirroring
 * the legacy `deleteStudent()` (student-store.ts) behavior of moving a
 * record to trash rather than hard-deleting it. Sequential, not a single
 * RPC transaction: an admin delete is low-frequency enough that "trashed
 * but the students-row delete failed, so it still shows up" is an
 * acceptable, visible failure mode — unlike the attendance/session case in
 * `markAttendanceAction`, where a partial write would silently cost a
 * session, so that one *is* a single atomic RPC.
 */
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

    revalidatePath('/students-v2');
    return { id };
}

/** For the group-enrollment picker — id/name only, no need for the full `data` blob. */
export async function getGroupsForOrg(): Promise<Array<{ id: string; name: string }>> {
    await requireOrgId();
    const supabase = await createClient();
    const { data, error } = await supabase.from('groups').select('id, name').order('name');
    if (error) throw new Error(error.message);
    return data ?? [];
}

const updateGroupsSchema = z.object({
    id: z.string().min(1),
    enrolled_group_ids: z.array(z.string()),
});

export async function updateStudentGroupsAction(rawInput: unknown): Promise<{ id: string }> {
    const input = updateGroupsSchema.parse(rawInput);
    await requireOrgId();

    const supabase = await createClient();
    const { data: existing, error: readErr } = await supabase
        .from('students')
        .select('data')
        .eq('id', input.id)
        .single();
    if (readErr) throw new Error(readErr.message);

    const mergedData: StudentData = { ...(existing?.data || {}), enrolled_group_ids: input.enrolled_group_ids };

    const { error } = await supabase.from('students').update({ data: mergedData }).eq('id', input.id);
    if (error) throw new Error(error.message);

    revalidatePath('/students-v2');
    return { id: input.id };
}
