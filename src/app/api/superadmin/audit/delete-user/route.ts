import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/superadmin-auth';

export async function POST(request: Request) {
    try {
        const auth = await requireSuperAdmin(request);
        if (!auth.authorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { userId, slug } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json({ error: 'Administrative configuration missing' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        console.log(`🧹 Audit Purge: Deleting user ${userId} ${slug ? '(' + slug + ')' : ''}`);

        // 1. Delete from Auth
        const { error: authError } = await supabase.auth.admin.deleteUser(userId);
        if (authError) throw authError;

        // 2. Optionally delete from studio_settings if slug provided
        if (slug && slug !== 'N/A') {
            const { error: dbError } = await supabase
                .from('studio_settings')
                .delete()
                .eq('studio_slug', slug);
            
            if (dbError) console.warn('⚠️ User deleted from Auth but studio_settings cleanup failed:', dbError.message);
        }

        return NextResponse.json({ success: true, message: 'User permanently deleted' });

    } catch (err: any) {
        console.error('❌ Audit Delete Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
