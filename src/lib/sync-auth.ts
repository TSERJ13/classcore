import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createSSRClient } from '@/lib/supabase/server';

/**
 * Resolves the authenticated caller of a /api/sync/* route and the org_id
 * they actually own (via user_metadata.studio_slug -> studios.org_id).
 * These routes run with the service_role key (RLS bypassed), so this is the
 * only thing standing between an authenticated user and another studio's data.
 * Returns null if there is no valid session at all.
 */
export async function getAuthenticatedOrgId(req: Request): Promise<{ userId: string; orgId: string | null } | null> {
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

    const studioSlug = user.user_metadata?.studio_slug;
    let orgId: string | null = null;
    if (studioSlug) {
        const { data } = await admin.from('studios').select('org_id').ilike('studio_slug', studioSlug).maybeSingle();
        orgId = data?.org_id || null;
    }

    return { userId: user.id, orgId };
}
