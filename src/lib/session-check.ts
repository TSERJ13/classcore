import { cookies } from 'next/headers';
import { createClient as createSSRClient } from '@/lib/supabase/server';

/**
 * Minimal gate for endpoints (SMS sending, SMS logs) that need to stop
 * completely anonymous internet abuse but are also called by staff logins,
 * which don't have a real Supabase session (see settings-store.ts
 * setStaffSession). Accepts either a real session or the same cc_staff_auth
 * cookie the rest of the app already treats as a valid signal. This does not
 * close the underlying staff-auth gap -- it only requires a caller to be
 * inside the app's own cookie/session flow rather than a bare HTTP client.
 */
export async function hasAnySession(): Promise<boolean> {
    const cookieStore = cookies();
    if (cookieStore.get('cc_staff_auth')?.value === 'true') return true;

    const supabase = await createSSRClient();
    const { data } = await supabase.auth.getUser();
    return !!data.user;
}
