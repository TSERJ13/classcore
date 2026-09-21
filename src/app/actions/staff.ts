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
 * UNIFIED AUTH (docs/tasks.md's "Unified Auth" phase, real Authorization
 * module PRD's core ask): a NEW staff member who gets system access
 * (email + password both supplied) now gets a real Supabase Auth account
 * instead of a cc_staff_token login — the SAME mechanism the studio owner
 * already uses, so `/login`'s existing "try staff-token, then try
 * Supabase Auth" flow (src/app/(auth)/login/page.tsx) picks them up with
 * zero changes there. Their `staff` row is keyed by that Supabase Auth
 * user's own id (not a synthetic `staff_...` string) so
 * src/lib/permissions/enforce.ts's Lock/Override lookups (which match on
 * `staff.id`) keep working identically for them. A staff member with no
 * password (no login at all) still gets a plain synthetic-id row, same as
 * always — existing staff-token accounts are entirely untouched, nothing
 * forces a migration.
 *
 * `data.authType === 'supabase'` marks a row created this way, so
 * update/delete know to also touch the linked Supabase Auth account
 * instead of the legacy password-hash column.
 *
 * SCHEMA: id, org_id, full_name, first_name, last_name, email, phone,
 * role, salary_percentage, rate_per_hour, rate_per_month, password,
 * allowed_branch_ids, data — confirmed by settings-store.ts's existing
 * syncRecordToCloud('staff', ...) payload shape and staff-login's
 * `select('*')` + direct `.password` access. Everything else (permissions,
 * photo_url, assigned_group_ids, specialty, bio, status,
 * preferred_language, authType, ...) rides in `data`, same pattern as
 * every other table in this migration.
 *
 * BRANCH ISOLATION (Phase 1, docs/tasks.md): `allowedBranchIds` already
 * existed as a UI concept (the branch-switcher/sidebar dropdown filter) —
 * 20260921_branch_isolation_phase1.sql promotes it to a real
 * `allowed_branch_ids` column (backfilled from `data.allowedBranchIds`) so
 * it can actually be filtered/validated against server-side, not just read
 * back client-side. Empty array keeps its existing meaning: unrestricted.
 * A branch-restricted caller (Administrator scoped to one branch, say)
 * must not be able to grant a staff member wider branch access than their
 * own — assertCanGrantBranches() below enforces that on create/update,
 * whenever `allowedBranchIds` is the field actually being changed.
 *
 * Deliberately NOT enforced (Phase 1 scope): whether the caller has any
 * branch overlap with the row they're editing/deleting in the first place.
 * A first attempt at this rejected almost every ordinary edit — the
 * migration backfills allowed_branch_ids to '{}' (unrestricted) for nearly
 * every existing staff row, so "the target's scope must be a subset of the
 * caller's own" failed for routine changes (name, phone, assigned groups)
 * that have nothing to do with branches. Properly scoping "can a
 * branch-restricted Administrator manage a colleague outside their branch
 * at all" is a real RBAC question (overlap vs. subset, does role tier
 * matter, ...) that deserves its own explicit decision, not a side effect
 * of this migration — left open.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requireEffectivePermission, resolveCallerBranchIds } from '@/lib/permissions/enforce';
import { assertBranchAccess } from '@/lib/server-actions-auth';
import { hashPassword } from '@/lib/password-hash';
import { validatePasswordPolicy } from '@/lib/password-policy';
import { ROLE_DEFAULT_PERMISSIONS, resolveRoleTier } from '@/lib/permissions/role-defaults';

/**
 * A restricted caller can only grant OTHER staff a branch scope that's a
 * non-empty subset of their own — never wider (an empty/unrestricted
 * target list would mean "all branches", broader than what the caller
 * themselves can see) and never a branch outside their own list.
 * Unrestricted callers (empty own list) can grant anything.
 */
function assertCanGrantBranches(callerAllowedBranchIds: string[], targetAllowedBranchIds: string[] | undefined): void {
    if (callerAllowedBranchIds.length === 0) return;
    if (!targetAllowedBranchIds || targetAllowedBranchIds.length === 0) {
        throw new Error('You can only assign branches you yourself have access to');
    }
    assertBranchAccess(callerAllowedBranchIds, targetAllowedBranchIds);
}

function adminAuthClient() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
    );
}

async function getStudioInfo(orgId: string, admin: ReturnType<typeof adminAuthClient>) {
    const { data } = await admin.from('studios').select('studio_slug, studio_name').eq('org_id', orgId).maybeSingle();
    return data;
}

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
    allowedBranchIds: z.array(z.string()).optional(),
}).passthrough();

function resolveFullName(input: { full_name?: string; first_name?: string; last_name?: string }): string {
    return input.full_name || `${input.first_name || ''} ${input.last_name || ''}`.trim();
}

export async function createStaffAction(rawInput: unknown): Promise<{ id: string }> {
    const input = staffSchema.parse(rawInput);
    const ctx = await requireEffectivePermission('canViewTeachers');
    const { orgId, client: supabase } = ctx;
    const callerAllowedBranchIds = await resolveCallerBranchIds(ctx);
    // Not specified at all -> default to the caller's own scope rather than
    // rejecting outright; a restricted caller who forgets to set this
    // shouldn't be blocked, but their new staff member shouldn't silently
    // end up broader (unrestricted) than the person who created them either.
    const allowedBranchIds = input.allowedBranchIds !== undefined ? input.allowedBranchIds : callerAllowedBranchIds;
    assertCanGrantBranches(callerAllowedBranchIds, allowedBranchIds);

    const fullName = resolveFullName(input);
    assertPasswordPolicy(input.password);

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

    let id: string;
    let hashedPassword: string | null = null;
    let authType: 'supabase' | undefined;

    if (input.password && input.email) {
        const admin = adminAuthClient();
        const studio = await getStudioInfo(orgId, admin);
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
            email: input.email,
            password: input.password,
            email_confirm: true,
            user_metadata: {
                first_name: input.first_name, last_name: input.last_name,
                studio_name: studio?.studio_name, studio_slug: studio?.studio_slug,
                phone: input.phone, org_id: orgId, role: input.role,
                permissions, is_activated: true,
            },
        });
        if (createErr || !created?.user) {
            const isDupe = /already registered|already exists/i.test(createErr?.message || '');
            throw new Error(isDupe ? 'This email is already in use by another account' : (createErr?.message || 'Failed to create the staff account'));
        }
        id = created.user.id;
        authType = 'supabase';
    } else {
        // No password (or no email) — a plain, login-less staff row, same
        // as every staff member created before Unified Auth existed.
        id = input.id || `staff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        hashedPassword = input.password ? await hashPassword(input.password) : null;
    }

    const fullRecord = {
        ...input, id, full_name: fullName, status: (input as Record<string, unknown>).status || 'active',
        password: hashedPassword ?? undefined,
        ...(permissions ? { permissions } : {}),
        ...(authType ? { authType } : {}),
        allowedBranchIds,
    };

    const { error } = await supabase.from('staff').insert({
        id, org_id: orgId, full_name: fullName, first_name: input.first_name, last_name: input.last_name,
        email: input.email || null, phone: input.phone || null, role: input.role,
        salary_percentage: input.salary_percentage ?? null, rate_per_hour: input.rate_per_hour ?? null,
        rate_per_month: input.rate_per_month ?? null, password: hashedPassword,
        allowed_branch_ids: allowedBranchIds,
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
    const ctx = await requireEffectivePermission('canViewTeachers');
    const { orgId, client: supabase } = ctx;
    const callerAllowedBranchIds = await resolveCallerBranchIds(ctx);

    const fullName = resolveFullName(input);
    const update: Record<string, unknown> = {
        full_name: fullName || undefined, first_name: input.first_name, last_name: input.last_name,
        email: input.email, phone: input.phone, role: input.role,
        salary_percentage: input.salary_percentage, rate_per_hour: input.rate_per_hour,
        rate_per_month: input.rate_per_month, data: { ...input, full_name: fullName || input.full_name },
    };

    // Only touch the real column when this edit actually mentions branch
    // access — same "don't null out what wasn't sent" care taken for
    // password below — and never let a restricted caller grant broader
    // branch access than their own.
    if (input.allowedBranchIds !== undefined) {
        assertCanGrantBranches(callerAllowedBranchIds, input.allowedBranchIds);
        update.allowed_branch_ids = input.allowedBranchIds;
    }

    if (input.password !== undefined) {
        assertPasswordPolicy(input.password || undefined);
    }

    // Unified Auth: if this row is linked to a real Supabase Auth account,
    // password/email/role/permissions changes go through the admin auth
    // API, not the legacy hash column — that column stays untouched
    // (null) for these rows since staff-login.ts never looks them up by
    // password anyway.
    const { data: existing } = await supabase.from('staff').select('data').eq('id', input.id).eq('org_id', orgId).maybeSingle();
    const isSupabaseAuth = (existing?.data as Record<string, unknown> | null)?.authType === 'supabase';

    if (isSupabaseAuth) {
        const admin = adminAuthClient();
        const metaUpdate: Record<string, unknown> = {};
        if (input.first_name !== undefined) metaUpdate.first_name = input.first_name;
        if (input.last_name !== undefined) metaUpdate.last_name = input.last_name;
        if (input.phone !== undefined) metaUpdate.phone = input.phone;
        if (input.role !== undefined) metaUpdate.role = input.role;
        const inputPermissions = (input as Record<string, unknown>).permissions;
        if (inputPermissions && typeof inputPermissions === 'object') metaUpdate.permissions = inputPermissions;

        const authUpdate: Parameters<typeof admin.auth.admin.updateUserById>[1] = {};
        if (Object.keys(metaUpdate).length > 0) authUpdate.user_metadata = metaUpdate;
        if (input.email) authUpdate.email = input.email;
        if (input.password) authUpdate.password = input.password;
        if (Object.keys(authUpdate).length > 0) {
            const { error: authErr } = await admin.auth.admin.updateUserById(input.id, authUpdate);
            if (authErr) throw new Error(authErr.message);
        }
    } else if (input.password !== undefined) {
        // Only touch the legacy hash when a password was actually
        // supplied — an edit form that doesn't show/change the password
        // field must not null it out. Never write it as plaintext.
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

    const { data: existing } = await supabase.from('staff').select('data').eq('id', id).eq('org_id', orgId).maybeSingle();
    const isSupabaseAuth = (existing?.data as Record<string, unknown> | null)?.authType === 'supabase';

    const { error } = await supabase.from('staff').delete().eq('id', id).eq('org_id', orgId);
    if (error) throw new Error(error.message);

    if (isSupabaseAuth) {
        // Best-effort — an orphaned Supabase Auth account with no `staff`
        // row is inert (nothing in the app treats it as a member of this
        // org without one), so a failure here doesn't need to block or
        // undo the staff deletion above.
        await adminAuthClient().auth.admin.deleteUser(id).catch(() => {});
    }

    revalidatePath('/teachers');
    revalidatePath('/settings');
    revalidatePath('/profile');
}
