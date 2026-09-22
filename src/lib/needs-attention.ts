/**
 * Shared "needs attention" computation — students with unpaid debt,
 * subscriptions expiring within a week or down to their last session,
 * pending calendar bookings, and today's birthdays. Extracted so
 * dashboard/page.tsx, the sidebar's quick-access button, and the once-a-day
 * notification generator all agree on the same numbers instead of each
 * re-deriving (and risking drift from) this logic independently.
 */

import type { Student } from '@/types';
import type { SubscriptionInfo } from './subscription-store';
import { getStudents } from './student-store';
import { getUniqueSubscriptions } from './subscription-store';
import { getEvents } from './event-store';
import { getPlans } from './plan-store';
import { buildPlanPrices } from './studio-stats';
import { getLocalISODate } from './utils';
import { isTeacherRole, getVisibleGroupIds } from './access';
import { getTeachers } from './teacher-store';
import { getGroups } from './group-store';

export interface NeedsAttentionSummary {
    expiringSoonCount: number;
    oneSessionLeftCount: number;
    pendingBookingsCount: number;
    studentsWithDebtCount: number;
    totalDebt: number;
    birthdayStudents: Student[];
    totalCount: number;
}

export function computeNeedsAttention(params: {
    studentsList: Student[];
    allSubsList: SubscriptionInfo[];
    events: Array<{ date: string; group_id?: string | null; booking_status?: string }>;
    planPrices: Record<string, number>;
    todayStr: string;
    isTeacher?: boolean;
    visibleGroupIds?: string[] | null;
}): NeedsAttentionSummary {
    const { studentsList, allSubsList, events, planPrices, todayStr, isTeacher, visibleGroupIds } = params;

    // ── Expiring soon / one session left ──
    const expiringSoonStudents = new Set<string>();
    const oneSessionStudents = new Set<string>();
    const nextWeek = new Date(`${todayStr}T00:00:00`);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = getLocalISODate(nextWeek);

    studentsList.forEach(s => {
        const subsList = allSubsList.filter(sub => {
            if (!sub.student_id) return false;
            return sub.student_id.split(',').map(x => x.trim()).includes(s.id);
        });
        for (const sub of subsList) {
            const isUnlimited = sub.sessions_total === null;
            const remaining = isUnlimited ? Infinity : ((sub.sessions_total ?? 0) - (sub.sessions_used ?? 0));
            const hasExpiredByDate = sub.expires_at < todayStr;
            const hasUsedAllSessions = !isUnlimited && remaining <= 0;

            if (!hasExpiredByDate && !hasUsedAllSessions) {
                if (sub.expires_at <= nextWeekStr) expiringSoonStudents.add(s.id);
                if (remaining === 1) oneSessionStudents.add(s.id);
            }
        }
    });

    // ── Pending bookings ──
    const pendingBookingsCount = events.filter(ev => {
        if (ev.booking_status !== 'pending') return false;
        if (ev.date < todayStr) return false;
        if (isTeacher && visibleGroupIds && ev.group_id && !visibleGroupIds.includes(ev.group_id)) return false;
        return true;
    }).length;

    // ── Debt (unpaid subscriptions + negative balances) ──
    let totalDebt = 0;
    const debtStudentIds = new Set<string>();
    allSubsList.forEach((sub: any) => {
        if (sub.status === 'cancelled') return;
        const subPrice = sub.price ?? (sub.plan != null ? planPrices[String(sub.plan)] : undefined) ?? (sub.plan_id != null ? planPrices[String(sub.plan_id)] : undefined) ?? 0;
        if (subPrice > 0) {
            const amountPaid = typeof sub.amount_paid === 'number' ? sub.amount_paid : (sub.paid ? subPrice : 0);
            if (amountPaid < subPrice) {
                totalDebt += subPrice - amountPaid;
                if (sub.student_id) {
                    sub.student_id.split(',').forEach((sid: string) => {
                        const clean = sid.trim();
                        if (clean) debtStudentIds.add(clean);
                    });
                }
            }
        }
    });
    studentsList.forEach(s => {
        if (typeof s.balance === 'number' && s.balance < 0) {
            totalDebt += Math.abs(s.balance);
            debtStudentIds.add(s.id);
        }
    });

    // ── Birthdays today ──
    const todayMonthDay = todayStr.slice(5); // "MM-DD"
    const birthdayStudents = studentsList.filter(s => {
        if (!s.birth_date) return false;
        const parts = s.birth_date.split('T')[0].split('-');
        return parts.length === 3 && `${parts[1]}-${parts[2]}` === todayMonthDay;
    });

    return {
        expiringSoonCount: expiringSoonStudents.size,
        oneSessionLeftCount: oneSessionStudents.size,
        pendingBookingsCount,
        studentsWithDebtCount: debtStudentIds.size,
        totalDebt: Math.round(totalDebt),
        birthdayStudents,
        totalCount: expiringSoonStudents.size + oneSessionStudents.size + pendingBookingsCount + debtStudentIds.size + birthdayStudents.length,
    };
}

/**
 * Self-contained variant for callers that don't already have
 * refreshFullDashboard()'s precomputed branch/role-scoped student and
 * subscription lists in scope (the sidebar button, the notification
 * generator) — derives them itself from the same primitives.
 */
export function getNeedsAttentionSummary(profile?: { role?: string } | null): NeedsAttentionSummary {
    const isTeacher = isTeacherRole(profile?.role);
    const visibleGroupIds = isTeacher ? getVisibleGroupIds(profile as any, getTeachers() as any, getGroups() as any) : null;

    let studentsList = getStudents();
    if (isTeacher && visibleGroupIds) {
        studentsList = studentsList.filter(s => s.enrolled_group_ids?.some(gid => visibleGroupIds.includes(gid)));
    }
    const branchStudentIds = new Set(studentsList.map(s => s.id));
    const allSubsList = getUniqueSubscriptions().filter(sub => {
        if (!sub.student_id) return false;
        return sub.student_id.split(',').map(x => x.trim()).some(id => branchStudentIds.has(id));
    });
    const planPrices = buildPlanPrices(getPlans());
    const todayStr = getLocalISODate(new Date());

    return computeNeedsAttention({
        studentsList,
        allSubsList,
        events: getEvents(),
        planPrices,
        todayStr,
        isTeacher,
        visibleGroupIds,
    });
}
