/**
 * teacher-store.ts
 * Centralized store for teacher data, now proxying to settings.staff as the source of truth.
 */
import type { Teacher } from '@/types';
import { loadSettings, saveSettings, type StaffMember } from './settings-store';

import { getActiveSlug, getEffectiveOrgId } from './utils';
import { deleteRecordFromCloud } from './master-sync';

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
        const activeSlug = getActiveSlug() || 'demo.classcore.ge';
        if (activeSlug && _teachersMemoryCache && _teachersMemoryCacheSlug === activeSlug) {
            return _teachersMemoryCache;
        }
        
        const settings = loadSettings(activeSlug);
        return (settings.staff || []) as unknown as Teacher[];
    } catch {
        return INITIAL_TEACHERS;
    }
}

export function saveTeachers(teachers: Teacher[]) {
    if (typeof window === 'undefined') return;
    try {
        const activeSlug = getActiveSlug() || 'default';
        saveSettings({ staff: teachers as unknown as StaffMember[] }, undefined, activeSlug);
        window.dispatchEvent(new CustomEvent('cc_teacher_update'));
    } catch (err: any) {
        console.error('Storage failed:', err);
    }
}

export function getTeacher(id: string | undefined): Teacher | null {
    const teachers = getTeachers();
    return teachers.find(t => t.id === id) || null;
}

export function getTeacherName(id: string | undefined): string {
    const t = getTeacher(id);
    if (!t) return '';
    return t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.email || '';
}

export function getTeacherPhoto(id: string | undefined): string | null {
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
    const activeSlug = getActiveSlug() || 'default';
    const settings = loadSettings(activeSlug);
    const list = settings.staff || [];
    const idx = list.findIndex(t => t.id === id);
    if (idx > -1) {
        list[idx] = { ...list[idx], ...data } as any;
        saveSettings({ staff: list }, settings, activeSlug);
        window.dispatchEvent(new CustomEvent('cc_teacher_update'));
    }
}

export function deleteTeacher(id: string) {
    const activeSlug = getActiveSlug() || 'default';
    const settings = loadSettings(activeSlug);
    const list = settings.staff || [];
    const filtered = list.filter(t => t.id !== id);
    saveSettings({ staff: filtered }, settings, activeSlug);
    
    const orgId = getEffectiveOrgId(activeSlug) || settings.orgId;
    if (orgId && orgId !== 'demo') {
        deleteRecordFromCloud('staff', id, orgId).catch(() => {});
    }

    window.dispatchEvent(new CustomEvent('cc_teacher_update'));
}

