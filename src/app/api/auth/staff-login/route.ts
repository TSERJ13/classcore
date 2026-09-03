import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createStaffToken } from '@/lib/staff-token';

/**
 * Server-side staff (PIN/password) login.
 *
 * Previously, staff-login password comparison happened entirely in the
 * browser (settings-store.ts validateStaffLogin), against staff records
 * fetched to the client with `.select('*')` — i.e. every staff member's
 * plaintext password for a studio was shipped to whoever's browser was
 * checking. And the "you're logged in" signal was just a client-set
 * cookie (`cc_staff_auth=true`) that anyone could forge without knowing
 * any password at all.
 *
 * This route does the password check here, server-side, with the service
 * role key, and returns a signed session token (see staff-token.ts) tied
 * to the specific staff member + org that matched — nothing forgeable,
 * and nothing that leaks other staff members' passwords to the client.
 *
 * NOTE: staff passwords are still stored in plaintext in the `staff`
 * table. This route stops shipping them to the browser and stops the
 * cookie-forgery bypass, but does not by itself fix plaintext storage —
 * that needs a password hashing migration, flagged separately.
 */

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

function safeStaff(row: any) {
    const dataObj = (row.data && typeof row.data === 'object') ? row.data : {};
    const { password, data, ...rest } = row || {};
    const { password: _p, ...cleanData } = dataObj;
    return { ...cleanData, ...rest };
}

export async function POST(req: Request) {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.STAFF_SESSION_SECRET) {
            return NextResponse.json({ ok: false, error: 'Server not configured for staff login (missing SUPABASE_SERVICE_ROLE_KEY or STAFF_SESSION_SECRET).' }, { status: 500 });
        }

        const { email, password } = await req.json();
        if (!email || !password) {
            return NextResponse.json({ ok: false, error: 'Missing email or password' }, { status: 400 });
        }
        const cleanEmail = String(email).trim().toLowerCase();

        // Find every staff row across every org whose email/name matches.
        let { data: candidates, error: staffErr } = await supabaseAdmin
            .from('staff')
            .select('*')
            .or(`email.ilike."${cleanEmail}",full_name.ilike."${cleanEmail}"`);

        if (staffErr) {
            console.error('❌ [staff-login] staff query error, falling back to full list:', staffErr.message);
        }

        if (!candidates || candidates.length === 0) {
            const { data: allStaff } = await supabaseAdmin.from('staff').select('*');
            if (allStaff) {
                candidates = allStaff.filter((s: any) => {
                    const e = (s.email || s.data?.email || '').toLowerCase().trim();
                    const fn = (s.full_name || s.data?.full_name || s.data?.first_name || '').toLowerCase().trim();
                    return e === cleanEmail || fn === cleanEmail || fn.includes(cleanEmail);
                });
            }
        }

        const matches = (candidates || []).filter((s: any) => {
            const pass = s.password || s.data?.password;
            return pass === password;
        });

        if (matches.length === 0) {
            const { data: allSettings } = await supabaseAdmin.from('studio_settings').select('*');
            if (allSettings) {
                for (const setRow of allSettings) {
                    const staffArr = setRow.settings?.staff || setRow.staff_data || [];
                    if (Array.isArray(staffArr)) {
                        for (const st of staffArr) {
                            const e = (st.email || '').toLowerCase().trim();
                            const fn = (st.full_name || st.first_name || '').toLowerCase().trim();
                            if ((e === cleanEmail || fn === cleanEmail || fn.includes(cleanEmail)) && st.password === password) {
                                matches.push({
                                    id: st.id,
                                    org_id: setRow.org_id,
                                    email: st.email,
                                    full_name: st.full_name || `${st.first_name || ''} ${st.last_name || ''}`.trim(),
                                    role: st.role || 'teacher',
                                    data: st
                                });
                            }
                        }
                    }
                }
            }
        }

        if (matches.length === 0) {
            return NextResponse.json({ ok: false, error: 'invalid' }, { status: 401 });
        }

        const orgIds = Array.from(new Set(matches.map((m: any) => m.org_id).filter(Boolean)));
        const { data: studios } = await supabaseAdmin
            .from('studios')
            .select('studio_slug, studio_name, org_id')
            .in('org_id', orgIds);

        const studioBySlugOrg = new Map((studios || []).map((s: any) => [s.org_id, s]));

        const resolved = matches
            .map((m: any) => {
                const studio = studioBySlugOrg.get(m.org_id);
                if (!studio) return null;
                return { staff: m, slug: studio.studio_slug, name: studio.studio_name || studio.studio_slug };
            })
            .filter(Boolean) as { staff: any; slug: string; name: string }[];

        if (resolved.length === 0) {
            return NextResponse.json({ ok: false, error: 'invalid' }, { status: 401 });
        }

        if (resolved.length === 1) {
            const { staff, slug, name } = resolved[0];
            const token = await createStaffToken({ staffId: staff.id, orgId: staff.org_id, slug });
            if (!token) return NextResponse.json({ ok: false, error: 'Server not configured for staff login.' }, { status: 500 });

            const res = NextResponse.json({ ok: true, type: 'single', slug, studioName: name, staff: { ...safeStaff(staff), studioName: name } });
            res.cookies.set('cc_staff_token', token, {
                httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
            });
            if (name && !/^[0-9a-f-]{20,}$/i.test(name)) {
                res.cookies.set('cc_studio_name', encodeURIComponent(name), {
                    path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax',
                });
            }
            const staffLang = staff.preferred_language || staff.data?.preferred_language;
            if (staffLang && ['ka', 'en', 'ru'].includes(staffLang)) {
                res.cookies.set('cc_lang', staffLang, {
                    path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax',
                });
            }
            return res;
        }

        // Multiple studios matched this email+password — mint a token for
        // each so the client can activate whichever one the user picks
        // (via /api/auth/staff-select) without re-entering the password.
        const studiosOut = await Promise.all(resolved.map(async ({ staff, slug, name }) => {
            const token = await createStaffToken({ staffId: staff.id, orgId: staff.org_id, slug });
            return { slug, name, studioName: name, staff: { ...safeStaff(staff), studioName: name }, token };
        }));

        return NextResponse.json({ ok: true, type: 'multiple', studios: studiosOut });
    } catch (err: any) {
        console.error('❌ [staff-login] Error:', err);
        return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
    }
}
