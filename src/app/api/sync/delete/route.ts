import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const { table, id, orgId } = await req.json();
        if (!table || !id || !orgId) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from(table)
            .delete()
            .eq('id', id)
            .eq('org_id', orgId);

        if (error) {
            console.error(`❌ [SyncDeleteAPI] Delete failed for ${table}:`, error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log(`✅ [SyncDeleteAPI] Deleted ${id} from ${table}`);
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('❌ [SyncDeleteAPI] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
