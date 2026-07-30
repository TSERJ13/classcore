import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/superadmin-auth';

export async function POST(req: Request) {
    let slug = '';
    let patch: any = null;
    let billingPatch: any = null;

    try {
        const auth = await requireSuperAdmin(req);
        if (!auth.authorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        slug = body.slug?.toLowerCase().trim() || '';
        patch = body.patch;
        billingPatch = body.billingPatch;
        
        if (!slug) return NextResponse.json({ error: 'Slug is required' }, { status: 400 });

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                                 process.env.SERVICE_ROLE_KEY || 
                                 process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
                                 process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // ===== 1. UPDATE studio_settings (operational blob) =====
        const { data: settingsRow, error: fetchError } = await supabase
            .from('studio_settings')
            .select('staff_data')
            .eq('studio_slug', slug)
            .maybeSingle();

        if (fetchError) throw fetchError;
        
        let currentData: any = {};

        if (!settingsRow) {
            console.log(`⚠️ [UpdateMeta] Creating new studio_settings for "${slug}"`);
            const { data: masterRow } = await supabase
                .from('studios')
                .select('org_id, studio_name')
                .eq('studio_slug', slug)
                .maybeSingle();

            currentData = {
                _staff: [],
                _operations: {
                    cc_studio_settings: { 
                        studioName: masterRow?.studio_name || slug, 
                        studioSlug: slug,
                        orgId: masterRow?.org_id
                    },
                    cc_sa_meta: {},
                    cc_saas_billing: {}
                },
                org_id: masterRow?.org_id
            };
        } else {
            currentData = settingsRow.staff_data || {};
        }
        
        // Ensure structure
        if (!currentData._operations) currentData._operations = {};
        if (!currentData._operations.cc_sa_meta) currentData._operations.cc_sa_meta = {};
        if (!currentData._operations.cc_studio_settings) currentData._operations.cc_studio_settings = {};
        if (!currentData._operations.cc_saas_billing) currentData._operations.cc_saas_billing = {};

        // Apply meta patch to operational blob
        if (patch) {
            currentData._operations.cc_sa_meta = { ...currentData._operations.cc_sa_meta, ...patch };
            currentData._operations.cc_studio_settings = { ...currentData._operations.cc_studio_settings, ...patch };

            // Update owner in staff list if owner_info provided
            if (patch.owner_info && Array.isArray(currentData._staff)) {
                const ownerIndex = currentData._staff.findIndex((s: any) => s.role === 'owner');
                if (ownerIndex !== -1) {
                    currentData._staff[ownerIndex] = {
                        ...currentData._staff[ownerIndex],
                        email: patch.owner_info.email || currentData._staff[ownerIndex].email,
                        phone: patch.owner_info.phone || currentData._staff[ownerIndex].phone,
                        first_name: patch.owner_info.first_name || currentData._staff[ownerIndex].first_name,
                        last_name: patch.owner_info.last_name || currentData._staff[ownerIndex].last_name,
                        full_name: `${patch.owner_info.first_name || ''} ${patch.owner_info.last_name || ''}`.trim() || currentData._staff[ownerIndex].full_name,
                    };
                }
            }
        }

        // Apply billing patch
        if (billingPatch) {
            currentData._operations.cc_saas_billing = { 
                ...currentData._operations.cc_saas_billing, 
                ...billingPatch 
            };
        }

        // Save updated operational blob
        const { error: updateSettingsError } = await supabase
            .from('studio_settings')
            .upsert({ 
                studio_slug: slug,
                staff_data: currentData,
                updated_at: new Date().toISOString()
            }, { onConflict: 'studio_slug' });

        if (updateSettingsError) throw updateSettingsError;

        // ===== 2. UPDATE studios.settings JSONB (for fast listing) =====
        if (patch) {
            // Fetch current settings JSONB from studios table
            const { data: studioRow } = await supabase
                .from('studios')
                .select('settings')
                .eq('studio_slug', slug)
                .maybeSingle();

            const currentStudioSettings = studioRow?.settings || {};
            
            // Build the merged settings update
            const settingsUpdate: any = { ...currentStudioSettings };
            if (patch.plan !== undefined) settingsUpdate.plan = patch.plan;
            if (patch.suspended !== undefined) settingsUpdate.suspended = patch.suspended;
            if (patch.is_deleted !== undefined) settingsUpdate.is_deleted = patch.is_deleted;

            // Build top-level updates.
            // IMPORTANT: studios.plan is the canonical source read by list/route.ts (row.plan).
            // studios.settings.plan is a JSONB copy kept for any clients that read it directly.
            // Both must be kept in sync — register-studio/route.ts writes plan as a top-level
            // column, so update-meta must also write it top-level, not only into settings JSONB.
            const topLevelUpdate: any = {
                settings: settingsUpdate
            };
            if (patch.plan !== undefined) topLevelUpdate.plan = patch.plan;
            if (patch.suspended !== undefined) topLevelUpdate.suspended = patch.suspended;
            if (patch.studioName) topLevelUpdate.studio_name = patch.studioName;
            if (patch.logoDataUrl) topLevelUpdate.logo_url = patch.logoDataUrl;
            if (patch.owner_info) topLevelUpdate.owner_info = patch.owner_info;
            if (patch.is_deleted !== undefined) topLevelUpdate.is_deleted = patch.is_deleted;

            const { error: masterError } = await supabase
                .from('studios')
                .update(topLevelUpdate)
                .eq('studio_slug', slug);

            if (masterError) {
                console.error(`❌ [UpdateMeta] Master update failed for ${slug}:`, masterError);
                // Don't throw — settings_data was already saved
            } else {
                console.log(`✅ [UpdateMeta] Master updated for ${slug}:`, { plan: patch.plan, suspended: patch.suspended });
            }
        }

        // ===== 3. If billingPatch, also update studios.settings with billing info =====
        if (billingPatch) {
            const { data: studioRow2 } = await supabase
                .from('studios')
                .select('settings')
                .eq('studio_slug', slug)
                .maybeSingle();

            const currentStudioSettings2 = studioRow2?.settings || {};
            const updatedSettings2 = {
                ...currentStudioSettings2,
                billing: {
                    ...(currentStudioSettings2.billing || {}),
                    ...billingPatch
                }
            };

            await supabase
                .from('studios')
                .update({ settings: updatedSettings2 })
                .eq('studio_slug', slug);
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('❌ [UpdateMeta] ERROR:', {
            slug,
            message: err.message,
        });
        return NextResponse.json({ error: err.message || 'Unknown server error' }, { status: 500 });
    }
}
