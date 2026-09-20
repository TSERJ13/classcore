'use server';

/**
 * Server Actions for Branches — see docs/architecture-migration.md §11.
 *
 * Unlike every other table in this migration, `branches` had full CRUD RLS
 * ready (confirmed: it's in 20260915_phase0_rls_gapfill.sql's table array)
 * but NOTHING actually wrote real rows into it — branch data has lived
 * entirely in the `studio_settings.settings.branches` JSONB blob
 * (StudioContext.tsx's addBranch/updateBranch/removeBranch only ever call
 * updateSettings()/saveSettings(), which folds `branches` into the settings
 * blob pushed via pushFullStudioMetadata — no `syncRecordToCloud('branches',
 * ...)` call exists anywhere, unlike Staff/Halls which already had one).
 * So this isn't "port the existing real-table write path to RLS" like
 * those two modules — it's activating a real table that was previously
 * inert. Wired additively into StudioContext.tsx (writes to both the real
 * table AND the settings blob) rather than replacing the blob path, since
 * every branch READ (BranchSwitcher, Sidebar, the profile page's branches
 * tab, staff `allowedBranchIds` scoping) still reads `settings.branches`
 * and isn't migrating this pass.
 *
 * WRITES use requireStudioManager() (src/lib/permissions/enforce.ts) — the
 * Permissions module (docs/permissions-module-prd.md) added an
 * Administrator role (staff-token, no auth.uid()) that should be able to
 * manage branches the same as the Main Administrator; the old
 * auth.uid()-only requireOrgId() silently blocked every staff-token
 * session. No dedicated StaffPermissions flag exists for Branches yet
 * (registry.ts's `branches.manage` is `backedBy: null`), so this checks
 * role tier (Main Administrator or Administrator) rather than a specific
 * permission — same honesty-over-invention approach the registry documents.
 *
 * The actual read/write logic lives in src/lib/logic/branches.ts and
 * returns ActionResult<T> (docs/agents/api-contract.md) — these actions are
 * thin wrappers: resolve+check the caller, call the plain logic function,
 * revalidate. Kept this way (rather than inlined) so a future REST route
 * for the mobile/desktop app can call the same logic without duplicating
 * it, once that work actually starts. Auth failures from
 * requireStudioManager() still throw — that's shared infra used by many
 * modules, out of scope for this pilot to convert.
 */

import { revalidatePath } from 'next/cache';
import { requireStudioManager } from '@/lib/permissions/enforce';
import { createBranch, updateBranch, deleteBranch } from '@/lib/logic/branches';
import type { ActionResult } from '@/lib/action-result';

export async function createBranchAction(rawInput: unknown): Promise<ActionResult<void>> {
    const { orgId, client } = await requireStudioManager();
    const result = await createBranch(client, orgId, rawInput);
    if (!result.error) revalidatePath('/profile');
    return result;
}

export async function updateBranchAction(rawInput: unknown): Promise<ActionResult<void>> {
    const { orgId, client } = await requireStudioManager();
    const result = await updateBranch(client, orgId, rawInput);
    if (!result.error) revalidatePath('/profile');
    return result;
}

export async function deleteBranchAction(rawInput: unknown): Promise<ActionResult<void>> {
    const { orgId, client } = await requireStudioManager();
    const result = await deleteBranch(client, orgId, rawInput);
    if (!result.error) revalidatePath('/profile');
    return result;
}
