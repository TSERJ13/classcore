import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * SMS log retention enforcement (PRD §9/§10) — the app's first scheduled
 * job, run daily by Vercel Cron (see vercel.json). Deliberately opt-in per
 * org: only deletes `sms_logs` rows for a studio that has explicitly set
 * `smsManager.logRetentionDays` in its settings (types/index.ts) — an org
 * that never configured this is never touched, so nobody's SMS history
 * disappears without an admin choosing a number first.
 *
 * SCHEMA: traced the real save path end to end rather than guess —
 * sms-manager/page.tsx's handleSaveLogRetention() -> StudioContext's
 * updateSettings() -> master-sync.ts's pushFullStudioMetadata(), which
 * POSTs `{ settings: sanitizedSettings }` (sanitizedSettings ~= the whole
 * StudioSettings object, so `smsManager` is one of its top-level keys) to
 * /api/sync/metadata. That route does
 * `finalStaffData = { ...existingStaffData, ...settings, ... }`
 * (src/app/api/sync/metadata/route.ts) — i.e. `settings`' keys, including
 * `smsManager`, land at the TOP LEVEL of `studio_settings.staff_data`.
 * NOT `staff_data._operations.cc_studio_settings` (that nested blob is
 * only ever written by the superadmin panel's own update-meta route, a
 * different, unrelated write path) — got this wrong on the first two
 * passes, both caught by self-review before this ever ran against real
 * data. `studio_settings.settings` (tried on the very first pass) doesn't
 * exist as a column at all — that name belongs to the separate `studios`
 * table.
 *
 * Paginates the studio_settings read (Supabase/PostgREST default-caps a
 * plain select at 1000 rows) so retention doesn't silently stop working
 * once the studio count grows past that.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when that
 * env var is set on the project (Vercel's own documented convention) —
 * checked below so this route can't be triggered by an arbitrary request.
 * Set CRON_SECRET in the Vercel project's environment variables; this
 * route refuses to run without it configured.
 */

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

const PAGE_SIZE = 500;
// A studio's staff_data JSONB blob can carry a full base64 logoDataUrl —
// pulling the whole column daily just to read one nested number would
// drag that across the wire for every studio. PostgREST's `->` JSON path
// selection fetches only the smsManager sub-object instead.
const SETTINGS_SELECT = 'org_id, smsManager:staff_data->smsManager';

type SettingsRow = { org_id: string; smsManager: { logRetentionDays?: number } | null };

async function fetchAllStudioSettings(): Promise<SettingsRow[]> {
    const rows: SettingsRow[] = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabaseAdmin
            .from('studio_settings')
            .select(SETTINGS_SELECT)
            .order('org_id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;
        rows.push(...(data as unknown as SettingsRow[]));
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }
    return rows;
}

// Clamped to the same 1-3650 range the UI enforces (sms-manager/page.tsx) —
// defensive in case a stale/hand-edited settings blob ever holds something
// outside it, since an out-of-range value would otherwise produce an
// Invalid Date that throws out of the per-org loop below.
function getLogRetentionDays(smsManager: SettingsRow['smsManager']): number | undefined {
    const days = smsManager?.logRetentionDays;
    if (!days || !Number.isFinite(days) || days <= 0 || days > 3650) return undefined;
    return days;
}

export async function GET(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ success: false, error: 'CRON_SECRET not configured' }, { status: 500 });
    }
    if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let settingsRows: SettingsRow[];
    try {
        settingsRows = await fetchAllStudioSettings();
    } catch (e) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
    }

    const results: { orgId: string; retentionDays: number; deleted: number; error?: string }[] = [];

    for (const row of settingsRows) {
        const days = getLogRetentionDays(row.smsManager);
        if (!days) continue;

        // One org's failure (bad data, a transient Supabase error) must not
        // abort every org after it in this loop.
        //
        // KNOWN LIMITATION: each org's DELETE is unbounded — an org
        // enabling retention for the first time after years of
        // accumulated, never-purged logs could delete a very large number
        // of rows in one statement, risking the maxDuration budget above
        // and holding a write lock against the live /api/sms/send logging
        // path for that org. Not batched (e.g. delete in chunks with a
        // LIMIT, looping until none remain) because that needs verifying
        // against a live Supabase/PostgREST instance this environment
        // doesn't have — an unverified batching change risked being worse
        // than the plain unbounded delete. Revisit if an org's first
        // retention run is ever observed to run long.
        try {
            const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
            const { error: deleteError, count } = await supabaseAdmin
                .from('sms_logs')
                .delete({ count: 'exact' })
                .eq('org_id', row.org_id)
                .lt('timestamp', cutoff);

            results.push({
                orgId: row.org_id,
                retentionDays: days,
                deleted: count ?? 0,
                ...(deleteError ? { error: deleteError.message } : {}),
            });
        } catch (e) {
            results.push({
                orgId: row.org_id,
                retentionDays: days,
                deleted: 0,
                error: e instanceof Error ? e.message : 'Unknown error',
            });
        }
    }

    const attempted = results.length;
    const failed = results.filter(r => r.error).length;
    // Cron monitoring (Vercel's own, or anything watching this route) keys
    // off HTTP status — don't return 200 if every attempted delete failed,
    // or a permission/RLS regression on sms_logs goes silently unnoticed
    // instead of alerting.
    if (attempted > 0 && failed === attempted) {
        return NextResponse.json({ success: false, error: 'All deletes failed', results }, { status: 500 });
    }
    return NextResponse.json({ success: true, hasErrors: failed > 0, results });
}
