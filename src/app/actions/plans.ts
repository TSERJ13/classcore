'use server';

/**
 * Server Actions for tariff Plans (/subscriptions/plans) — replaces
 * plan-store.ts's getPlans()/savePlans()/deletePlan() write path. See
 * docs/architecture-migration.md §8.
 *
 * `subscription_plans` schema: kept to `id, org_id, data` here (same
 * defensive reasoning as subscriptions.ts) even though plan-store.ts's old
 * cloud payload also included a bunch of top-level columns (name, price,
 * type, ...) — those may or may not be real columns on the live table, and
 * `data` is guaranteed to hold the full Plan object either way.
 *
 * plan-store.ts never had a per-row upsert — every save always replaced the
 * caller's entire Plan array. Keeping that same whole-array contract here
 * (savePlansAction) rather than inventing a new per-row API the existing
 * /subscriptions/plans page wasn't built around.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOrgIdDualAuth } from '@/lib/server-actions-auth';

export type PlanRow = { id: string; [key: string]: unknown };

export async function getPlansAction(): Promise<PlanRow[]> {
    const { orgId, client: supabase } = await requireOrgIdDualAuth();
    const { data, error } = await supabase.from('subscription_plans').select('id, data').eq('org_id', orgId);
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map(r => {
        const item = (r.data as Record<string, unknown> || {});
        const migratedType = item.type === 'group' && item.period && item.period !== 'monthly' ? 'personal' : item.type;
        return { ...item, id: r.id, type: migratedType };
    });
    return rows.sort((a: any, b: any) => String(a.name || '').toLowerCase().localeCompare(String(b.name || '').toLowerCase()));
}

const planSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['group', 'personal', 'individual', 'rental']),
    period: z.enum(['sessions', 'monthly', 'unlimited']),
    price: z.number(),
}).passthrough();

const savePlansSchema = z.array(planSchema);

/** Whole-array replace, matching plan-store.ts's savePlans() contract exactly. */
export async function savePlansAction(rawInput: unknown): Promise<void> {
    const plans = savePlansSchema.parse(rawInput);
    const { orgId, client: supabase } = await requireOrgIdDualAuth();

    const { data: existingRows, error: fetchErr } = await supabase
        .from('subscription_plans').select('id').eq('org_id', orgId);
    if (fetchErr) throw new Error(fetchErr.message);

    const incomingIds = new Set(plans.map(p => p.id));
    const toDelete = (existingRows ?? []).map(r => r.id).filter(id => !incomingIds.has(id));

    if (toDelete.length > 0) {
        const { error } = await supabase.from('subscription_plans').delete().eq('org_id', orgId).in('id', toDelete);
        if (error) throw new Error(error.message);
    }

    if (plans.length > 0) {
        const { error } = await supabase.from('subscription_plans')
            .upsert(plans.map(p => ({ id: p.id, org_id: orgId, data: p })), { onConflict: 'id' });
        if (error) throw new Error(error.message);
    }

    revalidatePath('/subscriptions/plans');
}

const deletePlanSchema = z.object({ id: z.string().min(1) });

export async function deletePlanAction(rawInput: unknown): Promise<void> {
    const { id } = deletePlanSchema.parse(rawInput);
    const { orgId, client: supabase } = await requireOrgIdDualAuth();

    const { error } = await supabase.from('subscription_plans').delete().eq('id', id).eq('org_id', orgId);
    if (error) throw new Error(error.message);

    revalidatePath('/subscriptions/plans');
}
