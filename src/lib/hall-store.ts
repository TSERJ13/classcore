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

import { getScopedKey, getActiveSlug, markLocalUpdate, recordGlobalDeletion, getEffectiveOrgId, safeSetItem, getLocallyDeletedIds, addLocallyDeletedId } from './utils';
import { triggerInstantSync } from './sync-store';
import { syncRecordToCloud, deleteRecordFromCloud } from './master-sync';

const BASE_HALLS_KEY = 'cc_halls';
const BASE_DELETED_HALLS_KEY = 'cc_deleted_halls';
function getHallsKey() { return getScopedKey(BASE_HALLS_KEY); }
function getDeletedHallsKey() { return getScopedKey(BASE_DELETED_HALLS_KEY); }

const INITIAL_HALLS: HallData[] = [];

// 🚀 MEMORY CACHE: Fallback when localStorage is full
let _hallsMemoryCache: HallData[] | null = null;
let _hallsMemoryCacheSlug: string | null = null;

export function setHallsMemoryCache(halls: HallData[], slug: string) {
    _hallsMemoryCache = halls;
    _hallsMemoryCacheSlug = slug;
    console.log(`💾 [HallStore] Memory cache set: ${halls.length} halls`);
}

export function getHalls(): HallData[] {
    if (typeof window === 'undefined') return INITIAL_HALLS;
    try {
        const activeSlug = getActiveSlug() || 'demo.classcore.ge';
        if (activeSlug && activeSlug !== 'demo.classcore.ge') {
            // 🪦 Local tombstone: a background hydration can merge in a
            // slightly-stale cloud/settings-blob snapshot that raced a hall
            // delete (e.g. the cloud DELETE hadn't propagated yet, or
            // deleteRecordFromCloud failed silently — see deleteHall()'s
            // `.catch(() => {})`). Filter tombstoned ids the same way
            // student-store.ts/group-store.ts already do, so a deleted hall
            // can't resurrect without a page refresh.
            const deletedIds = getLocallyDeletedIds(getDeletedHallsKey());

            const key = getHallsKey();
            let saved = localStorage.getItem(key);

            if (saved) {
                const parsed = JSON.parse(saved);
                const list = Array.isArray(parsed) ? parsed : INITIAL_HALLS;
                return deletedIds.size > 0 ? list.filter(h => !deletedIds.has(h.id)) : list;
            }

            // 🚀 Fall back to memory cache
            if (_hallsMemoryCache && _hallsMemoryCacheSlug === activeSlug) {
                console.log('💾 [HallStore] Using memory cache');
                return deletedIds.size > 0 ? _hallsMemoryCache.filter(h => !deletedIds.has(h.id)) : _hallsMemoryCache;
            }
            return INITIAL_HALLS;
        }
        return INITIAL_HALLS;
    } catch {
        return INITIAL_HALLS;
    }
}

export function getHall(id: string): HallData | null {
    const halls = getHalls();
    return halls.find(h => h.id === id) || null;
}

export function getHallName(id?: string): string {
    if (!id || id === 'all') return '';
    const h = getHall(id);
    return h?.name || '';
}

export function saveHalls(halls: HallData[]): void {
    if (typeof window === 'undefined') return;
    const key = getHallsKey();
    const activeSlug = getActiveSlug() || 'default';
    
    // 1. Synchronous localStorage write + memory cache update
    try {
        localStorage.setItem(key, JSON.stringify(halls));
    } catch {}
    setHallsMemoryCache(halls, activeSlug);
    safeSetItem(key, JSON.stringify(halls), activeSlug);
    markLocalUpdate();
    
    window.dispatchEvent(new Event('cc_halls_update'));
    triggerInstantSync();

    const settings = loadSettings(activeSlug);
    const orgId = getEffectiveOrgId(activeSlug) || settings.orgId;
    
    if (orgId && orgId !== 'demo') {
        // 1. Dedicated Collection Sync (For high reliability)
        import('./master-sync').then(mod => {
            mod.pushCollectionToCloud('halls', halls, orgId, activeSlug);
        });

        // 2. FOOLPROOF SCHEMA-LESS FALLBACK (In settings blob)
        const updatedSettings = { ...settings, halls: halls, orgId };
        import('./settings-store').then(({ saveSettings }) => {
            saveSettings({ halls: halls } as any, settings, activeSlug);
            import('./master-sync').then(({ pushFullStudioMetadata }) => {
                const studioName = settings.studioName || 'Studio';
                pushFullStudioMetadata(activeSlug, studioName, updatedSettings);
            });
        });
    }
}

export function deleteHall(id: string): void {
    const halls = getHalls();
    const updated = halls.filter(h => h.id !== id);

    const slug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : null;
    if (slug) {
        recordGlobalDeletion(slug, 'cc_halls', id);
    }

    const key = getHallsKey();
    const activeSlug = getActiveSlug() || 'default';

    // 🪦 Tombstone this id FIRST so getHalls()'s own filter (and any
    // hydration that runs before the cloud delete below completes/succeeds)
    // can't bring it back.
    addLocallyDeletedId(getDeletedHallsKey(), id);

    // 1. Synchronous localStorage write + memory cache update
    try {
        localStorage.setItem(key, JSON.stringify(updated));
    } catch {}
    setHallsMemoryCache(updated, activeSlug);
    safeSetItem(key, JSON.stringify(updated), activeSlug);
    markLocalUpdate();

    // 2. Immediate event dispatch so all UI listeners re-render instantly
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cc_halls_update'));
    }

    triggerInstantSync();

    // 2b. 🧹 Detach this hall from any calendar events referencing it
    // (clear hall_id rather than deleting the lesson itself — a hall going
    // away shouldn't cascade-delete someone's schedule) so attendance /
    // calendar rendering never has to deal with a dangling hall_id, and
    // hall-capacity lookups (getHall(id)) don't silently point nowhere.
    if (typeof window !== 'undefined') {
        import('./event-store').then(mod => {
            mod.clearHallFromEvents(id);
        }).catch(() => {});
    }

    // 3. CLOUD SYNC: Remove from Supabase
    if (typeof window !== 'undefined') {
        const settings = loadSettings(activeSlug);
        const orgId = getEffectiveOrgId(activeSlug) || settings.orgId;

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
}
