'use server';

/**
 * Server Actions for Halls (/halls) — replaces hall-store.ts's
 * saveHalls()/deleteHall() write path. See
 * docs/architecture-migration.md §11.
 *
 * `halls` already had full CRUD RLS (in the phase-0 gapfill migration's
 * table array) and hall-store.ts already dual-wrote to the real table
 * (pushCollectionToCloud) — this is a conventional "port existing plumbing
 * to RLS" job, same shape as Groups.
 *
 * hall-store.ts never had a per-row upsert — halls/page.tsx always builds
 * the whole array and calls saveHalls(fullArray) for both create and edit.
 * Kept that same whole-array-replace contract here (saveHallsAction)
 * rather than inventing a new per-row API the page wasn't built around —
 * same reasoning as Plans' savePlansAction.
 *
 * SCHEMA: `id, org_id, name, data` — capacity/color/description/
 * sq_meters/photo_url/is_active/max_parallel_individual all live in `data`.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function requireOrgId(): Promise<{ orgId: string }> {
    const supabase = await createClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) throw new Error('Not authenticated');

    const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', userData.user.id)
        .maybeSingle();
    if (profileErr || !profile?.org_id) throw new Error('No org for this user');

    return { orgId: profile.org_id };
}

export type HallRow = { id: string; name: string; [key: string]: unknown };

export async function getHallsAction(): Promise<HallRow[]> {
    const { orgId } = await requireOrgId();
    const supabase = await createClient();
    const { data, error } = await supabase.from('halls').select('id, name, data').eq('org_id', orgId);
    if (error) throw new Error(error.message);
    return (data ?? []).map(h => ({ ...(h.data as Record<string, unknown> || {}), id: h.id, name: h.name }));
}

const hallSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1) }).passthrough();
const saveHallsSchema = z.array(hallSchema);

/** Whole-array replace, matching hall-store.ts's saveHalls() contract exactly. */
export async function saveHallsAction(rawInput: unknown): Promise<void> {
    const halls = saveHallsSchema.parse(rawInput);
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    const { data: existingRows, error: fetchErr } = await supabase.from('halls').select('id').eq('org_id', orgId);
    if (fetchErr) throw new Error(fetchErr.message);

    const incomingIds = new Set(halls.map(h => h.id));
    const toDelete = (existingRows ?? []).map(r => r.id).filter(id => !incomingIds.has(id));
    if (toDelete.length > 0) {
        const { error } = await supabase.from('halls').delete().eq('org_id', orgId).in('id', toDelete);
        if (error) throw new Error(error.message);
    }

    if (halls.length > 0) {
        const { error } = await supabase.from('halls')
            .upsert(halls.map(h => ({ id: h.id, org_id: orgId, name: h.name, data: h })), { onConflict: 'id' });
        if (error) throw new Error(error.message);
    }

    revalidatePath('/halls');
}

const deleteHallSchema = z.object({ id: z.string().min(1) });

export async function deleteHallAction(rawInput: unknown): Promise<void> {
    const { id } = deleteHallSchema.parse(rawInput);
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    const { error } = await supabase.from('halls').delete().eq('id', id).eq('org_id', orgId);
    if (error) throw new Error(error.message);

    revalidatePath('/halls');
}
