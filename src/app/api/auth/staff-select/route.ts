import { NextResponse } from 'next/server';
import { verifyStaffToken } from '@/lib/staff-token';

/**
 * Activates a staff session for one specific studio after /api/auth/staff-login
 * returned multiple matching studios (the "which studio?" switcher). The
 * client already holds a signed token for each candidate studio (minted by
 * staff-login, which already verified the password); this route just
 * checks the token's signature is genuinely ours before setting it as the
 * httpOnly session cookie — it does not re-trust an arbitrary client claim.
 */
export async function POST(req: Request) {
    try {
        const { token } = await req.json();
        const payload = await verifyStaffToken(token);
        if (!payload) {
            return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 401 });
        }

        const res = NextResponse.json({ ok: true, slug: payload.slug });
        res.cookies.set('cc_staff_token', token, {
            httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
        });
        return res;
    } catch (err: any) {
        console.error('❌ [staff-select] Error:', err);
        return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
    }
}
