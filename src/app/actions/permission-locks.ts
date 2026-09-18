'use server';

/**
 * Server Actions for Permission Locks (docs/permissions-module-prd.md §7).
 * Reads use the dual-auth helper — an Administrator/Teacher (staff-token,
 * no auth.uid()) needs to know if one of their own permissions is locked,
 * same reachability reasoning as Shop/Expenses. Writes are restricted to
 * Main Administrator (`owner`) only, per the PRD's direction rule ("Main
 * Administrator ბლოკავს Administrator-ს, Teacher-სა და Student-ს") — an
 * Administrator can never lock anyone, even though they can read locks
 * that apply to them.
 *
 * Scoped to per-studio locks only this phase — see the migration's own
 * header comment (20260918_permission_locks.sql) for why platform-wide
 * Super Admin locks are deferred.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOrgIdDualAuth, type DualAuthContext } from '@/lib/server-actions-auth';
import type { PermissionLock } from '@/lib/permissions/resolve';
import type { RoleTier } from '@/lib/permissions/role-defaults';

async function requireOwner(): Promise<DualAuthContext & { userId: string }> {
    const ctx = await requireOrgIdDualAuth();
    if (ctx.isStaffToken) {
        throw new Error('Only the studio\'s Main Administrator can set permission locks');
    }
    const { data: userData } = await ctx.client.auth.getUser();
    const role = userData?.user?.user_metadata?.role;
    if (role !== 'owner') {
        throw new Error('Only the studio\'s Main Administrator can set permission locks');
    }
    return { ...ctx, userId: userData!.user!.id };
}

type LockRow = { permission_id: string; locked_value: boolean; target_role: string | null; target_staff_id: string | null };

function rowToLock(r: LockRow): PermissionLock {
    return {
        permissionId: r.permission_id as PermissionLock['permissionId'],
        lockedValue: r.locked_value,
        targetRole: (r.target_role as RoleTier | null) ?? null,
        targetStaffId: r.target_staff_id,
    };
}

export async function getPermissionLocksAction(): Promise<PermissionLock[]> {
    const { orgId, client } = await requireOrgIdDualAuth();
    const { data, error } = await client
        .from('permission_locks')
        .select('permission_id, locked_value, target_role, target_staff_id')
        .eq('org_id', orgId);
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToLock);
}

const setLockSchema = z.object({
    permissionId: z.string().min(1),
    lockedValue: z.boolean(),
    targetRole: z.enum(['super_admin', 'owner', 'administrator', 'teacher']).optional(),
    targetStaffId: z.string().optional(),
}).refine(d => !!d.targetRole !== !!d.targetStaffId, { message: 'Exactly one of targetRole/targetStaffId is required' });

export async function setPermissionLockAction(rawInput: unknown): Promise<void> {
    const input = setLockSchema.parse(rawInput);
    const { orgId, userId, client } = await requireOwner();

    // Delete-then-insert rather than upsert: the two partial unique
    // indexes (one per target type) mean there's no single ON CONFLICT
    // target a plain upsert could name for both cases.
    let delQuery = client.from('permission_locks').delete().eq('org_id', orgId).eq('permission_id', input.permissionId);
    delQuery = input.targetStaffId ? delQuery.eq('target_staff_id', input.targetStaffId) : delQuery.eq('target_role', input.targetRole!);
    const { error: delErr } = await delQuery;
    if (delErr) throw new Error(delErr.message);

    const { error } = await client.from('permission_locks').insert({
        org_id: orgId,
        permission_id: input.permissionId,
        locked_value: input.lockedValue,
        target_role: input.targetRole ?? null,
        target_staff_id: input.targetStaffId ?? null,
        locked_by: userId,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/settings');
}

const clearLockSchema = z.object({
    permissionId: z.string().min(1),
    targetRole: z.enum(['super_admin', 'owner', 'administrator', 'teacher']).optional(),
    targetStaffId: z.string().optional(),
});

export async function clearPermissionLockAction(rawInput: unknown): Promise<void> {
    const input = clearLockSchema.parse(rawInput);
    const { orgId, client } = await requireOwner();

    let query = client.from('permission_locks').delete().eq('org_id', orgId).eq('permission_id', input.permissionId);
    query = input.targetStaffId ? query.eq('target_staff_id', input.targetStaffId) : query.eq('target_role', input.targetRole!);
    const { error } = await query;
    if (error) throw new Error(error.message);

    revalidatePath('/settings');
}
