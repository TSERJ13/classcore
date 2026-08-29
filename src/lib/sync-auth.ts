import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createSSRClient } from '@/lib/supabase/server';
import { isSuperAdminEmail } from '@/lib/superadmin-emails';

export interface AuthContext {
    userId: string;
    email?: string;
    orgId: string | null;
    allowedOrgIds: string[];
    isSuperAdmin: boolean;
    hasAccessToOrg: (targetOrgId: string | null | undefined) => boolean;
}

/**
 * Resolves the authenticated caller of a /api/sync/* route and all org_ids
 * they have access to (via user_metadata.studio_slug, staff table, or studio_settings).
 */
export async function getAuthenticatedOrgId(req: Request): Promise<AuthContext | null> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createAdminClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    let user;
    if (token) {
        const { data } = await admin.auth.getUser(token);
        user = data.user;
    } else {
        const supabase = await createSSRClient();
        const { data } = await supabase.auth.getUser();
        user = data.user;
    }

    if (!user) return null;

    const email = user.email?.toLowerCase().trim();
    const isSuperAdmin = isSuperAdminEmail(email);

    const allowedOrgIdsSet = new Set<string>();

    // 1. Try via user_metadata studio_slug
    const studioSlug = user.user_metadata?.studio_slug;
    if (studioSlug) {
        const { data } = await admin.from('studios').select('org_id').ilike('studio_slug', studioSlug).maybeSingle();
        if (data?.org_id) allowedOrgIdsSet.add(data.org_id);
    }

    // 2. Try via staff table lookup by email
    if (email) {
        const { data: staffMatches } = await admin.from('staff').select('org_id').eq('email', email);
        if (staffMatches && staffMatches.length > 0) {
            staffMatches.forEach(m => { if (m.org_id) allowedOrgIdsSet.add(m.org_id); });
        }

        // 3. Try via studio_settings staff_emails array
        const { data: settingsMatches } = await admin.from('studio_settings').select('org_id').contains('staff_emails', [email]);
        if (settingsMatches && settingsMatches.length > 0) {
            settingsMatches.forEach(s => { if (s.org_id) allowedOrgIdsSet.add(s.org_id); });
        }
    }

    const allowedOrgIds = Array.from(allowedOrgIdsSet);
    const primaryOrgId = allowedOrgIds[0] || null;

    const hasAccessToOrg = (targetOrgId: string | null | undefined): boolean => {
        if (isSuperAdmin) return true;
        if (!targetOrgId) return false;
        if (primaryOrgId === targetOrgId) return true;
        if (allowedOrgIds.includes(targetOrgId)) return true;
        // NOTE: there used to be a fallback here that granted access to ANY
        // org whenever allowedOrgIds came back empty ("new-device hydration").
        // That is a cross-tenant data leak: any authenticated user whose org
        // lookup transiently failed (or whose client sent a stale/wrong slug
        // from a previous studio on the same device) was granted full read
        // access to whatever studio_slug/orgId the client happened to send.
        // Do not resurrect it — if a user's org membership can't be resolved,
        // deny and let the client re-resolve identity from profile/user
        // metadata instead of silently serving someone else's data.
        return false;
    };

    return {
        userId: user.id,
        email: user.email,
        orgId: primaryOrgId,
        allowedOrgIds,
        isSuperAdmin,
        hasAccessToOrg
    };
}
