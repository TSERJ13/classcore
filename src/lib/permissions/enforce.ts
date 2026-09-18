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
 * Only meaningful for staff-token (Administrator/Teacher) callers — a real
 * Supabase Auth session is always the studio's Main Administrator today
 * (see docs/authorization-module.md §3), who already bypasses every
 * PermissionGuard client-side (access.ts's isOwnerOrAdmin), so there's
 * nothing to check for that branch.
 */

import { requireOrgIdDualAuth, type DualAuthContext } from '@/lib/server-actions-auth';
import { computeEffectivePermissions, type PermissionLock } from './resolve';
import { resolveRoleTier } from './role-defaults';
import type { StaffPermissions } from '@/types';

type LockRow = { permission_id: string; locked_value: boolean; target_role: string | null; target_staff_id: string | null };

async function loadStaffTokenPermissions(ctx: DualAuthContext & { staffId: string }): Promise<StaffPermissions> {
    const { data: staffRow, error: staffErr } = await ctx.client
        .from('staff')
        .select('role, data')
        .eq('id', ctx.staffId)
        .eq('org_id', ctx.orgId)
        .maybeSingle();
    if (staffErr) throw new Error(staffErr.message);
    if (!staffRow) throw new Error('Staff record not found');

    const { data: lockRows, error: lockErr } = await ctx.client
        .from('permission_locks')
        .select('permission_id, locked_value, target_role, target_staff_id')
        .eq('org_id', ctx.orgId);
    if (lockErr) throw new Error(lockErr.message);

    const locks: PermissionLock[] = (lockRows ?? []).map((r: LockRow) => ({
        permissionId: r.permission_id as PermissionLock['permissionId'],
        lockedValue: r.locked_value,
        targetRole: r.target_role as PermissionLock['targetRole'],
        targetStaffId: r.target_staff_id,
    }));

    const roleTier = resolveRoleTier(staffRow.role, false);
    const storedPermissions = (staffRow.data as Record<string, unknown> | null)?.permissions as Partial<StaffPermissions> | undefined;
    return computeEffectivePermissions(roleTier, storedPermissions, locks, ctx.staffId);
}

/**
 * Resolves the dual-auth context, then throws unless the caller's
 * effective permission for `permKey` (role default -> stored override ->
 * lock, in that precedence) is true. Real Supabase Auth callers (the
 * Main Administrator) always pass. Returns the same context a plain
 * requireOrgIdDualAuth() call would, so callers can use it identically.
 */
export async function requireEffectivePermission(permKey: keyof StaffPermissions): Promise<DualAuthContext> {
    const ctx = await requireOrgIdDualAuth();
    if (!ctx.isStaffToken || !ctx.staffId) return ctx;

    const effective = await loadStaffTokenPermissions({ ...ctx, staffId: ctx.staffId });
    if (!effective[permKey]) {
        throw new Error(`Permission denied: ${permKey}`);
    }
    return ctx;
}

/**
 * For actions with no dedicated StaffPermissions flag yet (Branches —
 * see registry.ts's `backedBy: null` entries) — restricts to the Main
 * Administrator or an Administrator-tier staff member, without inventing
 * a new flag nothing else checks. Widen this to a real permKey (and add
 * one to StaffPermissions/role-defaults.ts) if Branches ever needs
 * finer-grained control than "studio-wide management tier or not".
 */
export async function requireStudioManager(): Promise<DualAuthContext> {
    const ctx = await requireOrgIdDualAuth();
    if (!ctx.isStaffToken || !ctx.staffId) return ctx;

    const { data: staffRow, error } = await ctx.client
        .from('staff')
        .select('role')
        .eq('id', ctx.staffId)
        .eq('org_id', ctx.orgId)
        .maybeSingle();
    if (error) throw new Error(error.message);
    if (resolveRoleTier(staffRow?.role, false) !== 'administrator') {
        throw new Error('Only the studio\'s Main Administrator or an Administrator can do this');
    }
    return ctx;
}
