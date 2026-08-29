import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSessionOrgContext } from '@/lib/session-check';

export const dynamic = 'force-dynamic';

/**
 * Sends an SMS and logs it. Previously logs were appended to a shared
 * repo-root JSON file with no org scoping (see /api/sms/logs/route.ts for
 * the full writeup) and this endpoint was gated only by a forgeable
 * cookie, so anyone could send SMS as "ClassCore" to any number, and every
 * failed/succeeded send from every studio landed in one file readable by
 * anyone with that same forged cookie.
 *
 * Now requires a real session and stamps every log row with the caller's
 * own org_id in a Supabase `sms_logs` table (see the SQL migration in the
 * accompanying report).
 */

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function saveLog(orgId: string | null, logEntry: any) {
    try {
        await supabaseAdmin.from('sms_logs').insert({
            org_id: orgId,
            student_name: logEntry.studentName,
            to_number: logEntry.to,
            text: logEntry.text,
            status: logEntry.status,
            error: logEntry.error || null,
            timestamp: logEntry.timestamp,
        });
    } catch (e) {
        console.error('Failed to save SMS log', e);
    }
}

export async function POST(req: Request) {
    let to, text, studentName;
    let orgId: string | null = null;
    try {
        const ctx = await getSessionOrgContext();
        if (!ctx) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        orgId = ctx.orgId;
        if (!orgId && ctx.slug) {
            const { data } = await supabaseAdmin.from('studios').select('org_id').eq('studio_slug', ctx.slug).maybeSingle();
            orgId = data?.org_id || null;
        }

        const body = await req.json();
        to = body.to;
        text = body.text;
        studentName = body.studentName || 'უცნობი';

        if (!to || !text) {
            await saveLog(orgId, {
                timestamp: new Date().toISOString(),
                studentName,
                to: to || 'Unknown',
                text: text || '',
                status: 'error',
                error: 'Missing "to" or "text"'
            });
            return NextResponse.json({ success: false, error: 'Missing "to" or "text"' }, { status: 400 });
        }

        const apiKey = process.env.GOSMS_API_KEY;
        const from = process.env.NEXT_PUBLIC_GOSMS_SENDER_ID || 'ClassCore';

        if (!apiKey) {
            await saveLog(orgId, {
                timestamp: new Date().toISOString(),
                studentName,
                to,
                text,
                status: 'error',
                error: 'Server configuration error (API Key missing)'
            });
            console.error('Missing GOSMS_API_KEY environment variable');
            return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
        }

        const response = await fetch('https://api.gosms.ge/api/sendsms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: apiKey,
                from: from,
                to: to,
                text: text
            }),
        });

        const data = await response.json();
        const isSuccess = data.success || (Array.isArray(data) && data[0]?.success);

        if (!response.ok || !isSuccess) {
            console.error('GOSMS Error:', data);
            await saveLog(orgId, {
                timestamp: new Date().toISOString(),
                studentName,
                to,
                text,
                status: 'error',
                error: data.error || (Array.isArray(data) && data[0]?.error) || 'Failed to send SMS'
            });
            return NextResponse.json({ success: false, error: data.error || 'Failed to send SMS' }, { status: response.status || 500 });
        }

        await saveLog(orgId, {
            timestamp: new Date().toISOString(),
            studentName,
            to,
            text,
            status: 'success'
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error('SMS Send Error:', error);
        await saveLog(orgId, {
            timestamp: new Date().toISOString(),
            studentName: studentName || 'უცნობი',
            to: to || 'Unknown',
            text: text || '',
            status: 'error',
            error: 'Internal server error'
        });
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
