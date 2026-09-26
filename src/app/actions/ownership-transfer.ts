'use server';

/**
 * Main Administrator status transfer (docs/authorization-module.md §7):
 * "მთავარ ადმინისტრატორს შეუძლია საკუთარი სტატუსის გადაცემა ... სხვა,
 * უკვე არსებულ ადმინისტრატორზე ... ყოფილი მთავარი ადმინისტრატორი
 * ინარჩუნებს ჩვეულებრივი ადმინისტრატორის სტატუსს, ახალი მთავარი
 * ადმინისტრატორი კი იღებს სრულ იერარქიულ პრიორიტეტს."
 *
 * The architectural wrinkle this runs into: Main Administrator === a real
 * Supabase Auth user with role 'owner' (the only role that mechanism
 * carries in this codebase); the Administrator role this session's
 * Permissions module built is staff-token-based, with no Supabase Auth
 * account at all. So "transfer to an existing Administrator" necessarily
 * means minting them a brand-new Supabase Auth account (confirmed with
 * the user — same email as their existing `staff` row) — there is no way
 * to "promote" a staff-token session into a real one in place. Their
 * existing staff-token login is left untouched; going forward they'd use
 * the new Supabase Auth credentials to act as Main Administrator.
 *
 * The outgoing owner keeps logging in with their EXISTING Supabase Auth
 * email/password — only their `user_metadata.role` changes to
 * 'administrator'. useUser.tsx's real-Auth branch was updated alongside
 * this action to compute real effective permissions for a non-owner-tier
 * Supabase Auth session, since before this every real-Auth login always
 * bypassed PermissionGuard entirely.
 */

import { z } from 'zod';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createSSRClient } from '@/lib/supabase/server';

function adminClient() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
    );
}

async function requireMainAdministrator() {
    const supabase = await createSSRClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('Not authenticated');
    const role = userData.user.user_metadata?.role;
    if (role !== 'owner') throw new Error('Only the studio\'s current Main Administrator can transfer this status');
    return userData.user;
}

const transferSchema = z.object({
    targetStaffId: z.string().min(1),
    /** Client-supplied window.location.origin — same convention as staff-invites.ts's createStaffInviteAction, since this route has no request origin of its own. */
    origin: z.string().optional(),
});

export async function transferMainAdministratorAction(rawInput: unknown): Promise<{ newOwnerEmail: string }> {
    const input = transferSchema.parse(rawInput);
    const currentOwner = await requireMainAdministrator();
    const admin = adminClient();

    const meta = currentOwner.user_metadata || {};
    const studioSlug: string | undefined = meta.studio_slug;
    if (!studioSlug) throw new Error('Could not resolve this studio');

    const { data: studio } = await admin.from('studios').select('org_id, studio_name').eq('studio_slug', studioSlug).maybeSingle();
    if (!studio?.org_id) throw new Error('Studio not found');
    const orgId = studio.org_id as string;

    const { data: targetStaff, error: staffErr } = await admin
        .from('staff')
        .select('id, org_id, email, first_name, last_name, phone, role')
        .eq('id', input.targetStaffId).eq('org_id', orgId)
        .maybeSingle();
    if (staffErr) throw new Error(staffErr.message);
    if (!targetStaff) throw new Error('Staff member not found');
    if (targetStaff.role !== 'administrator') throw new Error('Main Administrator status can only be transferred to an existing Administrator');
    if (!targetStaff.email) throw new Error('This Administrator has no email on file — add one before transferring');

    // Random, never-shown password — the new owner sets their own via the
    // password-reset email sent right after this, same mechanism
    // forgot-password/page.tsx already uses for every owner login.
    const tempPassword = crypto.randomBytes(24).toString('base64url');

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: targetStaff.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
            first_name: targetStaff.first_name,
            last_name: targetStaff.last_name,
            studio_name: studio.studio_name,
            studio_slug: studioSlug,
            phone: targetStaff.phone,
            org_id: orgId,
            role: 'owner',
            is_activated: true,
        },
    });
    if (createErr || !created?.user) {
        const isDupe = /already registered|already exists/i.test(createErr?.message || '');
        throw new Error(isDupe ? 'This email already has a Main Administrator account (possibly from a previous transfer)' : (createErr?.message || 'Failed to create the new Main Administrator account'));
    }

    // Downgrade the outgoing owner — they keep their existing login, only
    // the role metadata changes.
    const { error: downgradeErr } = await admin.auth.admin.updateUserById(currentOwner.id, {
        user_metadata: { ...meta, role: 'administrator' },
    });
    if (downgradeErr) throw new Error(downgradeErr.message);

    const newOwnerInfo = {
        first_name: targetStaff.first_name, last_name: targetStaff.last_name,
        full_name: `${targetStaff.first_name || ''} ${targetStaff.last_name || ''}`.trim(),
        email: targetStaff.email, phone: targetStaff.phone,
    };
    await admin.from('studios').update({ owner_info: newOwnerInfo }).eq('org_id', orgId);

    // profiles.id is the real primary key (equal to the auth user's own id —
    // requireOrgId()/requireOrgIdDualAuth() resolve org_id via `.eq('id',
    // authUser.id)`); there is no unique constraint on `email` at all, so an
    // onConflict:'email' upsert without `id` silently failed here exactly
    // like it did in register-studio's own upsert (see that file's fix).
    const { error: newProfileErr } = await admin.from('profiles').upsert({
        id: created.user.id,
        org_id: orgId, email: (targetStaff.email as string).toLowerCase().trim(), role: 'owner',
        first_name: targetStaff.first_name, last_name: targetStaff.last_name,
        full_name: newOwnerInfo.full_name, phone: targetStaff.phone,
    }, { onConflict: 'id' });
    if (newProfileErr) throw new Error(newProfileErr.message);
    if (currentOwner.id) {
        const { error: downgradeProfileErr } = await admin.from('profiles').update({ role: 'administrator' }).eq('id', currentOwner.id);
        if (downgradeProfileErr) throw new Error(downgradeProfileErr.message);
    }

    // Send the new owner their "set your password" link via the same
    // built-in Supabase Auth email flow forgot-password/page.tsx uses —
    // not the SERVICE_ROLE client (resetPasswordForEmail is a public,
    // anon-key call).
    const anon = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await anon.auth.resetPasswordForEmail(targetStaff.email, {
        redirectTo: `${input.origin || 'https://classcore.ge'}/reset-password`,
    });

    revalidatePath('/settings');
    return { newOwnerEmail: targetStaff.email as string };
}
