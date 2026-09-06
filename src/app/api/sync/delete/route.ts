import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getAuthenticatedOrgId } from '@/lib/sync-auth';

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
        const auth = await getAuthenticatedOrgId(req);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { table, id, ids, orgId } = body as { table?: string; id?: string; ids?: string[]; orgId?: string };

        if (!table || !ALLOWED_TABLES.has(table)) {
            return NextResponse.json({ error: 'Invalid or missing table' }, { status: 400 });
        }

        if (!orgId || !auth.hasAccessToOrg(orgId)) {
            return NextResponse.json({ error: 'Forbidden: org mismatch' }, { status: 403 });
        }

        const idList = ids && Array.isArray(ids) ? ids : (id ? [id] : []);
        if (idList.length === 0) {
            return NextResponse.json({ error: 'id or ids required' }, { status: 400 });
        }

        // 🛠️ FIX: this used to scope the delete by `auth.orgId` — the CALLER'S
        // PRIMARY org (allowedOrgIds[0]) — while the check just above validates
        // the REQUEST's `orgId` against the caller's full allowedOrgIds list.
        // A caller whose staff-table membership resolves to more than one org
        // (legitimate: multi-studio staff, or studio_slug/org mismatches during
        // hydration) could pass hasAccessToOrg(orgId) for a SECONDARY org while
        // this `.eq()` kept filtering by the primary one — the delete then
        // silently matched 0 rows in the wrong org, yet still reported
        // `success: true`. The client (deleteRecordFromCloud) takes that as
        // confirmation and removes the row locally, so the "deleted" record
        // survives in Supabase and reappears on the next hydration. Use the
        // already-validated `orgId` instead, and select the affected rows so a
        // genuine no-op (id simply didn't exist, or truly didn't match this
        // org) is visible in the response rather than silently reported as if
        // it had deleted something.
        const { data: deletedRows, error } = await supabaseAdmin
            .from(table)
            .delete()
            .eq('org_id', orgId)
            .in('id', idList)
            .select('id');

        if (error) {
            console.error(`❌ [DeleteSync API] ${table}:`, error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const deletedCount = deletedRows?.length ?? 0;
        if (deletedCount < idList.length) {
            console.warn(`⚠️ [DeleteSync API] ${table}: requested ${idList.length} id(s), only ${deletedCount} actually matched org ${orgId} and were deleted.`);
        }

        console.log(`🗑️ [DeleteSync API] Deleted ${deletedCount} row(s) from ${table}`);
        return NextResponse.json({ success: true, deleted: deletedCount, requested: idList.length });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
    }
}
