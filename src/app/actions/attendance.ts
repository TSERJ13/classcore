'use server';

/**
 * Phase 1 pilot (see docs/architecture-migration.md) — attendance is the
 * module the brief's "20,000+ records will crash the browser" concern
 * actually describes, and started as pure reads. Phase 3 adds the one
 * write this module actually needs an atomic transaction for: marking
 * attendance against a subscription must deduct exactly one session, even
 * under concurrent calls — see `markAttendanceAction` below and
 * `20260915_mark_attendance_atomic.sql`.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE_DEFAULT = 20;

async function requireOrgId(): Promise<string> {
    const supabase = await createClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) throw new Error('Not authenticated');

    const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', userData.user.id)
        .maybeSingle();
    if (profileErr || !profile?.org_id) throw new Error('No org for this user');
    return profile.org_id;
}

const listParamsSchema = z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(PAGE_SIZE_DEFAULT),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    studentId: z.string().optional(),
});

export type AttendancePageResult = {
    rows: Array<{
        id: string;
        student_id: string;
        group_id: string | null;
        date: string;
        status: string;
        notes: string | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
};

/** Server-paginated attendance history — RLS confines rows to the caller's studio. */
export async function getAttendancePage(rawParams: unknown): Promise<AttendancePageResult> {
    const { page, pageSize, dateFrom, dateTo, studentId } = listParamsSchema.parse(rawParams);
    await requireOrgId();

    const supabase = await createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from('attendance')
        .select('id, student_id, group_id, date, status, notes', { count: 'exact' })
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: false })
        .range(from, to);

    if (studentId) query = query.eq('student_id', studentId);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

const statsParamsSchema = z.object({
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type AttendanceDailyCount = { day: string; count: number };

/**
 * Daily attendance counts computed in Postgres via `attendance_daily_counts`
 * (20260915_attendance_stats_rpc.sql) — one grouped query server-side
 * instead of fetching every row and reducing them in the browser.
 */
export async function getAttendanceDailyCounts(rawParams: unknown): Promise<AttendanceDailyCount[]> {
    const { dateFrom, dateTo } = statsParamsSchema.parse(rawParams);
    await requireOrgId();

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('attendance_daily_counts', {
        p_date_from: dateFrom,
        p_date_to: dateTo,
    });
    if (error) throw new Error(error.message);

    return (data ?? []).map((r: { day: string; count: number }) => ({ day: r.day, count: Number(r.count) }));
}

export type StudentSubscriptionOption = {
    id: string;
    plan: string;
    sessions_used: number;
    sessions_total: number | null;
    status: string;
};

/** For the "mark attendance" picker — which of this student's subscriptions can be charged a session. */
export async function getActiveSubscriptionsForStudent(studentId: string): Promise<StudentSubscriptionOption[]> {
    await requireOrgId();
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('subscriptions')
        .select('id, status, sessions_used, sessions_total, data')
        .eq('student_id', studentId)
        .eq('status', 'active');
    if (error) throw new Error(error.message);

    return (data ?? []).map((r: { id: string; status: string; sessions_used: number; sessions_total: number | null; data: { plan?: string } | null }) => ({
        id: r.id,
        plan: r.data?.plan || 'Subscription',
        sessions_used: r.sessions_used,
        sessions_total: r.sessions_total,
        status: r.status,
    }));
}

const markAttendanceSchema = z.object({
    studentId: z.string().min(1),
    groupId: z.string().optional(),
    subscriptionId: z.string().optional(),
    status: z.enum(['present', 'absent', 'late']).default('present'),
    notes: z.string().max(500).optional(),
});

export type MarkAttendanceResult = { attendanceId: string; sessionsUsed: number | null; sessionsTotal: number | null };

/**
 * Calls `mark_attendance_and_deduct_session` — one Postgres transaction
 * that inserts the attendance row AND deducts a session from the given
 * subscription, or rolls back both if the subscription turns out to be
 * inactive/exhausted. This is the atomic-transaction case the brief asked
 * for explicitly; every other write in this pilot (student edits, group
 * enrollment) is a plain sequential update because nothing about them can
 * be silently double-spent the way a session count can.
 */
export async function markAttendanceAction(rawInput: unknown): Promise<MarkAttendanceResult> {
    const input = markAttendanceSchema.parse(rawInput);
    await requireOrgId();

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('mark_attendance_and_deduct_session', {
        p_student_id: input.studentId,
        p_group_id: input.groupId || null,
        p_subscription_id: input.subscriptionId || null,
        p_status: input.status,
        p_notes: input.notes || null,
    });
    if (error) throw new Error(error.message);

    const row = Array.isArray(data) ? data[0] : data;
    revalidatePath('/attendance-v2');
    return { attendanceId: row.attendance_id, sessionsUsed: row.sessions_used, sessionsTotal: row.sessions_total };
}
