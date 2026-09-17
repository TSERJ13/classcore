'use server';

/**
 * Server Actions for the Subscriptions module — replaces subscription-store.ts's
 * localStorage-first write path (saveSubscription/deleteSubscription/
 * pauseActiveSubscription) for the real /subscriptions page. See
 * docs/architecture-migration.md §8.
 *
 * SCHEMA NOTE: `subscriptions` only has a handful of real top-level columns —
 * `id, org_id, student_id, status, sessions_used, sessions_total, starts_at,
 * expires_at, price, data` — everything else (plan name, plan_id, plan_type,
 * category, purchased_at, payment_method, amount_paid, teacher_id, schedule,
 * color, is_default, paused_at, pause_days, teacher_comment, ...) lives in
 * `data`, matching subscription-store.ts's saveSubscription(), which pushes
 * the entire SubscriptionInfo object into `data` alongside the few real
 * columns. Kept that way here rather than guessing extra top-level columns
 * exist (see students.ts's PGRST204 note for why that's the wrong default).
 *
 * A couple/individual-pair subscription stores `student_id` as a literal
 * comma-joined string ("id1, id2") — same as elsewhere in this migration
 * (see checkin.ts's fetchStudentSubs) — so any lookup "does this row belong
 * to student X" has to split on comma, not do an exact match.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function requireOrgId(): Promise<{ orgId: string; userId: string }> {
    const supabase = await createClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) throw new Error('Not authenticated');

    const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', userData.user.id)
        .maybeSingle();
    if (profileErr || !profile?.org_id) throw new Error('No org for this user');

    return { orgId: profile.org_id, userId: userData.user.id };
}

// ─── Feature gating (mirrors settings-store.ts's isFeatureEnabled()) ───────

const FEATURE_BY_PLAN_TYPE: Record<string, string | null> = {
    group: null, // never gated
    personal: 'personalPlans',
    individual: 'individualLessons',
    rental: 'hallRental',
};

async function getEnabledFeatures(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<Record<string, unknown>> {
    const { data } = await supabase.from('studio_settings').select('staff_data').eq('org_id', orgId).maybeSingle();
    const blob = (data?.staff_data as Record<string, unknown> | null)?.['_operations'] as Record<string, unknown> | undefined;
    const settings = blob?.['cc_studio_settings'] as Record<string, unknown> | undefined;
    const features = settings?.['enabledFeatures'];
    return (features && typeof features === 'object') ? features as Record<string, unknown> : {};
}

/** undefined/missing = enabled, matching isFeatureEnabled()'s "only an explicit false disables" semantics. */
function assertPlanTypeAllowed(features: Record<string, unknown>, planType: string | undefined): void {
    const key = planType ? FEATURE_BY_PLAN_TYPE[planType] : null;
    if (key && features[key] === false) {
        throw new Error(`This studio has disabled the "${planType}" subscription type.`);
    }
}

// ─── Read ───────────────────────────────────────────────────────────────────

export type SubscriptionRow = {
    id: string;
    student_id: string;
    status: string;
    sessions_used: number;
    sessions_total: number | null;
    starts_at: string | null;
    expires_at: string;
    price: number | null;
    [key: string]: unknown; // everything from `data` (plan, plan_type, purchased_at, ...)
};

function rowFromDb(r: { id: string; student_id: string; status: string; sessions_used: number; sessions_total: number | null; starts_at: string | null; expires_at: string; price: number | null; data: Record<string, unknown> | null }): SubscriptionRow {
    return {
        ...(r.data || {}),
        id: r.id, student_id: r.student_id, status: r.status,
        sessions_used: r.sessions_used, sessions_total: r.sessions_total,
        starts_at: r.starts_at, expires_at: r.expires_at, price: r.price,
    };
}

/** Full org-scoped list, same shape subscription-store.ts's getUniqueSubscriptions() returned — one row per subscription id, no pagination (matches legacy /subscriptions page behavior). */
export async function getSubscriptionsAction(): Promise<SubscriptionRow[]> {
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    await supabase.rpc('expire_overdue_subscriptions');

    const { data, error } = await supabase
        .from('subscriptions')
        .select('id, student_id, status, sessions_used, sessions_total, starts_at, expires_at, price, data')
        .eq('org_id', orgId);
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowFromDb);
}

// ─── Issue (create) ─────────────────────────────────────────────────────────

const issueSchema = z.object({
    student_id: z.string().min(1),
    status: z.enum(['active', 'paused', 'cancelled', 'expired']).default('active'),
    sessions_used: z.number().int().min(0).default(0),
    sessions_total: z.number().int().min(0).nullable().optional(),
    starts_at: z.string().optional(),
    expires_at: z.string(),
    price: z.number().optional(),
    plan_type: z.enum(['group', 'personal', 'individual', 'rental']).optional(),
}).passthrough();

export async function issueSubscriptionAction(rawInput: unknown): Promise<{ id: string }> {
    const input = issueSchema.parse(rawInput);
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    const features = await getEnabledFeatures(supabase, orgId);
    assertPlanTypeAllowed(features, input.plan_type);

    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const nowIso = new Date().toISOString();
    const fullRecord = { ...input, id, created_at: nowIso, starts_at: input.starts_at || (input as Record<string, unknown>).purchased_at || nowIso };

    const { error } = await supabase.from('subscriptions').insert({
        id, org_id: orgId, student_id: input.student_id, status: input.status,
        sessions_used: input.sessions_used, sessions_total: input.sessions_total ?? null,
        starts_at: fullRecord.starts_at as string, expires_at: input.expires_at, price: input.price ?? null,
        data: fullRecord,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/subscriptions');
    return { id };
}

// ─── Update (edit form save) ────────────────────────────────────────────────

const updateSchema = z.object({
    id: z.string().min(1),
    student_id: z.string().min(1),
    status: z.enum(['active', 'paused', 'cancelled', 'expired']).default('active'),
    sessions_used: z.number().int().min(0).default(0),
    sessions_total: z.number().int().min(0).nullable().optional(),
    starts_at: z.string().optional(),
    expires_at: z.string(),
    price: z.number().optional(),
}).passthrough();

export async function updateSubscriptionAction(rawInput: unknown): Promise<void> {
    const input = updateSchema.parse(rawInput);
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    const { error } = await supabase.from('subscriptions')
        .update({
            student_id: input.student_id, status: input.status,
            sessions_used: input.sessions_used, sessions_total: input.sessions_total ?? null,
            starts_at: input.starts_at || null, expires_at: input.expires_at, price: input.price ?? null,
            data: input,
        })
        .eq('id', input.id).eq('org_id', orgId);
    if (error) throw new Error(error.message);

    revalidatePath('/subscriptions');
}

// ─── Pause (SubscriptionModal's inline freeze action) ──────────────────────

const pauseSchema = z.object({
    studentId: z.string().min(1),
    subId: z.string().min(1),
    days: z.number().int().min(1),
    price: z.number().min(0).default(0),
});

export async function pauseSubscriptionAction(rawInput: unknown): Promise<void> {
    const input = pauseSchema.parse(rawInput);
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    const { data: sub, error: fetchErr } = await supabase
        .from('subscriptions').select('expires_at, data')
        .eq('id', input.subId).eq('org_id', orgId).maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!sub) throw new Error('Subscription not found');

    const newExpires = new Date(sub.expires_at as string);
    newExpires.setDate(newExpires.getDate() + input.days);
    const newExpiresStr = newExpires.toISOString().split('T')[0];
    const nowStr = new Date().toISOString().split('T')[0];

    const newData = { ...(sub.data as Record<string, unknown> || {}), status: 'paused', expires_at: newExpiresStr, paused_at: nowStr, pause_days: input.days };

    const { error: updateErr } = await supabase.from('subscriptions')
        .update({ status: 'paused', expires_at: newExpiresStr, data: newData })
        .eq('id', input.subId).eq('org_id', orgId);
    if (updateErr) throw new Error(updateErr.message);

    if (input.price > 0) {
        const { data: student, error: studentErr } = await supabase
            .from('students').select('data').eq('id', input.studentId).eq('org_id', orgId).maybeSingle();
        if (!studentErr && student) {
            const studentData = (student.data as Record<string, unknown>) || {};
            const currentBalance = Number(studentData.balance) || 0;
            await supabase.from('students')
                .update({ data: { ...studentData, balance: currentBalance - input.price } })
                .eq('id', input.studentId).eq('org_id', orgId);
        }
    }

    revalidatePath('/subscriptions');
}

// ─── Delete ─────────────────────────────────────────────────────────────────

const deleteSchema = z.object({ studentId: z.string().min(1), subId: z.string().min(1) });

export type DeleteSubscriptionResult = { planType: string | null; studentId: string };

/** Returns the deleted sub's plan_type/student_id so the caller can still run its individual-lesson calendar-event cleanup, same as the legacy handleDelete() did. */
export async function deleteSubscriptionAction(rawInput: unknown): Promise<DeleteSubscriptionResult> {
    const input = deleteSchema.parse(rawInput);
    const { orgId } = await requireOrgId();
    const supabase = await createClient();

    const { data: sub } = await supabase
        .from('subscriptions').select('student_id, data')
        .eq('id', input.subId).eq('org_id', orgId).maybeSingle();

    const { error } = await supabase.from('subscriptions').delete().eq('id', input.subId).eq('org_id', orgId);
    if (error) throw new Error(error.message);

    revalidatePath('/subscriptions');
    return {
        planType: (sub?.data as Record<string, unknown> | undefined)?.plan_type as string || null,
        studentId: (sub?.student_id as string) || input.studentId,
    };
}
