/**
 * Dual-auth helper for Server Actions whose real callers include staff/
 * teacher end users, not just owners/admins — Shop/Sales/Products being
 * the first case in this migration (see docs/architecture-migration.md
 * §13). Staff/teacher sessions authenticate via a signed `cc_staff_token`
 * HMAC cookie (src/lib/staff-token.ts) with NO Supabase Auth session and
 * no `profiles` row — `auth.uid()` is always null for them, so a plain
 * `requireOrgId()` (the pattern used everywhere else in this migration)
 * would lock them out of any write/read they need to make themselves.
 *
 * This mirrors src/lib/sync-auth.ts's `getAuthenticatedOrgId()` — the
 * pattern this codebase already uses for the service-role /api/sync/*
 * routes — as a reusable Server Action helper instead of a per-route copy:
 * try real Supabase Auth first (RLS-respecting client, safest), and only
 * if that comes back empty, fall back to the staff-token cookie with a
 * service-role client manually scoped to that token's `orgId`.
 *
 * IMPORTANT: every query made with the client this returns for the
 * staff-token branch MUST include an explicit `.eq('org_id', orgId)` (or
 * equivalent) — that client has no RLS protection at all, the org scoping
 * is entirely the caller's responsibility, exactly like every existing
 * service-role endpoint in this codebase already has to do.
 */

import { cookies } from 'next/headers';
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient as createSSRClient } from '@/lib/supabase/server';
import { verifyStaffToken } from '@/lib/staff-token';

export type DualAuthContext = {
    orgId: string;
    client: SupabaseClient;
    /** true if this request is a staff-token session — the client is service-role, not RLS-respecting, and every query must be manually org-scoped. */
    isStaffToken: boolean;
    /** The staff-token session's staff.id, or null for a real Supabase Auth (Main Administrator) session. Used by requireEffectivePermission() (src/lib/permissions/enforce.ts) to resolve that staff member's role/permissions/locks. */
    staffId: string | null;
};

export async function requireOrgIdDualAuth(): Promise<DualAuthContext> {
    const supabase = await createSSRClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
        const { data: profile } = await supabase
            .from('profiles').select('org_id').eq('id', userData.user.id).maybeSingle();
        if (profile?.org_id) {
            return { orgId: profile.org_id, client: supabase, isStaffToken: false, staffId: null };
        }
    }

    const cookieStore = await cookies();
    const staffCookie = cookieStore.get('cc_staff_token')?.value;
    const payload = await verifyStaffToken(staffCookie);
    if (payload?.orgId) {
        const admin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } },
        );
        return { orgId: payload.orgId, client: admin, isStaffToken: true, staffId: payload.staffId };
    }

    throw new Error('Not authenticated');
}
