/**
 * Branches business logic — extracted out of src/app/actions/branches.ts so
 * it has no framework coupling (no 'use server', no next/cache) and can be
 * called from something other than a Server Action later (a REST route for
 * the native mobile/desktop app) without duplicating the Supabase calls.
 *
 * Auth/permission checking (requireStudioManager()) stays in the Server
 * Action wrapper — it's inherently tied to the Next.js request context
 * (cookies) and a REST route would resolve its caller differently (bearer
 * token, not cookies), so it doesn't belong in this framework-agnostic layer.
 * This file only takes the already-authenticated `{ client, orgId }` and
 * does the actual read/write.
 *
 * SCHEMA: `id, org_id, name, address, data` — `address` is a real top-level
 * column here (confirmed via /api/sync/bulk's MINIMAL_COLUMNS allowlist),
 * not just inside `data` like everywhere else.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const branchSchema = z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1),
    address: z.string().optional(),
}).passthrough();

export type BranchInput = z.infer<typeof branchSchema>;

export async function createBranch(client: SupabaseClient, orgId: string, rawInput: unknown): Promise<void> {
    const input = branchSchema.parse(rawInput);
    const { error } = await client.from('branches').insert({
        id: input.id, org_id: orgId, name: input.name, address: input.address || null, data: input,
    });
    if (error) throw new Error(error.message);
}

export async function updateBranch(client: SupabaseClient, orgId: string, rawInput: unknown): Promise<void> {
    const input = branchSchema.parse(rawInput);
    const { error } = await client.from('branches')
        .update({ name: input.name, address: input.address || null, data: input })
        .eq('id', input.id).eq('org_id', orgId);
    if (error) throw new Error(error.message);
}

const deleteBranchSchema = z.object({ id: z.string().min(1) });

export async function deleteBranch(client: SupabaseClient, orgId: string, rawInput: unknown): Promise<void> {
    const { id } = deleteBranchSchema.parse(rawInput);
    const { error } = await client.from('branches').delete().eq('id', id).eq('org_id', orgId);
    if (error) throw new Error(error.message);
}
