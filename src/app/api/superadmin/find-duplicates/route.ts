import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const email = 'stdancegroup@gmail.com';

        // Find all studios for this email
        const { data, error } = await supabase
            .from('studio_settings')
            .select('*')
            .contains('staff_emails', [email]);

        if (error) throw error;

        const results = data.map(row => {
            const allStaff = (row.staff_data as any[]) || [];
            const studioConfig = allStaff.find(s => s.id === '__studio_config__')?.studio_data || {};
            return {
                slug: row.studio_slug,
                name: studioConfig.studioName || row.studio_slug,
                hasLogo: !!studioConfig.logoDataUrl,
                updatedAt: row.updated_at
            };
        });

        return NextResponse.json({ email, studios: results });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
