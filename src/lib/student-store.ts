import { getScopedKey, getActiveSlug as getActiveSlugLowLevel, markLocalUpdate, recordGlobalDeletion, clearGlobalDeletion, getEffectiveOrgId } from './utils';
import { getStaffSession, loadSettings, type StaffMember } from '@/lib/settings-store';
import { triggerInstantSync } from './sync-store';
import { type Student, type StudentPatch, type Branch, type StudioSettings, type TrashItem, type SubscriptionLog } from '@/types';
import { recordAuditAction } from './audit-store';
import { deleteRecordFromCloud, syncRecordToCloud } from './master-sync';

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

// 🚀 IN-MEMORY CACHE: When localStorage is full, we still have data here
// Populated by StudioContext after cloud hydration
let _memoryStudentsCache: Record<string, Student> | null = null;
let _memoryCacheSlug: string | null = null;

export function setMemoryStudentsCache(students: Student[] | Record<string, Student>, slug: string) {
    if (Array.isArray(students)) {
        _memoryStudentsCache = students.reduce((acc, s) => {
            if (s.id) acc[s.id] = s;
            return acc;
        }, {} as Record<string, Student>);
    } else {
        _memoryStudentsCache = students;
    }
    _memoryCacheSlug = slug;
    console.log(`💾 [StudentStore] Memory cache set: ${Object.keys(_memoryStudentsCache).length} students for ${slug}`);
}

export function getMemoryStudentsCache(slug: string): Student[] | null {
    if (_memoryCacheSlug !== slug || !_memoryStudentsCache) return null;
    return Object.values(_memoryStudentsCache);
}

export function getStudents(): Student[] {
    if (typeof window === 'undefined') return INITIAL_STUDENTS;
    try {
        const activeSlug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : 'demo.classcore.ge';
        const activeBranch = typeof window !== 'undefined' ? (localStorage.getItem(`cc_active_branch_${activeSlug}`) || 'main') : 'main';
        const isMainBranch = activeBranch === 'main';

        // 🚀 MEMORY CACHE FIRST: If localStorage is full, fall back to in-memory cache
        const key = getStudentDataKey();
        let stored = localStorage.getItem(key);
        
        // If localStorage is empty for this slug, try memory cache
        if (!stored && activeSlug && _memoryCacheSlug === activeSlug && _memoryStudentsCache) {
            console.log('💾 [StudentStore] Using in-memory cache (localStorage was empty)');
            const memCache = Object.values(_memoryStudentsCache);
            // Apply branch filter
            if (activeBranch === 'all') return memCache;
            return memCache.filter(s => {
                const bId = (s as any).branch_id || 'main';
                return bId === activeBranch || bId === 'all';
            });
        }

        // Migration: If new scoped key is empty, check old unscoped key
        if (!stored && isMainBranch) {
            const oldKey = `cc_student_data_${activeSlug}`;
            const oldKeyMain = `cc_student_data_${activeSlug}_main`;
            stored = localStorage.getItem(oldKey) || localStorage.getItem(oldKeyMain);
            
            if (stored) {
                console.log('🚚 [StudentStore] Migrating legacy main branch data');
                localStorage.setItem(key, stored);
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

        if (!stored) return isMainBranch ? INITIAL_STUDENTS : [];
        let patches: any = {};
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                // If it's an array (from direct sync or legacy), convert to map
                patches = parsed.reduce((acc: any, s: any) => {
                    const id = s.id || s.studentId;
                    if (id) acc[id] = s;
                    return acc;
                }, {});
            } else {
                patches = parsed || {};
            }
        } catch (e) {
            console.error('❌ [StudentStore] Fatal: Corrupt student patches. Returning base data.', e);
            return isMainBranch ? INITIAL_STUDENTS : [];
        }

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
        
        const filtered = nonDeleted.filter(s => {
            const bId = s.branch_id || 'main'; // Fallback for legacy data
            return bId === activeBranch || bId === 'all';
        });

        // 🚨 RESILIENCE: If branch filtering results in zero students, but we have students available,
        // show everyone as a safety measure.
        if (filtered.length === 0 && nonDeleted.length > 0) {
            console.warn('⚠️ [StudentStore] Branch filter returned 0. Bypassing filter to prevent empty state.');
            return nonDeleted;
        }

        return filtered;
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
        const key = getScopedKey(BASE_STUDENT_DATA_KEY, activeSlug, 'all');
        const stored = localStorage.getItem(key);
        if (!stored) return INITIAL_STUDENTS;
        
        const parsed = JSON.parse(stored);
        let patches = {};
        if (Array.isArray(parsed)) {
            patches = parsed.reduce((acc: any, s: any) => {
                const id = s.id || s.studentId;
                if (id) acc[id] = s;
                return acc;
            }, {});
        } else {
            patches = parsed || {};
        }

        return Object.entries(patches).map(([id, p]: [string, any]) => ({
            ...(p as Student),
            id: p.id || id
        }));
    } catch (e) {
        console.error('Failed to get students from all branches', e);
        return [];
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

    try {
        localStorage.setItem(getStudentDataKey(), JSON.stringify(patches));
        markLocalUpdate();
        console.log('✅ [StudentStore] Local storage updated for:', studentId);
        
        // 🔥 NEW ATOMIC SYNC: Push this student directly to the native table
        const finalOrgId = getEffectiveOrgId(activeSlug || '');

        if (finalOrgId) {
            const studentToSync = patches[studentId];
            console.log('📡 [StudentStore] Attempting Cloud Sync for Org:', finalOrgId);
            
            syncRecordToCloud('students', {
                id: studentId,
                org_id: finalOrgId,
                first_name: studentToSync.first_name || '',
                last_name: studentToSync.last_name || '',
                full_name: studentToSync.full_name || '',
                phone: studentToSync.phone || '',
                email: studentToSync.email || '',
                data: studentToSync
            }, finalOrgId).then(success => {
                if (success) console.log('🟢 [StudentStore] Cloud Sync SUCCESS');
                else console.error('🔴 [StudentStore] Cloud Sync FAILED (Check network/permissions)');
            });
        } else {
            console.warn('⚠️ [StudentStore] No OrgID found. Skipping Cloud Sync.');
        }

        triggerInstantSync();
    } catch (e) {
        console.error('❌ [StudentStore] Fatal error during update:', e);
    }


    window.dispatchEvent(new Event('cc_student_update'));
}

export function deleteStudent(studentId: string): void {
    const patches = getStudentPatches();
    delete patches[studentId];
    localStorage.setItem(getStudentDataKey(), JSON.stringify(patches));
    markLocalUpdate();

    const slug = (typeof window !== 'undefined' ? getActiveSlugLowLevel() : null) || 'demo';
    if (slug !== 'demo') {
        const finalOrgId = getEffectiveOrgId(slug);
        const settings = loadSettings(slug);
        const branchName = settings.branches.find(b => b.id === (settings.activeBranchId || 'main'))?.name || 'Main';
        const session = typeof window !== 'undefined' ? getStaffSession() : null;

        if (finalOrgId) {
            deleteRecordFromCloud('students', studentId, finalOrgId);
        }
        
        const student = getStudents().find(s => s.id === studentId);
        const studentName = student?.full_name || studentId;

        recordGlobalDeletion(slug, 'cc_student_data', studentId, {
            ...student,
            details: studentName,
            performedBy: session?.staff.full_name || 'System',
            branchName,
            branchId: settings.activeBranchId || 'main',
            studentId,
            studentName
        });
    }

    // also clear UID
    unregisterStudentUid(studentId);
    triggerInstantSync();

    window.dispatchEvent(new Event('cc_student_update'));
}

export function checkDuplicateStudent(name: string, phone: string, birthDate?: string, excludeId?: string): Student | null {
    const all = getStudents();
    const normalizedPhone = phone.replace(/\D/g, '');

    return all.find(s => {
        if (excludeId && s.id === excludeId) return false;

        const nameMatch = name && s.full_name?.toLowerCase() === name.toLowerCase();
        const phoneMatch = phone && s.phone?.replace(/\D/g, '') === normalizedPhone;
        const birthDateMatch = birthDate && s.birth_date === birthDate;

        // A duplicate must at least have a matching name.
        // Then we check if it's the SAME person via birth date or phone.
        if (nameMatch) {
            if (birthDate && s.birth_date) {
                return birthDateMatch;
            }
            return phoneMatch;
        }

        return false;
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

export function getStudentPatches(): Record<string, Student> {
    if (typeof window === 'undefined') return {};
    try {
        const activeSlug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : 'demo.classcore.ge';
        const key = getStudentDataKey();
        let stored = localStorage.getItem(key);
        
        // 🚀 CRITICAL FIX: If localStorage is empty, check memory cache
        // Otherwise we overwrite the entire database with just ONE student when editing!
        if (!stored && activeSlug && _memoryCacheSlug === activeSlug && _memoryStudentsCache) {
            console.log('💾 [StudentStore] getStudentPatches: Using in-memory cache as base');
            return { ..._memoryStudentsCache };
        }

        const parsed = JSON.parse(stored ?? '{}');
        if (Array.isArray(parsed)) {
            return parsed.reduce((acc: any, s: any) => {
                const id = s.id || s.studentId;
                if (id) acc[id] = s;
                return acc;
            }, {});
        }
        return parsed || {};
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

export function getStudentPhoto(id: string): string | null {
    return getStudents().find(s => s.id === id)?.photo_url || null;
}

export function getStudentName(id: string): string {
    return getStudents().find(s => s.id === id)?.full_name || id;
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
