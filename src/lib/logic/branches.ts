/**
 * Branches business logic — extracted out of src/app/actions/branches.ts so
 * it has no framework coupling (no 'use server', no next/cache) and can be
 * called from something other than a Server Action later (a REST route for
 * the native mobile/desktop app) without duplicating the Supabase calls.
 *
 * Auth/permission checking (requireStudioManager()) stays in the Server
 * Action wrapper — it's inherently tied to the Next.js request context
 * (cookies) and a REST route would resolve its caller differently (bearer
 * token, not cookies), so it doesn't belong in this framework-agnostic layer.
 * This file only takes the already-authenticated `{ client, orgId }` and
 * does the actual read/write.
 *
 * Follows the ActionResult<T> convention (docs/agents/api-contract.md) —
 * that doc uses this exact entity as its worked example of the
 * logic/action split, so this pilot follows it for real rather than just
 * citing it.
 *
 * SCHEMA: `id, org_id, name, address, data` — `address` is a real top-level
 * column here (confirmed via /api/sync/bulk's MINIMAL_COLUMNS allowlist),
 * not just inside `data` like everywhere else. Extra fields the Branches
 * module PRD asks for (photo, area, comment, status) live in `data`, same
 * passthrough convention as plans.ts/students.ts.
 *
 * BRANCH ISOLATION (docs/tasks.md's "Branch isolation Phase 1"): halls,
 * students and staff already carry real branch columns
 * (`halls.branch_id`, `students.branch_ids[]`, `staff.allowed_branch_ids[]`)
 * defaulting to the string `'main'` — but no org ever had a real `branches`
 * row with that id, since branch creation only ever went through the
 * header's quick-add (which never used `'main'` as an id). `listBranches`
 * below lazily seeds one the first time an org's branch list comes back
 * empty, so that implicit default has a real, editable row to attach to
 * instead of being a dangling id nothing can ever show or rename.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ok, fail, type ActionResult } from '@/lib/action-result';

export const branchSchema = z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1),
    address: z.string().optional(),
}).passthrough();

export type BranchInput = z.infer<typeof branchSchema>;

export type BranchWithStats = { id: string; name: string; address: string | null; hallCount: number; created_at?: string; [key: string]: unknown };

const DEFAULT_BRANCH_ID = 'main';

export async function listBranches(client: SupabaseClient, orgId: string): Promise<ActionResult<BranchWithStats[]>> {
    const { data: branchRows, error } = await client
        .from('branches').select('id, name, address, data, created_at').eq('org_id', orgId).order('created_at');
    if (error) return fail('query_failed', error.message);

    let rows = branchRows ?? [];
    if (rows.length === 0) {
        const { data: seeded } = await client
            .from('branches')
            .insert({ id: DEFAULT_BRANCH_ID, org_id: orgId, name: 'მთავარი ფილიალი', data: { is_active: true } })
            .select('id, name, address, data, created_at')
            .maybeSingle();
        if (seeded) rows = [seeded];
    }

    const { data: hallRows } = await client.from('halls').select('branch_id').eq('org_id', orgId);
    const hallCounts = new Map<string, number>();
    (hallRows ?? []).forEach(h => hallCounts.set(h.branch_id, (hallCounts.get(h.branch_id) ?? 0) + 1));

    const result: BranchWithStats[] = rows.map(r => {
        const item = (r.data as Record<string, unknown>) || {};
        return { ...item, id: r.id, name: r.name, address: r.address, created_at: r.created_at, hallCount: hallCounts.get(r.id) ?? 0 };
    });
    return ok(result);
}

export async function createBranch(client: SupabaseClient, orgId: string, rawInput: unknown): Promise<ActionResult<void>> {
    const parsed = branchSchema.safeParse(rawInput);
    if (!parsed.success) return fail('validation_failed', parsed.error.message);
    const input = parsed.data;

    const { error } = await client.from('branches').insert({
        id: input.id, org_id: orgId, name: input.name, address: input.address || null, data: input,
    });
    if (error) return fail('query_failed', error.message);
    return ok(undefined);
}

export async function updateBranch(client: SupabaseClient, orgId: string, rawInput: unknown): Promise<ActionResult<void>> {
    const parsed = branchSchema.safeParse(rawInput);
    if (!parsed.success) return fail('validation_failed', parsed.error.message);
    const input = parsed.data;

    const { error } = await client.from('branches')
        .update({ name: input.name, address: input.address || null, data: input })
        .eq('id', input.id).eq('org_id', orgId);
    if (error) return fail('query_failed', error.message);
    return ok(undefined);
}

export type BranchDeletionImpact = { halls: number; students: number; staff: number };

export async function getBranchDeletionImpact(client: SupabaseClient, orgId: string, branchId: string): Promise<ActionResult<BranchDeletionImpact>> {
    const [halls, students, staff] = await Promise.all([
        client.from('halls').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('branch_id', branchId),
        client.from('students').select('id', { count: 'exact', head: true }).eq('org_id', orgId).contains('branch_ids', [branchId]),
        client.from('staff').select('id', { count: 'exact', head: true }).eq('org_id', orgId).contains('allowed_branch_ids', [branchId]),
    ]);
    if (halls.error) return fail('query_failed', halls.error.message);
    if (students.error) return fail('query_failed', students.error.message);
    if (staff.error) return fail('query_failed', staff.error.message);
    return ok({ halls: halls.count ?? 0, students: students.count ?? 0, staff: staff.count ?? 0 });
}

const deleteBranchSchema = z.object({ id: z.string().min(1), reassignToBranchId: z.string().min(1).optional() });

/**
 * Two-step delete per the Branches module PRD §6: halls/students/staff
 * attached to this branch are never left dangling — they're moved to
 * `reassignToBranchId` (the branch the admin picked in the confirm dialog),
 * or to the implicit default branch id if none was picked, since
 * `halls.branch_id`/`groups.branch_id` are NOT NULL columns with that same
 * default. Only the branch row itself is ever deleted.
 */
export async function deleteBranch(client: SupabaseClient, orgId: string, rawInput: unknown): Promise<ActionResult<void>> {
    const parsed = deleteBranchSchema.safeParse(rawInput);
    if (!parsed.success) return fail('validation_failed', parsed.error.message);
    const { id, reassignToBranchId } = parsed.data;

    // A studio always needs somewhere for its halls/students/staff to live —
    // deleting the only remaining branch would leave the fallback target
    // below pointing at the very row being deleted.
    const { count: branchCount, error: countErr } = await client
        .from('branches').select('id', { count: 'exact', head: true }).eq('org_id', orgId);
    if (countErr) return fail('query_failed', countErr.message);
    if ((branchCount ?? 0) <= 1) return fail('last_branch', 'Cannot delete the only remaining branch');

    let target = DEFAULT_BRANCH_ID;
    if (reassignToBranchId && reassignToBranchId !== id) {
        // Never trust a caller-supplied target blindly — confirm it's a real
        // branch in this org before stamping it onto anything, so a bad
        // value can't silently orphan every hall/student/staff row it
        // touches onto a nonexistent branch id.
        const { data: targetRow, error: targetErr } = await client
            .from('branches').select('id').eq('org_id', orgId).eq('id', reassignToBranchId).maybeSingle();
        if (targetErr) return fail('query_failed', targetErr.message);
        if (!targetRow) return fail('validation_failed', 'reassignToBranchId does not belong to this org');
        target = reassignToBranchId;
    }

    const { error: hallsErr } = await client.from('halls').update({ branch_id: target }).eq('org_id', orgId).eq('branch_id', id);
    if (hallsErr) return fail('query_failed', hallsErr.message);

    const { data: affectedStudents, error: studentsFetchErr } = await client
        .from('students').select('id, branch_ids').eq('org_id', orgId).contains('branch_ids', [id]);
    if (studentsFetchErr) return fail('query_failed', studentsFetchErr.message);
    for (const s of affectedStudents ?? []) {
        const nextIds = Array.from(new Set((s.branch_ids ?? []).filter((b: string) => b !== id).concat(target)));
        const { error } = await client.from('students').update({ branch_ids: nextIds }).eq('id', s.id).eq('org_id', orgId);
        if (error) return fail('query_failed', error.message);
    }

    const { data: affectedStaff, error: staffFetchErr } = await client
        .from('staff').select('id, allowed_branch_ids').eq('org_id', orgId).contains('allowed_branch_ids', [id]);
    if (staffFetchErr) return fail('query_failed', staffFetchErr.message);
    for (const s of affectedStaff ?? []) {
        const nextIds = Array.from(new Set((s.allowed_branch_ids ?? []).filter((b: string) => b !== id).concat(target)));
        const { error } = await client.from('staff').update({ allowed_branch_ids: nextIds }).eq('id', s.id).eq('org_id', orgId);
        if (error) return fail('query_failed', error.message);
    }

    const { error } = await client.from('branches').delete().eq('id', id).eq('org_id', orgId);
    if (error) return fail('query_failed', error.message);
    return ok(undefined);
}
