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

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase
            .from('studio_settings')
            .select('studio_slug, staff_data, updated_at')
            .order('updated_at', { ascending: false })
            .limit(2000);

        if (error) throw error;

        // Process data to extract owner info
        const studios = data.map(row => {
            const allStaff = (row.staff_data as any[]) || [];
            const ownerFromStaff = allStaff.find(s => s.role === 'owner');
            const studioConfig = allStaff.find(s => s.id === '__studio_config__')?.studio_data || {};
            const ownerFromConfig = studioConfig.owner_info || {};

            const ownerName = ownerFromConfig.first_name 
                ? `${ownerFromConfig.first_name} ${ownerFromConfig.last_name || ''}`.trim()
                : ownerFromStaff 
                    ? `${ownerFromStaff.first_name} ${ownerFromStaff.last_name || ''}`.trim() 
                    : 'N/A';

            return {
                slug: row.studio_slug,
                name: studioConfig.studioName || row.studio_slug,
                ownerName,
                ownerEmail: ownerFromConfig.email || ownerFromStaff?.email || 'N/A',
                ownerPhone: ownerFromConfig.phone || ownerFromStaff?.phone || 'N/A',
                updatedAt: row.updated_at,
                logoUrl: studioConfig.logoDataUrl || null
            };
        });

        return NextResponse.json({ studios });
    } catch (err: any) {
        console.error('❌ SuperAdmin Studio List API Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
