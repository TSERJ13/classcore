'use server';

/**
 * Server Actions for Halls (/halls) — replaces hall-store.ts's
 * saveHalls()/deleteHall() write path. See
 * docs/architecture-migration.md §11.
 *
 * `halls` already had full CRUD RLS (in the phase-0 gapfill migration's
 * table array) and hall-store.ts already dual-wrote to the real table
 * (pushCollectionToCloud) — this is a conventional "port existing plumbing
 * to RLS" job, same shape as Groups.
 *
 * hall-store.ts never had a per-row upsert — halls/page.tsx always builds
 * the whole array and calls saveHalls(fullArray) for both create and edit.
 * Kept that same whole-array-replace contract here (saveHallsAction)
 * rather than inventing a new per-row API the page wasn't built around —
 * same reasoning as Plans' savePlansAction.
 *
 * SCHEMA: `id, org_id, name, data` — capacity/color/description/
 * sq_meters/photo_url/is_active/max_parallel_individual all live in `data`.
 *
 * WRITES use requireEffectivePermission('canViewHalls')
 * (src/lib/permissions/enforce.ts), matching /halls/page.tsx's own
 * `PermissionGuard permKey="canViewHalls"` gate — this also lets the new
 * Administrator role (staff-token) manage halls, which the old
 * auth.uid()-only requireOrgId() silently blocked.
 *
 * BRANCH ISOLATION (Phase 1, docs/tasks.md): a hall is a physical room in
 * exactly one branch, so it gets a single `branch_id` (20260921_branch_
 * isolation_phase1.sql — no prior branch data existed for halls to
 * backfill, every row defaults to 'main'). Reads are scoped two ways: by
 * the caller's own permitted branches (resolveCallerBranchIds() —
 * server-side enforced, empty = unrestricted) AND, when the caller passes
 * `branchId`, narrowed to exactly that one (this is what makes the
 * branch-switcher UI actually filter something, which it didn't before
 * this phase). `saveHallsAction`'s whole-array-replace contract now scopes
 * its "delete what's missing" step to just the branch(es) present in the
 * incoming array — without that, saving a branch-filtered view would wipe
 * out every OTHER branch's halls, since they'd all look "missing" from a
 * narrowed view.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOrgIdDualAuth, applyBranchFilter, assertBranchAccess } from '@/lib/server-actions-auth';
import { requireEffectivePermission, resolveCallerBranchIds } from '@/lib/permissions/enforce';

export type HallRow = { id: string; name: string; branch_id: string; [key: string]: unknown };

export async function getHallsAction(branchId?: string): Promise<HallRow[]> {
    const ctx = await requireOrgIdDualAuth();
    const { orgId, client: supabase } = ctx;
    const allowedBranchIds = await resolveCallerBranchIds(ctx);
    if (branchId) assertBranchAccess(allowedBranchIds, branchId);

    let query = supabase.from('halls').select('id, name, branch_id, data').eq('org_id', orgId);
    query = applyBranchFilter(query, allowedBranchIds, 'branch_id');
    if (branchId) query = query.eq('branch_id', branchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map(h => ({ ...(h.data as Record<string, unknown> || {}), id: h.id, name: h.name, branch_id: h.branch_id }));
}

const hallSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1), branch_id: z.string().min(1).default('main') }).passthrough();
const saveHallsSchema = z.array(hallSchema);

/** Whole-array replace, matching hall-store.ts's saveHalls() contract exactly — see file header for the branch-scoping caveat this needed. */
export async function saveHallsAction(rawInput: unknown): Promise<void> {
    const halls = saveHallsSchema.parse(rawInput);
    const ctx = await requireEffectivePermission('canViewHalls');
    const { orgId, client: supabase } = ctx;
    const allowedBranchIds = await resolveCallerBranchIds(ctx);

    if (halls.length === 0) {
        // The whole-array-replace contract means an empty array is a real
        // "delete everything" instruction (hall-store.ts's own saveHalls()
        // honors this), not a no-op — scoped to whatever branches the
        // caller can actually see (org-wide for an unrestricted caller,
        // matching the pre-branch-isolation behavior exactly).
        let deleteQuery = supabase.from('halls').delete().eq('org_id', orgId);
        deleteQuery = applyBranchFilter(deleteQuery, allowedBranchIds, 'branch_id');
        const { error } = await deleteQuery;
        if (error) throw new Error(error.message);
        revalidatePath('/halls');
        return;
    }

    const targetBranchIds = Array.from(new Set(halls.map(h => h.branch_id)));
    assertBranchAccess(allowedBranchIds, targetBranchIds);

    // Fetched org-wide (not branch-filtered) purely for internal validation
    // below — never returned to the caller. Needed for two things: (1) the
    // usual "delete what's missing" diff, scoped to just the branch(es)
    // this save touches; (2) checking that every id already in the DB was
    // already in a branch the caller can see, so a restricted caller can't
    // "steal" a hall out of a branch they don't have access to just by
    // re-submitting its id with their own branch_id — assertBranchAccess
    // above only checks the NEW branch being set, not the row's old one.
    const { data: existingRows, error: fetchErr } = await supabase.from('halls').select('id, branch_id').eq('org_id', orgId);
    if (fetchErr) throw new Error(fetchErr.message);

    const existingBranchById = new Map((existingRows ?? []).map(r => [r.id, r.branch_id]));
    for (const h of halls) {
        const currentBranch = existingBranchById.get(h.id);
        if (currentBranch) assertBranchAccess(allowedBranchIds, currentBranch);
    }

    const incomingIds = new Set(halls.map(h => h.id));
    const toDelete = (existingRows ?? [])
        .filter(r => targetBranchIds.includes(r.branch_id) && !incomingIds.has(r.id))
        .map(r => r.id);
    if (toDelete.length > 0) {
        const { error } = await supabase.from('halls').delete().eq('org_id', orgId).in('id', toDelete);
        if (error) throw new Error(error.message);
    }

    const { error } = await supabase.from('halls')
        .upsert(halls.map(h => ({ id: h.id, org_id: orgId, name: h.name, branch_id: h.branch_id, data: h })), { onConflict: 'id' });
    if (error) throw new Error(error.message);

    revalidatePath('/halls');
}

const deleteHallSchema = z.object({ id: z.string().min(1) });

export async function deleteHallAction(rawInput: unknown): Promise<void> {
    const { id } = deleteHallSchema.parse(rawInput);
    const ctx = await requireEffectivePermission('canViewHalls');
    const { orgId, client: supabase } = ctx;
    const allowedBranchIds = await resolveCallerBranchIds(ctx);

    let query = supabase.from('halls').delete().eq('id', id).eq('org_id', orgId);
    query = applyBranchFilter(query, allowedBranchIds, 'branch_id');
    // .select('id') so a 0-row match (hall exists but in a branch the
    // caller can't reach) is a visible error, not a silent no-op — safe
    // here since /halls page's own deleteHallAction is the only writer for
    // its own delete (no concurrent legacy path racing this specific row).
    const { data, error } = await query.select('id');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('Hall not found or you do not have access to its branch');

    revalidatePath('/halls');
}
