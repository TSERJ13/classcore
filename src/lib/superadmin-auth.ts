import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createSSRClient } from '@/lib/supabase/server';

/**
 * Mirrors the client-side allow-list in src/app/(auth)/sa-login/page.tsx.
 * That page only used this list for redirect UX — it never gated the API
 * routes themselves, so every /api/superadmin/* endpoint was reachable by
 * anyone. This is the server-side enforcement.
 */
const SUPER_ADMIN_EMAILS = ['adminclasscore@gmail.com', 'support@classcore.ge'];

export async function getSuperAdminEmail(req: Request): Promise<string | null> {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    let email: string | null | undefined;

    if (token) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const admin = createAdminClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data } = await admin.auth.getUser(token);
        email = data.user?.email;
    } else {
        const supabase = await createSSRClient();
        const { data } = await supabase.auth.getUser();
        email = data.user?.email;
    }

    if (!email) return null;
    const normalized = email.toLowerCase();
    return SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === normalized) ? normalized : null;
}

export async function requireSuperAdmin(req: Request): Promise<
    { authorized: true; email: string } | { authorized: false }
> {
    const email = await getSuperAdminEmail(req);
    if (!email) return { authorized: false };
    return { authorized: true, email };
}
