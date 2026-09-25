'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
    Sparkles, TrendingUp, Users, CalendarCheck, Target, ArrowUpRight,
    ChevronLeft, ChevronRight, Zap, Lightbulb, ShieldCheck, BarChart3,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

export interface AIAnalyticsCardProps {
    lang?: 'ka' | 'ru' | 'en';
    liveStats: {
        totalStudents: number;
        activeStudents: number;
        newThisMonthStudents?: number;
        monthlyRevenue: number;
        monthlySubsRevenue: number;
        monthlyShopRevenue: number;
        attendance: number;
        todayExpected: number;
        todayClassesCount: number;
        todayRevenue: number;
        subStatusCounts: { active: number; paused: number; expired: number; cancelled: number };
    };
    groupProgress?: { id: string; name?: string; pct: number; enrolled?: number; capacity?: number }[];
    currency?: string;
    canViewRevenue?: boolean;
}

export function AIAnalyticsCard({
    lang = 'ka',
    liveStats,
    groupProgress = [],
    currency = 'GEL',
    canViewRevenue = true,
}: AIAnalyticsCardProps) {
    const l = (ka: string, ru: string, en: string) => (lang === 'ka' ? ka : lang === 'ru' ? ru : en);

    const [activeInsightIndex, setActiveInsightIndex] = useState(0);

    const totalStudents = liveStats?.totalStudents || 0;
    const activeStudents = liveStats?.activeStudents || 0;
    const retentionPct = totalStudents > 0 ? Math.min(100, Math.round((activeStudents / totalStudents) * 100)) : 0;

    const attendanceRate = liveStats?.todayExpected > 0
        ? Math.min(100, Math.round((liveStats.attendance / liveStats.todayExpected) * 100))
        : (liveStats?.attendance > 0 ? 100 : 0);

    const avgGroupCapacity = useMemo(() => {
        if (!groupProgress.length) return 0;
        const sum = groupProgress.reduce((acc, g) => acc + (g.pct || 0), 0);
        return Math.round(sum / groupProgress.length);
    }, [groupProgress]);

    const topGroup = useMemo(() => {
        if (!groupProgress.length) return null;
        return [...groupProgress].sort((a, b) => (b.pct || 0) - (a.pct || 0))[0];
    }, [groupProgress]);

    // Dynamic AI insights generated from real studio data
    const insights = useMemo(() => {
        const list: { tag: string; title: string; text: string; icon: any; color: string }[] = [];

        // 1. Retention insight
        if (retentionPct >= 70) {
            list.push({
                tag: l('შენარჩუნება', 'Удержание', 'Retention'),
                title: l('მაღალი ლოიალობა', 'Высокая лояльность', 'High Loyalty'),
                text: l(
                    `სტუდენტების ${retentionPct}% აქტიურია. ეს მაღალი მაჩვენებელია და მიუთითებს ძლიერ კმაყოფილებაზე.`,
                    `${retentionPct}% студентов активны. Это отличный показатель удержания аудитории.`,
                    `${retentionPct}% of students are active. Excellent student loyalty and retention.`
                ),
                icon: ShieldCheck,
                color: 'from-emerald-500 to-teal-600',
            });
        } else {
            list.push({
                tag: l('შენარჩუნება', 'Удержание', 'Retention'),
                title: l('პასიური მოსწავლეების გააქტიურება', 'Активация пассивных учеников', 'Re-engage Inactive Students'),
                text: l(
                    `სტუდენტთა ${100 - retentionPct}% ამჟამად პასიურია. გაუგზავნეთ მათ შეთავაზება SMS მენეჯერით.`,
                    `${100 - retentionPct}% студентов не имеют активного абонемента. Рекомендуется SMS-напоминание.`,
                    `${100 - retentionPct}% of students are inactive. Send them a re-engagement offer via SMS.`
                ),
                icon: Users,
                color: 'from-amber-500 to-orange-600',
            });
        }

        // 2. Revenue insight
        if (canViewRevenue) {
            if (liveStats.monthlyRevenue > 0) {
                list.push({
                    tag: l('შემოსავალი', 'Доход', 'Revenue'),
                    title: l('ფინანსური დინამიკა', 'Финансовая динамика', 'Financial Momentum'),
                    text: l(
                        `მიმდინარე თვის შემოსავალია ${formatCurrency(liveStats.monthlyRevenue, currency)}. შემოსავლის ძირითადი წყარო აბონემენტებია.`,
                        `Доход за текущий месяц составляет ${formatCurrency(liveStats.monthlyRevenue, currency)}. Основной источник — абонементы.`,
                        `Current month revenue is ${formatCurrency(liveStats.monthlyRevenue, currency)}, primarily driven by memberships.`
                    ),
                    icon: TrendingUp,
                    color: 'from-indigo-500 to-violet-600',
                });
            } else {
                list.push({
                    tag: l('გაყიდვები', 'Продажи', 'Sales'),
                    title: l('გადახდების რეგისტრაცია', 'Регистрация оплат', 'Log Payments'),
                    text: l(
                        'დაარეგისტრირეთ აბონემენტების გაყიდვები ზუსტი ფინანსური ანალიტიკისა და პროგნოზისთვის.',
                        'Оформляйте абонементы для формирования точной финансовой аналитики и прогнозов.',
                        'Register subscription payments to unlock accurate financial projections.'
                    ),
                    icon: TrendingUp,
                    color: 'from-blue-500 to-indigo-600',
                });
            }
        }

        // 3. Attendance insight
        list.push({
            tag: l('დასწრება', 'Посещаемость', 'Attendance'),
            title: l('დღევანდელი გამოცხადება', 'Сегодняшняя явка', "Today's Turnout"),
            text: liveStats.todayExpected > 0
                ? l(
                    `დღეს გამოცხადდა ${liveStats.attendance} / ${liveStats.todayExpected} მოსწავლე (${attendanceRate}%).`,
                    `Сегодня посетило ${liveStats.attendance} из ${liveStats.todayExpected} учеников (${attendanceRate}%).`,
                    `Today ${liveStats.attendance} of ${liveStats.todayExpected} expected students attended (${attendanceRate}%).`
                )
                : l(
                    'დღეს ჯგუფების დასწრების მონაცემები ჯერ მუშავდება.',
                    'Данные посещаемости за сегодня формируются.',
                    'Attendance data for today is currently compiling.'
                ),
            icon: CalendarCheck,
            color: 'from-violet-500 to-purple-600',
        });

        // 4. Group Capacity insight
        if (topGroup && topGroup.name) {
            list.push({
                tag: l('ჯგუფები', 'Группы', 'Groups'),
                title: l('პოპულარული მიმართულება', 'Популярное направление', 'Top Performer'),
                text: l(
                    `ჯგუფი "${topGroup.name}" შევსებულია ${topGroup.pct}%-ით. განიხილეთ დამატებითი საათის ჩანიშვნა.`,
                    `Группа "${topGroup.name}" заполнена на ${topGroup.pct}%. Рассмотрите добавление параллельного часа.`,
                    `"${topGroup.name}" is at ${topGroup.pct}% capacity. Consider opening an additional section.`
                ),
                icon: Target,
                color: 'from-rose-500 to-pink-600',
            });
        }

        return list;
    }, [retentionPct, canViewRevenue, liveStats, currency, attendanceRate, topGroup, l]);

    // Auto rotate insights every 6s
    useEffect(() => {
        if (insights.length <= 1) return;
        const timer = setInterval(() => {
            setActiveInsightIndex(prev => (prev + 1) % insights.length);
        }, 6000);
        return () => clearInterval(timer);
    }, [insights.length]);

    const activeInsight = insights[activeInsightIndex] || insights[0];

    return (
        <div className="bg-card border border-border-subtle rounded-2xl p-5 sm:p-6 flex flex-col justify-between h-full min-h-[460px] shadow-xs">
            {/* ─── Header ─── */}
            <div>
                <div className="flex items-center justify-between pb-4 border-b border-border-subtle/60 gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 shadow-xs">
                            <Sparkles className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-black text-primary leading-tight">
                                    {l('AI ანალიტიკა', 'AI Аналитика', 'AI Analytics')}
                                </h3>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                    {l('ლაივ', 'Live', 'Live')}
                                </span>
                            </div>
                            <p className="text-[11px] font-semibold text-muted">
                                {l('სტუდიის ინტელექტუალური ასისტენტი', 'Интеллектуальный ассистент студии', 'Studio Intelligence & Insights')}
                            </p>
                        </div>
                    </div>

                    <Link
                        href="/analytics"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-xs font-bold text-primary transition-colors cursor-pointer group flex-shrink-0"
                    >
                        <span>{l('ანალიტიკა', 'Аналитика', 'Full Analytics')}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-muted group-hover:text-primary transition-colors" />
                    </Link>
                </div>

                {/* ─── AI Insights Hero Card ─── */}
                <div className="mt-4 relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white p-4 sm:p-5 shadow-lg shadow-indigo-600/20">
                    {/* Background glow effects */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/15 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                    <div className="relative z-10 flex flex-col justify-between gap-3">
                        <div className="flex items-center justify-between">
                            <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-black uppercase tracking-wider text-white border border-white/20">
                                {activeInsight.tag}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setActiveInsightIndex(prev => (prev - 1 + insights.length) % insights.length)}
                                    className="w-6 h-6 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors cursor-pointer"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-[10px] font-bold text-white/70 px-1 tabular-nums">
                                    {activeInsightIndex + 1} / {insights.length}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setActiveInsightIndex(prev => (prev + 1) % insights.length)}
                                    className="w-6 h-6 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors cursor-pointer"
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm sm:text-base font-black tracking-tight text-white mb-1">
                                {activeInsight.title}
                            </h4>
                            <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed font-medium">
                                "{activeInsight.text}"
                            </p>
                        </div>
                    </div>
                </div>

                {/* ─── 4 Core AI Metrics Grid ─── */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* 1. Retention */}
                    <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
                        <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
                                {l('შენარჩუნება', 'Удержание', 'Retention')}
                            </span>
                            <Users className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                        </div>
                        <p className="text-lg sm:text-xl font-black text-primary leading-none tabular-nums">
                            {retentionPct}%
                        </p>
                        <p className="text-[10px] font-semibold text-muted mt-1 truncate">
                            {activeStudents} / {totalStudents} {l('აქტიური', 'активных', 'active')}
                        </p>
                    </div>

                    {/* 2. Attendance Turnout */}
                    <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
                        <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
                                {l('დასწრება', 'Посещаемость', 'Turnout')}
                            </span>
                            <CalendarCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        </div>
                        <p className="text-lg sm:text-xl font-black text-primary leading-none tabular-nums">
                            {attendanceRate}%
                        </p>
                        <p className="text-[10px] font-semibold text-muted mt-1 truncate">
                            {liveStats.attendance} {l('დამსწრე დღეს', 'посещений', 'attended today')}
                        </p>
                    </div>

                    {/* 3. Group Load */}
                    <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
                        <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
                                {l('დატვირთვა', 'Заполненность', 'Group Load')}
                            </span>
                            <Target className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                        </div>
                        <p className="text-lg sm:text-xl font-black text-primary leading-none tabular-nums">
                            {avgGroupCapacity}%
                        </p>
                        <p className="text-[10px] font-semibold text-muted mt-1 truncate">
                            {groupProgress.length} {l('ჯგუფი', 'групп', 'groups')}
                        </p>
                    </div>

                    {/* 4. Monthly Subscriptions */}
                    <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
                        <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">
                                {l('აბონემენტები', 'Абонементы', 'Subscriptions')}
                            </span>
                            <BarChart3 className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        </div>
                        <p className="text-lg sm:text-xl font-black text-primary leading-none tabular-nums">
                            {liveStats.subStatusCounts?.active || 0}
                        </p>
                        <p className="text-[10px] font-semibold text-muted mt-1 truncate">
                            {l('აქტიური აბონემენტი', 'активных абон.', 'active passes')}
                        </p>
                    </div>
                </div>

                {/* ─── Smart AI Recommendations ─── */}
                <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        <h5 className="text-xs font-black text-primary uppercase tracking-wider">
                            {l('ჭკვიანი რეკომენდაციები', 'Умные рекомендации', 'Smart Recommendations')}
                        </h5>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-100/80 dark:border-slate-800/50 flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 text-xs font-black">
                                1
                            </span>
                            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-snug">
                                {l('ვადაგასულ აბონემენტებზე ავტომატური SMS შეხსენების ჩართვა ზრდის განახლებას 28%-ით.', 'Автонапоминания об окончании абонементов повышают продления на 28%.', 'Automated pass expiration reminders increase renewal rates by 28%.')}
                            </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-slate-100/80 dark:border-slate-800/50 flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 text-xs font-black">
                                2
                            </span>
                            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-snug">
                                {l('პოპულარულ საათებში დამატებითი ჯგუფის გახსნა პირდაპირ გაზრდის სტუდიის მოგებას.', 'Открытие параллельных групп в пиковые часы увеличит общую прибыль студии.', 'Adding sections during peak attendance hours directly maximizes studio profit.')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Footer Action ─── */}
            <div className="pt-4 border-t border-border-subtle/50 flex items-center justify-between text-xs">
                <span className="text-muted font-medium">
                    {l('მონაცემები განახლებულია რეალურ დროში', 'Данные обновляются в реальном времени', 'Live real-time data')}
                </span>
                <Link
                    href="/analytics"
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1"
                >
                    <span>{l('დეტალური ანგარიში', 'Подробный отчет', 'View Detailed Report')}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                </Link>
            </div>
        </div>
    );
}
