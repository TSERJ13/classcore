'use server';

/**
 * Server Actions for the Groups module (/groups) — replaces group-store.ts's
 * localStorage write path (createGroup/saveGroups/deleteGroup) for the
 * Groups management page. See docs/architecture-migration.md §9.
 *
 * Scoped to this page's own CRUD only. `group-store.ts` itself is NOT
 * removed — calendar/page.tsx still writes to it directly (createGroup,
 * addSlotToGroup/removeSlotFromGroup to keep a group's schedule_slots in
 * sync with recurring calendar events, and a color patch), and every
 * read-only consumer (attendance, dashboard, analytics, teachers,
 * subscriptions' plan/issue pickers, StudentModal, the public student page,
 * Header search, ManualSmsModal, onboarding) still reads getGroups()'s
 * local cache. Calendar/Events is its own not-yet-migrated module — folding
 * its group-writing side effects in here would be scope creep this pass
 * isn't taking on. Those reads stay eventually-consistent the same way
 * Plans do: StudioContext's background hydration keeps the local cache
 * synced with whatever this module (or calendar) writes to the real table.
 *
 * `groups` table already had full CRUD RLS from
 * 20260915_phase0_rls_gapfill.sql (confirmed: `groups` — the live table
 * name, not the older hardening migration's `groups_classes` — is in that
 * migration's table array) — no new RLS migration needed for this module.
 *
 * SCHEMA: `id, org_id, name, data (JSONB)` — same pattern as every other
 * table in this migration; capacity/type/difficulty/hall_id/color/
 * teacherId/secondaryTeacherId/schedule_slots/etc. all live in `data`,
 * matching group-store.ts's saveGroups() (which pushes the whole Group
 * object into `data` alongside `id`/`name`).
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

export type GroupRow = {
    id: string;
    name: string;
    teacherId?: string;
    secondaryTeacherId?: string;
    enrolled?: number;
    [key: string]: unknown;
};

/** Same query shape as students.ts's getGroupsForOrg() — kept independent (not imported cross-file) so each Server Action module owns its own reads, matching this migration's established style. */
export async function getGroupsAction(): Promise<GroupRow[]> {
    await requireOrgId();
    const supabase = await createClient();
    const { data, error } = await supabase.from('groups').select('id, name, data').order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map(g => ({ ...(g.data as Record<string, unknown> || {}), id: g.id, name: g.name }));
}

const groupSchema = z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1),
    capacity: z.number().int().min(1).default(15),
    type: z.string().default('Dance'),
}).passthrough();

/**
 * GroupModal already generates a client-side id (`g_${Date.now()}`) before
 * calling onSave, and separately uses that SAME id to sync the group's
 * schedule to real calendar events (syncGroupScheduleToCalendar, called
 * right after onSave — see event-store.ts). So this has to persist the
 * client-supplied id verbatim rather than minting its own, or the group row
 * and its already-created calendar events would end up under two different
 * ids. Only falls back to generating one if a caller genuinely didn't send
 * one.
 */
export async function createGroupAction(rawInput: unknown): Promise<{ id: string }> {
    const input = groupSchema.parse(rawInput);
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    const id = input.id || `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullRecord = { ...input, id, enrolled: 0 };

    const { error } = await supabase.from('groups').insert({ id, org_id: orgId, name: input.name, data: fullRecord });
    if (error) throw new Error(error.message);

    revalidatePath('/groups');
    return { id };
}

const updateGroupSchema = z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1),
}).passthrough();

export async function updateGroupAction(rawInput: unknown): Promise<void> {
    const input = updateGroupSchema.parse(rawInput);
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    const { error } = await supabase.from('groups')
        .update({ name: input.name, data: input })
        .eq('id', input.id).eq('org_id', orgId);
    if (error) throw new Error(error.message);

    revalidatePath('/groups');
}

const deleteGroupSchema = z.object({ id: z.string().min(1) });

export async function deleteGroupAction(rawInput: unknown): Promise<void> {
    const { id } = deleteGroupSchema.parse(rawInput);
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    const { error } = await supabase.from('groups').delete().eq('id', id).eq('org_id', orgId);
    if (error) throw new Error(error.message);

    revalidatePath('/groups');
}
