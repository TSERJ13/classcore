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

import { getScopedKey, markLocalUpdate } from './utils';

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
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_shop_update'));
    return newSale;
}

export function deleteSale(id: string) {
    const existing = getSales();
    localStorage.setItem(getSalesKey(), JSON.stringify(existing.filter(s => s.id !== id)));
    markLocalUpdate();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_shop_update'));
}

export function updateSale(id: string, data: Partial<ShopSale>) {
    const existing = getSales();
    const updated = existing.map(s => s.id === id ? { ...s, ...data } : s);
    localStorage.setItem(getSalesKey(), JSON.stringify(updated));
    markLocalUpdate();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_shop_update'));
}
