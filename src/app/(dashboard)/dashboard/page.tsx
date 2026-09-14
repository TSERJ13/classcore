'use client';

import { useState, useEffect, useCallback } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { getTodayCheckins, type CheckinRecord } from '@/lib/checkin-store';
import { getUniqueSubscriptions, getEffectiveStatus, type SubscriptionEffectiveStatus } from '@/lib/subscription-store';
import { getSales } from '@/lib/sales-store';
import Link from 'next/link';
import { Zap, Users, CreditCard, CalendarCheck, TrendingUp, UserPlus, ChevronLeft, ChevronRight, ShoppingBag, RefreshCcw, ShieldAlert, Sparkles } from 'lucide-react';
import { cn, getLocalISODate, formatCurrency, getScopedKey } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { getTodayEvents, getEvents } from '@/lib/event-store';
import { getStudents, updateStudent } from '@/lib/student-store';
import { getTeacherName, getTeacherPhoto } from '@/lib/teacher-store';
import { getHallName } from '@/lib/hall-store';
import type { Student } from '@/types';
import { getGroups } from '@/lib/group-store';
import { getTeachers } from '@/lib/teacher-store';
import { getVisibleGroupIds, isTeacherRole } from '@/lib/access';
import { pctChange, buildPlanPrices, subRevenue, isSubInMonth, isSubOnDay } from '@/lib/studio-stats';
import { getPlans } from '@/lib/plan-store';
import StudentModal from '@/components/students/StudentModal';
import { IssueSubscriptionModal } from '@/components/subscriptions/IssueSubscriptionModal';
import { TodayGroupsCard } from '@/components/dashboard/TodayGroupsCard';
import { CalendarScheduleCard } from '@/components/dashboard/CalendarScheduleCard';

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
                        {total > 0 && slices.map(slice => {
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
                        <span className={cn(
                            "font-black text-primary leading-none tracking-tight truncate max-w-[76px] sm:max-w-[90px]",
                            isLongValue ? "text-xs sm:text-base" : "text-lg sm:text-2xl"
                        )}>
                            {displayedValue}
                        </span>
                    </div>
                </div>

                {/* Under Donut: Text & Percentage */}
                <div className="mt-2 sm:mt-3 text-center min-h-[36px] sm:min-h-[40px] flex flex-col items-center justify-center w-full px-1">
                    {activeSlice ? (
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
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const { settings, isLoaded } = useStudio();
    const { profile, user, loading } = useUser();
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
    });
    const [birthdayStudents, setBirthdayStudents] = useState<Student[]>([]);
    const [liveActivity, setLiveActivity] = useState<{ action: string; color: string; avatar: string; name: string; group: string; time: string }[]>([]);
    const [liveSchedule, setLiveSchedule] = useState<any[]>([]);
    const [allEvents, setAllEvents] = useState<any[]>([]);
    
    // Cloud Sync State
    const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
    const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

    const [showAddStudent, setShowAddStudent] = useState(false);
    const [showIssueSub, setShowIssueSub] = useState(false);

    const parseTemplate = (template: string, studentName: string, planName?: string) => {
        let msg = template.replace(/{name}/g, studentName);
        msg = msg.replace(/{studio}/g, settings.studioName);
        if (planName) msg = msg.replace(/{plan}/g, planName);
        return msg;
    };

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
        const allSubsList = (isTeacher && visibleGroupIds)
            ? allSubsListRaw.filter(sub => visibleGroupIds.includes(sub.group_id || ''))
            : allSubsListRaw;
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
        let activeSubStudentIds = new Set<string>();
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

        const checkins = getTodayCheckins();
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
        // Restrict to visible students for teachers
        const visibleStudentIdSet = new Set(studentsList.map(s => s.id));
        const attendedVisible = isTeacher
            ? Array.from(attendedStudentIds).filter(id => visibleStudentIdSet.has(id)).length
            : attendedStudentIds.size;
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

        // ── Pending Bookings ──────────────────────────────────────────────────
        let pendingBookings = 0;
        let allEvs: any[] = [];
        try {
            allEvs = getEvents();
            pendingBookings = allEvs.filter(ev => {
                if ((ev as any).booking_status !== 'pending') return false;
                if (ev.date < todayStr) return false;
                if (isTeacher && visibleGroupIds && ev.group_id && !visibleGroupIds.includes(ev.group_id)) return false;
                return true;
            }).length;
        } catch { /* ignore */ }
        setAllEvents(allEvs);

        // ── Debt Calculation (Subscriptions unpaid + Negative Student Balances) ──
        let totalDebt = 0;
        const debtStudentIds = new Set<string>();

        allSubsList.forEach((sub: any) => {
            if (sub.status === 'cancelled') return;
            const subPrice = sub.price ?? (sub.plan != null ? planPrices[String(sub.plan)] : undefined) ?? (sub.plan_id != null ? planPrices[String(sub.plan_id)] : undefined) ?? 0;
            if (subPrice > 0) {
                const amountPaid = typeof sub.amount_paid === 'number' ? sub.amount_paid : (sub.paid ? subPrice : 0);
                if (amountPaid < subPrice) {
                    const diff = subPrice - amountPaid;
                    totalDebt += diff;
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
        const studentsWithDebt = debtStudentIds.size;

        // ── Birthdays Today ───────────────────────────────────────────────────
        const todayMonthDay = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const birthdayList = studentsList.filter(s => {
            if (!s.birth_date) return false;
            const cleanBday = s.birth_date.split('T')[0];
            const parts = cleanBday.split('-');
            if (parts.length === 3) {
                return `${parts[1]}-${parts[2]}` === todayMonthDay;
            }
            return false;
        });
        setBirthdayStudents(birthdayList);

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

        // ── Subscription Status Breakdown (Real Effective Status) ──
        const subStatusCounts: Record<SubscriptionEffectiveStatus, number> & { total: number } = {
            active: 0,
            paused: 0,
            expired: 0,
            cancelled: 0,
            total: 0,
        };
        allSubsList.forEach(sub => {
            const status = getEffectiveStatus(sub);
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
            totalDebt: Math.round(totalDebt),
            studentsWithDebt,
            subStatusCounts,
            newThisMonthStudents: newStudentsThisMonth,
            monthlySubsRevenue: allSubsList.filter(sub => isSubInMonth(sub, currentMonth)).reduce((sum, sub) => sum + subRevenue(sub, planPrices), 0),
            monthlyShopRevenue: sales.filter(s => s.date?.startsWith(currentMonth)).reduce((sum, s) => sum + s.price * s.quantity, 0),
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
        window.addEventListener('cc_subscription_update', refreshFullDashboard);
        window.addEventListener('cc_attendance_update', refreshFullDashboard);
        window.addEventListener('cc_sale_update', refreshFullDashboard);
        window.addEventListener('cc_student_update', refreshFullDashboard);
        window.addEventListener('cc_data_hydrated', refreshFullDashboard);
        window.addEventListener('cc_sync_done', refreshFullDashboard);

        return () => {
            window.removeEventListener('cc_subscription_update', refreshFullDashboard);
            window.removeEventListener('cc_attendance_update', refreshFullDashboard);
            window.removeEventListener('cc_sale_update', refreshFullDashboard);
            window.removeEventListener('cc_student_update', refreshFullDashboard);
            window.removeEventListener('cc_data_hydrated', refreshFullDashboard);
            window.removeEventListener('cc_sync_done', refreshFullDashboard);
        };
    }, [refreshFullDashboard]);

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

    const dateStr = getLocalizedDate(selectedDate, t);
    const isTeacher = isTeacherRole(profile?.role);
    const canViewRevenue = !isTeacher && (profile?.role === 'owner' || profile?.role === 'admin' || profile?.role === 'manager' || !!profile?.canViewAnalytics || !!profile?.canViewBilling);

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
                } catch (err) { }
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
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap">
                    {currentClass && (
                        <div className="hidden xl:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-medium text-emerald-400">{currentClass.title}</span>
                        </div>
                    )}
                    <button
                        onClick={() => setShowAddStudent(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all active:scale-95 shadow-sm shadow-indigo-500/20 cursor-pointer"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>{l('სტუდენტის დამატება', 'Добавить студента', 'Add Student')}</span>
                    </button>
                    <Link
                        href="/attendance"
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface hover:bg-card text-primary border border-border-subtle hover:border-indigo-500/30 text-xs font-bold transition-all active:scale-95 shadow-2xs"
                    >
                        <CalendarCheck className="w-4 h-4 text-violet-500" />
                        <span>{l('დასწრება', 'Посещаемость', 'Attendance')}</span>
                    </Link>
                </div>
            </div>

            {/* ─── Compact Needs Attention Strip ─── */}
            {(liveStats.expiringSoon > 0 || liveStats.oneSessionLeft > 0 || liveStats.pendingBookings > 0 || (canViewRevenue && liveStats.totalDebt > 0)) && (
                <div className="flex items-center gap-2.5 px-3.5 py-2 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/15 rounded-xl text-xs overflow-x-auto scrollbar-none animate-fade-in">
                    <div className="flex items-center gap-1.5 text-rose-500 font-bold flex-shrink-0">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span className="text-[11px] uppercase tracking-wider font-extrabold">{l('საჭიროებს ყურადღებას:', 'Требует внимания:', 'Needs Attention:')}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        {canViewRevenue && liveStats.totalDebt > 0 && (
                            <Link href="/subscriptions" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-medium text-xs transition-colors border border-rose-500/20 flex-shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                <span><strong className="font-bold">{liveStats.studentsWithDebt}</strong> {l('სტუდენტს აქვს დავალიანება', 'студентов с долгом', 'students with debt')}</span>
                                <span className="font-bold text-rose-500">({formatCurrency(liveStats.totalDebt, settings.currency)})</span>
                            </Link>
                        )}
                        {liveStats.expiringSoon > 0 && (
                            <Link href="/subscriptions" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium text-xs transition-colors border border-amber-500/20 flex-shrink-0">
                                <span><strong className="font-bold">{liveStats.expiringSoon}</strong> {l('სტუდენტს ეწურება აბონემენტი', 'заканчивается абонемент', 'subs expiring')}</span>
                            </Link>
                        )}
                        {liveStats.oneSessionLeft > 0 && (
                            <Link href="/subscriptions" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium text-xs transition-colors border border-amber-500/20 flex-shrink-0">
                                <span><strong className="font-bold">{liveStats.oneSessionLeft}</strong> {l('დარჩა 1 გაკვეთილი', 'остался 1 урок', '1 lesson left')}</span>
                            </Link>
                        )}
                        {liveStats.pendingBookings > 0 && (
                            <Link href="/calendar" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-medium text-xs transition-colors border border-indigo-500/20 flex-shrink-0">
                                <span><strong className="font-bold">{liveStats.pendingBookings}</strong> {l('დასადასტურებელი ჯავშანი', 'бронь ожидает', 'pending bookings')}</span>
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Operations & Analytics (Donut Cards: 2x2 on mobile, 4 in 1 row on desktop) ─── */}
            <div className={cn("grid gap-2.5 sm:gap-4 mb-4 items-stretch", canViewRevenue ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
                {/* 1. Students Breakdown */}
                <DonutCard
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

                {/* 2. Monthly Revenue (if canViewRevenue) */}
                {canViewRevenue && (
                    <DonutCard
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
                )}

                {/* 3. Subscriptions Statuses */}
                <DonutCard
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

                {/* 4. Today's Attendance */}
                <DonutCard
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
            </div>

            {/* ─── Birthdays Today (Compact) ─── */}
            {birthdayStudents.length > 0 && (
                <div className="bg-gradient-to-r from-amber-500/10 via-pink-500/10 to-purple-500/10 border border-amber-500/20 rounded-xl p-2.5 sm:p-3 mb-4 animate-fade-in">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1">
                                <span>🎉</span> {l('დღეს დაბადების დღეა!', 'Сегодня день рождения!', 'Birthday Today!')}
                            </h3>
                        </div>
                        <Link href="/sms-manager" className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1">
                            <span>{l('SMS მილოცვა', 'Поздравить по SMS', 'Send Birthday SMS')}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {birthdayStudents.map(student => (
                            <div key={student.id} className="flex items-center gap-2 bg-white/60 dark:bg-slate-900/60 border border-amber-500/15 rounded-lg px-2.5 py-1.5 flex-shrink-0">
                                {student.photo_url ? (
                                    <img src={student.photo_url} alt="" className="w-6 h-6 rounded-full object-cover border border-amber-400/40" />
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                                        {(student.full_name || 'S').substring(0, 2).toUpperCase()}
                                    </div>
                                )}
                                <p className="text-xs font-bold text-primary truncate max-w-[140px]">{student.full_name}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Main 2 Windows: Today's Groups + Google Calendar Schedule ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch mb-6">
                {/* Left Window: Today's Groups (Tabs + Expected Students List) */}
                <TodayGroupsCard
                    lang={lang}
                    currentDate={selectedDate}
                    onRefreshDashboard={refreshFullDashboard}
                />

                {/* Right Window: Google Calendar Schedule (Day / Week / Month) */}
                <CalendarScheduleCard
                    lang={lang}
                    initialDate={selectedDate}
                    onSelectDate={setSelectedDate}
                />
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
