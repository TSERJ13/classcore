'use server';

/**
 * Phase 1 pilot (see docs/architecture-migration.md) — attendance is the
 * module the brief's "20,000+ records will crash the browser" concern
 * actually describes, and it's pure reads (marking attendance still goes
 * through the existing checkin-store.ts path for now), which makes it the
 * lowest-risk place to prove server-side pagination + aggregation before
 * touching anything with writes.
 */

import { z } from 'zod';
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
