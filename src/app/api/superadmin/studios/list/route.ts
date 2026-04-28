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

        // 🚨 1. Fetch from 'studios' table (New base)
        const { data: stdData, error: stdError } = await supabase
            .from('studios')
            .select('studio_slug, owner_info, studio_name, logo_url, created_at')
            .order('created_at', { ascending: false });

        if (stdError) {
            console.error('⚠️ [SuperAdmin API] Studios table fetch error:', stdError.message);
        }

        // 🚨 2. Fetch from 'studio_settings' table (Legacy base)
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
            const fallbackOwner = (row as any).owner_info || {};
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

            // In legacy, owner_info might be at the root of studioConfig or as individual columns
            const ownerFromConfig = settingsObj.owner_info || studioConfig.owner_info || {
                first_name: settingsObj.owner_first_name || studioConfig.owner_first_name || settingsObj.first_name || studioConfig.first_name,
                last_name: settingsObj.owner_last_name || studioConfig.owner_last_name || settingsObj.last_name || studioConfig.last_name,
                email: settingsObj.owner_email || studioConfig.owner_email || settingsObj.email || studioConfig.email,
                phone: settingsObj.owner_phone || studioConfig.owner_phone || settingsObj.phone || studioConfig.phone
            };

            const ownerName = ownerFromConfig.first_name 
                ? `${ownerFromConfig.first_name} ${ownerFromConfig.last_name || ''}`.trim()
                : ownerFromStaff 
                    ? `${ownerFromStaff.first_name || ''} ${ownerFromStaff.last_name || ''}`.trim() || (ownerFromStaff as any).full_name
                    : (fallbackOwner.first_name || fallbackOwner.owner_first_name)
                        ? `${fallbackOwner.first_name || fallbackOwner.owner_first_name} ${fallbackOwner.last_name || fallbackOwner.owner_last_name || ''}`.trim()
                        : 'N/A';

            // Extract counts for students, groups, halls, and billing
            let studentCount = 0;
            let groupCount = 0;
            let hallCount = 0;
            let revenue = 0;
            let activeSubsCount = 0;

            const studentKey = isUnified ? 'cc_student_data' : `cc_student_data_${targetSlug}`.toLowerCase();
            const groupKey = isUnified ? 'cc_groups' : `cc_groups_${targetSlug}`.toLowerCase();
            const hallKey = isUnified ? 'cc_halls' : `cc_halls_${targetSlug}`.toLowerCase();
            const billingKey = isUnified ? 'cc_saas_billing' : `cc_saas_billing_${targetSlug}`.toLowerCase();
            const subsKey = isUnified ? 'cc_student_subscriptions' : `cc_student_subscriptions_${targetSlug}`.toLowerCase();
            const shopKey = isUnified ? 'cc_shop_sales' : `cc_shop_sales_${targetSlug}`.toLowerCase();

            Object.entries(studioConfig || {}).forEach(([key, value]) => {
                const lowerKey = key.toLowerCase();
                
                if (lowerKey === studentKey) {
                    studentCount += Object.keys(value as any || {}).length;
                } else if (lowerKey === groupKey) {
                    groupCount += (value as any[] || []).length;
                } else if (lowerKey === hallKey) {
                    hallCount += (value as any[] || []).length;
                } else if (lowerKey === subsKey) {
                    // Calculate revenue from active subscriptions
                    Object.values(value as any || {}).forEach((subs: any) => {
                        if (Array.isArray(subs)) {
                            subs.forEach(s => {
                                if (s.status === 'active') {
                                    activeSubsCount++;
                                    revenue += Number(s.amount_paid || 0);
                                }
                            });
                        }
                    });
                } else if (lowerKey === shopKey) {
                    // Add shop sales
                    if (Array.isArray(value)) {
                        value.forEach(v => revenue += Number(v.total_amount || 0));
                    }
                }
            });

            // Extract billing status
            const billingObj = (studioConfig as any)[billingKey] || {};

            return {
                slug: targetSlug,
                name: settingsObj.studioName || studioConfig.studioName || (row as any).studio_name || targetSlug,
                ownerName,
                ownerEmail: ownerFromConfig.email || ownerFromStaff?.email || fallbackOwner.email || 'N/A',
                ownerPhone: ownerFromConfig.phone || ownerFromStaff?.phone || fallbackOwner.phone || 'N/A',
                updatedAt: (settingsRow as any).updated_at || (row as any).created_at,
                logoUrl: settingsObj.logoDataUrl || studioConfig.logoDataUrl || settingsObj.logo_url || studioConfig.logo_url || settingsObj.logo || studioConfig.logo || (row as any).logo_url || null,
                studentCount,
                groupCount,
                hallCount,
                activeSubsCount,
                revenue,
                plan: settingsObj.plan || studioConfig.plan || 'trial',
                suspended: settingsObj.suspended === true || studioConfig.suspended === true,
                billingStatus: billingObj.status || 'active',
                daysLeft: billingObj.daysLeftInTrial ?? 30,
                deleted: settingsObj.deleted === true || studioConfig.deleted === true || (row as any).is_deleted === true
            };
        });

        return NextResponse.json({ studios }, { headers: responseHeaders });
    } catch (err: any) {
        console.error('❌ SuperAdmin Studio List API Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
