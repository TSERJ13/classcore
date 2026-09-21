'use server';

/**
 * Server Action wrapper around the get_dashboard_stats() RPC
 * (20260917_subscriptions_write_rls_and_stats.sql, branch-scoped by
 * 20260921_dashboard_stats_branch_scope.sql) — see
 * docs/architecture-migration.md §8. Scoped to exactly the 4 numbers that
 * RPC computes; the dashboard's other cards (revenue trend, occupancy,
 * churn-risk list, insights) still run on the existing client-side stores
 * and are out of scope for this pass.
 *
 * BRANCH ISOLATION: this file only supports real Supabase Auth sessions
 * (same as students.ts, which it mirrors here), so it resolves the
 * caller's own `allowed_branch_ids` the same way rather than reusing
 * resolveCallerBranchIds() (src/lib/permissions/enforce.ts), which expects
 * a DualAuthContext this file doesn't have.
 */

import { createClient } from '@/lib/supabase/server';

export type DashboardStats = {
    activeStudents: number;
    monthlyRevenue: number;
    todayCheckins: number;
    expiringSoonStudents: number;
};

async function resolveOwnBranchAccess(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string, userId: string): Promise<string[]> {
    const { data: staffRow } = await supabase.from('staff').select('role, allowed_branch_ids').eq('id', userId).eq('org_id', orgId).maybeSingle();
    if (!staffRow || staffRow.role === 'owner') return [];
    return staffRow.allowed_branch_ids ?? [];
}

export async function getDashboardStatsAction(branchId?: string): Promise<DashboardStats> {
    const supabase = await createClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) throw new Error('Not authenticated');

    const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', userData.user.id)
        .maybeSingle();
    if (profileErr || !profile?.org_id) throw new Error('No org for this user');

    const allowedBranchIds = await resolveOwnBranchAccess(supabase, profile.org_id, userData.user.id);
    if (branchId && allowedBranchIds.length > 0 && !allowedBranchIds.includes(branchId)) {
        throw new Error('You do not have access to this branch');
    }

    const { data, error } = await supabase.rpc('get_dashboard_stats', { p_branch_id: branchId || null });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
        activeStudents: row?.active_students ?? 0,
        monthlyRevenue: Number(row?.monthly_revenue) || 0,
        todayCheckins: row?.today_checkins ?? 0,
        expiringSoonStudents: row?.expiring_soon_students ?? 0,
    };
}
