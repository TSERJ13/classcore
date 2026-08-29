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
    if (!role) return false;
    const r = role.toLowerCase().trim();
    return r !== 'owner' && r !== 'admin';
}

export function isOwnerOrAdmin(role?: string | null): boolean {
    if (!role) return false;
    const r = role.toLowerCase().trim();
    return r === 'owner' || r === 'admin';
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

    const email = (profile?.email || '').toLowerCase().trim();
    const fullName = ((profile as any)?.full_name || (profile as any)?.first_name || '').toLowerCase().trim();
    
    // Match staff record by email, id, or name
    const me = (staff || []).find(s => {
        if (profile?.id && s.id === profile.id) return true;
        if (email && (s.email || '').toLowerCase().trim() === email) return true;
        const sName = ((s as any)?.full_name || (s as any)?.first_name || '').toLowerCase().trim();
        return fullName && sName && (sName === fullName || sName.includes(fullName));
    });

    const staffIds = new Set<string>([
        profile?.id,
        me?.id,
        (profile as any)?.staff_id
    ].filter(Boolean) as string[]);

    // 1) Groups where this teacher is primary or secondary
    (groups || []).forEach(g => {
        const primary = g.teacherId || (g as any).teacher_id;
        const secondary = g.secondaryTeacherId || (g as any).secondary_teacher_id;
        if (staffIds.has(primary) || staffIds.has(secondary)) {
            ids.add(g.id);
        }
    });

    // 2) Staff record's explicit assignments
    (me?.assigned_group_ids || []).forEach(id => ids.add(id));
    ((me as any)?.assignedGroupIds || []).forEach((id: string) => ids.add(id));

    // 3) Profile-level assignments
    (profile?.assigned_group_ids || []).forEach(id => ids.add(id));
    ((profile as any)?.assignedGroupIds || []).forEach((id: string) => ids.add(id));

    return Array.from(ids);
}

/** Convenience: can this user see a given group id? */
export function canSeeGroup(visibleIds: string[] | null, groupId?: string | null): boolean {
    if (visibleIds === null) return true;       // unrestricted
    if (!groupId) return false;
    return visibleIds.includes(groupId);
}
