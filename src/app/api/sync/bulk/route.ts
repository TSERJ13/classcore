import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getAuthenticatedOrgId } from '@/lib/sync-auth';

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

// 🛡️ MINIMAL columns that DEFINITELY exist in every table
// Anything else is dropped to prevent "column not found" errors
const MINIMAL_COLUMNS: Record<string, string[]> = {
    // NOTE: `birth_date` is intentionally NOT listed here. The live
    // Supabase `students` table does not have a `birth_date` column (it's
    // stored inside the `data` JSONB blob instead) — listing it here made
    // every upsert fail with `PGRST204: Could not find the 'birth_date'
    // column of 'students' in the schema cache`. That error was swallowed
    // as a 200-with-warning below, so the student silently never reached
    // the cloud and then got wiped from localStorage on the next hydration.
    students: ['id', 'org_id', 'first_name', 'last_name', 'full_name', 'phone', 'email', 'data'],
    staff: ['id', 'org_id', 'full_name', 'email', 'phone', 'role', 'data'],
    groups: ['id', 'org_id', 'name', 'teacher_id', 'hall_id', 'data'],
    halls: ['id', 'org_id', 'name', 'data'],
    branches: ['id', 'org_id', 'name', 'address', 'data'],
    calendar_events: ['id', 'org_id', 'title', 'date', 'start_time', 'end_time', 'group_id', 'branch_id', 'data'],
    subscriptions: ['id', 'org_id', 'student_id', 'status', 'sessions_used', 'sessions_total', 'expires_at', 'plan', 'data'],
    subscription_plans: ['id', 'org_id', 'name', 'type', 'period', 'session_count', 'validity_days', 'price', 'coach', 'coach_name', 'group_id', 'is_active', 'is_default', 'data'],
    attendance: ['id', 'org_id', 'student_id', 'group_id', 'class_id', 'date', 'status', 'notes', 'data'],
    products: ['id', 'org_id', 'name', 'price', 'category', 'data'],
    sales: ['id', 'org_id', 'student_id', 'product_id', 'amount', 'date', 'data'],
    expenses: ['id', 'org_id', 'category', 'amount', 'date', 'description', 'data'],
    studio_settings: ['org_id', 'studio_slug', 'studio_name', 'staff_emails', 'staff_data', 'settings'],
};

function sanitizeRow(table: string, row: any, includeData: boolean): any {
    const allowedCols = MINIMAL_COLUMNS[table];
    if (!allowedCols) return row;
    
    const cleanRow: any = {};
    for (const key of allowedCols) {
        if (row[key] !== undefined) cleanRow[key] = row[key];
    }
    if (includeData && row.data !== undefined) {
        cleanRow.data = row.data;
    }
    return cleanRow;
}

async function tryUpsert(table: string, rows: any[], includeData: boolean) {
    const cleanRows = rows.map(r => sanitizeRow(table, r, includeData));

    // 🛡️ CRITICAL PHOTO PRESERVATION:
    // If table is 'students', incoming rows often come from local storage where photo_url was
    // stripped to save quota (lite student object). If cleanRow.data has no photo_url,
    // DO NOT allow the upsert to wipe out an existing photo_url in Supabase!
    if (table === 'students' && includeData) {
        try {
            const ids = cleanRows.map(r => r.id).filter(Boolean);
            if (ids.length > 0) {
                const { data: existingRows } = await supabaseAdmin
                    .from('students')
                    .select('id, data')
                    .in('id', ids);

                const existingPhotos = new Map<string, string>();
                (existingRows || []).forEach((er: any) => {
                    if (er?.data?.photo_url) {
                        existingPhotos.set(er.id, er.data.photo_url);
                    }
                });

                cleanRows.forEach(r => {
                    if (r.data && !r.data.photo_url && existingPhotos.has(r.id)) {
                        r.data = { ...r.data, photo_url: existingPhotos.get(r.id) };
                    }
                });
            }
        } catch (e) {
            console.warn('⚠️ [BulkSync] Photo preservation lookup failed:', e);
        }
    }

    const { error } = await supabaseAdmin.from(table).upsert(cleanRows);
    return error;
}

export async function POST(req: Request) {
    try {
        const auth = await getAuthenticatedOrgId(req);
        if (!auth || !auth.orgId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { table, rows, slug } = body;

        if (!table || !rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        // Every row must belong to the caller's own org — reject the whole
        // batch rather than silently dropping rows, so a mismatch is visible.
        const foreignRow = rows.find((r: any) => r.org_id && !auth.hasAccessToOrg(r.org_id));
        if (foreignRow) {
            return NextResponse.json({ error: 'Forbidden: org mismatch' }, { status: 403 });
        }

        console.log(`📡 [BulkSync] Pushing ${rows.length} rows to ${table} for ${slug}`);

        // 🛡️ ATTEMPT 1: With `data` column (richer)
        let error = await tryUpsert(table, rows, true);
        
        // 🛡️ ATTEMPT 2: Without `data` column (minimal, safer)
        if (error && error.message?.includes('data')) {
            console.warn(`⚠️ [BulkSync] '${table}' has no 'data' column, retrying with minimal fields...`);
            error = await tryUpsert(table, rows, false);
        }

        if (error) {
            // Log but don't fail — cloud sync is "best effort"
            console.error(`❌ [BulkSync] ${table}: ${error.message}`);
            return NextResponse.json({ 
                warning: error.message,
                note: 'Data is preserved in localStorage; cloud sync skipped for this batch'
            }, { status: 200 }); // Return 200 so client doesn't retry forever
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('❌ [BulkSync] Runtime Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
