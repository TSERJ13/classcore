import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { userId, email, slug } = await req.json();
        
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('❌ Supabase configuration missing (URL or Service Role Key)');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // 1. Delete user from Supabase Auth
        if (userId) {
            console.log('🗑️ Deleting user by ID:', userId);
            const { error } = await supabase.auth.admin.deleteUser(userId);
            if (error) {
                console.warn('⚠️ Could not delete auth user by ID:', error.message);
            }
        } 
        
        // Always try to find and delete by email as well to be safe
        if (email) {
            console.log('🔍 Finding and deleting user by email:', email);
            // Fetch more users to avoid pagination issues (max 1000)
            const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
                perPage: 1000
            });
            
            if (listError) {
                console.warn('⚠️ Could not list users for email deletion:', listError.message);
            } else {
                const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
                if (user && user.id !== userId) { // Avoid double delete if ID matched
                    const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
                    if (delError) console.warn('⚠️ Could not delete auth user by email:', delError.message);
                    else console.log('✅ User deleted successfully:', email);
                } else if (!user) {
                    console.warn('⚠️ User not found for deletion:', email);
                }
            }
        }

        const targetSlug = slug?.trim();

        // 2. Delete from studio_settings table (THIS IS THE CLOUD PERSISTENCE)
        let deletedCount = 0;
        if (targetSlug) {
            console.log('🗑️ Purging studio_settings for slug:', targetSlug);
            const { error: settingsError, count } = await supabase
                .from('studio_settings')
                .delete({ count: 'exact' })
                .eq('studio_slug', targetSlug);
            
            if (settingsError) {
                console.error('❌ Could not delete studio settings row by slug:', settingsError.message);
                throw settingsError;
            } else {
                deletedCount = count || 0;
                console.log(`✅ Studio settings row purged for slug: ${targetSlug} (${deletedCount} rows)`);
            }
        } else if (email) {
            console.log('🗑️ Purging studio_settings for email:', email);
            const { error: settingsError, count } = await supabase
                .from('studio_settings')
                .delete({ count: 'exact' })
                .contains('staff_emails', [email.toLowerCase().trim()]);
            
            if (settingsError) {
                console.error('⚠️ Could not delete studio settings row by email:', settingsError.message);
            } else {
                deletedCount = count || 0;
                console.log(`✅ Studio settings row purged for owner email: ${email} (${deletedCount} rows)`);
            }
        }

        return NextResponse.json({ success: true, count: deletedCount });
    } catch (err: any) {
        console.error('❌ Deletion API Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
