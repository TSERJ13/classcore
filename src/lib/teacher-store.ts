/**
 * teacher-store.ts
 * Centralized store for teacher data, now proxying to settings.staff as the source of truth.
 */
import type { Teacher } from '@/types';
import { loadSettings, saveSettings, type StaffMember } from './settings-store';

const INITIAL_TEACHERS: Teacher[] = [];

// 🚀 MEMORY CACHE: Fallback when localStorage is full
let _teachersMemoryCache: Teacher[] | null = null;
let _teachersMemoryCacheSlug: string | null = null;

export function setTeachersMemoryCache(teachers: Teacher[], slug: string) {
    _teachersMemoryCache = teachers;
    _teachersMemoryCacheSlug = slug;
}

export function getTeachers(): Teacher[] {
    if (typeof window === 'undefined') return INITIAL_TEACHERS;
    try {
        const activeSlug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : 'demo.classcore.ge';
        if (activeSlug && _teachersMemoryCache && _teachersMemoryCacheSlug === activeSlug) {
            return _teachersMemoryCache;
        }
        
        const settings = loadSettings();
        return (settings.staff || []) as unknown as Teacher[];
    } catch {
        return INITIAL_TEACHERS;
    }
}

export function saveTeachers(teachers: Teacher[]) {
    if (typeof window === 'undefined') return;
    try {
        saveSettings({ staff: teachers as unknown as StaffMember[] });
        window.dispatchEvent(new CustomEvent('cc_teacher_update'));
    } catch (err: any) {
        console.error('Storage failed:', err);
    }
}

export function getTeacher(id: string): Teacher | null {
    const teachers = getTeachers();
    return teachers.find(t => t.id === id) || null;
}

export function getTeacherName(id: string): string {
    const t = getTeacher(id);
    if (!t) return '';
    return t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.email || '';
}

export function getTeacherPhoto(id: string): string | null {
    const t = getTeacher(id);
    return t?.photo_url || null;
}

export function getTeacherById(id: string): Teacher | null {
    return getTeachers().find(t => t.id === id) || null;
}

export function getAllTeachersRaw(): Teacher[] {
    return getTeachers();
}

export function updateTeacher(id: string, data: Partial<Teacher>) {
    const settings = loadSettings();
    const list = settings.staff || [];
    const idx = list.findIndex(t => t.id === id);
    if (idx > -1) {
        list[idx] = { ...list[idx], ...data } as any;
        saveSettings({ staff: list });
        window.dispatchEvent(new CustomEvent('cc_teacher_update'));
    }
}

export function deleteTeacher(id: string) {
    const settings = loadSettings();
    const list = settings.staff || [];
    const filtered = list.filter(t => t.id !== id);
    saveSettings({ staff: filtered });
    window.dispatchEvent(new CustomEvent('cc_teacher_update'));
}

