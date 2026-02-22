/**
 * checkin-store.ts
 * localStorage-based store for attendance records and session deductions.
 * All data is keyed per-day and per-student.
 */

export interface CheckinRecord {
    studentId: string;
    studentName: string;
    date: string;        // YYYY-MM-DD
    time: string;        // HH:MM
    via: 'nfc' | 'qr' | 'manual';
    sessionsRemaining: number;
}

// Initial sessions per student (mock subscription data)
const INITIAL_SESSIONS: Record<string, number> = {
    '1': 5,  // ნინო ბერიძე       (12 total, 7 used)
    '2': 8,  // გიორგი კვირიკაშვილი
    '3': 3,  // ანა ჩხეიძე
    '4': 10, // დავით მეფარიშვილი
    '5': 6,  // მარიამ ლომიძე
    '6': 2,  // ლუკა ჯავახიშვილი
    '7': 7,  // სოფო კაციტაძე
    '8': 4,  // თამო ღვინიაშვილი
};

function today(): string {
    return new Date().toISOString().split('T')[0];
}

function nowTime(): string {
    return new Date().toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' });
}

// ─── Sessions ────────────────────────────────────────────────────────────────

function sessionsKey(studentId: string) {
    return `sf_sessions_${studentId}`;
}

export function getSessionsRemaining(studentId: string): number {
    if (typeof window === 'undefined') return INITIAL_SESSIONS[studentId] ?? 0;
    const stored = localStorage.getItem(sessionsKey(studentId));
    if (stored !== null) return parseInt(stored, 10);
    return INITIAL_SESSIONS[studentId] ?? 0;
}

function setSessionsRemaining(studentId: string, count: number) {
    localStorage.setItem(sessionsKey(studentId), String(Math.max(0, count)));
}

// ─── Daily Checkins ───────────────────────────────────────────────────────────

function dayKey(date?: string) {
    return `sf_checkins_${date ?? today()}`;
}

export function getTodayCheckins(): CheckinRecord[] {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem(dayKey()) ?? '[]') as CheckinRecord[];
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
): CheckinResult {
    if (hasCheckinToday(studentId)) {
        return {
            success: false,
            alreadyCheckedIn: true,
            sessionsRemaining: getSessionsRemaining(studentId),
        };
    }
    return _writeCheckin(studentId, studentName, via);
}

/**
 * Force check-in: always records, even if already checked in today.
 * Used for confirmed double check-in (e.g. two classes same day).
 */
export function forceCheckin(
    studentId: string,
    studentName: string,
    via: 'nfc' | 'qr' | 'manual',
): CheckinResult {
    return _writeCheckin(studentId, studentName, via);
}

function _writeCheckin(
    studentId: string,
    studentName: string,
    via: 'nfc' | 'qr' | 'manual',
): CheckinResult {
    const prev = getSessionsRemaining(studentId);
    const next = Math.max(0, prev - 1);
    setSessionsRemaining(studentId, next);

    const record: CheckinRecord = {
        studentId,
        studentName,
        date: today(),
        time: nowTime(),
        via,
        sessionsRemaining: next,
    };
    const existing = getTodayCheckins();
    localStorage.setItem(dayKey(), JSON.stringify([...existing, record]));

    return { success: true, alreadyCheckedIn: false, sessionsRemaining: next, record };
}
