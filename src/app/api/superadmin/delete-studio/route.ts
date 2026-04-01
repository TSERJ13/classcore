import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { userId, email, slug } = await req.json();
        
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ 
                error: 'SUPABASE_SERVICE_ROLE_KEY missing. SuperAdmin actions require elevated privileges.' 
            }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const targetSlug = slug?.trim().toLowerCase();
        if (!targetSlug) {
            return NextResponse.json({ error: 'Studio slug is required' }, { status: 400 });
        }

        const diag: any = {
            authPurge: 'skipped',
            settingsFound: false,
            settingsPurgeCount: 0
        };

        // 1. Try to delete the specific row from studio_settings
        // We use the slug as provided, trimmed. 
        const { error: deleteError, count } = await supabase
            .from('studio_settings')
            .delete({ count: 'exact' })
            .eq('studio_slug', targetSlug);
        
        if (deleteError) {
            console.error(`❌ Database Deletion Error for ${targetSlug}:`, deleteError);
            return NextResponse.json({ error: `Database error: ${deleteError.message}`, diag }, { status: 500 });
        }

        console.log(`🗑️ Deleted ${count} records for slug: ${targetSlug}`);
        diag.settingsPurgeCount = count || 0;
        if (diag.settingsPurgeCount > 0) {
            diag.settingsFound = true;
        }

        // 2. Auth Purge (Lookup by email if ID missing)
        let targetId = userId;
        if (!targetId && email) {
            try {
                const { data: users, error: listError } = await supabase.auth.admin.listUsers();
                if (!listError) {
                    const found = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
                    if (found) targetId = found.id;
                }
            } catch (e) {}
        }

        if (targetId) {
            try {
                const { error: authErr } = await supabase.auth.admin.deleteUser(targetId);
                diag.authPurge = authErr ? `failed: ${authErr.message}` : 'success';
            } catch (authCatch) {
                diag.authPurge = 'catch-error';
            }
        }

        // If no records were found/deleted, we still consider it a success state (it's gone now)
        if (diag.settingsPurgeCount === 0) {
            return NextResponse.json({ 
                success: true, 
                message: `Studio "${targetSlug}" was not found in cloud, but clean-up is complete.`, 
                diag 
            });
        }

        return NextResponse.json({ success: true, count: diag.settingsPurgeCount, diag });
    } catch (err: any) {
        console.error('❌ Delete Studio API Critical Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
