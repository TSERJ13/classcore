import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { secret } = await req.json();
        
        // Basic protection: Ensure this is only called with the correct intent
        // In a real prod app, this would check a master admin session or a very secure key
        if (secret !== 'cc-master-purge-2026') {
            return NextResponse.json({ error: 'Unauthorized manual purge attempt' }, { status: 401 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Delete ALL records from studio_settings
        // This effectively wipes every studio, their students, staff, and configurations
        const { error: deleteError } = await supabase
            .from('studio_settings')
            .delete()
            .neq('studio_slug', 'PROHIBIT_ALL_DELETIONS_MOCK_KEY'); // effectively matches all rows

        if (deleteError) throw deleteError;

        return NextResponse.json({ 
            success: true, 
            message: 'Global Database Purge Complete. All studio data has been permanently removed.' 
        });

    } catch (err: any) {
        console.error('❌ Global Purge API Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
