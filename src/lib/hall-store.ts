/**
 * hall-store.ts
 * Manages studio halls - shared across Calendar, Attendance, and Halls pages.
 */

export interface HallData {
    id: string;
    name: string;
    color: string;
    capacity?: number;
    description?: string;
    sq_meters?: number;
    is_active: boolean;
}

import { getScopedKey, getActiveSlug, markLocalUpdate } from './utils';

const BASE_HALLS_KEY = 'cc_halls';
const BASE_DELETED_HALLS_KEY = 'cc_deleted_halls';
function getHallsKey() { return getScopedKey(BASE_HALLS_KEY); }
function getDeletedHallsKey() { return getScopedKey(BASE_DELETED_HALLS_KEY); }

const INITIAL_HALLS: HallData[] = [];

export function getHalls(): HallData[] {
    if (typeof window === 'undefined') return INITIAL_HALLS;
    try {
        const activeSlug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : 'demo.classcore.ge';
        const activeBranch = typeof window !== 'undefined' ? (localStorage.getItem(`cc_active_branch_${activeSlug}`) || 'main') : 'main';
        const isMainBranch = activeBranch === 'main';

        const key = getHallsKey();
        let saved = localStorage.getItem(key);

        const deletedKey = getDeletedHallsKey();
        let deletedIds = new Set<string>();
        try {
            const rawDeleted = localStorage.getItem(deletedKey);
            if (rawDeleted) {
                const parsed = JSON.parse(rawDeleted);
                if (Array.isArray(parsed)) deletedIds = new Set(parsed);
            }
        } catch {}

        // Migration: If new scoped key is empty, check old unscoped key
        if (!saved && isMainBranch) {
            const oldKey = `cc_halls_${activeSlug}`;
            saved = localStorage.getItem(oldKey);
            if (saved) {
                console.log('🚚 [HallStore] Migrating legacy main branch data');
                localStorage.setItem(key, saved);
            }
        }

        if (!saved) {
            const data = isMainBranch ? INITIAL_HALLS : [];
            if (isMainBranch) localStorage.setItem(key, JSON.stringify(data));
            return data;
        }
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return INITIAL_HALLS;
        let needsSave = false;
        const migrated = parsed.map((h: any) => {
            if (h.name === 'დარბაზი A') { h.name = 'hallA'; needsSave = true; }
            if (h.name === 'დარბაზი B') { h.name = 'hallB'; needsSave = true; }
            if (h.name === 'სტუდია') { h.name = 'hallStudio'; needsSave = true; }
            return h;
        });
        if (needsSave) localStorage.setItem(getHallsKey(), JSON.stringify(migrated));
        return migrated.filter(h => !deletedIds.has(h.id));
    } catch {
        return INITIAL_HALLS;
    }
}

export function saveHalls(halls: HallData[]): void {
    if (typeof window === 'undefined') return;
    const key = getHallsKey();
    localStorage.setItem(key, JSON.stringify(halls));
    markLocalUpdate();
    
    // Immediate Cloud Sync
    const activeSlug = localStorage.getItem('cc_active_studio_slug');
    if (activeSlug) {
        import('./settings-store').then(({ syncStudioDataToCloud }) => {
            syncStudioDataToCloud(activeSlug, { [key]: halls });
        });
    }


    window.dispatchEvent(new Event('cc_halls_update'));
}

export function deleteHall(id: string): void {
    const halls = getHalls();
    const updated = halls.filter(h => h.id !== id);
    
    // Persist deletion for tombstone
    const deletedKey = getDeletedHallsKey();
    let deletedIds: string[] = [];
    try {
        const raw = localStorage.getItem(deletedKey);
        if (raw) deletedIds = JSON.parse(raw);
        if (!Array.isArray(deletedIds)) deletedIds = [];
    } catch {}
    
    if (!deletedIds.includes(id)) {
        deletedIds.push(id);
        localStorage.setItem(deletedKey, JSON.stringify(deletedIds));
    }

    const key = getHallsKey();
    localStorage.setItem(key, JSON.stringify(updated));
    markLocalUpdate();

    // Immediate Cloud Sync
    const activeSlug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : null;
    if (activeSlug && activeSlug !== 'demo.classcore.ge') {
        import('./settings-store').then(({ syncStudioDataToCloud }) => {
            syncStudioDataToCloud(activeSlug, { 
                [key]: updated,
                [deletedKey]: deletedIds
            });
        });
    }


    window.dispatchEvent(new Event('cc_halls_update'));
}
