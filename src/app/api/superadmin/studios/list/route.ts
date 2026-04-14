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

        // Process data to extract owner info
        const studios = data.map(row => {
            const allStaff = (row.staff_data as any[]) || [];
            const ownerFromStaff = allStaff.find(s => s.role === 'owner');
            // Extract the config BUT DO NOT RETURN IT WHOLE
            const studioConfig = allStaff.find(s => s.id === '__studio_config__')?.studio_data || {};
            const ownerFromConfig = studioConfig.owner_info || {};

            const ownerName = ownerFromConfig.first_name 
                ? `${ownerFromConfig.first_name} ${ownerFromConfig.last_name || ''}`.trim()
                : ownerFromStaff 
                    ? `${ownerFromStaff.first_name} ${ownerFromStaff.last_name || ''}`.trim() 
                    : 'N/A';

            // Extract counts for students, groups, halls, and billing
            let studentCount = 0;
            let groupCount = 0;
            let hallCount = 0;
            let revenue = 0;
            let activeSubsCount = 0;

            const targetSlug = row.studio_slug;
            const studentKey = `cc_student_data_${targetSlug}`.toLowerCase();
            const groupKey = `cc_groups_${targetSlug}`.toLowerCase();
            const hallKey = `cc_halls_${targetSlug}`.toLowerCase();
            const billingKey = `cc_saas_billing_${targetSlug}`.toLowerCase();
            const subsKey = `cc_student_subscriptions_${targetSlug}`.toLowerCase();
            const shopKey = `cc_shop_sales_${targetSlug}`.toLowerCase();

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
                name: studioConfig.studioName || row.studio_slug,
                ownerName,
                ownerEmail: ownerFromConfig.email || ownerFromStaff?.email || 'N/A',
                ownerPhone: ownerFromConfig.phone || ownerFromStaff?.phone || 'N/A',
                updatedAt: row.updated_at,
                logoUrl: studioConfig.logoDataUrl || null,
                studentCount,
                groupCount,
                hallCount,
                activeSubsCount,
                revenue,
                plan: studioConfig.plan || 'trial',
                suspended: studioConfig.suspended === true,
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
