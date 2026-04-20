import { getScopedKey, getActiveSlug as getActiveSlugLowLevel, markLocalUpdate } from './utils';
import { getStaffSession, loadSettings, type StaffMember } from '@/lib/settings-store';
import { triggerInstantSync } from './sync-store';
import { type Student, type StudentPatch, type Branch, type StudioSettings, type TrashItem, type SubscriptionLog } from '@/types';
import { recordAuditAction } from './audit-store';

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

export const INITIAL_STUDENTS: Student[] = [];


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
        let deletedIds = new Set<string>();
        try {
            const rawDeleted = localStorage.getItem(deletedKey);
            if (rawDeleted) {
                const parsed = JSON.parse(rawDeleted);
                if (Array.isArray(parsed)) deletedIds = new Set(parsed);
            }
        } catch (e) {
            console.warn('⚠️ [StudentStore] Failed to parse deleted IDs:', e);
        }

        const isMainBranch = activeBranch === 'main';

        if (!stored) return isMainBranch ? INITIAL_STUDENTS : [];
        let patches: any = {};
        try {
            patches = JSON.parse(stored) || {};
        } catch (e) {
            console.error('❌ [StudentStore] Fatal: Corrupt student patches. Returning base data.', e);
            return isMainBranch ? INITIAL_STUDENTS : [];
        }

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

        // ─── Hybrid Branch Logic ───
        // Students are GLOBAL (slug scope), but we filter them in the UI by branchId.
        // Legacy students with NO branch_id will be mapped to the 'main' branch by default.
        const activeBranch = typeof window !== 'undefined' ? (localStorage.getItem(`cc_active_branch_${activeSlug}`) || 'main') : 'main';

        const allMerged = [...merged, ...newOnes];

        // Final normalization pass: ensure enrolled_group_ids is populated from legacy classes
        const finalStudents = allMerged.map(student => {
            const s = { ...student } as Student & { classes?: string[]; branch_id?: string };
            if (!s.enrolled_group_ids) s.enrolled_group_ids = [];

            if (s.classes && Array.isArray(s.classes)) {
                const migrated = s.classes.filter(c => c !== 'individual' && c !== 'rental');
                for (const g of migrated) {
                    if (!s.enrolled_group_ids.includes(g)) s.enrolled_group_ids.push(g);
                }
            }
            return s as Student;
        });

        // Filter out deleted IDs
        const nonDeleted = finalStudents.filter(s => !deletedIds.has(s.id));

        // 🚨 Filter by Active Branch
        // If activeBranch is 'all' (Manager view), show everyone.
        // Otherwise, show students belonging to this branch OR students with NO branch (Main fallback)
        // OR students marked as 'all' (Shared students)
        if (activeBranch === 'all') return nonDeleted;
        
        return nonDeleted.filter(s => {
            const bId = s.branch_id || 'main'; // Fallback for legacy data
            return bId === activeBranch || bId === 'all';
        });
    } catch {
        return INITIAL_STUDENTS;
    }
}

/**
 * Retrieves all students across all branches.
 * Iterates through all branches of the current studio.
 */
export function getStudentsAllBranches(): Student[] {
    if (typeof window === 'undefined') return INITIAL_STUDENTS;
    try {
        const activeSlug = localStorage.getItem('cc_active_studio_slug') || 'demo.classcore.ge';
        const branchesKey = `cc_branches_${activeSlug}`;
        const branchesRaw = localStorage.getItem(branchesKey);
        const branches = branchesRaw ? JSON.parse(branchesRaw) : [{ id: 'main', name: 'Main' }];

        let allStudents: Student[] = [];
        const seenIds = new Set<string>();

        // We need to temporarily override the active branch in memory or 
        // access each branch's data key directly
        for (const branch of branches) {
            const branchId = branch.id;
            const dataKey = `cc_student_data_${activeSlug}_${branchId}`;
            const stored = localStorage.getItem(dataKey);
            
            const deletedKey = `cc_deleted_students_${activeSlug}_${branchId}`;
            const deletedRaw = localStorage.getItem(deletedKey);
            const parsedDeleted = deletedRaw ? JSON.parse(deletedRaw) : [];
            const deletedIds = new Set(Array.isArray(parsedDeleted) ? parsedDeleted : []);

            let branchStudents: Student[] = [];
            const isMainBranch = branchId === 'main';

            if (stored) {
                const patches = JSON.parse(stored) || {};
                if (!Array.isArray(patches)) {
                    const baseStudents = isMainBranch ? INITIAL_STUDENTS : [];
                    const merged = baseStudents.map(s => ({ ...s, ...(patches[s.id] || {}) }));
                    
                    const baseIds = new Set(baseStudents.map(s => s.id));
                    const newOnes = Object.entries(patches)
                        .map(([id, p]: [string, any]) => ({ ...(p as Student), id: p.id || id }))
                        .filter(student => !baseIds.has(student.id))
                        .map(student => student as Student);
                    
                    branchStudents = [...merged, ...newOnes];
                }
            } else if (isMainBranch) {
                branchStudents = INITIAL_STUDENTS;
            }

            // Apply branch info and filter
            branchStudents.forEach(s => {
                if (!deletedIds.has(s.id) && !seenIds.has(s.id)) {
                    allStudents.push({
                        ...s,
                        branch_id: branchId // Ensure branch info is attached
                    });
                    seenIds.add(s.id);
                }
            });
        }

        return allStudents;
    } catch (e) {
        console.error('Failed to get students from all branches', e);
        return getStudents();
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
    markLocalUpdate();
    
    triggerInstantSync();


    window.dispatchEvent(new Event('cc_student_update'));
}

export function deleteStudent(studentId: string): void {
    const patches = getStudentPatches();
    delete patches[studentId];
    localStorage.setItem(getStudentDataKey(), JSON.stringify(patches));
    markLocalUpdate();

    // Persist deletion for mock data
    const deletedKey = getDeletedStudentsKey();
    let deletedIds = [];
    try {
        const raw = localStorage.getItem(deletedKey);
        if (raw) deletedIds = JSON.parse(raw);
        if (!Array.isArray(deletedIds)) deletedIds = [];
    } catch (e) {
        deletedIds = [];
    }
    if (!deletedIds.includes(studentId)) {
        deletedIds.push(studentId);
        localStorage.setItem(deletedKey, JSON.stringify(deletedIds));
    }

    // also clear UID
    unregisterStudentUid(studentId);

    triggerInstantSync();


    // GLOBAL AUDIT LOG
    const session = typeof window !== 'undefined' ? getStaffSession() : null;
    const slug = (typeof window !== 'undefined' ? getActiveSlugLowLevel() : null) || 'demo';
    if (slug && studentId) {
        const settings = loadSettings(slug);
        const branchName = settings.branches.find(b => b.id === (settings.activeBranchId || 'main'))?.name || 'Main';

        recordAuditAction({
            action: 'student_deleted',
            details: `Student Deleted: ${studentId}`,
            studentId,
            branchId: settings.activeBranchId || 'main',
            branchName,
            performedBy: session?.staff.full_name || 'System'
        });
    }

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
    const key = getUidRegistryKey();
    localStorage.setItem(key, JSON.stringify(registry));

    triggerInstantSync();
}

/** Remove UID registration for a student (called on student delete or UID clear) */
export function unregisterStudentUid(studentId: string): void {
    const registry = getUidRegistry();
    for (const key of Object.keys(registry)) {
        if (registry[key].studentId === studentId) {
            delete registry[key];
        }
    }
    const key = getUidRegistryKey();
    localStorage.setItem(key, JSON.stringify(registry));

    triggerInstantSync();
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

// StudentPatch type is now imported from @/types

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
    const prefix = `${firstI}${lastI}`.slice(0, 2).toUpperCase();

    const allStudents = getStudents();
    
    // Generate a unique 7-digit random number
    let uniqueId = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 100) {
        const randomNum = Math.floor(1000000 + Math.random() * 9000000).toString(); // 7 digits
        uniqueId = `${prefix}${randomNum}`;
        
        // Check if this ID already exists
        const exists = allStudents.some(s => s.id === uniqueId);
        if (!exists) {
            isUnique = true;
        }
        attempts++;
    }

    return uniqueId || `${prefix}${Math.floor(Date.now() % 10000000).toString().padStart(7, '0')}`;
}
