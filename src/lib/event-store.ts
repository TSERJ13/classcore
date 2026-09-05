/**
 * event-store.ts
 * Persists calendar events to localStorage.
 */
import type { CalendarEvent, EventType } from '@/types';
import { pushStudioStateToCloud } from './sync-store';
import { getScopedKey, getActiveSlug, getLocalISODate, markLocalUpdate, getEffectiveOrgId, getLocallyDeletedIds, addLocallyDeletedId } from './utils';

const BASE_EVENTS_KEY = 'cc_calendar_events';
function getEventsKey() { return getScopedKey(BASE_EVENTS_KEY); }

const BASE_DELETED_EVENTS_KEY = 'cc_deleted_calendar_events';
function getDeletedEventsKey() { return getScopedKey(BASE_DELETED_EVENTS_KEY); }

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

// 🚀 MEMORY CACHE: Fallback when localStorage is full
let _eventsMemoryCache: CalendarEvent[] | null = null;
let _eventsMemoryCacheSlug: string | null = null;

export function setEventsMemoryCache(events: CalendarEvent[], slug: string) {
    _eventsMemoryCache = events;
    _eventsMemoryCacheSlug = slug;
    console.log(`💾 [EventStore] Memory cache set: ${events.length} events`);
}

export function getEvents(): CalendarEvent[] {
    if (typeof window === 'undefined') return SEED_WEEK;
    try {
        const activeSlug = getActiveSlug() || 'demo.classcore.ge';
        const activeBranch = typeof window !== 'undefined' ? (localStorage.getItem(`cc_active_branch_${activeSlug}`) || 'main') : 'main';
        const isMainBranch = activeBranch === 'main';

        const key = getEventsKey();
        let saved = localStorage.getItem(key);
        
        // 🚀 Fall back to memory cache if localStorage empty
        if (!saved && _eventsMemoryCache && _eventsMemoryCacheSlug === activeSlug) {
            console.log('💾 [EventStore] Using memory cache');
            return _eventsMemoryCache;
        }

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
        events = events.map((e: any) => {
            let changed = false;
            let newE = { ...e };

            // 🚀 UNIVERSAL MERGE: If event has nested .data (from Supabase/cloud sync), merge it back
            if (newE.data && typeof newE.data === 'object') {
                newE = { ...newE.data, ...newE };
                delete newE.data;
                changed = true;
            }

            // If start_time or end_time are ISO timestamps (e.g. "2026-09-04T15:15:00Z"), extract HH:MM and date
            if (newE.start_time && typeof newE.start_time === 'string' && newE.start_time.includes('T')) {
                const parts = newE.start_time.split('T');
                if (!newE.date) newE.date = parts[0];
                newE.start_time = parts[1].slice(0, 5);
                changed = true;
            }
            if (newE.end_time && typeof newE.end_time === 'string' && newE.end_time.includes('T')) {
                newE.end_time = newE.end_time.split('T')[1].slice(0, 5);
                changed = true;
            }

            if (newE.id && typeof newE.id === 'string' && newE.id.startsWith('e') && !isNaN(Number(newE.id.slice(1)))) {
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

        // 4b. AUTO-DETACH DELETED HALLS: unlike a deleted group (whose
        // lessons are removed entirely), a deleted hall shouldn't take the
        // lesson down with it — only the room assignment is gone. This is a
        // belt-and-suspenders pass for hall-store.ts's clearHallFromEvents()
        // (which normally runs at delete time) in case that call raced a
        // page unload or ran while offline.
        // NOTE: uses getScopedKey('cc_deleted_halls') — the same call
        // hall-store.ts's getDeletedHallsKey() makes — rather than a manual
        // `cc_deleted_halls_${activeSlug}` string like the (currently
        // dead/no-op — see summary) group-orphan-purge above: getScopedKey
        // resolves to the org id, not the raw slug, so a hand-built key here
        // would silently never match what deleteHall() actually writes to.
        const deletedHallIds = getLocallyDeletedIds(getScopedKey('cc_deleted_halls'));
        if (deletedHallIds.size > 0) {
            const staleCount = events.filter((e: CalendarEvent) => e.hall_id && deletedHallIds.has(e.hall_id)).length;
            if (staleCount > 0) {
                const cleaned = events.map((e: CalendarEvent) => (e.hall_id && deletedHallIds.has(e.hall_id)) ? { ...e, hall_id: '' } : e);
                console.log(`🧹 [EventStore] Cleared hall_id on ${staleCount} event(s) referencing a deleted hall`);
                saveEvents(cleaned);
                return cleaned;
            }
        }

        // 5. Never resurrect events the user just deleted: a background
        // hydration pass (StudioContext) can merge in a slightly-stale
        // cloud/backup snapshot that raced a delete. Filter those out here
        // too, the same way subscription-store.ts guards
        // `cc_deleted_subscriptions`.
        const deletedEventIds = getLocallyDeletedIds(getDeletedEventsKey());
        if (deletedEventIds.size > 0) {
            const filtered = events.filter((e: CalendarEvent) => !deletedEventIds.has(e.id));
            if (filtered.length !== events.length) return filtered;
        }

        return events;
    } catch {
        return SEED_WEEK;
    }
}

import { safeSetItem } from './utils';

export function saveEvents(events: CalendarEvent[]) {
    if (typeof window === 'undefined') return;
    const activeSlug = getActiveSlug() || 'default';
    
    safeSetItem(getEventsKey(), JSON.stringify(events), activeSlug);
    markLocalUpdate();
    
    if (activeSlug && activeSlug !== 'demo.classcore.ge') {
        const finalOrgId = getEffectiveOrgId(activeSlug);
        console.log(`📡 [EventStore] Saving ${events.length} events for ${activeSlug} (Org: ${finalOrgId})`);
        pushStudioStateToCloud(activeSlug, [], { [getEventsKey()]: events });
        if (finalOrgId) {
            import('./master-sync').then(mod => {
                mod.pushCollectionToCloud('calendar_events', events, finalOrgId, activeSlug);
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
    addLocallyDeletedId(getDeletedEventsKey(), id);

    // saveEvents() only re-pushes the *surviving* events to the cloud — it
    // never told Supabase to remove the deleted row, so it stayed in
    // `calendar_events` and came back on the next hydration. Delete it for
    // real, the same way subscription-store.ts does.
    const activeSlug = getActiveSlug();
    if (activeSlug && activeSlug !== 'demo.classcore.ge') {
        const finalOrgId = getEffectiveOrgId(activeSlug);
        if (finalOrgId) {
            import('./master-sync').then(mod => {
                mod.deleteRecordFromCloud('calendar_events', id, finalOrgId).catch(() => {});
            });
        }
    }

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
        if (e.date === dateStr) return true;
        if (e.recurring === 'weekly') {
            const evDate = new Date(`${e.date}T00:00:00`);
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

/**
 * Detach a deleted hall from every event that referenced it — clears
 * `hall_id` rather than deleting the event, since removing a hall shouldn't
 * cascade-delete someone's booked lessons. Called by hall-store.ts's
 * deleteHall(); getEvents() also runs an equivalent pass on read as a
 * belt-and-suspenders fallback in case this call never ran (offline, page
 * unload) for a given event.
 */
export function clearHallFromEvents(hallId: string) {
    if (!hallId) return getEvents();
    const before = getEvents();
    const affected = before.filter(e => e.hall_id === hallId).length;
    if (affected === 0) return before;
    const events = before.map(e => e.hall_id === hallId ? { ...e, hall_id: '' } : e);
    saveEvents(events);
    console.log(`🧹 [EventStore] Detached deleted hall ${hallId} from ${affected} event(s)`);
    return events;
}

/**
 * Remove the FUTURE individual-lesson events generated for a subscription
 * (matched by the exact `student_id` string the events were generated with
 * — comma-joined for a pair, see generateScheduledIndividualEvents) once
 * that subscription is deleted/cancelled. Past dates are left untouched so
 * attendance history isn't erased — only upcoming "ghost" lessons that no
 * longer have a subscription behind them are cleared out.
 */
export function deleteIndividualLessonEvents(studentId: string, fromDate?: string) {
    if (!studentId) return getEvents();
    const cutoff = fromDate || getLocalISODate();
    const before = getEvents();
    const isMatch = (e: CalendarEvent) => e.type === 'individual' && e.student_id === studentId && e.date >= cutoff;
    const removed = before.filter(isMatch);
    if (removed.length === 0) return before;
    const events = before.filter(e => !isMatch(e));
    saveEvents(events);

    const deletedKey = getDeletedEventsKey();
    removed.forEach(e => addLocallyDeletedId(deletedKey, e.id));

    // Same resurrection issue as deleteEvent()/deleteGroupEvents(): removing
    // rows from the local list and re-pushing only the survivors never
    // deletes the old rows in Supabase — do that explicitly.
    const activeSlug = getActiveSlug();
    if (activeSlug && activeSlug !== 'demo.classcore.ge') {
        const finalOrgId = getEffectiveOrgId(activeSlug);
        if (finalOrgId) {
            import('./master-sync').then(mod => {
                removed.forEach(e => mod.deleteRecordFromCloud('calendar_events', e.id, finalOrgId).catch(() => {}));
            });
        }
    }

    console.log(`🧹 [EventStore] Removed ${removed.length} future individual-lesson event(s) for student_id=${studentId}`);
    return events;
}

/** Remove all recurring weekly events that belong to a specific group */
export function deleteGroupEvents(groupId: string) {
    const before = getEvents();
    const removed = before.filter(e => e.group_id === groupId && e.recurring === 'weekly');
    const events = before.filter(e => !(e.group_id === groupId && e.recurring === 'weekly'));
    saveEvents(events);
    if (removed.length > 0) {
        const deletedKey = getDeletedEventsKey();
        removed.forEach(e => addLocallyDeletedId(deletedKey, e.id));
    }

    // Same resurrection issue as deleteEvent(): removing rows from the
    // local list and re-pushing only the survivors never deletes the old
    // rows in Supabase.
    if (removed.length > 0) {
        const activeSlug = getActiveSlug();
        if (activeSlug && activeSlug !== 'demo.classcore.ge') {
            const finalOrgId = getEffectiveOrgId(activeSlug);
            if (finalOrgId) {
                import('./master-sync').then(mod => {
                    removed.forEach(e => mod.deleteRecordFromCloud('calendar_events', e.id, finalOrgId).catch(() => {}));
                });
            }
        }
    }

    return events;
}

/** Upsert recurring weekly events for a group based on schedule slots */
export function syncGroupScheduleToCalendar(groupId: string, groupTitle: string, teacherId: string, hallId: string, slots: { dayOfWeek: number; startTime: string; endTime: string }[], color?: string, secondaryTeacherId?: string) {
    const cleaned = getEvents().filter(e => !(e.group_id === groupId && e.recurring === 'weekly'));
    let finalHallId = hallId;
    if (!finalHallId || finalHallId === 'h1') {
        try {
            if (typeof window !== 'undefined') {
                const slug = localStorage.getItem('cc_active_studio_slug');
                if (slug) {
                    const hallsRaw = localStorage.getItem(`cc_halls_${slug}`);
                    if (hallsRaw) {
                        const halls = JSON.parse(hallsRaw);
                        if (Array.isArray(halls) && halls.length > 0) {
                            finalHallId = halls[0].id;
                        }
                    }
                }
            }
        } catch {}
        if (!finalHallId) finalHallId = 'h1';
    }

    const today = new Date();
    const newEvents: CalendarEvent[] = slots.map((slot, i) => {
        const monday = new Date(today);
        const day = today.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        monday.setDate(today.getDate() + diffToMonday);
        const targetDate = new Date(monday);
        targetDate.setDate(monday.getDate() + slot.dayOfWeek);
        const dateStr = getLocalISODate(targetDate);
        const id = `grp_${groupId}_slot${i}_${slot.dayOfWeek}`;
        return {
            id,
            org_id: getActiveSlug() || '',
            title: groupTitle,
            type: 'group_class' as const,
            hall_id: finalHallId,
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

export function addIndividualLesson(studentId: string, title: string, teacherId: string, date: string, start: string, end: string, hallId = 'h1', orgId = '', color = '#10b981'): CalendarEvent {
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
        color,
        recurring: 'none' as const,
        reminder_30m: false,
        created_at: new Date().toISOString(),
    };
    const updated = [...events, newEvent];
    saveEvents(updated);
    return newEvent;
}

/**
 * 🚀 AUTO-GENERATE INDIVIDUAL EVENTS
 */
export function generateScheduledIndividualEvents(params: {
    studentId: string;
    studentName: string;
    planName: string;
    teacherId: string;
    startDate: string;
    endDate: string;
    sessionsTotal: number | null;
    schedule: { day: number; time: string; hallId: string }[];
    color?: string;
}) {
    if (!params.schedule || params.schedule.length === 0) return [];
    const events: CalendarEvent[] = [];
    const maxSessions = params.sessionsTotal || 100;
    const end = new Date(params.endDate);
    let current = new Date(params.startDate);
    let count = 0;
    const oneYearLater = new Date(current);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    const stopDate = end < oneYearLater ? end : oneYearLater;

    while (current <= stopDate && count < maxSessions) {
        const dayOfWeek = current.getDay();
        const slot = params.schedule.find(s => s.day === dayOfWeek);
        if (slot) {
            const dateStr = getLocalISODate(current);
            const startTime = slot.time;
            let endTime = (slot as any).endTime || '19:00';
            
            if (!(slot as any).endTime) {
                try {
                    const [h, m] = startTime.split(':').map(Number);
                    const endH = ((h + 1) % 24).toString().padStart(2, '0');
                    endTime = `${endH}:${m.toString().padStart(2, '0')}`;
                } catch {}
            }

            // Extract first names only (e.g. "Makar Ivanov & Elene Petrova" -> "Makar & Elene")
            const displayNames = params.studentName.split('&').map(name => name.trim().split(' ')[0]).join(' & ');

            events.push({
                id: `ind_${Date.now()}_${count}_${Math.random().toString(36).substr(2, 4)}`,
                org_id: getActiveSlug() || '',
                title: `${displayNames} (${params.planName})`,
                type: 'individual',
                hall_id: slot.hallId || 'h1',
                teacher_id: params.teacherId,
                student_id: params.studentId,
                date: dateStr,
                start_time: startTime,
                end_time: endTime,
                color: params.color || '#6d28d9',
                recurring: 'none',
                reminder_30m: false,
                created_at: new Date().toISOString()
            });
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    if (events.length > 0) {
        const allEvents = getEvents();
        console.log(`📅 [Calendar] Saving ${events.length} new individual events.`);
        saveEvents([...allEvents, ...events]);
    }
    return events;
}
