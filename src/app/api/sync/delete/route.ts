import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Server-side delete using the SERVICE ROLE key (bypasses RLS).
 *
 * Why this exists: deletes used to run from the browser client (anon key), which
 * is subject to Row Level Security. Reads work because hydration goes through an
 * admin API route — but a browser DELETE that RLS blocks removes 0 rows and
 * returns no error, so the record survived in the cloud and "came back" on the
 * next refresh. Routing the delete through the service role removes the row for
 * real, every time.
 */
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

// Only allow deletes on known data tables (safety).
const ALLOWED_TABLES = new Set([
    'students',
    'subscriptions',
    'attendance',
    'groups',
    'staff',
    'calendar_events',
    'subscription_plans',
    'products',
    'halls',
    'branches',
]);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { table, id, ids } = body as { table?: string; id?: string; ids?: string[] };

        if (!table || !ALLOWED_TABLES.has(table)) {
            return NextResponse.json({ error: 'Invalid or missing table' }, { status: 400 });
        }

        const idList = ids && Array.isArray(ids) ? ids : (id ? [id] : []);
        if (idList.length === 0) {
            return NextResponse.json({ error: 'id or ids required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from(table)
            .delete()
            .in('id', idList);

        if (error) {
            console.error(`❌ [DeleteSync API] ${table}:`, error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log(`🗑️ [DeleteSync API] Deleted ${idList.length} row(s) from ${table}`);
        return NextResponse.json({ success: true, deleted: idList.length });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
    }
}
