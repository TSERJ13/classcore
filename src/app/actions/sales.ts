'use server';

/**
 * Server Actions for Shop Sales — replaces sales-store.ts's localStorage
 * write path (recordSale/deleteSale/updateSale). See
 * docs/architecture-migration.md §13.
 *
 * Uses requireOrgIdDualAuth() (src/lib/server-actions-auth.ts), not the
 * plain auth.uid()-only requireOrgId() pattern used elsewhere in this
 * migration — a shop sale is routinely recorded by a TEACHER during their
 * own class (attendance/page.tsx's quick-sell drawer), via a cc_staff_token
 * session with no Supabase Auth/auth.uid() at all. This is the same
 * reachability problem Calendar/Events has, but Sales/Products have none
 * of Calendar's virtual-occurrence complexity, so it's safe to actually
 * close here: try real Supabase Auth first, fall back to the staff-token
 * cookie with a service-role client manually scoped to that token's org_id
 * (mirroring src/lib/sync-auth.ts's existing precedent for /api/sync/*).
 *
 * SCHEMA: `id, org_id, student_id, data` — `sales` also has real
 * `product_id`/`amount`/`date` columns per /api/sync/bulk's MINIMAL_COLUMNS
 * map, but the app's actual write path (sales-store.ts's recordSale) has
 * never populated them — only `data` reliably carries productId/quantity/
 * price/date/time. Matched that existing behavior rather than starting to
 * populate columns nothing has ever read from.
 *
 * MUTATIONS use requireEffectivePermission('canViewShop')
 * (src/lib/permissions/enforce.ts) instead of the plain requireOrgIdDualAuth()
 * — without it, a staff-token caller whose canViewShop is false (or Locked
 * off) could still record/edit/delete a sale by calling this action
 * directly, even though the Shop page and its quick-sell drawer would
 * never show them the button. Reads stay on requireOrgIdDualAuth() alone,
 * unchanged.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOrgIdDualAuth } from '@/lib/server-actions-auth';
import { requireEffectivePermission } from '@/lib/permissions/enforce';

export type SaleRow = {
    id: string;
    studentId: string;
    studentName: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    time: string;
    date: string;
};

export async function getSalesAction(): Promise<SaleRow[]> {
    const { orgId, client } = await requireOrgIdDualAuth();
    const { data, error } = await client.from('sales').select('id, data').eq('org_id', orgId);
    if (error) throw new Error(error.message);
    return (data ?? []).map(r => ({ ...(r.data as Record<string, unknown> || {}), id: r.id })) as SaleRow[];
}

const studentIdSchema = z.object({ studentId: z.string().min(1) });

export async function getStudentSalesAction(rawInput: unknown): Promise<SaleRow[]> {
    const { studentId } = studentIdSchema.parse(rawInput);
    const { orgId, client } = await requireOrgIdDualAuth();
    const { data, error } = await client.from('sales').select('id, data').eq('org_id', orgId).eq('student_id', studentId);
    if (error) throw new Error(error.message);
    return (data ?? []).map(r => ({ ...(r.data as Record<string, unknown> || {}), id: r.id })) as SaleRow[];
}

const recordSaleSchema = z.object({
    studentId: z.string().min(1),
    studentName: z.string().min(1),
    productId: z.string().min(1),
    productName: z.string().min(1),
    quantity: z.number().int().min(1),
    price: z.number().min(0),
});

export async function recordSaleAction(rawInput: unknown): Promise<SaleRow> {
    const input = recordSaleSchema.parse(rawInput);
    const { orgId, client } = await requireEffectivePermission('canViewShop');

    const now = new Date();
    const newSale: SaleRow = {
        ...input,
        id: 's' + Math.random().toString(36).substring(2, 9),
        date: now.toISOString().split('T')[0],
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const { error } = await client.from('sales').insert({ id: newSale.id, org_id: orgId, student_id: input.studentId, data: newSale });
    if (error) throw new Error(error.message);

    revalidatePath('/shop');
    return newSale;
}

const updateSaleSchema = z.object({ id: z.string().min(1) }).passthrough();

export async function updateSaleAction(rawInput: unknown): Promise<void> {
    const input = updateSaleSchema.parse(rawInput);
    const { orgId, client } = await requireEffectivePermission('canViewShop');

    const { data: existing, error: fetchErr } = await client.from('sales').select('data').eq('id', input.id).eq('org_id', orgId).maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing) throw new Error('Sale not found');

    const merged = { ...(existing.data as Record<string, unknown> || {}), ...input };
    const { error } = await client.from('sales').update({ data: merged }).eq('id', input.id).eq('org_id', orgId);
    if (error) throw new Error(error.message);

    revalidatePath('/shop');
}

const deleteSaleSchema = z.object({ id: z.string().min(1) });

export async function deleteSaleAction(rawInput: unknown): Promise<void> {
    const { id } = deleteSaleSchema.parse(rawInput);
    const { orgId, client } = await requireEffectivePermission('canViewShop');

    const { error } = await client.from('sales').delete().eq('id', id).eq('org_id', orgId);
    if (error) throw new Error(error.message);

    revalidatePath('/shop');
}
