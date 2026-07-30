import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/superadmin-auth';

export async function GET(req: Request) {
    const auth = await requireSuperAdmin(req);
    if (!auth.authorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!slug) return NextResponse.json({ error: 'Slug required' }, { status: 400 });

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: studio } = await supabase.from('studios').select('*').eq('studio_slug', slug).single();
    const { data: settings } = await supabase.from('studio_settings').select('*').eq('studio_slug', slug).single();

    return NextResponse.json({
        studio,
        settings: {
            ...settings,
            staff_data: settings?.staff_data ? 'PRESENT (HIDDEN FOR PRIVACY)' : 'MISSING'
        },
        hasOps: !!settings?.staff_data?._operations,
        studioNameInOps: settings?.staff_data?._operations?.cc_studio_settings?.studioName
    });
}
