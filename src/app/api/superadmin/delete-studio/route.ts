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
                // Continue with studio_settings deletion even if user deletion fails
            }
        } else if (email) {
            console.log('🔍 Finding and deleting user by email:', email);
            const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
            if (listError) {
                console.warn('⚠️ Could not list users for email deletion:', listError.message);
            } else {
                const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
                if (user) {
                    const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
                    if (delError) console.warn('⚠️ Could not delete auth user by email:', delError.message);
                    else console.log('✅ User deleted successfully:', email);
                } else {
                    console.warn('⚠️ User not found for deletion:', email);
                }
            }
        }

        // 2. Delete from studio_settings table (THIS IS THE CLOUD PERSISTENCE)
        if (slug) {
            console.log('🗑️ Purging studio_settings for slug:', slug);
            const { error: settingsError } = await supabase
                .from('studio_settings')
                .delete()
                .eq('studio_slug', slug);
            
            if (settingsError) {
                console.error('❌ Could not delete studio settings row by slug:', settingsError.message);
                throw settingsError;
            } else {
                console.log('✅ Studio settings row purged for slug:', slug);
            }
        } else if (email) {
            console.log('🗑️ Purging studio_settings for email:', email);
            const { error: settingsError } = await supabase
                .from('studio_settings')
                .delete()
                .contains('staff_emails', [email.toLowerCase().trim()]);
            
            if (settingsError) {
                console.error('⚠️ Could not delete studio settings row by email:', settingsError.message);
            } else {
                console.log('✅ Studio settings row purged for owner email:', email);
            }
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('❌ Deletion API Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
