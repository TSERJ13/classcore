'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { getTodayCheckins, type CheckinRecord } from '@/lib/checkin-store';
import { getSubscription, getSubscriptions } from '@/lib/subscription-store';
import { getSales, type ShopSale } from '@/lib/sales-store';
import { getUidRegistry } from '@/lib/student-store';
import Link from 'next/link';
import { Zap, Users, CreditCard, CalendarCheck, TrendingUp, Activity, UserPlus, ClipboardList, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, StickyNote, Megaphone, X, ShoppingBag, MessageSquare, RefreshCcw, ShieldAlert } from 'lucide-react';
import { cn, getLocalISODate, formatCurrency } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { getTodayEvents } from '@/lib/event-store';
import { getStudents, getStudentPatches, updateStudent } from '@/lib/student-store';
import { getTeacherName } from '@/lib/teacher-store';
import { addNotification } from '@/lib/notification-store';
import type { Student } from '@/types';
import { StudentModal } from '@/components/students/StudentModal';
import { IssueSubscriptionModal } from '@/components/subscriptions/IssueSubscriptionModal';
import { PieChart, GaugeChart } from '@/components/ui/PieChart';
import { getScopedKey } from '@/lib/settings-store';
import { Logo } from '@/components/ui/Logo';

// ─── Helpers ──────────────────────────────────────────────────────────────
const toDateStr = (d: Date) => d.toISOString().split('T')[0];

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
                                    ? 'w-6 h-6 flex items-center justify-center bg-indigo-500 text-white rounded-full font-bold'
                                    : (isSelected || isStart || isEnd)
                                        ? 'text-indigo-400 font-bold'
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
    const { profile, user, loading } = useUser();
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
        todayRevenue: 0,
        totalDebt: 0,
        expiringSoon: 0,
        inactiveSubs: 0,
        newStudents3m: 0,
        leftStudents3m: 0,
        revenueChange: 0,
        activeChange: 0
    });
    const [liveActivity, setLiveActivity] = useState<{ action: string; color: string; avatar: string; name: string; group: string; time: string }[]>([]);
    const [liveSchedule, setLiveSchedule] = useState<any[]>([]);
    const [allEvents, setAllEvents] = useState<any[]>([]);

    const [showAddStudent, setShowAddStudent] = useState(false);
    const [showIssueSub, setShowIssueSub] = useState(false);

    const parseTemplate = (template: string, studentName: string, planName?: string) => {
        let msg = template.replace(/{name}/g, studentName);
        msg = msg.replace(/{studio}/g, settings.studioName);
        if (planName) msg = msg.replace(/{plan}/g, planName);
        return msg;
    };

    useEffect(() => {
        const refreshData = () => {
            const sales = getSales();
            const studentsList = getStudents();
            const students = studentsList.length;

            const now = new Date();
            const currentMonth = now.toISOString().split('-').slice(0, 2).join('-');

            // Fiscal Year start: Sept 1st
            const fiscalYearStart = new Date(now.getFullYear(), 8, 1);
            if (now < fiscalYearStart) fiscalYearStart.setFullYear(fiscalYearStart.getFullYear() - 1);
            const fiscalYearStr = fiscalYearStart.toISOString().split('T')[0];

            let activeCount = 0;
            let inactiveCount = 0;
            const activeSubStudentIds = new Set<string>();
            const allSubsList = Object.values(getSubscriptions()).flat();

            studentsList.forEach(s => {
                const sub = (s as any).subscription || getSubscription(s.id);
                if (sub && sub.status === 'active') {
                    activeCount++;
                    activeSubStudentIds.add(s.id);
                } else {
                    inactiveCount++;
                }
            });
            const studentsWithActiveSub = activeSubStudentIds.size;

            // Attendance Count: Count all check-ins for the day
            const checkins = getTodayCheckins();
            const attendance = checkins.length;

            const todayStr = getLocalISODate(new Date());

            // 3 month boundaries
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

            let newStudents3m = studentsList.filter(s => (s as any).created_at && (s as any).created_at >= threeMonthsAgoStr).length;
            let leftStudents3m = studentsList.filter(s => s.status === 'inactive' && (s as any).updated_at && (s as any).updated_at >= threeMonthsAgoStr).length;

            // Revenue calculation
            const todaySalesRevenue = sales.filter(s => s.date === todayStr).reduce((sum, s) => sum + s.price * s.quantity, 0);
            const todaySubRevenue = allSubsList.filter(sub => sub.purchased_at === todayStr).reduce((sum, sub) => sum + (sub.amount_paid || 0), 0);

            const monthSalesRevenue = sales.filter(s => s.date?.startsWith(currentMonth)).reduce((sum, s) => sum + s.price * s.quantity, 0);
            const monthSubRevenue = allSubsList.filter(sub => sub.purchased_at?.startsWith(currentMonth)).reduce((sum, sub) => sum + (sub.amount_paid || 0), 0);

            const newThisMonth = allSubsList.filter(sub => sub.purchased_at && sub.purchased_at.startsWith(currentMonth)).length;
            const churnThisMonth = studentsList.filter(s => s.status === 'inactive' && (s as any).updated_at && (s as any).updated_at.startsWith(currentMonth)).length;

            // Debt calculation (sum of all negative balances)
            const totalDebt = studentsList.reduce((sum, s) => sum + (s.balance && s.balance < 0 ? Math.abs(s.balance) : 0), 0);

            // Expiring soon (active subs expiring in next 7 days)
            const sevenDaysFromNow = new Date();
            sevenDaysFromNow.setDate(now.getDate() + 7);
            const sevenDaysFromNowStr = sevenDaysFromNow.toISOString().split('T')[0];
            const expiringSoon = allSubsList.filter(sub =>
                sub.status === 'active' &&
                sub.expires_at >= todayStr &&
                sub.expires_at <= sevenDaysFromNowStr
            ).length;

            // ─── MoM Growth Calculations ───
            const lastMonthDate = new Date();
            lastMonthDate.setMonth(now.getMonth() - 1);
            const lastMonthStr = lastMonthDate.toISOString().split('-').slice(0, 2).join('-');
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);
            const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

            // 1. Revenue Comparison
            const lastMonthSalesRevenue = sales.filter(s => s.date?.startsWith(lastMonthStr)).reduce((sum, s) => sum + s.price * s.quantity, 0);
            const lastMonthSubRevenue = allSubsList.filter(sub => sub.purchased_at?.startsWith(lastMonthStr)).reduce((sum, sub) => sum + (sub.amount_paid || 0), 0);
            const lastMonthRevenue = lastMonthSalesRevenue + lastMonthSubRevenue;
            const currentMonthRevenue = monthSalesRevenue + monthSubRevenue;
            let revenueChange = 0;
            if (lastMonthRevenue > 0) {
                revenueChange = Math.round(((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100);
            } else if (currentMonthRevenue > 0) {
                revenueChange = 100;
            }

            // 2. Active Student Comparison (approximate active vs 30 days ago)
            const activeThirtyDaysAgo = studentsList.filter(s => {
                const subs = (allSubsList as any[]).filter(sub => sub.student_id === s.id);
                return subs.some(sub => sub.purchased_at <= thirtyDaysAgoStr && sub.expires_at >= thirtyDaysAgoStr);
            }).length;
            let activeChange = 0;
            if (activeThirtyDaysAgo > 0) {
                activeChange = Math.round(((studentsWithActiveSub - activeThirtyDaysAgo) / activeThirtyDaysAgo) * 100);
            } else if (studentsWithActiveSub > 0) {
                activeChange = 100;
            }

            // Attendance Rate based on total students if no active subs (monthly average)
            let totalCheckinsMonth = 0;
            let daysWithCheckinsMonth = 0;
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

            for (let d = 1; d <= daysInMonth; d++) {
                try {
                    const dDate = new Date(now.getFullYear(), now.getMonth(), d);
                    const dStr = dDate.toISOString().split('T')[0];
                    const key = getScopedKey(`cc_checkins_${dStr}`);
                    const rawRecords = localStorage.getItem(key);
                    if (rawRecords) {
                        const recs = JSON.parse(rawRecords);
                        if (Array.isArray(recs) && recs.length > 0) {
                            totalCheckinsMonth += recs.length;
                            daysWithCheckinsMonth++;
                        }
                    }
                } catch (e) {
                    console.warn(`⚠️ [Dashboard] Failed to process check-ins for day ${d}:`, e);
                }
            }
            const avgDailyCheckins = daysWithCheckinsMonth > 0 ? totalCheckinsMonth / daysWithCheckinsMonth : 0;
            const denominator = activeCount > 0 ? activeCount : (students > 0 ? students : 1);
            const attendanceRateMonth = Math.min(100, Math.round((avgDailyCheckins / denominator) * 100));

            setLiveStats({
                totalStudents: students,
                activeStudents: studentsWithActiveSub,
                activeSubs: studentsWithActiveSub,
                inactiveSubs: inactiveCount,
                newStudents3m,
                leftStudents3m,
                newThisMonth,
                churnThisMonth,
                attendance,
                attendanceRateMonth,
                monthlyRevenue: monthSalesRevenue + monthSubRevenue,
                todayRevenue: todaySalesRevenue + todaySubRevenue,
                totalDebt,
                expiringSoon,
                revenueChange,
                activeChange
            });
        };

        refreshData();

        window.addEventListener('cc_subscription_update', refreshData);
        window.addEventListener('cc_attendance_update', refreshData);
        window.addEventListener('cc_sale_update', refreshData);
        window.addEventListener('cc_student_update', refreshData);
        window.addEventListener('cc_active_branch_change', refreshData);

        return () => {
            window.removeEventListener('cc_subscription_update', refreshData);
            window.removeEventListener('cc_attendance_update', refreshData);
            window.removeEventListener('cc_sale_update', refreshData);
            window.removeEventListener('cc_student_update', refreshData);
            window.removeEventListener('cc_active_branch_change', refreshData);
        };
    }, [t, settings.studioName, revenueRange]);

    useEffect(() => {
        const checkins = getTodayCheckins();
        const sales = getSales();

        const allStudents = getStudents();
        const activeIds = new Set(allStudents.map(s => s.id));
        const activityList: any[] = [];

        checkins.forEach((c: CheckinRecord) => {
            if (!activeIds.has(c.studentId)) return;
            const name = c.studentName || t.studentLabelGeneric;
            let timestamp = 0;
            try {
                if (c.date && c.time) {
                    const dt = new Date(`${c.date.trim()}T${c.time.trim()}`);
                    if (!isNaN(dt.getTime())) timestamp = dt.getTime();
                }
            } catch (e) { }

            activityList.push({
                name: name,
                action: 'check-in',
                group: t.groupSession,
                time: c.time,
                timestamp,
                avatar: name.split(' ').map((n: string) => n ? n[0] : '').join('').toUpperCase(),
                color: 'from-indigo-500 to-blue-600'
            });
        });

        sales.forEach((s: ShopSale) => {
            if (s.studentId && !activeIds.has(s.studentId)) return;
            const name = s.studentName || t.clientLabelGeneric;
            const initials = name.trim().split(' ').map((n: string) => n[0] || '').join('').toUpperCase();
            let timestamp = 0;
            try {
                if (s.date && s.time) {
                    const dt = new Date(`${s.date.trim()}T${s.time.trim()}`);
                    if (!isNaN(dt.getTime())) timestamp = dt.getTime();
                }
            } catch (e) { }

            activityList.push({
                name: name,
                action: 'sale',
                group: s.productName || t.saleActivity,
                time: s.time || '',
                timestamp,
                avatar: initials || 'K',
                color: 'from-violet-500 to-fuchsia-600'
            });
        });

        const sorted = activityList.sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
        setLiveActivity(sorted);

        // Load All Events for MiniCalendar dots
        import('@/lib/event-store').then(mod => {
            setAllEvents(mod.getEvents());

            // Load live schedule for selected date
            const dateStr = getLocalISODate(selectedDate);
            const evByDate = mod.getEventsByDate(dateStr);
            
            // STRICT FILTER: Only show events if they are individual OR belong to an existing group
            import('@/lib/group-store').then(groupMod => {
                const existingGroups = groupMod.getGroups();
                const validGroupIds = new Set(existingGroups.map(g => g.id));
                
                const events = evByDate.filter(ev => {
                    if (ev.type === 'group_class' && ev.group_id) {
                        return validGroupIds.has(ev.group_id);
                    }
                    return true;
                });

                const allStudents = getStudents();
                const scheduleWithDetails = events.map(ev => {
                    const classStudents = allStudents.filter(s => {
                        const sClasses = (s as any).classes || s.enrolled_group_ids || [];
                        return Array.isArray(sClasses) && sClasses.includes(ev.id);
                    });
                    const count = classStudents.length;

                    return {
                        ...ev,
                        teacherName: getTeacherName(ev.teacher_id),
                        studentCount: count
                    };
                });
                setLiveSchedule(scheduleWithDetails);
            });
        });

        // Birthday Check (Only run on real today)
        const studentsList = getStudents();
        const realTodayStr = new Date().toISOString().slice(5, 10); // MM-DD
        studentsList.forEach((s: Student) => {
            if (s.birth_date && s.birth_date.slice(5, 10) === realTodayStr) {
                // UI Notification
                addNotification({
                    title: t.birthdayNotification,
                    message: t.congratulateThem.replace('{name}', s.full_name),
                    type: 'info',
                    time: t.now
                });

                const bdayKey = `sms_bday_${s.id}_${new Date().getFullYear()}`;
                const currentHour = new Date().getHours();
                const isQuietHours = currentHour >= 23 || currentHour < 10;
                const autoSmsEnabled = settings.notifications.autoSms !== false;

                if (s.phone && !localStorage.getItem(bdayKey)) {
                    if (!autoSmsEnabled || isQuietHours) return;

                    let phone = (s.phone || '').replace(/[^0-9]/g, '');
                    if (phone.length === 9) phone = '995' + phone;
                    if (!phone) return;

                    const templates = (settings?.sms_templates || {}) as any;
                    const prefLang = s.preferred_language || 'ka';

                    let bTpl = prefLang === 'ka' ? 'გილოცავთ დაბადების დღეს!' : prefLang === 'ru' ? 'С днем рождения!' : 'Happy Birthday!';
                    if (templates[prefLang]?.birthday) {
                        bTpl = templates[prefLang].birthday;
                    } else if (templates.ka?.birthday) {
                        bTpl = templates.ka.birthday;
                    }

                    const bdayMsg = parseTemplate(bTpl, s.full_name || t.studentLabelGeneric);
                    fetch('/api/sms/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ to: phone, text: bdayMsg, studentName: s.full_name })
                    }).then(res => res.json()).then(data => {
                        if (data.success) localStorage.setItem(bdayKey, 'true');
                    });
                }
            }
        });

        // ─── Multi-Stage Auto-send Expiration SMS & Inactivation ───
        const todayObj = new Date();
        const todayDateStr = todayObj.toISOString().split('T')[0];
        const allSubsList = Object.values(getSubscriptions()).flat();

        const subsByStudent = allSubsList.reduce((acc: Record<string, any[]>, sub) => {
            if (!acc[sub.student_id]) acc[sub.student_id] = [];
            acc[sub.student_id].push(sub);
            return acc;
        }, {});

        Object.entries(subsByStudent).forEach(([studentId, subs]) => {
            const student = studentsList.find(s => s.id === studentId);
            if (!student || !student.phone || student.status !== 'active') return;

            const hasActiveValidSub = subs.some(sub => {
                const isActive = sub.status === 'active';
                const hasVisits = !sub.sessions_total || (sub.sessions_total - (sub.sessions_used || 0) > 0);
                const isNotExpiredByDate = sub.expires_at >= todayDateStr;
                return isActive && hasVisits && isNotExpiredByDate;
            });

            if (hasActiveValidSub) return;

            const expiredSubs = subs.filter(sub => {
                const isExpiredByDate = sub.expires_at <= todayDateStr;
                const isOutOfVisits = sub.sessions_total && sub.sessions_total > 0 && (sub.sessions_total - (sub.sessions_used || 0)) <= 0;
                return isExpiredByDate || isOutOfVisits || sub.status === 'expired';
            });

            if (expiredSubs.length === 0) return;

            expiredSubs.sort((a, b) => new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime());
            const latestExpired = expiredSubs[0];

            let diffDays = 0;
            if (latestExpired.expires_at === todayDateStr) {
                diffDays = 0;
            } else {
                const expDate = new Date(latestExpired.expires_at);
                const diffTime = Math.abs(todayObj.setHours(0, 0, 0, 0) - expDate.setHours(0, 0, 0, 0));
                diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            if (latestExpired.sessions_total && latestExpired.sessions_total > 0 && (latestExpired.sessions_total - (latestExpired.sessions_used || 0)) <= 0) {
                diffDays = 0;
            }

            if (diffDays !== 0 && diffDays !== 10) return;

            const triggerReason = `day_${diffDays}`;
            const smsKey = `sms_sent_${latestExpired.id}_${triggerReason}`;

            if (diffDays === 10) {
                if (!localStorage.getItem(smsKey)) {
                    localStorage.setItem(smsKey, 'true');
                    updateStudent(studentId, { status: 'inactive' });
                    addNotification({
                        title: t.statusChanged,
                        message: t.movedToInactive.replace('{name}', student.full_name),
                        type: 'info',
                        time: t.now
                    });
                }
                return;
            }

            if (!localStorage.getItem(smsKey)) {
                const currentHour = new Date().getHours();
                const isQuietHours = currentHour >= 23 || currentHour < 10;
                const autoSmsEnabled = settings.notifications.autoSms !== false;
                if (!autoSmsEnabled || isQuietHours) return;

                localStorage.setItem(smsKey, 'pending');

                let phone = (student.phone || '').replace(/[^0-9]/g, '');
                if (phone.length === 9) phone = '995' + phone;
                if (!phone) return;

                const prefLang = student.preferred_language || 'ka';
                const templates = (settings?.sms_templates || {}) as any;
                const isOutOfVisits = latestExpired.sessions_total && latestExpired.sessions_total > 0 && (latestExpired.sessions_total - (latestExpired.sessions_used || 0)) <= 0;

                let tpl = prefLang === 'ka' ? 'თქვენი აბონემენტი ამოიწურა.' : prefLang === 'ru' ? 'Ваш абонемент истек.' : 'Your subscription has expired.';
                
                if (isOutOfVisits) {
                    if (templates[prefLang]?.visitations_out) {
                        tpl = templates[prefLang].visitations_out;
                    } else if (templates.ka?.visitations_out) {
                        tpl = templates.ka.visitations_out;
                    } else if (templates[prefLang]?.expiration_day_0) {
                        tpl = templates[prefLang].expiration_day_0;
                    }
                } else if (templates[prefLang]?.expiration_day_0) {
                    tpl = templates[prefLang].expiration_day_0;
                } else if (templates.ka?.expiration_day_0) {
                    tpl = templates.ka.expiration_day_0;
                }

                const messageText = parseTemplate(tpl, student.full_name || t.studentLabelGeneric, latestExpired.plan_name);
                fetch('/api/sms/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ to: phone, text: messageText, studentName: student.full_name })
                }).then(res => res.json()).then(data => {
                    if (data.success || data[0]?.success) {
                        localStorage.setItem(smsKey, 'true');
                        addNotification({
                            title: t.smsSentTitle,
                            message: t.sentReminder.replace('{name}', student.full_name).replace('{days}', String(diffDays)),
                            type: 'success',
                            time: t.now
                        });
                    }
                });
            }
        });
    }, [selectedDate, settings, t]);

    // No longer using isDemo hardcoded overrides
    const isDemo = false;

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

    const stats = [
        { label: t.totalStudents, value: String(liveStats.totalStudents), change: (liveStats.activeChange >= 0 ? `+${liveStats.activeChange}%` : `${liveStats.activeChange}%`), sub: null, icon: Users, color: 'indigo' },
        { label: t.activeSubscriptions, value: String(liveStats.activeSubs), change: (liveStats.newThisMonth >= 0 ? `+${liveStats.newThisMonth}` : String(liveStats.newThisMonth)), sub: null, icon: CreditCard, color: 'emerald' },
        { label: t.todayRevenue, value: formatCurrency(liveStats.todayRevenue, settings.currency), change: (liveStats.revenueChange >= 0 ? `+${liveStats.revenueChange}%` : `${liveStats.revenueChange}%`), sub: getSubtext('today'), icon: TrendingUp, color: 'amber' },
        { label: (revenueRange.start && revenueRange.end) ? (t.selectedPeriod || 'Selected Period') : t.monthlyRevenue, value: formatCurrency(liveStats.monthlyRevenue, settings.currency), change: (liveStats.revenueChange >= 0 ? `+${liveStats.revenueChange}%` : `${liveStats.revenueChange}%`), sub: getSubtext('monthly'), icon: Activity, color: 'violet' },
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

    if (!isLoaded || (loading && !isDemo)) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 animate-pulse">
                <Logo size={80} animated loading />
                <div className="text-center space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{t.loading || 'Loading Dashboard...'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in relative">
            <div className="hidden md:flex items-center justify-between px-1">
                <h1 className="text-2xl md:text-3xl font-black text-primary tracking-tight">{t.dashboard}</h1>
            </div>


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
            {billing?.plan === 'trial' && billing?.status === 'trial' && (billing?.daysLeftInTrial ?? 0) <= 3 && (
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
                    <Link href="/billing" className="w-full sm:w-auto text-center px-4 py-2 sm:px-6 sm:py-2.5 bg-amber-500 hover:bg-amber-600 text-[9px] sm:text-[11px] font-black text-white rounded-lg sm:rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 tracking-widest uppercase">
                        {t.billing}
                    </Link>
                </div>
            )}

            {/* ─── Top bar ─── */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center flex-wrap gap-2.5 sm:gap-4">
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight">
                                {t.welcomeBack} {profile?.first_name || ''} 
                            </h1>
                            <span className="text-xl sm:text-2xl">👋</span>
                        </div>
                        {billing && (
                            <span className={cn(
                                "px-2.5 py-0.5 rounded-lg text-white text-[9px] sm:text-[11px] font-black tracking-tighter shadow-lg shrink-0",
                                (billing?.plan === 'pro' || billing?.plan === 'enterprise') ? "bg-emerald-500 shadow-emerald-500/20" :
                                billing?.plan === 'starter' ? "bg-blue-500 shadow-blue-500/20" :
                                billing?.plan === 'growth' ? "bg-violet-500 shadow-violet-500/20" :
                                "bg-amber-500 shadow-amber-500/20"
                            )}>
                                {String(billing?.plan === 'pro' || billing?.plan === 'enterprise' ? 'PRO' : (billing?.plan || 'TRIAL')).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted font-black mt-1 tracking-[0.15em] opacity-40">
                        {profile?.studio_name || 'ClassCore Studio'} · <span suppressHydrationWarning className="text-indigo-500">{dateStr}</span>
                    </p>
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

            {/* ─── Statistics ─── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 items-stretch overflow-x-auto pb-2 scrollbar-none no-scrollbar">
                {/* 1. Student Dynamics (Active vs New/Churn) */}
                <div className="bg-card border border-border-subtle rounded-[1.5rem] p-4 flex flex-col items-center shadow-lg hover:shadow-xl transition-all h-full min-h-[220px] min-w-[160px] flex-shrink-0 lg:flex-shrink">
                    <div className="h-8 mb-3 flex items-start justify-center w-full">
                        <p className="text-[9px] sm:text-[10px] font-black text-muted tracking-[0.2em] text-center leading-tight line-clamp-2">{t.studentDynamicsMonth}</p>
                    </div>
                    <div className="flex-none h-[90px] w-full flex items-center justify-center">
                        <PieChart
                            size={90}
                            thickness={10}
                            data={[
                                { label: t.activeLabel, value: liveStats.activeStudents, color: '#6366f1' },
                                { label: t.newLabel, value: liveStats.newThisMonth, color: '#10b981' },
                                { label: t.churnLabel, value: liveStats.churnThisMonth, color: '#ef4444' }
                            ]}
                            centerLabel={
                                <div className="space-y-0.5 text-center">
                                    <span className="text-xl font-black text-[#1e293b] dark:text-white block leading-none">{liveStats.activeStudents}</span>
                                    <span className="text-[8px] text-muted font-bold block tracking-tighter opacity-40">{t.activeLabel}</span>
                                </div>
                            }
                        />
                    </div>
                    <div className="mt-auto pt-4 flex flex-wrap justify-center gap-2">
                        <div className={cn(
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-full shadow-sm animate-in fade-in zoom-in-50 duration-500",
                            liveStats.activeChange >= 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-rose-500/10 border border-rose-500/20"
                        )}>
                            {liveStats.activeChange >= 0 ? (
                                <ArrowUpRight className="w-2.5 h-2.5 text-emerald-500" strokeWidth={3} />
                            ) : (
                                <ArrowDownRight className="w-2.5 h-2.5 text-rose-500" strokeWidth={3} />
                            )}
                            <p className={cn("text-[8px] font-black", liveStats.activeChange >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                {Math.abs(liveStats.activeChange)}%
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <p className="text-[8px] font-bold text-primary opacity-60">{t.activeLabel}</p>
                        </div>
                    </div>
                </div>

                {/* 2. Financial Overview (Revenue vs Debt) */}
                <div className="bg-card border border-border-subtle rounded-[1.5rem] p-4 flex flex-col items-center shadow-lg hover:shadow-xl transition-all h-full min-h-[220px]">
                    <div className="h-8 mb-3 flex items-start justify-center w-full">
                        <p className="text-[9px] sm:text-[10px] font-black text-muted tracking-[0.2em] text-center leading-tight line-clamp-2">{t.financialOverview}</p>
                    </div>
                    <div className="flex-none h-[90px] w-full flex items-center justify-center">
                        <PieChart
                            size={90}
                            thickness={10}
                            data={[
                                { label: t.revenue, value: liveStats.monthlyRevenue, color: '#10b981' },
                                { label: t.debtLabel, value: liveStats.totalDebt, color: '#ef4444' }
                            ]}
                            centerLabel={
                                <div className="space-y-0.5 text-center">
                                    <span className="text-lg font-black text-[#1e293b] dark:text-white block leading-none">{formatCurrency(liveStats.monthlyRevenue, settings.currency).split('.')[0]}</span>
                                    <span className="text-[8px] text-muted font-bold block tracking-tighter opacity-40">{t.income}</span>
                                </div>
                            }
                        />
                    </div>
                    <div className="mt-auto pt-4 flex flex-wrap justify-center gap-3">
                        <div className={cn(
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-full shadow-sm animate-in fade-in zoom-in-50 duration-500",
                            liveStats.revenueChange >= 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-rose-500/10 border border-rose-500/20"
                        )}>
                            {liveStats.revenueChange >= 0 ? (
                                <ArrowUpRight className="w-2.5 h-2.5 text-emerald-500" strokeWidth={3} />
                            ) : (
                                <ArrowDownRight className="w-2.5 h-2.5 text-rose-500" strokeWidth={3} />
                            )}
                            <p className={cn("text-[8px] font-black", liveStats.revenueChange >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                {Math.abs(liveStats.revenueChange)}%
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <p className="text-[8px] font-bold text-emerald-500">{t.income}</p>
                        </div>
                    </div>
                </div>

                {/* 3. Subscription Status (Active vs Expiring) */}
                <div className="bg-card border border-border-subtle rounded-[1.5rem] p-4 flex flex-col items-center shadow-lg hover:shadow-xl transition-all h-full min-h-[220px]">
                    <div className="h-8 mb-3 flex items-start justify-center w-full">
                        <p className="text-[9px] sm:text-[10px] font-black text-muted tracking-[0.2em] text-center leading-tight line-clamp-2">{t.subscriptionStats}</p>
                    </div>
                    <div className="flex-none h-[90px] w-full flex items-center justify-center">
                        <PieChart
                            size={90}
                            thickness={10}
                            data={[
                                { label: t.stable, value: Math.max(0, liveStats.activeSubs - liveStats.expiringSoon), color: '#10b981' },
                                { label: t.expiring, value: liveStats.expiringSoon, color: '#f59e0b' }
                            ]}
                            centerLabel={
                                <div className="space-y-0.5 text-center">
                                    <span className="text-xl font-black text-primary block leading-none">{liveStats.activeSubs}</span>
                                    <span className="text-[8px] text-muted font-bold block tracking-tighter opacity-40">{t.statsTotal}</span>
                                </div>
                            }
                        />
                    </div>
                    <div className="mt-auto pt-4 flex flex-wrap justify-center gap-3">
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <p className="text-[8px] font-bold text-emerald-500">{t.activeLabel}: {liveStats.activeSubs}</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <p className="text-[8px] font-bold text-amber-500">{t.expiring}: {liveStats.expiringSoon}</p>
                        </div>
                    </div>
                </div>

                {/* 4. Attendance Rate */}
                <div className="bg-card border border-border-subtle rounded-[1.5rem] p-4 flex flex-col items-center shadow-lg hover:shadow-xl transition-all h-full min-h-[220px]">
                    <div className="h-8 mb-3 flex items-start justify-center w-full">
                        <p className="text-[9px] sm:text-[10px] font-black text-muted tracking-[0.2em] text-center leading-tight line-clamp-2">{t.attendanceRate}</p>
                    </div>
                    <div className="flex-none h-[90px] w-full flex items-center justify-center">
                        <GaugeChart
                            size={90}
                            thickness={10}
                            value={liveStats.attendanceRateMonth}
                            total={100}
                            color="#8b5cf6"
                            centerLabel={
                                <div className="space-y-0.5 text-center">
                                    <span className="text-xl font-black text-primary block leading-none">{liveStats.attendanceRateMonth}%</span>
                                    <span className="text-[8px] text-muted font-bold block tracking-tighter opacity-40">{t.average}</span>
                                </div>
                            }
                        />
                    </div>
                    <div className="mt-auto pt-2 text-center w-full">
                        <p className="text-[8px] font-bold text-muted/60 tracking-widest">{t.thisMonthAverage}</p>
                    </div>
                </div>
            </div>

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
                    <div className="bg-card border border-border-subtle rounded-2xl p-4">
                        <p className="text-[10px] font-bold text-muted tracking-widest mb-3">{t.quickActions}</p>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                {
                                    label: t.addStudentShort || 'კლიენტის ჩაწერა',
                                    icon: UserPlus,
                                    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
                                    onClick: () => setShowAddStudent(true)
                                },
                                {
                                    label: t.attendance || 'დასწრება',
                                    icon: CalendarCheck,
                                    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
                                    href: '/attendance'
                                },
                                {
                                    label: t.issuePlan || 'აბონემენტი',
                                    icon: CreditCard,
                                    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                                    onClick: () => setShowIssueSub(true)
                                },
                                {
                                    label: t.shop || 'მაღაზია',
                                    icon: ShoppingBag,
                                    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                                    href: '/shop'
                                },
                            ].map((a, idx) => {
                                const Icon = a.icon;
                                const content = (
                                    <div className="flex flex-col items-center justify-start p-3 gap-2 w-full h-full text-center">
                                        <div className={`w-10 h-10 rounded-[1rem] border flex items-center justify-center flex-shrink-0 ${a.color} shadow-sm group-hover:scale-110 transition-transform`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex flex-1 items-start justify-center mt-1">
                                            <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-primary/70 group-hover:text-primary transition-colors leading-tight">{a.label}</span>
                                        </div>
                                    </div>
                                );

                                return a.href ? (
                                    <Link key={idx} href={a.href}
                                        className="flex flex-col h-full rounded-2xl bg-surface hover:bg-surface/80 border border-border-subtle hover:border-border-subtle/20 transition-all group overflow-hidden">
                                        {content}
                                    </Link>
                                ) : (
                                    <button key={idx} onClick={a.onClick}
                                        className="flex flex-col h-full rounded-2xl bg-surface hover:bg-surface/80 border border-border-subtle hover:border-border-subtle/20 transition-all group overflow-hidden">
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
                                        </div>
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
                            <div className="p-10 text-center">
                                <p className="text-xs text-muted/40 font-medium">
                                    {t.noActivityToday || 'აქტივობები არ არის'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Attendance progress bar ─── */}
            <div className="bg-card border border-border-subtle rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-sm font-semibold text-primary">{t.todayAttendance}</p>
                        <p className="text-[11px] text-muted mt-0.5">
                            {t.ofStudents
                                .replace('{count}', String(liveStats.attendance))
                                .replace('{total}', String(liveStats.activeStudents || liveStats.totalStudents))
                            }
                        </p>
                    </div>
                    <span className="text-2xl font-black text-primary">
                        {((liveStats.activeStudents || liveStats.totalStudents) > 0 ? Math.round((liveStats.attendance / (liveStats.activeStudents || liveStats.totalStudents)) * 100) + '%' : '0%')}
                    </span>
                </div>
                <div className="w-full bg-surface rounded-full h-3 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 rounded-full relative overflow-hidden transition-all duration-1000"
                        style={{ width: ((liveStats.activeStudents || liveStats.totalStudents) > 0 ? (liveStats.attendance / (liveStats.activeStudents || liveStats.totalStudents) * 100) + '%' : '0%') }}>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                    </div>
                </div>
                <div className="flex items-center justify-between mt-3 px-1">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                            <span className="text-[10px] font-bold text-primary">{t.present}: <span className="text-indigo-400">{liveStats.attendance}</span></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-surface-hover border border-border-subtle" />
                            <span className="text-[10px] font-bold text-muted">{t.absent}: <span className="text-primary/60">{Math.max(0, liveStats.activeStudents - liveStats.attendance)}</span></span>
                        </div>
                    </div>
                    <div className="text-[10px] font-bold text-muted tracking-tight">
                        {t.activeSubscriptions}: {liveStats.activeStudents}
                    </div>
                </div>
                {/* Subscription breakdown */}
                <div className="mt-3 pt-3 border-t border-border-subtle/50 flex items-center gap-6">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-bold text-muted">{t.activeSubscriptions}: <span className="text-emerald-500">{liveStats.activeSubs}</span></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-rose-400/60" />
                        <span className="text-[10px] font-bold text-muted">{t.inactive || 'Inactive'}: <span className="text-rose-400/80">{Math.max(0, liveStats.totalStudents - liveStats.activeSubs)}</span></span>
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
            {billing?.status === 'trial' && (
                <div className="bg-gradient-to-r from-indigo-500 to-violet-600 rounded-3xl sm:rounded-[2rem] p-4 sm:p-6 md:p-8 text-white shadow-2xl shadow-indigo-500/20 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4 sm:gap-6 mt-6 sm:mt-12 mb-32 sm:mb-8 relative z-10 border border-white/10 w-full">
                    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5 text-center sm:text-left">
                        <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 shadow-inner">
                            <Zap className="w-5 h-5 sm:w-7 sm:h-7 text-white animate-pulse" />
                        </div>
                        <div className="space-y-0.5 sm:space-y-1">
                            <h2 className="text-[15px] sm:text-xl md:text-2xl font-black tracking-tight">{t.trialActive}</h2>
                            <p className="text-[11px] sm:text-xs md:text-sm font-bold text-white/90">
                                {t.trialEndingDesc.replace('{days}', billing.daysLeftInTrial.toString())}
                            </p>
                        </div>
                    </div>
                    <Link href="/billing" className="w-full sm:w-auto px-5 py-3.5 sm:px-8 sm:py-4 bg-white text-indigo-600 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-opacity-90 active:scale-95 transition-all shadow-xl text-center flex-shrink-0">
                        {t.buyPlan || 'Buy Package'}
                    </Link>
                </div>
            )}
        </div>
    );
}
