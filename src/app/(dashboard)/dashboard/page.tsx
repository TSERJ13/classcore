'use client';

import { useState, useEffect, useCallback } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { getTodayCheckins, type CheckinRecord } from '@/lib/checkin-store';
import { getUniqueSubscriptions } from '@/lib/subscription-store';
import { getSales } from '@/lib/sales-store';
import Link from 'next/link';
import { Zap, Users, CreditCard, CalendarCheck, TrendingUp, Activity, UserPlus, ClipboardList, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, ShoppingBag, RefreshCcw, ShieldAlert } from 'lucide-react';
import { cn, getLocalISODate, formatCurrency } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { getTodayEvents } from '@/lib/event-store';
import { getStudents, updateStudent } from '@/lib/student-store';
import { getTeacherName, getTeacherPhoto } from '@/lib/teacher-store';
import { getHallName } from '@/lib/hall-store';
import { getGroups } from '@/lib/group-store';
import { getTeachers } from '@/lib/teacher-store';
import { getVisibleGroupIds, isTeacherRole } from '@/lib/access';
import { pctChange, buildPlanPrices, subRevenue, isSubInMonth, isSubOnDay } from '@/lib/studio-stats';
import { getPlans } from '@/lib/plan-store';
import { getDashboardStatsAction } from '@/app/actions/dashboard';
import StudentModal from '@/components/students/StudentModal';
import { IssueSubscriptionModal } from '@/components/subscriptions/IssueSubscriptionModal';

import { getScopedKey } from '@/lib/settings-store';

// ─── Mini calendar helpers ──────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay(); // 0=Sun
}

// Mini calendar helpers moved to use centralized translations

// Days with events (demo) - removed in favor of real events
function MiniCalendar({ t, selectedDate, rangeStart, rangeEnd, onSelect, onRangeSelect, events = [] }: {
    t: any;
    selectedDate: Date;
    rangeStart?: Date | null;
    rangeEnd?: Date | null;
    onSelect: (d: Date) => void;
    onRangeSelect: (start: Date | null, end: Date | null) => void;
    events?: any[]
}) {
    const [year, setYear] = useState(selectedDate.getFullYear());
    const [month, setMonth] = useState(selectedDate.getMonth());
    const now = new Date();
    const today = now.getDate();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const months = [t.jan, t.feb, t.mar, t.apr, t.may, t.jun, t.jul, t.aug, t.sep, t.oct, t.nov, t.dec];
    const weeks = [t.shortSun, t.shortMon, t.shortTue, t.shortWed, t.shortThu, t.shortFri, t.shortSat];

    function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
    function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const handleDateClick = (d: number) => {
        const date = new Date(year, month, d);
        onSelect(date);

        if (!rangeStart || (rangeStart && rangeEnd)) {
            onRangeSelect(date, null);
        } else {
            if (date < rangeStart) {
                onRangeSelect(date, rangeStart);
            } else if (date.getTime() === rangeStart.getTime()) {
                onRangeSelect(null, null);
            } else {
                onRangeSelect(rangeStart, date);
            }
        }
    };

    const isInRange = (d: number) => {
        if (!rangeStart || !rangeEnd) return false;
        const date = new Date(year, month, d);
        return date >= rangeStart && date <= rangeEnd;
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-sm font-semibold text-primary">{months[month]} {year}</span>
                    {rangeStart && rangeEnd ? (
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-indigo-400 font-bold">
                                {rangeStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {rangeEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                            <button
                                onClick={() => onRangeSelect(null, null)}
                                className="text-[9px] text-indigo-400/60 hover:text-indigo-300 font-bold tracking-tighter"
                            >
                                {t.clear || 'Clear Selection'}
                            </button>
                        </div>
                    ) : rangeStart && (
                        <button
                            onClick={() => onRangeSelect(null, null)}
                            className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold tracking-tighter"
                        >
                            {t.clear || 'Clear Selection'}
                        </button>
                    )}
                </div>
                <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
                {weeks.map(w => (
                    <div key={w} className="text-center text-[10px] font-bold text-muted/40 py-1">{w}</div>
                ))}
            </div>
            {/* Days */}
            <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((d, i) => {
                    if (!d) return <div key={i} />;
                    const isToday = isCurrentMonth && d === today;
                    const isSelected = selectedDate.getDate() === d && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
                    const isStart = rangeStart && rangeStart.getDate() === d && rangeStart.getMonth() === month && rangeStart.getFullYear() === year;
                    const isEnd = rangeEnd && rangeEnd.getDate() === d && rangeEnd.getMonth() === month && rangeEnd.getFullYear() === year;
                    const inRange = isInRange(d);

                    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const hasEvent = events.some(e => {
                        if (e.date === dayStr) return true;
                        if (e.recurring === 'weekly') {
                            const evDate = new Date(`${e.date}T00:00:00`);
                            const targetDate = new Date(`${dayStr}T00:00:00`);
                            return evDate.getDay() === targetDate.getDay() && targetDate.getTime() >= evDate.getTime();
                        }
                        return false;
                    });

                    return (
                        <button key={i}
                            onClick={() => handleDateClick(d)}
                            className={cn(
                                "relative flex flex-col items-center justify-center h-8 transition-colors hover:bg-surface",
                                (isStart || isEnd) ? "bg-indigo-500/20 rounded-lg" : inRange ? "bg-indigo-500/5" : "rounded-lg",
                                isSelected && !isStart && !isEnd && !inRange && "bg-indigo-500/10 border border-indigo-500/20"
                            )}>
                            <span className={cn('text-xs font-medium leading-none transition-colors z-10',
                                isToday
                                    ? 'w-7 h-7 flex items-center justify-center bg-indigo-500 text-white rounded-full font-black text-[11px] shadow-sm'
                                    : (isSelected || isStart || isEnd)
                                        ? 'text-indigo-500 font-black text-[11px]'
                                        : 'text-primary/60 group-hover:text-primary',
                                inRange && !isStart && !isEnd && 'text-indigo-400/80'
                            )}>
                                {d}
                            </span>
                            {hasEvent && (
                                <span className={cn("absolute bottom-1 w-1 h-1 rounded-full",
                                    (isSelected || isStart || isEnd || isToday) ? "bg-indigo-400" : "bg-indigo-400/70"
                                )} />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Today's schedule ───────────────────────────────────────────────────────
// Static SCHEDULE mock removed in favor of live event-store

// ─── Recent activity ────────────────────────────────────────────────────────


function actionBadge(action: string, t: any) {
    if (action === 'check-in') return { label: t.checkInActivity, cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' };
    if (action === 'subscription') return { label: t.subscriptions, cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20' };
    if (action === 'sale') return { label: t.saleActivity, cls: 'bg-violet-500/15 text-violet-400 border-violet-500/20' };
    return { label: t.new, cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20' };
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const { t, lang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const { settings, isLoaded } = useStudio();
    const { profile, loading } = useUser();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [revenueRange, setRevenueRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
    const [liveStats, setLiveStats] = useState({
        totalStudents: 0,
        activeStudents: 0,
        activeSubs: 0,
        newThisMonth: 0,
        churnThisMonth: 0,
        attendance: 0,
        attendanceRateMonth: 0,
        monthlyRevenue: 0,
        prevMonthRevenue: 0,
        todayRevenue: 0,
        totalDebt: 0,
        expiringSoon: 0,
        oneSessionLeft: 0,
        inactiveSubs: 0,
        newStudents3m: 0,
        leftStudents3m: 0,
        revenueChange: 0,
        activeChange: 0,
        subsThisMonth: 0,
        subsLastMonth: 0,
        subsChange: 0,
        todayExpected: 0,
    });
    const [liveActivity, setLiveActivity] = useState<{ action: string; color: string; avatar: string; name: string; group: string; time: string }[]>([]);
    const [liveSchedule, setLiveSchedule] = useState<any[]>([]);
    const [allEvents] = useState<any[]>([]);
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

    // Cloud Sync State
    const [syncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
    const [lastSyncTime] = useState<number | null>(null);

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
        try {
            const todayEvents = getTodayEvents().filter((ev: any) => !isTeacher || !visibleGroupIds || (ev.group_id && visibleGroupIds.includes(ev.group_id)));
            const todayGroupIds = new Set(todayEvents.map((ev: any) => ev.group_id).filter(Boolean));
            if (todayGroupIds.size > 0) {
                todayExpected = studentsList.filter(s => s.enrolled_group_ids?.some(gid => todayGroupIds.has(gid))).length;
            }
        } catch { /* ignore */ }

        // ── Needs Attention ───────────────────────────────────────────────────
        const expiringSoonStudents = new Set<string>();
        const oneSessionStudents = new Set<string>();
        
        const nextWeek = new Date(now);
        nextWeek.setDate(now.getDate() + 7);
        const nextWeekStr = getLocalISODate(nextWeek);
        
        studentsList.forEach(s => {
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
                
                if (!hasExpiredByDate && !hasUsedAllSessions) {
                    if (sub.expires_at <= nextWeekStr) {
                        expiringSoonStudents.add(s.id);
                    }
                    if (remaining === 1) {
                        oneSessionStudents.add(s.id);
                    }
                }
            }
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
            expiringSoon: expiringSoonStudents.size,
            oneSessionLeft: oneSessionStudents.size,
            todayRevenue: sales.filter(s => s.date === todayStr).reduce((sum, s) => sum + s.price * s.quantity, 0) + allSubsList.filter(sub => isSubOnDay(sub, todayStr)).reduce((sum, sub) => sum + subRevenue(sub, planPrices), 0),
        }));

        // 2. Refresh Schedule & Activity
        import('@/lib/event-store').then(mod => {
            const dateStr = getLocalISODate(selectedDate);
            const dayOfWeek = (selectedDate.getDay() + 6) % 7;
            let events = mod.getEventsByDate(dateStr).filter(ev => {
                if (isTeacher && visibleGroupIds && ev.group_id && !visibleGroupIds.includes(ev.group_id)) return false;
                return true;
            });

            const allStudents = getStudents();
            const groups = getGroups();

            // Fallback: If no explicit calendar events on date, pull from group schedule_slots or assigned groups!
            if (events.length === 0 && groups.length > 0) {
                events = groups
                    .filter(g => {
                        if (isTeacher && visibleGroupIds && !visibleGroupIds.includes(g.id)) return false;
                        return true;
                    })
                    .slice(0, 6)
                    .map(g => {
                        const slot = g.schedule_slots?.find(s => s.dayOfWeek === dayOfWeek);
                        return {
                            id: `virt-dash-${g.id}`,
                            group_id: g.id,
                            title: g.name,
                            type: 'group',
                            color: g.color || '#6d28d9',
                            start_time: slot?.startTime || '18:00',
                            end_time: slot?.endTime || '19:00',
                            teacher_id: g.teacherId || '',
                            hall_id: g.hall_id || ''
                        };
                    }) as any;
            }

            const scheduleWithDetails = events.map(ev => {
                const g = groups.find(x => x.id === ev.group_id);
                const tid = ev.teacher_id || g?.teacherId;
                return {
                    ...ev,
                    teacherName: getTeacherName(tid),
                    teacherPhoto: getTeacherPhoto(tid),
                    hallName: getHallName(ev.hall_id),
                    studentCount: allStudents.filter(s => (s.enrolled_group_ids || []).includes(ev.group_id || '')).length
                };
            });
            setLiveSchedule(scheduleWithDetails);
        });

        // 3. Activity Refresh
        const activityList: any[] = [];
        const teacherStudentIds = isTeacher && visibleGroupIds
            ? new Set(studentsList.filter(s => (s.enrolled_group_ids || []).some(gid => visibleGroupIds.includes(gid))).map(s => s.id))
            : null;

        const allStudents = getStudents();
        const allGroups = getGroups();

        checkins.forEach((c: CheckinRecord) => {
            if (teacherStudentIds && c.studentId && !teacherStudentIds.has(c.studentId)) return;
            const student = allStudents.find(s => s.id === c.studentId);
            const name = (student?.full_name && student.full_name.trim() !== '' && student.full_name !== 'სტუდენტი')
                ? student.full_name
                : (c.studentName && c.studentName !== 'სტუდენტი' ? c.studentName : (student?.full_name || t.studentLabelGeneric));

            const groupObj = c.groupId ? allGroups.find(g => g.id === c.groupId) : ((student?.enrolled_group_ids || []).length > 0 ? allGroups.find(g => g.id === (student?.enrolled_group_ids || [])[0]) : null);
            const groupName = groupObj?.name || t.groupSession;

            activityList.push({
                name,
                action: 'check-in',
                group: groupName,
                time: c.time,
                avatar: name ? name[0] : 'S',
                color: 'from-indigo-500 to-blue-600'
            });
        });

        setLiveActivity(activityList.slice(0, 8));

    }, [profile, selectedDate, settings.studioName, t]);

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

    const getLocalizedDate = (date: Date, t: any) => {
        const weekdays = [t.sunday, t.monday, t.tuesday, t.wednesday, t.thursday, t.friday, t.saturday];
        const months = [t.jan, t.feb, t.mar, t.apr, t.may, t.jun, t.jul, t.aug, t.sep, t.oct, t.nov, t.dec];

        const day = date.getDate();
        const month = months[date.getMonth()];
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
        const weekday = isMobile ? [t.shortSun, t.shortMon, t.shortTue, t.shortWed, t.shortThu, t.shortFri, t.shortSat][date.getDay()] : weekdays[date.getDay()];
        const year = date.getFullYear();

        return `${weekday}, ${day} ${month} ${year}`;
    };

    const getSubtext = (type: 'today' | 'monthly') => {
        const now = new Date();
        const months = [t.jan, t.feb, t.mar, t.apr, t.may, t.jun, t.jul, t.aug, t.sep, t.oct, t.nov, t.dec];
        if (type === 'today') {
            // Just show: "2 March" — no "Today is" prefix
            return `${now.getDate()} ${months[now.getMonth()]}`;
        }
        if (revenueRange.start && revenueRange.end) {
            return `${revenueRange.start.getDate()} ${months[revenueRange.start.getMonth()]} - ${revenueRange.end.getDate()} ${months[revenueRange.end.getMonth()]}`;
        }
        // Current month: 1st to Today
        return `1 ${months[now.getMonth()]} - ${now.getDate()} ${months[now.getMonth()]}`;
    };

    const dateStr = getLocalizedDate(selectedDate, t);
    const isTeacher = isTeacherRole(profile?.role);
    const canViewRevenue = !isTeacher && (profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'manager' || !!profile?.canViewAnalytics || !!profile?.canViewBilling);

    const stats = [
        { label: isTeacher ? (l('ჯგუფის სტუდენტები', 'Студенты группы', 'Group Students')) : t.totalStudents, value: String(liveStats.totalStudents), change: (liveStats.activeChange >= 0 ? `+${liveStats.activeChange}%` : `${liveStats.activeChange}%`), sub: null, icon: Users, color: 'indigo' },
        { label: isTeacher ? (l('აქტიური აბონემენტები', 'Активные абонементы', 'Active Subscriptions')) : t.activeSubscriptions, value: String(liveStats.activeSubs), change: (liveStats.newThisMonth >= 0 ? `+${liveStats.newThisMonth}` : String(liveStats.newThisMonth)), sub: null, icon: CreditCard, color: 'emerald' },
        ...(canViewRevenue ? [
            { label: t.todayRevenue, value: formatCurrency(liveStats.todayRevenue, settings.currency), change: (liveStats.revenueChange >= 0 ? `+${liveStats.revenueChange}%` : `${liveStats.revenueChange}%`), sub: getSubtext('today'), icon: TrendingUp, color: 'amber' },
            { label: (revenueRange.start && revenueRange.end) ? (t.selectedPeriod || 'Selected Period') : t.monthlyRevenue, value: formatCurrency(liveStats.monthlyRevenue, settings.currency), change: (liveStats.revenueChange >= 0 ? `+${liveStats.revenueChange}%` : `${liveStats.revenueChange}%`), sub: getSubtext('monthly'), icon: Activity, color: 'violet' },
        ] : [])
    ];

    const colorMap: Record<string, { bg: string; text: string; border: string; glow: string }> = {
        indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', glow: 'shadow-indigo-500/10' },
        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/10' },
        violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', glow: 'shadow-violet-500/10' },
        amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', glow: 'shadow-amber-500/10' },
    };

    const nowHour = new Date().getHours();
    const isToday = selectedDate.toDateString() === new Date().toDateString();

    const currentClass = isToday ? (liveSchedule as { start_time: string; title: string }[]).find(s => {
        if (!s.start_time) return false;
        const h = parseInt(s.start_time.split(':')[0] || '0');
        return h <= nowHour && h + 2 > nowHour;
    }) : null;

    const [billing, setBilling] = useState<any>(null);

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

            {/* ─── Top bar ─── */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center flex-wrap gap-2.5 sm:gap-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight flex items-center gap-2">
                                {t.greeting || 'გამარჯობა'}, {profile?.first_name || profile?.full_name?.split(' ')[0] || ''} <span className="text-xl sm:text-2xl">👋</span>
                                
                                {/* Cloud Sync Status Indicator */}
                                <div 
                                    className="flex items-center justify-center w-6 h-6 group relative" 
                                    title={lastSyncTime ? `ბოლო სინქრონიზაცია: ${new Date(lastSyncTime).toLocaleTimeString()}` : 'სინქრონიზაცია ჩართულია'}>
                                    <div className={cn(
                                        "w-2 h-2 rounded-full transition-all duration-1000",
                                        syncStatus === 'synced' ? "bg-emerald-500 animate-pulse-slow" :
                                        syncStatus === 'syncing' ? "bg-amber-500 animate-pulse" : "bg-red-500 animate-bounce"
                                    )} />
                                </div>

                                {settings.plan === 'pro' && (
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 border border-indigo-400/20 animate-in zoom-in-50 duration-700">
                                        <span className="text-[8px] sm:text-[10px] font-black text-white uppercase tracking-widest leading-none">PRO</span>
                                    </div>
                                )}
                            </h1>
                        </div>
                    </div>
                    {(() => {
                        const displayStudioName = profile?.studio_name || (settings?.studioName && !/^[0-9a-f-]{20,}$/i.test(settings.studioName) ? settings.studioName : null) || 'ST Dance Studio';
                        return (
                            <p className="text-[10px] sm:text-xs text-muted font-black mt-1 tracking-[0.15em] opacity-40">
                                {displayStudioName} · <span suppressHydrationWarning className="text-indigo-500">{dateStr}</span>
                            </p>
                        );
                    })()}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {currentClass && (
                        <div className="hidden lg:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-medium text-emerald-400">{currentClass.title}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Statistics (2x2 Grid) ─── */}
            <div className={cn("grid gap-3 sm:gap-4 items-stretch pb-2", stats.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-card border border-border-subtle rounded-2xl p-4 flex flex-col items-start transition-all relative overflow-hidden group hover:border-border-subtle/60">
                        <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-${stat.color}-500/10 to-transparent rounded-bl-[4rem] -mr-4 -mt-4 transition-transform group-hover:scale-110`} />
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${colorMap[stat.color].bg} ${colorMap[stat.color].text}`}>
                            <stat.icon className="w-4 h-4" />
                        </div>
                        <p className="text-[10px] sm:text-xs font-bold text-muted mb-1">{stat.label}</p>
                        <div className="flex items-end gap-2 mt-auto">
                            {!statsReady ? (
                                <span className="h-6 sm:h-7 w-14 rounded-md bg-surface animate-pulse" />
                            ) : (
                                <>
                                    <span className="text-xl sm:text-2xl font-black text-primary leading-none">{stat.value}</span>
                                    {stat.change && (
                                        <span className={cn(
                                            "text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 mb-0.5",
                                            stat.change.startsWith('+') && stat.change !== '+0%' && stat.change !== '+0' ? "text-emerald-500 bg-emerald-500/10" :
                                            stat.change.startsWith('-') ? "text-rose-500 bg-rose-500/10" : "text-muted bg-surface"
                                        )}>
                                            {stat.change.startsWith('+') && stat.change !== '+0%' && stat.change !== '+0' ? <ArrowUpRight className="w-2.5 h-2.5" /> :
                                             stat.change.startsWith('-') ? <ArrowDownRight className="w-2.5 h-2.5" /> : null}
                                            {stat.change.replace('+', '')}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* ─── Needs Attention ─── */}
            {(liveStats.expiringSoon > 0 || liveStats.oneSessionLeft > 0) && (
                <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4 mb-6 animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                        </div>
                        <h3 className="text-xs font-bold text-rose-600 tracking-wide uppercase">{l('საჭიროებს ყურადღებას', 'Требует внимания', 'Needs Attention')}</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {liveStats.expiringSoon > 0 && (
                            <Link href="/subscriptions" className="flex items-center gap-3 bg-white/50 hover:bg-white dark:bg-slate-900/50 dark:hover:bg-slate-900 border border-rose-500/10 rounded-xl p-3 transition-colors">
                                <span className="text-rose-500 font-black text-lg w-6 text-center">{liveStats.expiringSoon}</span>
                                <span className="text-[11px] font-medium text-rose-600/80">{l('სტუდენტს ეწურება აბონემენტი ამ კვირაში', 'студентов заканчивается абонемент на этой неделе', 'students subscriptions expire this week')}</span>
                            </Link>
                        )}
                        {liveStats.oneSessionLeft > 0 && (
                            <Link href="/subscriptions" className="flex items-center gap-3 bg-white/50 hover:bg-white dark:bg-slate-900/50 dark:hover:bg-slate-900 border border-rose-500/10 rounded-xl p-3 transition-colors">
                                <span className="text-amber-500 font-black text-lg w-6 text-center">{liveStats.oneSessionLeft}</span>
                                <span className="text-[11px] font-medium text-amber-600/80">{l('სტუდენტს დარჩა 1 გაკვეთილი', 'студентов остался 1 урок', 'students have 1 lesson left')}</span>
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Main 3-column grid ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                {/* ── Left: Calendar + Quick actions ── */}
                <div className="lg:col-span-3 space-y-4">

                    {/* Calendar */}
                    <div className="bg-card border border-border-subtle rounded-2xl p-4">
                        <MiniCalendar
                            t={t}
                            selectedDate={selectedDate}
                            rangeStart={revenueRange.start}
                            rangeEnd={revenueRange.end}
                            onSelect={setSelectedDate}
                            onRangeSelect={(start, end) => setRevenueRange({ start, end })}
                            events={allEvents}
                        />
                    </div>

                    {/* Quick actions */}
                    <div className="bg-card border border-border-subtle rounded-2xl p-3 sm:p-4">
                        <p className="text-[10px] font-bold text-muted tracking-widest mb-2.5">{t.quickActions}</p>
                        <div className="grid grid-cols-4 gap-1 w-full">
                            {[
                                {
                                    label: t.addStudentShort || 'ახალი',
                                    icon: UserPlus,
                                    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20',
                                    onClick: () => setShowAddStudent(true)
                                },
                                {
                                    label: t.attendance || 'დასწრება',
                                    icon: CalendarCheck,
                                    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20',
                                    href: '/attendance'
                                },
                                {
                                    label: t.issuePlan || 'აბონემენტი',
                                    icon: CreditCard,
                                    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20',
                                    onClick: () => setShowIssueSub(true)
                                },
                                {
                                    label: t.shop || 'მაღაზია',
                                    icon: ShoppingBag,
                                    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20',
                                    href: '/shop'
                                },
                            ].map((a, idx) => {
                                const Icon = a.icon;
                                const content = (
                                    <div className="flex flex-col items-center justify-center p-1 gap-1 w-full">
                                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-[0.9rem] border flex items-center justify-center transition-all ${a.color}`}>
                                            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                                        </div>
                                        <span className="text-[9px] font-bold tracking-tight text-primary/80 truncate w-full text-center">{a.label}</span>
                                    </div>
                                );

                                return a.href ? (
                                    <Link key={idx} href={a.href} className="group w-full flex justify-center">
                                        {content}
                                    </Link>
                                ) : (
                                    <button key={idx} onClick={a.onClick} className="group w-full flex justify-center">
                                        {content}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ── Middle: Today's schedule ── */}
                <div className="lg:col-span-4 bg-card border border-border-subtle rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)))}
                                className="p-1 hover:bg-surface rounded-md text-muted transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <h2 className="text-sm font-semibold text-primary">
                                {isToday ? t.todaySchedule : dateStr}
                            </h2>
                            <button
                                onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)))}
                                className="p-1 hover:bg-surface rounded-md text-muted transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                        <a href="/calendar" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                            {t.allLink}
                        </a>
                    </div>
                    <div className="divide-y divide-border-subtle max-h-[400px] overflow-y-auto">
                        {liveSchedule.length > 0 ? (
                            (liveSchedule as { start_time: string; color: string; title: string; teacher_id: string }[]).map((cls, i) => {
                                const startTime = cls.start_time || '00:00';
                                const h = parseInt(startTime.split(':')[0] || '0');
                                const isCurrent = isToday && h <= nowHour && h + 2 > nowHour;
                                return (
                                    <div key={i} className={`flex items-center gap-3 px-5 py-3.5 hover:bg-surface transition-colors ${isCurrent ? 'bg-surface' : ''}`}>
                                        <div className="w-10 text-center flex-shrink-0">
                                            <p className={`text-xs font-bold tabular-nums ${isCurrent ? 'text-indigo-400' : 'text-muted/40'}`}>{startTime}</p>
                                        </div>
                                        <div className={`w-1 h-8 rounded-full flex-shrink-0`} style={{ backgroundColor: cls.color || '#6366f1' }} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-primary' : 'text-primary/75'}`}>{cls.title || t.unnamed}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {(cls as any).teacherName && (
                                                    <p className="text-[10px] font-bold text-muted/40 truncate">{(cls as any).teacherName}</p>
                                                )}
                                                {(cls as any).hallName && (
                                                    <p className="text-[10px] font-bold text-indigo-500/50 truncate flex items-center gap-1">
                                                        <span className="w-1 h-1 rounded-full bg-indigo-500/30" />
                                                        {(cls as any).hallName}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {(cls as any).teacherPhoto ? (
                                            <img src={(cls as any).teacherPhoto} alt="" className="w-7 h-7 rounded-full object-cover border border-border-subtle" />
                                        ) : (
                                            (cls as any).teacherName && (
                                                <div className="w-7 h-7 rounded-full bg-muted/5 border border-border-subtle flex items-center justify-center text-[10px] font-black text-muted/40 uppercase">
                                                    {(cls as any).teacherName.substring(0, 2)}
                                                </div>
                                            )
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-10 text-center">
                                <p className="text-xs text-muted/40 font-medium">
                                    {t.noEventsToday}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right: Recent activity ── */}
                <div className="lg:col-span-5 bg-card border border-border-subtle rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-muted" />
                            <h2 className="text-sm font-semibold text-primary">{t.recentActivity}</h2>
                        </div>
                        <a href="/attendance" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                            {t.allLink}
                        </a>
                    </div>
                    <div className="divide-y divide-border-subtle">
                        {liveActivity.length > 0 ? (
                            liveActivity.map((item, i) => {
                                const badge = actionBadge(item.action, t);
                                return (
                                    <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-surface transition-colors">
                                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                            <span className="text-[10px] font-bold text-white">{item.avatar}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-primary/85 truncate">{item.name}</p>
                                            <p className="text-[11px] text-muted truncate">{item.group}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${badge.cls}`}>{badge.label}</span>
                                            <span className="text-[10px] text-muted">{item.time}</span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-12 text-center flex flex-col items-center justify-center h-full">
                                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4 text-muted/30">
                                    <ClipboardList className="w-8 h-8" />
                                </div>
                                <p className="text-xs text-muted font-medium max-w-[200px]">
                                    {t.noActivityToday || 'დღეს აქტივობა არ დაფიქსირებულა'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
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
