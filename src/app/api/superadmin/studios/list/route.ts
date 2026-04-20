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
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('❌ Supabase configuration missing');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        if (supabaseServiceKey === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
            console.warn('⚠️ [SuperAdmin API] Using ANON_KEY instead of SERVICE_ROLE_KEY. Data may be restricted by RLS.');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase
            .from('studio_settings')
            .select('studio_slug, staff_data, updated_at')
            .order('updated_at', { ascending: false })
            .limit(500);

        if (error) throw error;

        // Fetch fallback data from 'studios' table because operations can sometimes be wiped/empty
        const { data: stdData } = await supabase.from('studios').select('studio_slug, owner_info, studio_name, logo_url');
        const stdMap = new Map();
        if (stdData) {
            stdData.forEach(s => stdMap.set(s.studio_slug, s));
        }

        // Process data to extract owner info
        const studios = data.map(row => {
            const targetSlug = row.studio_slug;
            const masterStudio = stdMap.get(targetSlug) || {};
            const fallbackOwner = masterStudio.owner_info || {};

            const staffDataObj = row.staff_data || {};
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

            // In legacy, owner_info might be at the root of studioConfig, in new it's inside settingsObj
            const ownerFromConfig = settingsObj.owner_info || studioConfig.owner_info || {};

            const ownerName = ownerFromConfig.first_name 
                ? `${ownerFromConfig.first_name} ${ownerFromConfig.last_name || ''}`.trim()
                : ownerFromStaff 
                    ? `${ownerFromStaff.first_name || ''} ${ownerFromStaff.last_name || ''}`.trim() || ownerFromStaff.full_name
                    : fallbackOwner.first_name
                        ? `${fallbackOwner.first_name} ${fallbackOwner.last_name || ''}`.trim()
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
                slug: row.studio_slug,
                name: settingsObj.studioName || studioConfig.studioName || masterStudio.studio_name || row.studio_slug,
                ownerName,
                ownerEmail: ownerFromConfig.email || ownerFromStaff?.email || fallbackOwner.email || 'N/A',
                ownerPhone: ownerFromConfig.phone || ownerFromStaff?.phone || fallbackOwner.phone || 'N/A',
                updatedAt: row.updated_at,
                logoUrl: settingsObj.logoDataUrl || studioConfig.logoDataUrl || masterStudio.logo_url || null,
                studentCount,
                groupCount,
                hallCount,
                activeSubsCount,
                revenue,
                plan: settingsObj.plan || studioConfig.plan || 'trial',
                suspended: settingsObj.suspended === true || studioConfig.suspended === true,
                billingStatus: billingObj.status || 'active',
                daysLeft: billingObj.daysLeftInTrial ?? 30
            };
        });

        return NextResponse.json({ studios });
    } catch (err: any) {
        console.error('❌ SuperAdmin Studio List API Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
