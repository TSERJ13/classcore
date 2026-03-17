/**
 * teacher-store.ts
 * Centralized store for teacher data.
 */
import type { Teacher } from '@/types';

import { getScopedKey } from './settings-store';

const BASE_TEACHERS_KEY = 'cc_teachers';
function getTeachersKey() { return getScopedKey(BASE_TEACHERS_KEY); }

const INITIAL_TEACHERS: Teacher[] = [
    {
        id: 't1', org_id: 'demo', first_name: 'ნინო', last_name: 'ბერიძე', full_name: 'ნინო ბერიძე', phone: '577 11 22 33', email: 'nino@studio.ge',
        specialty: ['Contemporary', 'Jazz'], bio: 'GITIS კურსდამთავრებული, 8 წლის გამოცდილება.',
        rate_per_hour: 50, rate_per_month: 1200,
        assigned_group_ids: ['g1'], assigned_individual: true, status: 'active', created_at: '2025-09-01',
    }
];

export function getTeachers(): Teacher[] {
    if (typeof window === 'undefined') return INITIAL_TEACHERS;
    try {
        const activeSlug = localStorage.getItem('cc_active_studio_slug') || 'demo.classcore.ge';
        const activeBranchId = localStorage.getItem(`cc_active_branch_${activeSlug}`) || 'main';
        const isMainBranch = activeBranchId === 'main';

        const key = getTeachersKey();
        let saved = localStorage.getItem(key);

        // Migration: If new scoped key is empty, check old unscoped key
        if (!saved && isMainBranch) {
            const oldKey = `${BASE_TEACHERS_KEY}_${activeSlug}`;
            saved = localStorage.getItem(oldKey);
            if (saved) {
                console.log('🚚 [TeacherStore] Migrating legacy main branch data');
                localStorage.setItem(key, saved);
            }
        }

        if (!saved) return isMainBranch ? INITIAL_TEACHERS : [];
        let list: Teacher[] = JSON.parse(saved);
        return Array.isArray(list) ? list : (isMainBranch ? INITIAL_TEACHERS : []);
    } catch {
        return INITIAL_TEACHERS;
    }
}


export function saveTeachers(teachers: Teacher[]) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(getTeachersKey(), JSON.stringify(teachers));
    } catch (err: any) {
        console.error('Storage failed:', err);
        if (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            alert('მეხსიერება გაივსო! (Storage Quota Exceeded)\n\nგთხოვთ გამოიყენოთ ფოტოების ლინკები (URLs) ან წაშალოთ ძველი მონაცემები.');
        }
    }
}

export function getTeacherById(id: string): Teacher | null {
    return getTeachers().find(t => t.id === id) || null;
}

export function getTeacherName(id?: string): string {
    if (!id) return '';
    const t = getTeacherById(id);
    if (!t) return id;
    if (t.first_name || t.last_name) return `${t.first_name || ''} ${t.last_name || ''}`.trim();
    return t.full_name || id;
}
export function getAllTeachersRaw(): Teacher[] {
    if (typeof window === 'undefined') return INITIAL_TEACHERS;
    try {
        const key = getTeachersKey();
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : INITIAL_TEACHERS;
    } catch { return INITIAL_TEACHERS; }
}

export function updateTeacher(id: string, data: Partial<Teacher>) {
    const list = getAllTeachersRaw();
    const idx = list.findIndex(t => t.id === id);
    if (idx > -1) {
        list[idx] = { ...list[idx], ...data };
        saveTeachers(list);
        window.dispatchEvent(new CustomEvent('cc_teacher_update'));
    }
}

export function deleteTeacher(id: string) {
    const list = getAllTeachersRaw().filter(t => t.id !== id);
    saveTeachers(list);
    window.dispatchEvent(new CustomEvent('cc_teacher_update'));
}

