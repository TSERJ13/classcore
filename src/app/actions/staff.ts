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
 * this migration only touches the CREATE/UPDATE/DELETE actions, which in
 * every real UI (`/teachers`, `/settings`'s Staff Access section,
 * `/profile`'s Team tab) are only ever invoked by an owner/admin/manager
 * who did authenticate through real Supabase Auth. Reads keep coming from
 * teacher-store.ts's local settings.staff cache, unchanged.
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
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    const id = input.id || `staff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullName = resolveFullName(input);
    const fullRecord = { ...input, id, full_name: fullName, status: (input as Record<string, unknown>).status || 'active' };

    const { error } = await supabase.from('staff').insert({
        id, org_id: orgId, full_name: fullName, first_name: input.first_name, last_name: input.last_name,
        email: input.email || null, phone: input.phone || null, role: input.role,
        salary_percentage: input.salary_percentage ?? null, rate_per_hour: input.rate_per_hour ?? null,
        rate_per_month: input.rate_per_month ?? null, password: input.password ?? null,
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
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    const fullName = resolveFullName(input);
    const update: Record<string, unknown> = {
        full_name: fullName || undefined, first_name: input.first_name, last_name: input.last_name,
        email: input.email, phone: input.phone, role: input.role,
        salary_percentage: input.salary_percentage, rate_per_hour: input.rate_per_hour,
        rate_per_month: input.rate_per_month, data: { ...input, full_name: fullName || input.full_name },
    };
    // Only touch password when one was actually supplied — an edit form
    // that doesn't show/change the password field must not null it out.
    if (input.password !== undefined) update.password = input.password;

    const { error } = await supabase.from('staff').update(update).eq('id', input.id).eq('org_id', orgId);
    if (error) throw new Error(error.message);

    revalidatePath('/teachers');
    revalidatePath('/settings');
    revalidatePath('/profile');
}

const deleteStaffSchema = z.object({ id: z.string().min(1) });

export async function deleteStaffAction(rawInput: unknown): Promise<void> {
    const { id } = deleteStaffSchema.parse(rawInput);
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    const { error } = await supabase.from('staff').delete().eq('id', id).eq('org_id', orgId);
    if (error) throw new Error(error.message);

    revalidatePath('/teachers');
    revalidatePath('/settings');
    revalidatePath('/profile');
}
