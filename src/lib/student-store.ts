import type { Student } from '@/types';

import { getScopedKey } from './settings-store';

const BASE_UID_REGISTRY_KEY = 'cc_uid_registry';
const BASE_STUDENT_DATA_KEY = 'cc_student_data';
const BASE_DELETED_STUDENTS_KEY = 'cc_deleted_students';

function getStudentDataKey() { return getScopedKey(BASE_STUDENT_DATA_KEY); }
function getUidRegistryKey() { return getScopedKey(BASE_UID_REGISTRY_KEY); }
function getDeletedStudentsKey() { return getScopedKey(BASE_DELETED_STUDENTS_KEY); }

export interface UidEntry {
    studentId: string;
    studentName: string;
}

import { ALL_STUDENTS } from './student-data';

export const INITIAL_STUDENTS: Student[] = ALL_STUDENTS as Student[];

export function getStudents(): Student[] {
    if (typeof window === 'undefined') return INITIAL_STUDENTS;
    try {
        const activeSlug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : 'demo.classcore.ge';
        const activeBranch = typeof window !== 'undefined' ? (localStorage.getItem(`cc_active_branch_${activeSlug}`) || 'main') : 'main';

        const key = getStudentDataKey();
        let stored = localStorage.getItem(key);

        // Migration: If new scoped key is empty, check old unscoped key
        if (!stored && activeBranch === 'main') {
            const oldKey = `cc_student_data_${activeSlug}`;
            stored = localStorage.getItem(oldKey);
            if (stored) {
                console.log('🚚 [StudentStore] Migrating legacy main branch data');
                localStorage.setItem(key, stored);
                // Optionally remove oldKey? safer to keep for now
            }
        }

        const deletedKey = getDeletedStudentsKey();
        const deletedIds = new Set(JSON.parse(localStorage.getItem(deletedKey) || '[]'));

        const isMainBranch = activeBranch === 'main';

        if (!stored) return isMainBranch ? INITIAL_STUDENTS : [];
        const patches = JSON.parse(stored) || {};

        // If saved data is an array (old version) or unexpected format, return initial
        if (Array.isArray(patches)) return isMainBranch ? INITIAL_STUDENTS : [];

        // Base students for this branch
        const baseStudents = isMainBranch ? INITIAL_STUDENTS : [];

        // Map base students and apply patches
        const merged = baseStudents.map(s => {
            const p = patches[s.id];
            if (!p) return s;

            // Migration for classes if they exist in patch
            if (p.classes && Array.isArray(p.classes)) {
                p.classes = p.classes.map((c: string) => (c.startsWith('e') && !isNaN(Number(c.slice(1)))) ? `cls${c.slice(1)}` : c);
            }
            return { ...s, ...p };
        });

        // Add new students registered via patches (not in base data)
        const baseIds = new Set(baseStudents.map(s => s.id));
        const newOnes = Object.entries(patches)
            .map(([id, p]: [string, any]) => ({ ...(p as Student), id: p.id || id }))
            .filter(student => !baseIds.has(student.id))
            .map(student => student as Student);

        const allMerged = [...merged, ...newOnes];

        // Final normalization pass: ensure enrolled_group_ids is populated from legacy classes
        const finalStudents = allMerged.map(student => {
            const s = { ...student } as Student & { classes?: string[] };
            if (!s.enrolled_group_ids) s.enrolled_group_ids = [];

            if (s.classes && Array.isArray(s.classes)) {
                const migrated = s.classes.filter(c => c !== 'individual' && c !== 'rental');
                for (const g of migrated) {
                    if (!s.enrolled_group_ids.includes(g)) s.enrolled_group_ids.push(g);
                }
            }
            return s as Student;
        });

        // Filter out deleted IDs (including mock students)
        return finalStudents.filter(s => !deletedIds.has(s.id));
    } catch {
        return INITIAL_STUDENTS;
    }
}

export function updateStudent(studentId: string, data: Partial<Student>, oldId?: string): void {
    const patches = getStudentPatches();
    const activeSlug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : 'demo.classcore.ge';
    const activeBranch = typeof window !== 'undefined' ? (localStorage.getItem(`cc_active_branch_${activeSlug}`) || 'main') : 'main';

    if (oldId && oldId !== studentId) {
        // ID changed (e.g. from temp to formatted)
        const existing = patches[oldId] || INITIAL_STUDENTS.find(s => s.id === oldId) || {};
        patches[studentId] = { ...existing, ...data, id: studentId, branch_id: activeBranch };
        delete patches[oldId];
    } else {
        const initial = INITIAL_STUDENTS.find(s => s.id === studentId);
        if (initial) {
            // Patching a mock student: merge with initial data
            patches[studentId] = { ...initial, ...(patches[studentId] || {}), ...data, branch_id: activeBranch };
        } else {
            // New or already patched student
            patches[studentId] = { ...(patches[studentId] || {}), ...data, branch_id: activeBranch };
        }
    }

    // Ensure full_name is synced if first/last name change
    if (data.first_name || data.last_name) {
        const current = patches[studentId];
        const f = data.first_name || (current as any).first_name || '';
        const l = data.last_name || (current as any).last_name || '';
        patches[studentId].full_name = `${f} ${l}`.trim();
    }

    localStorage.setItem(getStudentDataKey(), JSON.stringify(patches));
    window.dispatchEvent(new Event('cc_student_update'));
}

export function deleteStudent(studentId: string): void {
    const patches = getStudentPatches();
    delete patches[studentId];
    localStorage.setItem(getStudentDataKey(), JSON.stringify(patches));

    // Persist deletion for mock data
    const deletedKey = getDeletedStudentsKey();
    const deletedIds = JSON.parse(localStorage.getItem(deletedKey) || '[]');
    if (!deletedIds.includes(studentId)) {
        deletedIds.push(studentId);
        localStorage.setItem(deletedKey, JSON.stringify(deletedIds));
    }

    // Also clear UID
    unregisterStudentUid(studentId);

    window.dispatchEvent(new Event('cc_student_update'));
}

export function checkDuplicateStudent(name: string, phone: string, excludeId?: string): Student | null {
    const all = getStudents();
    const normalizedPhone = phone.replace(/\D/g, '');

    return all.find(s => {
        if (excludeId && s.id === excludeId) return false;

        const nameMatch = name && s.full_name?.toLowerCase() === name.toLowerCase();
        const phoneMatch = phone && s.phone?.replace(/\D/g, '') === normalizedPhone;

        return nameMatch || phoneMatch;
    }) || null;
}

/** Normalise UID: remove separators, uppercase */
export function normaliseUid(raw: string): string {
    return raw.replace(/[:\-\s]/g, '').toUpperCase();
}

export function getUidRegistry(): Record<string, UidEntry> {
    const key = getUidRegistryKey();
    try {
        let stored = localStorage.getItem(key);
        return JSON.parse(stored ?? '{}') as Record<string, UidEntry>;
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
    localStorage.setItem(getUidRegistryKey(), JSON.stringify(registry));
}

/** Remove UID registration for a student (called on student delete or UID clear) */
export function unregisterStudentUid(studentId: string): void {
    const registry = getUidRegistry();
    for (const key of Object.keys(registry)) {
        if (registry[key].studentId === studentId) {
            delete registry[key];
        }
    }
    localStorage.setItem(getUidRegistryKey(), JSON.stringify(registry));
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
    social_links?: {
        facebook?: string;
        instagram?: string;
        telegram?: string;
        whatsapp?: string;
    };
    [key: string]: unknown; // Allow other properties including objects
}

export function getStudentPatches(): Record<string, StudentPatch> {
    if (typeof window === 'undefined') return {};
    try {
        const key = getStudentDataKey();
        let stored = localStorage.getItem(key);
        return JSON.parse(stored ?? '{}') || {};
    } catch {
        return {};
    }
}

export function saveStudentPatch(studentId: string, patch: StudentPatch): void {
    const patches = getStudentPatches();
    patches[studentId] = { ...patches[studentId], ...patch };
    localStorage.setItem(getStudentDataKey(), JSON.stringify(patches));
}

export function getStudentPatch(studentId: string): StudentPatch {
    return getStudentPatches()[studentId] ?? {};
}

/**
 * Generates a student ID in the format: [LastInitial][FirstInitial][Sequence]
 * Example: Afshilava Elene -> AE00001
 */
export function generateFormattedStudentId(firstName: string, lastName: string): string {
    if (!firstName && !lastName) return '';

    // Convert Georgian initials to Latin if necessary, or just use first chars
    // Based on user request "AE00001 (afshilava elene)", we use Latin mapping
    const geoToLat: Record<string, string> = {
        'ა': 'A', 'ბ': 'B', 'გ': 'G', 'დ': 'D', 'ე': 'E', 'ვ': 'V', 'ზ': 'Z', 'თ': 'T', 'ი': 'I', 'კ': 'K', 'ლ': 'L', 'მ': 'M', 'ნ': 'N', 'ო': 'O', 'პ': 'P', 'ჟ': 'ZH', 'რ': 'R', 'ს': 'S', 'ტ': 'T', 'უ': 'U', 'ფ': 'F', 'ქ': 'K', 'ღ': 'GH', 'ყ': 'Q', 'შ': 'SH', 'ჩ': 'CH', 'ც': 'TS', 'ძ': 'DZ', 'წ': 'TS', 'ჭ': 'CH', 'ხ': 'KH', 'ჯ': 'J', 'ჰ': 'H'
    };

    const getInitial = (name: string) => {
        if (!name) return 'X';
        const firstChar = name.trim()[0];
        return geoToLat[firstChar] || firstChar.toUpperCase();
    };

    const firstI = getInitial(firstName);
    const lastI = getInitial(lastName);
    const prefix = `${lastI}${firstI}`.slice(0, 2).toUpperCase();

    // Find highest sequence for this prefix
    const allStudents = getStudents();
    let maxSeq = 0;

    allStudents.forEach(s => {
        if (s.id.startsWith(prefix)) {
            const seqPart = s.id.slice(prefix.length);
            const seq = parseInt(seqPart, 10);
            if (!isNaN(seq) && seq > maxSeq) {
                maxSeq = seq;
            }
        }
    });

    const nextSeq = (maxSeq + 1).toString().padStart(5, '0');
    return `${prefix}${nextSeq}`;
}
