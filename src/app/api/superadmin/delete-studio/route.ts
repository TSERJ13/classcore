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

        const diag: any = {
            authPurge: 'skipped',
            settingsFound: false,
            settingsPurgeCount: 0,
            usingServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        };

        // 1. Delete user from Supabase Auth
        if (userId) {
            console.log('🗑️ Deleting user by ID:', userId);
            const { error } = await supabase.auth.admin.deleteUser(userId);
            if (error) {
                console.warn('⚠️ Could not delete auth user by ID:', error.message);
                diag.authPurge = `failed: ${error.message}`;
            } else {
                diag.authPurge = 'success (by ID)';
            }
        } 
        
        if (email && diag.authPurge === 'skipped') {
            console.log('🔍 Finding and deleting user by email:', email);
            const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
            if (!listError) {
                const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
                if (user) {
                    const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
                    if (!delError) diag.authPurge = 'success (by email)';
                    else diag.authPurge = `failed (email): ${delError.message}`;
                } else {
                    diag.authPurge = 'not found';
                }
            } else {
                diag.authPurge = `list_failed: ${listError.message}`;
            }
        }

        const targetSlug = slug?.trim();

        // 2. Diagnostics: Try to find the row first
        if (targetSlug) {
            const { data: foundRows, error: findError } = await supabase
                .from('studio_settings')
                .select('studio_slug')
                .ilike('studio_slug', targetSlug);

            if (foundRows && foundRows.length > 0) {
                diag.settingsFound = true;
                console.log(`🔍 Found ${foundRows.length} rows matching slug: ${targetSlug}`);
                
                // Now try to delete
                const { error: deleteError, count } = await supabase
                    .from('studio_settings')
                    .delete({ count: 'exact' })
                    .ilike('studio_slug', targetSlug);
                
                if (deleteError) {
                    console.error('❌ Delete failed:', deleteError.message);
                    diag.settingsPurgeError = deleteError.message;
                } else {
                    diag.settingsPurgeCount = count || 0;
                }
            } else if (findError) {
                diag.settingsPurgeError = `Find failed: ${findError.message}`;
            } else {
                diag.settingsPurgeError = 'Record not found in database (even with ILIKE)';
            }
        }

        return NextResponse.json({ success: true, count: diag.settingsPurgeCount, diag });
    } catch (err: any) {
        console.error('❌ Deletion API Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
