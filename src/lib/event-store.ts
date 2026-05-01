/**
 * event-store.ts
 * Persists calendar events to localStorage.
 */
import type { CalendarEvent, EventType } from '@/types';
import { pushStudioStateToCloud } from './sync-store';
import { getScopedKey, getActiveSlug, getLocalISODate, markLocalUpdate } from './utils';

const BASE_EVENTS_KEY = 'cc_calendar_events';
function getEventsKey() { return getScopedKey(BASE_EVENTS_KEY); }

function toDateStr(d: Date) {
    return getLocalISODate(d);
}

const TODAY = new Date();

function makeEvent(id: string, title: string, type: EventType, hallId: string, teacherId: string, dayOffset: number, start: string, end: string, recurring: 'none' | 'weekly' = 'none', groupId?: string): CalendarEvent {
    const d = new Date(TODAY);
    d.setDate(TODAY.getDate() + dayOffset);
    return { id, org_id: getActiveSlug() || '', title, type, hall_id: hallId, teacher_id: teacherId, group_id: groupId, date: toDateStr(d), start_time: start, end_time: end, color: '#6366f1', recurring, reminder_30m: false, created_at: '' };
}

const SEED_WEEK: CalendarEvent[] = [];

export function getEvents(): CalendarEvent[] {
    if (typeof window === 'undefined') return SEED_WEEK;
    try {
        const activeSlug = getActiveSlug() || 'demo.classcore.ge';
        const activeBranch = typeof window !== 'undefined' ? (localStorage.getItem(`cc_active_branch_${activeSlug}`) || 'main') : 'main';
        const isMainBranch = activeBranch === 'main';

        const key = getEventsKey();
        let saved = localStorage.getItem(key);

        // Migration: If new scoped key is empty, check old unscoped key
        if (!saved && isMainBranch) {
            const oldKey = `cc_calendar_events_${activeSlug}`;
            const oldKeyMain = `cc_calendar_events_${activeSlug}_main`;
            saved = localStorage.getItem(oldKey) || localStorage.getItem(oldKeyMain);
            
            if (saved) {
                console.log('🚚 [EventStore] Migrating legacy main branch data');
                localStorage.setItem(key, saved);
            }
        }

        if (!saved) return isMainBranch ? SEED_WEEK : [];
        let events = [];
        try {
            events = JSON.parse(saved) || [];
        } catch (e) {
            console.error('❌ [EventStore] Corrupt events data:', e);
            return isMainBranch ? SEED_WEEK : [];
        }
        if (!Array.isArray(events)) events = [];

        // Migration: Map old 'eX' IDs to new 'clsX' IDs if they still exist in localStorage
        // Migration: Map hardcoded 'demo' org_id to the actual scoped studio slug
        let migrated = false;
        events = events.map((e: CalendarEvent) => {
            let changed = false;
            let newE = { ...e };

            if (newE.id.startsWith('e') && !isNaN(Number(newE.id.slice(1)))) {
                newE.id = `cls${newE.id.slice(1)}`;
                changed = true;
            }

            if (newE.org_id === 'demo' && activeSlug !== 'demo') {
                newE.org_id = activeSlug;
                changed = true;
            }

            if (changed) migrated = true;
            return newE;
        });

        if (migrated) {
            saveEvents(events);
        }

        // 4. AUTO-PURGE ORPHANS: 
        // If an event belongs to a group that is in the deletion tombstone, purge it now.
        const deletedGroupsKey = `cc_deleted_groups_${activeSlug}`;
        const rawDeleted = localStorage.getItem(deletedGroupsKey);
        const deletedGroupIds = rawDeleted ? JSON.parse(rawDeleted) : [];
        const deletedSet = new Set(Array.isArray(deletedGroupIds) ? deletedGroupIds : []);

        if (deletedSet.size > 0) {
            const initialCount = events.length;
            const healthyEvents = events.filter((e: CalendarEvent) => !e.group_id || !deletedSet.has(e.group_id));
            if (healthyEvents.length < initialCount) {
                console.log(`🧹 [EventStore] Auto-purged ${initialCount - healthyEvents.length} orphaned events from deleted groups`);
                saveEvents(healthyEvents);
                return healthyEvents;
            }
        }

        return events;
    } catch {
        return SEED_WEEK;
    }
}

export function saveEvents(events: CalendarEvent[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getEventsKey(), JSON.stringify(events));
    markLocalUpdate();
    
    const activeSlug = getActiveSlug();
    if (activeSlug && activeSlug !== 'demo.classcore.ge') {
        // 1. Sync to settings blob (Legacy/Backup)
        pushStudioStateToCloud(activeSlug, [], { [getEventsKey()]: events });

        // 2. Sync to dedicated Calendar Table (High Reliability for Hydration)
        const orgId = localStorage.getItem(`cc_org_id_override_${activeSlug}`) || 
                     (JSON.parse(localStorage.getItem(`cc_studio_settings_${activeSlug}`) || '{}')).orgId;
        
        if (orgId) {
            import('./master-sync').then(mod => {
                mod.pushCollectionToCloud('calendar_events', events, orgId);
            });
        }
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_calendar_events_update'));
}

export function addEvent(ev: CalendarEvent) {
    const events = getEvents();
    const updated = [...events, ev];
    saveEvents(updated);
    return updated;
}

export function deleteEvent(id: string) {
    const events = getEvents();
    const updated = events.filter(e => e.id !== id);
    saveEvents(updated);
    return updated;
}

export function getTodayEvents() {
    const todayStr = toDateStr(new Date());
    return getEventsByDate(todayStr);
}

export function getEventsByDate(dateStr: string) {
    const targetDate = new Date(`${dateStr}T00:00:00`);
    const targetDay = targetDate.getDay();
    const targetTime = targetDate.getTime();

    return getEvents().filter(e => {
        // Direct match
        if (e.date === dateStr) return true;

        // Recurring Weekly Match
        if (e.recurring === 'weekly') {
            const evDate = new Date(`${e.date}T00:00:00`);
            // Must be same day of week, and the target date must be ON or AFTER the original event date
            if (evDate.getDay() === targetDay && targetTime >= evDate.getTime()) {
                return true;
            }
        }

        return false;
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function updateEvent(id: string, updates: Partial<CalendarEvent>) {
    const events = getEvents();
    const idx = events.findIndex(e => e.id === id);
    if (idx > -1) {
        events[idx] = { ...events[idx], ...updates };
        saveEvents(events);
    }
    return events;
}

/** Remove all recurring weekly events that belong to a specific group */
export function deleteGroupEvents(groupId: string) {
    const events = getEvents().filter(e => !(e.group_id === groupId && e.recurring === 'weekly'));
    saveEvents(events);
    return events;
}

/** Upsert recurring weekly events for a group based on schedule slots */
export function syncGroupScheduleToCalendar(groupId: string, groupTitle: string, teacherId: string, hallId: string, slots: { dayOfWeek: number; startTime: string; endTime: string }[], color?: string, secondaryTeacherId?: string) {
    // Remove old recurring events for this group
    const cleaned = getEvents().filter(e => !(e.group_id === groupId && e.recurring === 'weekly'));

    // Find the most recent Monday as anchor
    const today = new Date();

    // Add new events: one per slot, anchored to the next occurrence of that weekday
    const newEvents: CalendarEvent[] = slots.map((slot, i) => {
        // Find the date of the next occurrence of slot.dayOfWeek starting from this week's Monday
        const monday = new Date(today);
        const day = today.getDay(); // 0=Sun
        const diffToMonday = day === 0 ? -6 : 1 - day;
        monday.setDate(today.getDate() + diffToMonday);

        // offset from Monday: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
        // dayOfWeek from our picker: 0=Mon, 1=Tue, ..., 6=Sun
        const targetDate = new Date(monday);
        targetDate.setDate(monday.getDate() + slot.dayOfWeek);

        const dateStr = getLocalISODate(targetDate);
        const id = `grp_${groupId}_slot${i}_${slot.dayOfWeek}`;

        return {
            id,
            org_id: getActiveSlug() || '',
            title: groupTitle,
            type: 'group_class' as const,
            hall_id: hallId || 'h1',
            teacher_id: teacherId || '',
            secondary_teacher_id: secondaryTeacherId || '',
            group_id: groupId,
            date: dateStr,
            start_time: slot.startTime,
            end_time: slot.endTime,
            color: color || '#6366f1',
            recurring: 'weekly' as const,
            reminder_30m: false,
            created_at: new Date().toISOString(),
        };
    });

    const updated = [...cleaned, ...newEvents];
    saveEvents(updated);
    return updated;
}

export function addIndividualLesson(studentId: string, title: string, teacherId: string, date: string, start: string, end: string, hallId = 'h1', orgId = ''): CalendarEvent {
    const events = getEvents();
    const newEvent: CalendarEvent = {
        id: `ind_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        org_id: orgId,
        title,
        type: 'individual' as const,
        hall_id: hallId,
        teacher_id: teacherId,
        student_id: studentId,
        date,
        start_time: start,
        end_time: end,
        color: '#10b981', // emerald for individual
        recurring: 'none' as const,
        reminder_30m: false,
        created_at: new Date().toISOString(),
    };

    const updated = [...events, newEvent];
    saveEvents(updated);
    return newEvent;
}
