import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * GOSMS delivery-status webhook (SMS PRD §9 — "მიწოდების სტატუსი ... მიღებისთანავე
 * ავტომატურად აისახება ლოგებში"). Previously this appended every payload to a
 * repo-root `.sms-logs.json` file — the exact ephemeral-disk/no-scoping
 * pattern already fixed for /api/sms/send and /api/sms/logs (see those
 * routes' own comments) but missed here. On serverless hosting that file
 * is thrown away on every cold start, so no delivery status this webhook
 * ever received made it anywhere durable.
 *
 * Now updates the matching `sms_logs` row's `delivery_status` by
 * `provider_message_id` (captured at send time in /api/sms/send/route.ts).
 *
 * IMPORTANT — best-effort field detection: GOSMS's exact webhook payload
 * schema isn't documented anywhere in this repo, so both the message-id
 * field and the status field are matched against several plausible names
 * rather than one assumed shape. If GOSMS's real payload uses different
 * field names, this silently no-ops (logs a warning, updates nothing) —
 * never worse than the old behavior, but this should be corrected against
 * GOSMS's actual webhook documentation once available, rather than left
 * as a guess indefinitely.
 *
 * No request-signature verification — GOSMS doesn't appear to sign these
 * (nothing in this repo references a webhook secret for it). The update
 * is scoped to rows matching an existing `provider_message_id`, which is
 * an opaque value only GOSMS and this app know, so an attacker would need
 * to guess a live message id to affect a delivery-status flag — low
 * value, not a payment or auth path. Add real signature verification if
 * GOSMS ever documents one.
 */

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

type GosmsWebhookPayload = Record<string, unknown> | Array<Record<string, unknown>>;

function extractMessageId(payload: GosmsWebhookPayload): string | null {
    const first = Array.isArray(payload) ? payload[0] : payload;
    const id = first?.id ?? first?.message_id ?? first?.messageId;
    return id != null ? String(id) : null;
}

function extractDeliveryStatus(payload: GosmsWebhookPayload): 'delivered' | 'failed' | null {
    const first = Array.isArray(payload) ? payload[0] : payload;
    const raw = String(first?.status ?? first?.delivery_status ?? '').toUpperCase();
    if (['DELIVERED', 'DELIVRD', 'SUCCESS'].includes(raw)) return 'delivered';
    if (['FAILED', 'UNDELIV', 'REJECTED', 'EXPIRED', 'ERROR'].includes(raw)) return 'failed';
    return null;
}

export async function POST(req: Request) {
    try {
        const payload = await req.json();
        const messageId = extractMessageId(payload);
        const deliveryStatus = extractDeliveryStatus(payload);

        if (!messageId || !deliveryStatus) {
            console.warn('GOSMS webhook: could not match message id or status to a known shape', payload);
            return NextResponse.json({ success: true, matched: false });
        }

        const { error } = await supabaseAdmin.from('sms_logs')
            .update({ delivery_status: deliveryStatus })
            .eq('provider_message_id', messageId);
        if (error) {
            console.error('GOSMS webhook: failed to update sms_logs', error.message);
            return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
        }

        return NextResponse.json({ success: true, matched: true });
    } catch (error) {
        console.error('GOSMS webhook processing error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
