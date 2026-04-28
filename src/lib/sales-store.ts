/**
 * sales-store.ts
 * Manages shop sales history linked to students.
 */

export interface ShopSale {
    id: string;
    studentId: string;
    studentName: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    time: string;
    date: string;
}

import { getScopedKey, getActiveSlug, markLocalUpdate } from './utils';
import { loadSettings, saveSettings } from './settings-store';
import { syncRecordToCloud, deleteRecordFromCloud, pushFullStudioMetadata } from './master-sync';

const BASE_SALES_KEY = 'cc_shop_sales';
function getSalesKey() { return getScopedKey(BASE_SALES_KEY); }

export function getSales(): ShopSale[] {
    if (typeof window === 'undefined') return [];
    try {
        const key = getSalesKey();
        let saved = localStorage.getItem(key);

        const activeSlug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : 'demo.classcore.ge';
        const activeBranch = typeof window !== 'undefined' ? (localStorage.getItem(`cc_active_branch_${activeSlug}`) || 'main') : 'main';
        const isMainBranch = activeBranch === 'main';

        const parsed = JSON.parse(saved || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function getStudentSales(studentId: string): ShopSale[] {
    return getSales().filter(s => s.studentId === studentId);
}

export function recordSale(sale: Omit<ShopSale, 'id' | 'date' | 'time'>) {
    const now = new Date();
    const newSale: ShopSale = {
        ...sale,
        id: 's' + Math.random().toString(36).substring(2, 9),
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const existing = getSales();
    localStorage.setItem(getSalesKey(), JSON.stringify([newSale, ...existing]));
    markLocalUpdate();
    
    const activeSlug = getActiveSlug();
    const settings = loadSettings(activeSlug || '');
    const orgId = settings.orgId || localStorage.getItem(`cc_org_id_${activeSlug}`);
    
    if (orgId && orgId !== 'demo') {
        const fullList = [newSale, ...existing];
        syncRecordToCloud('sales', {
            id: newSale.id,
            org_id: orgId,
            student_id: sale.studentId,
            data: newSale
        }, orgId).catch(() => {});

        // Sync backup blob
        const updatedSettings = { ...settings, sales: fullList };
        saveSettings({ sales: fullList } as any, settings, activeSlug || '');
        const studioName = (settings as any).studioName || 'Studio';
        pushFullStudioMetadata(activeSlug || '', studioName, updatedSettings);
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_shop_update'));
    return newSale;
}

export function deleteSale(id: string) {
    const existing = getSales();
    const updated = existing.filter(s => s.id !== id);
    localStorage.setItem(getSalesKey(), JSON.stringify(updated));
    markLocalUpdate();
    
    const activeSlug = getActiveSlug();
    const settings = loadSettings(activeSlug || '');
    const orgId = settings.orgId || localStorage.getItem(`cc_org_id_${activeSlug}`);
    
    if (orgId && orgId !== 'demo') {
        deleteRecordFromCloud('sales', id, orgId).catch(() => {});

        // Sync backup blob
        const updatedSettings = { ...settings, sales: updated };
        saveSettings({ sales: updated } as any, settings, activeSlug || '');
        const studioName = (settings as any).studioName || 'Studio';
        pushFullStudioMetadata(activeSlug || '', studioName, updatedSettings);
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_shop_update'));
}

export function updateSale(id: string, data: Partial<ShopSale>) {
    const existing = getSales();
    const updated = existing.map(s => s.id === id ? { ...s, ...data } : s);
    localStorage.setItem(getSalesKey(), JSON.stringify(updated));
    markLocalUpdate();
    
    const activeSlug = getActiveSlug();
    if (activeSlug && activeSlug !== 'demo.classcore.ge') {
        pushStudioStateToCloud(activeSlug, [], { [getSalesKey()]: updated });
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_shop_update'));
}
