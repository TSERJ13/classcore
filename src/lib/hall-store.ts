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
    photo_url?: string;
    is_active: boolean;
}

import { getScopedKey } from './settings-store';

const BASE_HALLS_KEY = 'cc_halls';
function getHallsKey() { return getScopedKey(BASE_HALLS_KEY); }

const INITIAL_HALLS: HallData[] = [
    { id: 'h1', name: 'hallA', color: '#6366f1', capacity: 30, description: '150 კვ.მ', is_active: true },
];

export function getHalls(): HallData[] {
    if (typeof window === 'undefined') return INITIAL_HALLS;
    try {
        const activeSlug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : 'demo.classcore.ge';
        const activeBranch = typeof window !== 'undefined' ? (localStorage.getItem(`cc_active_branch_${activeSlug}`) || 'main') : 'main';
        const isMainBranch = activeBranch === 'main';

        const key = getHallsKey();
        let saved = localStorage.getItem(key);

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
        return migrated;
    } catch {
        return INITIAL_HALLS;
    }
}

export function saveHalls(halls: HallData[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getHallsKey(), JSON.stringify(halls));
}
