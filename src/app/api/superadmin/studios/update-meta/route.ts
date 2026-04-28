import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { slug: rawSlug, patch, billingPatch } = await req.json();
        const slug = rawSlug?.toLowerCase().trim();
        
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

        // 1. Fetch current blob
        const { data, error } = await supabase
            .from('studio_settings')
            .select('staff_data')
            .eq('studio_slug', slug)
            .maybeSingle(); // Use maybeSingle to handle missing records gracefully

        if (error) throw error;
        if (!data) {
            return NextResponse.json({ error: `Studio settings for "${slug}" not found in database.` }, { status: 404 });
        }

        // 2. Safely merge it
        const currentData = data.staff_data || {};
        
        // Ensure structure is v3
        if (!currentData._operations) {
            currentData._operations = {};
        }

        // Apply meta patch
        if (patch) {
            if (!currentData._operations.cc_sa_meta) {
                currentData._operations.cc_sa_meta = {};
            }
            currentData._operations.cc_sa_meta = { ...currentData._operations.cc_sa_meta, ...patch };

            if (!currentData._operations.cc_studio_settings) {
                currentData._operations.cc_studio_settings = {};
            }
            currentData._operations.cc_studio_settings = { ...currentData._operations.cc_studio_settings, ...patch };

            // If owner_info is provided in patch, we should also try to update the owner in the staff list
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

            // Legacy array format backwards compatibility
            if (Array.isArray(currentData)) {
                const configObj = currentData.find((s: any) => s.id === '__studio_config__');
                if (configObj && configObj.studio_data) {
                    const legacyKey = `cc_studio_settings_${slug}`;
                    if (configObj.studio_data[legacyKey]) {
                        configObj.studio_data[legacyKey] = { ...configObj.studio_data[legacyKey], ...patch };
                    } else {
                        configObj.studio_data.plan = patch.plan || configObj.studio_data.plan;
                        configObj.studio_data.suspended = patch.suspended !== undefined ? patch.suspended : configObj.studio_data.suspended;
                    }
                }
            }
        }

        // Apply billing patch
        if (billingPatch) {
            if (!currentData._operations.cc_saas_billing) {
                currentData._operations.cc_saas_billing = {};
            }
            currentData._operations.cc_saas_billing = { ...currentData._operations.cc_saas_billing, ...billingPatch };
            
            // Legacy billing merge
            if (Array.isArray(currentData)) {
                const configObj = currentData.find((s: any) => s.id === '__studio_config__');
                if (configObj && configObj.studio_data) {
                    const billingKey = `cc_saas_billing_${slug}`;
                    configObj.studio_data[billingKey] = { ...(configObj.studio_data[billingKey] || {}), ...billingPatch };
                }
            }
        }

        // 3. Save back to operational blob
        const { error: updateError } = await supabase
            .from('studio_settings')
            .update({ staff_data: currentData })
            .eq('studio_slug', slug);

        if (updateError) throw updateError;

        // 🚀 4. Propagate to Master Record (studios table) for performant listing & fallbacks
        if (patch) {
            console.log(`📡 [UpdateMeta] Propagating master metadata for: ${slug}`, {
                name: patch.studioName,
                owner: patch.owner_info?.email
            });
            
            const { error: masterError } = await supabase
                .from('studios')
                .update({
                    studio_name: patch.studioName || undefined,
                    logo_url: patch.logoDataUrl || undefined,
                    owner_info: patch.owner_info || undefined,
                    plan: patch.plan || undefined,
                    suspended: patch.suspended !== undefined ? patch.suspended : undefined,
                    is_deleted: patch.is_deleted !== undefined ? patch.is_deleted : undefined
                })
                .eq('studio_slug', slug);

            if (masterError) {
                console.error(`❌ [UpdateMeta] Master update failed for ${slug}:`, masterError);
            }
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('Meta Update error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
