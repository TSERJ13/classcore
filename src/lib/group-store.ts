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
    secondaryTeacherId?: string; // Optional second teacher
    secondaryTeacherName?: string; // Optional assistant coach name
    primaryTeacherPercentage?: number; // Override teacher global % for this group
    secondaryTeacherPercentage?: number; // Specific % for secondary teacher
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

import { getScopedKey, getActiveSlug, markLocalUpdate, recordGlobalDeletion } from './utils';
import { loadSettings, saveSettings } from './settings-store';
import { triggerInstantSync } from './sync-store';
import { deleteRecordFromCloud, syncRecordToCloud } from './master-sync';

const BASE_GROUPS_KEY = 'cc_groups';
const BASE_DELETED_GROUPS_KEY = 'cc_deleted_groups';
function getGroupsKey() { return getScopedKey(BASE_GROUPS_KEY); }
function getDeletedGroupsKey() { return getScopedKey(BASE_DELETED_GROUPS_KEY); }

const INITIAL_GROUPS: Group[] = [];

// 🚀 MEMORY CACHE: Fallback when localStorage is full
let _groupsMemoryCache: Group[] | null = null;
let _groupsMemoryCacheSlug: string | null = null;

export function setGroupsMemoryCache(groups: Group[], slug: string) {
    _groupsMemoryCache = groups;
    _groupsMemoryCacheSlug = slug;
    console.log(`💾 [GroupStore] Memory cache set: ${groups.length} groups`);
}

export function getGroups(): Group[] {
    if (typeof window === 'undefined') return INITIAL_GROUPS;
    try {
        const activeSlug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : 'demo.classcore.ge';
        const activeBranch = typeof window !== 'undefined' ? (localStorage.getItem(`cc_active_branch_${activeSlug}`) || 'main') : 'main';
        const isMainBranch = activeBranch === 'main';

        const key = getGroupsKey();
        let saved = localStorage.getItem(key);

        // 🚀 Fall back to memory cache
        if (!saved && _groupsMemoryCache && _groupsMemoryCacheSlug === activeSlug) {
            console.log('💾 [GroupStore] Using memory cache');
            return _groupsMemoryCache;
        }

        // Migration: If new scoped key is empty, check old unscoped key
        if (!saved && isMainBranch) {
            const oldKey = `cc_groups_${activeSlug}`;
            const oldKeyMain = `cc_groups_${activeSlug}_main`;
            saved = localStorage.getItem(oldKey) || localStorage.getItem(oldKeyMain);
            
            if (saved) {
                console.log('🚚 [GroupStore] Migrating legacy main branch data');
                localStorage.setItem(key, saved);
            }
        }

        const deletedKey = getDeletedGroupsKey();
        let deletedIds = new Set<string>();
        try {
            const rawDeleted = localStorage.getItem(deletedKey);
            if (rawDeleted) {
                const parsed = JSON.parse(rawDeleted);
                if (Array.isArray(parsed)) deletedIds = new Set(parsed);
            }
        } catch {}

        if (!saved) {
            const data = isMainBranch ? INITIAL_GROUPS : [];
            if (isMainBranch) localStorage.setItem(key, JSON.stringify(data));
            return data;
        }
        let parsed = [];
        try {
            parsed = JSON.parse(saved);
        } catch (e) {
            console.error('❌ [GroupStore] Corrupt groups data:', e);
            return isMainBranch ? INITIAL_GROUPS : [];
        }
        const list = Array.isArray(parsed) ? (parsed as Group[]) : INITIAL_GROUPS;
        return list.filter(g => !deletedIds.has(g.id));
    } catch {
        return INITIAL_GROUPS;
    }
}

export function saveGroups(groups: Group[]): void {
    if (typeof window === 'undefined') return;
    const key = getGroupsKey();
    console.log(`💾 [GroupStore] Saving groups to: ${key}`, { count: groups.length });
    localStorage.setItem(key, JSON.stringify(groups));
    markLocalUpdate();
    
    // 🔥 NEW ATOMIC SYNC: Push all groups to the native table
    const activeSlug = getActiveSlug() || '';
    const settings = loadSettings(activeSlug);
    if (settings.orgId && settings.orgId !== 'demo') {
        // 1. Native table sync
        groups.forEach(g => {
            syncRecordToCloud('groups', {
                id: g.id,
                org_id: settings.orgId,
                name: g.name,
                data: g
            }, settings.orgId).catch(() => {});
        });

        // 2. 🔥 FOOLPROOF SCHEMA-LESS FALLBACK: Update the settings blob too
        const updatedSettings = { ...settings, groups: groups };
        import('./settings-store').then(({ saveSettings }) => {
            saveSettings({ groups: groups } as any, settings, activeSlug);
            import('./master-sync').then(({ pushFullStudioMetadata }) => {
                const studioName = settings.studioName || 'Studio';
                pushFullStudioMetadata(activeSlug, studioName, updatedSettings);
            });
        });
    }

    triggerInstantSync();

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
        const isCurrentlyPrimary = g.teacherId === teacherId;
        const isCurrentlySecondary = g.secondaryTeacherId === teacherId;
        const nameChangedPrimary = isCurrentlyPrimary && g.coach !== coachName;
        const nameChangedSecondary = isCurrentlySecondary && g.secondaryTeacherName !== coachName;

        if (shouldBeAssigned) {
            // If it should be assigned but isn't assigned as primary or secondary, add as primary if empty
            if (!isCurrentlyPrimary && !isCurrentlySecondary) {
                changed = true;
                if (!g.teacherId) return { ...g, teacherId, coach: coachName };
                if (!g.secondaryTeacherId) return { ...g, secondaryTeacherId: teacherId, secondaryTeacherName: coachName };
            }
            if (nameChangedPrimary || nameChangedSecondary) {
                changed = true;
                return { 
                    ...g, 
                    coach: isCurrentlyPrimary ? coachName : g.coach,
                    secondaryTeacherName: isCurrentlySecondary ? coachName : g.secondaryTeacherName
                };
            }
        } else {
            // If it shouldn't be assigned but is, remove it
            if (isCurrentlyPrimary) {
                changed = true;
                return { ...g, teacherId: '', coach: '' };
            }
            if (isCurrentlySecondary) {
                changed = true;
                return { ...g, secondaryTeacherId: '', secondaryTeacherName: '' };
            }
        }
        return g;
    });
    
    if (changed) {
        saveGroups(updated);
    }
}

export function deleteGroup(id: string): void {
    const groups = getGroups();
    const updated = groups.filter(g => g.id !== id);
    
    const slug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : null;
    const activeSlug = getActiveSlug();
    const settings = loadSettings(activeSlug || '');
    const orgId = settings.orgId || localStorage.getItem(`cc_org_id_${activeSlug}`);

    if (orgId && orgId !== 'demo') {
        // 1. Native table delete
        deleteRecordFromCloud('groups', id, orgId).catch(() => {});

        // 2. Backup blob update
        const updatedSettings = { ...settings, groups: updated };
        saveSettings({ groups: updated } as any, settings, activeSlug || '');
        
        const studioName = (settings as any).studioName || 'Studio';
        pushFullStudioMetadata(activeSlug || '', studioName, updatedSettings);
    }

    if (slug) {
        recordGlobalDeletion(slug, 'cc_groups', id);
    }

    const key = getGroupsKey();
    localStorage.setItem(key, JSON.stringify(updated));
    markLocalUpdate();

    // CLEANUP STAFF: Remove deleted group ID from all staff mappings
    if (slug) {
        const studioSettings = loadSettings(slug);
        if (studioSettings && studioSettings.staff) {
            let staffChanged = false;
            const updatedStaff = studioSettings.staff.map((member: any) => {
                const assigned = member.assigned_group_ids || [];
                if (assigned.includes(id)) {
                    staffChanged = true;
                    return {
                        ...member,
                        assigned_group_ids: assigned.filter((gid: string) => gid !== id)
                    };
                }
                return member;
            });

            if (staffChanged) {
                console.log(`🧹 [GroupStore] Cleaned up deleted group ${id} from staff assignments`);
                const fullSettings = { ...studioSettings, staff: updatedStaff };
                saveSettings(fullSettings, studioSettings, slug);
            }
        }
    }

    triggerInstantSync();

    // CLEANUP CALENDAR: Remove all recurring events for this group
    import('./event-store').then(mod => {
        mod.deleteGroupEvents(id);
    });

    window.dispatchEvent(new Event('cc_groups_update'));
}
