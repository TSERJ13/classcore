import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { oldSlug, newSlug } = await req.json();
        
        if (!oldSlug || !newSlug) {
            return NextResponse.json({ error: 'Missing oldSlug or newSlug' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Supabase configuration missing');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // Update the studio_slug and timestamp in the studio_settings table
        const { error, count } = await supabase
            .from('studio_settings')
            .update({ 
                studio_slug: newSlug,
                updated_at: new Date().toISOString()
            })
            .eq('studio_slug', oldSlug)
            .select();

        if (error) {
            console.error('❌ Database update error:', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, updated: count });
    } catch (err: any) {
        console.error('❌ Update Slug API Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
