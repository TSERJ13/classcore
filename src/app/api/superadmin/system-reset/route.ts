import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/superadmin-auth';

export async function POST(req: Request) {
    try {
        const auth = await requireSuperAdmin(req);
        if (!auth.authorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { keepSlug } = await req.json();

        if (!keepSlug) {
            return NextResponse.json({ error: 'Missing keepSlug' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required for system reset.' }, { status: 500 });
        }
    
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        const adminEmail = 'adminclasscore@gmail.com'; 
        const adminSlug = 'superadmin';

        // 1. Nuclear Purge: Delete all rows from ALL relational and setting tables except the Admin HQ
        const tablesToClear = [
            'studio_settings', 
            'profiles', 
            'organizations', 
            'groups_classes', 
            'subscriptions', 
            'attendance_logs',
            'hall_rentals'
        ];

        console.log('☢️ [SystemReset] Commencing nuclear wipe of tables:', tablesToClear.join(', '));

        for (const table of tablesToClear) {
            const { error: deleteError } = await supabase
                .from(table)
                .delete()
                .neq(table === 'studio_settings' ? 'studio_slug' : 'org_id', table === 'studio_settings' ? adminSlug : '___ADMIN_HQ_ID___');
            
            if (deleteError) {
                console.warn(`⚠️ [SystemReset] Failed to clear table ${table}:`, deleteError.message);
            }
        }

        // 2. ORPHANED USER PURGE: Delete all users except the Admin
        const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
        
        if (!listError && usersData.users) {
            const usersToDelete = usersData.users.filter(u => 
                u.email?.toLowerCase() !== adminEmail.toLowerCase()
            );
            
            // Delete users sequentially to avoid rate limits
            for (const user of usersToDelete) {
                try {
                    await supabase.auth.admin.deleteUser(user.id);
                } catch (e) {
                    console.error(`Failed to delete user ${user.id}:`, e);
                }
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: `Nuclear System Reset complete. All studios and all non-admin users have been purged from the database and Auth system.` 
        });

    } catch (err: any) {
        console.error('❌ Master Reset API Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
