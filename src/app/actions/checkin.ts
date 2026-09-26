'use server';

/**
 * Server-driven replacement for checkin-store.ts's write path (see
 * docs/architecture-migration.md §7). Two-part design, on purpose:
 *
 * 1. "Which subscription do we charge?" — a faithful TypeScript port of
 *    subscription-store.ts's getSubscription()/refundSessionsUsed()
 *    candidate-selection logic (plan-type/group-id fallback tiers,
 *    "prioritize manual default", "oldest purchased for continuation" on
 *    charge; "most recently purchased with sessions_used>0" on refund).
 *    Kept in TypeScript, not SQL, specifically so it can be read side by
 *    side with the original and verified line by line — this exact logic
 *    has several non-obvious tie-break rules that would be much easier to
 *    get subtly wrong translating blind into PL/pgSQL.
 * 2. "Actually move the session count by one" — a small atomic RPC
 *    (`checkin_deduct_session` / `checkin_refund_session`,
 *    20260916_checkin_session_rpcs.sql) that locks the subscription row
 *    (`FOR UPDATE`) before incrementing/decrementing, so two admins marking
 *    the same student around the same moment can't both read the same
 *    stale count and silently under/over-charge a session — the race the
 *    old client-side "read, +1 locally, best-effort push to cloud" path
 *    had no protection against at all.
 *
 * Auth: uses requireOrgIdDualAuth() (src/lib/server-actions-auth.ts), not a
 * plain Supabase-Auth-only check — a staff/teacher marking attendance is
 * usually logged in via the PIN staff-token cookie, with no real Supabase
 * Auth session at all. This file previously required real Supabase Auth
 * unconditionally, so every check-in/uncheck from a staff-token session
 * threw "Not authenticated" before ever reaching the deduction RPC; the
 * attendance page's optimistic UI then rolled the checkmark back on the
 * caught error, which is what made it look like the check randomly failed.
 */

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireOrgIdDualAuth } from '@/lib/server-actions-auth';

type SubRow = {
    id: string;
    status: string;
    sessions_used: number;
    sessions_total: number | null;
    expires_at: string;
    data: Record<string, unknown> | null;
};

function subData(s: SubRow): Record<string, unknown> {
    return s.data || {};
}
function isIndividual(s: SubRow): boolean {
    const d = subData(s);
    return d.plan_type === 'individual' || String(d.category || '').toLowerCase() === 'individual';
}
function isRental(s: SubRow): boolean {
    return subData(s).plan_type === 'rental';
}

type PlanType = 'group' | 'personal' | 'individual' | 'rental' | undefined;

/** Port of subscription-store.ts's getSubscription() candidate selection. */
function resolveChargeSubscription(subs: SubRow[], asOfDate: string, groupId?: string, planType?: PlanType): SubRow | null {
    let candidates = subs.filter(s => s.status === 'active' && s.expires_at >= asOfDate);

    const effectivePlanType = planType || (groupId ? 'group' : undefined);
    if (effectivePlanType) {
        candidates = candidates.filter(s => {
            const ind = isIndividual(s), rent = isRental(s);
            if (effectivePlanType === 'individual') return ind;
            if (effectivePlanType === 'rental') return rent;
            if (effectivePlanType === 'group') return !ind && !rent;
            return true;
        });
    }

    const valid = candidates.filter(s => {
        const sGroupId = subData(s).group_id as string | undefined;
        if (groupId && sGroupId && sGroupId !== groupId) return false;
        const type = subData(s).type as string | undefined;
        const isSessionBased = type === 'sessions' || (s.sessions_total !== null && !type);
        if (isSessionBased) {
            if (s.sessions_total === null) return true;
            return (s.sessions_used || 0) < s.sessions_total;
        }
        return true; // monthly
    });
    if (valid.length === 0) return null;

    const manualDefault = valid.find(s => subData(s).is_default === true);
    if (manualDefault) return manualDefault;

    if (groupId) {
        const groupSpecific = valid.find(s => subData(s).group_id === groupId);
        if (groupSpecific) return groupSpecific;
    }

    return [...valid].sort((a, b) => {
        const pA = String(subData(a).purchased_at || a.expires_at || '');
        const pB = String(subData(b).purchased_at || b.expires_at || '');
        return pA.localeCompare(pB);
    })[0];
}

/** Port of subscription-store.ts's refundSessionsUsed() candidate selection. */
function resolveRefundSubscription(subs: SubRow[], groupId?: string, planType?: PlanType, subId?: string): SubRow | null {
    if (subId) {
        const target = subs.find(s => s.id === subId);
        if (target) return target;
    }

    let candidates = subs;
    const effectivePlanType = planType || (groupId ? 'group' : undefined);
    if (effectivePlanType) {
        candidates = candidates.filter(s => {
            const ind = isIndividual(s), rent = isRental(s);
            if (effectivePlanType === 'individual') return ind;
            if (effectivePlanType === 'rental') return rent;
            if (effectivePlanType === 'group') return !ind && !rent;
            return true;
        });
    }
    if (groupId) {
        const groupMatches = candidates.filter(s => subData(s).group_id === groupId);
        if (groupMatches.some(s => s.sessions_used > 0)) candidates = groupMatches;
    }

    const sorted = [...candidates].sort((a, b) =>
        String(subData(b).purchased_at || '').localeCompare(String(subData(a).purchased_at || '')));
    return sorted.find(s => s.sessions_used > 0) || null;
}

type SubRowWithStudent = SubRow & { student_id: string };

/**
 * A couple/individual-pair subscription stores `student_id` as a literal
 * comma-joined string ("id1, id2"), same as subscription-store.ts's
 * saveSubscription()/getStudentSubscriptions() — an exact `.eq('student_id',
 * studentId)` would silently miss it for either partner. Match the legacy
 * behavior: fetch every row whose student_id column contains this id as one
 * of its comma-separated tokens.
 */
async function fetchStudentSubs(supabase: SupabaseClient, orgId: string, studentId: string): Promise<SubRow[]> {
    const { data, error } = await supabase
        .from('subscriptions')
        .select('id, status, sessions_used, sessions_total, expires_at, data, student_id')
        .eq('org_id', orgId)
        .ilike('student_id', `%${studentId}%`);
    if (error) throw new Error(error.message);
    return ((data ?? []) as SubRowWithStudent[]).filter(row =>
        String(row.student_id || '').split(',').map(s => s.trim()).includes(studentId)
    );
}

function makeAttendanceId(studentId: string, date: string): string {
    return `att_${studentId}_${date}_${Date.now()}`;
}

// ─── Mark present (recordCheckin/forceCheckin equivalent) ─────────────────

const markPresentSchema = z.object({
    studentId: z.string().min(1),
    classId: z.string().optional(),
    groupId: z.string().optional(),
    subId: z.string().optional(),
    planType: z.enum(['group', 'personal', 'individual', 'rental']).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type MarkPresentResult = {
    attendanceId: string;
    sessionsRemaining: number;
    usedSubId: string | null;
    sessionsUsed: number | null;
    sessionsTotal: number | null;
};

export async function markPresentAction(rawInput: unknown): Promise<MarkPresentResult> {
    const input = markPresentSchema.parse(rawInput);
    const { orgId, client: supabase } = await requireOrgIdDualAuth();

    const subs = await fetchStudentSubs(supabase, orgId, input.studentId);
    const target = input.subId
        ? subs.find(s => s.id === input.subId) || null
        : resolveChargeSubscription(subs, input.date, input.groupId, input.planType);

    let sessionsRemaining = -1;
    let sessionsUsed: number | null = null;
    let sessionsTotal: number | null = null;
    if (target) {
        // Mirrors incrementSessionsUsed()'s date-expiry guard: an explicitly
        // passed subId (multi-subscription choice popup) can point at a
        // subscription that has since expired by date — mark it expired
        // instead of deducting, same as the original never deducts past the
        // expiry date even when picked directly by id.
        if (target.expires_at < input.date) {
            await supabase.from('subscriptions').update({ status: 'expired' }).eq('id', target.id).eq('org_id', orgId);
        } else {
            const type = subData(target).type as string | undefined;
            const isSessionBased = type === 'sessions' || (target.sessions_total !== null && !type);
            if (isSessionBased) {
                const { data, error } = await supabase.rpc('checkin_deduct_session', { p_sub_id: target.id });
                if (error) throw new Error(error.message);
                const row = Array.isArray(data) ? data[0] : data;
                sessionsUsed = row.sessions_used;
                sessionsTotal = row.sessions_total;
                sessionsRemaining = row.sessions_total !== null ? Math.max(0, row.sessions_total - row.sessions_used) : Infinity as unknown as number;
            } else {
                sessionsRemaining = Infinity as unknown as number; // monthly / unlimited
            }
        }
    }

    const attendanceId = makeAttendanceId(input.studentId, input.date);
    const { error: insertErr } = await supabase.from('attendance').insert({
        id: attendanceId, org_id: orgId, student_id: input.studentId, group_id: input.groupId || null,
        date: input.date, status: 'present', notes: 'Via MANUAL',
        data: { classId: input.classId, groupId: input.groupId, subId: target?.id || null, via: 'manual' },
    });
    if (insertErr) throw new Error(insertErr.message);

    return { attendanceId, sessionsRemaining, usedSubId: target?.id || null, sessionsUsed, sessionsTotal };
}

// ─── Refund (refundCheckin equivalent) ─────────────────────────────────────

const refundSchema = z.object({
    studentId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    planType: z.enum(['group', 'personal', 'individual', 'rental']).optional(),
    groupId: z.string().optional(),
    subId: z.string().optional(),
});

export type RefundCheckinResult = { refundedSubId: string | null; sessionsUsed: number | null; sessionsTotal: number | null };

export async function refundCheckinAction(rawInput: unknown): Promise<RefundCheckinResult> {
    const input = refundSchema.parse(rawInput);
    const { orgId, client: supabase } = await requireOrgIdDualAuth();

    // Delete the latest matching attendance row for this student+date (id embeds
    // an insertion timestamp, so ORDER BY id DESC approximates "most recent").
    const { data: rows, error: findErr } = await supabase
        .from('attendance')
        .select('id')
        .eq('org_id', orgId).eq('student_id', input.studentId).eq('date', input.date)
        .order('id', { ascending: false }).limit(1);
    if (findErr) throw new Error(findErr.message);
    if (rows && rows[0]) {
        await supabase.from('attendance').delete().eq('id', rows[0].id);
    }

    const subs = await fetchStudentSubs(supabase, orgId, input.studentId);
    const target = resolveRefundSubscription(subs, input.groupId, input.planType, input.subId);
    if (!target) return { refundedSubId: null, sessionsUsed: null, sessionsTotal: null };

    const { data, error } = await supabase.rpc('checkin_refund_session', { p_sub_id: target.id });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return { refundedSubId: target.id, sessionsUsed: row.sessions_used, sessionsTotal: row.sessions_total };
}

// ─── Companion check-in (couple lessons — shared session already charged) ──

const companionSchema = z.object({
    studentId: z.string().min(1),
    classId: z.string().optional(),
    groupId: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sessionsRemaining: z.number(),
});

export async function recordCompanionCheckinAction(rawInput: unknown): Promise<{ attendanceId: string }> {
    const input = companionSchema.parse(rawInput);
    const { orgId, client: supabase } = await requireOrgIdDualAuth();

    const attendanceId = makeAttendanceId(input.studentId, input.date);
    const { error } = await supabase.from('attendance').insert({
        id: attendanceId, org_id: orgId, student_id: input.studentId, group_id: input.groupId || null,
        date: input.date, status: 'present', notes: 'Via MANUAL',
        data: { classId: input.classId, groupId: input.groupId, sessionsRemaining: input.sessionsRemaining, companion: true },
    });
    if (error) throw new Error(error.message);
    return { attendanceId };
}

const deleteCompanionSchema = z.object({
    studentId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** No refund side effect — the shared session was already refunded once via the primary partner's refundCheckinAction. */
export async function deleteCompanionCheckinAction(rawInput: unknown): Promise<void> {
    const input = deleteCompanionSchema.parse(rawInput);
    const { orgId, client: supabase } = await requireOrgIdDualAuth();

    const { data: rows, error: findErr } = await supabase
        .from('attendance')
        .select('id')
        .eq('org_id', orgId).eq('student_id', input.studentId).eq('date', input.date)
        .order('id', { ascending: false }).limit(1);
    if (findErr) throw new Error(findErr.message);
    if (rows && rows[0]) {
        await supabase.from('attendance').delete().eq('id', rows[0].id);
    }
}

// ─── Reads (getCheckinsForDate / getCheckinCountToday equivalents) ─────────

const dateSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export type CheckinRow = { id: string; student_id: string; group_id: string | null; date: string; data: Record<string, unknown> | null };

export async function getCheckinsForDateAction(rawInput: unknown): Promise<CheckinRow[]> {
    const { date } = dateSchema.parse(rawInput);
    const { orgId, client: supabase } = await requireOrgIdDualAuth();
    const { data, error } = await supabase
        .from('attendance')
        .select('id, student_id, group_id, date, data')
        .eq('org_id', orgId).eq('date', date);
    if (error) throw new Error(error.message);
    return data ?? [];
}

const studentIdSchema = z.object({ studentId: z.string().min(1) });

export async function getCheckinCountTodayAction(rawInput: unknown): Promise<number> {
    const { studentId } = studentIdSchema.parse(rawInput);
    const { orgId, client: supabase } = await requireOrgIdDualAuth();
    const today = new Date().toISOString().slice(0, 10);
    const { count, error } = await supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId).eq('student_id', studentId).eq('date', today);
    if (error) throw new Error(error.message);
    return count ?? 0;
}

/** Full check-in history for a student, all dates (student profile "visits" list). */
export async function getStudentCheckinsAction(rawInput: unknown): Promise<CheckinRow[]> {
    const { studentId } = studentIdSchema.parse(rawInput);
    const { orgId, client: supabase } = await requireOrgIdDualAuth();
    const { data, error } = await supabase
        .from('attendance')
        .select('id, student_id, group_id, date, data')
        .eq('org_id', orgId).eq('student_id', studentId)
        .order('date', { ascending: false }).order('id', { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
}

// ─── Delete a specific history entry (deleteCheckin equivalent) ───────────

const deleteCheckinSchema = z.object({
    studentId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    forceId: z.string().optional(),
});

export async function deleteCheckinAction(rawInput: unknown): Promise<void> {
    const input = deleteCheckinSchema.parse(rawInput);
    const { orgId, client: supabase } = await requireOrgIdDualAuth();

    let row: { id: string; data: Record<string, unknown> | null } | null = null;
    if (input.forceId) {
        const { data, error } = await supabase
            .from('attendance').select('id, data')
            .eq('org_id', orgId).eq('id', input.forceId).maybeSingle();
        if (error) throw new Error(error.message);
        row = data;
    } else {
        const { data, error } = await supabase
            .from('attendance').select('id, data')
            .eq('org_id', orgId).eq('student_id', input.studentId).eq('date', input.date)
            .order('id', { ascending: false }).limit(1);
        if (error) throw new Error(error.message);
        row = data && data[0] ? data[0] : null;
    }
    if (!row) return;

    await supabase.from('attendance').delete().eq('id', row.id);

    const recSubId = (row.data as Record<string, unknown> | null)?.subId as string | undefined;
    const recGroupId = (row.data as Record<string, unknown> | null)?.groupId as string | undefined;
    const recPlanType = ((row.data as Record<string, unknown> | null)?.planType as PlanType | undefined) || (recGroupId ? 'group' : undefined);

    const subs = await fetchStudentSubs(supabase, orgId, input.studentId);
    const target = resolveRefundSubscription(subs, recGroupId, recPlanType, recSubId);
    if (target) {
        const { error } = await supabase.rpc('checkin_refund_session', { p_sub_id: target.id });
        if (error) throw new Error(error.message);
    }
}
