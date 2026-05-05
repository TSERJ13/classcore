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

// 🛡️ MINIMAL columns that DEFINITELY exist in every table
// Anything else is dropped to prevent "column not found" errors
const MINIMAL_COLUMNS: Record<string, string[]> = {
    students: ['id', 'org_id', 'first_name', 'last_name', 'full_name', 'phone', 'email'],
    staff: ['id', 'org_id', 'full_name', 'email', 'phone', 'role'],
    groups: ['id', 'org_id', 'name', 'teacher_id', 'hall_id'],
    halls: ['id', 'org_id', 'name'],
    branches: ['id', 'org_id', 'name', 'address'],
    calendar_events: ['id', 'org_id', 'title', 'date', 'start_time', 'end_time'],
    subscriptions: ['id', 'org_id', 'student_id'],
    subscription_plans: ['id', 'org_id', 'name'],
    attendance: ['id', 'org_id', 'student_id', 'date'],
    products: ['id', 'org_id', 'name'],
    sales: ['id', 'org_id', 'student_id'],
    expenses: ['id', 'org_id'],
    studio_settings: ['org_id'],
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
    const { error } = await supabaseAdmin.from(table).upsert(cleanRows);
    return error;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { table, rows, slug } = body;

        if (!table || !rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
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
