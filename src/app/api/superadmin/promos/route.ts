import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function admin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(url, key);
}

const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

// List all promo codes
export async function GET() {
    try {
        const { data, error } = await admin()
            .from('promo_codes')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return NextResponse.json({ promos: data || [] }, { headers: noStore });
    } catch (err: any) {
        return NextResponse.json({ promos: [], error: err.message }, { headers: noStore });
    }
}

// Create / upsert a promo code
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const code = String(body.code || '').toUpperCase().trim();
        if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });

        const row = {
            code,
            discount: Number(body.discount) || 0,
            type: body.type === 'fixed' ? 'fixed' : 'percent',
            single_use: !!body.singleUse,
            max_uses: Number(body.maxUses) || 0,
            used_count: 0,
        };
        const { error } = await admin().from('promo_codes').upsert(row, { onConflict: 'code' });
        if (error) throw error;
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}

// Delete a promo code: /api/superadmin/promos?code=XYZ
export async function DELETE(req: NextRequest) {
    try {
        const code = new URL(req.url).searchParams.get('code');
        if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });
        const { error } = await admin().from('promo_codes').delete().eq('code', code.toUpperCase());
        if (error) throw error;
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
