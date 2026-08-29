import { cookies } from 'next/headers';
import { createClient as createSSRClient } from '@/lib/supabase/server';
import { verifyStaffToken } from '@/lib/staff-token';

/**
 * Gate for endpoints (SMS sending, SMS logs) that need to stop completely
 * anonymous internet abuse but are also called by staff logins, which
 * don't have a real Supabase session (see settings-store.ts
 * setStaffSession / activateStaffSession).
 *
 * This used to accept a bare, unsigned `cc_staff_auth=true` cookie that
 * any visitor could set themselves in devtools — effectively no gate at
 * all. It now verifies the signed staff session token (or a real Supabase
 * session) and returns which org the caller may act on, so callers can
 * scope data access instead of returning everything to anyone who passes
 * this check.
 */
export interface SessionOrgContext {
    orgId: string | null;
    slug: string | null;
}

export async function getSessionOrgContext(): Promise<SessionOrgContext | null> {
    const cookieStore = cookies();
    const staffToken = cookieStore.get('cc_staff_token')?.value;
    const staffPayload = await verifyStaffToken(staffToken);
    if (staffPayload) {
        return { orgId: staffPayload.orgId, slug: staffPayload.slug };
    }

    const supabase = await createSSRClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
        const slug = (data.user.user_metadata as any)?.studio_slug || null;
        return { orgId: null, slug };
    }

    return null;
}

export async function hasAnySession(): Promise<boolean> {
    return (await getSessionOrgContext()) !== null;
}
