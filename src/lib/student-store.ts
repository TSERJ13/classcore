/**
 * student-store.ts
 * Persists student NFC/RFID UID registrations to localStorage.
 * This is the source of truth for UID → student mapping,
 * shared across Attendance, NFC kiosk, and QR check-in pages.
 */

const UID_REGISTRY_KEY = 'sf_uid_registry';
const STUDENT_DATA_KEY = 'sf_student_data';

// ─── UID ↔ Student mapping ────────────────────────────────────────────────────

export interface UidEntry {
    studentId: string;
    studentName: string;
}

/** Normalise UID: remove separators, uppercase */
export function normaliseUid(raw: string): string {
    return raw.replace(/[:\-\s]/g, '').toUpperCase();
}

export function getUidRegistry(): Record<string, UidEntry> {
    if (typeof window === 'undefined') return {};
    try {
        return JSON.parse(localStorage.getItem(UID_REGISTRY_KEY) ?? '{}') as Record<string, UidEntry>;
    } catch {
        return {};
    }
}

/**
 * Register (or update) a UID for a student.
 * Clears any previous UID registered for the same student to avoid conflicts.
 */
export function registerUid(uid: string, studentId: string, studentName: string): void {
    if (!uid.trim()) return;
    const registry = getUidRegistry();
    const norm = normaliseUid(uid);

    // Remove any old UID mapping for this student
    for (const key of Object.keys(registry)) {
        if (registry[key].studentId === studentId) {
            delete registry[key];
        }
    }

    registry[norm] = { studentId, studentName };
    localStorage.setItem(UID_REGISTRY_KEY, JSON.stringify(registry));
}

/** Remove UID registration for a student (called on student delete or UID clear) */
export function unregisterStudentUid(studentId: string): void {
    const registry = getUidRegistry();
    for (const key of Object.keys(registry)) {
        if (registry[key].studentId === studentId) {
            delete registry[key];
        }
    }
    localStorage.setItem(UID_REGISTRY_KEY, JSON.stringify(registry));
}

/** Look up a student by UID (returns null if not found) */
export function lookupByUid(uid: string): UidEntry | null {
    const norm = normaliseUid(uid);
    return getUidRegistry()[norm] ?? null;
}

/** Get the registered UID for a student (to display in their profile) */
export function getStudentUid(studentId: string): string {
    const registry = getUidRegistry();
    for (const [uid, entry] of Object.entries(registry)) {
        if (entry.studentId === studentId) return uid;
    }
    return '';
}

// ─── Student profile data ──────────────────────────────────────────────────────
// Persist minimal student profile overrides (photo, nfc_uid, qr_code) by id

interface StudentPatch {
    nfc_uid?: string;
    qr_code?: string;
    photo_url?: string;
    [key: string]: string | undefined;
}

export function getStudentPatches(): Record<string, StudentPatch> {
    if (typeof window === 'undefined') return {};
    try {
        return JSON.parse(localStorage.getItem(STUDENT_DATA_KEY) ?? '{}');
    } catch {
        return {};
    }
}

export function saveStudentPatch(studentId: string, patch: StudentPatch): void {
    const patches = getStudentPatches();
    patches[studentId] = { ...patches[studentId], ...patch };
    localStorage.setItem(STUDENT_DATA_KEY, JSON.stringify(patches));
}

export function getStudentPatch(studentId: string): StudentPatch {
    return getStudentPatches()[studentId] ?? {};
}
