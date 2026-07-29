import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/superadmin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const auth = await requireSuperAdmin(req);
        if (!auth.authorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        // 4. Delete from BOTH tables to prevent "ghost" reappearances
        const { error: deleteError1, count: count1 } = await supabase
            .from('studio_settings')
            .delete({ count: 'exact' })
            .eq('studio_slug', targetSlug);

        const { error: deleteError2, count: count2 } = await supabase
            .from('studios')
            .delete({ count: 'exact' })
            .eq('studio_slug', targetSlug);

        console.log(`🗑️ [DeleteAPI] Purged ${targetSlug}: Settings(${count1}), Master(${count2})`);

        if (deleteError1 || deleteError2) {
            console.error('❌ Deletion Error:', { e1: deleteError1, e2: deleteError2 });
            return NextResponse.json({ 
                error: 'Database deletion failed', 
                details: { e1: deleteError1, e2: deleteError2 } 
            }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            message: `Studio "${targetSlug}" purged. Rows: Settings(${count1}), Master(${count2})`,
            deletedCount: { settings: count1, master: count2 }
        });
    } catch (err: any) {
        console.error('❌ Delete Studio API Critical Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
