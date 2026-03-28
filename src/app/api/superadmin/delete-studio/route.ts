import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { userId, email } = await req.json();
        
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

        if (userId) {
            console.log('🗑️ Deleting user by ID:', userId);
            const { error } = await supabase.auth.admin.deleteUser(userId);
            if (error) throw error;
        } else if (email) {
            console.log('🔍 Finding and deleting user by email:', email);
            const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
            if (listError) throw listError;
            
            const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
            if (user) {
                const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
                if (delError) throw delError;
                console.log('✅ User deleted successfully:', email);
            } else {
                console.warn('⚠️ User not found for deletion:', email);
            }
        } else {
            return NextResponse.json({ error: 'No identifier provided' }, { status: 400 });
        }

        // Also delete from studio_settings table if email/slug is known
        if (email) {
            const { error: settingsError } = await supabase
                .from('studio_settings')
                .delete()
                .contains('staff_emails', [email.toLowerCase().trim()]);
            
            if (settingsError) {
                console.error('⚠️ Could not delete studio settings row:', settingsError.message);
            } else {
                console.log('✅ Studio settings row purged for:', email);
            }
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('❌ Deletion API Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
