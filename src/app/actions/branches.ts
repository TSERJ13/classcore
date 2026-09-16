'use server';

/**
 * Server Actions for Branches — see docs/architecture-migration.md §11.
 *
 * Unlike every other table in this migration, `branches` had full CRUD RLS
 * ready (confirmed: it's in 20260915_phase0_rls_gapfill.sql's table array)
 * but NOTHING actually wrote real rows into it — branch data has lived
 * entirely in the `studio_settings.settings.branches` JSONB blob
 * (StudioContext.tsx's addBranch/updateBranch/removeBranch only ever call
 * updateSettings()/saveSettings(), which folds `branches` into the settings
 * blob pushed via pushFullStudioMetadata — no `syncRecordToCloud('branches',
 * ...)` call exists anywhere, unlike Staff/Halls which already had one).
 * So this isn't "port the existing real-table write path to RLS" like
 * those two modules — it's activating a real table that was previously
 * inert. Wired additively into StudioContext.tsx (writes to both the real
 * table AND the settings blob) rather than replacing the blob path, since
 * every branch READ (BranchSwitcher, Sidebar, the profile page's branches
 * tab, staff `allowedBranchIds` scoping) still reads `settings.branches`
 * and isn't migrating this pass.
 *
 * SCHEMA: `id, org_id, name, address, data` — `address` is a real top-level
 * column here (confirmed via /api/sync/bulk's MINIMAL_COLUMNS allowlist),
 * not just inside `data` like everywhere else.
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

const branchSchema = z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1),
    address: z.string().optional(),
}).passthrough();

export async function createBranchAction(rawInput: unknown): Promise<void> {
    const input = branchSchema.parse(rawInput);
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    const { error } = await supabase.from('branches').insert({
        id: input.id, org_id: orgId, name: input.name, address: input.address || null, data: input,
    });
    if (error) throw new Error(error.message);
    revalidatePath('/profile');
}

export async function updateBranchAction(rawInput: unknown): Promise<void> {
    const input = branchSchema.parse(rawInput);
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    const { error } = await supabase.from('branches')
        .update({ name: input.name, address: input.address || null, data: input })
        .eq('id', input.id).eq('org_id', orgId);
    if (error) throw new Error(error.message);
    revalidatePath('/profile');
}

const deleteBranchSchema = z.object({ id: z.string().min(1) });

export async function deleteBranchAction(rawInput: unknown): Promise<void> {
    const { id } = deleteBranchSchema.parse(rawInput);
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    const { error } = await supabase.from('branches').delete().eq('id', id).eq('org_id', orgId);
    if (error) throw new Error(error.message);
    revalidatePath('/profile');
}
