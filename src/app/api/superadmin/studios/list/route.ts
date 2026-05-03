import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
    const responseHeaders = {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
    };
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        // Try all possible service role key names
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                                 process.env.SERVICE_ROLE_KEY || 
                                 process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
                                 process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        const isUsingServiceRole = !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY);

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('❌ Supabase configuration missing');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        if (!isUsingServiceRole) {
            console.warn('⚠️ [SuperAdmin API] CRITICAL: No SERVICE_ROLE_KEY found. Using ANON_KEY. Data will be blocked by RLS.');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 🚨 1. Fetch from 'studios' table (Master Truth)
        const { data: stdData, error: stdError } = await supabase
            .from('studios')
            .select('studio_slug, owner_info, studio_name, logo_url, created_at, org_id, plan, suspended, is_deleted')
            .order('created_at', { ascending: false });

        if (stdError) {
            console.error('⚠️ [SuperAdmin API] Studios table fetch error:', stdError.message);
        }

        // 🚨 2. Fetch all profiles to resolve owners (Backup Truth)
        const { data: profileData } = await supabase
            .from('profiles')
            .select('org_id, email, role, full_name, first_name, last_name, phone');

        // 🚨 3. Fetch from 'studio_settings' table (Operational Blob)
        const { data: settingsData, error: settingsError } = await supabase
            .from('studio_settings')
            .select('studio_slug, staff_data, updated_at');
        
        if (settingsError) {
            console.error('⚠️ [SuperAdmin API] Studio Settings table fetch error:', settingsError.message);
        }

        // 🚨 3. UNIFY: Combine all unique slugs from both sources
        const stdList = stdData || [];
        const settingsList = settingsData || [];
        
        const allSlugs = new Set([
            ...stdList.map(s => s.studio_slug),
            ...settingsList.map(s => s.studio_slug)
        ].filter(Boolean));

        const stdMap = new Map(stdList.map(s => [s.studio_slug, s]));
        const settingsMap = new Map(settingsList.map(s => [s.studio_slug, s]));

        // Process unified list
        const studios = Array.from(allSlugs).map(targetSlug => {
            const row = stdMap.get(targetSlug) || {};
            const settingsRow = settingsMap.get(targetSlug) || {};
            const masterOwner = (row as any).owner_info || {};
            const staffDataObj = (settingsRow as any).staff_data || {};
            const isUnified = staffDataObj && !Array.isArray(staffDataObj) && (staffDataObj._staff || staffDataObj._operations);
            
            const allStaff = isUnified 
                ? (Array.isArray(staffDataObj._staff) ? staffDataObj._staff : []) 
                : (Array.isArray(staffDataObj) ? staffDataObj : []);
                
            const studioConfig = isUnified
                ? (staffDataObj._operations || {})
                : (allStaff.find?.((s: any) => s.id === '__studio_config__')?.studio_data || {});

            const ownerFromStaff = allStaff.find?.((s: any) => s.role === 'owner');
            
            const settingsKey = isUnified ? 'cc_studio_settings' : `cc_studio_settings_${targetSlug}`;
            const settingsObj = studioConfig[settingsKey] || {};

            const ownerFromConfig = settingsObj.owner_info || studioConfig.owner_info || {};

            // 🚨 ENHANCED OWNER RESOLUTION
            let ownerName = 'N/A';
            let ownerEmail = 'N/A';
            let ownerPhone = 'N/A';

            // 1. Prioritize Master Table (if it has actual data)
            if (masterOwner.email && masterOwner.email !== 'N/A') {
                ownerName = `${masterOwner.first_name || ''} ${masterOwner.last_name || ''}`.trim() || masterOwner.full_name || 'N/A';
                ownerEmail = masterOwner.email;
                ownerPhone = masterOwner.phone || 'N/A';
            } 
            // 2. Fallback to Settings Blob
            else if (ownerFromConfig.email && ownerFromConfig.email !== 'N/A') {
                ownerName = `${ownerFromConfig.first_name || ''} ${ownerFromConfig.last_name || ''}`.trim() || ownerFromConfig.full_name || 'N/A';
                ownerEmail = ownerFromConfig.email;
                ownerPhone = ownerFromConfig.phone || 'N/A';
            }
            // 3. Fallback to Staff List
            else if (ownerFromStaff) {
                ownerName = `${ownerFromStaff.first_name || ''} ${ownerFromStaff.last_name || ''}`.trim() || (ownerFromStaff as any).full_name || 'N/A';
                ownerEmail = ownerFromStaff.email || 'N/A';
                ownerPhone = ownerFromStaff.phone || 'N/A';
            }
            // 4. Ultimate Fallback to Profiles
            if (ownerName === 'N/A' || ownerEmail === 'N/A' || ownerPhone === 'N/A') {
                const orgProfiles = (profileData || []).filter(p => p.org_id === (row as any)?.org_id);
                const ownerProfile = orgProfiles.find(p => p.role === 'owner') || orgProfiles[0];
                if (ownerProfile) {
                    if (ownerName === 'N/A') ownerName = ownerProfile.full_name || `${ownerProfile.first_name || ''} ${ownerProfile.last_name || ''}`.trim() || 'N/A';
                    if (ownerEmail === 'N/A') ownerEmail = ownerProfile.email || 'N/A';
                    if (ownerPhone === 'N/A') ownerPhone = ownerProfile.phone || 'N/A';
                }
            }

            // Metrics Extraction
            let studentCount = 0, groupCount = 0, hallCount = 0, revenue = 0, activeSubsCount = 0;

            const mappingKeys = {
                students: isUnified ? 'cc_student_data' : `cc_student_data_${targetSlug}`.toLowerCase(),
                groups: isUnified ? 'cc_groups' : `cc_groups_${targetSlug}`.toLowerCase(),
                halls: isUnified ? 'cc_halls' : `cc_halls_${targetSlug}`.toLowerCase(),
                subs: isUnified ? 'cc_student_subscriptions' : `cc_student_subscriptions_${targetSlug}`.toLowerCase(),
                shop: isUnified ? 'cc_shop_sales' : `cc_shop_sales_${targetSlug}`.toLowerCase()
            };

            Object.entries(studioConfig || {}).forEach(([key, value]) => {
                const lowerKey = key.toLowerCase();
                if (lowerKey === mappingKeys.students) studentCount += Object.keys(value as any || {}).length;
                else if (lowerKey === mappingKeys.groups) groupCount += (value as any[] || []).length;
                else if (lowerKey === mappingKeys.halls) hallCount += (value as any[] || []).length;
                else if (lowerKey === mappingKeys.subs) {
                    Object.values(value as any || {}).forEach((subs: any) => {
                        if (Array.isArray(subs)) subs.forEach(s => {
                            if (s.status === 'active') { activeSubsCount++; revenue += Number(s.amount_paid || 0); }
                        });
                    });
                }
                else if (lowerKey === mappingKeys.shop && Array.isArray(value)) value.forEach(v => revenue += Number(v.total_amount || 0));
            });

            const billingKey = isUnified ? 'cc_saas_billing' : `cc_saas_billing_${targetSlug}`.toLowerCase();
            const billingObj = (studioConfig as any)[billingKey] || {};

            return {
                slug: targetSlug,
                name: settingsObj.studioName || studioConfig.studioName || (row as any).studio_name || targetSlug,
                ownerName, ownerEmail, ownerPhone,
                updatedAt: (settingsRow as any).updated_at || (row as any).created_at,
                logoUrl: settingsObj.logoDataUrl || studioConfig.logoDataUrl || (row as any).logo_url || null,
                studentCount, groupCount, hallCount, activeSubsCount, revenue,
                plan: (row as any).plan || settingsObj.plan || studioConfig.plan || 'trial',
                suspended: (row as any).suspended === true || settingsObj.suspended === true || studioConfig.suspended === true,
                billingStatus: billingObj.status || 'active',
                daysLeft: billingObj.daysLeftInTrial ?? 30,
                deleted: (row as any).is_deleted === true || settingsObj.deleted === true || studioConfig.deleted === true
            };
        });

        return NextResponse.json({ studios }, { headers: responseHeaders });
    } catch (err: any) {
        console.error('❌ SuperAdmin Studio List API Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
