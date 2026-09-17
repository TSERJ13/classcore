'use server';

/**
 * Server Action wrapper around the get_dashboard_stats() RPC
 * (20260917_subscriptions_write_rls_and_stats.sql) — see
 * docs/architecture-migration.md §8. Scoped to exactly the 4 numbers that
 * RPC computes; the dashboard's other cards (revenue trend, occupancy,
 * churn-risk list, insights) still run on the existing client-side stores
 * and are out of scope for this pass.
 */

import { createClient } from '@/lib/supabase/server';

export type DashboardStats = {
    activeStudents: number;
    monthlyRevenue: number;
    todayCheckins: number;
    expiringSoonStudents: number;
};

export async function getDashboardStatsAction(): Promise<DashboardStats> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_dashboard_stats');
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
        activeStudents: row?.active_students ?? 0,
        monthlyRevenue: Number(row?.monthly_revenue) || 0,
        todayCheckins: row?.today_checkins ?? 0,
        expiringSoonStudents: row?.expiring_soon_students ?? 0,
    };
}
