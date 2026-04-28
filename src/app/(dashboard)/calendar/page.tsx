'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@/hooks/useUser';
import {
    ChevronLeft, ChevronRight,
    CalendarPlus,
    Download,
    X,
    FileSpreadsheet, FileText, CalendarDays, LayoutGrid, Calendar,
    Clock, DoorOpen, UserCheck, BookOpen, Link, RefreshCw
} from 'lucide-react';
import { cn, getLocalISODate } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';
import type { CalendarEvent, EventType } from '@/types';
import { getEvents, addEvent as addEventToStore, deleteEvent as deleteEventFromStore, updateEvent as updateEventInStore, saveEvents, syncGroupScheduleToCalendar } from '@/lib/event-store';
import { getTeachers } from '@/lib/teacher-store';
import { getHalls } from '@/lib/hall-store';
import { useStudio } from '@/contexts/StudioContext';
import { getGroups, addSlotToGroup, removeSlotFromGroup, createGroup, saveGroups, type Group } from '@/lib/group-store';
import { saveSubscription } from '@/lib/subscription-store';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { generateTimeOptions, generateDayOptions, generateMonthOptions, generateYearOptions } from '@/lib/date-utils';
import { StandardDatePicker } from '@/components/ui/StandardDatePicker';

/* ─── Constants ──────────────────────────────────────────────── */
const PALETTES = [
    { name: 'Indigo / Purple', colors: ['#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7e22ce', '#6b21a8'] },
    { name: 'Pink / Rose', colors: ['#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d', '#9d174d', '#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239'] },
    { name: 'Blue / Cyan', colors: ['#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75'] },
    { name: 'Emerald / Green', colors: ['#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534'] },
    { name: 'Amber / Orange', colors: ['#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412'] },
];
// Teachers are passed down / accessed via store.
// Halls are loaded dynamically from hall-store.

function EVENT_TYPES(t: ReturnType<typeof useT>['t']) {
    return [
        { value: 'group_class' as EventType, label: t.calGroupClass },
        { value: 'individual' as EventType, label: t.calIndividual },
        { value: 'rental' as EventType, label: t.calRental },
        { value: 'other' as EventType, label: t.calOther },
    ];
}

const START_HOUR = 8;
const END_HOUR = 23;

const TIME_SLOTS = Array.from({ length: (END_HOUR - START_HOUR + 1) * 4 }, (_, i) => {
    const totalMins = START_HOUR * 60 + i * 15;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}); // 10:00-23:00 in 15m steps

/* ─── Helpers ────────────────────────────────────────────────── */

function toDateStr(d: Date) {
    return getLocalISODate(d);
}

function getWeekDates(anchor: Date): Date[] {
    const dow = anchor.getDay(); // 0=Sun
    const mon = new Date(anchor);
    mon.setDate(anchor.getDate() - ((dow + 6) % 7)); // start Mon
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        return d;
    });
}

function getDaysInMonth(year: number, month: number): Date[] {
    const days: Date[] = [];
    const d = new Date(year, month, 1);
    while (d.getMonth() === month) {
        days.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }
    return days;
}

/** Check if a hall is occupied. 
 * Group/Rental cannot share with anything.
 * Individuals can share with other individuals.
 */
function checkConflicts(allEvents: CalendarEvent[], newEv: Partial<CalendarEvent>): string | null {
    const start = timeToMins(newEv.start_time || '00:00');
    const end = timeToMins(newEv.end_time || '00:00');

    const overlapping = allEvents.filter(e => {
        if (e.date !== newEv.date || e.hall_id !== newEv.hall_id) return false;
        if (e.id === newEv.id) return false; // ignore self when editing

        const eStart = timeToMins(e.start_time);
        const eEnd = timeToMins(e.end_time);
        return (start < eEnd && end > eStart);
    });

    if (!overlapping.length) return null;

    // If new event is Individual
    if (newEv.type === 'individual') {
        const hasBlocking = overlapping.some(e => e.type === 'group_class' || e.type === 'rental');
        if (hasBlocking) return 'დარბაზი დაკავებულია ჯგუფური გაკვეთილით ან იჯარით.';
        return null; // Can share with other individuals
    }

    // If new event is Group/Rental/Other
    if (overlapping.length > 0) {
        return 'დარბაზი უკვე დაკავებულია ამ დროს.';
    }

    return null;
}

function timeToMins(t: string | undefined | null) {
    if (!t || typeof t !== 'string' || !t.includes(':')) return 0;
    const [h, m] = t.split(':').map(Number);
    return Math.floor(h * 60 + m);
}

function colorBg(hex: string) { return hex + '15'; }

/** Processes events within a day to group overlaps into columns */
function getProcessedEvents(evs: CalendarEvent[]) {
    // Guard: filter out events with missing or malformed time data
    const validEvs = evs.filter(e =>
        e && typeof e.start_time === 'string' && e.start_time.includes(':') &&
        typeof e.end_time === 'string' && e.end_time.includes(':')
    );
    if (!validEvs.length) return [];

    // Sort by start time, then duration
    const sorted = [...validEvs].sort((a, b) => {
        const aStart = timeToMins(a.start_time);
        const bStart = timeToMins(b.start_time);
        if (aStart !== bStart) return aStart - bStart;
        return (timeToMins(b.end_time) - timeToMins(b.start_time)) - (timeToMins(a.end_time) - timeToMins(a.start_time));
    });

    const columns: CalendarEvent[][] = [];
    sorted.forEach(ev => {
        let placed = false;
        const evStart = timeToMins(ev.start_time);
        for (const col of columns) {
            const lastEv = col[col.length - 1];
            if (timeToMins(lastEv.end_time) <= evStart) {
                col.push(ev);
                placed = true;
                break;
            }
        }
        if (!placed) columns.push([ev]);
    });

    return sorted.map(ev => {
        let colIdx = 0;
        columns.forEach((col, idx) => {
            if (col.includes(ev)) colIdx = idx;
        });
        return {
            ev,
            colIdx,
            totalCols: columns.length
        };
    });
}

/* ─── Drag state ────────────────────────────────────────────── */
interface DragInfo {
    ev: CalendarEvent;
    startMouseY: number;
    startMouseX: number;
    evOffsetY: number; // px from top of chip where user grabbed
    chipHeight: number;
    chipWidth: number;
}

/* ─── DragConfirmModal ───────────────────────────────────────── */
function DragConfirmModal({ ev, newDate, newStart, newEnd, onThisOnly, onAllOccurrences, onCancel }: {
    ev: CalendarEvent;
    newDate: string;
    newStart: string;
    newEnd: string;
    onThisOnly: () => void;
    onAllOccurrences: () => void;
    onCancel: () => void;
}) {
    const dayNames = ['კვ', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
    const fullDayNames = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
    const newDayOfWeek = new Date(newDate + 'T00:00:00').getDay();
    const oldDayOfWeek = new Date(ev.date + 'T00:00:00').getDay();
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onCancel}>
            <div className="fixed inset-0 bg-black/20" />
            <div className="relative z-10 w-full max-w-sm bg-card border border-border-subtle rounded-2xl shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#6d28d9]/10 flex items-center justify-center flex-shrink-0">
                        <CalendarDays className="w-5 h-5 text-[#6d28d9]" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-primary">{ev.title}</p>
                        <p className="text-[11px] text-muted opacity-60">{newDate} · {newStart}–{newEnd}</p>
                    </div>
                </div>
                <p className="text-xs text-muted font-medium opacity-70">ეს არის განმეორებადი გაკვეთილი. როგორ გსურთ გადატანა?</p>
                <div className="space-y-2">
                    <button onClick={onThisOnly}
                        className="w-full py-3 px-4 text-left text-sm font-bold text-primary bg-surface border border-border-subtle hover:border-[#6d28d9]/40 hover:bg-[#6d28d9]/5 rounded-xl transition-all flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-[#6d28d9]/10 flex items-center justify-center text-[#6d28d9] flex-shrink-0 text-xs font-black">1</span>
                        <div>
                            <p>მხოლოდ ეს გაკვეთილი</p>
                            <p className="text-[10px] font-medium text-muted opacity-50">{ev.date} → {newDate}</p>
                        </div>
                    </button>
                    <button onClick={onAllOccurrences}
                        className="w-full py-3 px-4 text-left text-sm font-bold text-primary bg-surface border border-border-subtle hover:border-amber-500/40 hover:bg-amber-500/5 rounded-xl transition-all flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 flex-shrink-0 text-xs font-black">∞</span>
                        <div>
                            {(() => {
                                const dayName = fullDayNames[oldDayOfWeek];
                                const suffixedDay = dayName.endsWith('ი') ? dayName.slice(0, -1) + 'ს' : dayName + 'ს';
                                return (
                                    <>
                                        <p>ყოველ {suffixedDay} → {newStart}</p>
                                        <p className="text-[10px] font-medium text-muted opacity-50">ყველა {suffixedDay} {ev.start_time} → {newStart}</p>
                                    </>
                                );
                            })()}
                        </div>
                    </button>
                </div>
                <button onClick={onCancel} className="w-full text-center text-xs text-muted hover:text-primary transition-colors">გაუქმება</button>
            </div>
        </div>
    );
}

/* ─── GridLines internal helper ────────────────────────────────── */
function GridLines({ onClick }: { onClick: (e: React.MouseEvent<HTMLDivElement>) => void }) {
    return (
        <div className="absolute inset-0 cursor-pointer group" onClick={onClick}>
            {TIME_SLOTS.map((slot, i) => (
                <div key={slot}
                    className={cn(
                        "h-[18px] w-full border-t box-border pointer-events-none",
                        slot.endsWith(':00')
                            ? "border-black/40 border-solid"
                            : slot.endsWith(':30')
                                ? "border-black/25 border-dashed"
                                : "border-border-subtle/15 border-solid"
                    )} />
            ))}
            <div className="absolute inset-0 bg-[#6d28d9]/[0.00] group-hover:bg-[#6d28d9]/[0.02] transition-colors pointer-events-none" />
            {/* Final bottom line */}
            <div className="absolute bottom-0 left-0 right-0 border-t border-black/40 pointer-events-none" />
        </div>
    );
}

/* ─── EventChip component ────────────────────────────────────── */

function EventChip({ ev, onClick, onMouseDown, onTouchStart, teachers, halls, groups = [], compact = false, style, className, canEdit }: {
    ev: CalendarEvent;
    onClick: () => void;
    onMouseDown?: (e: React.MouseEvent) => void;
    onTouchStart?: (e: React.TouchEvent) => void;
    teachers: any[];
    halls: any[];
    groups?: Group[];
    compact?: boolean;
    style?: React.CSSProperties;
    className?: string;
    canEdit?: boolean;
}) {
    const hall = halls.find((h: any) => h.id === ev.hall_id);
    const tid = ev.teacher_id || (ev as any).teacherId;
    const teacher = teachers.find(t => t.id === tid);
    const group = ev.group_id ? groups.find(g => g.id === ev.group_id) : null;

    // Highest priority: Custom Event Color -> Group Color -> Hall Color
    const color = ev.color || group?.color || (hall?.color ?? '#6366f1');

    return (
        <button
            onClick={e => { e.stopPropagation(); onClick(); }}
            onMouseDown={onMouseDown}
            title={`${ev.title}${teacher ? ` — ${teacher.full_name}` : ''}`}
            className={cn(
                "w-full h-full text-left rounded-lg overflow-hidden transition-all group shadow-sm border border-black/5 relative p-0",
                canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-default",
                style ? "absolute z-10" : "min-h-[24px] mb-0.5",
                className
            )}
            style={style}>

            {/* Pure Solid background */}
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: color }} />

            {/* Dark/Pure solid left border */}
            <div className="absolute left-0 top-0 bottom-0 w-1 pointer-events-none" style={{ backgroundColor: color }} />

            {/* Content properly positioned above backgrounds */}
            <div className="relative z-10 flex h-full w-full items-center gap-1.5 overflow-hidden px-2 py-1">
                <div className="flex flex-col flex-1 min-w-0 h-full justify-center overflow-hidden">
                    <span className={cn("truncate font-black leading-tight text-white", compact ? "text-[8px]" : "text-[11px] sm:text-[12px]")}>
                        {ev.title}
                    </span>
                    {teacher && !compact && (
                        <span className="text-[10px] font-bold text-white/70 truncate leading-none mt-1">
                            {teacher.full_name}
                        </span>
                    )}
                </div>

                {teacher && (
                    <div className={cn(
                        "flex-shrink-0 overflow-hidden rounded-full border border-white/20 shadow-sm bg-white/30 transition-all",
                        compact ? "w-4 h-4" : "w-6 h-6 sm:w-7 sm:h-7"
                    )}>
                        {teacher.photo_url ? (
                            <img src={teacher.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <UserCheck className={cn("opacity-60", compact ? "w-2 h-2" : "w-3 h-3 sm:w-4 sm:h-4")} style={{ color: color }} />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </button>
    );
}

/* ─── Event Detail + Edit Popup ─────────────────────────────── */

function EventPopup({ ev, onClose, onDelete, onDeleteAll, onUpdate, onUpdateSeries, teachers, halls, groups, canEdit }: {
    ev: CalendarEvent;
    onClose: () => void;
    onDelete: () => void;
    onDeleteAll: () => void;
    onUpdate: (updated: CalendarEvent) => void;
    onUpdateSeries?: (updated: CalendarEvent, recurringDays: Record<number, { active: boolean; start: string; end: string }>) => void;
    teachers: any[];
    halls: any[];
    groups: Group[];
    canEdit: boolean;
}) {
    const hall = halls.find((h: any) => h.id === ev.hall_id);
    const teacher = teachers.find(t => t.id === ev.teacher_id);
    const color = hall?.color ?? '#6366f1';
    const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');
    const [form, setForm] = useState({ ...ev });
    const { t } = useT();
    const eventTypes = EVENT_TYPES(t);
    const setF = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

    const [selectedColor, setSelectedColor] = useState<string>(ev.color || color);

    const { lang } = useT();
    const timeOptions = generateTimeOptions(15);
    const dayOptions = generateDayOptions();
    const monthOptions = generateMonthOptions(lang);
    const yearOptions = generateYearOptions(new Date().getFullYear() - 1, new Date().getFullYear() + 2);

    const [dateParts, setDateParts] = useState({ day: '', month: '', year: '' });
    useEffect(() => {
        if (form.date) {
            const [y, m, d] = form.date.split('-');
            setDateParts({ year: y || '', month: m || '', day: d || '' });
        }
    }, [form.date]);

    const updateDateFromParts = (parts: { day: string, month: string, year: string }) => {
        if (parts.day && parts.month && parts.year) {
            setF('date', `${parts.year}-${parts.month}-${parts.day}`);
        }
    };

    const group = groups.find(g => g.id === ev.group_id);

    // Auto-update color if group changes in edit mode
    useEffect(() => {
        if (form.group_id) {
            const g = groups.find(g => g.id === form.group_id);
            if (g?.color) setSelectedColor(g.color);
        }
    }, [form.group_id, groups]);

    // Track days for recurring weekly
    const [recurringDays, setRecurringDays] = useState<Record<number, { active: boolean; start: string; end: string }>>(() => {
        const days: Record<number, { active: boolean; start: string; end: string }> = {
            1: { active: false, start: ev.start_time, end: ev.end_time },
            2: { active: false, start: ev.start_time, end: ev.end_time },
            3: { active: false, start: ev.start_time, end: ev.end_time },
            4: { active: false, start: ev.start_time, end: ev.end_time },
            5: { active: false, start: ev.start_time, end: ev.end_time },
            6: { active: false, start: ev.start_time, end: ev.end_time },
            0: { active: false, start: ev.start_time, end: ev.end_time },
        };
        if (ev.recurring === 'weekly') {
            if (group?.schedule_slots) {
                group.schedule_slots.forEach(slot => {
                    // GroupModal uses 0=Mon... 6=Sun. JS uses 0=Sun, 1=Mon...
                    const jsDay = slot.dayOfWeek === 6 ? 0 : slot.dayOfWeek + 1;
                    days[jsDay] = { active: true, start: slot.startTime, end: slot.endTime };
                });
            } else {
                const jsDay = new Date(ev.date).getDay();
                days[jsDay] = { active: true, start: ev.start_time, end: ev.end_time };
            }
        }
        return days;
    });

    const toggleDay = (d: number) => {
        setRecurringDays(prev => ({ ...prev, [d]: { ...prev[d], active: !prev[d].active } }));
    };
    const setDayTime = (d: number, field: 'start' | 'end', val: string) => {
        setRecurringDays(prev => {
            const updated = { ...prev[d], [field]: val };
            if (field === 'start') {
                const [h, m] = val.split(':').map(Number);
                const endH = (h + 1) % 24;
                updated.end = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }
            return { ...prev, [d]: updated };
        });
    };

    if (mode === 'edit') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
                <div className="fixed inset-0 bg-black/20" />
                <div className="relative z-10 w-full max-w-sm bg-card border border-border-subtle rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                        <h2 className="text-sm font-bold text-primary">{t.calEventEdit}</h2>
                        <button onClick={onClose} className="text-muted hover:text-primary"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
                        <input value={form.title} onChange={e => setF('title', e.target.value)} placeholder="სათაური *"
                            className="w-full bg-surface border border-border-subtle focus:border-[#6d28d9]/60 rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/50 outline-none" />

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.calEventType}</label>
                                <SearchSelect
                                    options={eventTypes}
                                    value={form.type}
                                    onChange={val => setF('type', val)}
                                    className="!border-border-subtle hover:!border-[#6d28d9]/40 shadow-sm [&>div]:py-2.5 [&>div]:px-3 [&>div]:text-xs"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.calRecurring}</label>
                                <SearchSelect
                                    options={[
                                        { value: 'none', label: t.calOneTime },
                                        { value: 'weekly', label: t.calEveryWeek }
                                    ]}
                                    value={form.recurring || 'none'}
                                    onChange={val => setF('recurring', val)}
                                    className="!border-border-subtle hover:!border-[#6d28d9]/40 shadow-sm [&>div]:py-2.5 [&>div]:px-3 [&>div]:text-xs"
                                />
                            </div>
                        </div>

                        {form.type === 'group_class' && groups.length > 0 && (
                            <div>
                                <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.calGroup}</label>
                                <SearchSelect
                                    options={[
                                        { value: '', label: t.calGroupOptional },
                                        ...groups.map(g => ({ value: g.id, label: g.name }))
                                    ]}
                                    value={form.group_id || ''}
                                    onChange={val => {
                                        setF('group_id', val);
                                        const g = groups.find(gr => gr.id === val);
                                        if (g?.teacherId) setF('teacher_id', g.teacherId);
                                    }}
                                    className="!border-[#6d28d9]/30 hover:!border-[#6d28d9]/60 shadow-sm [&>div]:py-2.5 [&>div]:px-3 [&>div]:text-xs"
                                />
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.calHall}</label>
                            <SearchSelect
                                options={halls.map((h: any) => ({ value: h.id, label: h.name }))}
                                value={form.hall_id || ''}
                                onChange={val => setF('hall_id', val)}
                                className="!border-border-subtle hover:!border-[#6d28d9]/40 shadow-sm [&>div]:py-2.5 [&>div]:px-3 [&>div]:text-xs"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.calTeacher}</label>
                            <SearchSelect
                                options={teachers.map(tc => ({ value: tc.id, label: tc.full_name }))}
                                value={form.teacher_id || ''}
                                onChange={val => setF('teacher_id', val)}
                                className="!border-border-subtle hover:!border-[#6d28d9]/40 shadow-sm [&>div]:py-2.5 [&>div]:px-3 [&>div]:text-xs"
                            />
                        </div>

                        {form.recurring !== 'weekly' && (
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.calDate}</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <SearchSelect 
                                            options={dayOptions}
                                            value={dateParts.day}
                                            onChange={val => {
                                                const p = { ...dateParts, day: val };
                                                setDateParts(p);
                                                updateDateFromParts(p);
                                            }}
                                            placeholder="დღე"
                                        />
                                        <SearchSelect 
                                            options={monthOptions}
                                            value={dateParts.month}
                                            onChange={val => {
                                                const p = { ...dateParts, month: val };
                                                setDateParts(p);
                                                updateDateFromParts(p);
                                            }}
                                            placeholder="თვე"
                                        />
                                        <SearchSelect 
                                            options={yearOptions}
                                            value={dateParts.year}
                                            onChange={val => {
                                                const p = { ...dateParts, year: val };
                                                setDateParts(p);
                                                updateDateFromParts(p);
                                            }}
                                            placeholder="წელი"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.calStartTime}</label>
                                        <SearchSelect 
                                            options={timeOptions}
                                            value={form.start_time}
                                            onChange={val => setF('start_time', val)}
                                            placeholder="09:00"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.calEndTime}</label>
                                        <SearchSelect 
                                            options={timeOptions}
                                            value={form.end_time}
                                            onChange={val => setF('end_time', val)}
                                            placeholder="10:30"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between p-3 bg-[#6d28d9]/5 border border-[#6d28d9]/20 rounded-xl cursor-pointer" onClick={() => setF('reminder_30m', !form.reminder_30m)}>
                            <div className="flex items-center gap-3">
                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", form.reminder_30m ? "bg-[#6d28d9] text-white" : "bg-card text-muted opacity-40")}>
                                    <Clock className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-primary opacity-80">{t.reminder30m}</span>
                            </div>
                            <div className={cn("w-10 h-5 rounded-full p-1 transition-colors relative", form.reminder_30m ? "bg-[#6d28d9]" : "bg-muted/30")}>
                                <div className={cn("w-3 h-3 bg-white rounded-full transition-all shadow-sm", form.reminder_30m ? "translate-x-5" : "translate-x-0")} />
                            </div>
                        </div>

                        {form.recurring === 'weekly' && (
                            <div className="bg-surface/50 border border-border-subtle rounded-2xl p-4 space-y-4">
                                <label className="text-[10px] text-muted block tracking-wider font-black opacity-40">აირჩიეთ დღეები და დროები</label>
                                <div className="flex flex-wrap gap-2">
                                    {[1, 2, 3, 4, 5, 6, 0].map(d => {
                                        const dayNames = ['კვ', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
                                        const isActive = recurringDays[d].active;
                                        return (
                                            <button key={d} onClick={() => toggleDay(d)}
                                                className={cn(
                                                    "w-10 h-10 rounded-xl text-[10px] font-black transition-all border",
                                                    isActive ? "bg-[#6d28d9] border-[#6d28d9] text-white shadow-lg shadow-[#6d28d9]/20" : "bg-card border-border-subtle text-muted hover:border-[#6d28d9]/40"
                                                )}>
                                                {dayNames[d]}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="space-y-2">
                                    {[1, 2, 3, 4, 5, 6, 0].filter(d => recurringDays[d].active).map((d) => {
                                        const dayFullNames = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
                                        return (
                                            <div key={d} className="flex items-center gap-3 bg-card p-2 rounded-xl border border-border-subtle/30">
                                                <span className="text-[10px] font-bold text-primary w-20">{dayFullNames[d]}</span>
                                                <div className="flex-1 flex gap-2">
                                                    <SearchSelect 
                                                        options={timeOptions}
                                                        value={recurringDays[d].start}
                                                        onChange={val => setDayTime(d, 'start', val)}
                                                        className="!border-none [&>div]:py-1 [&>div]:px-2 [&>div]:text-[10px] [&>div]:min-h-[28px]"
                                                    />
                                                    <SearchSelect 
                                                        options={timeOptions}
                                                        value={recurringDays[d].end}
                                                        onChange={val => setDayTime(d, 'end', val)}
                                                        className="!border-none [&>div]:py-1 [&>div]:px-2 [&>div]:text-[10px] [&>div]:min-h-[28px]"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] text-muted mb-2 block tracking-wider font-bold opacity-70">{t.selectColor}</label>
                            <label className="flex items-center gap-3 bg-surface border border-border-subtle rounded-xl p-2 cursor-pointer hover:border-[#6d28d9]/40 transition-colors">
                                <span className="w-8 h-8 rounded-lg shadow-sm border border-black/10 flex-shrink-0 overflow-hidden relative">
                                    <input type="color" value={selectedColor} onChange={e => setSelectedColor(e.target.value)}
                                        className="absolute -inset-2 w-12 h-12 cursor-pointer opacity-0" />
                                    <div className="w-full h-full pointer-events-none" style={{ backgroundColor: selectedColor }} />
                                </span>
                                <span className="text-xs text-muted font-medium select-none truncate">{t.chooseAnotherColor}</span>
                            </label>
                        </div>

                        <textarea value={form.notes || ''} onChange={e => setF('notes', e.target.value)} rows={2} placeholder={t.calNotes}
                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2 text-xs text-primary placeholder:text-muted/40 outline-none resize-none" />
                    </div>
                    <div className="px-5 py-4 border-t border-border-subtle flex gap-2">
                        <button onClick={() => setMode('view')} className="flex-1 py-2.5 border border-border-subtle text-muted hover:text-primary hover:bg-surface text-sm rounded-xl transition-all">{t.calCancel}</button>
                        <button onClick={() => {
                            const updatedForm = { ...form, color: selectedColor };
                            if (form.recurring === 'weekly' && onUpdateSeries) {
                                onUpdateSeries(updatedForm, recurringDays);
                            } else {
                                onUpdate(updatedForm);
                            }
                            onClose();
                        }} disabled={!form.title.trim()}
                            className="flex-1 py-2.5 bg-[#6d28d9] hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-bold rounded-xl shadow-lg shadow-[#6d28d9]/20 active:scale-95 transition-all">
                            {t.calSave}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (mode === 'delete') {
        const isGroupEvent = !!ev.group_id;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
                <div className="fixed inset-0 bg-black/20" />
                <div className="relative z-10 w-full max-w-xs bg-card border border-border-subtle rounded-2xl shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                            <X className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-primary">{t.calDeleteTitle}</p>
                            <p className="text-[11px] text-muted opacity-60 mt-0.5">{ev.title}</p>
                        </div>
                    </div>

                    {isGroupEvent ? (
                        <div className="space-y-2">
                            <p className="text-xs text-muted font-medium opacity-70">რომელი გინდა წაშლა?</p>
                            <button onClick={onDelete}
                                className="w-full py-3 px-4 text-left text-sm font-bold text-primary bg-surface border border-border-subtle hover:border-amber-500/40 hover:bg-amber-500/5 rounded-xl transition-all flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 flex-shrink-0">1</span>
                                <div>
                                    <p>{t.calDeleteOnly}</p>
                                    <p className="text-[10px] font-medium text-muted opacity-50">{ev.date} · {ev.start_time}–{ev.end_time}</p>
                                </div>
                            </button>
                            <button onClick={onDeleteAll}
                                className="w-full py-3 px-4 text-left text-sm font-bold text-red-600 bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 rounded-xl transition-all flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 flex-shrink-0">∞</span>
                                <div>
                                    <p>{t.calDeleteAll}</p>
                                    <p className="text-[10px] font-medium text-red-400/70">{t.calDeleteAllDesc.replace('{start}', ev.start_time).replace('{end}', ev.end_time)}</p>
                                </div>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-muted font-medium opacity-70">{t.calDeleteConfirm}</p>
                            <div className="flex gap-2">
                                <button onClick={() => setMode('view')} className="flex-1 py-2.5 border border-border-subtle text-muted hover:bg-surface text-sm rounded-xl transition-all">{t.calCancel}</button>
                                <button onClick={onDelete} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-500/20 active:scale-95 transition-all">{t.calDelete}</button>
                            </div>
                        </div>
                    )}

                    <button onClick={() => setMode('view')} className="w-full text-center text-xs text-muted hover:text-primary transition-colors">{t.calBackLink}</button>
                </div>
            </div>
        );
    }

    // View mode
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="fixed inset-0 bg-black/20" />
            <div className="relative z-10 w-full max-w-xs bg-card border border-border-subtle rounded-2xl shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
                {/* Title + close */}
                <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1">
                        <p className="text-sm font-bold text-primary">{ev.title}</p>
                        <p className="text-[10px] text-muted mt-0.5">
                            {eventTypes.find(et => et.value === ev.type)?.label}
                            {ev.recurring === 'weekly' && t.calEveryWeekLabel}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-muted hover:text-primary transition-colors"><X className="w-4 h-4" /></button>
                </div>

                <div className="space-y-2.5 text-xs text-muted">
                    <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 opacity-40" />{ev.date} · {ev.start_time} – {ev.end_time}</div>
                    {hall && <div className="flex items-center gap-2"><DoorOpen className="w-3.5 h-3.5" style={{ color }} /><span style={{ color }}>{hall.name}</span></div>}
                    {teacher && (
                        <div className="flex items-center gap-2">
                            {teacher.photo_url ? (
                                <img src={teacher.photo_url} alt="" className="w-10 h-10 object-cover rounded-full border border-border-subtle shadow-sm" />
                            ) : (
                                <UserCheck className="w-5 h-5 opacity-40" />
                            )}
                            {teacher.full_name}
                        </div>
                    )}
                    {ev.group_id && (() => { const g = groups.find(gr => gr.id === ev.group_id); return g ? <div className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 opacity-40" />{g.name}</div> : null; })()}
                    {ev.reminder_30m && (
                        <div className="flex items-center gap-2 text-[#6d28d9] font-bold">
                            <Clock className="w-3.5 h-3.5" />
                            {t.reminder30m}
                        </div>
                    )}
                    {ev.notes && <div className="flex items-start gap-2"><BookOpen className="w-3.5 h-3.5 opacity-40 mt-0.5" />{ev.notes}</div>}
                </div>

                {canEdit && (
                    <div className="flex gap-2 pt-1">
                        <button onClick={() => setMode('delete')}
                            className="flex-1 py-2 border border-red-500/20 text-red-500/70 hover:text-red-500 hover:bg-red-500/5 text-xs rounded-xl transition-all">
                            {t.calDelete}
                        </button>
                        <button onClick={() => setMode('edit')}
                            className="flex-1 py-2 bg-[#6d28d9] hover:bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-[#6d28d9]/20 active:scale-95 transition-all">
                            {t.calEditBtn}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}


/* ─── Add Event Form ─────────────────────────────────────────── */

const EMPTY_EV = { title: '', type: 'group_class' as EventType, hall_id: 'h1', teacher_id: '', group_id: '', date: '', start_time: '09:00', end_time: '10:30', notes: '', recurring: 'none' as 'none' | 'weekly', reminder_30m: false };

function AddEventModal({ defaultDate, defaultTime, onClose, onAdd, teachers, halls, groups, canEdit }: { defaultDate: string; defaultTime?: string; onClose: () => void; onAdd: (evs: CalendarEvent[]) => void; teachers: any[]; halls: any[]; groups: Group[]; canEdit: boolean }) {
    const defaultStart = defaultTime || '09:00';

    // Helper to add 1 hour to a string time HH:mm
    const addOneHour = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        const nextH = (h + 1) % 24;
        return `${nextH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const [form, setForm] = useState({
        ...EMPTY_EV,
        date: defaultDate,
        start_time: defaultStart,
        end_time: addOneHour(defaultStart)
    });

    // Multi-day selection for recurring
    const [recurringDays, setRecurringDays] = useState<Record<number, { active: boolean, start: string, end: string }>>({
        1: { active: false, start: defaultStart, end: addOneHour(defaultStart) }, // Mon
        2: { active: false, start: defaultStart, end: addOneHour(defaultStart) }, // Tue
        3: { active: false, start: defaultStart, end: addOneHour(defaultStart) }, // Wed
        4: { active: false, start: defaultStart, end: addOneHour(defaultStart) }, // Thu
        5: { active: false, start: defaultStart, end: addOneHour(defaultStart) }, // Fri
        6: { active: false, start: defaultStart, end: addOneHour(defaultStart) }, // Sat
        0: { active: false, start: defaultStart, end: addOneHour(defaultStart) }  // Sun
    });

    // Auto-active the day from defaultDate
    useEffect(() => {
        if (form.recurring === 'weekly') {
            const d = new Date(defaultDate + 'T00:00:00');
            const day = d.getDay();
            setRecurringDays(prev => ({
                ...prev,
                [day]: { ...prev[day], active: true }
            }));
        }
    }, [form.recurring, defaultDate]);

    const toggleDay = (day: number) => {
        setRecurringDays(prev => ({
            ...prev,
            [day]: { ...prev[day], active: !prev[day].active }
        }));
    };

    const setDayTime = (day: number, k: 'start' | 'end', v: string) => {
        setRecurringDays(prev => {
            const next = { ...prev, [day]: { ...prev[day], [k]: v } };
            if (k === 'start') next[day].end = addOneHour(v);
            return { ...next };
        });
    };

    const [isNewGroup, setIsNewGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const { t } = useT();
    const eventTypes = EVENT_TYPES(t);

    function setF(k: string, v: any) {
        setForm(p => {
            const next = { ...p, [k]: v };
            // If start_time changes, auto-adjust end_time to be +1 hour
            if (k === 'start_time') {
                next.end_time = addOneHour(v);
            }
            return next;
        });
    }

    const { lang } = useT();
    const timeOptions = generateTimeOptions(15);
    const dayOptions = generateDayOptions();
    const monthOptions = generateMonthOptions(lang);
    const yearOptions = generateYearOptions(new Date().getFullYear() - 1, new Date().getFullYear() + 2);

    const [dateParts, setDateParts] = useState({ day: '', month: '', year: '' });
    useEffect(() => {
        if (form.date) {
            const [y, m, d] = form.date.split('-');
            setDateParts({ year: y || '', month: m || '', day: d || '' });
        }
    }, [form.date]);

    const updateDateFromParts = (parts: { day: string, month: string, year: string }) => {
        if (parts.day && parts.month && parts.year) {
            setF('date', `${parts.year}-${parts.month}-${parts.day}`);
        }
    };

    const [selectedColor, setSelectedColor] = useState<string>('#6366f1'); // Default color

    // Auto-select group color if group selected
    useEffect(() => {
        if (form.group_id) {
            const g = groups.find(g => g.id === form.group_id);
            if (g?.color) setSelectedColor(g.color);
        }
    }, [form.group_id, groups]);

    function save() {
        if (form.type === 'group_class') {
            if (isNewGroup && !newGroupName.trim()) return;
            if (!isNewGroup && !form.group_id) return;
        } else {
            if (!form.title.trim()) return;
        }

        let groupId = form.group_id;
        let finalTitle = form.title.trim();
        let teacherId = form.teacher_id;

        if (form.type === 'group_class' && isNewGroup) {
            const ng = createGroup({
                name: newGroupName.trim(),
                coach: teachers.find(tc => tc.id === teacherId)?.full_name || '',
                teacherId: teacherId,
                capacity: 15,
                type: 'Dance',
                difficulty: null,
                hall_id: form.hall_id
            });
            groupId = ng.id;
            finalTitle = ng.name;
        } else if (form.type === 'group_class' && !finalTitle) {
            finalTitle = groups.find(g => g.id === groupId)?.name || 'Untitled Group';
        }

        const hallColor = halls.find((h: any) => h.id === form.hall_id)?.color ?? '#6366f1';

        const baseEvent = {
            ...form,
            group_id: groupId,
            title: finalTitle,
            teacher_id: teacherId,
            org_id: settings.orgId || 'demo',
            color: selectedColor,
            created_at: new Date().toISOString()
        };

        if ((form.recurring as string) === 'weekly') {
            const activeDays = Object.entries(recurringDays).filter(([_, d]) => d.active);
            if (activeDays.length === 0) return;

            const batch: CalendarEvent[] = [];
            const refDate = new Date(defaultDate + 'T00:00:00');
            const dow = refDate.getDay();
            const startOfWeek = new Date(refDate);
            startOfWeek.setDate(refDate.getDate() - (dow === 0 ? 6 : dow - 1));

            activeDays.forEach(([dayNum, dInfo]) => {
                const dayDate = new Date(startOfWeek);
                const targetDay = Number(dayNum);
                const diff = (targetDay === 0 ? 6 : targetDay - 1);
                dayDate.setDate(startOfWeek.getDate() + diff);

                batch.push({
                    ...baseEvent,
                    id: String(Date.now() + Math.random()),
                    date: toDateStr(dayDate),
                    start_time: dInfo.start,
                    end_time: dInfo.end
                });
            });
            onAdd(batch);
        } else {
            onAdd([{
                ...baseEvent,
                id: String(Date.now()),
                date: form.date
            }]);
        }
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in slide-in-from-bottom-4 duration-300" onClick={onClose}>
            <div className="fixed inset-0 bg-black/20" />
            <div className="relative z-10 w-full max-w-sm bg-card border border-border-subtle rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                    <h2 className="text-sm font-bold text-primary">{t.calEventNew}</h2>
                    <button onClick={onClose} className="text-muted hover:text-primary transition-colors"><X className="w-4 h-4" /></button>
                </div>

                <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
                    {/* Event Type */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.calEventType}</label>
                            <SearchSelect
                                options={eventTypes}
                                value={form.type}
                                onChange={val => setF('type', val)}
                                className="!border-border-subtle hover:!border-[#6d28d9]/40 shadow-sm [&>div]:py-2.5 [&>div]:px-3 [&>div]:text-xs"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.calRecurring}</label>
                            <SearchSelect
                                options={[
                                    { value: 'none', label: t.calOneTime },
                                    { value: 'weekly', label: t.calEveryWeek }
                                ]}
                                value={form.recurring}
                                onChange={val => setF('recurring', val)}
                                className="!border-border-subtle hover:!border-[#6d28d9]/40 shadow-sm [&>div]:py-2.5 [&>div]:px-3 [&>div]:text-xs"
                            />
                        </div>
                    </div>

                    {/* Title or New Group Name/Title */}
                    {form.type === 'group_class' ? (
                        isNewGroup && (
                            <div>
                                <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.groupName}</label>
                                <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder={t.calGroupNamePlaceholder}
                                    className="w-full bg-surface border border-[#6d28d9]/40 focus:border-[#6d28d9] rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/50 outline-none transition-all" />
                            </div>
                        )
                    ) : (
                        <div>
                            <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.calTitle}</label>
                            <input value={form.title} onChange={e => setF('title', e.target.value)} placeholder="სათაური *"
                                className="w-full bg-surface border border-border-subtle focus:border-[#6d28d9]/60 rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/50 outline-none transition-all" />
                        </div>
                    )}

                    {/* Group selector or Toggle to New Group */}
                    {form.type === 'group_class' && (
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-muted block tracking-wider font-bold opacity-70">{t.calGroup}</label>
                                <button onClick={() => setIsNewGroup(!isNewGroup)} className="text-[10px] font-bold text-[#6d28d9] hover:underline">
                                    {isNewGroup ? '← სიიდან არჩევა' : t.calNewGroup}
                                </button>
                            </div>
                            {!isNewGroup && (
                                <SearchSelect
                                    options={[
                                        { value: '', label: t.calGroupOptional },
                                        ...groups.map(g => ({ value: g.id, label: g.name }))
                                    ]}
                                    value={form.group_id}
                                    onChange={val => {
                                        setF('group_id', val);
                                        const g = groups.find(gr => gr.id === val);
                                        if (g && !form.title) setF('title', g.name);
                                        if (g?.teacherId) setF('teacher_id', g.teacherId);
                                    }}
                                    className="!border-[#6d28d9]/30 hover:!border-[#6d28d9]/60 shadow-sm [&>div]:py-2.5 [&>div]:px-3 [&>div]:text-xs"
                                />
                            )}
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.calHall}</label>
                        <SearchSelect
                            options={halls.map((h: any) => ({ value: h.id, label: h.name }))}
                            value={form.hall_id}
                            onChange={val => {
                                setF('hall_id', val);
                                const hall = halls.find((h: any) => h.id === val);
                                if (hall) setSelectedColor(hall.color);
                            }}
                            className="!border-border-subtle hover:!border-[#6d28d9]/40 shadow-sm [&>div]:py-2.5 [&>div]:px-3 [&>div]:text-xs"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.calTeacher}</label>
                        <SearchSelect
                            options={[
                                { value: '', label: t.allTeachers },
                                ...teachers.map(tc => ({ value: tc.id, label: tc.full_name }))
                            ]}
                            value={form.teacher_id}
                            onChange={val => setF('teacher_id', val)}
                            className="!border-border-subtle hover:!border-[#6d28d9]/40 shadow-sm [&>div]:py-2.5 [&>div]:px-3 [&>div]:text-xs"
                        />
                    </div>

                    {form.recurring !== 'weekly' && (
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.calDate}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <SearchSelect 
                                        options={dayOptions}
                                        value={dateParts.day}
                                        onChange={val => {
                                            const p = { ...dateParts, day: val };
                                            setDateParts(p);
                                            updateDateFromParts(p);
                                        }}
                                        placeholder="დღე"
                                    />
                                    <SearchSelect 
                                        options={monthOptions}
                                        value={dateParts.month}
                                        onChange={val => {
                                            const p = { ...dateParts, month: val };
                                            setDateParts(p);
                                            updateDateFromParts(p);
                                        }}
                                        placeholder="თვე"
                                    />
                                    <SearchSelect 
                                        options={yearOptions}
                                        value={dateParts.year}
                                        onChange={val => {
                                            const p = { ...dateParts, year: val };
                                            setDateParts(p);
                                            updateDateFromParts(p);
                                        }}
                                        placeholder="წელი"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.calStartTime}</label>
                                    <SearchSelect 
                                        options={timeOptions}
                                        value={form.start_time}
                                        onChange={val => setF('start_time', val)}
                                        placeholder="09:00"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-muted mb-1 block tracking-wider font-bold opacity-70">{t.calEndTime}</label>
                                    <SearchSelect 
                                        options={timeOptions}
                                        value={form.end_time}
                                        onChange={val => setF('end_time', val)}
                                        placeholder="10:30"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reminder Toggle */}
                    <div className="flex items-center justify-between p-3 bg-[#6d28d9]/5 border border-[#6d28d9]/20 rounded-xl cursor-pointer" onClick={() => setF('reminder_30m', !form.reminder_30m)}>
                        <div className="flex items-center gap-3">
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", form.reminder_30m ? "bg-[#6d28d9] text-white" : "bg-card text-muted opacity-40")}>
                                <Clock className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold text-primary opacity-80">{t.reminder30m}</span>
                        </div>
                        <div className={cn("w-10 h-5 rounded-full p-1 transition-colors relative", form.reminder_30m ? "bg-[#6d28d9]" : "bg-muted/30")}>
                            <div className={cn("w-3 h-3 bg-white rounded-full transition-all shadow-sm", form.reminder_30m ? "translate-x-5" : "translate-x-0")} />
                        </div>
                    </div>

                    {form.recurring === 'weekly' && (
                        <div className="bg-surface/50 border border-border-subtle rounded-2xl p-4 space-y-4">
                            <label className="text-[10px] text-muted block tracking-wider font-black opacity-40">აირჩიეთ დღეები და დროები</label>
                            <div className="flex flex-wrap gap-2">
                                {[1, 2, 3, 4, 5, 6, 0].map(d => {
                                    const dayNames = ['კვ', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
                                    const isActive = recurringDays[d].active;
                                    return (
                                        <button key={d} onClick={() => toggleDay(d)}
                                            className={cn(
                                                "w-10 h-10 rounded-xl text-[10px] font-black transition-all border",
                                                isActive ? "bg-[#6d28d9] border-[#6d28d9] text-white shadow-lg shadow-[#6d28d9]/20" : "bg-card border-border-subtle text-muted hover:border-[#6d28d9]/40"
                                            )}>
                                            {dayNames[d]}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="space-y-2">
                                {[1, 2, 3, 4, 5, 6, 0].filter(d => recurringDays[d].active).map(d => {
                                    const dayNames = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
                                    return (
                                        <div key={d} className="flex items-center gap-3 bg-card/50 p-2 rounded-xl border border-border-subtle/30">
                                            <span className="text-[10px] font-bold text-primary w-16">{dayNames[d]}</span>
                                            <div className="flex-1 flex gap-2">
                                                <SearchSelect 
                                                    options={timeOptions}
                                                    value={recurringDays[d].start}
                                                    onChange={val => setDayTime(d, 'start', val)}
                                                    className="!border-none [&>div]:py-1 [&>div]:px-2 [&>div]:text-[10px] [&>div]:min-h-[28px]"
                                                />
                                                <SearchSelect 
                                                    options={timeOptions}
                                                    value={recurringDays[d].end}
                                                    onChange={val => setDayTime(d, 'end', val)}
                                                    className="!border-none [&>div]:py-1 [&>div]:px-2 [&>div]:text-[10px] [&>div]:min-h-[28px]"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}



                    <div>
                        <label className="text-[10px] text-muted mb-2 block tracking-wider font-bold opacity-70">{t.selectColor}</label>
                        <label className="flex items-center gap-3 bg-surface border border-border-subtle rounded-xl p-2 cursor-pointer hover:border-[#6d28d9]/40 transition-colors">
                            <span className="w-8 h-8 rounded-lg shadow-sm border border-black/10 flex-shrink-0 overflow-hidden relative">
                                <input type="color" value={selectedColor} onChange={e => setSelectedColor(e.target.value)}
                                    className="absolute -inset-2 w-12 h-12 cursor-pointer opacity-0" />
                                <div className="w-full h-full pointer-events-none" style={{ backgroundColor: selectedColor }} />
                            </span>
                            <span className="text-xs text-muted font-medium select-none truncate">{t.chooseAnotherColor}</span>
                        </label>
                    </div>

                    <textarea value={form.notes} onChange={e => setF('notes', e.target.value)} rows={2} placeholder={t.calNotes}
                        className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2 text-xs text-primary placeholder:text-muted/40 outline-none resize-none transition-all" />
                </div>

                <div className="px-5 py-4 border-t border-border-subtle flex gap-2">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 border border-border-subtle text-muted hover:text-primary hover:bg-surface text-sm rounded-xl transition-all">{t.calCancel}</button>
                    <button onClick={save} disabled={form.type === 'group_class' ? (isNewGroup ? !newGroupName.trim() : !form.group_id) : !form.title.trim()}
                        className="flex-1 py-2.5 bg-[#6d28d9] hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl shadow-lg shadow-[#6d28d9]/20 active:scale-95 transition-all">
                        {t.calAdd}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Export helpers ─────────────────────────────────────────── */

function exportIcal(events: CalendarEvent[], teachers: any[], halls: any[]) {
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//ClassCore//Calendar//GEO',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
    ];
    events.forEach(ev => {
        const hall = halls.find((h: any) => h.id === ev.hall_id);
        const teacher = teachers.find(t => t.id === ev.teacher_id);
        const start = ev.date.replace(/-/g, '') + 'T' + ev.start_time.replace(':', '') + '00';
        const end = ev.date.replace(/-/g, '') + 'T' + ev.end_time.replace(':', '') + '00';
        lines.push(
            'BEGIN:VEVENT',
            `UID:${ev.id}@classcore.ge`,
            `DTSTART;TZID=Asia/Tbilisi:${start}`,
            `DTEND;TZID=Asia/Tbilisi:${end}`,
            `SUMMARY:${ev.title}`,
            `DESCRIPTION:${teacher ? `მასწ: ${teacher.full_name}` : ''}`,
            `LOCATION:${hall?.name ?? ''}`,
            'END:VEVENT',
        );
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'classcore_calendar.ics'; a.click();
    URL.revokeObjectURL(url);
}

async function exportExcel() {
    try {
        // const XLSX = await import('xlsx');
        alert('Excel-ის ექსპორტისთვის საჭიროა ბიბლიოთეკა. გთხოვთ გაუშვათ: npm install xlsx');
        /*
        const data = events.map(ev => ({
            'სათაური': ev.title,
            'ტიპი': EVENT_TYPES.find(t => t.value === ev.type)?.label ?? ev.type,
            'თარიღი': ev.date,
            'დაწყება': ev.start_time,
            'დასასრული': ev.end_time,
            'დარბაზი': HALLS.find(h => h.id === ev.hall_id)?.name ?? '',
            'მასწავლებელი': TEACHERS.find(t => t.id === ev.teacher_id)?.name ?? '',
            'გამეორება': ev.recurring === 'weekly' ? 'ყოველ კვირა' : 'ერთჯერადი',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'კალენდარი');
        XLSX.writeFile(wb, `classcore_calendar_${new Date().toISOString().slice(0, 10)}.xlsx`);
        */
    } catch (err) {
        console.error('XLSX export failed:', err);
        alert('Excel-ის ექსპორტისთვის საჭიროა ბიბლიოთეკა. გთხოვთ გაუშვათ: npm install xlsx');
    }
}

/* ─── Main Calendar Page ─────────────────────────────────────── */

export default function CalendarPage() {
    const { t, lang } = useT();
    const { profile } = useUser();
    const isTeacher = profile?.role === 'teacher';
    const canEdit = !isTeacher || !!profile?.canEditCalendar;

    // Day and Month names from i18n
    const DAYS = [t.shortSun, t.shortMon, t.shortTue, t.shortWed, t.shortThu, t.shortFri, t.shortSat];
    const MONTHS = [t.jan, t.feb, t.mar, t.apr, t.may, t.jun, t.jul, t.aug, t.sep, t.oct, t.nov, t.dec];

    // ── Unified Date Formatter for SSR/Client Consistency ───────────────────
    const formatDate = (date: Date, mode: 'short' | 'long' = 'short') => {
        const dNames = mode === 'long' 
            ? [t.sunday, t.monday, t.tuesday, t.wednesday, t.thursday, t.friday, t.saturday]
            : [t.shortSun, t.shortMon, t.shortTue, t.shortWed, t.shortThu, t.shortFri, t.shortSat];
        const mNames = [t.jan, t.feb, t.mar, t.apr, t.may, t.jun, t.jul, t.aug, t.sep, t.oct, t.nov, t.dec];
        
        const dayName = dNames[date.getDay()];
        const monthName = mNames[date.getMonth()];
        const dayNum = date.getDate();

        if (lang === 'ka') return `${dayName}, ${dayNum} ${monthName}`;
        if (lang === 'ru') return `${dayName}, ${dayNum} ${monthName}`;
        return `${dayName}, ${monthName} ${dayNum}`;
    };

    const [view, setView] = useState<'day' | 'week' | 'month'>('week');
    const [anchor, setAnchor] = useState(new Date());
    const { settings } = useStudio();
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [halls, setHalls] = useState<{ id: string; name: string; color: string }[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        const refresh = () => {
            setEvents(getEvents());
            setTeachers(getTeachers());
            setHalls(getHalls().filter(h => h.is_active !== false));
            setGroups(getGroups());
        };

        setHasMounted(true);
        refresh();

        const events = [
            'cc_calendar_events_update', 'cc_teacher_update', 'cc_halls_update', 'cc_groups_update', 'cc_student_update'
        ];
        events.forEach(e => window.addEventListener(e, refresh));
        return () => events.forEach(e => window.removeEventListener(e, refresh));
    }, [settings.activeBranchId]);

    // Initial mobile view
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setView('day');
        }
    }, []);


    const hallColors: Record<string, string> = Object.fromEntries(halls.map(h => [h.id, h.color]));

    const expandedEvents = useMemo(() => {
        const expanded: CalendarEvent[] = [];
        events.forEach(ev => {
            expanded.push(ev);
            if (ev.recurring === 'weekly') {
                for (let w = -4; w <= 4; w++) { // Expand further for month view
                    if (w === 0) continue;
                    const d = new Date(ev.date);
                    d.setDate(d.getDate() + w * 7);
                    expanded.push({ ...ev, id: `${ev.id}_w${w}`, date: toDateStr(d) });
                }
            }
        });
        return expanded;
    }, [events]);
    const [filterHall, setFilterHall] = useState<string>('all');
    const [filterTeacher, setFilterTeacher] = useState<string>('all');
    const [selectedEv, setSelectedEv] = useState<CalendarEvent | null>(null);
    const [addDate, setAddDate] = useState<string | null>(null);
    const [addTime, setAddTime] = useState<string | null>(null);

    // ── Drag & Drop state ──────────────────────────────────────
    const dragInfo = useRef<DragInfo | null>(null);
    const [ghostStyle, setGhostStyle] = useState<{
        visible: boolean;
        x: number; y: number;
        width: number; height: number;
        ev: CalendarEvent | null;
    }>({ visible: false, x: 0, y: 0, width: 0, height: 0, ev: null });
    const [dragConfirm, setDragConfirm] = useState<{
        ev: CalendarEvent;
        newDate: string;
        newStart: string;
        newEnd: string;
    } | null>(null);
    // ref to week-view grid container for drop target
    const weekGridRef = useRef<HTMLDivElement | null>(null);
    const dayGridRef = useRef<HTMLDivElement | null>(null);


    // Filtered events
    const filtered = useMemo(() => expandedEvents.filter(ev =>
        (filterHall === 'all' || ev.hall_id === filterHall) &&
        (filterTeacher === 'all' || ev.teacher_id === filterTeacher)
    ), [expandedEvents, filterHall, filterTeacher]);

    // Week navigation
    const weekDates = getWeekDates(anchor);
    const weekLabel = `${weekDates[0].getDate()} ${MONTHS[weekDates[0].getMonth()]} – ${weekDates[6].getDate()} ${MONTHS[weekDates[6].getMonth()]} ${weekDates[6].getFullYear()}`;

    // Month navigation
    const monthYear = { y: anchor.getFullYear(), m: anchor.getMonth() };
    const monthDays = getDaysInMonth(monthYear.y, monthYear.m);
    const firstDow = (monthDays[0].getDay() + 6) % 7; // Mon=0
    const monthLabel = `${MONTHS[monthYear.m]} ${monthYear.y}`;

    // Day label  
    const dayLabel = formatDate(anchor, 'long');

    // ── Auto-scroll to Current Time ──────────────────────────────
    useEffect(() => {
        const scrollToCurrent = () => {
            const now = new Date();
            const currentMins = now.getHours() * 60 + now.getMinutes();
            const startMins = START_HOUR * 60;

            // Only scroll if we are within the displayed range
            if (currentMins >= startMins && currentMins <= END_HOUR * 60) {
                const offsetMins = currentMins - startMins;
                const scrollPos = (offsetMins / 15) * 18 - 100; // Subtract some px to see the hour label clearly

                if (view === 'day' && dayGridRef.current) {
                    dayGridRef.current.scrollTo({ top: scrollPos, behavior: 'smooth' });
                } else if (view === 'week' && weekGridRef.current) {
                    weekGridRef.current.scrollTo({ top: scrollPos, behavior: 'smooth' });
                }
            }
        };

        // Scroll on mount or view change
        const timer = setTimeout(scrollToCurrent, 500);
        return () => clearTimeout(timer);
    }, [view]);

    // ── Drag & Drop Handlers ──────────────────────────────────
    const touchTimeout = useRef<NodeJS.Timeout | null>(null);

    const startDrag = (clientX: number, clientY: number, currentTarget: HTMLElement, ev: CalendarEvent) => {
        if (!canEdit) return;
        const rect = currentTarget.getBoundingClientRect();
        const startX = clientX;
        const startY = clientY;
        let hasMoved = false;

        dragInfo.current = {
            ev,
            startMouseY: startY,
            startMouseX: startX,
            evOffsetY: startY - rect.top,
            chipHeight: rect.height,
            chipWidth: rect.width
        };

        const onMove = (moveX: number, moveY: number) => {
            if (!dragInfo.current) return;
            const dx = moveX - startX;
            const dy = moveY - startY;

            if (!hasMoved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
                hasMoved = true;
            }

            if (hasMoved) {
                setGhostStyle({
                    visible: true,
                    x: moveX - (startX - rect.left),
                    y: moveY - (startY - rect.top),
                    width: rect.width,
                    height: rect.height,
                    ev
                });
            }
        };

        const onEnd = (endX: number, endY: number) => {
            if (!dragInfo.current) return;
            dragInfo.current = null;
            setGhostStyle(p => ({ ...p, visible: false }));

            if (!hasMoved) return;

            const targetRef = view === 'day' ? dayGridRef : weekGridRef;
            if (!targetRef.current) return;

            const gridRect = targetRef.current.getBoundingClientRect();
            if (endX < gridRect.left || endX > gridRect.right || endY < gridRect.top || endY > gridRect.bottom) return;

            const relY = (endY - gridRect.top) + targetRef.current.scrollTop;
            const totalMins = (relY / 72) * 60;
            const snappedMins = Math.floor(totalMins / 15) * 15;
            const newH = START_HOUR + Math.floor(snappedMins / 60);
            const newM = snappedMins % 60;
            const newStartTime = `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;

            const duration = timeToMins(ev.end_time) - timeToMins(ev.start_time);
            const newEndTimeMins = timeToMins(newStartTime) + duration;
            const newEndH = Math.floor(newEndTimeMins / 60);
            const newEndM = newEndTimeMins % 60;
            const newEndTime = `${newEndH.toString().padStart(2, '0')}:${newEndM.toString().padStart(2, '0')}`;

            let newDate = ev.date;
            if (view === 'week') {
                const colWidth = gridRect.width / 7;
                const colIdx = Math.floor((endX - gridRect.left) / colWidth);
                newDate = toDateStr(weekDates[colIdx]);
            } else {
                newDate = toDateStr(anchor);
            }

            if (newDate === ev.date && newStartTime === ev.start_time) return;

            const updatedEv = { ...ev, date: newDate, start_time: newStartTime, end_time: newEndTime };
            if (ev.recurring === 'weekly' || ev.group_id) {
                setDragConfirm({ ev, newDate, newStart: newStartTime, newEnd: newEndTime });
            } else {
                updateEvent(updatedEv);
            }
        };

        return { onMove, onEnd };
    };

    const handleDragStart = useCallback((e: React.MouseEvent, ev: CalendarEvent) => {
        const target = e.currentTarget as HTMLElement;
        const drag = startDrag(e.clientX, e.clientY, target, ev);
        if (!drag) return;

        const handleMouseMove = (em: MouseEvent) => drag.onMove(em.clientX, em.clientY);
        const handleMouseUp = (eu: MouseEvent) => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            drag.onEnd(eu.clientX, eu.clientY);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [view, weekDates, anchor, canEdit]);

    const handleTouchStart = useCallback((e: React.TouchEvent, ev: CalendarEvent) => {
        if (!canEdit) return;
        const touch = e.touches[0];
        const target = e.currentTarget as HTMLElement;
        
        if (touchTimeout.current) clearTimeout(touchTimeout.current);
        
        touchTimeout.current = setTimeout(() => {
            const drag = startDrag(touch.clientX, touch.clientY, target, ev);
            if (!drag) return;

            const handleTouchMove = (em: TouchEvent) => {
                if (em.cancelable) em.preventDefault();
                drag.onMove(em.touches[0].clientX, em.touches[0].clientY);
            };

            const handleTouchEnd = (eu: TouchEvent) => {
                window.removeEventListener('touchmove', handleTouchMove);
                window.removeEventListener('touchend', handleTouchEnd);
                const endTouch = eu.changedTouches[0];
                drag.onEnd(endTouch.clientX, endTouch.clientY);
            };

            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleTouchEnd);
        }, 200); // 200ms long press to start drag

        const cancelTouch = () => {
            if (touchTimeout.current) {
                clearTimeout(touchTimeout.current);
                touchTimeout.current = null;
            }
        };

        target.addEventListener('touchmove', cancelTouch, { once: true });
        target.addEventListener('touchend', cancelTouch, { once: true });
    }, [view, weekDates, anchor, canEdit]);

    // Sync to localStorage so Header can display the date range
    useEffect(() => {
        const label = view === 'week' ? weekLabel : view === 'month' ? monthLabel : dayLabel;
        if (typeof window !== 'undefined') {
            localStorage.setItem('cc_cal_header_label', label);
        }
        return () => { if (typeof window !== 'undefined') localStorage.removeItem('cc_cal_header_label'); };
    }, [view, anchor]);

    function nav(dir: 1 | -1) {
        const d = new Date(anchor);
        if (view === 'month') d.setMonth(d.getMonth() + dir);
        else if (view === 'week') d.setDate(d.getDate() + dir * 7);
        else d.setDate(d.getDate() + dir);
        setAnchor(d);
    }

    function addEvents(newEvents: CalendarEvent[]) {
        const currentEvents = getEvents();
        let runningEvents = [...currentEvents];
        const added: CalendarEvent[] = [];

        for (const ev of newEvents) {
            const conflict = checkConflicts(runningEvents, ev);
            if (conflict) {
                alert(`კონფლიქტი (${ev.date} ${ev.start_time}): ${conflict}`);
                return;
            }
            runningEvents.push(ev);
            added.push(ev);
        }

        added.forEach(ev => {
            addEventToStore(ev);
            if (ev.group_id) {
                const date = new Date(ev.date + 'T00:00:00');
                const jsDay = date.getDay();
                const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
                addSlotToGroup(ev.group_id, { dayOfWeek, startTime: ev.start_time, endTime: ev.end_time });

                // Sync color back to group
                if (ev.color && ev.type === 'group_class') {
                    const currentGroups = getGroups();
                    const updatedGroups = currentGroups.map(g => g.id === ev.group_id ? { ...g, color: ev.color } : g);
                    saveGroups(updatedGroups);
                }
            }
            if (ev.type === 'individual' && ev.student_id) {
                // Auto-issue a 1-session subscription so it appears in the Billing page
                saveSubscription(ev.student_id, {
                    id: `ind_sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    student_id: ev.student_id,
                    plan: ev.title || 'ინდივიდუალური გაკვეთილი',
                    sessions_used: 0,
                    sessions_total: 1,
                    status: 'active',
                    expires_at: ev.date,
                    purchased_at: getLocalISODate(),
                    type: 'sessions',
                    plan_type: 'individual'
                });
            }
        });

        setEvents(getEvents());
        setGroups(getGroups());
    }

    /** Update an event and sync group slots */
    function updateEvent(updated: CalendarEvent, syncGroup: boolean = true) {
        const allEvents = getEvents();
        const prev = allEvents.find(e => e.id === updated.id);
        // Remove old group slot if group changed or time changed
        if (syncGroup && prev?.group_id) {
            const d = new Date(prev.date + 'T00:00:00');
            const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
            removeSlotFromGroup(prev.group_id, { dayOfWeek: dow, startTime: prev.start_time, endTime: prev.end_time });
        }
        updateEventInStore(updated.id, updated);
        setEvents(getEvents());
        // Add new group slot & Sync color
        if (syncGroup && updated.group_id) {
            const d = new Date(updated.date + 'T00:00:00');
            const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
            addSlotToGroup(updated.group_id, { dayOfWeek: dow, startTime: updated.start_time, endTime: updated.end_time });

            // Bidirectional Sync: Update group color if it changed in calendar
            if (updated.type === 'group_class') {
                const currentGroups = getGroups();
                const updatedGroups = currentGroups.map(g => g.id === updated.group_id ? { ...g, color: updated.color } : g);
                saveGroups(updatedGroups);
            }
        }
        setGroups(getGroups());
    }

    /** Update an event series (group class or other recurring) */
    function updateEventSeries(updated: CalendarEvent, recurringDays: Record<number, { active: boolean; start: string; end: string }>) {
        if (updated.type === 'group_class' && updated.group_id) {
            // 1. Update the group's schedule
            const slots: any[] = [];
            [1, 2, 3, 4, 5, 6, 0].forEach(d => {
                if (recurringDays[d].active) {
                    const groupDay = d === 0 ? 6 : d - 1;
                    slots.push({ dayOfWeek: groupDay, startTime: recurringDays[d].start, endTime: recurringDays[d].end });
                }
            });

            const currentGroups = getGroups();
            const updatedGroups: Group[] = currentGroups.map(g => g.id === updated.group_id ? {
                ...g,
                name: updated.title,
                teacherId: updated.teacher_id || '',
                hall_id: updated.hall_id || '',
                color: updated.color, // Bidirectional sync
                schedule_slots: slots
            } : g);

            setGroups(updatedGroups);
            saveGroups(updatedGroups);

            // 2. Re-sync all events for this group
            syncGroupScheduleToCalendar(updated.group_id!!, updated.title, updated.teacher_id || '', updated.hall_id || '', slots, updated.color);
            setEvents(getEvents());
        } else {
            // Fallback for non-group series (just update this one for now)
            updateEvent(updated);
        }
    }

    const deleteEvent = (id: string) => {
        const baseId = id.replace(/_w-?\d+$/, '');
        const baseEv = events.find(e => e.id === baseId);
        const updated = deleteEventFromStore(baseId);
        setEvents(updated);
        // Bidirectional sync: remove from group schedule
        if (baseEv?.group_id) {
            const date = new Date(baseEv.date + 'T00:00:00');
            const jsDay = date.getDay();
            const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
            removeSlotFromGroup(baseEv.group_id, { dayOfWeek, startTime: baseEv.start_time, endTime: baseEv.end_time });
            setGroups(getGroups());
        }
    }

    /** Delete ALL recurring events for the same group+time (all occurrences) */
    function deleteAllGroupOccurrences(ev: CalendarEvent) {
        if (!ev.group_id) { deleteEvent(ev.id); return; }
        const allEvents = getEvents();
        // Find all events with same group_id, same start_time, same end_time
        const toDelete = allEvents.filter(e =>
            e.group_id === ev.group_id &&
            e.start_time === ev.start_time &&
            e.end_time === ev.end_time
        );
        let remaining = allEvents;
        for (const e of toDelete) {
            remaining = remaining.filter(r => r.id !== e.id);
            if (e.group_id) {
                const d = new Date(e.date + 'T00:00:00');
                const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
                removeSlotFromGroup(e.group_id, { dayOfWeek: dow, startTime: e.start_time, endTime: e.end_time });
            }
        }
        saveEvents(remaining);
        setEvents(getEvents());
        setGroups(getGroups());
    }

    const syncAllGroups = async (silent: boolean = false) => {
        const allGroups = getGroups();
        if (allGroups.length === 0) {
            if (!silent) alert(lang === 'ka' ? 'ჯგუფები არ მოიძებნა' : 'No groups found');
            return;
        }

        // AGGRESSIVE CLEANUP: Remove all recurring events first to avoid duplicates or fragmented hall IDs
        const existingEvents = getEvents();
        const manualEvents = existingEvents.filter(e => !e.group_id);
        saveEvents(manualEvents);
        
        let count = 0;
        for (const g of allGroups) {
            if (g.schedule_slots && g.schedule_slots.length > 0) {
                // Determine the correct hall ID - use the one assigned to group, or the first available
                let hall = halls.find((h: any) => h.id === g.hall_id);
                if (!hall && halls.length > 0) {
                    hall = halls[0]; // Auto-assign to first hall if none specified
                }
                
                const hallId = hall?.id || 'h1';
                const hallColor = hall?.color || '#6366f1';

                syncGroupScheduleToCalendar(
                    g.id, 
                    g.name, 
                    g.teacherId, 
                    hallId, 
                    g.schedule_slots, 
                    hallColor, 
                    g.secondaryTeacherId
                );
                count++;
            }
        }
        setEvents(getEvents());
        if (!silent) alert(lang === 'ka' 
            ? `${count} ჯგუფის განრიგი წარმატებით დასინქრონდა! თუ კალენდარი მაინც ცარიელია, დარწმუნდით რომ ჯგუფებს მიენიჭა შესაბამისი დარბაზი.` 
            : `Successfully synced ${count} group schedules! If the calendar is still empty, make sure groups are assigned to the correct hall.`);
    };

    // Aggressive Auto-sync on mount to ensure Groups always appear in Calendar automatically
    useEffect(() => {
        if (hasMounted && groups.length > 0) {
            syncAllGroups(true);
        }
    }, [hasMounted, groups.length]);

    // Events on a specific date
    function dayEvents(dateStr: string) {
        return filtered
            .filter(e => e.date === dateStr)
            .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    }

    // Events for a time slot in week view
    function slotEvents(dateStr: string, slotHour: string) {
        const slotMins = timeToMins(slotHour);
        return filtered.filter(e => e.date === dateStr && timeToMins(e.start_time) >= slotMins && timeToMins(e.start_time) < slotMins + 60);
    }

    async function exportPDF() {
        const printWin = window.open('', '_blank');
        if (!printWin) return;

        const studioName = settings.studioName || 'ClassCore';
        const dateStr = view === 'day' 
            ? formatDate(anchor, 'long')
            : view === 'week'
                ? `${t.weekView}: ${formatDate(getWeekDates(anchor)[0])} - ${formatDate(getWeekDates(anchor)[6])}`
                : `${t.monthView}: ${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;

        const getEventsFor = (date: string, hallId?: string) => {
            return getEvents().filter(ev => {
                if (ev.date !== date) return false;
                if (hallId && ev.hall_id !== hallId) return false;
                if (filterHall !== 'all' && ev.hall_id !== filterHall) return false;
                return true;
            });
        };

        let contentHtml = '';

        if (view === 'day') {
            const activeHalls = filterHall === 'all' ? halls : halls.filter(h => h.id === filterHall);
            contentHtml = `
                <div class="print-header">
                    <div class="print-studio">${studioName}</div>
                    <div class="print-title">${t.calendar} — ${t.dayView}</div>
                    <div class="print-date">${dateStr}</div>
                </div>
                <table class="day-grid">
                    <thead>
                        <tr>
                            <th class="time-col">${t.times || 'დრო'}</th>
                            ${activeHalls.map(h => `<th style="border-top: 4px solid ${h.color}">${h.name}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${TIME_SLOTS.filter(s => s.endsWith(':00') || s.endsWith(':30')).map(slot => `
                            <tr>
                                <td class="time-cell">${slot}</td>
                                ${activeHalls.map(h => {
                                    const evs = getEventsFor(toDateStr(anchor), h.id).filter(e => {
                                        const start = timeToMins(e.start_time);
                                        const slotMins = timeToMins(slot);
                                        return start >= slotMins && start < slotMins + 30;
                                    });
                                    return `<td>
                                        ${evs.map(e => `
                                            <div class="event-chip" style="border-left: 3px solid ${e.color || h.color}; background: ${ (e.color || h.color) + '10' }">
                                                <div class="ev-time">${e.start_time}-${e.end_time}</div>
                                                <div class="ev-title">${e.title}</div>
                                                <div class="ev-teacher">${teachers.find(tc => tc.id === e.teacher_id)?.full_name || ''}</div>
                                            </div>
                                        `).join('')}
                                    </td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else if (view === 'week') {
            const weekDates = getWeekDates(anchor);
            const dayNames = [t.shortMon, t.shortTue, t.shortWed, t.shortThu, t.shortFri, t.shortSat, t.shortSun];
            contentHtml = `
                <div class="print-header">
                    <div class="print-studio">${studioName}</div>
                    <div class="print-title">${t.calendar} — ${t.weekView}</div>
                    <div class="print-date">${dateStr}</div>
                </div>
                <table class="week-grid">
                    <thead>
                        <tr>
                            <th class="time-col">${t.times || 'დრო'}</th>
                            ${weekDates.map((d, i) => `<th>${dayNames[i]}<br/><small>${formatDate(d)}</small></th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
                            const hour = START_HOUR + i;
                            const slot = `${hour.toString().padStart(2, '0')}:00`;
                            return `
                                <tr>
                                    <td class="time-cell">${slot}</td>
                                    ${weekDates.map(d => {
                                        const evs = getEventsFor(toDateStr(d)).filter(e => e.start_time.startsWith(hour.toString().padStart(2, '0')));
                                        return `<td>
                                            ${evs.map(e => `
                                                <div class="event-chip mini" style="border-left: 2px solid ${e.color || '#6366f1'}">
                                                    <strong>${e.title}</strong>
                                                    <span>${e.start_time}</span>
                                                </div>
                                            `).join('')}
                                        </td>`;
                                    }).join('')}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        } else {
            const daysInMonth = getDaysInMonth(anchor.getFullYear(), anchor.getMonth());
            const startDay = daysInMonth[0].getDay();
            const offset = (startDay + 6) % 7;
            const dayNames = [t.shortMon, t.shortTue, t.shortWed, t.shortThu, t.shortFri, t.shortSat, t.shortSun];

            contentHtml = `
                <div class="print-header">
                    <div class="print-studio">${studioName}</div>
                    <div class="print-title">${t.calendar} — ${t.monthView}</div>
                    <div class="print-date">${dateStr}</div>
                </div>
                <div class="month-grid">
                    ${dayNames.map(n => `<div class="month-day-head">${n}</div>`).join('')}
                    ${Array.from({ length: offset }).map(() => `<div class="month-day empty"></div>`).join('')}
                    ${daysInMonth.map(d => {
                        const dateCode = toDateStr(d);
                        const evs = getEventsFor(dateCode);
                        return `
                            <div class="month-day ${dateCode === toDateStr(new Date()) ? 'today' : ''}">
                                <div class="day-num">${d.getDate()}</div>
                                <div class="day-events">
                                    ${evs.map(e => `<div class="ev-line" style="background: ${e.color || '#6366f1'}20; color: ${e.color || '#6366f1'}">${e.title}</div>`).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${studioName} Calendar Export</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                    body { font-family: 'Inter', -apple-system, sans-serif; padding: 40px; color: #1e293b; background: #fff; margin: 0; }
                    .print-header { margin-bottom: 30px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
                    .print-studio { font-size: 24px; font-weight: 900; color: #4f46e5; }
                    .print-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-top: 4px; }
                    .print-date { font-size: 18px; font-weight: 700; color: #334155; margin-top: 10px; }
                    
                    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                    th, td { border: 1px solid #e2e8f0; padding: 8px; vertical-align: top; font-size: 11px; }
                    th { background: #f8fafc; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; height: 30px; vertical-align: middle; }
                    .time-col { width: 60px; text-align: center; }
                    .time-cell { background: #f8fafc; font-weight: 700; color: #64748b; font-size: 10px; text-align: center; }
                    
                    .event-chip { padding: 4px 6px; border-radius: 6px; margin-bottom: 4px; }
                    .event-chip.mini { padding: 2px 4px; font-size: 9px; margin-bottom: 2px; }
                    .ev-time { font-size: 9px; font-weight: 800; opacity: 0.5; margin-bottom: 2px; }
                    .ev-title { font-weight: 700; color: #1e293b; line-height: 1.2; }
                    .ev-teacher { font-size: 9px; opacity: 0.6; margin-top: 2px; }
                    
                    .month-grid { display: grid; grid-template-columns: repeat(7, 1fr); border: 1px solid #e2e8f0; }
                    .month-day-head { background: #f8fafc; padding: 10px; text-align: center; font-weight: 800; font-size: 10px; border: 0.5px solid #e2e8f0; text-transform: uppercase; }
                    .month-day { min-height: 100px; border: 0.5px solid #e2e8f0; padding: 8px; }
                    .month-day.empty { background: rgba(248, 250, 252, 0.3); }
                    .month-day.today { background: rgba(79, 70, 229, 0.05); }
                    .day-num { font-weight: 800; font-size: 14px; color: #94a3b8; margin-bottom: 6px; }
                    .ev-line { font-size: 9px; font-weight: 700; padding: 2px 4px; border-radius: 4px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                    @media print {
                        body { padding: 20px; }
                        @page { size: ${view === 'day' ? 'portrait' : 'landscape'}; margin: 1cm; }
                    }
                </style>
            </head>
            <body>
                ${contentHtml}
                <script>
                    window.onload = () => {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `;

        printWin.document.write(html);
        printWin.document.close();
    }



    return (
        <div className="flex flex-col gap-3 animate-fade-up h-full pb-8">
            {/* ── Top Header Row: View Switcher & Navigation ── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* View switcher - PROMOTED TO TOP ON MOBILE */}
                <div className="flex bg-surface border border-border-subtle rounded-2xl p-0.5 gap-0.5 shadow-sm h-11 w-full sm:w-auto overflow-x-auto no-scrollbar">
                    {(['day', 'week', 'month'] as const).map(v => (
                        <button key={v} onClick={() => setView(v)}
                            className={cn('flex-1 sm:flex-none px-4 sm:px-5 h-full text-[11px] font-bold tracking-tight rounded-xl transition-all whitespace-nowrap',
                                view === v ? 'bg-[#6d28d9] text-white shadow-md' : 'text-muted/60 hover:text-primary')}>
                            <div className="flex items-center justify-center gap-2">
                                {v === 'day' && <Calendar className="w-3.5 h-3.5 opacity-70" />}
                                {v === 'week' && <CalendarDays className="w-3.5 h-3.5 opacity-70" />}
                                {v === 'month' && <LayoutGrid className="w-3.5 h-3.5 opacity-70" />}
                                {v === 'day' ? t.dayView : v === 'week' ? t.weekView : t.monthView}
                            </div>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Unified Navigation: [Left] [Today] [Date] [Right] */}
                    <div className="flex items-center justify-between w-full sm:w-auto bg-surface border border-border-subtle rounded-2xl p-0.5 shadow-sm h-11">
                        <button onClick={() => nav(-1)} 
                            className="w-10 sm:w-9 h-full flex items-center justify-center rounded-xl hover:bg-indigo-50 text-muted hover:text-[#6d28d9] transition-all active:scale-95">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="w-px h-3 bg-border-subtle mx-0.5" />
                        <button onClick={() => setAnchor(new Date())} 
                            className="flex-1 sm:flex-none px-4 h-full text-[11px] font-bold tracking-tight rounded-xl hover:bg-indigo-50 text-[#6d28d9] transition-all active:scale-95">
                            {t.todayBtn}
                        </button>
                        <div className="w-px h-3 bg-border-subtle mx-0.5" />
                        <div className="flex items-center cursor-pointer active:scale-95 transition-transform overflow-hidden px-1">
                            <StandardDatePicker
                                value={toDateStr(anchor)}
                                onChange={(val) => {
                                    const d = new Date(val);
                                    if (!isNaN(d.getTime())) setAnchor(d);
                                }}
                                hideIcon
                                className="[&_label]:hidden [&>div]:!bg-transparent [&>div]:!border-none [&>div]:!shadow-none [&_input]:!p-0 [&_input]:!h-auto [&_input]:!text-[11px] [&_input]:!font-black [&_input]:!text-primary [&_input]:text-center [&_input]:!w-24 [&_input]:!bg-transparent"
                            />
                        </div>
                        <div className="w-px h-3 bg-border-subtle mx-0.5 hidden sm:block" />
                        <button onClick={() => nav(1)} 
                            className="w-10 sm:w-9 h-full flex items-center justify-center rounded-xl hover:bg-indigo-50 text-muted hover:text-[#6d28d9] transition-all active:scale-95">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Bottom Header Row: Hall filters + PDF + Add Action */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Hall Filters Block */}
                <div className="flex flex-wrap items-center gap-2 bg-surface/30 border border-border-subtle p-1 rounded-2xl max-w-fit">
                    <button
                        onClick={() => setFilterHall('all')}
                        className={cn('flex items-center gap-2 px-3 h-8 rounded-xl text-[9px] font-bold tracking-widest border transition-all shadow-sm',
                            filterHall === 'all' ? 'bg-[#6d28d9] border-[#6d28d9] text-white' : 'bg-card border-border-subtle text-muted/60')}
                    >
                        <LayoutGrid className="w-3 h-3" />
                        {lang === 'ka' ? 'ყველა' : t.allHalls}
                    </button>
                    {halls.map((h: any) => (
                        <button key={h.id}
                            onClick={() => setFilterHall(filterHall === h.id ? 'all' : h.id)}
                            className={cn('flex items-center gap-2 px-3 h-8 rounded-xl text-[9px] font-bold tracking-widest border transition-all shadow-sm',
                                filterHall === h.id ? 'opacity-100 shadow-md ring-2 ring-offset-1 scale-105' : 'opacity-60 hover:opacity-100')}
                            style={{ 
                                backgroundColor: filterHall === h.id ? h.color : 'transparent', 
                                borderColor: h.color + '60', 
                                color: filterHall === h.id ? 'white' : h.color,
                                boxShadow: filterHall === h.id ? `0 4px 12px ${h.color}40` : '',
                                '--ring-color': h.color
                            } as any}>
                            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", filterHall === h.id ? "bg-white" : "")} 
                                 style={{ backgroundColor: filterHall === h.id ? 'white' : h.color }} />
                            {(t as any)[h.name] || h.name}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    {/* Sync Action */}
                    {canEdit && (
                        <button onClick={syncAllGroups}
                            title={lang === 'ka' ? 'ჯგუფების კალენდართან სინქრონიზაცია' : 'Sync all groups to calendar'}
                            className="flex items-center justify-center w-11 h-11 bg-surface border border-border-subtle hover:border-[#6d28d9]/40 text-muted hover:text-[#6d28d9] rounded-2xl transition-all shadow-sm group">
                            <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                        </button>
                    )}

                    {/* PDF Export */}
                    <button onClick={exportPDF}
                        className="flex items-center justify-center w-11 h-11 bg-surface border border-border-subtle hover:border-[#6d28d9]/40 text-muted hover:text-[#6d28d9] rounded-2xl transition-all shadow-sm group">
                        <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </button>

                    {/* Add Event */}
                    {canEdit && (
                        <button onClick={() => setAddDate(toDateStr(new Date()))}
                            className="flex items-center justify-center gap-2 h-11 px-5 bg-[#6d28d9] hover:bg-indigo-600 active:scale-95 text-white text-[10px] font-black tracking-widest rounded-2xl shadow-lg shadow-[#6d28d9]/20 transition-all">
                            <CalendarPlus className="w-4 h-4" />
                            <span className="hidden sm:inline">{t.addEvent}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ═══ DAY VIEW ════════════════════════════════════════════ */}
            {view === 'day' && (
                <div className="flex-1 bg-surface/50 border border-border-subtle rounded-3xl overflow-hidden shadow-xl shadow-black/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle/50 bg-surface/30">
                        <p className="text-[10px] font-black tracking-[0.2em] text-muted opacity-40">{formatDate(anchor, 'long')}</p>
                        <p className="text-[10px] font-black tracking-[0.2em] text-[#6d28d9]/60">{toDateStr(anchor)}</p>
                    </div>

                    <div className="overflow-y-auto max-h-[calc(100vh-320px)] scrollbar-thin scrollbar-thumb-border-subtle relative" ref={dayGridRef}>
                        <div className="grid grid-cols-[64px_1fr] relative min-h-[1008px]">
                            {/* Time labels column */}
                            <div className="sticky left-0 z-20 bg-card border-r border-border-subtle/40">
                                {TIME_SLOTS.map((slot, i) => (
                                    <div key={slot} className={cn(
                                        "h-[18px] px-2 text-right relative transition-all",
                                        slot.endsWith(':00') ? "bg-surface/10" : "bg-transparent"
                                    )}>
                                        {slot.endsWith(':00') ? (
                                            <span className="absolute right-2 -top-[7px] text-[10px] text-muted/60 font-black tabular-nums leading-none">{slot}</span>
                                        ) : slot.endsWith(':30') ? (
                                            <span className="absolute right-2 -top-[6px] text-[8px] text-muted/20 font-bold tabular-nums leading-none">
                                                {slot.split(':')[1]}
                                            </span>
                                        ) : null}
                                    </div>
                                ))}
                            </div>

                            {/* Day Column */}
                            <div className="relative border-r border-border-subtle">
                                <GridLines onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const y = e.clientY - rect.top;
                                    const totalMins = (y / 72) * 60;
                                    const snappedMins = Math.floor(totalMins / 15) * 15;
                                    const h = 8 + Math.floor(snappedMins / 60);
                                    const m = snappedMins % 60;
                                    setAddDate(toDateStr(anchor));
                                    setAddTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
                                }} />

                                {/* Events Layer */}
                                <div className="absolute inset-0 pointer-events-none">
                                    {getProcessedEvents(dayEvents(toDateStr(anchor))).map(({ ev, colIdx, totalCols }) => {
                                        const startMins = timeToMins(ev.start_time);
                                        const endMins = timeToMins(ev.end_time);
                                        const duration = endMins - startMins;

                                        // Exact 18px per 15 mins. 1 hour = 72px.
                                        // Start is relative to START_HOUR
                                        const startOffsetMins = startMins - (START_HOUR * 60);
                                        const top = (startOffsetMins / 15) * 18;
                                        const height = (duration / 15) * 18;

                                        const widthPct = 100 / totalCols;
                                        const leftPct = colIdx * widthPct;

                                        return (
                                            <div key={ev.id} className="absolute pointer-events-auto px-[1px]"
                                                style={{
                                                    top: `${top}px`,
                                                    height: `${height}px`,
                                                    left: `${leftPct}%`,
                                                    width: `${widthPct}%`
                                                }}>
                                                <EventChip
                                                    ev={ev}
                                                    onClick={() => setSelectedEv(ev)}
                                                    onMouseDown={(e) => handleDragStart(e, ev)}
                                                    onTouchStart={(e) => handleTouchStart(e, ev)}
                                                    canEdit={canEdit}
                                                    teachers={teachers}
                                                    halls={halls}
                                                    groups={groups}
                                                    className="h-full border-white/10"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ WEEK VIEW ══════════════════════════════════════════ */}
            {view === 'week' && (
                <div className="flex-1 bg-surface/50 border border-border-subtle rounded-3xl overflow-hidden shadow-xl shadow-black/5 animate-in fade-in zoom-in-95 duration-500">
                    {/* Day header */}
                    <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-border-subtle/50 bg-surface/30">
                        <div className="border-r border-border-subtle/40" />
                        {weekDates.map((d, i) => {
                            const isToday = toDateStr(d) === toDateStr(new Date());
                            return (
                                <div key={i} className={cn('py-3.5 text-center border-r border-border-subtle/40 last:border-r-0 transition-colors', isToday ? 'bg-[#6d28d9]/5' : '')}>
                                    <p className="text-[10px] text-muted tracking-widest font-black opacity-40">{DAYS[d.getDay()]}</p>
                                    <p className={cn('text-base font-black mt-1', isToday ? 'text-[#6d28d9] underline decoration-2 underline-offset-4' : 'text-primary')}>{d.getDate()}</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Time labels & Day Columns */}
                    <div className="flex-1 overflow-y-auto max-h-[calc(100vh-320px)] scrollbar-thin scrollbar-thumb-border-subtle relative" ref={weekGridRef}>
                        <div className="grid grid-cols-[64px_repeat(7,1fr)] relative min-h-[1008px]">
                            {/* Time labels column */}
                            <div className="sticky left-0 z-20 bg-card border-r border-border-subtle/40">
                                {TIME_SLOTS.map((slot, i) => (
                                    <div key={slot} className={cn(
                                        "h-[18px] px-2 text-right relative transition-all",
                                        slot.endsWith(':00') ? "bg-surface/10" : "bg-transparent"
                                    )}>
                                        {slot.endsWith(':00') ? (
                                            <span className="absolute right-2 -top-[7px] text-[10px] text-muted/60 font-black tabular-nums leading-none">{slot}</span>
                                        ) : slot.endsWith(':30') ? (
                                            <span className="absolute right-2 -top-[6px] text-[8px] text-muted/20 font-bold tabular-nums leading-none">
                                                {slot.split(':')[1]}
                                            </span>
                                        ) : null}
                                    </div>
                                ))}
                            </div>

                            {/* day columns */}
                            {weekDates.map((d, di) => {
                                const dateStr = toDateStr(d);
                                const evs = dayEvents(dateStr);
                                const isToday = dateStr === toDateStr(new Date());

                                return (
                                    <div key={di} className={cn("relative border-r border-border-subtle/40 last:border-r-0", (isToday && hasMounted) ? "bg-[#6d28d9]/[0.02]" : "")}>
                                        <GridLines onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const y = e.clientY - rect.top;
                                            const totalMins = (y / 72) * 60;
                                            const snappedMins = Math.floor(totalMins / 15) * 15;
                                            const h = 8 + Math.floor(snappedMins / 60);
                                            const m = snappedMins % 60;
                                            setAddDate(dateStr);
                                            setAddTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
                                        }} />

                                        {/* Events Layer */}
                                        <div className="absolute inset-0 pointer-events-none">
                                            {getProcessedEvents(evs).map(({ ev, colIdx, totalCols }) => {
                                                const startMins = timeToMins(ev.start_time);
                                                const endMins = timeToMins(ev.end_time);
                                                const duration = endMins - startMins;

                                                // Exact 18px per 15 mins. 1 hour = 72px.
                                                // Start is relative to START_HOUR
                                                const startOffsetMins = startMins - (START_HOUR * 60);
                                                const top = (startOffsetMins / 15) * 18;
                                                const height = (duration / 15) * 18;

                                                const widthPct = 100 / totalCols;
                                                const leftPct = colIdx * widthPct;

                                                return (
                                                    <div key={ev.id} className="absolute pointer-events-auto px-[1px]"
                                                        style={{
                                                            top: `${top}px`,
                                                            height: `${height}px`,
                                                            left: `${leftPct}%`,
                                                            width: `${widthPct}%`
                                                        }}>
                                                        <EventChip
                                                            ev={ev}
                                                            onClick={() => setSelectedEv(ev)}
                                                            onMouseDown={(e) => handleDragStart(e, ev)}
                                                            onTouchStart={(e) => handleTouchStart(e, ev)}
                                                            canEdit={canEdit}
                                                            teachers={teachers}
                                                            halls={halls}
                                                            groups={groups}
                                                            className="h-full border-white/20"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}


            {/* ═══ MONTH VIEW ═════════════════════════════════════════ */}
            {view === 'month' && (
                <div className="flex-1 bg-card border border-border-subtle rounded-3xl overflow-hidden shadow-xl shadow-black/5 animate-in fade-in zoom-in-95 duration-500">
                    {/* Day names */}
                    <div className="grid grid-cols-7 border-b border-border-subtle/50 bg-surface/30">
                        {DAYS.map(d => (
                            <div key={d} className="py-3 text-center text-[10px] font-black text-muted tracking-widest opacity-40 border-r border-border-subtle/40 last:border-0">{d}</div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 auto-rows-[minmax(100px,_1fr)]">
                        {/* Empty cells before month start */}
                        {Array.from({ length: firstDow }, (_, i) => (
                            <div key={`pre${i}`} className="border-b border-r border-border-subtle/20 bg-surface/10 opacity-50" />
                        ))}

                        {monthDays.map((d, i) => {
                            const dateStr = toDateStr(d);
                            const evs = dayEvents(dateStr);
                            const isToday = dateStr === toDateStr(new Date());
                            const col = (firstDow + i) % 7;
                            return (
                                <div key={dateStr}
                                    className={cn('border-b border-r border-border-subtle/40 p-2 cursor-pointer hover:bg-surface/40 transition-all min-h-[100px] flex flex-col',
                                        col === 6 ? 'border-r-0' : '',
                                        (isToday && hasMounted) ? 'bg-[#6d28d9]/5' : '')}
                                    onClick={() => { setAddDate(dateStr); setAddTime(null); }}>
                                    <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-black mb-1 shadow-sm',
                                        isToday ? 'bg-[#6d28d9] text-white' : 'text-primary/70 bg-surface/50')}>
                                        {d.getDate()}
                                    </span>
                                    <div className="flex-1 space-y-0.5 overflow-hidden">
                                        {evs.slice(0, 5).map(ev => (
                                            <EventChip
                                                key={ev.id}
                                                ev={ev}
                                                onClick={() => setSelectedEv(ev)}
                                                teachers={teachers}
                                                halls={halls}
                                                groups={groups}
                                                compact={true}
                                                canEdit={canEdit}
                                            />
                                        ))}
                                        {evs.length > 5 && <p className="text-[8px] text-muted font-bold pl-1 opacity-50">+{evs.length - 5}</p>}
                                    </div>
                                </div>
                            );
                        })}
                        {/* Fill empty cells at end */}
                        {Array.from({ length: (7 - ((firstDow + monthDays.length) % 7)) % 7 }, (_, i) => (
                            <div key={`post${i}`} className="border-b border-r border-border-subtle/20 bg-surface/10 opacity-50 last:border-r-0" />
                        ))}
                    </div>
                </div>
            )}

            {/* Modals */}
            {selectedEv && (
                <EventPopup
                    ev={selectedEv}
                    onClose={() => setSelectedEv(null)}
                    onDelete={() => { deleteEvent(selectedEv!!.id); setSelectedEv(null); }}
                    onDeleteAll={() => { deleteAllGroupOccurrences(selectedEv!!); setSelectedEv(null); }}
                    onUpdate={(updated) => { updateEvent(updated); setSelectedEv(null); }}
                    onUpdateSeries={(updated, days) => { updateEventSeries(updated, days); setSelectedEv(null); }}
                    canEdit={canEdit}
                    teachers={teachers}
                    halls={halls}
                    groups={groups}
                />
            )}
            {addDate && (
                <AddEventModal
                    defaultDate={addDate}
                    defaultTime={addTime || undefined}
                    onClose={() => { setAddDate(null); setAddTime(null); }}
                    canEdit={canEdit}
                    onAdd={(evs) => { addEvents(evs); setAddDate(null); setAddTime(null); }}
                    teachers={teachers}
                    halls={halls}
                    groups={groups}
                />
            )}

            {dragConfirm && (
                <DragConfirmModal
                    ev={dragConfirm.ev}
                    newDate={dragConfirm.newDate}
                    newStart={dragConfirm.newStart}
                    newEnd={dragConfirm.newEnd}
                    onCancel={() => setDragConfirm(null)}
                    onThisOnly={() => {
                        const updated = {
                            ...dragConfirm.ev,
                            date: dragConfirm.newDate,
                            start_time: dragConfirm.newStart,
                            end_time: dragConfirm.newEnd,
                            recurring: 'none' as any,
                            group_id: undefined // De-link from group template to maintain independence
                        };
                        updateEvent(updated, false); // Don't sync to group template
                        setDragConfirm(null);
                    }}
                    onAllOccurrences={() => {
                        const updated = { ...dragConfirm.ev, date: dragConfirm.newDate, start_time: dragConfirm.newStart, end_time: dragConfirm.newEnd };
                        const day = new Date(dragConfirm.newDate + 'T00:00:00').getDay();
                        const existingDays: Record<number, { active: boolean; start: string; end: string }> = {
                            1: { active: false, start: '', end: '' },
                            2: { active: false, start: '', end: '' },
                            3: { active: false, start: '', end: '' },
                            4: { active: false, start: '', end: '' },
                            5: { active: false, start: '', end: '' },
                            6: { active: false, start: '', end: '' },
                            0: { active: false, start: '', end: '' },
                        };
                        existingDays[day] = { active: true, start: dragConfirm.newStart, end: dragConfirm.newEnd };
                        updateEventSeries(updated, existingDays);
                        setDragConfirm(null);
                    }}
                />
            )}

            {ghostStyle.visible && ghostStyle.ev && (
                <div className="fixed pointer-events-none z-[100] opacity-60 shadow-2xl"
                    style={{
                        top: ghostStyle.y,
                        left: ghostStyle.x,
                        width: ghostStyle.width,
                        height: ghostStyle.height
                    }}>
                    <EventChip
                        ev={ghostStyle.ev}
                        onClick={() => { }}
                        canEdit={canEdit}
                        teachers={teachers}
                        halls={halls}
                        groups={groups}
                        className="h-full border-2 border-[#6d28d9] animate-pulse"
                    />
                </div>
            )}
        </div>
    );
}
