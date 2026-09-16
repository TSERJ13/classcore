/**
 * Client-side adapter with the exact same function signatures as
 * checkin-store.ts, but backed by the server-driven check-in path
 * (src/app/actions/checkin.ts + the atomic checkin_deduct_session /
 * checkin_refund_session RPCs) instead of localStorage. Lets
 * attendance/page.tsx swap its import without touching call sites beyond
 * adding `await` — see docs/architecture-migration.md §7.
 */

import {
    markPresentAction,
    refundCheckinAction,
    recordCompanionCheckinAction,
    deleteCompanionCheckinAction,
    getCheckinsForDateAction,
    getCheckinCountTodayAction,
    getStudentCheckinsAction,
    deleteCheckinAction,
} from '@/app/actions/checkin';

export interface CheckinRecord {
    id: string;
    studentId: string;
    studentName: string;
    date: string;
    time: string;
    via: 'nfc' | 'qr' | 'manual' | 'archive';
    sessionsRemaining: number;
    classId?: string;
    groupId?: string;
    subId?: string;
    planType?: 'group' | 'personal' | 'individual' | 'rental';
}

export interface CheckinResult {
    success: boolean;
    alreadyCheckedIn: boolean;
    sessionsRemaining: number;
    record?: CheckinRecord;
    sessionsUsed?: number | null;
    sessionsTotal?: number | null;
}

function today(): string {
    return new Date().toISOString().split('T')[0];
}
function nowTime(): string {
    return new Date().toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' });
}
function notifyUpdate(): void {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_attendance_update'));
}

export async function recordCheckin(
    studentId: string,
    studentName: string,
    via: 'nfc' | 'qr' | 'manual',
    classId?: string,
    groupId?: string,
    subId?: string,
    customDate?: string,
    planType?: 'group' | 'personal' | 'individual' | 'rental'
): Promise<CheckinResult> {
    const date = customDate || today();
    const res = await markPresentAction({ studentId, classId, groupId, subId, planType, date });
    const record: CheckinRecord = {
        id: res.attendanceId, studentId, studentName, date, time: nowTime(), via,
        sessionsRemaining: res.sessionsRemaining, classId, groupId,
        subId: res.usedSubId || subId, planType: planType || (groupId ? 'group' : undefined),
    };
    notifyUpdate();
    return {
        success: true, alreadyCheckedIn: false, sessionsRemaining: res.sessionsRemaining, record,
        sessionsUsed: res.sessionsUsed, sessionsTotal: res.sessionsTotal,
    };
}

/** Same underlying write path as recordCheckin — the old store's "block if already checked in" was never actually enforced (alreadyCheckedIn was hardcoded false), so force vs. standard was already a no-op distinction. */
export const forceCheckin = recordCheckin;

export async function refundCheckin(
    studentId: string,
    customDate?: string,
    planType?: 'group' | 'personal' | 'individual' | 'rental',
    groupId?: string,
    subId?: string
): Promise<{ subId: string | null; sessionsUsed: number | null; sessionsTotal: number | null }> {
    const date = customDate || today();
    const res = await refundCheckinAction({ studentId, date, planType, groupId, subId });
    notifyUpdate();
    return { subId: res.refundedSubId, sessionsUsed: res.sessionsUsed, sessionsTotal: res.sessionsTotal };
}

export async function recordCompanionCheckin(
    studentId: string,
    studentName: string,
    via: 'nfc' | 'qr' | 'manual',
    sessionsRemaining: number,
    classId?: string,
    groupId?: string,
    customDate?: string
): Promise<CheckinRecord> {
    const date = customDate || today();
    const res = await recordCompanionCheckinAction({ studentId, classId, groupId, date, sessionsRemaining });
    const record: CheckinRecord = {
        id: res.attendanceId, studentId, studentName, date, time: nowTime(), via,
        sessionsRemaining, classId, groupId,
    };
    notifyUpdate();
    return record;
}

export async function deleteCompanionCheckin(studentId: string, date: string): Promise<void> {
    await deleteCompanionCheckinAction({ studentId, date });
    notifyUpdate();
}

function rowToRecord(r: { id: string; student_id: string; group_id: string | null; date: string; data: Record<string, unknown> | null }): CheckinRecord {
    const d = r.data || {};
    return {
        id: r.id, studentId: r.student_id, studentName: (d.studentName as string) || '', date: r.date,
        time: (d.time as string) || '', via: (d.via as CheckinRecord['via']) || 'manual',
        sessionsRemaining: (d.sessionsRemaining as number) ?? -1,
        classId: d.classId as string | undefined, groupId: r.group_id || undefined,
        subId: d.subId as string | undefined, planType: d.planType as CheckinRecord['planType'],
    };
}

export async function getCheckinsForDate(date: string): Promise<CheckinRecord[]> {
    const rows = await getCheckinsForDateAction({ date });
    return rows.map(rowToRecord);
}

export async function getCheckinCountToday(studentId: string): Promise<number> {
    return getCheckinCountTodayAction({ studentId });
}

export async function getStudentCheckins(studentId: string): Promise<CheckinRecord[]> {
    const rows = await getStudentCheckinsAction({ studentId });
    return rows.map(rowToRecord);
}

export async function deleteCheckin(studentId: string, date: string, _time: string, forceId?: string): Promise<void> {
    await deleteCheckinAction({ studentId, date, forceId });
    notifyUpdate();
}
