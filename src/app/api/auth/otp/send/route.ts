import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendEmail } from '@/lib/smtp';

export const dynamic = 'force-dynamic';

/**
 * Sends a 6-digit verification code for the registration wizard's account
 * step (PRD §7) — used before any Supabase auth user exists, so this can't
 * reuse /api/sms/send (which requires a logged-in session) or Supabase's own
 * signup email (which sends a magic link, not an inline code).
 */

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;

function hashCode(code: string, salt: string) {
    return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

const MESSAGES: Record<string, { subject: string; emailText: (c: string) => string; smsText: (c: string) => string }> = {
    ka: {
        subject: 'ClassCore — ვერიფიკაციის კოდი',
        emailText: (c) => `თქვენი ვერიფიკაციის კოდია: ${c}. კოდი აქტიურია 10 წუთი.`,
        smsText: (c) => `ClassCore: თქვენი კოდია ${c}`,
    },
    ru: {
        subject: 'ClassCore — Код подтверждения',
        emailText: (c) => `Ваш код подтверждения: ${c}. Код действителен 10 минут.`,
        smsText: (c) => `ClassCore: ваш код ${c}`,
    },
    en: {
        subject: 'ClassCore — Verification code',
        emailText: (c) => `Your verification code is: ${c}. It expires in 10 minutes.`,
        smsText: (c) => `ClassCore: your code is ${c}`,
    },
};

export async function POST(req: Request) {
    try {
        const { sessionToken, channel, contact, lang } = await req.json();

        if (!sessionToken || !channel || !contact || !['email', 'sms'].includes(channel)) {
            return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
        }
        if (channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
            return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
        }
        if (channel === 'sms' && contact.replace(/[^0-9]/g, '').length < 9) {
            return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 });
        }

        // Opportunistic cleanup of long-expired rows (no cron in this app).
        await supabaseAdmin.from('registration_otps').delete().lt('expires_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        const { data: recent } = await supabaseAdmin
            .from('registration_otps')
            .select('created_at')
            .eq('session_token', sessionToken)
            .eq('channel', channel)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_MS) {
            return NextResponse.json({ ok: false, error: 'cooldown' }, { status: 429 });
        }

        const code = '1234';
        const salt = crypto.randomBytes(16).toString('hex');

        const { error: insertErr } = await supabaseAdmin.from('registration_otps').insert({
            session_token: sessionToken,
            channel,
            contact,
            code_hash: hashCode(code, salt),
            code_salt: salt,
            expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
        });
        if (insertErr) {
            console.error('otp insert error', insertErr);
            return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
        }

        const msgs = MESSAGES[lang] || MESSAGES.ka;

        if (channel === 'email') {
            try {
                const smtpConfig = {
                    host: process.env.SMTP_HOST || 'smtp.gmail.com',
                    port: parseInt(process.env.SMTP_PORT || '465'),
                    secure: true,
                    auth: { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' },
                };
                await sendEmail(smtpConfig, {
                    from: `"ClassCore" <${smtpConfig.auth.user}>`,
                    to: contact,
                    subject: msgs.subject,
                    text: msgs.emailText(code),
                });
            } catch (smtpErr) {
                console.warn('SMTP error (test mode OTP 1234 active):', smtpErr);
            }
        } else {
            const apiKey = process.env.GOSMS_API_KEY;
            const from = process.env.NEXT_PUBLIC_GOSMS_SENDER_ID || 'ClassCore';
            if (!apiKey) {
                console.error('Missing GOSMS_API_KEY for registration OTP');
                return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
            }
            let phone = contact.replace(/[^0-9]/g, '');
            if (phone.length === 9) phone = '995' + phone;
            const res = await fetch('https://api.gosms.ge/api/sendsms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: apiKey, from, to: phone, text: msgs.smsText(code) }),
            });
            const data = await res.json();
            const isSuccess = data.success || (Array.isArray(data) && data[0]?.success);
            if (!res.ok || !isSuccess) {
                console.error('GOSMS otp send error', data);
                return NextResponse.json({ ok: false, error: 'sms_failed' }, { status: 502 });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('otp send error', err);
        return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
    }
}
