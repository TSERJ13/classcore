/**
 * The core Permissions engine — computes effective permissions and Scope
 * per docs/permissions-module-prd.md §4-§7: Role default → Override
 * (stored per-staff-member permissions) → Lock (always wins).
 *
 * Deliberately application-layer only, never RLS: staff-token sessions
 * (Administrator/Teacher) have no `auth.uid()` at all (see
 * docs/authorization-module.md §1), so Scope/Lock can't be expressed as a
 * database-enforced boundary the way `org_id` RLS policies are elsewhere
 * in this codebase — every Server Action that needs to respect Scope has
 * to call this and filter explicitly, the same way `getVisibleGroupIds()`
 * (src/lib/access.ts) already does for Teacher's group-level access.
 */

import type { StaffPermissions } from '@/types';
import { ROLE_DEFAULT_PERMISSIONS, resolveRoleTier, type RoleTier } from './role-defaults';

export type ScopeLevel = 'platform' | 'studio' | 'branch' | 'group' | 'self';

/** Ladder order, lowest index = broadest. Matches docs/permissions-module-prd.md §4. */
const SCOPE_ORDER: ScopeLevel[] = ['platform', 'studio', 'branch', 'group', 'self'];

export function scopeIncludes(broader: ScopeLevel, narrower: ScopeLevel): boolean {
    return SCOPE_ORDER.indexOf(broader) <= SCOPE_ORDER.indexOf(narrower);
}

/** A role's default Scope level (§4's "←" column) — the starting point for what data a permission check should consider in-bounds. */
export function resolveScopeLevel(roleTier: RoleTier | null): ScopeLevel {
    if (roleTier === 'super_admin') return 'platform';
    if (roleTier === 'owner' || roleTier === 'administrator') return 'studio';
    if (roleTier === 'teacher') return 'group';
    return 'self';
}

export interface PermissionLock {
    permissionId: keyof StaffPermissions;
    lockedValue: boolean;
    /** Lock applies to everyone currently on this role tier, if set. */
    targetRole: RoleTier | null;
    /** Lock applies to one specific staff member, if set. Takes precedence over targetRole when both could match the same permission (more specific wins). */
    targetStaffId: string | null;
}

/**
 * Role default → stored Override → Lock, in that precedence order (Lock
 * always wins per §7's "უპირატესობა კონფლიქტის დროს"). `storedPermissions`
 * is today's existing `StaffMember.permissions`/`Teacher.permissions`
 * object — kept as-is (dense, every key present) rather than requiring a
 * migration to a sparse "only the deltas" shape; for a role this module
 * doesn't have a default for (roleTier === null — a custom role like
 * "receptionist"), the stored object alone is the answer, same as before
 * this module existed.
 */
export function computeEffectivePermissions(
    roleTier: RoleTier | null,
    storedPermissions: Partial<StaffPermissions> | null | undefined,
    locks: PermissionLock[],
    staffId: string | null | undefined,
): StaffPermissions {
    const base = roleTier ? ROLE_DEFAULT_PERMISSIONS[roleTier] : ({} as StaffPermissions);
    const merged: StaffPermissions = { ...base, ...(storedPermissions || {}) } as StaffPermissions;

    for (const lock of locks) {
        const matchesStaff = lock.targetStaffId && staffId && lock.targetStaffId === staffId;
        const matchesRole = lock.targetRole && roleTier && lock.targetRole === roleTier;
        if (matchesStaff || matchesRole) {
            merged[lock.permissionId] = lock.lockedValue;
        }
    }

    return merged;
}

export { resolveRoleTier };
export type { RoleTier };
