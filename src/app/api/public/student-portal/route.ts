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

        // 2. Fetch students, subscriptions, attendance, groups
        const [studentsRes, subsRes, attRes, groupsRes] = await Promise.all([
            supabase.from('students').select('id, first_name, last_name, full_name, phone, status, data').eq('org_id', orgId),
            supabase.from('subscriptions').select('id, student_id, sessions_total, sessions_used, expires_at, starts_at, data').eq('org_id', orgId),
            supabase.from('attendance').select('id, student_id, date, status, data').eq('org_id', orgId),
            supabase.from('groups').select('id, name, data').eq('org_id', orgId),
        ]);

        const result: any = {
            studio: {
                name: studio.studio_name,
                slug: studio.studio_slug,
            },
            students: studentsRes.data || [],
            subscriptions: subsRes.data || [],
            attendance: attRes.data || [],
            groups: groupsRes.data || [],
        };

        // 3. If phone provided, find matching student (login)
        if (phone) {
            const cleaned = phone.replace(/\D/g, '');
            const match = (studentsRes.data || []).find((s: any) => {
                const p1 = (s.phone || '').replace(/\D/g, '');
                const p2 = (s.data?.phone || '').replace(/\D/g, '');
                const p3 = (s.data?.parent_phone || '').replace(/\D/g, '');
                return [p1, p2, p3].some(p => p && (p.includes(cleaned) || (cleaned.length >= 9 && p.endsWith(cleaned.slice(-9)))));
            });
            result.matchedStudent = match ? match.id : null;
        }

        return NextResponse.json(result, { headers: corsHeaders });

    } catch (err: any) {
        console.error('❌ [StudentPortal API] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
}
