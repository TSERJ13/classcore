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
    const { password, ...rest } = row || {};
    return rest;
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
        // (Historically staff could also "log in" with their full name —
        // kept for compatibility with existing accounts.)
        const { data: candidates, error: staffErr } = await supabaseAdmin
            .from('staff')
            .select('*')
            .or(`email.ilike.${cleanEmail},full_name.ilike.${cleanEmail},first_name.ilike.${cleanEmail}`);

        if (staffErr) {
            console.error('❌ [staff-login] staff lookup failed:', staffErr.message);
            return NextResponse.json({ ok: false, error: 'Lookup failed' }, { status: 500 });
        }

        const matches = (candidates || []).filter((s: any) => s.password === password);
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
            const { staff, slug } = resolved[0];
            const token = await createStaffToken({ staffId: staff.id, orgId: staff.org_id, slug });
            if (!token) return NextResponse.json({ ok: false, error: 'Server not configured for staff login.' }, { status: 500 });

            const res = NextResponse.json({ ok: true, type: 'single', slug, staff: safeStaff(staff) });
            res.cookies.set('cc_staff_token', token, {
                httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
            });
            return res;
        }

        // Multiple studios matched this email+password — mint a token for
        // each so the client can activate whichever one the user picks
        // (via /api/auth/staff-select) without re-entering the password.
        const studiosOut = await Promise.all(resolved.map(async ({ staff, slug, name }) => {
            const token = await createStaffToken({ staffId: staff.id, orgId: staff.org_id, slug });
            return { slug, name, staff: safeStaff(staff), token };
        }));

        return NextResponse.json({ ok: true, type: 'multiple', studios: studiosOut });
    } catch (err: any) {
        console.error('❌ [staff-login] Error:', err);
        return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
    }
}
