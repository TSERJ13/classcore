/**
 * Role default permission sets — the "Role" layer of the Permissions PRD's
 * Permission → Role → User → Override → Scope → Lock model (see
 * docs/permissions-module-prd.md §2, §6). These are the starting point an
 * `Override` (the per-staff-member `permissions` object that already
 * exists — see src/types/index.ts's `StaffPermissions`) is layered on top
 * of, not a hardcoded ceiling.
 *
 * Role tiers, mapped to what's real in the codebase (full mapping/
 * reasoning in docs/authorization-module.md §2):
 * - super_admin — platform-wide (isSuperAdminEmail), not studio-scoped.
 * - owner — Main Administrator, Supabase Auth, one per studio.
 * - administrator — NEW formal tier this module adds, a `staff.role`
 *   value (same session mechanism as teacher — no new auth surface).
 * - teacher — staff.role === 'teacher', unchanged mechanism.
 *
 * `student` is deliberately absent: the PRD's own §8/§10 defer the
 * student portal (and therefore any real Student-role session) to its own
 * future module.
 */

import type { StaffPermissions } from '@/types';

export type RoleTier = 'super_admin' | 'owner' | 'administrator' | 'teacher';

const ALL_TRUE: StaffPermissions = {
    canViewAttendance: true,
    canViewSubscriptions: true,
    canViewStudents: true,
    canViewCalendar: true,
    canEditCalendar: true,
    canViewGroups: true,
    canViewTeachers: true,
    canViewHalls: true,
    canViewShop: true,
    canViewAnalytics: true,
    canViewSMS: true,
    canViewBilling: true,
    canAddStudents: true,
    canDeleteRecords: true,
    manageBilling: true,
    viewFinancials: true,
    manageInventory: true,
};

/**
 * "Administrator" per the PRD: can manage students/teachers and their
 * permissions, but not Main Administrator's own authority — modeled here
 * as everything true except the studio's own financial/billing controls,
 * which stay Main-Administrator-only by default. An Administrator's own
 * `canViewTeachers`/etc. can still be widened per-person via Override —
 * this is only the starting point.
 */
const ADMINISTRATOR_DEFAULTS: StaffPermissions = {
    ...ALL_TRUE,
    canViewBilling: false,
    manageBilling: false,
    viewFinancials: false,
};

/**
 * Matches the existing new-teacher default already baked into
 * TeacherModal.tsx's EMPTY constant — reused here rather than inventing a
 * different default, so nothing already relied upon changes.
 */
const TEACHER_DEFAULTS: StaffPermissions = {
    canViewAttendance: true,
    canViewSubscriptions: true,
    canViewStudents: true,
    canViewCalendar: true,
    canEditCalendar: true,
    canViewGroups: true,
    canViewTeachers: false,
    canViewHalls: true,
    canViewShop: true,
    canViewAnalytics: false,
    canViewSMS: false,
    canViewBilling: false,
};

export const ROLE_DEFAULT_PERMISSIONS: Record<RoleTier, StaffPermissions> = {
    super_admin: ALL_TRUE,
    owner: ALL_TRUE,
    administrator: ADMINISTRATOR_DEFAULTS,
    teacher: TEACHER_DEFAULTS,
};

/** Maps a raw role string (profile.role / staff.role) to a RoleTier, or null for a role this module doesn't model a default for (e.g. a custom role like 'receptionist' — permissions for those are set entirely by hand, same as before this module). */
export function resolveRoleTier(role: string | null | undefined, isSuperAdmin: boolean): RoleTier | null {
    if (isSuperAdmin) return 'super_admin';
    if (role === 'owner') return 'owner';
    if (role === 'administrator') return 'administrator';
    if (role === 'teacher') return 'teacher';
    return null;
}
