import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const { slug, name, logoUrl, settings, orgId } = await req.json();

        // 1. Verify User Session
        const cookieStore = cookies();
        const supabaseAuth = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) { return cookieStore.get(name)?.value; },
                    set(name: string, value: string, options: CookieOptions) { },
                    remove(name: string, options: CookieOptions) { }
                }
            }
        );

        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let resolvedOrgId = orgId;
        if (!resolvedOrgId && slug) {
            // 🛡️ Resolve OrgID from slug if missing (Vital for new devices/guest mode)
            const { data } = await supabaseAdmin.from('studios').select('org_id').eq('studio_slug', slug).maybeSingle();
            resolvedOrgId = data?.org_id;
        }

        if (!slug || !resolvedOrgId) {
            console.error('❌ [SyncAPI] Missing Slug or OrgID:', { slug, resolvedOrgId });
            return NextResponse.json({ error: 'Slug and OrgID are required' }, { status: 400 });
        }

        console.log(`🚀 [SyncAPI] Pushing Metadata for Slug: ${slug} (Org: ${resolvedOrgId})`);
        const orgIdToUse = resolvedOrgId;

        // 2. Atomic Update using Service Role
        const discoverySettings = { ...settings };
        
        // Strip large collections from discovery blob
        const collectionsToStrip = ['staff', 'students', 'groups', 'halls', 'calendar_events', 'subscription_plans', 'attendance', 'sales', 'expenses', 'products', 'trash'];
        collectionsToStrip.forEach(key => delete discoverySettings[key]);

        // 🚀 SCORCHED EARTH v4.8: CRITICAL FIX - Strip logo from discovery blob
        delete discoverySettings.logoDataUrl;

        // 🚀 SCORCHED EARTH v4.4: Ensure logo_url is persisted to master record
        const masterLogoUrl = logoUrl || null;

        // 1. Update Master Studio Record (Discovery)
        const masterRes = await supabaseAdmin.from('studios').upsert({
            studio_slug: slug,
            studio_name: name,
            logo_url: masterLogoUrl,
            org_id: orgIdToUse,
            owner_info: settings.owner_info || undefined, // Mirror owner info to master table
            settings: discoverySettings,
            plan: settings.plan || 'trial', // 🔥 Explicitly sync plan to master table
            updated_at: new Date().toISOString()
        }, { onConflict: 'studio_slug' });

        if (masterRes.error) console.error('❌ [SyncAPI] Master Upsert Error:', masterRes.error.message);

        // 2. Update Studio Settings (Full Recovery Blob)
        // 🚀 Use Robust Check-then-Update to bypass constraint issues
        const { data: existingSettings } = await supabaseAdmin.from('studio_settings').select('id').eq('org_id', orgIdToUse).maybeSingle();
        
        let settingsRes;
        if (existingSettings?.id) {
            settingsRes = await supabaseAdmin.from('studio_settings').update({
                studio_name: name,
                staff_data: settings,
                updated_at: new Date().toISOString()
            }).eq('id', existingSettings.id);
        } else {
            settingsRes = await supabaseAdmin.from('studio_settings').insert({
                org_id: orgIdToUse,
                studio_name: name,
                staff_data: settings,
                updated_at: new Date().toISOString()
            });
        }

        if (settingsRes.error) console.error('❌ [SyncAPI] Settings Save Error:', settingsRes.error.message);

        if (masterRes.error || settingsRes.error) {
            return NextResponse.json({ 
                error: 'Sync failed', 
                details: [masterRes.error?.message, settingsRes.error?.message].filter(Boolean) 
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, orgId: orgIdToUse });

    } catch (err: any) {
        console.error('❌ [SyncAPI] Critical Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
