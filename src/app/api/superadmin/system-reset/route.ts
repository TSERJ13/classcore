import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { keepSlug } = await req.json();
        
        if (!keepSlug) {
            return NextResponse.json({ error: 'Missing keepSlug' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Delete all studios 
        const { error: deleteError } = await supabase
            .from('studio_settings')
            .delete()
            .neq('studio_slug', '___dummy_slug_to_delete_all___');

        if (deleteError) throw deleteError;

        // 2. ORPHANED USER PURGE: Delete all users from Supabase Auth except the Admin
        const adminEmail = 'adminclasscore@gmail.com'; // Preserve the master admin
        const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
        
        if (!listError && usersData.users) {
            const usersToDelete = usersData.users.filter(u => u.email?.toLowerCase() !== adminEmail.toLowerCase());
            
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
