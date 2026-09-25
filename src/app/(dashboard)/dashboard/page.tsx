'use client';

import { useState, useEffect, useCallback } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { getTodayCheckins, type CheckinRecord } from '@/lib/checkin-store';
import { getUniqueSubscriptions, getSubscriptionStatusBucket, type SubscriptionEffectiveStatus } from '@/lib/subscription-store';
import { getSales } from '@/lib/sales-store';
import Link from 'next/link';
import { Zap, Users, CreditCard, CalendarCheck, TrendingUp, ChevronRight, ChevronDown, RefreshCcw, ShieldAlert, Sparkles, LayoutGrid, X } from 'lucide-react';
import { cn, getLocalISODate, formatCurrency, getScopedKey } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { getTodayEvents, getEvents } from '@/lib/event-store';
import { getStudents, updateStudent } from '@/lib/student-store';
import { getTeacher, getTeachers, getTeacherName, getTeacherPhoto } from '@/lib/teacher-store';
import { getHallName } from '@/lib/hall-store';
import type { Student } from '@/types';
import { getGroups } from '@/lib/group-store';
import { getVisibleGroupIds, isTeacherRole, isOwnerOrAdmin } from '@/lib/access';
import { pctChange, buildPlanPrices, subRevenue, isSubInMonth, isSubOnDay } from '@/lib/studio-stats';
import { getPlans } from '@/lib/plan-store';
import { getDashboardStatsAction } from '@/app/actions/dashboard';
import StudentModal from '@/components/students/StudentModal';
import { IssueSubscriptionModal } from '@/components/subscriptions/IssueSubscriptionModal';
import { computeNeedsAttention } from '@/lib/needs-attention';
import {
    TodayScheduleTimeline, QuickActionsPanel, TodaySummaryPanel,
    UpcomingEventsCard, RecentActivityCard, GroupProgressCard, WidgetSlot,
    type ScheduleItem, type ActivityItem,
} from '@/components/dashboard/DashboardHomeSections';
import { TodayGroupsCard } from '@/components/dashboard/TodayGroupsCard';
import { CalendarScheduleCard } from '@/components/dashboard/CalendarScheduleCard';
import { AIAnalyticsCard } from '@/components/dashboard/AIAnalyticsCard';
import { resolveSlotWidget } from '@/lib/dashboard-widgets';

// ─── Lightweight SVG Donut Chart Card ──────────────────────────────────────

interface DonutSegment {
    key: string;
    label: string;
    count: number;
    formattedValue?: string;
    color: string;
    bgClass: string;
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
        x: Number((centerX + radius * Math.cos(angleInRadians)).toFixed(3)),
        y: Number((centerY + radius * Math.sin(angleInRadians)).toFixed(3))
    };
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
    const sweep = endAngle - startAngle;
    if (sweep >= 359.99) {
        const start = polarToCartesian(x, y, radius, startAngle);
        const mid = polarToCartesian(x, y, radius, startAngle + 180);
        const end = polarToCartesian(x, y, radius, startAngle + 359.99);
        return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${mid.x} ${mid.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
    }
    const start = polarToCartesian(x, y, radius, startAngle);
    const end = polarToCartesian(x, y, radius, endAngle);
    const largeArcFlag = sweep <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function DonutCard({
    title,
    icon: Icon,
    iconColorClass = 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    linkHref,
    linkLabel,
    centerValue,
    centerLabel,
    defaultPct,
    segments,
    loading = false,
}: {
    title: string;
    icon: any;
    iconColorClass?: string;
    linkHref?: string;
    linkLabel?: string;
    centerValue: string | number;
    centerLabel: string;
    defaultPct?: string | null;
    segments: DonutSegment[];
    // 🛠️ FIX: on a fresh login/hard refresh, this card's numbers are computed
    // from local student/subscription caches that are genuinely empty until
    // StudioContext's slower background hydration pass finishes (see the
    // statsReady comment further down this file) — this rendered a real "0"
    // ring/value that then jumped to the true number a moment later. Gate
    // the numeric display on this instead of trusting an all-zero
    // `segments`/`centerValue` to mean "confirmed empty".
    loading?: boolean;
}) {
    const [activeKey, setActiveKey] = useState<string | null>(null);

    const total = segments.reduce((sum, s) => sum + s.count, 0);

    const size = 132;
    const strokeWidth = 12;
    const radius = 48;
    const center = size / 2;

    let curAngle = 0;
    const slices = segments.map(seg => {
        const fraction = total > 0 ? seg.count / total : 0;
        const sliceAngle = fraction * 360;
        const startAngle = curAngle;
        const endAngle = curAngle + sliceAngle;
        if (seg.count > 0) {
            curAngle += sliceAngle;
        }
        const pathD = seg.count > 0 ? describeArc(center, center, radius, startAngle, endAngle) : '';
        return {
            ...seg,
            pct: total > 0 ? Math.round(fraction * 100) : 0,
            pathD,
        };
    });

    const activeSlice = slices.find(s => s.key === activeKey) || null;
    const displayedValue = activeSlice ? (activeSlice.formattedValue || activeSlice.count) : centerValue;
    const isLongValue = String(displayedValue).length > 5;

    return (
        <div className="bg-card border border-border-subtle rounded-2xl p-3 sm:p-4 flex flex-col justify-between group hover:border-border-subtle/60 transition-all h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-1">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <div className={cn("w-6 h-6 sm:w-7 sm:h-7 rounded-lg border flex items-center justify-center flex-shrink-0", iconColorClass)}>
                        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <h3 className="text-[11px] sm:text-xs font-bold text-primary tracking-tight truncate">
                        {title}
                    </h3>
                </div>
                {linkHref && (
                    <Link
                        href={linkHref}
                        className="text-[10px] sm:text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5 group-hover:translate-x-0.5 flex-shrink-0"
                    >
                        <span className="hidden sm:inline">{linkLabel || 'ყველა'}</span>
                        <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </Link>
                )}
            </div>

            {/* Centered Donut & Bottom Details (No side text, slightly enlarged donut) */}
            <div className="flex flex-col items-center justify-center py-1 flex-1">
                {/* SVG Donut Ring */}
                <div className="relative flex items-center justify-center flex-shrink-0 my-0.5 sm:my-1">
                    <svg viewBox={`0 0 ${size} ${size}`} className="w-[104px] h-[104px] sm:w-[132px] sm:h-[132px]">
                        {/* Background track circle */}
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={strokeWidth}
                            className="text-surface/80 dark:text-slate-800"
                        />
                        {/* Slices */}
                        {!loading && total > 0 && slices.map(slice => {
                            if (slice.count <= 0 || !slice.pathD) return null;
                            const isHovered = activeKey === slice.key;
                            return (
                                <path
                                    key={slice.key}
                                    d={slice.pathD}
                                    fill="none"
                                    stroke={slice.color}
                                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                                    strokeLinecap="butt"
                                    className="transition-all duration-300 ease-out cursor-pointer"
                                    style={{
                                        opacity: activeKey ? (isHovered ? 1 : 0.35) : 1,
                                        filter: isHovered ? `drop-shadow(0 0 6px ${slice.color}80)` : undefined,
                                    }}
                                    onMouseEnter={() => setActiveKey(slice.key)}
                                    onMouseLeave={() => setActiveKey(null)}
                                    onClick={() => setActiveKey(prev => prev === slice.key ? null : slice.key)}
                                >
                                    <title>{slice.label}: {slice.formattedValue || slice.count} ({slice.pct}%)</title>
                                </path>
                            );
                        })}
                    </svg>

                    {/* Inside Donut Center: ONLY the numeric value (reduced font size for amounts like 3,450 ₾) */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-1 text-center">
                        {loading ? (
                            <span className="h-5 sm:h-6 w-10 rounded-md bg-surface animate-pulse" />
                        ) : (
                            <span className={cn(
                                "font-black text-primary leading-none tracking-tight truncate max-w-[76px] sm:max-w-[90px]",
                                isLongValue ? "text-xs sm:text-base" : "text-lg sm:text-2xl"
                            )}>
                                {displayedValue}
                            </span>
                        )}
                    </div>
                </div>

                {/* Under Donut: Text & Percentage */}
                <div className="mt-2 sm:mt-3 text-center min-h-[36px] sm:min-h-[40px] flex flex-col items-center justify-center w-full px-1">
                    {loading ? null : activeSlice ? (
                        <div className="animate-in fade-in zoom-in-95 duration-150 flex flex-col items-center">
                            <span className="text-[11px] sm:text-xs font-bold text-primary truncate max-w-[140px] sm:max-w-[190px] leading-tight">
                                {activeSlice.label}
                            </span>
                            <div className="flex items-center justify-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1">
                                {total > 0 && (
                                    <span
                                        className="text-[9px] sm:text-[10px] font-black px-1 sm:px-1.5 py-0.5 rounded-md text-white shadow-xs"
                                        style={{ backgroundColor: activeSlice.color }}
                                    >
                                        {activeSlice.pct}%
                                    </span>
                                )}
                                <span className="text-[11px] sm:text-xs font-bold text-muted tabular-nums">
                                    {activeSlice.formattedValue || activeSlice.count}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center transition-all">
                            <span className="text-[11px] sm:text-xs font-bold text-muted truncate max-w-[140px] sm:max-w-[190px] leading-tight">
                                {centerLabel}
                            </span>
                            {defaultPct && (
                                <span className="text-[10px] sm:text-[11px] font-semibold text-muted/70 mt-0.5">
                                    {defaultPct}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const { t, lang } = useT();
    // 🛠️ FIX: was a plain inline arrow function, recreated with a new
    // identity on every render. It's in refreshFullDashboard's useCallback
    // deps below, so that recreated every render too — and since the mount
    // effect depends on refreshFullDashboard's identity, this fired the
    // whole stats/schedule refresh (which itself calls setState) on every
    // single render, forever. That infinite render loop is what pegged the
    // tab and made every button/nav link across the app look "frozen" —
    // not a per-button bug, the whole page's JS thread was stuck redrawing.
    const l = useCallback((ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en, [lang]);
    const { settings, isLoaded, updateSettings } = useStudio();
    const { profile, loading } = useUser();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [revenueRange, setRevenueRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
    const [liveStats, setLiveStats] = useState({
        totalStudents: 0,
        activeStudents: 0,
        activeSubs: 0,
        newThisMonth: 0,
        attendance: 0,
        attendanceRateMonth: 0,
        monthlyRevenue: 0,
        prevMonthRevenue: 0,
        todayRevenue: 0,
        totalDebt: 0,
        studentsWithDebt: 0,
        expiringSoon: 0,
        oneSessionLeft: 0,
        pendingBookings: 0,
        revenueChange: 0,
        studentChange: null as number | null,
        subsThisMonth: 0,
        subsLastMonth: 0,
        subsChange: 0,
        todayExpected: 0,
        subStatusCounts: { active: 0, paused: 0, expired: 0, cancelled: 0, total: 0 },
        newThisMonthStudents: 0,
        monthlySubsRevenue: 0,
        monthlyShopRevenue: 0,
        todayClassesCount: 0,
    });
    const [scheduleView, setScheduleView] = useState<'day' | 'week' | 'month'>('day');
    const [groupProgress, setGroupProgress] = useState<{ id: string; name: string; photo?: string; pct: number }[]>([]);
    const [recentActivityItems, setRecentActivityItems] = useState<ActivityItem[]>([]);
    const [birthdayStudents, setBirthdayStudents] = useState<Student[]>([]);
    const [scheduleGroups, setScheduleGroups] = useState<{ date: string; items: ScheduleItem[] }[]>([]);
    const [allEvents, setAllEvents] = useState<any[]>([]);
    // 🛠️ FIX: `liveStats` starts at all-zero, and refreshFullDashboard()'s
    // very first call (on mount) runs against whatever local student/
    // subscription caches happen to be populated *right now* — which, on a
    // fresh login or hard refresh, is genuinely empty, because StudioContext
    // splits hydration into a fast "light" pass (settings/branches, gates
    // `isLoaded`) and a slower "heavy" background pass (students,
    // subscriptions, etc., which is what actually feeds these numbers) that
    // finishes later and re-fires this same refresh via cc_student_update/
    // cc_subscription_update/cc_data_hydrated. That's the "0, then suddenly
    // jumps" the owner saw — not wrong data, just a real 0 shown before the
    // real data existed locally yet. Gate the numbers on a ready flag
    // instead of trusting an all-zero liveStats to mean "confirmed empty".
    const [statsReady, setStatsReady] = useState(() => {
        try { return sessionStorage.getItem('cc_dashboard_stats_seen') === '1'; } catch { return false; }
    });
    const markStatsReady = useCallback(() => {
        setStatsReady(true);
        try { sessionStorage.setItem('cc_dashboard_stats_seen', '1'); } catch { }
    }, []);

    const [showAddStudent, setShowAddStudent] = useState(false);
    const [showIssueSub, setShowIssueSub] = useState(false);

    const refreshFullDashboard = useCallback(() => {
        // 1. Refresh Stats
        const sales = getSales();
        let studentsList = getStudents();
        const allSubsListRaw = getUniqueSubscriptions();
        
        const isTeacher = isTeacherRole(profile?.role);
        // Robust visible-group resolution (groups they teach + assignments).
        const visibleGroupIds = getVisibleGroupIds(profile as any, (settings.staff || getTeachers()) as any, getGroups() as any);

        if (isTeacher && visibleGroupIds) {
            studentsList = studentsList.filter(s =>
                s.enrolled_group_ids?.some(gid => visibleGroupIds.includes(gid))
            );
        }
        // `studentsList` is now branch-scoped (student-store.ts's getStudents()
        // filters by branch_ids) and, for teachers, further scoped to their
        // visible groups. Subscriptions and attendance don't carry their own
        // branch_id yet (a separate, larger Phase 2 item — see docs/tasks.md),
        // so a subscription/check-in is attributed to a branch through the
        // student(s) it belongs to, which uses this same set. Shop sales stay
        // org-wide for now — many are walk-in purchases with no student_id to
        // key off of.
        const branchStudentIds = new Set(studentsList.map(s => s.id));
        const allSubsList = allSubsListRaw.filter(sub => {
            if (!sub.student_id) return false;
            return sub.student_id.split(',').map(x => x.trim()).some(id => branchStudentIds.has(id));
        });
        const students = studentsList.length;
        const now = new Date();
        const currentMonth = now.toISOString().split('-').slice(0, 2).join('-');
        // Previous month string (YYYY-MM)
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

        // ── Real Student Change (new students added this month vs last month) ──
        const newStudentsThisMonth = studentsList.filter(s => s.created_at?.startsWith(currentMonth)).length;
        const newStudentsLastMonth = studentsList.filter(s => s.created_at?.startsWith(prevMonth)).length;
        let studentChange: number | null = null;
        if (newStudentsLastMonth > 0) {
            const pct = pctChange(newStudentsThisMonth, newStudentsLastMonth);
            if (pct !== null && pct !== 0) studentChange = pct;
        } else if (newStudentsThisMonth > 0) {
            studentChange = 100;
        }

        const todayStr = getLocalISODate(new Date());
        const activeSubStudentIds = new Set<string>();
        studentsList.forEach(s => {
            let isActive = false;
            const subsList = allSubsList.filter(sub => {
                if (!sub.student_id) return false;
                const ids = sub.student_id.split(',').map(x => x.trim());
                return ids.includes(s.id);
            });
            for (const sub of subsList) {
                const isUnlimited = sub.sessions_total === null;
                const remaining = isUnlimited ? Infinity : ((sub.sessions_total ?? 0) - (sub.sessions_used ?? 0));
                const hasExpiredByDate = sub.expires_at < todayStr;
                const hasUsedAllSessions = !isUnlimited && remaining <= 0;
                
                if (!hasExpiredByDate && !hasUsedAllSessions && sub.status === 'active') {
                    isActive = true;
                    break;
                }
            }
            if (isActive) {
                activeSubStudentIds.add(s.id);
            }
        });
        const studentsWithActiveSub = activeSubStudentIds.size;
        const activeSubsCount = allSubsList.filter(sub => {
            const isUnlimited = sub.sessions_total === null;
            const remaining = isUnlimited ? Infinity : ((sub.sessions_total ?? 0) - (sub.sessions_used ?? 0));
            const hasExpiredByDate = sub.expires_at < todayStr;
            const hasUsedAllSessions = !isUnlimited && remaining <= 0;
            return sub.status === 'active' && !hasExpiredByDate && !hasUsedAllSessions;
        }).length;

        // Check-ins are org-wide records keyed only by studentId (no branch
        // field of their own), so — same as subscriptions above — scope
        // "today's attendance" to check-ins belonging to a student in the
        // currently visible (branch + role) student set.
        const checkins = getTodayCheckins().filter(c => branchStudentIds.has(c.studentId));
        const attendance = checkins.length;

        // ── Plan Prices & Revenue Helpers ────────────────────────────────────
        const plans = getPlans();
        const planPrices = buildPlanPrices(plans);

        // isSubInMonth / isSubOnDay now live in studio-stats.ts (shared with
        // analytics/page.tsx) so the two pages can't drift apart the way
        // subscription-store.ts's cachedSubs staleness fix once did.

        // ── Revenue: this month vs last month ────────────────────────────────
        const revInMonth = (mPrefix: string) =>
            sales.filter(s => s.date?.startsWith(mPrefix)).reduce((sum, s) => sum + s.price * s.quantity, 0) +
            allSubsList.filter(sub => isSubInMonth(sub, mPrefix)).reduce((sum, sub) => sum + subRevenue(sub, planPrices), 0);
        const monthlyRevenue = revInMonth(currentMonth);
        const prevMonthRevenue = revInMonth(prevMonth);
        const revenueChange = pctChange(monthlyRevenue, prevMonthRevenue) ?? 0;

        // ── Subscriptions purchased: this month vs last month ────────────────
        const subsThisMonth = allSubsList.filter(sub => isSubInMonth(sub, currentMonth)).length;
        const subsLastMonth = allSubsList.filter(sub => isSubInMonth(sub, prevMonth)).length;
        const subsChange = pctChange(subsThisMonth, subsLastMonth) ?? 0;

        // ── Attendance rate: % of all students who attended at least once this month ──
        const attendedStudentIds = new Set<string>();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const dStr = `${currentMonth}-${String(d).padStart(2, '0')}`;
            try {
                const raw = localStorage.getItem(getScopedKey(`cc_checkins_${dStr}`));
                if (!raw) continue;
                const recs = JSON.parse(raw);
                if (Array.isArray(recs)) recs.forEach((r: any) => { if (r?.studentId) attendedStudentIds.add(r.studentId); });
            } catch { /* ignore */ }
        }
        // Restrict to the currently visible (branch + role) student set —
        // this used to only narrow for teachers, leaving the monthly
        // attendance rate counting every branch's check-ins for owners/admins.
        const attendedVisible = Array.from(attendedStudentIds).filter(id => branchStudentIds.has(id)).length;
        const attendanceRateMonth = students > 0 ? Math.round((attendedVisible / students) * 100) : 0;

        // ── Today: expected (enrolled in a group scheduled today) vs attended ──
        let todayExpected = 0;
        let todayClassesCount = 0;
        try {
            const todayEvents = getTodayEvents().filter((ev: any) => !isTeacher || !visibleGroupIds || (ev.group_id && visibleGroupIds.includes(ev.group_id)));
            todayClassesCount = todayEvents.length;
            const todayGroupIds = new Set(todayEvents.map((ev: any) => ev.group_id).filter(Boolean));
            if (todayGroupIds.size > 0) {
                todayExpected = studentsList.filter(s => s.enrolled_group_ids?.some(gid => todayGroupIds.has(gid))).length;
            }
        } catch { /* ignore */ }

        // ── Group Progress: fill rate (enrolled / capacity) per group, for
        // groups that actually declare a capacity — capped to the top 5 by
        // fill %, matching the reference layout's "Group Progress" card. ──
        try {
            const allGroupsForProgress = getGroups();
            const progress = allGroupsForProgress
                .filter(g => !isTeacher || !visibleGroupIds || visibleGroupIds.includes(g.id))
                .filter(g => g.capacity != null && Number(g.capacity) > 0)
                .map(g => {
                    const capacity = Number(g.capacity);
                    const enrolled = studentsList.filter(s => (s.enrolled_group_ids || []).includes(g.id)).length;
                    return {
                        id: g.id,
                        name: g.name,
                        photo: getTeacherPhoto(g.teacherId) || undefined,
                        pct: Math.min(100, Math.round((enrolled / capacity) * 100)),
                    };
                })
                .sort((a, b) => b.pct - a.pct)
                .slice(0, 5);
            setGroupProgress(progress);
        } catch { /* ignore */ }

        // ── Pending Bookings / Debt / Birthdays / Expiring-soon — shared with
        // the sidebar's quick-access button and the once-a-day notification
        // (src/lib/needs-attention.ts), so all three agree on the same numbers.
        let allEvs: any[] = [];
        try {
            allEvs = getEvents();
        } catch { /* ignore */ }
        setAllEvents(allEvs);

        const attention = computeNeedsAttention({
            studentsList,
            allSubsList,
            events: allEvs,
            planPrices,
            todayStr,
            isTeacher,
            visibleGroupIds,
        });
        const pendingBookings = attention.pendingBookingsCount;
        const totalDebt = attention.totalDebt;
        const studentsWithDebt = attention.studentsWithDebtCount;
        setBirthdayStudents(attention.birthdayStudents);

        // ── Subscription Status Breakdown (Real Effective Status) ──
        const subStatusCounts: Record<SubscriptionEffectiveStatus, number> & { total: number } = {
            active: 0,
            paused: 0,
            expired: 0,
            cancelled: 0,
            total: 0,
        };
        allSubsList.forEach(sub => {
            const status = getSubscriptionStatusBucket(sub);
            if (status in subStatusCounts) {
                subStatusCounts[status]++;
            }
            subStatusCounts.total++;
        });

        setLiveStats(prev => ({
            ...prev,
            totalStudents: students,
            activeStudents: studentsWithActiveSub,
            activeSubs: activeSubsCount,
            newThisMonth: subsThisMonth,
            attendance,
            attendanceRateMonth,
            monthlyRevenue,
            revenueChange,
            subsThisMonth,
            subsLastMonth,
            subsChange,
            todayExpected,
            studentChange,
            pendingBookings,
            totalDebt,
            studentsWithDebt,
            subStatusCounts,
            newThisMonthStudents: newStudentsThisMonth,
            monthlySubsRevenue: allSubsList.filter(sub => isSubInMonth(sub, currentMonth)).reduce((sum, sub) => sum + subRevenue(sub, planPrices), 0),
            monthlyShopRevenue: sales.filter(s => s.date?.startsWith(currentMonth)).reduce((sum, s) => sum + s.price * s.quantity, 0),
            expiringSoon: attention.expiringSoonCount,
            oneSessionLeft: attention.oneSessionLeftCount,
            todayClassesCount,
            todayRevenue: sales.filter(s => s.date === todayStr).reduce((sum, s) => sum + s.price * s.quantity, 0) + allSubsList.filter(sub => isSubOnDay(sub, todayStr)).reduce((sum, sub) => sum + subRevenue(sub, planPrices), 0),
        }));

        // 2. Refresh Schedule & Activity
        import('@/lib/event-store').then(mod => {
            const allStudents = getStudents();
            const groups = getGroups();

            // One date's enriched schedule — shared by day/week/month below so
            // all three views build rows the exact same way.
            const buildForDate = (d: Date) => {
                const dateStr = getLocalISODate(d);
                const dayOfWeek = (d.getDay() + 6) % 7;
                let events = mod.getEventsByDate(dateStr).filter(ev => {
                    if (isTeacher && visibleGroupIds && ev.group_id && !visibleGroupIds.includes(ev.group_id)) return false;
                    return true;
                });

                // Fallback: if no explicit calendar events on this date, pull from
                // every visible group's own recurring schedule_slots instead —
                // previously capped at 6 groups, silently dropping the rest of a
                // studio's schedule once it had more than 6 running that day.
                if (events.length === 0 && groups.length > 0) {
                    events = groups
                        .filter(g => {
                            if (isTeacher && visibleGroupIds && !visibleGroupIds.includes(g.id)) return false;
                            return !!g.schedule_slots?.some(s => s.dayOfWeek === dayOfWeek);
                        })
                        .map(g => {
                            const slot = g.schedule_slots!.find(s => s.dayOfWeek === dayOfWeek)!;
                            return {
                                id: `virt-dash-${g.id}-${dateStr}`,
                                group_id: g.id,
                                title: g.name,
                                type: 'group_class',
                                color: g.color || '#6d28d9',
                                start_time: slot.startTime || '18:00',
                                end_time: slot.endTime || '19:00',
                                teacher_id: g.teacherId || '',
                                hall_id: g.hall_id || ''
                            };
                        }) as any;
                }

                return events.map(ev => {
                    const g = groups.find(x => x.id === ev.group_id);
                    const tid = ev.teacher_id || g?.teacherId;
                    const teacher = getTeacher(tid);
                    const capacity = g?.capacity != null ? Number(g.capacity) : undefined;
                    const teacherStyle = teacher?.specialty?.[0] || teacher?.bio || getHallName(ev.hall_id) || '';

                    let categoryLabel = g?.type;
                    if (!categoryLabel || categoryLabel === 'group' || categoryLabel === 'group_class') {
                        categoryLabel = g?.difficulty || l('ჯგუფური', 'Группа', 'Group');
                    }

                    const subtitleParts = [g?.type, g?.difficulty].filter(Boolean);
                    const groupSubtitle = subtitleParts.length > 0 ? subtitleParts.join(' • ') : (getHallName(ev.hall_id) || l('ჯგუფური', 'Группа', 'Group'));

                    return {
                        ...ev,
                        teacherName: getTeacherName(tid),
                        teacherPhoto: getTeacherPhoto(tid),
                        teacherStyle,
                        categoryLabel,
                        groupSubtitle,
                        hallName: getHallName(ev.hall_id),
                        studentCount: allStudents.filter(s => (s.enrolled_group_ids || []).includes(ev.group_id || '')).length,
                        capacity: capacity && capacity > 0 ? capacity : undefined,
                    };
                }).sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
            };

            let dates: Date[];
            if (scheduleView === 'day') {
                dates = [selectedDate];
            } else if (scheduleView === 'week') {
                const dow = (selectedDate.getDay() + 6) % 7; // Mon=0
                const monday = new Date(selectedDate);
                monday.setDate(selectedDate.getDate() - dow);
                dates = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
            } else {
                const year = selectedDate.getFullYear();
                const month = selectedDate.getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                dates = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
            }

            const groupsForView = dates
                .map(d => ({ date: getLocalISODate(d), items: buildForDate(d) }))
                .filter(g => scheduleView === 'day' || g.items.length > 0);
            setScheduleGroups(groupsForView as unknown as { date: string; items: ScheduleItem[] }[]);
        });

        // 3. Recent Activity feed — merges real check-ins (which carry a real
        // HH:MM time), today's new student registrations, and today's
        // subscription purchases into one feed, matching the reference
        // layout's "Recent Activity" card. Registrations/payments only carry
        // a date (not a time-of-day) in this app's data model, so they're
        // labeled "today" rather than a fabricated elapsed time.
        const activityItems: ActivityItem[] = [];
        const teacherStudentIds = isTeacher && visibleGroupIds
            ? new Set(studentsList.filter(s => (s.enrolled_group_ids || []).some(gid => visibleGroupIds.includes(gid))).map(s => s.id))
            : null;

        const allStudents = getStudents();
        const allGroups = getGroups();
        const todayLabel = l('დღეს', 'Сегодня', 'Today');

        checkins.forEach((c: CheckinRecord) => {
            if (teacherStudentIds && c.studentId && !teacherStudentIds.has(c.studentId)) return;
            const student = allStudents.find(s => s.id === c.studentId);
            const name = (student?.full_name && student.full_name.trim() !== '' && student.full_name !== 'სტუდენტი')
                ? student.full_name
                : (c.studentName && c.studentName !== 'სტუდენტი' ? c.studentName : (student?.full_name || t.studentLabelGeneric));

            const groupObj = c.groupId ? allGroups.find(g => g.id === c.groupId) : ((student?.enrolled_group_ids || []).length > 0 ? allGroups.find(g => g.id === (student?.enrolled_group_ids || [])[0]) : null);
            const groupName = groupObj?.name || t.groupSession;

            activityItems.push({
                id: `checkin-${c.studentId}-${c.time}`,
                kind: 'checkin',
                name,
                photo_url: student?.photo_url,
                detail: `${l('დასწრება აღინიშნა', 'Отметка посещения', 'Attendance marked')} (${groupName})`,
                timeLabel: c.time,
            });
        });

        studentsList
            .filter(s => s.created_at?.startsWith(todayStr))
            .forEach(s => {
                const groupObj = (s.enrolled_group_ids || []).length > 0 ? allGroups.find(g => g.id === (s.enrolled_group_ids || [])[0]) : null;
                activityItems.push({
                    id: `reg-${s.id}`,
                    kind: 'registration',
                    name: s.full_name || `${s.first_name} ${s.last_name}`,
                    photo_url: s.photo_url,
                    detail: `${l('ახალი რეგისტრაცია', 'Новая регистрация', 'New registration')}${groupObj ? ` (${groupObj.name})` : ''}`,
                    timeLabel: todayLabel,
                });
            });

        allSubsList
            .filter(sub => isSubOnDay(sub, todayStr))
            .forEach(sub => {
                const studentIds = (sub.student_id || '').split(',').map((x: string) => x.trim()).filter(Boolean);
                const student = allStudents.find(s => studentIds.includes(s.id));
                const price = subRevenue(sub, planPrices);
                activityItems.push({
                    id: `pay-${sub.id}`,
                    kind: 'payment',
                    name: student?.full_name || t.studentLabelGeneric,
                    photo_url: student?.photo_url,
                    detail: `${l('გადახდა მიღებულია', 'Платёж получен', 'Payment received')} (${formatCurrency(price, settings.currency)})`,
                    timeLabel: todayLabel,
                });
            });

        setRecentActivityItems(activityItems.slice(0, 8));

    }, [profile, selectedDate, scheduleView, settings.studioName, settings.currency, t, l]);

    useEffect(() => {
        refreshFullDashboard();
        // Any of these firing means the heavy student/subscription/attendance
        // caches actually have real data now (see the statsReady comment
        // above) — safe to trust liveStats as a confirmed value from here on.
        const onDataReady = () => { refreshFullDashboard(); markStatsReady(); };
        // 🛠️ FIX: switching the active branch (BranchSwitcher -> setActiveBranch,
        // which dispatches 'cc_branch_change') never triggered a recompute here —
        // the numbers only happened to change on whatever unrelated event fired
        // next (a hydration cycle, an edit elsewhere). Branch-scoped stats need
        // to redraw the moment the branch itself changes.
        window.addEventListener('cc_branch_change', refreshFullDashboard);
        window.addEventListener('cc_subscription_update', onDataReady);
        window.addEventListener('cc_attendance_update', onDataReady);
        window.addEventListener('cc_sale_update', onDataReady);
        window.addEventListener('cc_student_update', onDataReady);
        window.addEventListener('cc_data_hydrated', onDataReady);
        window.addEventListener('cc_sync_done', onDataReady);
        // Safety net: never leave the skeleton up forever if none of the above
        // fire for some reason (mirrors StudioContext's own 3s hydration timeout).
        const safety = setTimeout(markStatsReady, 4000);

        return () => {
            clearTimeout(safety);
            window.removeEventListener('cc_branch_change', refreshFullDashboard);
            window.removeEventListener('cc_subscription_update', onDataReady);
            window.removeEventListener('cc_attendance_update', onDataReady);
            window.removeEventListener('cc_sale_update', onDataReady);
            window.removeEventListener('cc_student_update', onDataReady);
            window.removeEventListener('cc_data_hydrated', onDataReady);
            window.removeEventListener('cc_sync_done', onDataReady);
        };
    }, [refreshFullDashboard, markStatsReady]);

    // Server-authoritative overlay for the 4 numbers get_dashboard_stats()
    // computes in Postgres instead of over a client-side array reduce
    // (active students, this month's revenue, today's check-ins, subs
    // expiring within 7 days) — overrides just those 4 fields on top of
    // refreshFullDashboard's existing client-side computation above, which
    // still drives every other card on this page (see
    // docs/architecture-migration.md §8 for why this pass stops there).
    useEffect(() => {
        let cancelled = false;
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        const loadServerStats = () => {
            getDashboardStatsAction(settings.activeBranchId || undefined).then(stats => {
                if (cancelled) return;
                setLiveStats(prev => ({
                    ...prev,
                    activeStudents: stats.activeStudents,
                    monthlyRevenue: stats.monthlyRevenue,
                    attendance: stats.todayCheckins,
                    expiringSoon: stats.expiringSoonStudents,
                }));
            }).catch(err => console.error('❌ [Dashboard] get_dashboard_stats failed:', err));
        };
        // 🛡️ A single hydration cycle (StudioContext) dispatches several of
        // the events below together in one burst — without this, each one
        // fired its own separate getDashboardStatsAction() call, showing up
        // as several duplicate POST /dashboard requests per page load.
        // Debounce so a burst collapses into one real call.
        const loadServerStatsDebounced = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadServerStats, 300);
        };
        loadServerStats();
        // 🛠️ FIX: this used to run once on mount ([] deps) with no branch
        // listener at all, so the RPC's own org-wide default (p_branch_id
        // NULL) always won here and silently overwrote the correctly
        // branch-scoped client-side numbers set by refreshFullDashboard
        // above — the actual reason the dashboard looked identical across
        // branches even after that computation was fixed. Re-subscribing on
        // every activeBranchId change (via the dependency array below) and
        // reacting to 'cc_branch_change' makes this overlay branch-aware too.
        const events = ['cc_branch_change', 'cc_subscription_update', 'cc_attendance_update', 'cc_sale_update', 'cc_student_update'];
        events.forEach(e => window.addEventListener(e, loadServerStatsDebounced));
        return () => {
            cancelled = true;
            if (debounceTimer) clearTimeout(debounceTimer);
            events.forEach(e => window.removeEventListener(e, loadServerStatsDebounced));
        };
    }, [settings.activeBranchId]);

    // No longer using isDemo hardcoded overrides
    const isDemo = false;
    const isStaffUser = profile?.role === 'teacher' || profile?.role === 'staff' || (typeof window !== 'undefined' && !!localStorage.getItem('cc_staff_session'));

    const isTeacher = isTeacherRole(profile?.role);
    const canViewRevenue = !isTeacher && (profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'manager' || !!profile?.canViewAnalytics || !!profile?.canViewBilling);

    const [billing, setBilling] = useState<any>(null);
    const [dashboardEditMode, setDashboardEditMode] = useState(false);
    const canEditDashboardWidgets = isOwnerOrAdmin(profile?.role) || profile?.role === 'administrator';

    useEffect(() => {
        const refreshBilling = () => {
            if (typeof window !== 'undefined' && settings?.studioSlug) {
                try {
                    const { getBillingState } = require('@/lib/saas-billing');
                    setBilling(getBillingState(settings.studioSlug));
                } catch { }
            }
        };
        refreshBilling();
        window.addEventListener('cc_sa_meta_update', refreshBilling);
        window.addEventListener('cc_subscription_update', refreshBilling);
        return () => {
            window.removeEventListener('cc_sa_meta_update', refreshBilling);
            window.removeEventListener('cc_subscription_update', refreshBilling);
        };
    }, [settings?.studioSlug]);

    if (!isLoaded || (loading && !isDemo)) return null;

    const renderWidget = (key: string) => {
        switch (key) {
            case 'students':
                return (
                    <DonutCard
                        loading={!statsReady}
                        title={l('სტუდენტები', 'Студенты', 'Students')}
                        icon={Users}
                        iconColorClass="text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
                        linkHref="/students"
                        linkLabel={l('სტუდენტები', 'Студенты', 'Students')}
                        centerValue={liveStats.totalStudents}
                        centerLabel={l('სულ სტუდენტი', 'Всего студентов', 'Total Students')}
                        defaultPct={liveStats.totalStudents > 0 ? `${Math.round((liveStats.activeStudents / liveStats.totalStudents) * 100)}% ${l('აქტიური', 'активных', 'active')}` : null}
                        segments={[
                            {
                                key: 'withSub',
                                label: l('აქტიური აბონემენტით', 'С абонементом', 'With active pass'),
                                count: liveStats.activeStudents,
                                color: '#10b981',
                                bgClass: 'bg-emerald-500',
                            },
                            {
                                key: 'withoutSub',
                                label: l('აბონემენტის გარეშე', 'Без абонемента', 'Without pass'),
                                count: Math.max(0, liveStats.totalStudents - liveStats.activeStudents),
                                color: '#f59e0b',
                                bgClass: 'bg-amber-500',
                            },
                            {
                                key: 'newStudents',
                                label: l('ახალი ამ თვეში', 'Новые в этом мес.', 'New this month'),
                                count: liveStats.newThisMonthStudents || 0,
                                color: '#6366f1',
                                bgClass: 'bg-indigo-500',
                            },
                        ]}
                    />
                );
            case 'revenue':
                if (!canViewRevenue) return null;
                return (
                    <DonutCard
                        loading={!statsReady}
                        title={l('თვის შემოსავალი', 'Доход за месяц', 'Monthly Revenue')}
                        icon={TrendingUp}
                        iconColorClass="text-amber-400 bg-amber-500/10 border-amber-500/20"
                        linkHref="/analytics"
                        linkLabel={l('ანალიტიკა', 'Аналитика', 'Analytics')}
                        centerValue={formatCurrency(liveStats.monthlyRevenue, settings.currency)}
                        centerLabel={l('შემოსავალი', 'Доход', 'Revenue')}
                        defaultPct={liveStats.monthlyRevenue > 0 && liveStats.monthlySubsRevenue > 0 ? `${Math.round((liveStats.monthlySubsRevenue / liveStats.monthlyRevenue) * 100)}% ${l('აბონემენტები', 'абонементы', 'subs')}` : null}
                        segments={[
                            {
                                key: 'subs',
                                label: l('აბონემენტები', 'Абонементы', 'Subscriptions'),
                                count: Math.round(liveStats.monthlySubsRevenue),
                                formattedValue: formatCurrency(Math.round(liveStats.monthlySubsRevenue), settings.currency),
                                color: '#8b5cf6',
                                bgClass: 'bg-violet-500',
                            },
                            {
                                key: 'shop',
                                label: l('მაღაზია / ბარი', 'Магазиნ / Бар', 'Shop / Bar'),
                                count: Math.round(liveStats.monthlyShopRevenue),
                                formattedValue: formatCurrency(Math.round(liveStats.monthlyShopRevenue), settings.currency),
                                color: '#10b981',
                                bgClass: 'bg-emerald-500',
                            },
                        ]}
                    />
                );
            case 'subscriptions':
                return (
                    <DonutCard
                        loading={!statsReady}
                        title={l('აბონემენტები', 'Абонементы', 'Subscriptions')}
                        icon={CreditCard}
                        iconColorClass="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                        linkHref="/subscriptions"
                        linkLabel={l('ყველა', 'Все', 'View all')}
                        centerValue={liveStats.subStatusCounts.active}
                        centerLabel={l('აქტიური აბონემენტი', 'Активных', 'Active')}
                        defaultPct={(() => {
                            const totalSubs = liveStats.subStatusCounts.active + liveStats.subStatusCounts.paused + liveStats.subStatusCounts.expired + liveStats.subStatusCounts.cancelled;
                            return totalSubs > 0 ? `${Math.round((liveStats.subStatusCounts.active / totalSubs) * 100)}% ${l('სულ', 'всего', 'of all')}` : null;
                        })()}
                        segments={[
                            {
                                key: 'active',
                                label: l('აქტიური', 'Активные', 'Active'),
                                count: liveStats.subStatusCounts.active,
                                color: '#10b981',
                                bgClass: 'bg-emerald-500',
                            },
                            {
                                key: 'paused',
                                label: l('შეჩერებული', 'На паузе', 'Paused'),
                                count: liveStats.subStatusCounts.paused,
                                color: '#f59e0b',
                                bgClass: 'bg-amber-500',
                            },
                            {
                                key: 'expired',
                                label: l('ვადაგასული', 'Истекшие', 'Expired'),
                                count: liveStats.subStatusCounts.expired,
                                color: '#f43f5e',
                                bgClass: 'bg-rose-500',
                            },
                            {
                                key: 'cancelled',
                                label: l('გაუქმებული', 'Отмененные', 'Cancelled'),
                                count: liveStats.subStatusCounts.cancelled,
                                color: '#6366f1',
                                bgClass: 'bg-indigo-500',
                            },
                        ]}
                    />
                );
            case 'attendance':
                return (
                    <DonutCard
                        loading={!statsReady}
                        title={l('დღევანდელი დასწრება', 'Посещаемость сегодня', "Today's Attendance")}
                        icon={CalendarCheck}
                        iconColorClass="text-violet-400 bg-violet-500/10 border-violet-500/20"
                        linkHref="/attendance"
                        linkLabel={l('ჟურნალი', 'Журнал', 'Journal')}
                        centerValue={liveStats.todayExpected > 0 ? `${Math.round((liveStats.attendance / liveStats.todayExpected) * 100)}%` : liveStats.attendance}
                        centerLabel={liveStats.todayExpected > 0 ? l('გამოცხადება', 'явка', 'turnout') : l('დამსწრე', 'посетило', 'attended')}
                        defaultPct={liveStats.todayExpected > 0 ? `${liveStats.attendance} / ${liveStats.todayExpected} ${l('მოსწავლე', 'учен.', 'students')}` : null}
                        segments={[
                            {
                                key: 'attended',
                                label: l('გამოცხადდა', 'Посетили', 'Attended'),
                                count: liveStats.attendance,
                                color: '#10b981',
                                bgClass: 'bg-emerald-500',
                            },
                            {
                                key: 'remaining',
                                label: l('მოსასვლელი', 'Ожидаются', 'Expected'),
                                count: Math.max(0, liveStats.todayExpected - liveStats.attendance),
                                color: '#8b5cf6',
                                bgClass: 'bg-violet-500',
                            },
                        ]}
                    />
                );
            case 'todaySchedule':
                return (
                    <TodayScheduleTimeline
                        groups={scheduleGroups}
                        selectedDate={selectedDate}
                        view={scheduleView}
                        onViewChange={setScheduleView}
                        onPrev={() => setSelectedDate(d => {
                            const n = new Date(d);
                            if (scheduleView === 'week') n.setDate(n.getDate() - 7);
                            else if (scheduleView === 'month') n.setMonth(n.getMonth() - 1);
                            else n.setDate(n.getDate() - 1);
                            return n;
                        })}
                        onNext={() => setSelectedDate(d => {
                            const n = new Date(d);
                            if (scheduleView === 'week') n.setDate(n.getDate() + 7);
                            else if (scheduleView === 'month') n.setMonth(n.getMonth() + 1);
                            else n.setDate(n.getDate() + 1);
                            return n;
                        })}
                        onToday={() => setSelectedDate(new Date())}
                        l={l}
                    />
                );
            case 'todayAttendance':
                return (
                    <TodayGroupsCard
                        lang={lang}
                        onRefreshDashboard={refreshFullDashboard}
                        currentDate={selectedDate}
                    />
                );
            case 'calendar':
                return (
                    <CalendarScheduleCard
                        lang={lang}
                        initialDate={selectedDate}
                    />
                );
            case 'aiAnalytics':
                return (
                    <AIAnalyticsCard
                        lang={lang}
                        liveStats={liveStats}
                        groupProgress={groupProgress}
                        currency={settings?.currency}
                        canViewRevenue={canViewRevenue}
                    />
                );
            case 'quickActions':
                return (
                    <QuickActionsPanel
                        onAddStudent={() => setShowAddStudent(true)}
                        onCreatePayment={() => setShowIssueSub(true)}
                        l={l}
                        editMode={dashboardEditMode}
                        actionIds={settings?.dashboardQuickActions}
                        onUpdateActions={(ids) => updateSettings({ dashboardQuickActions: ids })}
                    />
                );
            case 'todaySummary':
                return (
                    <TodaySummaryPanel
                        classesToday={liveStats.todayClassesCount}
                        attended={liveStats.attendance}
                        expected={liveStats.todayExpected}
                        newRegistrations={liveStats.newThisMonthStudents}
                        paymentsReceived={liveStats.todayRevenue}
                        currency={settings.currency}
                        l={l}
                    />
                );
            case 'upcomingEvents':
                return (
                    <UpcomingEventsCard
                        events={allEvents
                            .filter((ev: any) => ev.type === 'other' && ev.date > getLocalISODate(new Date()))
                            .sort((a: any, b: any) => a.date.localeCompare(b.date))
                            .slice(0, 4)}
                        l={l}
                    />
                );
            case 'recentActivity':
                return <RecentActivityCard items={recentActivityItems} l={l} />;
            case 'groupProgress':
                return <GroupProgressCard groups={groupProgress} l={l} />;
            default:
                return null;
        }
    };
    return (
        <div className="space-y-6 animate-fade-in relative max-w-7xl mx-auto">


            {/* Account Locked / Suspended Overlay */}
            {billing?.manualBlock && (
                <div className="fixed inset-0 z-[9999] backdrop-blur-xl bg-slate-900/60 flex items-center justify-center p-4 animate-in fade-in duration-500">
                    <div className="w-full max-w-[500px] bg-white rounded-[3rem] p-8 sm:p-12 text-center shadow-2xl border border-slate-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
                        
                        <div className="relative space-y-8">
                            <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto text-rose-500 shadow-inner">
                                <ShieldAlert className="w-10 h-10 animate-bounce" />
                            </div>
                            
                            <div className="space-y-4">
                                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">
                                    {l('ანგარიში შეზღუდულია', 'Аккаунт ограничен', 'Account Restricted')}
                                </h1>
                                <p className="text-sm font-bold text-slate-500 leading-relaxed px-4">
                                    {l('ანგარიში არ არის აქტიური, გთხოვთ გადაიხადოთ სააბონენტო გადასახადი მომსახურების გასაგრძელებლად.', 'Аккаунт не активен, пожалуйста, оплатите подписку для продолжения работы.', 'Account is not active, please pay the subscription fee to continue using the service.')}
                                </p>
                            </div>

                            <div className="pt-4 flex flex-col gap-3">
                                <Link href="/billing" className="h-14 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/20 active:scale-95 transition-all hover:bg-indigo-700">
                                    <CreditCard className="w-4 h-4" />
                                    {t.billing || 'Billing'}
                                </Link>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="h-12 bg-slate-50 text-slate-400 rounded-2xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors"
                                >
                                    <RefreshCcw className="w-3.5 h-3.5" />
                                    {t.refreshPage || 'Refresh'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Billing Expiration Notification */}
            {settings.plan !== 'pro' && settings.plan !== 'custom' && billing?.status === 'trial' && (billing?.daysLeftInTrial ?? 0) <= 3 && !isStaffUser && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-2 sm:p-5 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 animate-in slide-in-from-top-4 duration-500 shadow-xl shadow-amber-500/5">
                    <div className="flex items-center gap-2.5 sm:gap-4 text-center sm:text-left">
                        <div className="w-7 h-7 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 flex-shrink-0">
                            <Zap className="w-3.5 h-3.5 sm:w-5 sm:h-5 fill-amber-500/30" />
                        </div>
                        <div>
                            <h3 className="text-[11px] sm:text-[15px] font-black text-amber-700 tracking-tight">
                                {t.trialEnding}
                            </h3>
                            <p className="text-[8px] sm:text-[11px] font-bold text-amber-600/70 mt-0.5 uppercase tracking-tighter">
                                {t.trialEndingDesc.replace('{days}', String(billing.daysLeftInTrial))}
                            </p>
                        </div>
                    </div>
                    <Link href="/billing" className="w-full sm:w-auto text-center px-4 py-2 sm:px-6 sm:py-2.5 bg-amber-500 hover:bg-amber-600 text-[9px] sm:text-[11px] font-black text-white rounded-lg sm:rounded-xl transition-all active:scale-95 tracking-widest uppercase">
                        {t.billing}
                    </Link>
                </div>
            )}

            {/* ─── Dashboard widget customization toggle (owner/admin only) ─── */}
            {canEditDashboardWidgets && (
                <div className="flex justify-end mb-2">
                    <button
                        onClick={() => setDashboardEditMode(v => !v)}
                        className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors border",
                            dashboardEditMode
                                ? "bg-indigo-500 text-white border-indigo-500"
                                : "bg-card text-muted border-border-subtle hover:text-primary hover:bg-surface"
                        )}
                    >
                        {dashboardEditMode ? <X className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                        {dashboardEditMode
                            ? l('დახურვა', 'Готово', 'Done')
                            : l('ვიჯეტების რედაქტირება', 'Настроить виджеты', 'Customize Widgets')}
                    </button>
                </div>
            )}

            {/* ─── Operations & Analytics (Donut Cards: 2x2 on mobile, 4 in 1 row on desktop) ─── */}
            <div className={cn("grid gap-2.5 sm:gap-4 mb-4 items-stretch", canViewRevenue ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
                {(['stat1', 'stat2', 'stat3', 'stat4'] as const).map(slot => {
                    const key = resolveSlotWidget(settings.dashboardWidgets, slot);
                    if (key === 'revenue' && !canViewRevenue) return null;
                    return (
                        <WidgetSlot key={slot} editMode={dashboardEditMode} size="stat" currentKey={key} lang={lang}
                            onChange={(k) => updateSettings({ dashboardWidgets: { ...settings.dashboardWidgets, [slot]: k } })}>
                            {renderWidget(key)}
                        </WidgetSlot>
                    );
                })}
            </div>


            {/* ─── Today's Schedule + Quick Actions / Today's Summary ─── */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch mb-6">
                <div className="xl:col-span-8">
                    {(() => {
                        const key = resolveSlotWidget(settings.dashboardWidgets, 'mainLarge');
                        return (
                            <WidgetSlot editMode={dashboardEditMode} size="large" currentKey={key} lang={lang}
                                onChange={(k) => updateSettings({ dashboardWidgets: { ...settings.dashboardWidgets, mainLarge: k } })}>
                                {renderWidget(key)}
                            </WidgetSlot>
                        );
                    })()}
                </div>
                <div className="xl:col-span-4 flex flex-col gap-5 justify-between">
                    {(['sideTop', 'sideBottom'] as const).map(slot => {
                        const key = resolveSlotWidget(settings.dashboardWidgets, slot);
                        return (
                            <WidgetSlot key={slot} editMode={dashboardEditMode} size="side" currentKey={key} lang={lang}
                                onChange={(k) => updateSettings({ dashboardWidgets: { ...settings.dashboardWidgets, [slot]: k } })}>
                                {renderWidget(key)}
                            </WidgetSlot>
                        );
                    })}
                </div>
            </div>

            {/* ─── Upcoming Events / Recent Activity / Group Progress ─── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch mb-6">
                {(['bottom1', 'bottom2', 'bottom3'] as const).map(slot => {
                    const key = resolveSlotWidget(settings.dashboardWidgets, slot);
                    return (
                        <WidgetSlot key={slot} editMode={dashboardEditMode} size="bottom" currentKey={key} lang={lang}
                            onChange={(k) => updateSettings({ dashboardWidgets: { ...settings.dashboardWidgets, [slot]: k } })}>
                            {renderWidget(key)}
                        </WidgetSlot>
                    );
                })}
            </div>

            {/* ─── Modals ─── */}
            {showAddStudent && (
                <StudentModal
                    open={showAddStudent}
                    centered={true}
                    onClose={() => setShowAddStudent(false)}
                    onSave={(data) => {
                        if (data.id) {
                            updateStudent(data.id, data);
                        }
                        setShowAddStudent(false);
                    }}
                />
            )}


            {showIssueSub && (
                <IssueSubscriptionModal
                    open={showIssueSub}
                    centered={true}
                    onClose={() => setShowIssueSub(false)}
                    onIssue={(data) => {
                        import('@/lib/subscription-store').then(mod => {
                            mod.saveSubscription(data.student_id, {
                                ...data,
                                id: `sub_${Date.now()}`
                            } as any);
                            setShowIssueSub(false);
                        });
                    }}
                />
            )}

            {/* Trial Banner at bottom */}
            {settings.plan !== 'pro' && settings.plan !== 'custom' && billing?.status === 'trial' && !isStaffUser && (
                <div className="bg-gradient-to-r from-indigo-500 to-violet-600 rounded-3xl sm:rounded-[2rem] p-4 sm:p-6 md:p-8 text-white shadow-2xl shadow-indigo-500/20 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4 sm:gap-6 mt-6 sm:mt-12 mb-6 sm:mb-8 relative z-10 border border-white/10 w-full ml-0 mr-0">
                    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5 text-center sm:text-left">
                        <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 shadow-inner">
                            <Zap className="w-5 h-5 sm:w-7 sm:h-7 text-white animate-pulse" />
                        </div>
                        <div className="space-y-0.5 sm:space-y-1">
                            <h2 className="text-[15px] sm:text-xl md:text-2xl font-black tracking-tight">{t.trialActive}</h2>
                            <p className="text-[11px] sm:text-xs md:text-sm font-bold text-white/90">
                                {t.trialEndingDesc.replace('{days}', String(billing?.daysLeftInTrial ?? 0))}
                            </p>
                        </div>
                    </div>
                    <Link href="/billing" className="w-full sm:w-auto px-5 py-3.5 sm:px-8 sm:py-4 bg-white text-indigo-600 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-opacity-90 active:scale-95 transition-all shadow-xl text-center flex-shrink-0">
                        {t.buyPlan || 'Buy Package'}
                    </Link>
                </div>
            )}

            {/* Bottom spacer for mobile navigation clearance - balanced buffer */}
            <div className="h-32 lg:hidden" />
        </div>
    );
}
