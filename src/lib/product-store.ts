/**
 * product-store.ts
 * Manages shop products with full cloud synchronization.
 */

import { Product } from '@/types';
import { getScopedKey, getActiveSlug, markLocalUpdate, getEffectiveOrgId, getLocallyDeletedIds, addLocallyDeletedId } from './utils';
import { loadSettings } from './settings-store';
import { triggerInstantSync } from './sync-store';
import { syncRecordToCloud, deleteRecordFromCloud } from './master-sync';

const BASE_PRODUCTS_KEY = 'cc_shop_products';
const BASE_DELETED_PRODUCTS_KEY = 'cc_deleted_products';
function getProductsKey(slug?: string) { return getScopedKey(BASE_PRODUCTS_KEY, slug); }
function getDeletedProductsKey() { return getScopedKey(BASE_DELETED_PRODUCTS_KEY); }

const INITIAL_PRODUCTS: Product[] = [];

export function getProducts(): Product[] {
    if (typeof window === 'undefined') return INITIAL_PRODUCTS;
    try {
        const activeSlug = getActiveSlug() || 'demo.classcore.ge';
        const key = getProductsKey(activeSlug);
        let saved = localStorage.getItem(key);

        if (!saved) return INITIAL_PRODUCTS;
        const parsed = JSON.parse(saved);
        const list = Array.isArray(parsed) ? parsed : INITIAL_PRODUCTS;
        // 🪦 Local tombstone (same mechanism as halls/groups/plans): products
        // previously had NO delete-resurrection protection at all — deleting a
        // product whose cloud delete silently failed (network blip, RLS edge
        // case — deleteRecordFromCloud()'s `.catch(() => {})` swallows it) came
        // right back on the next hydration.
        const deletedIds = getLocallyDeletedIds(getDeletedProductsKey());
        return deletedIds.size > 0 ? list.filter((p: any) => !deletedIds.has(p.id)) : list;
    } catch {
        return INITIAL_PRODUCTS;
    }
}

export async function saveProducts(products: Product[]): Promise<void> {
    if (typeof window === 'undefined') return;
    const activeSlug = getActiveSlug() || '';
    const key = getProductsKey(activeSlug);

    try {
        localStorage.setItem(key, JSON.stringify(products));
    } catch (e) {
        console.warn('[saveProducts] local write skipped (storage full) — cloud sync still runs', e);
    }
    markLocalUpdate();
    
    const settings = loadSettings(activeSlug);
    const orgId = getEffectiveOrgId(activeSlug) || settings.orgId;
    
    if (orgId && orgId !== 'demo') {
        // 1. Individual record sync (for products table)
        for (const product of products) {
            try {
                await syncRecordToCloud('products', {
                    id: product.id,
                    org_id: orgId,
                    name: product.name,
                    category: product.category,
                    price: product.price,
                    quantity: product.quantity,
                    size: product.size,
                    weight: product.weight,
                    photo_url: product.photo_url,
                    is_active: product.is_active,
                    created_at: product.created_at
                }, orgId);
            } catch (err) {
                console.warn('⚠️ [ProductStore] Individual product sync failed:', err);
            }
        }

        // 2. 🔥 FOOLPROOF SCHEMA-LESS FALLBACK: Save full list into settings blob
        const nextSettings = { ...settings, products: products };
        const { saveSettings } = await import('./settings-store');
        saveSettings(nextSettings, settings, activeSlug);
        
        const { pushFullStudioMetadata } = await import('./master-sync');
        const studioName = settings.studioName || 'Studio';
        await pushFullStudioMetadata(activeSlug, studioName, nextSettings);
    }

    // Explicit signal for UI
    window.dispatchEvent(new Event('cc_product_update'));
    triggerInstantSync();
}

export async function deleteProduct(id: string): Promise<void> {
    // 🪦 Tombstone FIRST — see getProducts().
    addLocallyDeletedId(getDeletedProductsKey(), id);

    const products = getProducts();
    const next = products.filter(p => p.id !== id);
    await saveProducts(next);

    const activeSlug = getActiveSlug() || '';
    const settings = loadSettings(activeSlug);
    const orgId = getEffectiveOrgId(activeSlug) || settings.orgId;

    if (orgId && orgId !== 'demo') {
        deleteRecordFromCloud('products', id, orgId).catch(() => {});
    }
}
