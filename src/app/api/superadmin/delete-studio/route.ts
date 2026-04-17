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

        // 1. Fetch the ORG_ID (the owner's user ID) from studio_settings before deletion
        const { data: record, error: fetchError } = await supabase
            .from('studio_settings')
            .select('org_id, staff_data')
            .eq('studio_slug', targetSlug)
            .maybeSingle();
        
        if (fetchError) {
            console.error(`❌ Fetch Error for ${targetSlug}:`, fetchError);
        }

        const cloudOrgId = record?.org_id;

        // 2. Auth Purge: Prioritize the cloud-fetched org_id
        let finalTargetId = userId || cloudOrgId;
        
        // Secondary Fallback: Lookup by email if ID is still missing
        if (!finalTargetId && email) {
            try {
                const { data: users, error: listError } = await supabase.auth.admin.listUsers();
                if (!listError) {
                    const found = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
                    if (found) finalTargetId = found.id;
                }
            } catch (e) {}
        }

        // 3. Execute Auth Purge
        if (finalTargetId) {
            try {
                const { error: authErr } = await supabase.auth.admin.deleteUser(finalTargetId);
                diag.authPurge = authErr ? `failed: ${authErr.message}` : 'success';
                console.log(`👤 Auth user deleted: ${finalTargetId}`);
            } catch (authCatch) {
                diag.authPurge = 'catch-error';
            }
        }

        // 4. Delete the database record
        const { error: deleteError, count } = await supabase
            .from('studio_settings')
            .delete({ count: 'exact' })
            .eq('studio_slug', targetSlug);

        // Update diagnostic with actual deletion count
        diag.settingsPurgeCount = count || 0;

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
