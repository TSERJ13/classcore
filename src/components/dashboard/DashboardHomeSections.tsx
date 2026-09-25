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
    CreditCard, MessageSquare, Zap, Trophy, Megaphone, TrendingUp, Users,
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
    hallName?: string;
    studentCount?: number;
    capacity?: number;
};

function timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

function eventStatus(item: ScheduleItem, isToday: boolean, nowMinutes: number, l: (ka: string, ru: string, en: string) => string) {
    if (!isToday) return { label: l('დაგეგმილი', 'Запланировано', 'Scheduled'), cls: 'bg-surface text-muted border-border-subtle', dot: 'bg-muted/40', filled: false };
    const start = timeToMinutes(item.start_time);
    const end = timeToMinutes(item.end_time);
    if (nowMinutes >= start && nowMinutes < end) return { label: l('მიმდინარეობს', 'Идёт', 'In progress'), cls: 'bg-emerald-500 text-white border-emerald-500', dot: 'bg-white', filled: true };
    if (nowMinutes >= end) return { label: l('დასრულდა', 'Завершено', 'Done'), cls: 'bg-surface text-muted/60 border-border-subtle', dot: 'bg-muted/40', filled: false };
    return { label: l('მოსალოდნელი', 'Скоро', 'Upcoming'), cls: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/25', dot: 'border border-indigo-500', filled: false };
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
function DayRow({ item, isToday, nowMinutes, l }: { item: ScheduleItem; isToday: boolean; nowMinutes: number; l: (ka: string, ru: string, en: string) => string }) {
    const status = eventStatus(item, isToday, nowMinutes, l);
    const hasCapacity = item.capacity != null && Number(item.capacity) > 0;
    const color = item.color || '#6d28d9';
    return (
        <div className="flex items-center gap-3">
            <div className="w-[88px] flex-shrink-0 text-right">
                <p className="text-[12px] font-black text-primary whitespace-nowrap">{item.start_time} – {item.end_time}</p>
            </div>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <div className="flex-1 min-w-0 rounded-2xl p-3 flex items-center justify-between gap-3"
                style={{ backgroundColor: `${color}12` }}>
                <div className="flex items-center gap-3 min-w-0">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black flex-shrink-0" style={{ backgroundColor: `${color}22`, color }}>
                        {typeLabel(item.type, l)}
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-primary truncate">{item.title}</p>
                        {item.hallName && <p className="text-[11px] text-muted opacity-60 truncate">{item.hallName}</p>}
                    </div>
                </div>
                <div className="hidden sm:flex items-center gap-2.5 min-w-0 flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-[10px] font-black flex-shrink-0 overflow-hidden">
                        {item.teacherPhoto ? <img src={item.teacherPhoto} className="w-full h-full object-cover" alt="" /> : (item.teacherName || item.title)[0]}
                    </div>
                    {item.teacherName && <p className="text-xs font-bold text-primary truncate max-w-[110px]">{item.teacherName}</p>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    {hasCapacity && (
                        <span className="hidden md:flex items-center gap-1 text-[11px] font-bold text-muted opacity-70 tabular-nums">
                            <Users className="w-3 h-3" /> {item.studentCount ?? 0} / {item.capacity}
                        </span>
                    )}
                    <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap', status.cls)}>
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
                        <div className="space-y-2">
                            {dayItems.map(item => <DayRow key={item.id} item={item} isToday={true} nowMinutes={nowMinutes} l={l} />)}
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
        { icon: UserPlus, label: l('სტუდენტის დამატება', 'Добавить студента', 'Add New Student'), color: 'bg-indigo-500/10 text-indigo-500', onClick: onAddStudent },
        { icon: CalendarCheck, label: l('დასწრების აღრიცხვა', 'Отметить посещаемость', 'Register Attendance'), color: 'bg-emerald-500/10 text-emerald-500', href: '/attendance' },
        { icon: CreditCard, label: l('გადახდის შექმნა', 'Создать платёж', 'Create Payment'), color: 'bg-rose-500/10 text-rose-500', onClick: onCreatePayment },
        { icon: CalendarIcon, label: l('განრიგის ნახვა', 'Посмотреть расписание', 'View Schedule'), color: 'bg-violet-500/10 text-violet-500', href: '/calendar' },
        { icon: MessageSquare, label: l('შეტყობინების გაგზავნა', 'Отправить сообщение', 'Send Message'), color: 'bg-amber-500/10 text-amber-500', href: '/sms-manager' },
    ];

    return (
        <div className="bg-card border border-border-subtle rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-primary">{l('სასწრაფო მოქმედებები', 'Быстрые действия', 'Quick Actions')}</h3>
            </div>
            <div className="space-y-2">
                {actions.map((a, i) => {
                    const content = (
                        <>
                            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', a.color)}>
                                <a.icon className="w-4 h-4" />
                            </div>
                            <span className="flex-1 text-xs font-bold text-primary text-left">{a.label}</span>
                            <ChevronRight className="w-4 h-4 text-muted opacity-30 flex-shrink-0" />
                        </>
                    );
                    return a.href ? (
                        <Link key={i} href={a.href} className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-surface/60 hover:bg-surface transition-colors">
                            {content}
                        </Link>
                    ) : (
                        <button key={i} onClick={a.onClick} className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-surface/60 hover:bg-surface transition-colors">
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
            <h3 className="text-sm font-bold text-primary mb-3">{l('დღევანდელი შედეგები', 'Итоги дня', "Today's Summary")}</h3>
            <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted">{l('გაკვეთილები', 'Занятия', 'Classes')}</span>
                    <span className="text-sm font-black text-primary tabular-nums">{classesToday}</span>
                </div>
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-muted">{l('დამსწრე სტუდენტები', 'Посетили студенты', 'Students Attended')}</span>
                        <span className="text-sm font-black text-primary tabular-nums">{attendedPct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${attendedPct}%` }} />
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted">{l('ახალი რეგისტრაცია', 'Новые регистрации', 'New Registrations')}</span>
                    <span className="flex items-center gap-1 text-sm font-black text-emerald-500 tabular-nums">
                        {newRegistrations > 0 && <TrendingUp className="w-3.5 h-3.5" />}
                        {newRegistrations}
                    </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border-subtle">
                    <span className="text-xs font-bold text-muted">{l('მიღებული გადახდები', 'Полученные платежи', 'Payments Received')}</span>
                    <span className="text-sm font-black text-primary tabular-nums">{formatCurrency(paymentsReceived, currency)}</span>
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
                    <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center flex-shrink-0">
                        <Megaphone className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-primary">{l('მოსალოდნელი ღონისძიებები', 'Ближайшие события', 'Upcoming Events')}</h3>
                </div>
                <Link href="/calendar" className="text-[10px] font-bold text-indigo-500 hover:underline">{l('ყველა', 'Все', 'View all')}</Link>
            </div>
            {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted opacity-40">
                    <Megaphone className="w-7 h-7 mb-2" />
                    <p className="text-[11px] font-bold">{l('ღონისძიება არ არის დაგეგმილი', 'Событий не запланировано', 'No events scheduled')}</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {events.map(ev => {
                        const d = new Date(ev.date);
                        return (
                            <div key={ev.id} className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-surface border border-border-subtle flex flex-col items-center justify-center flex-shrink-0">
                                    <span className="text-[13px] font-black text-primary leading-none">{d.getDate()}</span>
                                    <span className="text-[8px] font-bold text-muted uppercase leading-none mt-0.5">
                                        {d.toLocaleDateString(l('ka-GE', 'ru-RU', 'en-US'), { month: 'short' })}
                                    </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-primary truncate">{ev.title}</p>
                                    <p className="text-[10px] text-muted opacity-60 truncate">{ev.notes || l('ღონისძიება', 'Событие', 'Event')}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted opacity-20 flex-shrink-0" />
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
};

export function RecentActivityCard({ items, l }: { items: ActivityItem[]; l: (ka: string, ru: string, en: string) => string }) {
    const dotColor = (kind: ActivityItem['kind']) => kind === 'checkin' ? 'bg-indigo-500' : kind === 'registration' ? 'bg-emerald-500' : 'bg-amber-500';

    return (
        <div className="bg-card border border-border-subtle rounded-2xl p-4 sm:p-5 h-full">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-primary">{l('ბოლო აქტივობა', 'Последняя активность', 'Recent Activity')}</h3>
                </div>
            </div>
            {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted opacity-40">
                    <p className="text-[11px] font-bold">{l('აქტივობა არ არის', 'Нет активности', 'No activity yet')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map(it => (
                        <div key={it.id} className="flex items-start gap-3">
                            <span className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', dotColor(it.kind))} />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-primary truncate">{it.name}</p>
                                <p className="text-[10px] text-muted opacity-60 truncate">{it.detail}</p>
                            </div>
                            <span className="text-[9px] font-bold text-muted opacity-40 flex-shrink-0 whitespace-nowrap">{it.timeLabel}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Group Progress ─────────────────────────────────────────────────────────

export function GroupProgressCard({ groups, l }: {
    groups: { id: string; name: string; photo?: string; pct: number }[];
    l: (ka: string, ru: string, en: string) => string;
}) {
    return (
        <div className="bg-card border border-border-subtle rounded-2xl p-4 sm:p-5 h-full">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center flex-shrink-0">
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
                    {groups.map(g => (
                        <div key={g.id} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-[10px] font-black flex-shrink-0 overflow-hidden">
                                {g.photo ? <img src={g.photo} className="w-full h-full object-cover" alt="" /> : g.name[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-primary truncate mb-1">{g.name}</p>
                                <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${g.pct}%` }} />
                                </div>
                            </div>
                            <span className="text-[11px] font-black text-primary tabular-nums flex-shrink-0">{g.pct}%</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
