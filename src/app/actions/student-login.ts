'use server';

/**
 * Student portal login (docs/tasks.md's "Student portal" phase). Per the
 * user: the login identity is the parent's email (the `email` field
 * already on the `students` table — real top-level column, confirmed via
 * /api/sync/bulk's MINIMAL_COLUMNS map), and a separate password is
 * assigned to the student directly (mirrors TeacherModal's "System
 * Access" path — an admin sets credentials on the student's behalf,
 * there's no self-service invite-by-email step here).
 *
 * Uses the same Unified Auth mechanism as Teacher/Administrator accounts
 * (docs/tasks.md's Unified Auth phase): a real Supabase Auth account,
 * `user_metadata.role = 'student'` + `student_id`. Deliberately does NOT
 * repoint `students.id` at the new Auth account's id — unlike a
 * newly-created teacher, a student commonly already has years of
 * subscription/attendance/sales history keyed by their existing id, and
 * migrating that would be exactly the high-risk mass-migration this whole
 * approach was chosen to avoid. The link is stored instead as
 * `students.data.authUserId`, and `src/app/[studio]/[studentId]/page.tsx`
 * checks `profile.student_id === studentId` (from user_metadata) to
 * authorize viewing — not `students.id` equality with anything Auth-side.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requireEffectivePermission } from '@/lib/permissions/enforce';
import { validatePasswordPolicy } from '@/lib/password-policy';

function adminAuthClient() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
    );
}

const createLoginSchema = z.object({ studentId: z.string().min(1), password: z.string().min(1) });

export async function createStudentLoginAction(rawInput: unknown): Promise<void> {
    const input = createLoginSchema.parse(rawInput);
    const passwordCheck = validatePasswordPolicy(input.password);
    if (!passwordCheck.valid) throw new Error(`Password does not meet the minimum requirements (${passwordCheck.reason})`);

    const { orgId } = await requireEffectivePermission('canViewStudents');
    const admin = adminAuthClient();

    const { data: student, error: studentErr } = await admin
        .from('students')
        .select('id, email, first_name, last_name, full_name, data')
        .eq('id', input.studentId).eq('org_id', orgId)
        .maybeSingle();
    if (studentErr) throw new Error(studentErr.message);
    if (!student) throw new Error('Student not found');
    if (!student.email) throw new Error('This student has no email on file — add the parent\'s email first');

    const existingData = (student.data as Record<string, unknown> | null) || {};
    if (existingData.authUserId) throw new Error('This student already has portal access — remove it first to reassign');

    const { data: studio } = await admin.from('studios').select('studio_slug, studio_name').eq('org_id', orgId).maybeSingle();

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: student.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
            role: 'student',
            student_id: input.studentId,
            org_id: orgId,
            studio_slug: studio?.studio_slug,
            studio_name: studio?.studio_name,
            full_name: student.full_name,
            is_activated: true,
        },
    });
    if (createErr || !created?.user) {
        const isDupe = /already registered|already exists/i.test(createErr?.message || '');
        throw new Error(isDupe ? 'This email is already in use by another account' : (createErr?.message || 'Failed to create the student account'));
    }

    const { error: updateErr } = await admin.from('students')
        .update({ data: { ...existingData, authUserId: created.user.id } })
        .eq('id', input.studentId).eq('org_id', orgId);
    if (updateErr) throw new Error(updateErr.message);

    revalidatePath('/students');
}

const revokeLoginSchema = z.object({ studentId: z.string().min(1) });

export async function revokeStudentLoginAction(rawInput: unknown): Promise<void> {
    const input = revokeLoginSchema.parse(rawInput);
    const { orgId } = await requireEffectivePermission('canViewStudents');
    const admin = adminAuthClient();

    const { data: student, error: studentErr } = await admin
        .from('students')
        .select('data')
        .eq('id', input.studentId).eq('org_id', orgId)
        .maybeSingle();
    if (studentErr) throw new Error(studentErr.message);
    const existingData = (student?.data as Record<string, unknown> | null) || {};
    const authUserId = existingData.authUserId as string | undefined;
    if (!authUserId) return;

    await admin.auth.admin.deleteUser(authUserId).catch(() => {});

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { authUserId: _drop, ...rest } = existingData;
    const { error: updateErr } = await admin.from('students')
        .update({ data: rest })
        .eq('id', input.studentId).eq('org_id', orgId);
    if (updateErr) throw new Error(updateErr.message);

    revalidatePath('/students');
}
