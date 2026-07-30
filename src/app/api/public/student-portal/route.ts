import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// CORS headers for cross-origin portal access (e.g., stdance.ge)
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle CORS preflight
export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Use Service Role to bypass RLS
const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const slug = searchParams.get('slug');
        const phone = searchParams.get('phone');

        if (!slug) {
            return NextResponse.json({ error: 'Missing slug' }, { status: 400, headers: corsHeaders });
        }

        const supabase = getAdmin();

        // 1. Resolve studio by slug
        const { data: studio } = await supabase
            .from('studios')
            .select('org_id, studio_name, studio_slug')
            .ilike('studio_slug', slug)
            .maybeSingle();

        if (!studio) {
            return NextResponse.json({ error: 'Studio not found' }, { status: 404, headers: corsHeaders });
        }

        const orgId = studio.org_id;

        // 2. Fetch settings first (tournaments/news are meant to be public teaser
        // content regardless of login). Everything else is per-student data and
        // must not be handed out until a phone match confirms who's asking.
        const { data: settingsData } = await supabase
            .from('studio_settings').select('staff_data').eq('org_id', orgId).maybeSingle();
        const staffData = settingsData?.staff_data || {};
        const portalTournaments = staffData.portal_tournaments || [];
        const portalNews = staffData.portal_news || [];

        const baseResult = {
            studio: { name: studio.studio_name, slug: studio.studio_slug },
            tournaments: portalTournaments,
            news: portalNews,
        };

        if (!phone) {
            return NextResponse.json({ ...baseResult, students: [], subscriptions: [], attendance: [], groups: [], matchedStudent: null }, { headers: corsHeaders });
        }

        // 3. Find the matching student by phone before releasing any student data
        const { data: students } = await supabase
            .from('students').select('id, first_name, last_name, full_name, phone, status, data').eq('org_id', orgId);

        const cleaned = phone.replace(/\D/g, '');
        const match = (students || []).find((s: any) => {
            const p1 = (s.phone || '').replace(/\D/g, '');
            const p2 = (s.data?.phone || '').replace(/\D/g, '');
            const p3 = (s.data?.parent_phone || '').replace(/\D/g, '');
            return [p1, p2, p3].some(p => p && (p.includes(cleaned) || (cleaned.length >= 9 && p.endsWith(cleaned.slice(-9)))));
        });

        if (!match) {
            return NextResponse.json({ ...baseResult, students: [], subscriptions: [], attendance: [], groups: [], matchedStudent: null }, { headers: corsHeaders });
        }

        // 4. Phone matched a real student in this studio -- now it's safe to
        // release the full portal dataset the external portal expects.
        const [subsRes, attRes, groupsRes] = await Promise.all([
            supabase.from('subscriptions').select('id, student_id, sessions_total, sessions_used, expires_at, starts_at, data').eq('org_id', orgId),
            supabase.from('attendance').select('id, student_id, date, status, data').eq('org_id', orgId),
            supabase.from('groups').select('id, name, data').eq('org_id', orgId),
        ]);

        return NextResponse.json({
            ...baseResult,
            students,
            subscriptions: subsRes.data || [],
            attendance: attRes.data || [],
            groups: groupsRes.data || [],
            matchedStudent: match.id,
        }, { headers: corsHeaders });

    } catch (err: any) {
        console.error('❌ [StudentPortal API] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
}
