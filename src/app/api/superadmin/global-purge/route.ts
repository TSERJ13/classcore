import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { pattern, slugs: targetSlugs, secret } = await request.json();

        // Security check: Only allow if service role key is present and a pattern/slugs are provided
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!serviceKey || !supabaseUrl) {
            return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 });
        }

        if ((!pattern || pattern.length < 5) && (!targetSlugs || !Array.isArray(targetSlugs))) {
            return NextResponse.json({ error: 'Pattern too short or slugs array missing' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        console.log(`🧹 Starting global purge for ${pattern ? 'pattern: ' + pattern : targetSlugs?.length + ' specific slugs'}`);

        // 1. Find all matching studios
        let query = supabase.from('studio_settings').select('studio_slug');
        
        if (targetSlugs && Array.isArray(targetSlugs)) {
            query = query.in('studio_slug', targetSlugs);
        } else {
            query = query.like('studio_slug', `${pattern}%`);
        }

        const { data: studios, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        if (!studios || studios.length === 0) {
            return NextResponse.json({ message: 'No matching studios found', count: 0 });
        }

        const slugs = studios.map(s => s.studio_slug);
        console.log(`🗑️ Found ${slugs.length} studios to purge: ${slugs.join(', ')}`);

        // 2. Delete from studio_settings
        const { count, error: deleteError } = await supabase
            .from('studio_settings')
            .delete()
            .in('studio_slug', slugs);

        if (deleteError) throw deleteError;

        return NextResponse.json({ 
            message: 'Purge complete', 
            found: slugs.length,
            deleted: count || slugs.length,
            slugs: slugs.slice(0, 10) // Return first 10 for verification
        });

    } catch (err: any) {
        console.error('❌ Global Purge Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
