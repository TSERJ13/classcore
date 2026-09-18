'use server';

/**
 * Server Actions for Staff CRUD — replaces the service-role write path
 * inside StudioContext.tsx's addStaff/updateStaff/removeStaff (which goes
 * through settings-store.ts's saveSettings() -> syncRecordToCloud('staff',
 * ...) / deleteRecordFromCloud('staff', ...), both service-role). See
 * docs/architecture-migration.md §10 for why this is scoped to writes only.
 *
 * DELIBERATELY NOT MIGRATING READS. Staff/teacher end users authenticate
 * through a completely separate system — a signed cc_staff_token HMAC
 * cookie (src/lib/staff-token.ts) — that has no Supabase Auth session and
 * no `profiles` row, so `auth.uid()` is always null for them. Every
 * already-migrated page that reads teacher/staff data for TEACHER-VISIBLE
 * purposes (attendance, groups, dashboard, students — all via
 * access.ts's getVisibleGroupIds, or teacher-store.ts's getTeachers/
 * getTeacherName/getTeacherPhoto) is viewed by teachers themselves, not
 * just owners/admins. An `auth.uid()`-gated read Server Action would
 * return "Not authenticated" for every one of those teacher sessions —
 * this migration only touches the CREATE/UPDATE/DELETE actions. Reads keep
 * coming from teacher-store.ts's local settings.staff cache, unchanged.
 *
 * WRITES use requireEffectivePermission('canViewTeachers')
 * (src/lib/permissions/enforce.ts) instead of the plain auth.uid()-only
 * requireOrgId() this file used before the Permissions module
 * (docs/permissions-module-prd.md): the Main Administrator (`owner`, the
 * only caller the old check ever let through) still always passes, but
 * this also lets the new Administrator role (staff-token,
 * `canViewTeachers: true` by default per role-defaults.ts) actually manage
 * staff — the old auth.uid()-only check silently blocked every
 * staff-token session, Administrator included.
 *
 * NOT FIXED HERE (flagged separately, see the migration's own comment):
 * src/app/api/auth/staff-login/route.ts compares `staff.password` in
 * plaintext. This file writes `password` through as given — hashing it
 * here without changing the login route's comparison would just break
 * every staff login.
 *
 * SCHEMA: id, org_id, full_name, first_name, last_name, email, phone,
 * role, salary_percentage, rate_per_hour, rate_per_month, password, data —
 * confirmed by settings-store.ts's existing syncRecordToCloud('staff', ...)
 * payload shape and staff-login's `select('*')` + direct `.password`
 * access. Everything else (permissions, photo_url, assigned_group_ids,
 * specialty, bio, allowedBranchIds, status, preferred_language, ...) rides
 * in `data`, same pattern as every other table in this migration.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireEffectivePermission } from '@/lib/permissions/enforce';
import { hashPassword } from '@/lib/password-hash';
import { validatePasswordPolicy } from '@/lib/password-policy';
import { ROLE_DEFAULT_PERMISSIONS, resolveRoleTier } from '@/lib/permissions/role-defaults';

/** docs/authorization-module.md §5 — only checked when a password is actually being set (non-empty); an edit that leaves the password field blank must not be blocked by this. */
function assertPasswordPolicy(password: string | undefined) {
    if (!password) return;
    const check = validatePasswordPolicy(password);
    if (!check.valid) throw new Error(`Password does not meet the minimum requirements (${check.reason})`);
}

const staffSchema = z.object({
    id: z.string().optional(),
    full_name: z.string().trim().min(1).optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    role: z.string().default('teacher'),
    salary_percentage: z.number().optional(),
    rate_per_hour: z.number().optional(),
    rate_per_month: z.number().optional(),
    password: z.string().optional(),
}).passthrough();

function resolveFullName(input: { full_name?: string; first_name?: string; last_name?: string }): string {
    return input.full_name || `${input.first_name || ''} ${input.last_name || ''}`.trim();
}

export async function createStaffAction(rawInput: unknown): Promise<{ id: string }> {
    const input = staffSchema.parse(rawInput);
    const { orgId, client: supabase } = await requireEffectivePermission('canViewTeachers');

    const id = input.id || `staff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullName = resolveFullName(input);
    assertPasswordPolicy(input.password);
    // Never write a plaintext password — hash it here even though the
    // login route still tolerates legacy plaintext rows (verifyPassword()).
    const hashedPassword = input.password ? await hashPassword(input.password) : null;
    // Permissions module (docs/permissions-module-prd.md §6): pre-fill role
    // defaults when the caller didn't send an explicit permissions object,
    // matching the PRD's "confirm screen shows role defaults, already
    // checked" invite UX — done at the data layer here so it holds
    // regardless of which of the 3 UI paths (TeacherModal already does its
    // own version of this client-side) created the record.
    const roleTier = resolveRoleTier(input.role, false);
    const inputPermissions = (input as Record<string, unknown>).permissions;
    const permissions = (inputPermissions && typeof inputPermissions === 'object')
        ? inputPermissions
        : (roleTier ? ROLE_DEFAULT_PERMISSIONS[roleTier] : undefined);
    const fullRecord = {
        ...input, id, full_name: fullName, status: (input as Record<string, unknown>).status || 'active',
        password: hashedPassword ?? undefined,
        ...(permissions ? { permissions } : {}),
    };

    const { error } = await supabase.from('staff').insert({
        id, org_id: orgId, full_name: fullName, first_name: input.first_name, last_name: input.last_name,
        email: input.email || null, phone: input.phone || null, role: input.role,
        salary_percentage: input.salary_percentage ?? null, rate_per_hour: input.rate_per_hour ?? null,
        rate_per_month: input.rate_per_month ?? null, password: hashedPassword,
        data: fullRecord,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/teachers');
    revalidatePath('/settings');
    revalidatePath('/profile');
    return { id };
}

const updateStaffSchema = staffSchema.extend({ id: z.string().min(1) });

export async function updateStaffAction(rawInput: unknown): Promise<void> {
    const input = updateStaffSchema.parse(rawInput);
    const { orgId, client: supabase } = await requireEffectivePermission('canViewTeachers');

    const fullName = resolveFullName(input);
    const update: Record<string, unknown> = {
        full_name: fullName || undefined, first_name: input.first_name, last_name: input.last_name,
        email: input.email, phone: input.phone, role: input.role,
        salary_percentage: input.salary_percentage, rate_per_hour: input.rate_per_hour,
        rate_per_month: input.rate_per_month, data: { ...input, full_name: fullName || input.full_name },
    };
    // Only touch password when one was actually supplied — an edit form
    // that doesn't show/change the password field must not null it out.
    // Never write it as plaintext.
    if (input.password !== undefined) {
        assertPasswordPolicy(input.password || undefined);
        const hashedPassword = input.password ? await hashPassword(input.password) : null;
        update.password = hashedPassword;
        (update.data as Record<string, unknown>).password = hashedPassword ?? undefined;
    }

    const { error } = await supabase.from('staff').update(update).eq('id', input.id).eq('org_id', orgId);
    if (error) throw new Error(error.message);

    revalidatePath('/teachers');
    revalidatePath('/settings');
    revalidatePath('/profile');
}

const deleteStaffSchema = z.object({ id: z.string().min(1) });

export async function deleteStaffAction(rawInput: unknown): Promise<void> {
    const { id } = deleteStaffSchema.parse(rawInput);
    const { orgId, client: supabase } = await requireEffectivePermission('canViewTeachers');

    const { error } = await supabase.from('staff').delete().eq('id', id).eq('org_id', orgId);
    if (error) throw new Error(error.message);

    revalidatePath('/teachers');
    revalidatePath('/settings');
    revalidatePath('/profile');
}
