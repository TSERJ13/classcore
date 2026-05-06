import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Use Service Role to BYPASS all RLS policies!
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const slug = searchParams.get('slug');
        const orgId = searchParams.get('orgId');
        const isClientPortal = searchParams.get('isClientPortal') === 'true';

        // 1. Auth Logic (Strict for Admins, Lenient for Portals)
        if (!isClientPortal) {
            const authHeader = req.headers.get('Authorization');
            const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
            
            let user = null;
            if (token) {
                const { data } = await supabaseAdmin.auth.getUser(token);
                user = data.user;
            } else {
                const cookieStore = cookies();
                const supabaseAuth = createServerClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                    {
                        cookies: {
                            get(name: string) { return cookieStore.get(name)?.value; },
                            set() {}, remove() {}
                        }
                    }
                );
                const { data } = await supabaseAuth.auth.getUser();
                user = data.user;
            }

            if (!user) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        // 2. Resolve target OrgID
        let targetOrgId = orgId;
        let targetStudio = null;

        if (!targetOrgId && slug) {
            const { data } = await supabaseAdmin.from('studios').select('*').eq('studio_slug', slug.toLowerCase()).maybeSingle();
            if (data) {
                targetOrgId = data.org_id;
                targetStudio = data;
            }
        } else if (targetOrgId) {
            const { data } = await supabaseAdmin.from('studios').select('*').eq('org_id', targetOrgId).maybeSingle();
            targetStudio = data;
        }

        if (!targetOrgId) {
            return NextResponse.json({ error: 'Could not resolve OrgID' }, { status: 404 });
        }

        // 3. Fetch Data
        const responses = await Promise.all([
            supabaseAdmin.from('students').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('staff').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('groups').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('branches').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('halls').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('studio_settings').select('*').eq('org_id', targetOrgId).maybeSingle(),
            supabaseAdmin.from('subscriptions').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('attendance').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('calendar_events').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('subscription_plans').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('products').select('*').eq('org_id', targetOrgId)
        ]);

        const data = responses.map((r, idx) => {
            if (idx === 5) return r.data;
            return r.data || [];
        });

        return NextResponse.json({
            studio: targetStudio || { studio_slug: slug, studio_name: (data[5] as any)?.studio_name || 'Studio', org_id: targetOrgId },
            settingsRecord: data[5] || null,
            students: data[0] || [],
            staff: data[1] || [],
            groups: data[2] || [],
            branches: data[3] || [],
            halls: data[4] || [],
            subscriptions: data[6] || [],
            attendance: data[7] || [],
            calendar_events: data[8] || [],
            subscription_plans: data[9] || [],
            products: data[10] || [],
            org_id: targetOrgId
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { slug, orgId, isClientPortal } = await req.json();
        const authHeader = req.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

        // 1. Verify User Session (Bypass for Portals)
        if (!isClientPortal) {
            let user = null;
            if (token) {
                const { data } = await supabaseAdmin.auth.getUser(token);
                user = data.user;
            } else {
                const cookieStore = cookies();
                const supabaseAuth = createServerClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                    {
                        cookies: {
                            get(name: string) { return cookieStore.get(name)?.value; },
                            set() {}, remove() {}
                        }
                    }
                );
                const { data } = await supabaseAuth.auth.getUser();
                user = data.user;
            }

            if (!user) {
                console.error('❌ [SyncAPI] Unauthorized: No valid token or session.');
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        // 2. Resolve target OrgID
        let targetOrgId = orgId;
        let targetStudio = null;

        if (!targetOrgId && slug) {
            const { data } = await supabaseAdmin.from('studios').select('*').eq('studio_slug', slug.toLowerCase()).maybeSingle();
            if (data) {
                targetOrgId = data.org_id;
                targetStudio = data;
            }
        } else if (targetOrgId) {
            const { data } = await supabaseAdmin.from('studios').select('*').eq('org_id', targetOrgId).maybeSingle();
            targetStudio = data;
        }

        if (!targetOrgId) {
            console.error('❌ [SyncAPI] Could not resolve OrgID for slug:', slug);
            return NextResponse.json({ error: 'Could not resolve OrgID' }, { status: 404 });
        }

        console.log(`📡 [SyncAPI] Fetching Full State for OrgID: ${targetOrgId} (${slug || 'No Slug'})`);

        // 3. Fetch EVERYTHING with Admin privileges
        const responses = await Promise.all([
            supabaseAdmin.from('students').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('staff').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('groups').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('branches').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('halls').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('studio_settings').select('*').eq('org_id', targetOrgId).maybeSingle(),
            supabaseAdmin.from('subscriptions').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('attendance').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('sales').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('expenses').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('trash').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('calendar_events').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('subscription_plans').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('products').select('*').eq('org_id', targetOrgId)
        ]);

        const data = responses.map((r, idx) => {
            if (idx === 5) return r.data; // studio_settings is maybeSingle
            return r.data || [];
        });
        
        return NextResponse.json({
            studio: targetStudio || { studio_slug: slug, studio_name: (data[5] as any)?.studio_name || 'Studio', org_id: targetOrgId },
            settingsRecord: data[5] || null,
            students: data[0] || [],
            staff: data[1] || [],
            groups: data[2] || [],
            branches: data[3] || [],
            halls: data[4] || [],
            subscriptions: data[6] || [],
            attendance: data[7] || [],
            sales: data[8] || [],
            expenses: data[9] || [],
            trash: data[10] || [],
            calendar_events: data[11] || [],
            subscription_plans: data[12] || [],
            products: data[13] || [],
            org_id: targetOrgId
        });

    } catch (err: any) {
        console.error('❌ [API/Sync] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
