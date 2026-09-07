import { incrementSessionsUsed, getSubscription, refundSessionsUsed } from './subscription-store';
import { pushStudioStateToCloud } from './sync-store';
import { getScopedKey, markLocalUpdate, getEffectiveOrgId } from './utils';
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
    via: 'nfc' | 'qr' | 'manual' | 'archive';
    sessionsRemaining: number;
    classId?: string;
    groupId?: string;
    subId?: string;
    planType?: 'group' | 'individual' | 'rental';
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

/**
 * Real check-ins recorded for an arbitrary date (not just today).
 * This is the same `cc_checkins_<date>` list that recordCheckin() writes to
 * and that realtime-sync.ts's applyRemoteCheckin() mirrors in from OTHER
 * devices — i.e. it's the actual source of truth, unlike the attendance
 * page's own `cc_attendance_archive` display cache (see attendance/page.tsx),
 * which is per-device, never synced to the cloud, and can drift from it.
 */
export function getCheckinsForDate(date: string): CheckinRecord[] {
    if (typeof window === 'undefined' || !date) return [];
    try {
        const key = dayKey(date);
        const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
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
    customDate?: string,
    planType?: 'group' | 'individual' | 'rental'
): CheckinResult {
    return _writeCheckin(studentId, studentName, via, classId, groupId, subId, customDate, planType);
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
    customDate?: string,
    planType?: 'group' | 'individual' | 'rental'
): CheckinResult {
    return _writeCheckin(studentId, studentName, via, classId, groupId, subId, customDate, planType);
}

/** Refund a checkin: increments sessions back */
export function refundCheckin(
    studentId: string,
    customDate?: string,
    planType?: 'group' | 'individual' | 'rental',
    groupId?: string,
    subId?: string
): void {
    const activeSlug = getActiveSlug();
    const targetDate = customDate || today();
    let rToDeleteId: string | undefined;
    let foundRec: CheckinRecord | undefined;

    // 1. Try to find and remove in local day queue
    const key = getScopedKey(`cc_checkins_${targetDate}`);
    const existing: CheckinRecord[] = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = existing.findLastIndex(r => r.studentId === studentId);
    if (idx > -1) {
        foundRec = existing[idx];
        rToDeleteId = existing[idx].id;
        existing.splice(idx, 1);
        localStorage.setItem(key, JSON.stringify(existing));
        markLocalUpdate();
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('cc_attendance_update'));
        }
    }

    // 2. Try to find and remove in cloud global data
    let cloudFound = false;
    try {
        const attDataKey = getScopedKey('cc_attendance_data', activeSlug);
        const attData = JSON.parse(localStorage.getItem(attDataKey) || '{}');
        if (attData[studentId]) {
            const recordIdx = attData[studentId].findIndex((r: any) => r.date === targetDate);
            if (recordIdx > -1) {
                const cRec = attData[studentId][recordIdx];
                if (!foundRec) foundRec = cRec.data || cRec;
                if (!rToDeleteId) rToDeleteId = cRec.id;
                cloudFound = true;
                attData[studentId].splice(recordIdx, 1);
                localStorage.setItem(attDataKey, JSON.stringify(attData));
            }
        }
    } catch (e) {}

    if (rToDeleteId || cloudFound || idx > -1) {
        const recSubId = subId || foundRec?.subId;
        const recGroupId = groupId || foundRec?.groupId;
        const recPlanType = planType || foundRec?.planType || (recGroupId ? 'group' : undefined);

        // Delegate refund to subscription store with strict plan/group isolation
        refundSessionsUsed(studentId, recSubId, recPlanType, recGroupId);

        const settings = loadSettings(activeSlug || '');
        const orgId = getEffectiveOrgId(activeSlug) || settings.orgId;
        
        if (orgId && orgId !== 'demo' && rToDeleteId) {
            import('./master-sync').then(({ deleteRecordFromCloud }) => {
                deleteRecordFromCloud('attendance', rToDeleteId!, orgId);
            });
        }

        if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_attendance_update'));
    }
}

/**
 * Shared write path for a single check-in RECORD: appends it to the
 * per-day localStorage list and — the part that actually matters for
 * cross-device reliability — pushes it to the cloud `attendance` table and
 * mirrors it into the `cc_attendance_data` cache, exactly like a normal
 * check-in. Does NOT touch session counts; callers decide whether/who to
 * deduct from (see recordCompanionCheckin below for why this is split
 * out).
 */
function _persistCheckinRecord(record: CheckinRecord, via: 'nfc' | 'qr' | 'manual'): void {
    const key = dayKey(record.date);
    const existing = JSON.parse(localStorage.getItem(key) ?? '[]');
    localStorage.setItem(key, JSON.stringify([...existing, record]));
    markLocalUpdate();
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cc_attendance_update'));
    }

    const activeSlug = getActiveSlug();
    const settings = loadSettings(activeSlug || '');
    const orgId = getEffectiveOrgId(activeSlug) || settings.orgId;
    if (orgId && orgId !== 'demo') {
        const cloudRecord = {
            id: record.id,
            org_id: orgId,
            student_id: record.studentId,
            group_id: record.groupId || 'none',
            date: record.date,
            status: 'present',
            notes: `Via ${via.toUpperCase()}`,
            data: record
        };
        syncRecordToCloud('attendance', cloudRecord, orgId);
        try {
            const attDataKey = getScopedKey('cc_attendance_data', activeSlug);
            const attData = JSON.parse(localStorage.getItem(attDataKey) || '{}');
            if (!attData[record.studentId]) attData[record.studentId] = [];
            attData[record.studentId].push(cloudRecord);
            localStorage.setItem(attDataKey, JSON.stringify(attData));
        } catch (e) {}
    }
}

/**
 * Records a COMPANION check-in for a paired/"couple" lesson where the
 * primary partner already deducted the one shared session (via
 * recordCheckin/forceCheckin). This writes an equally real, cloud-synced
 * attendance record for the OTHER partner — same as a normal check-in —
 * but deliberately skips incrementSessionsUsed so the shared subscription
 * isn't double-charged.
 *
 * 🛠️ FIX: attendance/page.tsx's toggleCouple() used to write this
 * companion record by hand, straight into localStorage only, bypassing
 * this whole sync path — so it never reached Supabase. On any other
 * device (or after this browser's storage was cleared/reset), the
 * companion's own "present" mark would silently vanish even though the
 * couple genuinely attended and the primary partner's mark was fine —
 * exactly the "green doesn't stick" symptom reported for couple classes.
 */
export function recordCompanionCheckin(
    studentId: string,
    studentName: string,
    via: 'nfc' | 'qr' | 'manual',
    sessionsRemaining: number,
    classId?: string,
    groupId?: string,
    customDate?: string
): CheckinRecord {
    const dateToUse = customDate || today();
    const record: CheckinRecord = {
        id: `att_${studentId}_${dateToUse}_${Date.now()}`,
        studentId,
        studentName,
        date: dateToUse,
        time: nowTime(),
        via,
        sessionsRemaining,
        classId,
        groupId,
    };
    _persistCheckinRecord(record, via);
    return record;
}

/**
 * Removes a companion record written by recordCompanionCheckin, without
 * touching session counts — the shared session was already refunded once
 * via the primary partner's refundCheckin() call. Mirrors deleteCheckin's
 * local + cloud cleanup but deliberately has no refund side effect, so
 * un-marking a couple doesn't silently hand back an extra session nobody
 * actually took.
 */
export function deleteCompanionCheckin(studentId: string, date: string): void {
    if (typeof window === 'undefined' || !date) return;
    try {
        const key = dayKey(date);
        const existing: CheckinRecord[] = JSON.parse(localStorage.getItem(key) || '[]');
        const idx = existing.findLastIndex(r => r.studentId === studentId);
        if (idx === -1) return;
        const rec = existing[idx];
        const updated = [...existing];
        updated.splice(idx, 1);
        if (updated.length === 0) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(updated));
        markLocalUpdate();

        const activeSlug = getActiveSlug();
        const settings = loadSettings(activeSlug || '');
        const orgId = getEffectiveOrgId(activeSlug) || settings.orgId;
        if (orgId && orgId !== 'demo' && rec.id) {
            import('./master-sync').then(({ deleteRecordFromCloud }) => {
                deleteRecordFromCloud('attendance', rec.id, orgId);
            });
        }
        window.dispatchEvent(new Event('cc_attendance_update'));
    } catch (e) {
        console.error('❌ [Checkin] Failed to delete companion checkin:', e);
    }
}

function _writeCheckin(
    studentId: string,
    studentName: string,
    via: 'nfc' | 'qr' | 'manual',
    classId?: string,
    groupId?: string,
    subId?: string,
    customDate?: string,
    planType?: 'group' | 'individual' | 'rental'
): CheckinResult {
    // Only deduct sessions if the student has an active subscription
    const subResult = incrementSessionsUsed(studentId, subId, planType, groupId);
    const hasSubscription = subResult !== null;

    const next = hasSubscription ? getSessionsRemaining(studentId, groupId, planType) : -1;
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
        subId: subResult?.id || subId,
        planType: subResult?.plan_type || planType || (groupId ? 'group' : undefined),
    };
    const existing = JSON.parse(localStorage.getItem(dayKey(dateToUse)) ?? '[]');
    const key = dayKey(dateToUse);
    const updated = [...existing, record];
    localStorage.setItem(key, JSON.stringify(updated));
    markLocalUpdate();
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cc_attendance_update'));
    }

    // 🔥 NEW ATOMIC SYNC: Push this check-in to the native table
    const activeSlug = getActiveSlug();
    const settings = loadSettings(activeSlug || '');
    const orgId = getEffectiveOrgId(activeSlug) || settings.orgId;
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
                    const lang = student?.preferred_language || settings.primary_lang || settings.language || 'ka';
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

    // 2. Also pull from cloud-hydrated attendance data (cc_attendance_data - per-student object)
    try {
        const attKey = keys.find(k => k.includes('cc_attendance_data'));
        if (attKey) {
            const attData = JSON.parse(localStorage.getItem(attKey) || '{}');
            // Case-insensitive lookup
            const targetKey = Object.keys(attData).find(k => k.toLowerCase() === studentId.toLowerCase());
            const studentRecords = targetKey ? attData[targetKey] : [];
            
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
                            via: r.via || 'cloud',
                            sessionsRemaining: r.sessionsRemaining || 0,
                            classId: r.class_id,
                            groupId: r.group_id
                        });
                    }
                });
            }
        }
    } catch (e) {}

    // 3. Look in cc_attendance_archive (flat array - common in portal)
    try {
        const archiveKey = keys.find(k => k.includes('cc_attendance_archive'));
        if (archiveKey) {
            const archive = JSON.parse(localStorage.getItem(archiveKey) || '[]') as any[];
            archive.forEach(r => {
                const sId = (r.student_id || r.studentId || '').toString().toLowerCase();
                if (sId === studentId.toLowerCase()) {
                    const id = r.id || `arch_${r.date}_${sId}`;
                    if (!seenIds.has(id)) {
                        seenIds.add(id);
                        history.push({
                            id,
                            studentId: sId,
                            studentName: r.student_name || '',
                            date: r.date || '',
                            time: r.time || '',
                            via: 'archive',
                            sessionsRemaining: 0
                        });
                    }
                }
            });
        }
    } catch (e) {}

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
    let rToDelete: CheckinRecord | undefined = undefined;

    // 🛠️ FIX: this used to look ONLY at the one exact key
    // getScopedKey(`cc_checkins_${date}`) computes right now — if the
    // record the "ვიზიტები" list is actually showing lives under a
    // differently-scoped variant of that same day (a legacy/branch-scoped
    // key, for instance), the lookup silently found nothing, deleted
    // nothing, and the "X" button appeared to just not work. Scan every
    // cc_checkins_<date> key that actually exists instead of computing one
    // and hoping it's the right one. Also prefer an exact id match
    // (forceId) over the fragile time-string comparison when we have one.
    try {
        const dayKeys = Object.keys(localStorage).filter(k => k.includes(`${BASE_CHECKINS_PREFIX}${date}`));
        for (const key of dayKeys) {
            let existing: CheckinRecord[] = [];
            try {
                const raw = localStorage.getItem(key);
                existing = raw ? JSON.parse(raw) : [];
                if (!Array.isArray(existing)) existing = [];
            } catch { existing = []; }

            const idx = existing.findIndex(r => r.studentId === studentId && (r.id === forceId || r.time === time || !time));
            if (idx > -1) {
                rToDelete = existing[idx];
                const updated = [...existing];
                updated.splice(idx, 1);
                if (updated.length === 0) localStorage.removeItem(key);
                else localStorage.setItem(key, JSON.stringify(updated));
            }
        }
    } catch (e) {
        // Ignore
    }

    // Also look in cc_attendance_data (cloud hydrated data) — case-insensitive
    // key lookup, matching getStudentCheckins() (the source the "ვიზიტები"
    // list this button is wired to actually reads), since a mismatched case
    // here meant this branch never found anything for that record either.
    try {
        const attKeys = Object.keys(localStorage).filter(k => k.includes('cc_attendance_data'));
        for (const attKey of attKeys) {
            const attData = JSON.parse(localStorage.getItem(attKey) || '{}');
            const targetKey = Object.keys(attData).find(k => k.toLowerCase() === studentId.toLowerCase());
            const studentRecords = targetKey ? attData[targetKey] : undefined;
            if (Array.isArray(studentRecords)) {
                const cloudIdx = studentRecords.findIndex((r: any) =>
                    r.date === date && (r.id === forceId || r.time === time || !time)
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
                    attData[targetKey as string] = studentRecords;
                    localStorage.setItem(attKey, JSON.stringify(attData));
                }
            }
        }
    } catch (e) {
        // Silent
    }

    if (rToDelete) {
        // Refund session using record metadata
        const recSubId = (rToDelete as any)?.subId;
        const recGroupId = rToDelete.groupId;
        const recPlanType = (rToDelete as any)?.planType || (recGroupId ? 'group' : undefined);
        refundSessionsUsed(studentId, recSubId, recPlanType, recGroupId);
        markLocalUpdate();

        // Standardized Cloud Sync
        const activeSlug = getActiveSlug();
        const settings = loadSettings(activeSlug || '');
        const orgId = getEffectiveOrgId(activeSlug) || settings.orgId;
        const finalRecord = rToDelete;
        if (orgId && orgId !== 'demo' && finalRecord.id) {
            import('./master-sync').then(({ deleteRecordFromCloud }) => {
                deleteRecordFromCloud('attendance', finalRecord.id as string, orgId);
            });
        }

        if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_attendance_update'));
    }
}
