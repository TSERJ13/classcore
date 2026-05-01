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
    photo_url?: string;
    is_active: boolean;
}
import { loadSettings } from './settings-store';

import { getScopedKey, getActiveSlug, markLocalUpdate, recordGlobalDeletion } from './utils';
import { triggerInstantSync } from './sync-store';
import { syncRecordToCloud, deleteRecordFromCloud } from './master-sync';

const BASE_HALLS_KEY = 'cc_halls';
const BASE_DELETED_HALLS_KEY = 'cc_deleted_halls';
function getHallsKey() { return getScopedKey(BASE_HALLS_KEY); }
function getDeletedHallsKey() { return getScopedKey(BASE_DELETED_HALLS_KEY); }

const INITIAL_HALLS: HallData[] = [];

export function getHalls(): HallData[] {
    if (typeof window === 'undefined') return INITIAL_HALLS;
    try {
        const activeSlug = getActiveSlug() || 'demo.classcore.ge';
        const key = getHallsKey();
        let saved = localStorage.getItem(key);

        if (!saved) return INITIAL_HALLS;
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : INITIAL_HALLS;
    } catch {
        return INITIAL_HALLS;
    }
}

export function saveHalls(halls: HallData[]): void {
    if (typeof window === 'undefined') return;
    const key = getHallsKey();
    localStorage.setItem(key, JSON.stringify(halls));
    markLocalUpdate();
    
    triggerInstantSync();

    const activeSlug = getActiveSlug();
    const settings = loadSettings(activeSlug);
    const orgId = settings.orgId;
    
    if (orgId && orgId !== 'demo') {
        // 1. Full record sync
        halls.forEach(hall => {
            syncRecordToCloud('halls', {
                id: hall.id,
                org_id: orgId,
                name: hall.name,
                color: hall.color,
                capacity: hall.capacity,
                description: hall.description,
                sq_meters: hall.sq_meters,
                photo_url: hall.photo_url,
                is_active: hall.is_active
            }, orgId).catch(() => {});
        });

        // 2. 🔥 FOOLPROOF SCHEMA-LESS FALLBACK
        const updatedSettings = { ...settings, halls: halls };
        import('./settings-store').then(({ saveSettings }) => {
            saveSettings(updatedSettings, settings, activeSlug);
            import('./master-sync').then(({ pushFullStudioMetadata }) => {
                const studioName = settings.studioName || 'Studio';
                pushFullStudioMetadata(activeSlug, studioName, updatedSettings);
            });
        });
    }

    window.dispatchEvent(new Event('cc_halls_update'));
}

export function deleteHall(id: string): void {
    const halls = getHalls();
    const updated = halls.filter(h => h.id !== id);
    
    const slug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : null;
    if (slug) {
        recordGlobalDeletion(slug, 'cc_halls', id);
    }

    const key = getHallsKey();
    localStorage.setItem(key, JSON.stringify(updated));
    markLocalUpdate();

    triggerInstantSync();

    // CLOUD SYNC: Remove from Supabase
    if (typeof window !== 'undefined') {
        const activeSlug = getActiveSlug() || '';
        const settings = loadSettings(activeSlug);
        const orgId = settings.orgId || localStorage.getItem(`cc_org_id_${activeSlug}`);

        if (orgId && orgId !== 'demo') {
            deleteRecordFromCloud('halls', id, orgId).catch(() => {});

            // 🔥 FOOLPROOF SCHEMA-LESS FALLBACK: Update the settings blob too
            const updatedSettings = { ...settings, halls: updated };
            import('./settings-store').then(({ saveSettings }) => {
                saveSettings({ halls: updated } as any, settings, activeSlug);
                const studioName = (settings as any).studioName || 'Studio';
                import('./master-sync').then(({ pushFullStudioMetadata }) => {
                    pushFullStudioMetadata(activeSlug, studioName, updatedSettings);
                });
            });
        }
    }

    window.dispatchEvent(new Event('cc_halls_update'));
}
