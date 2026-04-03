import { incrementSessionsUsed, getSubscription, refundSessionsUsed } from './subscription-store';
import { getScopedKey, markLocalUpdate } from './utils';
import { getStaffSession, getActiveSlug, loadSettings } from './settings-store';
import { recordAuditAction } from './audit-store';
/**
 * checkin-store.ts
 * localStorage-based store for attendance records.
 * Relies on subscription-store.ts for session counting.
 */

export interface CheckinRecord {
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
    subId?: string
): CheckinResult {
    const todayRecs = getTodayCheckins();
    const already = todayRecs.some(r => r.studentId === studentId);

    if (already && via !== 'manual') {
        return {
            success: false,
            alreadyCheckedIn: true,
            sessionsRemaining: getSessionsRemaining(studentId, groupId),
        };
    }
    return _writeCheckin(studentId, studentName, via, classId, groupId, subId);
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
    subId?: string
): CheckinResult {
    return _writeCheckin(studentId, studentName, via, classId, groupId, subId);
}

/** Refund a checkin: increments sessions back */
export function refundCheckin(studentId: string): void {
    const existing = getTodayCheckins();
    const record = existing.find(r => r.studentId === studentId);

    if (record) {
        // Delegate refund to subscription store
        refundSessionsUsed(studentId);

        // Remove only the latest checkin from today
        const updated = [...existing];
        const idx = updated.findLastIndex(r => r.studentId === studentId);
        if (idx > -1) updated.splice(idx, 1);
        localStorage.setItem(dayKey(), JSON.stringify(updated));
        markLocalUpdate();
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_attendance_update'));
    }
}

function _writeCheckin(
    studentId: string,
    studentName: string,
    via: 'nfc' | 'qr' | 'manual',
    classId?: string,
    groupId?: string,
    subId?: string
): CheckinResult {
    // Increment sessions used in the main subscription store
    incrementSessionsUsed(studentId, subId);

    const next = getSessionsRemaining(studentId, groupId);
    const record: CheckinRecord = {
        studentId,
        studentName,
        date: today(),
        time: nowTime(),
        via,
        sessionsRemaining: next,
        classId,
        groupId,
    };
    const existing = getTodayCheckins();
    const key = dayKey();
    localStorage.setItem(key, JSON.stringify([...existing, record]));
    markLocalUpdate();

    // GLOBAL AUDIT LOG
    const session = typeof window !== 'undefined' ? getStaffSession() : null;
    const activeSlug = typeof window !== 'undefined' ? getActiveSlug() : '';
    if (activeSlug) {
        const settings = loadSettings(activeSlug);
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

    return { success: true, alreadyCheckedIn: false, sessionsRemaining: next, record };
}
export function getStudentCheckins(studentId: string): CheckinRecord[] {
    if (typeof window === 'undefined') return [];

    const history: CheckinRecord[] = [];
    const keys = Object.keys(localStorage);

    // ONLY look for keys that match the current scoped prefix
    // This prevents history from other branches/studios from leaking
    const prefix = getScopedKey(BASE_CHECKINS_PREFIX);

    keys.forEach(key => {
        if (key.startsWith(prefix)) {
            try {
                const records = JSON.parse(localStorage.getItem(key) ?? '[]') as CheckinRecord[];
                records.forEach(r => {
                    if (r.studentId === studentId) history.push(r);
                });
            } catch (e) {
                console.error('Error parsing checkin record', key, e);
            }
        }
    });

    // Sort by date and time descending
    return history.sort((a, b) => {
        const dateCompare = (b.date || '').localeCompare(a.date || '');
        if (dateCompare !== 0) return dateCompare;
        return (b.time || '').localeCompare(a.time || '');
    });
}
// ─── History Deletion ────────────────────────────────────────────────────────

/** Delete a specific checkin from history and refund sessions */
export function deleteCheckin(studentId: string, date: string, time: string): void {
    const key = dayKey(date);
    let existing: CheckinRecord[] = [];
    try {
        const raw = localStorage.getItem(key);
        if (raw) existing = JSON.parse(raw);
        if (!Array.isArray(existing)) existing = [];
    } catch (e) {
        return; // Corrupt data, can't delete specific record reliably
    }
    const idx = existing.findIndex(r => r.studentId === studentId && (r.time === time || !time));

    if (idx > -1) {
        // Refund session
        refundSessionsUsed(studentId);

        // Remove record
        const updated = [...existing];
        updated.splice(idx, 1);
        if (updated.length === 0) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, JSON.stringify(updated));
        }
        markLocalUpdate();
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_attendance_update'));
    }
}
