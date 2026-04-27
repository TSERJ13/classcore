/**
 * trash-store.ts
 * Manages deleted items with a 30-day retention policy.
 */
import { getScopedKey, getActiveSlug } from './utils';
import { triggerInstantSync } from './sync-store';
import { syncRecordToCloud, deleteRecordFromCloud } from './master-sync';
import { loadSettings } from './settings-store';

export interface TrashItem {
    id: string;
    type: 'student' | 'teacher' | 'subscription' | 'group';
    data: any;
    branchId: string;
    deletedAt: string;
    expiresAt: string;
}

const TRASH_KEY = 'cc_global_trash';
const RETENTION_DAYS = 30;

export function getTrash(): TrashItem[] {
    if (typeof window === 'undefined') return [];
    try {
        const key = getScopedKey(TRASH_KEY);
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
}

export function moveToTrash(type: TrashItem['type'], data: any, branchId: string) {
    if (typeof window === 'undefined') return;
    try {
        const trash = getTrash();
        const deletedAt = new Date();
        const expiresAt = new Date();
        expiresAt.setDate(deletedAt.getDate() + RETENTION_DAYS);

        const newItem: TrashItem = {
            id: `trash_${type}_${data.id || Date.now()}`,
            type,
            data,
            branchId,
            deletedAt: deletedAt.toISOString(),
            expiresAt: expiresAt.toISOString()
        };

        const updated = [newItem, ...trash];
        localStorage.setItem(getScopedKey(TRASH_KEY), JSON.stringify(updated));
        
        // Cloud sync
        const activeSlug = getActiveSlug() || '';
        const settings = loadSettings(activeSlug);
        const orgId = settings.orgId || (typeof window !== 'undefined' ? localStorage.getItem(`cc_org_id_override_${activeSlug}`) || localStorage.getItem(`cc_org_id_${activeSlug}`) : null);
        if (orgId && orgId !== 'demo') {
            syncRecordToCloud('trash', {
                id: newItem.id,
                org_id: orgId,
                type: newItem.type,
                data: newItem.data,
                branch_id: newItem.branchId,
                deleted_at: newItem.deletedAt,
                expires_at: newItem.expiresAt
            }, orgId);
        }

        triggerInstantSync();
        window.dispatchEvent(new Event('cc_trash_update'));
    } catch (e) {
        console.error('Moving to trash failed:', e);
    }
}

export function removeFromTrash(id: string) {
    if (typeof window === 'undefined') return;
    const trash = getTrash().filter(item => item.id !== id);
    localStorage.setItem(getScopedKey(TRASH_KEY), JSON.stringify(trash));
    
    // Cloud delete
    const activeSlug = getActiveSlug() || '';
    const settings = loadSettings(activeSlug);
    const orgId = settings.orgId || (typeof window !== 'undefined' ? localStorage.getItem(`cc_org_id_override_${activeSlug}`) || localStorage.getItem(`cc_org_id_${activeSlug}`) : null);
    if (orgId && orgId !== 'demo') {
        deleteRecordFromCloud('trash', id, orgId);
    }

    triggerInstantSync();
    window.dispatchEvent(new Event('cc_trash_update'));
}

export function clearTrash() {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getScopedKey(TRASH_KEY), JSON.stringify([]));
    triggerInstantSync();
    window.dispatchEvent(new Event('cc_trash_update'));
}

export function cleanupOldTrash() {
    if (typeof window === 'undefined') return;
    const trash = getTrash();
    const now = new Date();
    const filtered = trash.filter(item => new Date(item.expiresAt) > now);
    if (filtered.length !== trash.length) {
        localStorage.setItem(getScopedKey(TRASH_KEY), JSON.stringify(filtered));
        
        triggerInstantSync();
        window.dispatchEvent(new Event('cc_trash_update'));
    }
}
