'use client';

/**
 * New Dashboard "home" sections — Today's Schedule timeline, Quick Actions,
 * Today's Summary, Upcoming Events, Recent Activity, Group Progress. Built
 * to match a reference layout the owner supplied (screenshot), replacing
 * the previous TodayGroupsCard/CalendarScheduleCard two-column block on
 * /dashboard. The donut stat-card row and the "Needs Attention" panel above
 * this were explicitly kept as-is per the owner's request.
 */

import Link from 'next/link';
import {
    Calendar as CalendarIcon, ChevronLeft, ChevronRight, UserPlus, CalendarCheck,
    CreditCard, Zap, Trophy, TrendingUp, Users, Send, BarChart2, Activity,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { Group } from '@/lib/group-store';
import type { CalendarEvent } from '@/types';

// ─── Today's Schedule (day list / week & month grids) ──────────────────────

export type ScheduleItem = {
    id: string;
    title: string;
    type?: string;
    color?: string;
    start_time: string;
    end_time: string;
    teacherName?: string;
    teacherPhoto?: string;
    teacherStyle?: string;
    categoryLabel?: string;
    groupSubtitle?: string;
    hallName?: string;
    studentCount?: number;
    capacity?: number;
};

const ROW_PALETTE = [
    { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)', pillBg: 'rgba(139, 92, 246, 0.16)' },
    { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', pillBg: 'rgba(59, 130, 246, 0.16)' },
    { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', pillBg: 'rgba(245, 158, 11, 0.16)' },
    { color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', pillBg: 'rgba(16, 185, 129, 0.16)' },
    { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.08)', pillBg: 'rgba(99, 102, 241, 0.16)' },
    { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.08)', pillBg: 'rgba(244, 63, 94, 0.16)' },
];

function timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

function eventStatus(item: ScheduleItem, isToday: boolean, nowMinutes: number, l: (ka: string, ru: string, en: string) => string) {
    if (!isToday) return { label: l('დაგეგმილი', 'Запланировано', 'Scheduled'), cls: 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200/60 dark:border-slate-700', dot: 'bg-slate-400', filled: false };
    const start = timeToMinutes(item.start_time);
    const end = timeToMinutes(item.end_time);
    if (nowMinutes >= start && nowMinutes < end) return { label: l('მიმდინარეობს', 'Идёт', 'In progress'), cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500', filled: true };
    if (nowMinutes >= end) return { label: l('დასრულდა', 'Завершено', 'Done'), cls: 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200/50 dark:border-slate-800', dot: 'bg-slate-300 dark:bg-slate-600', filled: false };
    return { label: l('მოსალოდნელი', 'Скоро', 'Upcoming'), cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30', dot: 'border-[1.5px] border-sky-500 bg-transparent', filled: false };
}

function typeLabel(type: string | undefined, l: (ka: string, ru: string, en: string) => string): string {
    switch (type) {
        case 'group_class': case 'group': return l('ჯგუფური', 'Групповое', 'Group');
        case 'individual': return l('ინდივიდუალური', 'Индивидуальное', 'Individual');
        case 'rental': return l('გაქირავება', 'Аренда', 'Rental');
        default: return l('სხვა', 'Другое', 'Other');
    }
}

/** Day view: one tinted row per class, matching the reference layout exactly. */
function DayRow({ item, index, isToday, nowMinutes, l }: { item: ScheduleItem; index: number; isToday: boolean; nowMinutes: number; l: (ka: string, ru: string, en: string) => string }) {
    const status = eventStatus(item, isToday, nowMinutes, l);
    const hasCapacity = item.capacity != null && Number(item.capacity) > 0;
    const palette = ROW_PALETTE[index % ROW_PALETTE.length];
    const isCustomColor = item.color && item.color !== '#6d28d9' && !item.color.startsWith('#6d28');
    const color = isCustomColor ? item.color! : palette.color;
    const rowBg = isCustomColor ? `${item.color}10` : palette.bg;
    const pillBg = isCustomColor ? `${item.color}20` : palette.pillBg;

    return (
        <div className="flex items-center gap-2 sm:gap-3 group">
            {/* 1. Time Column */}
            <div className="w-[84px] sm:w-[98px] flex-shrink-0 text-right pr-1">
                <p className="text-xs sm:text-[13px] font-bold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap tracking-tight">
                    {item.start_time} – {item.end_time}
                </p>
            </div>

            {/* 2. Timeline Bullet Node */}
            <div className="relative flex items-center justify-center w-5 sm:w-6 flex-shrink-0">
                <div
                    className="w-2.5 h-2.5 rounded-full ring-4 ring-card z-10 transition-transform group-hover:scale-125"
                    style={{ backgroundColor: color }}
                />
            </div>

            {/* 3. Class Card with Fixed/Aligned Columns matching reference layout */}
            <div
                className="flex-1 min-w-0 rounded-2xl py-2.5 px-3.5 sm:px-5 flex items-center gap-3 sm:gap-5 transition-all duration-200 hover:shadow-xs border border-black/[0.02] dark:border-white/[0.04]"
                style={{ backgroundColor: rowBg }}
            >
                {/* Column A: Category Pill */}
                <div className="flex-shrink-0 w-[85px] sm:w-[105px] text-center">
                    <span
                        className="inline-block px-3 py-1 rounded-xl text-[10px] sm:text-[11px] font-black tracking-wide truncate max-w-full"
                        style={{ backgroundColor: pillBg, color }}
                    >
                        {item.categoryLabel || typeLabel(item.type, l)}
                    </span>
                </div>

                {/* Column B: Group / Class Name + Subtitle */}
                <div className="min-w-0 flex-1 max-w-[130px] sm:max-w-[170px]">
                    <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate leading-tight">
                        {item.title}
                    </p>
                    <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 dark:text-slate-400 truncate leading-tight mt-0.5">
                        {item.groupSubtitle || item.hallName || l('ჯგუფური', 'Группа', 'Group')}
                    </p>
                </div>

                {/* Column C: Teacher Avatar + Name + Discipline */}
                <div className="hidden md:flex items-center gap-2.5 min-w-0 flex-1 max-w-[160px] sm:max-w-[210px]">
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 shadow-xs border border-white/60 dark:border-white/10 bg-indigo-500/10 flex items-center justify-center text-xs font-black text-indigo-600">
                        {item.teacherPhoto ? (
                            <img src={item.teacherPhoto} className="w-full h-full object-cover" alt="" />
                        ) : (
                            (item.teacherName || item.title || 'T')[0]
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-[13px] font-black text-slate-800 dark:text-slate-100 truncate leading-tight">
                            {item.teacherName || l('მასწავლებელი', 'Преподаватель', 'Teacher')}
                        </p>
                        <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 dark:text-slate-400 truncate leading-tight mt-0.5">
                            {item.teacherStyle || item.hallName || ''}
                        </p>
                    </div>
                </div>

                {/* Column D: Capacity (People Icon + Student Count / Total) */}
                <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0 w-16 sm:w-20 justify-center text-slate-600 dark:text-slate-300">
                    <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-xs font-bold tabular-nums">
                        {item.studentCount ?? 0}{hasCapacity ? ` / ${item.capacity}` : ''}
                    </span>
                </div>

                {/* Column E: Status Pill */}
                <div className="flex-shrink-0 ml-auto">
                    <span className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold border whitespace-nowrap shadow-2xs', status.cls)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', status.dot)} />
                        {status.label}
                    </span>
                </div>
            </div>
        </div>
    );
}

/** Week view: 7-column grid, each day a stack of compact colored chips. */
function WeekGrid({ groups, todayStr, l }: { groups: { date: string; items: ScheduleItem[] }[]; todayStr: string; l: (ka: string, ru: string, en: string) => string }) {
    return (
        <div className="grid grid-cols-7 gap-2 h-full">
            {groups.map(g => {
                const isToday = g.date === todayStr;
                const d = new Date(`${g.date}T00:00:00`);
                const sorted = [...g.items].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
                return (
                    <div key={g.date} className={cn('rounded-xl border p-1.5 flex flex-col min-h-[220px]', isToday ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-border-subtle bg-surface/40')}>
                        <div className="text-center pb-1.5 mb-1.5 border-b border-border-subtle/60">
                            <p className="text-[9px] font-black text-muted uppercase opacity-60">{d.toLocaleDateString(l('ka-GE', 'ru-RU', 'en-US'), { weekday: 'short' })}</p>
                            <p className={cn('text-xs font-black', isToday ? 'text-indigo-500' : 'text-primary')}>{d.getDate()}</p>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1">
                            {sorted.length === 0 ? (
                                <p className="text-[9px] text-muted opacity-30 text-center pt-2">—</p>
                            ) : sorted.map(item => (
                                <div key={item.id} className="rounded-md px-1.5 py-1" style={{ backgroundColor: `${item.color || '#6d28d9'}18` }}>
                                    <p className="text-[9px] font-black leading-none" style={{ color: item.color || '#6d28d9' }}>{item.start_time}</p>
                                    <p className="text-[10px] font-bold text-primary truncate leading-tight mt-0.5">{item.title}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/** Month view: classic calendar grid, each cell a date + up to 2 chips + overflow count. */
function MonthGrid({ groups, todayStr, l }: { groups: { date: string; items: ScheduleItem[] }[]; todayStr: string; l: (ka: string, ru: string, en: string) => string }) {
    if (groups.length === 0) return null;
    const first = new Date(`${groups[0].date}T00:00:00`);
    const year = first.getFullYear();
    const month = first.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstOfMonth = new Date(year, month, 1);
    const leadingBlanks = (firstOfMonth.getDay() + 6) % 7; // Mon=0
    const byDate = new Map(groups.map(g => [g.date, g.items]));
    const weekdayLabels = [
        l('ორშ', 'Пн', 'Mon'), l('სამ', 'Вт', 'Tue'), l('ოთხ', 'Ср', 'Wed'), l('ხუთ', 'Чт', 'Thu'),
        l('პარ', 'Пт', 'Fri'), l('შაბ', 'Сб', 'Sat'), l('კვ', 'Вс', 'Sun'),
    ];

    const cells: { date?: string; items?: ScheduleItem[] }[] = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push({});
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({ date: dateStr, items: byDate.get(dateStr) || [] });
    }

    return (
        <div className="flex flex-col h-full">
            <div className="grid grid-cols-7 gap-1 mb-1">
                {weekdayLabels.map(w => (
                    <p key={w} className="text-[9px] font-black text-muted uppercase opacity-50 text-center">{w}</p>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1 flex-1">
                {cells.map((cell, i) => {
                    if (!cell.date) return <div key={i} />;
                    const isToday = cell.date === todayStr;
                    const items = cell.items || [];
                    const dayNum = Number(cell.date.slice(-2));
                    return (
                        <div key={i} className={cn('rounded-lg border p-1 min-h-[64px] flex flex-col', isToday ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-border-subtle/60 bg-surface/30')}>
                            <p className={cn('text-[10px] font-black mb-0.5', isToday ? 'text-indigo-500' : 'text-primary opacity-70')}>{dayNum}</p>
                            <div className="space-y-0.5 flex-1 overflow-hidden">
                                {items.slice(0, 2).map(item => (
                                    <p key={item.id} className="text-[8px] font-bold truncate rounded px-1 py-0.5"
                                        style={{ backgroundColor: `${item.color || '#6d28d9'}18`, color: item.color || '#6d28d9' }}>
                                        {item.title}
                                    </p>
                                ))}
                                {items.length > 2 && (
                                    <p className="text-[8px] font-bold text-muted opacity-50 px-1">+{items.length - 2}</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function TodayScheduleTimeline({
    groups, selectedDate, onPrev, onNext, onToday, view, onViewChange, l,
}: {
    groups: { date: string; items: ScheduleItem[] }[];
    selectedDate: Date;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
    view: 'day' | 'week' | 'month';
    onViewChange: (v: 'day' | 'week' | 'month') => void;
    l: (ka: string, ru: string, en: string) => string;
}) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const dayItems = view === 'day' ? [...(groups[0]?.items || [])].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)) : [];

    return (
        <div className="bg-card border border-border-subtle rounded-2xl p-4 sm:p-5 h-full flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center flex-shrink-0">
                        <CalendarIcon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-primary leading-tight">{l("დღევანდელი განრიგი", "Расписание", "Today's Schedule")}</h3>
                        <p className="text-[11px] font-bold text-muted opacity-60">
                            {view === 'day'
                                ? selectedDate.toLocaleDateString(l('ka-GE', 'ru-RU', 'en-US'), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                                : selectedDate.toLocaleDateString(l('ka-GE', 'ru-RU', 'en-US'), { month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center bg-surface border border-border-subtle rounded-full p-1">
                        {(['day', 'week', 'month'] as const).map(v => (
                            <button key={v} onClick={() => onViewChange(v)}
                                className={cn('px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors',
                                    view === v ? 'bg-indigo-500 text-white shadow-sm' : 'text-muted hover:text-primary')}>
                                {v === 'day' ? l('დღე', 'День', 'Day') : v === 'week' ? l('კვირა', 'Неделя', 'Week') : l('თვე', 'Месяц', 'Month')}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={onPrev} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface text-muted hover:text-primary transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button onClick={onToday} className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-surface border border-border-subtle text-indigo-500 hover:bg-indigo-500/10 transition-colors">
                            {l('დღეს', 'Сегодня', 'Today')}
                        </button>
                        <button onClick={onNext} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface text-muted hover:text-primary transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 mt-3 overflow-y-auto pr-1 max-h-[460px]">
                {view === 'day' ? (
                    dayItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center py-10 text-muted opacity-40">
                            <CalendarIcon className="w-8 h-8 mb-2" />
                            <p className="text-xs font-bold">{l('დღეს არაფერია დაგეგმილი', 'На сегодня ничего не запланировано', 'Nothing scheduled today')}</p>
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Continuous vertical timeline connector line */}
                            <div className="absolute left-[101px] sm:left-[121px] top-4 bottom-4 w-0.5 bg-slate-200/80 dark:bg-slate-800 pointer-events-none" />
                            <div className="space-y-2">
                                {dayItems.map((item, idx) => (
                                    <DayRow key={item.id} item={item} index={idx} isToday={true} nowMinutes={nowMinutes} l={l} />
                                ))}
                            </div>
                        </div>
                    )
                ) : view === 'week' ? (
                    <WeekGrid groups={groups} todayStr={todayStr} l={l} />
                ) : (
                    <MonthGrid groups={groups} todayStr={todayStr} l={l} />
                )}
            </div>
        </div>
    );
}

// ─── Quick Actions ──────────────────────────────────────────────────────────

export function QuickActionsPanel({ onAddStudent, onCreatePayment, l }: { onAddStudent: () => void; onCreatePayment: () => void; l: (ka: string, ru: string, en: string) => string }) {
    const actions = [
        { icon: UserPlus, label: l('სტუდენტის დამატება', 'Добавить студента', 'Add New Student'), bg: 'bg-[#6366f1]', onClick: onAddStudent },
        { icon: CalendarCheck, label: l('დასწრების აღრიცხვა', 'Отметить посещаемость', 'Register Attendance'), bg: 'bg-[#10b981]', href: '/attendance' },
        { icon: CreditCard, label: l('გადახდის შექმნა', 'Создать платёж', 'Create Payment'), bg: 'bg-[#0ea5e9]', onClick: onCreatePayment },
        { icon: CalendarIcon, label: l('განრიგის ნახვა', 'Посмотреть расписание', 'View Schedule'), bg: 'bg-[#8b5cf6]', href: '/calendar' },
        { icon: Send, label: l('შეტყობინების გაგზავნა', 'Отправить сообщение', 'Send Message'), bg: 'bg-[#f43f5e]', href: '/sms-manager' },
    ];

    return (
        <div className="bg-card border border-border-subtle rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-primary">{l('სასწრაფო მოქმედებები', 'Быстрые действия', 'Quick Actions')}</h3>
            </div>
            <div className="space-y-2">
                {actions.map((a, i) => {
                    const content = (
                        <>
                            <div className={cn('w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-xs', a.bg)}>
                                <a.icon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                            </div>
                            <span className="flex-1 text-xs font-bold text-slate-800 dark:text-slate-100 text-left">{a.label}</span>
                            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        </>
                    );
                    return a.href ? (
                        <Link key={i} href={a.href} className="w-full flex items-center gap-3 px-3 py-2 sm:py-2.5 rounded-2xl bg-slate-50/70 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 border border-slate-100/80 dark:border-slate-800/60 transition-colors">
                            {content}
                        </Link>
                    ) : (
                        <button key={i} onClick={a.onClick} className="w-full flex items-center gap-3 px-3 py-2 sm:py-2.5 rounded-2xl bg-slate-50/70 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 border border-slate-100/80 dark:border-slate-800/60 transition-colors">
                            {content}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Today's Summary ────────────────────────────────────────────────────────

export function TodaySummaryPanel({
    classesToday, attended, expected, newRegistrations, paymentsReceived, currency, l,
}: {
    classesToday: number;
    attended: number;
    expected: number;
    newRegistrations: number;
    paymentsReceived: number;
    currency?: string;
    l: (ka: string, ru: string, en: string) => string;
}) {
    const attendedPct = expected > 0 ? Math.min(100, Math.round((attended / expected) * 100)) : 0;
    return (
        <div className="bg-card border border-border-subtle rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <BarChart2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-primary">{l('დღევანდელი შედეგები', 'Итоги дня', "Today's Summary")}</h3>
            </div>
            <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{l('გაკვეთილები', 'Занятия', 'Classes')}</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">{classesToday}</span>
                </div>
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{l('დამსწრე სტუდენტები', 'Посетили студенты', 'Students Attended')}</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">{attended}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tabular-nums w-7">{attendedPct}%</span>
                        <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all" style={{ width: `${attendedPct}%` }} />
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{l('ახალი რეგისტრაცია', 'Новые регистрации', 'New Registrations')}</span>
                    <span className="flex items-center gap-1 text-sm font-black text-emerald-500 tabular-nums">
                        {newRegistrations}
                        <span className="text-xs font-bold">↑</span>
                    </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border-subtle/70">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{l('მიღებული გადახდები', 'Полученные платежи', 'Payments Received')}</span>
                    <span className="text-base font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(paymentsReceived, currency)}</span>
                </div>
            </div>
        </div>
    );
}

// ─── Upcoming Events ────────────────────────────────────────────────────────

export function UpcomingEventsCard({ events, l }: { events: CalendarEvent[]; l: (ka: string, ru: string, en: string) => string }) {
    return (
        <div className="bg-card border border-border-subtle rounded-2xl p-4 sm:p-5 h-full">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                        <CalendarIcon className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-primary">{l('მოსალოდნელი ღონისძიებები', 'Ближайшие события', 'Upcoming Events')}</h3>
                </div>
                <Link href="/calendar" className="text-[10px] font-bold text-indigo-500 hover:underline">{l('ყველა', 'Все', 'View all')}</Link>
            </div>
            {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted opacity-40">
                    <CalendarIcon className="w-7 h-7 mb-2" />
                    <p className="text-[11px] font-bold">{l('ღონისძიება არ არის დაგეგმილი', 'Событий не запланировано', 'No events scheduled')}</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {events.map(ev => {
                        const d = new Date(ev.date);
                        return (
                            <div key={ev.id} className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center justify-center flex-shrink-0">
                                    <span className="text-[13px] font-black text-slate-800 dark:text-slate-100 leading-none">{String(d.getDate()).padStart(2, '0')}</span>
                                    <span className="text-[8px] font-black text-indigo-500 uppercase leading-none mt-0.5">
                                        {d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                                    </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{ev.title}</p>
                                    <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 dark:text-slate-400 truncate mt-0.5">{ev.notes || l('ღონისძიება', 'Событие', 'Event')}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Recent Activity ────────────────────────────────────────────────────────

export type ActivityItem = {
    id: string;
    kind: 'checkin' | 'registration' | 'payment';
    name: string;
    detail: string;
    timeLabel: string;
    photo_url?: string;
};

export function RecentActivityCard({ items, l }: { items: ActivityItem[]; l: (ka: string, ru: string, en: string) => string }) {
    const dotColor = (kind: ActivityItem['kind']) => kind === 'registration' ? 'bg-emerald-500' : kind === 'payment' ? 'bg-sky-500' : 'bg-amber-500';

    return (
        <div className="bg-card border border-border-subtle rounded-2xl p-4 sm:p-5 h-full">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                        <Activity className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-primary">{l('ბოლო აქტივობა', 'Последняя активность', 'Recent Activity')}</h3>
                </div>
                <Link href="/attendance" className="text-[10px] font-bold text-indigo-500 hover:underline">{l('ყველა', 'Все', 'View all')}</Link>
            </div>
            {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted opacity-40">
                    <p className="text-[11px] font-bold">{l('აქტივობა არ არის', 'Нет активности', 'No activity yet')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map(it => (
                        <div key={it.id} className="flex items-center gap-3">
                            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dotColor(it.kind))} />
                            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200">
                                {it.photo_url ? (
                                    <img src={it.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    (it.name || 'S')[0]
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate leading-tight">{it.name}</p>
                                <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 dark:text-slate-400 truncate leading-tight mt-0.5">{it.detail}</p>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 flex-shrink-0 whitespace-nowrap">{it.timeLabel}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Group Progress ─────────────────────────────────────────────────────────

const PROGRESS_BAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9'];

export function GroupProgressCard({ groups, l }: {
    groups: { id: string; name: string; photo?: string; pct: number }[];
    l: (ka: string, ru: string, en: string) => string;
}) {
    return (
        <div className="bg-card border border-border-subtle rounded-2xl p-4 sm:p-5 h-full">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-primary">{l('ჯგუფების დატვირთვა', 'Заполненность групп', 'Group Progress')}</h3>
                </div>
                <Link href="/groups" className="text-[10px] font-bold text-indigo-500 hover:underline">{l('ყველა', 'Все', 'View all')}</Link>
            </div>
            {groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted opacity-40">
                    <p className="text-[11px] font-bold">{l('ჯგუფები არ არის', 'Групп нет', 'No groups yet')}</p>
                </div>
            ) : (
                <div className="space-y-3.5">
                    {groups.map((g, idx) => {
                        const barColor = PROGRESS_BAR_COLORS[idx % PROGRESS_BAR_COLORS.length];
                        return (
                            <div key={g.id} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black flex-shrink-0 overflow-hidden text-slate-700 dark:text-slate-200 border border-slate-200/50 dark:border-slate-700/50">
                                    {g.photo ? <img src={g.photo} className="w-full h-full object-cover" alt="" /> : g.name[0]}
                                </div>
                                <p className="w-24 sm:w-28 flex-shrink-0 text-xs font-bold text-slate-900 dark:text-white truncate">{g.name}</p>
                                <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${g.pct}%`, backgroundColor: barColor }}
                                    />
                                </div>
                                <span className="w-8 text-right text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums flex-shrink-0">{g.pct}%</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
