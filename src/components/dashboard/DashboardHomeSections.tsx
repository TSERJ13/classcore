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
    CreditCard, MessageSquare, Zap, Trophy, Megaphone, TrendingUp,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { Group } from '@/lib/group-store';
import type { CalendarEvent } from '@/types';

// ─── Today's Schedule (vertical timeline) ──────────────────────────────────

export type ScheduleItem = {
    id: string;
    title: string;
    type?: string;
    color?: string;
    start_time: string;
    end_time: string;
    teacherName?: string;
    teacherPhoto?: string;
    studentCount?: number;
    capacity?: number;
};

function timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

function eventStatus(item: ScheduleItem, isToday: boolean, nowMinutes: number, l: (ka: string, ru: string, en: string) => string) {
    if (!isToday) return { label: l('დაგეგმილი', 'Запланировано', 'Scheduled'), cls: 'bg-surface text-muted border-border-subtle' };
    const start = timeToMinutes(item.start_time);
    const end = timeToMinutes(item.end_time);
    if (nowMinutes >= start && nowMinutes < end) return { label: l('მიმდინარეობს', 'Идёт', 'In progress'), cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
    if (nowMinutes >= end) return { label: l('დასრულდა', 'Завершено', 'Done'), cls: 'bg-surface text-muted/60 border-border-subtle' };
    return { label: l('მოსალოდნელი', 'Скоро', 'Upcoming'), cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
}

export function TodayScheduleTimeline({
    items, selectedDate, onPrev, onNext, onToday, view, onViewChange, l,
}: {
    items: ScheduleItem[];
    selectedDate: Date;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
    view: 'day' | 'week' | 'month';
    onViewChange: (v: 'day' | 'week' | 'month') => void;
    l: (ka: string, ru: string, en: string) => string;
}) {
    const isToday = selectedDate.toDateString() === new Date().toDateString();
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const sorted = [...items].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

    return (
        <div className="bg-card border border-border-subtle rounded-2xl p-4 sm:p-5 h-full flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center flex-shrink-0">
                        <CalendarIcon className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-primary">{l("დღევანდელი განრიგი", "Расписание на сегодня", "Today's Schedule")}</h3>
                </div>
                <div className="flex items-center gap-1 bg-surface border border-border-subtle rounded-lg p-0.5">
                    {(['day', 'week', 'month'] as const).map(v => (
                        <button key={v} onClick={() => onViewChange(v)}
                            className={cn('px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors capitalize',
                                view === v ? 'bg-indigo-500 text-white shadow-sm' : 'text-muted hover:text-primary')}>
                            {v === 'day' ? l('დღე', 'День', 'Day') : v === 'week' ? l('კვირა', 'Неделя', 'Week') : l('თვე', 'Месяц', 'Month')}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-bold text-muted opacity-60">
                    {selectedDate.toLocaleDateString(l('ka-GE', 'ru-RU', 'en-US'), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <div className="flex items-center gap-1">
                    <button onClick={onPrev} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={onToday} className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-indigo-500 hover:bg-indigo-500/10 transition-colors">
                        {l('დღეს', 'Сегодня', 'Today')}
                    </button>
                    <button onClick={onNext} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[420px]">
                {sorted.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-10 text-muted opacity-40">
                        <CalendarIcon className="w-8 h-8 mb-2" />
                        <p className="text-xs font-bold">{l('დღეს არაფერია დაგეგმილი', 'На сегодня ничего не запланировано', 'Nothing scheduled today')}</p>
                    </div>
                ) : sorted.map(item => {
                    const status = eventStatus(item, isToday, nowMinutes, l);
                    return (
                        <div key={item.id} className="flex items-start gap-3">
                            <div className="w-12 flex-shrink-0 text-right pt-1">
                                <p className="text-[11px] font-black text-primary leading-none">{item.start_time}</p>
                                <p className="text-[9px] font-bold text-muted opacity-50 leading-none mt-0.5">{item.end_time}</p>
                            </div>
                            <div className="relative flex-shrink-0 flex flex-col items-center pt-1.5">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color || '#6d28d9' }} />
                                <span className="w-px flex-1 bg-border-subtle mt-1" />
                            </div>
                            <div className="flex-1 min-w-0 bg-surface/60 border border-border-subtle rounded-xl p-2.5 hover:border-indigo-500/20 transition-colors">
                                <div className="flex items-center gap-2 mb-1">
                                    {item.type && (
                                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide"
                                            style={{ backgroundColor: `${item.color || '#6d28d9'}1a`, color: item.color || '#6d28d9' }}>
                                            {item.type}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-[10px] font-black flex-shrink-0 overflow-hidden">
                                            {item.teacherPhoto ? <img src={item.teacherPhoto} className="w-full h-full object-cover" alt="" /> : (item.teacherName || item.title)[0]}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-primary truncate">{item.title}</p>
                                            <p className="text-[10px] text-muted opacity-60 truncate">{item.teacherName}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {typeof item.capacity === 'number' && item.capacity > 0 && (
                                            <span className="text-[10px] font-bold text-muted opacity-60 tabular-nums">
                                                {item.studentCount ?? 0} / {item.capacity}
                                            </span>
                                        )}
                                        <span className={cn('px-2 py-0.5 rounded-lg text-[9px] font-bold border whitespace-nowrap', status.cls)}>
                                            {status.label}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
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
            <div className="space-y-1.5">
                {actions.map((a, i) => {
                    const content = (
                        <>
                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', a.color)}>
                                <a.icon className="w-4 h-4" />
                            </div>
                            <span className="flex-1 text-xs font-bold text-primary text-left">{a.label}</span>
                            <ChevronRight className="w-4 h-4 text-muted opacity-30 flex-shrink-0" />
                        </>
                    );
                    return a.href ? (
                        <Link key={i} href={a.href} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface transition-colors">
                            {content}
                        </Link>
                    ) : (
                        <button key={i} onClick={a.onClick} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface transition-colors">
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
