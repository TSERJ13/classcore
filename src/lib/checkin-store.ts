import { incrementSessionsUsed, getSubscription, refundSessionsUsed } from './subscription-store';
import { pushStudioStateToCloud } from './sync-store';
import { getScopedKey, markLocalUpdate } from './utils';
import { getStaffSession, getActiveSlug, loadSettings } from './settings-store';
import { recordAuditAction } from './audit-store';
import { syncRecordToCloud } from './master-sync';
/**
 * checkin-store.ts
 * localStorage-based store for attendance records.
 * Relies on subscription-store.ts for session counting.
 */

export interface CheckinRecord {
    id: string; // Atomic record ID
    studentId: string;
    studentName: string;
    date: string;        // YYYY-MM-DD
    time: string;        // HH:MM
    via: 'nfc' | 'qr' | 'manual';
    sessionsRemaining: number;
    classId?: string;
    groupId?: string;
}

function today(): string {
    return new Date().toISOString().split('T')[0];
}

function nowTime(): string {
    return new Date().toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' });
}

// ─── Sessions (Delegated to subscription-store) ──────────────────────────────

export function getSessionsRemaining(studentId: string, groupId?: string, planType?: 'group' | 'individual' | 'rental'): number {
    const sub = getSubscription(studentId, groupId, planType);
    if (!sub) return 0;
    if (sub.type === 'monthly') {
        const now = new Date();
        const expiry = new Date(sub.expires_at);
        if (expiry < now) return 0;
        return 30; // Mock 
    }
    if (sub.sessions_total === null) return 0;
    return Math.max(0, sub.sessions_total - sub.sessions_used);
}

// ─── Daily Checkins ───────────────────────────────────────────────────────────

const BASE_CHECKINS_PREFIX = 'cc_checkins_';

function dayKey(date?: string) {
    const base = `${BASE_CHECKINS_PREFIX}${date ?? today()}`;
    return getScopedKey(base);
}

export function getTodayCheckins(): CheckinRecord[] {
    if (typeof window === 'undefined') return [];
    try {
        const key = dayKey();
        let saved = localStorage.getItem(key);

        const parsed = JSON.parse(saved ?? '[]');
        return Array.isArray(parsed) ? parsed : [] as CheckinRecord[];
    } catch {
        return [];
    }
}

export function hasCheckinToday(studentId: string): boolean {
    return getTodayCheckins().some(r => r.studentId === studentId);
}

/** How many times the student has checked in today (0, 1, 2, ...) */
export function getCheckinCountToday(studentId: string): number {
    return getTodayCheckins().filter(r => r.studentId === studentId).length;
}

// ─── Main action ─────────────────────────────────────────────────────────────

export interface CheckinResult {
    success: boolean;
    alreadyCheckedIn: boolean;
    sessionsRemaining: number;
    record?: CheckinRecord;
}

/** Standard check-in: blocks if already checked in today */
export function recordCheckin(
    studentId: string,
    studentName: string,
    via: 'nfc' | 'qr' | 'manual',
    classId?: string,
    groupId?: string,
    subId?: string,
    customDate?: string
): CheckinResult {
    return _writeCheckin(studentId, studentName, via, classId, groupId, subId, customDate);
}

/**
 * Force check-in: always records, even if already checked in today.
 * Used for confirmed double check-in (e.g. two classes same day).
 */
export function forceCheckin(
    studentId: string,
    studentName: string,
    via: 'nfc' | 'qr' | 'manual',
    classId?: string,
    groupId?: string,
    subId?: string,
    customDate?: string
): CheckinResult {
    return _writeCheckin(studentId, studentName, via, classId, groupId, subId, customDate);
}

/** Refund a checkin: increments sessions back */
export function refundCheckin(studentId: string, customDate?: string): void {
    const activeSlug = getActiveSlug();
    const targetDate = customDate || today();
    let rToDeleteId: string | undefined;

    // 1. Try to find and remove in local day queue
    const key = getScopedKey(`cc_checkins_${targetDate}`);
    const existing: CheckinRecord[] = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = existing.findLastIndex(r => r.studentId === studentId);
    if (idx > -1) {
        rToDeleteId = existing[idx].id;
        existing.splice(idx, 1);
        localStorage.setItem(key, JSON.stringify(existing));
        markLocalUpdate();
    }

    // 2. Try to find and remove in cloud global data
    let cloudFound = false;
    try {
        const attDataKey = getScopedKey('cc_attendance_data', activeSlug);
        const attData = JSON.parse(localStorage.getItem(attDataKey) || '{}');
        if (attData[studentId]) {
            const recordIdx = attData[studentId].findIndex((r: any) => r.date === targetDate);
            if (recordIdx > -1) {
                if (!rToDeleteId) rToDeleteId = attData[studentId][recordIdx].id;
                cloudFound = true;
                attData[studentId].splice(recordIdx, 1);
                localStorage.setItem(attDataKey, JSON.stringify(attData));
            }
        }
    } catch (e) {}

    if (rToDeleteId || cloudFound || idx > -1) {
        // Delegate refund to subscription store
        refundSessionsUsed(studentId);

        const settings = loadSettings(activeSlug || '');
        const orgId = settings.orgId || localStorage.getItem(`cc_org_id_${activeSlug}`);
        
        if (orgId && orgId !== 'demo' && rToDeleteId) {
            import('./master-sync').then(({ deleteRecordFromCloud }) => {
                deleteRecordFromCloud('attendance', rToDeleteId!, orgId);
            });
        }

        if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_attendance_update'));
    }
}

function _writeCheckin(
    studentId: string,
    studentName: string,
    via: 'nfc' | 'qr' | 'manual',
    classId?: string,
    groupId?: string,
    subId?: string,
    customDate?: string
): CheckinResult {
    // Only deduct sessions if the student has an active subscription
    const subResult = incrementSessionsUsed(studentId, subId);
    const hasSubscription = subResult !== null;

    const next = hasSubscription ? getSessionsRemaining(studentId, groupId) : -1;
    const dateToUse = customDate || today();
    const checkinId = `att_${studentId}_${dateToUse}_${Date.now()}`;
    
    const record: CheckinRecord = {
        id: checkinId,
        studentId,
        studentName,
        date: dateToUse,
        time: nowTime(),
        via,
        sessionsRemaining: next,
        classId,
        groupId,
    };
    const existing = JSON.parse(localStorage.getItem(dayKey(dateToUse)) ?? '[]');
    const key = dayKey(dateToUse);
    const updated = [...existing, record];
    localStorage.setItem(key, JSON.stringify(updated));
    markLocalUpdate();
    
    // 🔥 NEW ATOMIC SYNC: Push this check-in to the native table
    const activeSlug = getActiveSlug();
    const settings = loadSettings(activeSlug || '');
    const orgId = settings.orgId || localStorage.getItem(`cc_org_id_${activeSlug}`);
    if (orgId && orgId !== 'demo') {
        const cloudRecord = {
            id: checkinId,
            org_id: orgId,
            student_id: studentId,
            group_id: groupId || 'none',
            date: dateToUse,
            status: 'present',
            notes: `Via ${via.toUpperCase()}`,
            data: record
        };
        syncRecordToCloud('attendance', cloudRecord, orgId);

        // 🔥 OPTIMISTIC UPDATE: Append to global cloud state immediately
        try {
            const attDataKey = getScopedKey('cc_attendance_data', activeSlug);
            const attData = JSON.parse(localStorage.getItem(attDataKey) || '{}');
            if (!attData[studentId]) attData[studentId] = [];
            attData[studentId].push(cloudRecord);
            localStorage.setItem(attDataKey, JSON.stringify(attData));
        } catch (e) {}
    }

    // Legacy sync trigger removed (Native SYNC prioritized)

    // GLOBAL AUDIT LOG
    const session = typeof window !== 'undefined' ? getStaffSession() : null;
    const currentSlug = typeof window !== 'undefined' ? getActiveSlug() : '';
    if (currentSlug) {
        const settings = loadSettings(currentSlug);
        const branchName = settings.branches.find(b => b.id === (settings.activeBranchId || 'main'))?.name || 'Main';

        recordAuditAction({
            action: 'lesson_checkin',
            details: `Check-in via ${via.toUpperCase()}${classId ? ` (Class ID: ${classId})` : ''}`,
            studentId,
            studentName,
            branchId: settings.activeBranchId || 'main',
            branchName,
            performedBy: session?.staff.full_name || 'System'
        });
    }

    if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_attendance_update'));

    // SMS Notification when visits run out
    if (next === 0 && activeSlug && activeSlug !== 'demo.classcore.ge') {
        const settings = loadSettings(activeSlug);
        if (settings.sms_enabled !== false) { // Ensure SMS feature is not explicitly disabled
            import('./student-store').then(({ getStudents }) => {
                const student = getStudents().find(s => s.id === studentId);
                const phone = student?.phone;
                if (phone) {
                    const lang = settings.primary_lang || settings.language || 'ka';
                    const text = (settings.sms_templates as any)?.[lang]?.low_visits || (lang === 'ka' ? `გამარჯობა ${studentName}, თქვენ დაგიმთავრდათ ვიზიტები სტუდიაში: ${settings.studioName}. გთხოვთ განაახლოთ აბონემენტი.` : `Hello ${studentName}, you have run out of visits at ${settings.studioName}. Please renew your subscription.`);
                    
                    fetch('/api/sms/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: phone,
                            text,
                            studentName
                        })
                    }).then(res => res.json()).then(data => {
                        console.log('📬 [Checkin] SMS Status:', data);
                    }).catch(err => console.error('📬 [Checkin] SMS Failed:', err));
                }
            });
        }
    }

    return { success: true, alreadyCheckedIn: false, sessionsRemaining: next, record };
}
export function getStudentCheckins(studentId: string): CheckinRecord[] {
    if (typeof window === 'undefined') return [];

    const history: CheckinRecord[] = [];
    const seenIds = new Set<string>();
    const keys = Object.keys(localStorage);

    // 1. Look in per-day checkin keys (local records)
    const prefix = getScopedKey(BASE_CHECKINS_PREFIX);
    keys.forEach(key => {
        if (key.startsWith(prefix)) {
            try {
                const records = JSON.parse(localStorage.getItem(key) ?? '[]') as CheckinRecord[];
                records.forEach(r => {
                    if (r.studentId === studentId) {
                        history.push(r);
                        if (r.id) seenIds.add(r.id);
                    }
                });
            } catch (e) {
                console.error('Error parsing checkin record', key, e);
            }
        }
    });

    // 2. Also pull from cloud-hydrated attendance data (cc_attendance_data)
    try {
        const attKey = keys.find(k => k.includes('cc_attendance_data'));
        if (attKey) {
            const attData = JSON.parse(localStorage.getItem(attKey) || '{}');
            const studentRecords = attData[studentId];
            if (Array.isArray(studentRecords)) {
                studentRecords.forEach((r: any) => {
                    const id = r.id || `cloud_${r.date}_${r.student_id}`;
                    if (!seenIds.has(id)) {
                        seenIds.add(id);
                        history.push({
                            id,
                            studentId: r.student_id || studentId,
                            studentName: r.student_name || '',
                            date: r.date || '',
                            time: r.time || r.notes?.replace('Via ', '') || '',
                            via: 'manual',
                            sessionsRemaining: 0,
                            classId: r.class_id,
                            groupId: r.group_id,
                        });
                    }
                });
            }
        }
    } catch (e) {
        // Silent fail
    }

    // Sort by date and time descending
    return history.sort((a, b) => {
        const dateCompare = (b.date || '').localeCompare(a.date || '');
        if (dateCompare !== 0) return dateCompare;
        return (b.time || '').localeCompare(a.time || '');
    });
}
// ─── History Deletion ────────────────────────────────────────────────────────

/** Delete a specific checkin from history and refund sessions */
export function deleteCheckin(studentId: string, date: string, time: string, forceId?: string): void {
    const key = dayKey(date);
    let existing: CheckinRecord[] = [];
    try {
        const raw = localStorage.getItem(key);
        if (raw) existing = JSON.parse(raw);
        if (!Array.isArray(existing)) existing = [];
    } catch (e) {
        // Ignore
    }
    const idx = existing.findIndex(r => r.studentId === studentId && (r.time === time || !time || r.id === forceId));

    let rToDelete: CheckinRecord | undefined = undefined;

    if (idx > -1) {
        rToDelete = existing[idx];
        const updated = [...existing];
        updated.splice(idx, 1);
        if (updated.length === 0) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(updated));
    }

    // Also look in cc_attendance_data (cloud hydrated data)
    try {
        const attKeys = Object.keys(localStorage).filter(k => k.includes('cc_attendance_data'));
        for (const attKey of attKeys) {
            const attData = JSON.parse(localStorage.getItem(attKey) || '{}');
            const studentRecords = attData[studentId];
            if (Array.isArray(studentRecords)) {
                const cloudIdx = studentRecords.findIndex((r: any) => 
                    r.date === date && (r.time === time || !time || r.id === forceId)
                );
                if (cloudIdx > -1) {
                    if (!rToDelete) {
                        const r = studentRecords[cloudIdx];
                        rToDelete = {
                            id: r.id || `cloud_${r.date}_${r.student_id}`,
                            studentId: r.student_id || studentId,
                            studentName: r.student_name || '',
                            date: r.date || '',
                            time: r.time || '',
                            via: 'manual',
                            sessionsRemaining: 0
                        };
                    }
                    studentRecords.splice(cloudIdx, 1);
                    attData[studentId] = studentRecords;
                    localStorage.setItem(attKey, JSON.stringify(attData));
                }
            }
        }
    } catch (e) {
        // Silent
    }

    if (rToDelete) {
        // Refund session
        refundSessionsUsed(studentId);
        markLocalUpdate();

        // Standardized Cloud Sync
        const activeSlug = getActiveSlug();
        const settings = loadSettings(activeSlug || '');
        const orgId = settings.orgId || localStorage.getItem(`cc_org_id_${activeSlug}`);
        if (orgId && orgId !== 'demo' && rToDelete.id) {
            import('./master-sync').then(({ deleteRecordFromCloud }) => {
                deleteRecordFromCloud('attendance', rToDelete.id as string, orgId);
            });
        }

        if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_attendance_update'));
    }
}
