import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { userId, email, slug } = await req.json();
        
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        const diag: any = {
            authPurge: 'skipped',
            settingsFound: false,
            settingsPurgeCount: 0,
            usingServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            urlPrefix: supabaseUrl.split('.')[0],
            availableSlugs: []
        };

        if (!supabaseUrl) throw new Error('SUPABASE_URL missing');

        const supabase = createClient(supabaseUrl, supabaseServiceKey!, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const targetSlug = slug?.trim();

        // 1. List ALL slugs to see what the client sees
        const { data: allRows } = await supabase.from('studio_settings').select('studio_slug').limit(10);
        diag.availableSlugs = allRows?.map(r => r.studio_slug) || [];

        // 2. Try to find the specific row
        if (targetSlug) {
            const { data: foundRows, error: findError } = await supabase
                .from('studio_settings')
                .select('studio_slug')
                .eq('studio_slug', targetSlug);

            if (foundRows && foundRows.length > 0) {
                diag.settingsFound = true;
                const { error: deleteError, count } = await supabase
                    .from('studio_settings')
                    .delete({ count: 'exact' })
                    .eq('studio_slug', targetSlug);
                
                if (deleteError) diag.settingsPurgeError = deleteError.message;
                else diag.settingsPurgeCount = count || 0;
            } else if (findError) {
                diag.settingsPurgeError = `Find failed: ${findError.message}`;
            } else {
                diag.settingsPurgeError = `Record not found: ${targetSlug}`;
            }
        }

        // 3. Auth Purge
        if (userId || email) {
            const { error: authErr } = userId 
                ? await supabase.auth.admin.deleteUser(userId)
                : { error: { message: 'no user id' } };
            diag.authPurge = authErr ? `failed: ${authErr.message}` : 'success';
        }

        return NextResponse.json({ success: true, count: diag.settingsPurgeCount, diag });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
