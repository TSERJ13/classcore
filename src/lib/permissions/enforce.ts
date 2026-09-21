/**
 * Server-side enforcement for the Permissions engine (resolve.ts) — the
 * missing piece that made every Permission Lock built this phase purely
 * cosmetic: computeEffectivePermissions() was only ever called client-side
 * (useUser.tsx), so a staff-token session with a permission locked OFF
 * could still call the underlying Server Action directly (e.g. from
 * devtools) and it would succeed, since the dual-auth actions only ever
 * checked "is this org_id right", never "is this specific action allowed
 * for this caller". This closes that gap for the actions that use it.
 *
 * IMPORTANT: this used to bypass unconditionally for `!ctx.isStaffToken`,
 * on the assumption that "real Supabase Auth" always meant the Main
 * Administrator. That stopped being true the moment two features shipped:
 * Main Administrator status transfer (the outgoing owner keeps their real
 * Auth login but `role` becomes 'administrator') and real Supabase Auth
 * accounts for newly-created Teacher/Administrator staff (Unified Auth —
 * docs/tasks.md's "Unified Auth" phase). Both are real-Auth sessions that
 * are NOT owner-tier and must go through the same effective-permission
 * check a staff-token session does. `role === 'owner'` is now the only
 * unconditional bypass, checked for both connection types.
 */

import { requireOrgIdDualAuth, type DualAuthContext } from '@/lib/server-actions-auth';
import { computeEffectivePermissions, type PermissionLock } from './resolve';
import { resolveRoleTier, type RoleTier } from './role-defaults';
import type { StaffPermissions } from '@/types';

type LockRow = { permission_id: string; locked_value: boolean; target_role: string | null; target_staff_id: string | null };

interface CallerInfo {
    role: string | null;
    /** The `staff` row id to resolve stored permissions/target-staff Locks against — for a real-Auth Teacher/Administrator (Unified Auth) this is their Supabase Auth user id, since that's what their `staff` row is now keyed by; for staff-token it's the token's own staffId. */
    staffId: string | null;
    storedPermissions: Partial<StaffPermissions> | null;
    /** This caller's own branch restriction (`staff.allowed_branch_ids`) — empty array means unrestricted (all branches), matching the existing BranchSwitcher/Sidebar convention. Always empty for an owner. */
    allowedBranchIds: string[];
}

async function resolveCaller(ctx: DualAuthContext): Promise<CallerInfo> {
    if (!ctx.isStaffToken) {
        const { data: userData } = await ctx.client.auth.getUser();
        const meta = userData?.user?.user_metadata ?? {};
        const role = (meta.role as string) ?? null;
        const staffId = userData?.user?.id ?? null;
        const storedPermissions = (meta.permissions as Partial<StaffPermissions>) ?? null;
        if (role === 'owner' || !staffId) {
            return { role, staffId, storedPermissions, allowedBranchIds: [] };
        }
        // Unified Auth: a real-Auth Administrator/Teacher's own branch
        // restriction lives on their `staff` row, same place a
        // staff-token session's does — no user_metadata equivalent exists.
        const { data: staffRow } = await ctx.client
            .from('staff').select('allowed_branch_ids').eq('id', staffId).eq('org_id', ctx.orgId).maybeSingle();
        return { role, staffId, storedPermissions, allowedBranchIds: staffRow?.allowed_branch_ids ?? [] };
    }

    if (!ctx.staffId) return { role: null, staffId: null, storedPermissions: null, allowedBranchIds: [] };
    const { data: staffRow, error } = await ctx.client
        .from('staff')
        .select('role, data, allowed_branch_ids')
        .eq('id', ctx.staffId)
        .eq('org_id', ctx.orgId)
        .maybeSingle();
    if (error) throw new Error(error.message);
    if (!staffRow) throw new Error('Staff record not found');
    return {
        role: staffRow.role,
        staffId: ctx.staffId,
        storedPermissions: (staffRow.data as Record<string, unknown> | null)?.permissions as Partial<StaffPermissions> | undefined ?? null,
        allowedBranchIds: staffRow.role === 'owner' ? [] : (staffRow.allowed_branch_ids ?? []),
    };
}

/**
 * Resolves the caller's own branch restriction — empty array means
 * unrestricted. Separate from requireEffectivePermission()/
 * requireStudioManager() (which callers already use for their permission
 * gate) so entities that don't need a permission check at all (plain reads)
 * can still resolve branch access without paying for a permission
 * resolution they don't need; entities that already call one of those two
 * can call this afterward with the same `ctx` — resolveCaller() itself does
 * one extra staff-row query, so this is meant to be called once per action,
 * not per row.
 */
export async function resolveCallerBranchIds(ctx: DualAuthContext): Promise<string[]> {
    const caller = await resolveCaller(ctx);
    return caller.allowedBranchIds;
}

async function loadLocks(ctx: DualAuthContext): Promise<PermissionLock[]> {
    const { data: lockRows, error } = await ctx.client
        .from('permission_locks')
        .select('permission_id, locked_value, target_role, target_staff_id')
        .eq('org_id', ctx.orgId);
    if (error) throw new Error(error.message);
    return (lockRows ?? []).map((r: LockRow) => ({
        permissionId: r.permission_id as PermissionLock['permissionId'],
        lockedValue: r.locked_value,
        targetRole: r.target_role as RoleTier | null,
        targetStaffId: r.target_staff_id,
    }));
}

/**
 * Resolves the dual-auth context, then throws unless the caller's
 * effective permission for `permKey` (role default -> stored override ->
 * lock, in that precedence) is true. Only `role === 'owner'` (the Main
 * Administrator) bypasses unconditionally — everyone else, real-Auth or
 * staff-token, gets a real check. Returns the same context a plain
 * requireOrgIdDualAuth() call would, so callers can use it identically.
 */
export async function requireEffectivePermission(permKey: keyof StaffPermissions): Promise<DualAuthContext> {
    const ctx = await requireOrgIdDualAuth();
    const caller = await resolveCaller(ctx);
    if (caller.role === 'owner') return ctx;

    const roleTier = resolveRoleTier(caller.role, false);
    const locks = await loadLocks(ctx);
    const effective = computeEffectivePermissions(roleTier, caller.storedPermissions, locks, caller.staffId);
    if (!effective[permKey]) {
        throw new Error(`Permission denied: ${permKey}`);
    }
    return ctx;
}

/**
 * For actions with no dedicated StaffPermissions flag yet (Branches —
 * see registry.ts's `backedBy: null` entries) — restricts to the Main
 * Administrator or an Administrator-tier caller (real-Auth or
 * staff-token), without inventing a new flag nothing else checks. Widen
 * this to a real permKey (and add one to StaffPermissions/role-defaults.ts)
 * if Branches ever needs finer-grained control than "studio-wide
 * management tier or not".
 */
export async function requireStudioManager(): Promise<DualAuthContext> {
    const ctx = await requireOrgIdDualAuth();
    const caller = await resolveCaller(ctx);
    if (caller.role === 'owner') return ctx;
    if (resolveRoleTier(caller.role, false) !== 'administrator') {
        throw new Error('Only the studio\'s Main Administrator or an Administrator can do this');
    }
    return ctx;
}
