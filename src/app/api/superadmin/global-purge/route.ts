import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { pattern, slugs: targetSlugs, secret } = await request.json();

        // Security check: Strictly require the service role key for global purge
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!serviceKey || !supabaseUrl) {
            return NextResponse.json({ error: 'Missing or invalid environment variables for administrative actions' }, { status: 500 });
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

        // 1. Find all matching studios and their associated Owners (org_id)
        let query = supabase.from('studio_settings').select('studio_slug, org_id');
        
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
        const orgIds = studios.map(s => s.org_id).filter(Boolean) as string[];
        const uniqueOrgIds = [...new Set(orgIds)];

        console.log(`🗑️ Found ${slugs.length} studios to purge (${uniqueOrgIds.length} unique owners).`);

        // 2. Auth Purge: Delete each associated user from Supabase Auth
        const authResults = { success: 0, failed: 0 };
        for (const uid of uniqueOrgIds) {
            try {
                const { error: authErr } = await supabase.auth.admin.deleteUser(uid);
                if (!authErr) authResults.success++;
                else {
                    console.error(`❌ Failed to delete Auth User ${uid}:`, authErr.message);
                    authResults.failed++;
                }
            } catch (e) { authResults.failed++; }
        }

        // 3. NUCLEAR TABLE PURGE: Clean all relational and setting tables for these slugs/orgs
        const tablesToClear = [
            'studio_settings', 
            'profiles', 
            'organizations', 
            'groups_classes', 
            'subscriptions', 
            'attendance_logs',
            'hall_rentals'
        ];

        console.log(`☢️ [GlobalPurge] Commencing multi-table wipe for ${slugs.length} slugs...`);

        for (const table of tablesToClear) {
            const isSettings = table === 'studio_settings';
            const { error: tableError } = await supabase
                .from(table)
                .delete()
                .in(isSettings ? 'studio_slug' : 'org_id', isSettings ? slugs : uniqueOrgIds);
            
            if (tableError) {
                console.warn(`⚠️ [GlobalPurge] Failed to clear table ${table}:`, tableError.message);
            }
        }

        return NextResponse.json({ 
            message: 'Purge complete', 
            found: slugs.length,
            deleted: slugs.length,
            auth_users_deleted: authResults.success,
            auth_errors: authResults.failed,
            slugs: slugs.slice(0, 10) 
        });

    } catch (err: any) {
        console.error('❌ Global Purge Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
