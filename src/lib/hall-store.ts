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
        const migrated = parsed;
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
    
    triggerInstantSync();

    // CLOUD SYNC: Ensure new/edited halls are pushed to Supabase
    if (typeof window !== 'undefined') {
        const activeSlug = getActiveSlug();
        const settings = loadSettings(activeSlug);
        
        // Priority orgId resolution
        const orgId = settings.orgId || 
                     localStorage.getItem(`cc_org_id_override_${activeSlug}`) || 
                     localStorage.getItem(`cc_org_id_${activeSlug}`);
                     
        const branchId = localStorage.getItem(`cc_active_branch_${activeSlug}`) || 'main';

        if (orgId && orgId !== 'demo') {
            halls.forEach(hall => {
                syncRecordToCloud('halls', {
                    id: hall.id,
                    org_id: orgId,
                    branch_id: branchId === 'main' ? null : branchId,
                    name: hall.name,
                    color: hall.color,
                    capacity: hall.capacity,
                    sq_meters: hall.sq_meters,
                    description: hall.description,
                    photo_url: hall.photo_url || '',
                    is_active: hall.is_active,
                    data: hall // Add full data blob for MasterSync unwrap parity
                }, orgId);
            });
        } else {
            console.warn('⚠️ [HallStore] Local save only. Skip cloud sync: Missing valid OrgID');
        }
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
        const activeSlug = getActiveSlug();
        const settings = loadSettings(activeSlug);
        const orgId = settings.orgId || 
                     localStorage.getItem(`cc_org_id_override_${activeSlug}`) || 
                     localStorage.getItem(`cc_org_id_${activeSlug}`);
                     
        if (activeSlug) recordGlobalDeletion(activeSlug, BASE_HALLS_KEY, id);
        
        if (orgId && orgId !== 'demo') {
            deleteRecordFromCloud('halls', id, orgId);
        }
    }

    window.dispatchEvent(new Event('cc_halls_update'));
}
