'use client';

import { useState, useEffect, useCallback } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { getTodayCheckins, type CheckinRecord } from '@/lib/checkin-store';
import { getSubscription, getSubscriptions } from '@/lib/subscription-store';
import { getSales, type ShopSale } from '@/lib/sales-store';
import { getUidRegistry } from '@/lib/student-store';
import Link from 'next/link';
import { Zap, Users, CreditCard, CalendarCheck, TrendingUp, Activity, UserPlus, ClipboardList, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, StickyNote, Megaphone, X, ShoppingBag, MessageSquare, RefreshCcw, ShieldAlert, Plus } from 'lucide-react';
import { cn, getLocalISODate, formatCurrency } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { getTodayEvents } from '@/lib/event-store';
import { getStudents, getStudentPatches, updateStudent } from '@/lib/student-store';
import { getTeacherName, getTeacherPhoto } from '@/lib/teacher-store';
import { getHallName } from '@/lib/hall-store';
import { addNotification } from '@/lib/notification-store';
import type { Student } from '@/types';
import { getGroups } from '@/lib/group-store';
import StudentModal from '@/components/students/StudentModal';
import { IssueSubscriptionModal } from '@/components/subscriptions/IssueSubscriptionModal';
import { PieChart, GaugeChart } from '@/components/ui/PieChart';
import { getScopedKey } from '@/lib/settings-store';
import { AppLogo } from '@/components/ui/Logo';

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
        const allSubsListRaw = Object.values(getSubscriptions()).flat();
        
        const isTeacher = profile?.role === 'teacher' || profile?.role === 'coach';
        const assignedIds = profile?.assigned_group_ids || [];
        
        if (isTeacher) {
            studentsList = studentsList.filter(s => 
                s.enrolled_group_ids?.some(gid => assignedIds.includes(gid))
            );
        }
        const allSubsList = isTeacher ? allSubsListRaw.filter(sub => assignedIds.includes(sub.group_id || '')) : allSubsListRaw;
        const students = studentsList.length;
        const now = new Date();
        const currentMonth = now.toISOString().split('-').slice(0, 2).join('-');
        let activeSubStudentIds = new Set<string>();

        studentsList.forEach(s => {
            const sub = (s as any).subscription || getSubscription(s.id);
            if (sub && sub.status === 'active') activeSubStudentIds.add(s.id);
        });
        const studentsWithActiveSub = activeSubStudentIds.size;
        const checkins = getTodayCheckins();
        const attendance = checkins.length;
        const todayStr = getLocalISODate(new Date());

        const monthSalesRevenue = sales.filter(s => s.date?.startsWith(currentMonth)).reduce((sum, s) => sum + s.price * s.quantity, 0);
        const monthSubRevenue = allSubsList.filter(sub => sub.purchased_at?.startsWith(currentMonth)).reduce((sum, sub) => sum + (sub.amount_paid || 0), 0);

        setLiveStats(prev => ({
            ...prev,
            totalStudents: students,
            activeStudents: studentsWithActiveSub,
            activeSubs: studentsWithActiveSub,
            attendance,
            monthlyRevenue: monthSalesRevenue + monthSubRevenue,
            todayRevenue: sales.filter(s => s.date === todayStr).reduce((sum, s) => sum + s.price * s.quantity, 0) + allSubsList.filter(sub => sub.purchased_at === todayStr).reduce((sum, sub) => sum + (sub.amount_paid || 0), 0),
        }));

        // 2. Refresh Schedule & Activity
        import('@/lib/event-store').then(mod => {
            const dateStr = getLocalISODate(selectedDate);
            const events = mod.getEventsByDate(dateStr).filter(ev => {
                if (isTeacher && ev.group_id && !assignedIds.includes(ev.group_id)) return false;
                return true;
            });

            const allStudents = getStudents();
            const groups = getGroups();

            // 🌟 If no events for this date, fall back to group schedule_slots
            // Day of week: Mon=0..Sun=6 (project convention)
            const dayOfWeek = (selectedDate.getDay() + 6) % 7;
            
            let scheduleSource = events;
            if (events.length === 0) {
                // Build virtual events from group schedule_slots
                const virtualEvents = groups
                    .filter((g: any) => Array.isArray(g.schedule_slots) && g.schedule_slots.some((s: any) => s.dayOfWeek === dayOfWeek))
                    .filter((g: any) => !isTeacher || assignedIds.includes(g.id))
                    .map((g: any) => {
                        const slot = g.schedule_slots.find((s: any) => s.dayOfWeek === dayOfWeek);
                        return {
                            id: `virtual-${g.id}`,
                            group_id: g.id,
                            title: g.name,
                            type: 'group',
                            color: g.color || '#6d28d9',
                            start_time: slot?.startTime || '00:00',
                            end_time: slot?.endTime || '23:59',
                            teacher_id: g.teacher_id || g.teacherId || '',
                            hall_id: g.hall_id || ''
                        };
                    });
                scheduleSource = virtualEvents as any;
            }

            const scheduleWithDetails = scheduleSource.map((ev: any) => {
                const g = groups.find(x => x.id === ev.group_id);
                const tid = ev.teacher_id || g?.teacherId;
                return {
                    ...ev,
                    teacherName: getTeacherName(tid),
                    teacherPhoto: getTeacherPhoto(tid),
                    hallName: getHallName(ev.hall_id),
                    studentCount: allStudents.filter(s => (s.enrolled_group_ids || []).includes(ev.group_id || '')).length
                };
            }).sort((a: any, b: any) => (a.start_time || '').localeCompare(b.start_time || ''));
            setLiveSchedule(scheduleWithDetails);
        });

        // 3. Activity Refresh
        const activityList: any[] = [];
        checkins.forEach((c: CheckinRecord) => {
            const name = c.studentName || t.studentLabelGeneric;
            activityList.push({ name, action: 'check-in', group: t.groupSession, time: c.time, avatar: name[0], color: 'from-indigo-500 to-blue-600' });
        });

        // 🗑️ Add recent deletions from trash to activity
        try {
            const { getTrash } = require('@/lib/trash-store');
            const trashItems = (getTrash() || []) as any[];
            // Only show deletions from today/recent (last 24h) to keep activity feed fresh
            const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
            const recentTrash = trashItems
                .filter((it: any) => {
                    const ts = new Date(it.deleted_at || it.deletedAt || 0).getTime();
                    return ts > oneDayAgo;
                })
                .sort((a: any, b: any) => {
                    const aT = new Date(a.deleted_at || a.deletedAt || 0).getTime();
                    const bT = new Date(b.deleted_at || b.deletedAt || 0).getTime();
                    return bT - aT;
                });
            
            recentTrash.forEach((item: any) => {
                const name = item.name || item.label || item.title || 'წაშლილი ჩანაწერი';
                const time = new Date(item.deleted_at || item.deletedAt || Date.now()).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' });
                activityList.push({
                    name,
                    action: 'deleted',
                    group: item.entity_type === 'subscription' ? 'აბონემენტი' : item.entity_type === 'student' ? 'სტუდენტი' : (item.entity_type || 'ჩანაწერი'),
                    time,
                    avatar: name[0] || '✕',
                    color: 'from-red-500 to-rose-600'
                });
            });
        } catch (e) {
            // Silent fail — trash is optional
        }

        // Sort by time descending
        activityList.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
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
            {settings.plan !== 'pro' && settings.plan !== 'custom' && billing?.status === 'trial' && (billing?.daysLeftInTrial ?? 0) <= 3 && (
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
                <div className="bg-card border border-border-subtle rounded-[1.5rem] p-4 flex flex-col items-center transition-all h-full min-h-[220px] min-w-[160px] flex-shrink-0 lg:flex-shrink">
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
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-full animate-in fade-in zoom-in-50 duration-500",
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
                <div className="bg-card border border-border-subtle rounded-[1.5rem] p-4 flex flex-col items-center transition-all h-full min-h-[220px]">
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
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-full animate-in fade-in zoom-in-50 duration-500",
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
                <div className="bg-card border border-border-subtle rounded-[1.5rem] p-4 flex flex-col items-center transition-all h-full min-h-[220px]">
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
                <div className="bg-card border border-border-subtle rounded-[1.5rem] p-4 flex flex-col items-center transition-all h-full min-h-[220px]">
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
                                        <div className={`w-10 h-10 rounded-[1rem] border flex items-center justify-center flex-shrink-0 ${a.color} group-hover:scale-110 transition-transform`}>
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
            {settings.plan !== 'pro' && settings.plan !== 'custom' && billing?.status === 'trial' && (
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
