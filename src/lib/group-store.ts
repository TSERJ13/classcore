/**
 * group-store.ts
 * Manages class groups for the studio.
 */

export interface ScheduleSlot {
    dayOfWeek: number; // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
    startTime: string; // HH:MM
    endTime: string;   // HH:MM
}

export interface Group {
    id: string;
    name: string;
    coach: string;
    teacherId: string;
    schedule: string; // human-readable display string (auto-generated)
    schedule_slots?: ScheduleSlot[]; // structured schedule data
    capacity: number;
    enrolled: number;
    type: string;
    difficulty: string | null;
    hall_id?: string; // linked hall
    color?: string;
    org_id?: string;
}

import { getScopedKey, getActiveSlug, markLocalUpdate } from './utils';

const BASE_GROUPS_KEY = 'cc_groups';
function getGroupsKey() { return getScopedKey(BASE_GROUPS_KEY); }

// Matches teacher-store assigned_group_ids (g1 to g5)
const INITIAL_GROUPS: Group[] = [];

export function getGroups(): Group[] {
    if (typeof window === 'undefined') return INITIAL_GROUPS;
    try {
        const activeSlug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : 'demo.classcore.ge';
        const activeBranch = typeof window !== 'undefined' ? (localStorage.getItem(`cc_active_branch_${activeSlug}`) || 'main') : 'main';
        const isMainBranch = activeBranch === 'main';

        const key = getGroupsKey();
        let saved = localStorage.getItem(key);

        // Migration: If new scoped key is empty, check old unscoped key
        if (!saved && isMainBranch) {
            const oldKey = `cc_groups_${activeSlug}`;
            saved = localStorage.getItem(oldKey);
            if (saved) {
                console.log('🚚 [GroupStore] Migrating legacy main branch data');
                localStorage.setItem(key, saved);
            }
        }

        if (!saved) {
            const data = isMainBranch ? INITIAL_GROUPS : [];
            if (isMainBranch) localStorage.setItem(key, JSON.stringify(data));
            return data;
        }
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : INITIAL_GROUPS;
    } catch {
        return INITIAL_GROUPS;
    }
}

export function saveGroups(groups: Group[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getGroupsKey(), JSON.stringify(groups));
    markLocalUpdate();
    window.dispatchEvent(new Event('cc_groups_update'));
}

export function getGroupById(id: string): Group | null {
    return getGroups().find(g => g.id === id) || null;
}

export function createGroup(group: Omit<Group, 'id' | 'enrolled' | 'schedule'>): Group {
    const groups = getGroups();
    const id = 'g' + Math.random().toString(36).substr(2, 9);
    const slots = group.schedule_slots || [];
    
    const newGroup: Group = {
        ...group,
        id,
        enrolled: 0,
        schedule_slots: slots,
        schedule: slotsToDisplay(slots),
    };
    groups.push(newGroup);
    saveGroups(groups);
    return newGroup;
}

/** Called when a calendar event with group_id is created: adds the slot to group.schedule_slots */
export function addSlotToGroup(groupId: string, slot: ScheduleSlot, groupTitle?: string): void {
    const groups = getGroups();
    const idx = groups.findIndex(g => g.id === groupId);
    if (idx === -1) return;
    const existing = groups[idx].schedule_slots || [];
    // Avoid duplicate for same day + time
    const isDuplicate = existing.some(s => s.dayOfWeek === slot.dayOfWeek && s.startTime === slot.startTime && s.endTime === slot.endTime);
    if (!isDuplicate) {
        const updated = [...existing, slot];
        groups[idx] = {
            ...groups[idx],
            schedule_slots: updated,
            schedule: slotsToDisplay(updated),
        };
        saveGroups(groups);
    }
}

/** Called when a calendar event with group_id is deleted: removes matching slot from group.schedule_slots */
export function removeSlotFromGroup(groupId: string, slot: ScheduleSlot): void {
    const groups = getGroups();
    const idx = groups.findIndex(g => g.id === groupId);
    if (idx === -1) return;
    const existing = groups[idx].schedule_slots || [];
    const updated = existing.filter(s => !(s.dayOfWeek === slot.dayOfWeek && s.startTime === slot.startTime && s.endTime === slot.endTime));
    groups[idx] = {
        ...groups[idx],
        schedule_slots: updated,
        schedule: slotsToDisplay(updated),
    };
    saveGroups(groups);
}

export function slotsToDisplay(slots: ScheduleSlot[], lang: string = 'ka'): string {
    const labels: Record<string, string[]> = {
        ka: ['ორ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'],
        en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    };
    const currentLabels = labels[lang] || labels.en;

    if (!slots || !slots.length) return '';
    const grouped = new Map<string, number[]>();
    for (const s of slots) {
        const key = `${s.startTime}-${s.endTime}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(s.dayOfWeek);
    }
    const parts: string[] = [];
    grouped.forEach((days, time) => {
        parts.push(`${days.sort((a, b) => a - b).map(d => currentLabels[d]).join(', ')} · ${time}`);
    });
    return parts.join(' | ');
}

/** Updates a group's teacher info (coach name and teacherId) */
export function updateGroupTeacher(groupId: string, teacherId: string, coachName: string): void {
    const groups = getGroups();
    const idx = groups.findIndex(g => g.id === groupId);
    if (idx === -1) return;
    
    groups[idx] = { ...groups[idx], teacherId, coach: coachName };
    saveGroups(groups);
}

/** Updates all groups that were assigned to a teacher but are no longer, or vice versa */
export function updateTeacherGroups(teacherId: string, coachName: string, assignedGroupIds: string[]): void {
    const groups = getGroups();
    let changed = false;
    
    const updated = groups.map(g => {
        const shouldBeAssigned = assignedGroupIds.includes(g.id);
        const isCurrentlyAssigned = g.teacherId === teacherId;
        const nameChanged = g.coach !== coachName;

        if (shouldBeAssigned) {
            if (!isCurrentlyAssigned || nameChanged) {
                changed = true;
                return { ...g, teacherId, coach: coachName };
            }
        } else if (isCurrentlyAssigned) {
            changed = true;
            return { ...g, teacherId: '', coach: '' };
        }
        return g;
    });
    
    if (changed) {
        saveGroups(updated);
    }
}
