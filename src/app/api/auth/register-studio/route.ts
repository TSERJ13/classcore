import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Registration Flow PRD (v1.1) §7-8 — creates the Supabase auth user and the
 * studios/profiles master rows in one server-side call, using the service
 * role. The auth user is created pre-confirmed (email_confirm: true) because
 * email + phone were already verified inline via our own OTP codes
 * (/api/auth/otp/*) earlier in the same wizard — Supabase's own magic-link
 * confirmation email is not used by this flow.
 *
 * Requires both OTP rows for `sessionToken` to be verified and to match the
 * email/phone actually submitted, so a client can't skip verification by
 * calling this route directly.
 */

const geoToLat: Record<string, string> = {
    'ა': 'a', 'ბ': 'b', 'გ': 'g', 'დ': 'd', 'ე': 'e', 'ვ': 'v', 'ზ': 'z', 'თ': 't', 'ი': 'i', 'კ': 'k', 'ლ': 'l', 'მ': 'm', 'ნ': 'n', 'ო': 'o', 'პ': 'p', 'ჟ': 'zh', 'რ': 'r', 'ს': 's', 'ტ': 't', 'უ': 'u', 'ფ': 'f', 'ქ': 'k', 'ღ': 'gh', 'ყ': 'q', 'შ': 'sh', 'ჩ': 'ch', 'ც': 'c', 'ძ': 'dz', 'წ': 'ts', 'ჭ': 'ch', 'ხ': 'kh', 'ჯ': 'j', 'ჰ': 'h'
};
function slugify(text: string): string {
    return text.toLowerCase().split('').map(c => geoToLat[c] || c).join('').replace(/[^a-z0-9]/g, '');
}

export async function POST(req: NextRequest) {
    try {
        const { sessionToken, studioName, email, phone, password, firstName, lastName, lang } = await req.json();

        if (!sessionToken || !studioName || !email || !phone || !password || !firstName || !lastName) {
            return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
        }

        const studioSlug = slugify(studioName);
        if (!studioSlug || studioSlug.length < 2) {
            return NextResponse.json({ ok: false, error: 'invalid_studio_name' }, { status: 400 });
        }

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
            return NextResponse.json({ ok: false, error: 'no_service_role' }, { status: 500 });
        }
        const supabase = createClient(url, serviceKey);

        // 1) Both channels must be verified for THIS session and match what's
        //    actually being submitted — prevents skipping verification or
        //    swapping in an unverified contact at the last step.
        const { data: otpRows } = await supabase
            .from('registration_otps')
            .select('channel, contact, verified_at')
            .eq('session_token', sessionToken)
            .in('channel', ['email', 'sms'])
            .not('verified_at', 'is', null)
            .order('created_at', { ascending: false });

        const emailVerified = otpRows?.some(r => r.channel === 'email' && r.contact.toLowerCase() === String(email).toLowerCase());
        const smsVerified = otpRows?.some(r => r.channel === 'sms' && r.contact.replace(/[^0-9]/g, '') === String(phone).replace(/[^0-9]/g, ''));
        if (!emailVerified || !smsVerified) {
            return NextResponse.json({ ok: false, error: 'not_verified' }, { status: 403 });
        }

        // 2) Create the auth user, pre-confirmed (we already verified both
        //    contact channels ourselves above).
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                first_name: firstName,
                last_name: lastName,
                studio_name: studioName,
                studio_slug: studioSlug,
                phone,
                primary_lang: lang || 'ka',
                role: 'owner',
                is_activated: true,
            },
        });
        if (createErr || !created?.user) {
            const isDupe = /already registered|already exists/i.test(createErr?.message || '');
            return NextResponse.json({ ok: false, error: isDupe ? 'email_taken' : (createErr?.message || 'create_failed') }, { status: isDupe ? 409 : 500 });
        }

        const ownerInfo = {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`.trim(),
            email,
            phone,
        };

        const { data: existing } = await supabase.from('studios').select('org_id').eq('studio_slug', studioSlug).maybeSingle();
        const { data: studioRow, error: upsertErr } = await supabase
            .from('studios')
            .upsert({ studio_slug: studioSlug, studio_name: studioName, owner_info: ownerInfo, plan: 'trial' }, { onConflict: 'studio_slug' })
            .select('org_id')
            .maybeSingle();
        if (upsertErr) {
            return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 500 });
        }

        const orgId = studioRow?.org_id || existing?.org_id;
        if (orgId) {
            try {
                await supabase.from('profiles').upsert({
                    org_id: orgId,
                    email: email.toLowerCase().trim(),
                    role: 'owner',
                    first_name: firstName,
                    last_name: lastName,
                    full_name: ownerInfo.full_name,
                    phone,
                    primary_lang: lang || 'ka',
                }, { onConflict: 'email' });
            } catch { /* non-fatal */ }
        }

        return NextResponse.json({ ok: true, studioSlug, orgId });
    } catch (err) {
        console.error('register-studio error', err);
        return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'server_error' }, { status: 500 });
    }
}
