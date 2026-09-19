'use server';

/**
 * Server Actions for Shop Products — replaces product-store.ts's
 * localStorage write path (saveProducts/deleteProduct). See
 * docs/architecture-migration.md §13. Uses the same dual-auth helper as
 * sales.ts and for the same reason: a teacher's quick-sell in the
 * attendance drawer decrements product quantity via this same write path,
 * with no Supabase Auth session.
 *
 * SCHEMA: `id, org_id, name, price, category, data` — confirmed via
 * /api/sync/bulk's MINIMAL_COLUMNS map. product-store.ts's own
 * syncRecordToCloud('products', ...) payload additionally sends quantity/
 * size/weight/photo_url/is_active/created_at as top-level keys, which are
 * NOT real columns per that map — kept those inside `data` only here
 * rather than repeating that risk (same PGRST204-class issue documented
 * for `students`).
 *
 * MUTATIONS use requireEffectivePermission('canViewShop') — matches
 * sales.ts's reasoning. Deliberately NOT the finer `manageInventory` flag
 * registry.ts maps `shop.manage_inventory` to: a teacher's attendance-page
 * quick-sell writes through this SAME whole-array saveProductsAction to
 * decrement stock (see the file header note in the git history for
 * `sellProductAction`'s inventory fix), so gating on `manageInventory`
 * (false by default for Teacher) would break quick-sell for every teacher
 * who can otherwise use the Shop. `canViewShop` is the flag that actually
 * governs both call sites today.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOrgIdDualAuth } from '@/lib/server-actions-auth';
import { requireEffectivePermission } from '@/lib/permissions/enforce';

export type ProductRow = { id: string; name: string; [key: string]: unknown };

export async function getProductsAction(): Promise<ProductRow[]> {
    const { orgId, client } = await requireOrgIdDualAuth();
    const { data, error } = await client.from('products').select('id, name, price, category, data').eq('org_id', orgId);
    if (error) throw new Error(error.message);
    return (data ?? []).map(p => ({ ...(p.data as Record<string, unknown> || {}), id: p.id, name: p.name }));
}

const productSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1) }).passthrough();
const saveProductsSchema = z.array(productSchema);

/** Whole-array replace, matching product-store.ts's saveProducts() contract exactly. */
export async function saveProductsAction(rawInput: unknown): Promise<void> {
    const products = saveProductsSchema.parse(rawInput);
    const { orgId, client } = await requireEffectivePermission('canViewShop');

    const { data: existingRows, error: fetchErr } = await client.from('products').select('id').eq('org_id', orgId);
    if (fetchErr) throw new Error(fetchErr.message);

    const incomingIds = new Set(products.map(p => p.id));
    const toDelete = (existingRows ?? []).map(r => r.id).filter(id => !incomingIds.has(id));
    if (toDelete.length > 0) {
        const { error } = await client.from('products').delete().eq('org_id', orgId).in('id', toDelete);
        if (error) throw new Error(error.message);
    }

    if (products.length > 0) {
        const { error } = await client.from('products').upsert(
            products.map(p => ({
                id: p.id, org_id: orgId, name: p.name,
                price: typeof p.price === 'number' ? p.price : null,
                category: typeof p.category === 'string' ? p.category : null,
                data: p,
            })),
            { onConflict: 'id' },
        );
        if (error) throw new Error(error.message);
    }

    revalidatePath('/shop');
}

const deleteProductSchema = z.object({ id: z.string().min(1) });

export async function deleteProductAction(rawInput: unknown): Promise<void> {
    const { id } = deleteProductSchema.parse(rawInput);
    const { orgId, client } = await requireEffectivePermission('canViewShop');

    const { error } = await client.from('products').delete().eq('id', id).eq('org_id', orgId);
    if (error) throw new Error(error.message);

    revalidatePath('/shop');
}
