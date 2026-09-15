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

const listParamsSchema = z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(PAGE_SIZE_DEFAULT),
    search: z.string().trim().max(200).optional(),
});

export type StudentsPageResult = {
    rows: Array<{
        id: string;
        full_name: string;
        phone: string;
        email: string | null;
        status: string | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
};

/**
 * Server-side paginated + searched student list. RLS (not this function)
 * is what actually confines results to the caller's studio — see the file
 * header. `search` is a plain `ilike` on name/phone for the pilot; a real
 * rollout would add a Postgres full-text index once search patterns are
 * known (see the roadmap doc's "Phase 2" note).
 */
export async function getStudentsPage(rawParams: unknown): Promise<StudentsPageResult> {
    const { page, pageSize, search } = listParamsSchema.parse(rawParams);
    await requireOrgId(); // throws if unauthenticated; RLS still governs visibility

    const supabase = await createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from('students')
        .select('id, full_name, phone, email, status', { count: 'exact' })
        .order('full_name', { ascending: true })
        .range(from, to);

    if (search) {
        const term = search.replace(/[%_]/g, '');
        query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

const createStudentSchema = z.object({
    full_name: z.string().trim().min(2).max(200),
    phone: z.string().trim().min(5).max(30),
    email: z.string().trim().email().optional().or(z.literal('')),
    parent_name: z.string().trim().max(200).optional().or(z.literal('')),
    notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

/**
 * Creates a student in one atomic insert. Zod validates shape before it
 * ever reaches Postgres; the RLS INSERT policy's WITH CHECK is the actual
 * backstop guaranteeing `org_id` can't be spoofed even if this function's
 * own logic had a bug.
 */
export async function createStudentAction(rawInput: unknown): Promise<{ id: string }> {
    const input = createStudentSchema.parse(rawInput);
    const { orgId } = await requireOrgId();

    const supabase = await createClient();
    const { data, error } = await supabase
        .from('students')
        .insert({
            org_id: orgId,
            full_name: input.full_name,
            phone: input.phone,
            email: input.email || null,
            parent_name: input.parent_name || null,
            notes: input.notes || null,
            status: 'active',
        })
        .select('id')
        .single();

    if (error) throw new Error(error.message);

    revalidatePath('/students-v2');
    return { id: data.id };
}
