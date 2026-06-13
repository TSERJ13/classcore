/**
 * access.ts — role-based visibility helpers.
 *
 * The problem: a teacher should only ever see the groups they actually teach.
 * Previously the app trusted only `profile.assigned_group_ids`, which is often
 * empty (assignments live in settings.staff and on the groups themselves), so
 * teachers either saw everything or nothing. This resolves a teacher's visible
 * groups from ALL reliable sources and unions them.
 */

export function isTeacherRole(role?: string | null): boolean {
    return role === 'teacher' || role === 'coach' || role === 'instructor';
}

export function isOwnerOrAdmin(role?: string | null): boolean {
    return role === 'owner' || role === 'admin' || role === 'manager';
}

interface MinimalGroup { id: string; teacherId?: string; secondaryTeacherId?: string }
interface MinimalStaff { id: string; email?: string; assigned_group_ids?: string[] }
interface MinimalProfile { id?: string; email?: string; role?: string; assigned_group_ids?: string[] }

/**
 * Returns the set of group IDs a user is allowed to see.
 * - Owners/admins/managers: null  (meaning "all groups — no restriction").
 * - Teachers: the union of
 *     1. groups where they are primary/secondary teacher (matched by staff id),
 *     2. their staff record's assigned_group_ids,
 *     3. profile.assigned_group_ids.
 */
export function getVisibleGroupIds(
    profile: MinimalProfile | null | undefined,
    staff: MinimalStaff[] | null | undefined,
    groups: MinimalGroup[] | null | undefined,
): string[] | null {
    const role = profile?.role;
    if (!isTeacherRole(role)) return null; // owners/admins see everything

    const ids = new Set<string>();

    // Match the logged-in user to their staff record (by email, case-insensitive).
    const email = (profile?.email || '').toLowerCase().trim();
    const me = (staff || []).find(s => (s.email || '').toLowerCase().trim() === email);
    const myStaffId = me?.id || profile?.id;

    // 1) Groups where this teacher is primary or secondary.
    (groups || []).forEach(g => {
        if (myStaffId && (g.teacherId === myStaffId || g.secondaryTeacherId === myStaffId)) {
            ids.add(g.id);
        }
    });

    // 2) Their staff record's explicit assignments.
    (me?.assigned_group_ids || []).forEach(id => ids.add(id));

    // 3) Profile-level assignments (legacy / auth-provided).
    (profile?.assigned_group_ids || []).forEach(id => ids.add(id));

    return Array.from(ids);
}

/** Convenience: can this user see a given group id? */
export function canSeeGroup(visibleIds: string[] | null, groupId?: string | null): boolean {
    if (visibleIds === null) return true;       // unrestricted
    if (!groupId) return false;
    return visibleIds.includes(groupId);
}
