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

        // 🚨 3. UNIFY: Combine all unique slugs
        const stdList = stdData || [];
        
        const studios = stdList.map(row => {
            const masterOwner = (row as any).owner_info || {};
            
            // 🚨 ENHANCED OWNER RESOLUTION (LIGHTWEIGHT)
            let ownerName = null;
            let ownerEmail = null;
            let ownerPhone = null;

            // 1. Prioritize Master Table
            if (masterOwner.email && masterOwner.email !== 'N/A') {
                ownerName = `${masterOwner.first_name || ''} ${masterOwner.last_name || ''}`.trim() || masterOwner.full_name || null;
                ownerEmail = masterOwner.email;
                ownerPhone = masterOwner.phone || null;
            } 
            
            // 2. Ultimate Fallback to Profiles (using org_id)
            if (!ownerEmail && (row as any).org_id) {
                const orgProfiles = (profileData || []).filter(p => p.org_id === (row as any)?.org_id);
                const ownerProfile = orgProfiles.find(p => p.role === 'owner') || orgProfiles[0];
                if (ownerProfile) {
                    ownerName = ownerProfile.full_name || `${ownerProfile.first_name || ''} ${ownerProfile.last_name || ''}`.trim() || null;
                    ownerEmail = ownerProfile.email || null;
                    ownerPhone = ownerProfile.phone || null;
                }
            }

            return {
                slug: row.studio_slug,
                name: row.studio_name || row.studio_slug,
                ownerName: ownerName || '—', 
                ownerEmail: ownerEmail || '—', 
                ownerPhone: ownerPhone || '—',
                updatedAt: row.created_at,
                logoUrl: row.logo_url,
                studentCount: 0, // Set to 0 for speed, calculate on drill-down if needed
                groupCount: 0,
                hallCount: 0,
                activeSubsCount: 0,
                revenue: 0,
                plan: (row as any).plan || 'trial',
                suspended: (row as any).suspended === true,
                billingStatus: 'active',
                daysLeft: 30,
                deleted: (row as any).is_deleted === true
            };
        });

        return NextResponse.json({ studios }, { headers: responseHeaders });
    } catch (err: any) {
        console.error('❌ SuperAdmin Studio List API Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
