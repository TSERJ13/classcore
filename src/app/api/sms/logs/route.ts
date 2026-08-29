import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSessionOrgContext } from '@/lib/session-check';

export const dynamic = 'force-dynamic';

/**
 * Previously this read the ENTIRE contents of a single shared
 * `.sms-logs.json` file on disk — every studio's customer names, phone
 * numbers and SMS text, with no per-studio filtering at all — gated only
 * by a forgeable `cc_staff_auth` cookie. Any visitor could set that
 * cookie in devtools and download every studio's customer contact list.
 *
 * That file also lived at the repo root and ended up committed to git —
 * see the diagnostic report. Filesystem writes are unreliable on
 * serverless hosting anyway (ephemeral disk).
 *
 * This now requires a real session (getSessionOrgContext) and reads from
 * a Supabase `sms_logs` table, scoped to the caller's own org. See the
 * SQL in the accompanying report for the table this expects — it must be
 * created (with RLS) before this route will return data instead of
 * erroring.
 */

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
    try {
        const ctx = await getSessionOrgContext();
        if (!ctx) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        let orgId = ctx.orgId;
        if (!orgId && ctx.slug) {
            const { data } = await supabaseAdmin.from('studios').select('org_id').eq('studio_slug', ctx.slug).maybeSingle();
            orgId = data?.org_id || null;
        }
        if (!orgId) {
            return NextResponse.json({ success: false, error: 'Could not resolve org for this session' }, { status: 403 });
        }

        const { data, error } = await supabaseAdmin
            .from('sms_logs')
            .select('*')
            .eq('org_id', orgId)
            .order('timestamp', { ascending: false })
            .limit(1000);

        if (error) {
            console.error('Error fetching SMS logs:', error.message);
            return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
        }

        return NextResponse.json({ success: true, logs: data || [] });
    } catch (error) {
        console.error('Error fetching SMS logs:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
