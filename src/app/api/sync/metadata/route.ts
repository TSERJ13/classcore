import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedOrgId } from '@/lib/sync-auth';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const { slug, name, logoUrl, settings, orgId } = await req.json();

        // 1. Verify User Session
        const auth = await getAuthenticatedOrgId(req);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let resolvedOrgId = orgId;
        if (!resolvedOrgId && slug) {
            // 🛡️ Resolve OrgID from slug if missing (Vital for new devices/guest mode)
            const { data } = await supabaseAdmin.from('studios').select('org_id').ilike('studio_slug', slug).maybeSingle();
            resolvedOrgId = data?.org_id;
        }

        if (!slug || !resolvedOrgId) {
            console.error('❌ [SyncAPI] Missing Slug or OrgID:', { slug, resolvedOrgId });
            return NextResponse.json({ error: 'Slug and OrgID are required' }, { status: 400 });
        }

        if (!auth.hasAccessToOrg(resolvedOrgId)) {
            return NextResponse.json({ error: 'Forbidden: org mismatch' }, { status: 403 });
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

        // 🚀 PRESERVATION LAYER: Fetch existing records first to prevent client metadata pushes
        // from wiping out admin billing, plan, or suspended settings.
        const { data: existingStudio } = await supabaseAdmin
            .from('studios')
            .select('settings')
            .eq('studio_slug', slug)
            .maybeSingle();
        const existingSettings = existingStudio?.settings || {};

        const finalSettings = {
            ...discoverySettings,
            plan: existingSettings.plan || discoverySettings.plan || 'trial',
            suspended: existingSettings.suspended !== undefined ? existingSettings.suspended : discoverySettings.suspended,
            billing: existingSettings.billing || undefined
        };

        // 1. Update Master Studio Record (Discovery)
        const masterRes = await supabaseAdmin.from('studios').upsert({
            studio_slug: slug,
            studio_name: name === 'Studio' ? 'S_T Dance Studio' : name, // Force correct identity if default
            logo_url: masterLogoUrl,
            org_id: orgIdToUse,
            owner_info: settings.owner_info || undefined,
            settings: finalSettings
        }, { onConflict: 'studio_slug' });

        if (masterRes.error) console.error('❌ [SyncAPI] Master Upsert Error:', masterRes.error.message);

        const { data: existingSettingsRow } = await supabaseAdmin
            .from('studio_settings')
            .select('staff_data')
            .eq('studio_slug', slug)
            .maybeSingle();
        const existingStaffData = existingSettingsRow?.staff_data || {};

        const finalStaffData = {
            ...settings,
            studioName: name === 'Studio' ? 'S_T Dance Studio' : name,
            _operations: existingStaffData._operations || undefined
        };

        // 2. Update Studio Settings (Full Recovery Blob)
        const settingsRes = await supabaseAdmin.from('studio_settings').upsert({
            org_id: orgIdToUse,
            studio_slug: slug,
            staff_data: finalStaffData,
            updated_at: new Date().toISOString()
        }, { onConflict: 'studio_slug' });

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
