/**
 * hall-rental-store.ts
 * Persists hall-rental bookings (Subscriptions PRD §8) to localStorage,
 * mirroring plan-store.ts's persistence pattern. Previously this page kept
 * everything in a bare useState(MOCK_RENTALS) — nothing survived a refresh.
 */

import type { HallRental } from '@/types';

import { getScopedKey, markLocalUpdate, getActiveSlug, getEffectiveOrgId, getLocallyDeletedIds, addLocallyDeletedId } from './utils';
import { loadSettings } from './settings-store';
import { triggerInstantSync } from './sync-store';
import { syncRecordToCloud } from './master-sync';

const BASE_RENTALS_KEY = 'cc_hall_rentals';
function getRentalsKey(slug?: string) {
    const s = slug || getActiveSlug() || 'demo.classcore.ge';
    return getScopedKey(BASE_RENTALS_KEY, s);
}

const BASE_DELETED_RENTALS_KEY = 'cc_deleted_hall_rentals';
function getDeletedRentalsKey() {
    return getScopedKey(BASE_DELETED_RENTALS_KEY);
}

let _rentalsMemoryCache: HallRental[] | null = null;
let _rentalsMemoryCacheSlug: string | null = null;

export function getRentals(): HallRental[] {
    if (typeof window === 'undefined') return [];
    try {
        const activeSlug = getActiveSlug() || 'demo.classcore.ge';
        const key = getRentalsKey(activeSlug);
        const saved = localStorage.getItem(key);
        const deletedIds = getLocallyDeletedIds(getDeletedRentalsKey());

        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                const filtered = parsed.filter((r: HallRental) => !r?.id || !deletedIds.has(r.id));
                _rentalsMemoryCache = filtered;
                _rentalsMemoryCacheSlug = activeSlug;
                return filtered;
            }
        }

        if (_rentalsMemoryCache && _rentalsMemoryCacheSlug === activeSlug) {
            return _rentalsMemoryCache.filter((r: HallRental) => !r?.id || !deletedIds.has(r.id));
        }
        return [];
    } catch {
        return [];
    }
}

export async function saveRentals(rentals: HallRental[]): Promise<void> {
    if (typeof window === 'undefined') return;
    const activeSlug = getActiveSlug() || 'demo.classcore.ge';
    const key = getRentalsKey(activeSlug);

    _rentalsMemoryCache = rentals;
    _rentalsMemoryCacheSlug = activeSlug;
    try {
        localStorage.setItem(key, JSON.stringify(rentals));
    } catch (e) {
        console.error('❌ [HallRentalStore] localStorage write failed (falling back to memory cache):', e);
    }
    markLocalUpdate();

    const settings = loadSettings(activeSlug);
    const orgId = getEffectiveOrgId(activeSlug);

    if (orgId && orgId !== 'demo') {
        for (const rental of rentals) {
            try {
                await syncRecordToCloud('hall_rentals', {
                    id: rental.id,
                    org_id: orgId,
                    data: rental,
                }, orgId);
            } catch (err) {
                console.warn('⚠️ [HallRentalStore] Individual rental sync failed:', err);
            }
        }

        // 🔥 Schema-less fallback: full list into the settings blob, same
        // pattern as subscription_plans — survives even if the dedicated
        // hall_rentals table/columns don't exist yet on this org's schema.
        const nextSettings = { ...settings, hall_rentals: rentals };
        const { saveSettings } = await import('./settings-store');
        saveSettings(nextSettings, settings, activeSlug);
    }

    window.dispatchEvent(new Event('cc_hall_rentals_update'));
    triggerInstantSync();
}

export async function deleteRental(id: string): Promise<void> {
    addLocallyDeletedId(getDeletedRentalsKey(), id);
    const rentals = getRentals();
    const next = rentals.filter(r => r.id !== id);
    const activeSlug = getActiveSlug() || 'demo.classcore.ge';
    const key = getRentalsKey(activeSlug);

    _rentalsMemoryCache = next;
    _rentalsMemoryCacheSlug = activeSlug;
    try {
        localStorage.setItem(key, JSON.stringify(next));
    } catch (e) {
        console.error('❌ [HallRentalStore] localStorage write failed on delete:', e);
    }
    markLocalUpdate();

    const settings = loadSettings(activeSlug);
    const orgId = getEffectiveOrgId(activeSlug);
    if (orgId && orgId !== 'demo') {
        import('./master-sync').then(({ deleteRecordFromCloud }) => {
            deleteRecordFromCloud('hall_rentals', id, orgId);
        });
        import('./settings-store').then(({ saveSettings }) => {
            const nextSettings = { ...settings, hall_rentals: next };
            saveSettings(nextSettings, settings, activeSlug);
        });
    }

    window.dispatchEvent(new Event('cc_hall_rentals_update'));
    triggerInstantSync();
}
