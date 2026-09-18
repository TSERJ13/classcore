'use server';

/**
 * Teacher invite-by-email flow (docs/authorization-module.md §8, path
 * "(ა) მოწვევა") — an admin sends an invite; the teacher fills their own
 * profile via a public claim link (no session, the token itself is the
 * credential); the admin then reviews the submitted info + a permissions
 * list (pre-filled with the role's defaults) on a confirmation screen
 * before the real `staff` row is created. This is genuinely new — the
 * only staff-creation path that existed before this was "(ბ) ხელით
 * შევსება" (TeacherModal.tsx, admin fills the fields directly).
 *
 * UNIFIED AUTH: submitStaffInviteAction creates the teacher's real
 * Supabase Auth account immediately (Supabase owns the password from that
 * moment on — this app never stores it), but deliberately without a role
 * in user_metadata, so they can authenticate but have zero effective
 * permissions until confirmStaffInviteAction grants one. This makes the
 * "admin must confirm" step a real access gate, not just a UI formality.
 *
 * SCHEMA: supabase/migrations/20260918_staff_invites.sql.
 */

import { z } from 'zod';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requireEffectivePermission } from '@/lib/permissions/enforce';
import { validatePasswordPolicy } from '@/lib/password-policy';
import { ROLE_DEFAULT_PERMISSIONS, resolveRoleTier } from '@/lib/permissions/role-defaults';
import { sendEmail } from '@/lib/smtp';

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days to claim the invite — unrelated to session TTL

function adminClient() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
    );
}

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

const MESSAGES: Record<string, { subject: string; heading: string; body: (studio: string) => string; button: string }> = {
    ka: {
        subject: 'ClassCore — მოწვევა',
        heading: 'მოგესალმებით ClassCore-ზე!',
        body: (studio) => `გეპატიჟებით სტუდიაში "${studio}" — გთხოვთ შეავსოთ თქვენი პროფილი ქვემოთ მოცემულ ბმულზე.`,
        button: 'პროფილის შევსება',
    },
    ru: {
        subject: 'ClassCore — Приглашение',
        heading: 'Добро пожаловать в ClassCore!',
        body: (studio) => `Вас приглашают в студию «${studio}» — пожалуйста, заполните свой профиль по ссылке ниже.`,
        button: 'Заполнить профиль',
    },
    en: {
        subject: 'ClassCore — Invitation',
        heading: 'Welcome to ClassCore!',
        body: (studio) => `You've been invited to join "${studio}" — please fill in your profile using the link below.`,
        button: 'Fill in your profile',
    },
};

async function sendInviteEmail(email: string, studioName: string, claimUrl: string, lang: string) {
    const msgs = MESSAGES[lang] || MESSAGES.ka;
    const smtpConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: true,
        auth: { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' },
    };
    const html = `
        <!DOCTYPE html><html><head><style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; padding: 40px; border: 1px solid #f1f5f9; border-radius: 24px; background: #ffffff; }
            h1 { color: #0f172a; text-align: center; font-size: 24px; font-weight: 900; margin-bottom: 20px; }
            p { font-size: 16px; color: #64748b; margin-bottom: 20px; text-align: center; }
            .button-container { text-align: center; margin: 40px 0; }
            .button { background-color: #4f46e5; color: #ffffff !important; padding: 16px 40px; text-decoration: none; border-radius: 16px; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; }
        </style></head><body>
            <div class="container">
                <h1>${msgs.heading}</h1>
                <p>${msgs.body(studioName)}</p>
                <div class="button-container"><a href="${claimUrl}" class="button">${msgs.button}</a></div>
                <p style="font-size: 11px; word-break: break-all; opacity: 0.7;">${claimUrl}</p>
            </div>
        </body></html>`;
    await sendEmail(smtpConfig, {
        from: `"ClassCore" <${smtpConfig.auth.user}>`,
        to: email,
        subject: msgs.subject,
        text: `${msgs.heading}\n${msgs.body(studioName)}\n${claimUrl}`,
        html,
    });
}

export type StaffInviteRow = {
    id: string;
    email: string;
    role: string;
    status: 'pending' | 'submitted' | 'confirmed' | 'revoked';
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    created_at: string;
    submitted_at: string | null;
};

const createInviteSchema = z.object({
    email: z.string().email(),
    role: z.string().default('teacher'),
    lang: z.string().optional(),
    /** Client-supplied window.location.origin — mirrors settings/page.tsx's registration-link pattern; this route has no request origin of its own to build an absolute claim URL from. */
    origin: z.string().optional(),
});

export async function createStaffInviteAction(rawInput: unknown): Promise<{ id: string }> {
    const input = createInviteSchema.parse(rawInput);
    const { orgId } = await requireEffectivePermission('canViewTeachers');
    const admin = adminClient();

    const { data: studio } = await admin.from('studios').select('studio_name, studio_slug').eq('org_id', orgId).maybeSingle();
    if (!studio) throw new Error('Studio not found');

    const token = crypto.randomBytes(32).toString('hex');
    const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const { error } = await admin.from('staff_invites').insert({
        id, org_id: orgId, email: input.email.toLowerCase().trim(), token_hash: hashToken(token),
        role: input.role, status: 'pending', expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    });
    if (error) throw new Error(error.message);

    const claimUrl = `${input.origin || 'https://classcore.ge'}/${studio.studio_slug}/staff-invite/${token}`;
    await sendInviteEmail(input.email, studio.studio_name, claimUrl, input.lang || 'ka');

    revalidatePath('/teachers');
    return { id };
}

export async function getPendingStaffInvitesAction(): Promise<StaffInviteRow[]> {
    const { orgId } = await requireEffectivePermission('canViewTeachers');
    const admin = adminClient();
    const { data, error } = await admin
        .from('staff_invites')
        .select('id, email, role, status, first_name, last_name, phone, created_at, submitted_at')
        .eq('org_id', orgId)
        .in('status', ['pending', 'submitted'])
        .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as StaffInviteRow[];
}

export async function revokeStaffInviteAction(rawInput: unknown): Promise<void> {
    const { id } = z.object({ id: z.string().min(1) }).parse(rawInput);
    const { orgId } = await requireEffectivePermission('canViewTeachers');
    const admin = adminClient();

    const { data: invite } = await admin.from('staff_invites').select('staff_id, status').eq('id', id).eq('org_id', orgId).maybeSingle();

    const { error } = await admin.from('staff_invites').update({ status: 'revoked' }).eq('id', id).eq('org_id', orgId);
    if (error) throw new Error(error.message);

    // A submitted-but-not-yet-confirmed invite already has a real
    // Supabase Auth account (created at submit time, with no role/
    // permissions granted) — clean it up rather than leaving an orphan
    // that can still authenticate.
    if (invite?.staff_id && invite.status === 'submitted') {
        await admin.auth.admin.deleteUser(invite.staff_id).catch(() => {});
    }

    revalidatePath('/teachers');
}

/**
 * Confirms a submitted invite into a real `staff` row — the PRD's
 * confirmation screen: `permissions` here is whatever the admin ended up
 * with after reviewing the role-default pre-fill and toggling anything,
 * matching createStaffAction's own "role default unless caller overrides"
 * shape but decided here instead, since invite permissions are only ever
 * settled at THIS step, never at invite-send time.
 */
const confirmInviteSchema = z.object({
    id: z.string().min(1),
    permissions: z.record(z.string(), z.boolean()).optional(),
});

export async function confirmStaffInviteAction(rawInput: unknown): Promise<{ id: string }> {
    const input = confirmInviteSchema.parse(rawInput);
    const { orgId } = await requireEffectivePermission('canViewTeachers');
    const admin = adminClient();

    const { data: invite, error: fetchErr } = await admin
        .from('staff_invites')
        .select('*')
        .eq('id', input.id).eq('org_id', orgId).eq('status', 'submitted')
        .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!invite) throw new Error('Invite not found or not yet submitted by the teacher');
    if (!invite.staff_id) throw new Error('This invite has no linked account — the teacher needs to re-submit');

    const roleTier = resolveRoleTier(invite.role, false);
    const permissions = input.permissions || (roleTier ? ROLE_DEFAULT_PERMISSIONS[roleTier] : undefined);
    const staffId = invite.staff_id as string;
    const fullName = `${invite.first_name || ''} ${invite.last_name || ''}`.trim();

    // Unified Auth (docs/tasks.md): submitStaffInviteAction already created
    // this person's real Supabase Auth account, deliberately WITHOUT a
    // role — so until this exact moment they can log in but have no
    // effective permissions at all. Granting `role`/`permissions` here is
    // the actual "confirm" — everything up to this point was reversible
    // (a revoke just leaves an inert Auth account with no `staff` row and
    // no access).
    const { error: authErr } = await admin.auth.admin.updateUserById(staffId, {
        user_metadata: { role: invite.role, permissions },
    });
    if (authErr) throw new Error(authErr.message);

    const fullRecord = {
        id: staffId, full_name: fullName, first_name: invite.first_name, last_name: invite.last_name,
        email: invite.email, phone: invite.phone, role: invite.role, status: 'active',
        authType: 'supabase',
        ...(permissions ? { permissions } : {}),
    };

    const { error: insertErr } = await admin.from('staff').insert({
        id: staffId, org_id: orgId, full_name: fullName, first_name: invite.first_name, last_name: invite.last_name,
        email: invite.email, phone: invite.phone, role: invite.role,
        data: fullRecord,
    });
    if (insertErr) throw new Error(insertErr.message);

    const { error: updateErr } = await admin.from('staff_invites')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', input.id);
    if (updateErr) throw new Error(updateErr.message);

    revalidatePath('/teachers');
    revalidatePath('/settings');
    return { id: staffId };
}

// ─── Public claim-page actions (no session — the token IS the credential) ──

const tokenSchema = z.object({ token: z.string().min(1) });

export async function getStaffInviteByTokenAction(rawInput: unknown): Promise<{ email: string; role: string; studioName: string; status: string } | null> {
    const { token } = tokenSchema.parse(rawInput);
    const admin = adminClient();
    const { data: invite } = await admin
        .from('staff_invites')
        .select('email, role, status, org_id, expires_at')
        .eq('token_hash', hashToken(token))
        .maybeSingle();
    if (!invite) return null;
    if (invite.status !== 'pending') return null;
    if (new Date(invite.expires_at).getTime() < Date.now()) return null;

    const { data: studio } = await admin.from('studios').select('studio_name').eq('org_id', invite.org_id).maybeSingle();
    return { email: invite.email, role: invite.role, studioName: studio?.studio_name || 'ClassCore', status: invite.status };
}

const submitInviteSchema = z.object({
    token: z.string().min(1),
    first_name: z.string().trim().min(1),
    last_name: z.string().trim().min(1),
    phone: z.string().trim().min(1),
    password: z.string().min(1),
});

export async function submitStaffInviteAction(rawInput: unknown): Promise<void> {
    const input = submitInviteSchema.parse(rawInput);
    const passwordCheck = validatePasswordPolicy(input.password);
    if (!passwordCheck.valid) throw new Error(`Password does not meet the minimum requirements (${passwordCheck.reason})`);

    const admin = adminClient();
    const { data: invite } = await admin
        .from('staff_invites')
        .select('id, org_id, email, status, expires_at')
        .eq('token_hash', hashToken(input.token))
        .maybeSingle();
    if (!invite) throw new Error('Invalid or expired invite link');
    if (invite.status !== 'pending') throw new Error('This invite has already been used');
    if (new Date(invite.expires_at).getTime() < Date.now()) throw new Error('This invite link has expired');

    const studio = await admin.from('studios').select('studio_name, studio_slug').eq('org_id', invite.org_id).maybeSingle();

    // Unified Auth (docs/tasks.md): create the real Supabase Auth account
    // right now, with the password the teacher just set — Supabase owns
    // it from here on, this app never stores or sees it again. Deliberately
    // NO `role` in user_metadata yet: that only gets granted by
    // confirmStaffInviteAction once the admin reviews and confirms, so a
    // submitted-but-unconfirmed account can authenticate but has zero
    // effective permissions (computeEffectivePermissions with a null role
    // tier resolves to no access at all).
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: invite.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
            first_name: input.first_name, last_name: input.last_name, phone: input.phone,
            studio_name: studio.data?.studio_name, studio_slug: studio.data?.studio_slug,
            org_id: invite.org_id, is_activated: true,
        },
    });
    if (createErr || !created?.user) {
        const isDupe = /already registered|already exists/i.test(createErr?.message || '');
        throw new Error(isDupe ? 'An account with this email already exists' : (createErr?.message || 'Failed to create the account'));
    }

    const { error } = await admin.from('staff_invites').update({
        first_name: input.first_name, last_name: input.last_name, phone: input.phone,
        staff_id: created.user.id, status: 'submitted', submitted_at: new Date().toISOString(),
    }).eq('id', invite.id);
    if (error) throw new Error(error.message);
}
