'use server';

/**
 * Server Actions for Calendar/Events — a deliberately narrow slice of
 * docs/architecture-migration.md §12, which explains in detail why a full
 * port was left undone: no real per-occurrence identity for recurring
 * events (editing/deleting a future week or an individual lesson today
 * either silently no-ops or wrongly mutates the whole series), pervasive
 * teacher self-service writes across the module (not just calendar/page.tsx
 * — booking their own lessons, publishing their own availability), and a
 * timestamp-vs-HH:MM schema mismatch. None of that is fixed here — this
 * pass does NOT touch occurrence semantics.
 *
 * Scoped to exactly the 4 operations calendar/page.tsx itself performs on a
 * REAL, addressable calendar_events row — create a one-off/group-class
 * event, update one, delete one, delete a batch (its own
 * deleteAllGroupOccurrences, which only ever matches concrete rows sharing
 * a group_id+start_time+end_time). These previously went through
 * event-store.ts's saveEvents()/tombstoneAndDeleteFromCloud(), which fire a
 * best-effort request at the service-role `/api/sync/bulk` endpoint with no
 * round-trip confirmation and no server-side permission check beyond "is
 * this a valid session for some org" — a permission-denied or
 * validation failure there is completely silent, the same failure shape
 * the branches module had (see docs/tasks.md's entry on that fix).
 *
 * These actions are called ADDITIONALLY, alongside (not instead of) the
 * existing event-store.ts write — that local-cache write stays exactly as
 * it is, unchanged, still driving calendar/page.tsx's own optimistic UI and
 * every other consumer's eventual-consistency-via-hydration read (Groups'
 * migration made the same call for its own read-only consumers). What this
 * adds is a real, awaitable, permission-checked round trip: a genuine
 * failure here (permission denial, validation, a DB constraint) now
 * surfaces to the user instead of being silently swallowed, even though —
 * given the local write already ran — it doesn't roll anything back. Full
 * replacement of the local write (and the state-consistency work that
 * requires across calendar/page.tsx's drag/drop and cross-page consumers)
 * is left for a follow-up pass that can actually be verified against a
 * running app.
 *
 * SCHEMA (confirmed via /api/sync/bulk's MINIMAL_COLUMNS + sanitizeRow):
 * `id, org_id, hall_id, group_id, title, start_time, end_time` (the last
 * two as real timestamptz columns) plus `data` (JSONB, the full in-memory
 * event — which stores `date` as YYYY-MM-DD and `start_time`/`end_time` as
 * HH:MM inside it). The top-level timestamp columns are derived
 * (`${date}T${HH:MM}:00Z`) purely for any consumer that queries them
 * directly; every read here reverses the same split event-store.ts's
 * getEvents() already performs on every local-storage read. No new RLS
 * migration needed — `calendar_events` already has full CRUD RLS (phase-0
 * gapfill migration's table array).
 *
 * WRITES use requireEffectivePermission('canEditCalendar')
 * (src/lib/permissions/enforce.ts) — teachers have canEditCalendar: true by
 * default (role-defaults.ts) via their staff-token session, which the old
 * service-role path never checked at all (any valid session could write
 * regardless of this flag).
 *
 * No read action here — calendar/page.tsx's own read stays on
 * event-store.ts's local cache (see the file-level comment above), so
 * there's nothing to call one yet; adding it unused ahead of that would be
 * speculative scaffolding this pass doesn't need.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireEffectivePermission } from '@/lib/permissions/enforce';
import { ok, fail, type ActionResult } from '@/lib/action-result';

function toIsoTimestamp(date: string, hhmm: string): string {
    return `${date}T${hhmm}:00Z`;
}

const calendarEventSchema = z.object({
    id: z.string().optional(),
    // Matches sanitizeRow's own fallback in /api/sync/bulk (`row.title ||
    // 'Event'`) rather than requiring a non-empty title — EventPopup's edit
    // form (unlike AddEventModal's create form) has no min-length guard, so
    // a stricter check here would reject an edit that already saved fine
    // locally and surface a spurious error for a no-op field.
    title: z.string().default(''),
    date: z.string().min(1),
    start_time: z.string().min(1),
    end_time: z.string().min(1),
    hall_id: z.string().optional(),
    group_id: z.string().optional(),
}).passthrough();

export async function createCalendarEventAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
    const parsed = calendarEventSchema.safeParse(rawInput);
    if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.message);
    const input = parsed.data;

    let ctx;
    try {
        ctx = await requireEffectivePermission('canEditCalendar');
    } catch (err) {
        return fail('PERMISSION_DENIED', err instanceof Error ? err.message : 'Permission denied');
    }
    const { orgId, client: supabase } = ctx;

    const id = input.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record = {
        id,
        org_id: orgId,
        hall_id: input.hall_id || null,
        group_id: input.group_id || null,
        title: input.title || 'Event',
        start_time: toIsoTimestamp(input.date, input.start_time),
        end_time: toIsoTimestamp(input.date, input.end_time),
        data: { ...input, id },
    };

    // Not a blind upsert: requireOrgIdDualAuth() hands staff-token sessions
    // a service-role client with no RLS, so an upsert's ON CONFLICT DO
    // UPDATE has no way to be scoped by org_id — a caller supplying
    // another org's existing event id would silently overwrite (hijack)
    // that org's row. Insert, but tolerate a duplicate-key conflict ONLY
    // when the existing row already belongs to THIS org — that's the
    // benign race with event-store.ts's own fire-and-forget write of the
    // same id (see file header), which has far fewer round trips than this
    // action's permission checks and often lands first.
    const { error } = await supabase.from('calendar_events').insert(record);
    if (error) {
        if (error.code === '23505') {
            const { data: existing, error: lookupError } = await supabase.from('calendar_events').select('org_id').eq('id', id).maybeSingle();
            // A failed lookup here is NOT evidence the row belongs to
            // another org — treat it as the transient DB error it is,
            // rather than falling through to a wrong ID_CONFLICT.
            if (lookupError) return fail('DB_ERROR', lookupError.message);
            if (existing?.org_id === orgId) {
                revalidatePath('/calendar');
                return ok({ id });
            }
            // Deliberately generic: confirming "this id belongs to another
            // org" vs. "this id is free" would let any caller enumerate
            // which specific event ids exist in OTHER orgs' data.
            return fail('ID_CONFLICT', 'Could not save event');
        }
        return fail('DB_ERROR', error.message);
    }

    revalidatePath('/calendar');
    return ok({ id });
}

const updateCalendarEventSchema = calendarEventSchema.extend({ id: z.string().min(1) });

export async function updateCalendarEventAction(rawInput: unknown): Promise<ActionResult<void>> {
    const parsed = updateCalendarEventSchema.safeParse(rawInput);
    if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.message);
    const input = parsed.data;

    let ctx;
    try {
        ctx = await requireEffectivePermission('canEditCalendar');
    } catch (err) {
        return fail('PERMISSION_DENIED', err instanceof Error ? err.message : 'Permission denied');
    }
    const { orgId, client: supabase } = ctx;

    // Deliberately NOT checking for a zero-row match here: this runs
    // alongside event-store.ts's own fire-and-forget write to the same row
    // (see file header) and has more round trips before it (the permission
    // checks above), so it can easily run second against a row the OTHER
    // path hasn't created yet — a real, benign race, not a failure worth
    // surfacing. A caller should only invoke this once it already believes
    // the row exists locally (calendar/page.tsx's updateEvent() gates on
    // `prev` for exactly this reason).
    const { error } = await supabase.from('calendar_events').update({
        hall_id: input.hall_id || null,
        group_id: input.group_id || null,
        title: input.title || 'Event',
        start_time: toIsoTimestamp(input.date, input.start_time),
        end_time: toIsoTimestamp(input.date, input.end_time),
        data: input,
    }).eq('id', input.id).eq('org_id', orgId);
    if (error) return fail('DB_ERROR', error.message);

    revalidatePath('/calendar');
    return ok(undefined);
}

const deleteCalendarEventSchema = z.object({ id: z.string().min(1) });

export async function deleteCalendarEventAction(rawInput: unknown): Promise<ActionResult<void>> {
    const parsed = deleteCalendarEventSchema.safeParse(rawInput);
    if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.message);

    let ctx;
    try {
        ctx = await requireEffectivePermission('canEditCalendar');
    } catch (err) {
        return fail('PERMISSION_DENIED', err instanceof Error ? err.message : 'Permission denied');
    }
    const { orgId, client: supabase } = ctx;

    // Same reasoning as updateCalendarEventAction above: no zero-row check
    // — this can legitimately race event-store.ts's own async
    // tombstoneAndDeleteFromCloud() deleting the same row first, and a
    // caller (deleteEvent()) only invokes this once `baseEv` already
    // confirms the row was real locally.
    const { error } = await supabase.from('calendar_events').delete()
        .eq('id', parsed.data.id).eq('org_id', orgId);
    if (error) return fail('DB_ERROR', error.message);

    revalidatePath('/calendar');
    return ok(undefined);
}

const deleteCalendarEventsSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });

/** Batch delete — backs calendar/page.tsx's deleteAllGroupOccurrences (all real rows sharing a group_id+start_time+end_time). */
export async function deleteCalendarEventsAction(rawInput: unknown): Promise<ActionResult<void>> {
    const parsed = deleteCalendarEventsSchema.safeParse(rawInput);
    if (!parsed.success) return fail('VALIDATION_ERROR', parsed.error.message);

    let ctx;
    try {
        ctx = await requireEffectivePermission('canEditCalendar');
    } catch (err) {
        return fail('PERMISSION_DENIED', err instanceof Error ? err.message : 'Permission denied');
    }
    const { orgId, client: supabase } = ctx;

    const { error } = await supabase.from('calendar_events').delete()
        .eq('org_id', orgId).in('id', parsed.data.ids);
    if (error) return fail('DB_ERROR', error.message);

    revalidatePath('/calendar');
    return ok(undefined);
}
