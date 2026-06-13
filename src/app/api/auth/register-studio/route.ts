import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Creates/updates the studios row with full owner_info at registration time,
 * using the service role (bypasses RLS). This is why a freshly-registered studio
 * shows complete owner details in the SuperAdmin panel immediately — instead of
 * waiting for the owner's first login to push metadata.
 */
export async function POST(req: NextRequest) {
    try {
        const { slug, studioName, owner, lang } = await req.json();
        if (!slug || !owner?.email) {
            return NextResponse.json({ error: 'Missing slug or owner email' }, { status: 400 });
        }

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
            // Not fatal for the user — first login will still push metadata later.
            return NextResponse.json({ ok: false, reason: 'no_service_role' }, { status: 200 });
        }
        const supabase = createClient(url, serviceKey);

        const ownerInfo = {
            first_name: owner.first_name || '',
            last_name: owner.last_name || '',
            full_name: `${owner.first_name || ''} ${owner.last_name || ''}`.trim(),
            email: owner.email,
            phone: owner.phone || '',
        };

        // 1) Upsert the studio master row (idempotent on slug).
        const { data: existing } = await supabase
            .from('studios')
            .select('org_id')
            .eq('studio_slug', slug)
            .maybeSingle();

        const { data: studioRow, error: upsertErr } = await supabase
            .from('studios')
            .upsert({
                studio_slug: slug,
                studio_name: studioName || slug,
                owner_info: ownerInfo,
                plan: 'trial',
            }, { onConflict: 'studio_slug' })
            .select('org_id')
            .maybeSingle();

        if (upsertErr) {
            return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 200 });
        }

        const orgId = studioRow?.org_id || existing?.org_id;

        // 2) Best-effort: ensure a profile row exists so the owner resolves even
        //    if owner_info is ever cleared. Non-fatal on failure.
        if (orgId) {
            try {
                await supabase.from('profiles').upsert({
                    org_id: orgId,
                    email: owner.email.toLowerCase().trim(),
                    role: 'owner',
                    first_name: ownerInfo.first_name,
                    last_name: ownerInfo.last_name,
                    full_name: ownerInfo.full_name,
                    phone: ownerInfo.phone,
                    primary_lang: lang || 'ka',
                }, { onConflict: 'email' });
            } catch { /* ignore */ }
        }

        return NextResponse.json({ ok: true, orgId });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
    }
}
