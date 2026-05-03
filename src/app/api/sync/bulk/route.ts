import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { table, rows, slug } = body;

        if (!table || !rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        console.log(`📡 [BulkSync API] Pushing ${rows.length} rows to ${table} for ${slug}`);

        // Perform bulk upsert via Admin SDK to bypass RLS
        const { error } = await supabaseAdmin
            .from(table)
            .upsert(rows);

        if (error) {
            console.error(`❌ [BulkSync API] Error pushing to ${table}:`, error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('❌ [BulkSync API] Runtime Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
