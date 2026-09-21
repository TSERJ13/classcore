'use server';

/**
 * Server Actions for the Groups module (/groups) — replaces group-store.ts's
 * localStorage write path (createGroup/saveGroups/deleteGroup) for the
 * Groups management page. See docs/architecture-migration.md §9.
 *
 * Scoped to this page's own CRUD only. `group-store.ts` itself is NOT
 * removed — calendar/page.tsx still writes to it directly (createGroup,
 * addSlotToGroup/removeSlotFromGroup to keep a group's schedule_slots in
 * sync with recurring calendar events, and a color patch), and every
 * read-only consumer (attendance, dashboard, analytics, teachers,
 * subscriptions' plan/issue pickers, StudentModal, the public student page,
 * Header search, ManualSmsModal, onboarding) still reads getGroups()'s
 * local cache. Calendar/Events is its own not-yet-migrated module — folding
 * its group-writing side effects in here would be scope creep this pass
 * isn't taking on. Those reads stay eventually-consistent the same way
 * Plans do: StudioContext's background hydration keeps the local cache
 * synced with whatever this module (or calendar) writes to the real table.
 *
 * `groups` table already had full CRUD RLS from
 * 20260915_phase0_rls_gapfill.sql (confirmed: `groups` — the live table
 * name, not the older hardening migration's `groups_classes` — is in that
 * migration's table array) — no new RLS migration needed for this module.
 *
 * SCHEMA: `id, org_id, name, data (JSONB)` — same pattern as every other
 * table in this migration; capacity/type/difficulty/hall_id/color/
 * teacherId/secondaryTeacherId/schedule_slots/etc. all live in `data`,
 * matching group-store.ts's saveGroups() (which pushes the whole Group
 * object into `data` alongside `id`/`name`).
 *
 * WRITES use requireEffectivePermission('canViewGroups')
 * (src/lib/permissions/enforce.ts), matching /groups/page.tsx's own
 * `PermissionGuard permKey="canViewGroups"` gate — Teacher has
 * `canViewGroups: true` by default (role-defaults.ts) and the page already
 * shows the same "Add Group"/edit/delete controls to any teacher who
 * reaches it, so this also fixes a pre-existing bug: the old
 * auth.uid()-only requireOrgId() rejected every staff-token session, so a
 * teacher clicking "Add Group" always failed server-side even though the
 * button was visible to them.
 *
 * BRANCH ISOLATION (Phase 1, docs/tasks.md): a group happens in one hall in
 * one branch, so it gets a single `branch_id` (20260921_branch_isolation_
 * phase1.sql — no prior branch data existed for groups, every row defaults
 * to 'main'). getGroupsAction() also picked up the missing `org_id` filter
 * it never had (relied on RLS alone, which doesn't apply to the
 * service-role client staff-token sessions use — a real pre-existing gap,
 * fixed here since the branch filter needed the same `orgId` anyway).
 *
 * Inherits the same gap this file already had for org_id/permission
 * enforcement (see the paragraph above): `group-store.ts`'s legacy write
 * path (calendar/page.tsx's createGroup/addSlotToGroup/removeSlotFromGroup,
 * onboarding's SetupWizard) writes to this SAME `groups` table with no
 * branch check and no `branch_id` at all — a branch-restricted caller
 * using those surfaces isn't stopped from creating/editing a group in a
 * branch they can't otherwise reach. Not fixed here for the same reason it
 * wasn't fixed for org_id/permissions originally: folding Calendar's own
 * group-writing side effects into this migration is scope creep this pass
 * isn't taking on — only `/groups` page's own CRUD (this file) is actually
 * branch-enforced in Phase 1.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOrgIdDualAuth, applyBranchFilter, assertBranchAccess } from '@/lib/server-actions-auth';
import { requireEffectivePermission, resolveCallerBranchIds } from '@/lib/permissions/enforce';

export type GroupRow = {
    id: string;
    name: string;
    branch_id: string;
    teacherId?: string;
    secondaryTeacherId?: string;
    enrolled?: number;
    [key: string]: unknown;
};

/** Same query shape as students.ts's getGroupsForOrg() — kept independent (not imported cross-file) so each Server Action module owns its own reads, matching this migration's established style. */
export async function getGroupsAction(branchId?: string): Promise<GroupRow[]> {
    const ctx = await requireOrgIdDualAuth();
    const { orgId, client: supabase } = ctx;
    const allowedBranchIds = await resolveCallerBranchIds(ctx);
    if (branchId) assertBranchAccess(allowedBranchIds, branchId);

    let query = supabase.from('groups').select('id, name, branch_id, data').eq('org_id', orgId).order('name');
    query = applyBranchFilter(query, allowedBranchIds, 'branch_id');
    if (branchId) query = query.eq('branch_id', branchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map(g => ({ ...(g.data as Record<string, unknown> || {}), id: g.id, name: g.name, branch_id: g.branch_id }));
}

const groupSchema = z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1),
    capacity: z.number().int().min(1).default(15),
    type: z.string().default('Dance'),
    branch_id: z.string().min(1).default('main'),
}).passthrough();

/**
 * GroupModal already generates a client-side id (`g_${Date.now()}`) before
 * calling onSave, and separately uses that SAME id to sync the group's
 * schedule to real calendar events (syncGroupScheduleToCalendar, called
 * right after onSave — see event-store.ts). So this has to persist the
 * client-supplied id verbatim rather than minting its own, or the group row
 * and its already-created calendar events would end up under two different
 * ids. Only falls back to generating one if a caller genuinely didn't send
 * one.
 */
export async function createGroupAction(rawInput: unknown): Promise<{ id: string }> {
    const input = groupSchema.parse(rawInput);
    const ctx = await requireEffectivePermission('canViewGroups');
    const { orgId, client: supabase } = ctx;
    assertBranchAccess(await resolveCallerBranchIds(ctx), input.branch_id);

    const id = input.id || `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullRecord = { ...input, id, enrolled: 0 };

    const { error } = await supabase.from('groups').insert({ id, org_id: orgId, name: input.name, branch_id: input.branch_id, data: fullRecord });
    if (error) throw new Error(error.message);

    revalidatePath('/groups');
    return { id };
}

const updateGroupSchema = z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1),
    branch_id: z.string().min(1).default('main'),
}).passthrough();

export async function updateGroupAction(rawInput: unknown): Promise<void> {
    const input = updateGroupSchema.parse(rawInput);
    const ctx = await requireEffectivePermission('canViewGroups');
    const { orgId, client: supabase } = ctx;
    const allowedBranchIds = await resolveCallerBranchIds(ctx);
    // Checks BOTH directions: can the caller set this branch (the target),
    // and — via the filtered query below — do they have access to whatever
    // branch this row is CURRENTLY in (a restricted caller shouldn't be
    // able to edit a row sitting in a branch they can't see, even if the
    // branch_id they're setting it to is one they're allowed into).
    assertBranchAccess(allowedBranchIds, input.branch_id);

    let query = supabase.from('groups')
        .update({ name: input.name, branch_id: input.branch_id, data: input })
        .eq('id', input.id).eq('org_id', orgId);
    query = applyBranchFilter(query, allowedBranchIds, 'branch_id');
    // .select('id') so a 0-row match (row exists but in a branch the
    // caller can't reach) is distinguishable from success — without it,
    // Supabase reports no error for a filtered-out update, and the caller
    // (and the page's own optimistic UI) would believe an edit persisted
    // that never actually touched the database. Safe to check here (unlike
    // calendar_events' actions): no OTHER caller of updateGroupAction
    // itself races this specific call with the same logical write, so a
    // 0-row result here is never a benign race, always a real access denial.
    const { data, error } = await query.select('id');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('Group not found or you do not have access to its branch');

    revalidatePath('/groups');
}

const deleteGroupSchema = z.object({ id: z.string().min(1) });

export async function deleteGroupAction(rawInput: unknown): Promise<void> {
    const { id } = deleteGroupSchema.parse(rawInput);
    const ctx = await requireEffectivePermission('canViewGroups');
    const { orgId, client: supabase } = ctx;
    const allowedBranchIds = await resolveCallerBranchIds(ctx);

    let query = supabase.from('groups').delete().eq('id', id).eq('org_id', orgId);
    query = applyBranchFilter(query, allowedBranchIds, 'branch_id');
    const { data, error } = await query.select('id');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('Group not found or you do not have access to its branch');

    revalidatePath('/groups');
}
