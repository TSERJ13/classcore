import { createClient } from '@/lib/supabase/client';
import { getScopedKey } from './utils';
import type { RealtimeChannel } from '@supabase/supabase-js';

const STORAGE_KEY = 'cc_studio_settings';

/**
 * realtime-sync.ts
 * ---------------------------------------------------------------------------
 * LIVE cross-device synchronization via Supabase Realtime (websockets).
 *
 * Problem this solves:
 *   Previously, a check-in marked on Device A only reached Device B after a
 *   FULL page reload (hydration). There were zero realtime subscriptions in
 *   the app. This module subscribes to postgres_changes on the key tables,
 *   filtered by org_id, and patches the EXACT same localStorage keys + DOM
 *   events the UI already listens to. No UI rewrite required.
 *
 * Design notes:
 *   - We reuse the app's existing storage keys (cc_checkins_{date},
 *     cc_attendance_data) and existing DOM events (cc_attendance_update, ...),
 *     so every page that already reacts to local writes will also react to
 *     remote writes with no extra wiring.
 *   - Writes are idempotent (dedupe by row id), so receiving an echo of our
 *     own write is harmless.
 *   - One channel per org. Re-calling start() for the same org is a no-op.
 * ---------------------------------------------------------------------------
 */

let _channel: RealtimeChannel | null = null;
let _activeOrgId: string | null = null;
let _activeSlug: string | null = null;

interface CheckinRecord {
    id: string;
    studentId: string;
    studentName: string;
    date: string;
    time: string;
    via: 'nfc' | 'qr' | 'manual';
    sessionsRemaining: number;
    classId?: string;
    groupId?: string;
}

/** Build a CheckinRecord from an attendance row (prefers the full data blob). */
function rowToCheckin(row: any): CheckinRecord | null {
    if (!row) return null;
    // The writer stores the full record under `data`; fall back to columns.
    const d = (row.data && typeof row.data === 'object') ? row.data : {};
    const id = row.id || d.id;
    const studentId = row.student_id || d.studentId;
    const date = row.date || d.date;
    if (!id || !studentId || !date) return null;
    return {
        id,
        studentId,
        studentName: d.studentName || row.student_name || '',
        date,
        time: d.time || '',
        via: d.via || 'manual',
        sessionsRemaining: typeof d.sessionsRemaining === 'number' ? d.sessionsRemaining : -1,
        classId: d.classId || row.class_id || undefined,
        groupId: d.groupId || row.group_id || undefined,
    };
}

/** Insert a remote check-in into the per-day localStorage list the UI reads. */
function applyRemoteCheckin(rec: CheckinRecord) {
    if (typeof window === 'undefined') return;
    const key = getScopedKey(`cc_checkins_${rec.date}`, _activeSlug || undefined);
    let list: CheckinRecord[] = [];
    try {
        const raw = localStorage.getItem(key);
        list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) list = [];
    } catch { list = []; }

    // Dedupe by id (idempotent — safe to receive our own echo)
    if (!list.some(r => r.id === rec.id)) {
        list.push(rec);
        try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* quota */ }
    }

    // Keep the all-time grouped store consistent too
    syncGroupedStore(rec, 'add');
}

/** Remove a remotely-deleted check-in from the per-day list. */
function removeRemoteCheckin(row: any) {
    if (typeof window === 'undefined') return;
    const id = row?.id;
    if (!id) return;
    const date = row?.date || (row?.data && row.data.date);
    const studentId = row?.student_id || (row?.data && row.data.studentId);

    const removeFromKey = (key: string) => {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return;
            const list = JSON.parse(raw);
            if (!Array.isArray(list)) return;
            const next = list.filter((r: CheckinRecord) => r.id !== id);
            if (next.length !== list.length) localStorage.setItem(key, JSON.stringify(next));
        } catch { /* ignore */ }
    };

    if (date) {
        // Fast path: we know the exact day key.
        removeFromKey(getScopedKey(`cc_checkins_${date}`, _activeSlug || undefined));
    } else {
        // Fallback: Postgres DELETE with default REPLICA IDENTITY only sends the
        // primary key, so we don't get the date. Scan all check-in day keys.
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.includes('cc_checkins_')) removeFromKey(k);
        }
    }

    if (studentId) syncGroupedStore({ id, studentId } as any, 'remove');
}

/** Mirror change into cc_attendance_data (grouped by student_id, all-time). */
function syncGroupedStore(rec: { id: string; studentId: string } & Partial<CheckinRecord>, op: 'add' | 'remove') {
    if (typeof window === 'undefined') return;
    const key = getScopedKey('cc_attendance_data', _activeSlug || undefined);
    let grouped: Record<string, any[]> = {};
    try {
        const raw = localStorage.getItem(key);
        grouped = raw ? JSON.parse(raw) : {};
        if (typeof grouped !== 'object' || grouped === null) grouped = {};
    } catch { grouped = {}; }

    const bucket = grouped[rec.studentId] || [];
    if (op === 'add') {
        if (!bucket.some((a: any) => a.id === rec.id)) bucket.push(rec);
    } else {
        grouped[rec.studentId] = bucket.filter((a: any) => a.id !== rec.id);
        try { localStorage.setItem(key, JSON.stringify(grouped)); } catch { /* quota */ }
        return;
    }
    grouped[rec.studentId] = bucket;
    try { localStorage.setItem(key, JSON.stringify(grouped)); } catch { /* quota */ }
}

/** Upsert a remotely created/updated plan into localStorage on Device B */
function applyRemotePlanUpsert(row: any) {
    if (typeof window === 'undefined') return;
    // Merge top-level columns with nested data blob (same unwrap pattern as StudioContext)
    const plan = (row.data && typeof row.data === 'object')
        ? { ...row.data, ...row, data: undefined }
        : row;
    if (!plan.id) return;

    try {
        const key = getScopedKey('cc_subscription_plans', _activeSlug || undefined);
        const raw = localStorage.getItem(key);
        let plans: any[] = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(plans)) plans = [];

        const idx = plans.findIndex((p: any) => p.id === plan.id);
        if (idx >= 0) {
            plans[idx] = { ...plans[idx], ...plan };
        } else {
            plans.push(plan);
        }
        try { localStorage.setItem(key, JSON.stringify(plans)); } catch { /* quota */ }
    } catch (e) {
        console.warn('⚠️ [Realtime] Failed to apply remote plan upsert:', e);
    }
}

/** Remove a remotely deleted plan from localStorage on Device B */
function applyRemotePlanDelete(id: string) {
    if (typeof window === 'undefined') return;
    if (!id) return;

    try {
        const key = getScopedKey('cc_subscription_plans', _activeSlug || undefined);
        const raw = localStorage.getItem(key);
        if (!raw) return;
        let plans: any[] = JSON.parse(raw);
        if (!Array.isArray(plans)) return;
        const next = plans.filter((p: any) => p.id !== id);
        if (next.length !== plans.length) {
            try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* quota */ }
        }
    } catch (e) {
        console.warn('⚠️ [Realtime] Failed to apply remote plan delete:', e);
    }
}

/** Remove a remotely-deleted subscription from localStorage on Device B */
function applyRemoteSubscriptionDelete(subId: string) {
    if (typeof window === 'undefined') return;
    try {
        const key = getScopedKey('cc_student_subscriptions', _activeSlug || undefined);
        const deletedKey = getScopedKey('cc_deleted_subscriptions', _activeSlug || undefined);

        // 1. Add to local deleted list to prevent resurrection
        let deletedList: string[] = [];
        try {
            const rawDel = localStorage.getItem(deletedKey);
            deletedList = rawDel ? JSON.parse(rawDel) : [];
            if (!Array.isArray(deletedList)) deletedList = [];
        } catch { deletedList = []; }

        if (!deletedList.includes(subId)) {
            deletedList.push(subId);
            localStorage.setItem(deletedKey, JSON.stringify(deletedList));
        }

        // 2. Remove from cc_student_subscriptions in localStorage
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return;

        let changed = false;
        for (const studentId of Object.keys(data)) {
            if (Array.isArray(data[studentId])) {
                const prevLen = data[studentId].length;
                data[studentId] = data[studentId].filter((s: any) => s.id !== subId);
                if (data[studentId].length !== prevLen) changed = true;
                if (data[studentId].length === 0) {
                    delete data[studentId];
                    changed = true;
                }
            }
        }

        if (changed) {
            localStorage.setItem(key, JSON.stringify(data));
        }
    } catch (e) {
        console.warn('⚠️ [Realtime] Failed to apply remote subscription deletion:', e);
    }
}

/** Upsert a remotely created/updated subscription into localStorage on Device B */
function applyRemoteSubscriptionUpsert(row: any) {
    if (typeof window === 'undefined') return;
    const sub = (row.data && typeof row.data === 'object') ? { ...row.data, id: row.id, student_id: row.student_id } : row;
    const studentId = sub.student_id || sub.studentId;
    if (!sub.id || !studentId) return;

    try {
        const key = getScopedKey('cc_student_subscriptions', _activeSlug || undefined);
        const raw = localStorage.getItem(key);
        let data: Record<string, any[]> = {};
        try {
            data = raw ? JSON.parse(raw) : {};
            if (!data || typeof data !== 'object') data = {};
        } catch { data = {}; }

        const list = data[studentId] || [];
        const idx = list.findIndex((s: any) => s.id === sub.id);
        if (idx >= 0) {
            list[idx] = { ...list[idx], ...sub };
        } else {
            list.push(sub);
        }
        data[studentId] = list;

        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('⚠️ [Realtime] Failed to apply remote subscription upsert:', e);
    }
}

/** Helper to upsert a row into a localStorage array key (supports branch-scoped keys like cc_groups, cc_halls, etc.) */
function applyRemoteArrayUpsert(baseKey: string, row: any) {
    if (typeof window === 'undefined') return;
    const item = (row.data && typeof row.data === 'object')
        ? { ...row.data, ...row, data: undefined }
        : row;
    if (!item.id) return;

    try {
        const branchId = item.branch_id || item.branchId || undefined;
        const key = getScopedKey(baseKey, _activeSlug || undefined, branchId);
        const raw = localStorage.getItem(key);
        let list: any[] = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) list = [];

        const idx = list.findIndex((x: any) => x.id === item.id);
        if (idx >= 0) {
            list[idx] = { ...list[idx], ...item };
        } else {
            list.push(item);
        }
        try { localStorage.setItem(key, JSON.stringify(list)); } catch {}
    } catch (e) {
        console.warn(`⚠️ [Realtime] Failed to apply remote upsert for ${baseKey}:`, e);
    }
}

/** Helper to delete a row from a localStorage array key */
function applyRemoteArrayDelete(baseKey: string, id: string, row?: any) {
    if (typeof window === 'undefined') return;
    if (!id) return;

    try {
        const branchId = row?.branch_id || row?.branchId || undefined;
        const key = getScopedKey(baseKey, _activeSlug || undefined, branchId);
        const raw = localStorage.getItem(key);
        if (!raw) return;
        let list: any[] = JSON.parse(raw);
        if (!Array.isArray(list)) return;
        const next = list.filter((x: any) => x.id !== id);
        if (next.length !== list.length) {
            try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
        }
    } catch (e) {
        console.warn(`⚠️ [Realtime] Failed to apply remote delete for ${baseKey}:`, e);
    }
}

/** Upsert a staff member into cc_studio_settings staff array on Device B */
function applyRemoteStaffUpsert(row: any) {
    if (typeof window === 'undefined') return;
    const item = (row.data && typeof row.data === 'object')
        ? { ...row.data, ...row, data: undefined }
        : row;
    if (!item.id) return;

    try {
        const slug = _activeSlug || (typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : null) || 'default';
        const key = getScopedKey(STORAGE_KEY, slug);
        const raw = localStorage.getItem(key);
        if (raw) {
            const settings = JSON.parse(raw);
            let staffList: any[] = Array.isArray(settings.staff) ? settings.staff : [];
            const idx = staffList.findIndex((s: any) => s.id === item.id);
            if (idx >= 0) {
                staffList[idx] = { ...staffList[idx], ...item };
            } else {
                staffList.push(item);
            }
            settings.staff = staffList;
            localStorage.setItem(key, JSON.stringify(settings));
        }
    } catch (e) {
        console.warn('⚠️ [Realtime] Failed to apply remote staff upsert:', e);
    }
}

/** Delete a staff member from cc_studio_settings staff array on Device B */
function applyRemoteStaffDelete(id: string) {
    if (typeof window === 'undefined' || !id) return;

    try {
        const slug = _activeSlug || (typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : null) || 'default';
        const key = getScopedKey(STORAGE_KEY, slug);
        const raw = localStorage.getItem(key);
        if (raw) {
            const settings = JSON.parse(raw);
            if (Array.isArray(settings.staff)) {
                settings.staff = settings.staff.filter((s: any) => s.id !== id);
                localStorage.setItem(key, JSON.stringify(settings));
            }
        }
    } catch (e) {
        console.warn('⚠️ [Realtime] Failed to apply remote staff delete:', e);
    }
}

/** Upsert a student into cc_student_data map on Device B */
function applyRemoteStudentUpsert(row: any) {
    if (typeof window === 'undefined') return;
    const s = (row.data && typeof row.data === 'object') ? { ...row.data, ...row, data: undefined } : row;
    if (!s.id) return;

    try {
        const key = getScopedKey('cc_student_data', _activeSlug || undefined);
        const raw = localStorage.getItem(key);
        let data: Record<string, any> = {};
        try {
            data = raw ? JSON.parse(raw) : {};
            if (!data || typeof data !== 'object') data = {};
        } catch { data = {}; }

        data[s.id] = { ...(data[s.id] || {}), ...s };
        try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
    } catch (e) {
        console.warn('⚠️ [Realtime] Failed to apply remote student upsert:', e);
    }
}

/** Delete a student from cc_student_data map on Device B */
function applyRemoteStudentDelete(id: string) {
    if (typeof window === 'undefined') return;
    if (!id) return;

    try {
        const key = getScopedKey('cc_student_data', _activeSlug || undefined);
        const raw = localStorage.getItem(key);
        if (!raw) return;
        let data: Record<string, any> = JSON.parse(raw);
        if (data && data[id]) {
            delete data[id];
            try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
        }
    } catch (e) {
        console.warn('⚠️ [Realtime] Failed to apply remote student delete:', e);
    }
}

function emit(...events: string[]) {
    if (typeof window === 'undefined') return;
    events.forEach(e => window.dispatchEvent(new Event(e)));
}

/**
 * Start the realtime bridge for a given org.
 * Safe to call repeatedly — it only re-subscribes when the org actually changes.
 */
export function startRealtimeSync(orgId: string | null | undefined, slug: string | null | undefined) {
    if (typeof window === 'undefined') return;
    if (!orgId || orgId === 'demo') return;

    // Already subscribed to this org → nothing to do.
    if (_channel && _activeOrgId === orgId) {
        _activeSlug = slug || _activeSlug;
        return;
    }

    // Org changed (or first run) → tear down old channel first.
    stopRealtimeSync();

    _activeOrgId = orgId;
    _activeSlug = slug || null;

    const supabase = createClient();
    const filter = `org_id=eq.${orgId}`;

    _channel = supabase
        .channel(`studio:${orgId}`)
        // ── Attendance: the headline live use-case ("+" on one device → instant on another)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance', filter }, (payload) => {
            const rec = rowToCheckin(payload.new);
            if (rec) {
                applyRemoteCheckin(rec);
                emit('cc_attendance_update', 'cc_checkin_update');
            }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'attendance', filter }, (payload) => {
            removeRemoteCheckin(payload.old);
            emit('cc_attendance_update', 'cc_checkin_update');
        })
        // ── Subscriptions: live real-time sync for deletions, creations & edits across devices
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'subscriptions', filter }, (payload) => {
            if (payload.old?.id) {
                applyRemoteSubscriptionDelete(payload.old.id);
            }
            emit('cc_subscription_update');
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'subscriptions', filter }, (payload) => {
            if (payload.new) {
                applyRemoteSubscriptionUpsert(payload.new);
            }
            emit('cc_subscription_update');
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'subscriptions', filter }, (payload) => {
            if (payload.new) {
                applyRemoteSubscriptionUpsert(payload.new);
            }
            emit('cc_subscription_update');
        })
        // ── Students: roster edits from another device
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'students', filter }, (payload) => {
            if (payload.new) applyRemoteStudentUpsert(payload.new);
            emit('cc_student_update');
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'students', filter }, (payload) => {
            if (payload.new) applyRemoteStudentUpsert(payload.new);
            emit('cc_student_update');
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'students', filter }, (payload) => {
            if (payload.old?.id) applyRemoteStudentDelete(payload.old.id);
            emit('cc_student_update');
        })
        // ── Groups: group edits across devices
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'groups', filter }, (payload) => {
            if (payload.new) applyRemoteArrayUpsert('cc_groups', payload.new);
            emit('cc_groups_update');
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups', filter }, (payload) => {
            if (payload.new) applyRemoteArrayUpsert('cc_groups', payload.new);
            emit('cc_groups_update');
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'groups', filter }, (payload) => {
            if (payload.old?.id) applyRemoteArrayDelete('cc_groups', payload.old.id);
            emit('cc_groups_update');
        })
        // ── Halls: hall edits across devices
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'halls', filter }, (payload) => {
            if (payload.new) applyRemoteArrayUpsert('cc_halls', payload.new);
            emit('cc_halls_update');
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'halls', filter }, (payload) => {
            if (payload.new) applyRemoteArrayUpsert('cc_halls', payload.new);
            emit('cc_halls_update');
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'halls', filter }, (payload) => {
            if (payload.old?.id) applyRemoteArrayDelete('cc_halls', payload.old.id);
            emit('cc_halls_update');
        })
        // ── Calendar Events: schedule edits across devices
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calendar_events', filter }, (payload) => {
            if (payload.new) applyRemoteArrayUpsert('cc_calendar_events', payload.new);
            emit('cc_calendar_events_update');
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calendar_events', filter }, (payload) => {
            if (payload.new) applyRemoteArrayUpsert('cc_calendar_events', payload.new);
            emit('cc_calendar_events_update');
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'calendar_events', filter }, (payload) => {
            if (payload.old?.id) applyRemoteArrayDelete('cc_calendar_events', payload.old.id);
            emit('cc_calendar_events_update');
        })
        // ── Staff / Teachers: staff edits across devices
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff', filter }, (payload) => {
            if (payload.new) {
                applyRemoteStaffUpsert(payload.new);
                applyRemoteArrayUpsert('cc_teachers', payload.new);
            }
            emit('cc_teacher_update');
            emit('cc_settings_update');
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'staff', filter }, (payload) => {
            if (payload.new) {
                applyRemoteStaffUpsert(payload.new);
                applyRemoteArrayUpsert('cc_teachers', payload.new);
            }
            emit('cc_teacher_update');
            emit('cc_settings_update');
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'staff', filter }, (payload) => {
            if (payload.old?.id) {
                applyRemoteStaffDelete(payload.old.id);
                applyRemoteArrayDelete('cc_teachers', payload.old.id);
            }
            emit('cc_teacher_update');
            emit('cc_settings_update');
        })
        // ── Products: shop inventory edits across devices
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'products', filter }, (payload) => {
            if (payload.new) applyRemoteArrayUpsert('cc_shop_products', payload.new);
            emit('cc_sales_update');
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products', filter }, (payload) => {
            if (payload.new) applyRemoteArrayUpsert('cc_shop_products', payload.new);
            emit('cc_sales_update');
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'products', filter }, (payload) => {
            if (payload.old?.id) applyRemoteArrayDelete('cc_shop_products', payload.old.id);
            emit('cc_sales_update');
        })
        // ── Subscription Plans: tariff changes from another device (instant cross-device sync)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'subscription_plans', filter }, (payload) => {
            if (payload.new) {
                applyRemotePlanUpsert(payload.new);
            }
            emit('cc_subscription_plans_update');
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'subscription_plans', filter }, (payload) => {
            if (payload.new) {
                applyRemotePlanUpsert(payload.new);
            }
            emit('cc_subscription_plans_update');
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'subscription_plans', filter }, (payload) => {
            if (payload.old?.id) {
                applyRemotePlanDelete(payload.old.id);
            }
            emit('cc_subscription_plans_update');
        })
        // ── Trash: items moved to/from trash
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trash', filter }, () => {
            emit('cc_trash_update');
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`📡 [Realtime] LIVE for org ${orgId}`);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn(`📡 [Realtime] ${status} — will retry on next hydration`);
            }
        });
}

/** Tear down the active realtime channel (call on logout / slug change / unmount). */
export function stopRealtimeSync() {
    if (_channel) {
        try {
            const supabase = createClient();
            supabase.removeChannel(_channel);
        } catch { /* ignore */ }
        _channel = null;
    }
    _activeOrgId = null;
}

/** Whether the realtime bridge is currently live. */
export function isRealtimeActive(): boolean {
    return !!_channel;
}
