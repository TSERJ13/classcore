'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
    ChevronLeft, ChevronRight,
    User, ExternalLink
} from 'lucide-react';
import { cn, getLocalISODate } from '@/lib/utils';
import { getEvents } from '@/lib/event-store';
import { getGroups } from '@/lib/group-store';
import { getTeachers } from '@/lib/teacher-store';
import { getHalls } from '@/lib/hall-store';
import type { CalendarEvent } from '@/types';
import Link from 'next/link';

interface CalendarScheduleCardProps {
    lang?: 'ka' | 'ru' | 'en';
    onSelectDate?: (date: Date) => void;
    initialDate?: Date;
}

const START_HOUR = 9;
const END_HOUR = 22;
const HOUR_HEIGHT = 52; // px per hour

function timeToMins(t: string | undefined | null) {
    if (!t || typeof t !== 'string' || !t.includes(':')) return 0;
    const [h, m] = t.split(':').map(Number);
    return Math.floor((h || 0) * 60 + (m || 0));
}

function getWeekDates(anchor: Date): Date[] {
    const dow = anchor.getDay(); // 0=Sun, 1=Mon...
    const mon = new Date(anchor);
    mon.setDate(anchor.getDate() - ((dow + 6) % 7));
    mon.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        return d;
    });
}

export function CalendarScheduleCard({ lang = 'ka', onSelectDate, initialDate }: CalendarScheduleCardProps) {
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
    const [currentDate, setCurrentDate] = useState<Date>(initialDate || new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [halls, setHalls] = useState<any[]>([]);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const now = new Date();
    const todayStr = getLocalISODate(now);
    const currentDateStr = getLocalISODate(currentDate);
    const isToday = currentDateStr === todayStr;

    // Load Events & related entities
    useEffect(() => {
        const load = () => {
            setEvents(getEvents());
            setGroups(getGroups());
            setTeachers(getTeachers());
            setHalls(getHalls());
        };
        load();
        const listener = () => load();
        window.addEventListener('cc_calendar_events_update', listener);
        window.addEventListener('cc_groups_update', listener);
        // 🛠️ FIX: getEvents()/getGroups() are already branch-scoped internally
        // (they read the active branch from localStorage at call time), but
        // this card only re-called them on calendar/group edits — switching
        // the active branch itself (BranchSwitcher -> 'cc_branch_change')
        // never triggered a reload, so this card kept showing the previous
        // branch's schedule until some unrelated edit happened to refresh it.
        window.addEventListener('cc_branch_change', listener);
        return () => {
            window.removeEventListener('cc_calendar_events_update', listener);
            window.removeEventListener('cc_groups_update', listener);
            window.removeEventListener('cc_branch_change', listener);
        };
    }, []);

    // Month & Year info for Month View
    const [monthYear, setMonthYear] = useState({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth()
    });

    useEffect(() => {
        setMonthYear({
            year: currentDate.getFullYear(),
            month: currentDate.getMonth()
        });
    }, [currentDate]);

    // Navigation handlers
    const handlePrev = () => {
        const next = new Date(currentDate);
        if (viewMode === 'day') {
            next.setDate(next.getDate() - 1);
        } else if (viewMode === 'week') {
            next.setDate(next.getDate() - 7);
        } else {
            next.setMonth(next.getMonth() - 1);
        }
        setCurrentDate(next);
        if (onSelectDate) onSelectDate(next);
    };

    const handleNext = () => {
        const next = new Date(currentDate);
        if (viewMode === 'day') {
            next.setDate(next.getDate() + 1);
        } else if (viewMode === 'week') {
            next.setDate(next.getDate() + 7);
        } else {
            next.setMonth(next.getMonth() + 1);
        }
        setCurrentDate(next);
        if (onSelectDate) onSelectDate(next);
    };

    const handleToday = () => {
        const today = new Date();
        setCurrentDate(today);
        if (onSelectDate) onSelectDate(today);
    };

    // Week days for week view
    const weekDays = useMemo(() => getWeekDates(currentDate), [currentDate]);

    // Month calendar grid days (Sunday to Saturday to match image)
    const monthGrid = useMemo(() => {
        const y = monthYear.year;
        const m = monthYear.month;
        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0);

        const startDow = firstDay.getDay(); // 0 = Sun
        const cells: { date: Date; isCurrentMonth: boolean; dayNum: number; dateStr: string }[] = [];

        // Previous month padding
        for (let i = startDow - 1; i >= 0; i--) {
            const d = new Date(y, m, -i);
            cells.push({
                date: d,
                isCurrentMonth: false,
                dayNum: d.getDate(),
                dateStr: getLocalISODate(d)
            });
        }

        // Current month days
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateObj = new Date(y, m, d);
            cells.push({
                date: dateObj,
                isCurrentMonth: true,
                dayNum: d,
                dateStr: getLocalISODate(dateObj)
            });
        }

        // Next month trailing padding to complete the 7-column grid
        const remaining = (7 - (cells.length % 7)) % 7;
        for (let i = 1; i <= remaining; i++) {
            const d = new Date(y, m + 1, i);
            cells.push({
                date: d,
                isCurrentMonth: false,
                dayNum: d.getDate(),
                dateStr: getLocalISODate(d)
            });
        }

        return cells;
    }, [monthYear]);

    // Map helpers
    const teacherMap = useMemo(() => new Map(teachers.map(t => [t.id, t.name])), [teachers]);
    const hallMap = useMemo(() => new Map(halls.map(h => [h.id, h.name])), [halls]);
    const groupMap = useMemo(() => new Map(groups.map(g => [g.id, g])), [groups]);

    // Day view events (explicit events + fallback group slots for that day)
    const dayEvents = useMemo(() => {
        const dow = (currentDate.getDay() + 6) % 7;
        const explicit = events.filter(e => e.date === currentDateStr);
        if (explicit.length > 0) return explicit;

        // Fallback to groups with slots for this dow
        return groups
            .filter(g => g.schedule_slots?.some((s: any) => s.dayOfWeek === dow))
            .map((g, idx) => {
                const slot = g.schedule_slots.find((s: any) => s.dayOfWeek === dow);
                return {
                    id: `virt-${g.id}-${idx}`,
                    group_id: g.id,
                    title: g.name,
                    start_time: slot?.startTime || '18:00',
                    end_time: slot?.endTime || '19:00',
                    color: g.color || '#6366f1',
                    teacher_id: g.teacherId,
                    hall_id: g.hall_id,
                    date: currentDateStr,
                    type: 'group_class'
                } as CalendarEvent;
            });
    }, [events, groups, currentDate, currentDateStr]);

    // Month events map for dots
    const monthEventDateSet = useMemo(() => {
        const set = new Set<string>();
        events.forEach(e => {
            if (e.date) set.add(e.date);
        });
        return set;
    }, [events]);

    // Month Names
    const monthNamesKa = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
    const monthNamesRu = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthNames = lang === 'ka' ? monthNamesKa : lang === 'ru' ? monthNamesRu : monthNamesEn;

    // Weekday Names matching image: კვი, ორშ, სამ, ოთხ, ხუთ, პარ, შაბ
    const weekDaysShortKa = ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
    const weekDaysShortRu = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const weekDaysShortEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekDaysShort = lang === 'ka' ? weekDaysShortKa : lang === 'ru' ? weekDaysShortRu : weekDaysShortEn;

    // Hours list for timeline
    const hours = useMemo(() => {
        const res = [];
        for (let h = START_HOUR; h <= END_HOUR; h++) {
            res.push(`${String(h).padStart(2, '0')}:00`);
        }
        return res;
    }, []);

    // Scroll to current time or first event in day view
    useEffect(() => {
        if (viewMode === 'day' && scrollContainerRef.current) {
            const currentHour = now.getHours();
            const targetHour = isToday && currentHour >= START_HOUR && currentHour <= END_HOUR
                ? currentHour - 1
                : 14; // default to afternoon
            const scrollPos = Math.max(0, (targetHour - START_HOUR) * HOUR_HEIGHT);
            scrollContainerRef.current.scrollTop = scrollPos;
        }
    }, [viewMode, isToday]);

    return (
        <div className="bg-card border border-border-subtle rounded-2xl overflow-hidden flex flex-col h-full min-h-[460px] shadow-xs transition-all">
            {/* ── Header: 2-tab switcher + Today button + link ── */}
            <div className="px-4 py-3.5 border-b border-border-subtle flex items-center justify-between gap-3 bg-surface/20">
                {/* Beautiful 2-tab pill switcher */}
                <div className="flex items-center gap-1 bg-surface rounded-xl border border-border-subtle p-1 shadow-2xs">
                    <button
                        onClick={() => setViewMode('day')}
                        className={cn(
                            "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                            viewMode === 'day'
                                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                                : "text-muted hover:text-primary hover:bg-surface/80"
                        )}
                    >
                        {l('დღევანდელი განრიგი', 'Расписание на день', "Today's Schedule")}
                    </button>
                    <button
                        onClick={() => setViewMode('week')}
                        className={cn(
                            "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                            viewMode === 'week'
                                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
                                : "text-muted hover:text-primary hover:bg-surface/80"
                        )}
                    >
                        {l('კვირის განრიგი', 'Расписание на неделю', 'Week Schedule')}
                    </button>
                </div>

                {/* Right controls: nav arrows + Today + external link */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                        onClick={handlePrev}
                        className="p-1.5 hover:bg-surface rounded-lg text-muted hover:text-primary transition-colors cursor-pointer"
                        title={l('წინა', 'Назад', 'Previous')}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleToday}
                        className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer",
                            isToday
                                ? "bg-surface text-primary border-border-subtle"
                                : "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 border-indigo-500/20"
                        )}
                    >
                        {l('დღეს', 'Сегодня', 'Today')}
                    </button>
                    <button
                        onClick={handleNext}
                        className="p-1.5 hover:bg-surface rounded-lg text-muted hover:text-primary transition-colors cursor-pointer"
                        title={l('შემდეგი', 'Вперед', 'Next')}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <Link
                        href="/calendar"
                        className="p-1.5 hover:bg-surface rounded-lg text-muted hover:text-indigo-400 transition-colors"
                        title={l('კალენდარში გახსნა', 'Открыть в календаре', 'Open in Calendar')}
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>


            {/* VIEW 1: DAY SCHEDULE (Google Calendar Vertical Timeline) */}
            {viewMode === 'day' && (
                <div className="flex flex-col flex-1 min-h-0">
                    {/* Day Subheader */}
                    <div className="px-5 py-2.5 bg-surface/20 border-b border-border-subtle flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-primary">
                                {currentDate.toLocaleDateString(lang === 'ka' ? 'ka-GE' : lang === 'ru' ? 'ru-RU' : 'en-US', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long'
                                })}
                            </span>
                            {isToday && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    {l('დღეს', 'Сегодня', 'Today')}
                                </span>
                            )}
                        </div>
                        <span className="text-[11px] font-semibold text-muted">
                            {dayEvents.length} {l('გაკვეთილი', 'уроков', 'classes')}
                        </span>
                    </div>

                    {/* Timeline Grid Container */}
                    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto relative min-h-[380px] max-h-[420px]">
                        <div className="relative" style={{ height: `${hours.length * HOUR_HEIGHT}px` }}>
                            {/* Hour divider lines */}
                            {hours.map((hour, idx) => (
                                <div
                                    key={hour}
                                    className="absolute left-0 right-0 flex items-start border-t border-border-subtle/50 text-[10px] text-muted font-bold"
                                    style={{ top: `${idx * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                                >
                                    <span className="w-12 text-right pr-2 select-none -translate-y-2 text-muted/60">
                                        {hour}
                                    </span>
                                    <div className="flex-1 border-l border-border-subtle/40 h-full" />
                                </div>
                            ))}

                            {/* Current time red line indicator (if today) */}
                            {isToday && (() => {
                                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                                const startMinutes = START_HOUR * 60;
                                const endMinutes = END_HOUR * 60;
                                if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
                                    const top = ((currentMinutes - startMinutes) / 60) * HOUR_HEIGHT;
                                    return (
                                        <div
                                            className="absolute left-12 right-0 z-20 flex items-center pointer-events-none"
                                            style={{ top: `${top}px` }}
                                        >
                                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.5 ring-2 ring-white dark:ring-slate-900 shadow-xs" />
                                            <div className="flex-1 h-0.5 bg-rose-500/80 shadow-xs" />
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* Event Blocks */}
                            {dayEvents.map(ev => {
                                const startM = timeToMins(ev.start_time);
                                const endM = timeToMins(ev.end_time) || startM + 60;
                                const baseStart = START_HOUR * 60;
                                const top = Math.max(0, ((startM - baseStart) / 60) * HOUR_HEIGHT);
                                const durationMins = Math.max(30, endM - startM);
                                const height = Math.max(38, (durationMins / 60) * HOUR_HEIGHT - 3);

                                const color = ev.color || '#6366f1';
                                const teacher = teacherMap.get(ev.teacher_id || '') || (groupMap.get(ev.group_id || '') as any)?.coach;
                                const hall = hallMap.get(ev.hall_id || '');

                                return (
                                    <div
                                        key={ev.id}
                                        className="absolute left-14 right-3 rounded-xl p-2 z-10 transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer border overflow-hidden flex flex-col justify-between"
                                        style={{
                                            top: `${top}px`,
                                            height: `${height}px`,
                                            backgroundColor: `${color}18`,
                                            borderColor: `${color}40`,
                                            borderLeftWidth: '4px',
                                            borderLeftColor: color
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-1 min-w-0">
                                            <p className="text-xs font-bold text-primary truncate leading-tight">
                                                {ev.title || l('გაკვეთილი', 'Урок', 'Class')}
                                            </p>
                                            <span className="text-[10px] font-bold tabular-nums text-muted flex-shrink-0">
                                                {ev.start_time} - {ev.end_time}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted truncate">
                                            {teacher && (
                                                <span className="truncate flex items-center gap-0.5">
                                                    <User className="w-2.5 h-2.5 text-muted/70" />
                                                    {teacher}
                                                </span>
                                            )}
                                            {hall && (
                                                <span className="truncate flex items-center gap-0.5 text-indigo-500 font-semibold">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/50" />
                                                    {hall}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW 2: WEEK SCHEDULE (Google Calendar 7-Column Time Grid) */}
            {viewMode === 'week' && (
                <div className="flex flex-col flex-1 min-h-0">
                    {/* Week Days Header Row */}
                    <div className="grid grid-cols-7 border-b border-border-subtle bg-surface/30 pl-12 text-center text-xs">
                        {weekDays.map((date, idx) => {
                            const dStr = getLocalISODate(date);
                            const isTodayCol = dStr === todayStr;
                            const isSelectedCol = dStr === currentDateStr;
                            const dayNum = date.getDate();
                            const dowShort = weekDaysShort[(date.getDay()) % 7];

                            return (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setCurrentDate(date);
                                        if (onSelectDate) onSelectDate(date);
                                    }}
                                    className={cn(
                                        "py-2 flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer border-l border-border-subtle/50",
                                        isSelectedCol ? "bg-indigo-500/5" : "hover:bg-surface/60"
                                    )}
                                >
                                    <span className={cn(
                                        "text-[10px] font-bold uppercase",
                                        isTodayCol ? "text-indigo-500" : "text-muted"
                                    )}>
                                        {dowShort}
                                    </span>
                                    <span className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs",
                                        isTodayCol ? "bg-indigo-600 text-white shadow-xs" : isSelectedCol ? "bg-surface border border-indigo-500/40 text-primary" : "text-primary"
                                    )}>
                                        {dayNum}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Scrollable Week Grid */}
                    <div className="flex-1 overflow-y-auto relative min-h-[380px] max-h-[420px]">
                        <div className="relative" style={{ height: `${hours.length * HOUR_HEIGHT}px` }}>
                            {/* Time rows */}
                            {hours.map((hour, idx) => (
                                <div
                                    key={hour}
                                    className="absolute left-0 right-0 flex items-start border-t border-border-subtle/40 text-[9px] text-muted font-bold"
                                    style={{ top: `${idx * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                                >
                                    <span className="w-12 text-right pr-2 select-none -translate-y-2 text-muted/60">
                                        {hour}
                                    </span>
                                    <div className="flex-1 grid grid-cols-7 h-full">
                                        {Array.from({ length: 7 }).map((_, cIdx) => (
                                            <div key={cIdx} className="border-l border-border-subtle/30 h-full" />
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* Events per day */}
                            {weekDays.map((colDate, colIdx) => {
                                const colDateStr = getLocalISODate(colDate);
                                const dow = (colDate.getDay() + 6) % 7;
                                let colEvents = events.filter(e => e.date === colDateStr);
                                if (!colEvents.length) {
                                    colEvents = groups
                                        .filter(g => g.schedule_slots?.some((s: any) => s.dayOfWeek === dow))
                                        .map((g, idx) => {
                                            const slot = g.schedule_slots.find((s: any) => s.dayOfWeek === dow);
                                            return {
                                                id: `virt-w-${g.id}-${idx}`,
                                                group_id: g.id,
                                                title: g.name,
                                                start_time: slot?.startTime || '18:00',
                                                end_time: slot?.endTime || '19:00',
                                                color: g.color || '#6366f1',
                                                date: colDateStr
                                            } as CalendarEvent;
                                        });
                                }

                                return colEvents.map(ev => {
                                    const startM = timeToMins(ev.start_time);
                                    const endM = timeToMins(ev.end_time) || startM + 60;
                                    const baseStart = START_HOUR * 60;
                                    const top = Math.max(0, ((startM - baseStart) / 60) * HOUR_HEIGHT);
                                    const durationMins = Math.max(25, endM - startM);
                                    const height = Math.max(28, (durationMins / 60) * HOUR_HEIGHT - 2);

                                    // column width in percentage
                                    const leftPct = (colIdx / 7) * 100;
                                    const widthPct = (1 / 7) * 100;
                                    const color = ev.color || '#6366f1';

                                    return (
                                        <div
                                            key={ev.id}
                                            onClick={() => {
                                                setCurrentDate(colDate);
                                                setViewMode('day');
                                            }}
                                            className="absolute rounded-md p-1 text-[9px] z-10 transition-all hover:scale-105 cursor-pointer border overflow-hidden shadow-2xs leading-tight"
                                            style={{
                                                top: `${top}px`,
                                                height: `${height}px`,
                                                left: `calc(48px + ${leftPct}% + 2px)`,
                                                width: `calc(${widthPct}% - 4px)`,
                                                backgroundColor: `${color}25`,
                                                borderColor: `${color}60`,
                                                borderLeftWidth: '3px',
                                                borderLeftColor: color
                                            }}
                                            title={`${ev.title} (${ev.start_time} - ${ev.end_time})`}
                                        >
                                            <p className="font-bold text-primary truncate">{ev.title}</p>
                                            <p className="text-[8px] text-muted truncate">{ev.start_time}</p>
                                        </div>
                                    );
                                });
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW 3: MONTH SCHEDULE (Google Calendar Month Grid matching screenshot!) */}
            {viewMode === 'month' && (
                <div className="flex flex-col flex-1 p-4 sm:p-5 justify-between">
                    {/* Month Navigation Title: < აგვისტო 2026 > */}
                    <div className="flex items-center justify-between mb-4 px-2">
                        <button
                            onClick={() => {
                                setMonthYear(prev => {
                                    if (prev.month === 0) return { year: prev.year - 1, month: 11 };
                                    return { year: prev.year, month: prev.month - 1 };
                                });
                            }}
                            className="p-1 hover:bg-surface rounded-lg text-muted hover:text-primary transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <h3 className="text-sm sm:text-base font-bold text-primary tracking-tight">
                            {monthNames[monthYear.month]} {monthYear.year}
                        </h3>

                        <button
                            onClick={() => {
                                setMonthYear(prev => {
                                    if (prev.month === 11) return { year: prev.year + 1, month: 0 };
                                    return { year: prev.year, month: prev.month + 1 };
                                });
                            }}
                            className="p-1 hover:bg-surface rounded-lg text-muted hover:text-primary transition-colors cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Weekday Names Row: კვი  ორშ  სამ  ოთხ  ხუთ  პარ  შაბ */}
                    <div className="grid grid-cols-7 text-center mb-3">
                        {weekDaysShort.map((day, idx) => (
                            <span key={idx} className="text-xs font-bold text-muted/70 select-none">
                                {day}
                            </span>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-y-2.5 sm:gap-y-3.5 text-center items-center">
                        {monthGrid.map((cell, idx) => {
                            const isCellToday = cell.dateStr === todayStr;
                            const isCellSelected = cell.dateStr === currentDateStr;
                            const hasEvents = monthEventDateSet.has(cell.dateStr);

                            return (
                                <div key={idx} className="flex flex-col items-center justify-center">
                                    <button
                                        onClick={() => {
                                            setCurrentDate(cell.date);
                                            if (onSelectDate) onSelectDate(cell.date);
                                        }}
                                        className={cn(
                                            "w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all cursor-pointer relative",
                                            !cell.isCurrentMonth && "text-muted/25 opacity-40",
                                            cell.isCurrentMonth && !isCellToday && !isCellSelected && "text-primary hover:bg-surface",
                                            isCellToday && "bg-indigo-600 text-white shadow-md shadow-indigo-500/25 ring-2 ring-indigo-400/30",
                                            isCellSelected && !isCellToday && "bg-surface border-2 border-indigo-500 text-primary shadow-xs"
                                        )}
                                    >
                                        {cell.dayNum}
                                        {/* Event dot indicator */}
                                        {hasEvents && !isCellToday && (
                                            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-500" />
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Selected Day Preview Banner in Month View */}
                    <div className="mt-4 pt-3 border-t border-border-subtle/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate">
                            <span className="font-bold text-primary">
                                {currentDate.toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US', { month: 'short', day: 'numeric' })}:
                            </span>
                            <span className="text-muted truncate">
                                {dayEvents.length > 0
                                    ? `${dayEvents.length} ${l('გაკვეთილი ჩანიშნულია', 'уроков запланировано', 'classes scheduled')}`
                                    : l('გაკვეთილები არ არის', 'Нет занятий', 'No classes')}
                            </span>
                        </div>
                        <button
                            onClick={() => setViewMode('day')}
                            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5 cursor-pointer"
                        >
                            <span>{l('განრიგის ნახვა', 'Посмотреть день', 'View day')}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
