'use client';

import { useState, useMemo } from 'react';
import {
    ChevronLeft, ChevronRight, Plus, X, Download,
    FileSpreadsheet, FileText, CalendarDays, LayoutGrid,
    Clock, DoorOpen, UserCheck, BookOpen, Link,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';
import type { CalendarEvent, EventType } from '@/types';

/* ─── Constants ──────────────────────────────────────────────── */

const GEO_DAYS = ['კვ', 'ორ', 'სამ', 'ოთ', 'ხუ', 'პარ', 'შაბ'];
const GEO_MONTHS = ['იანვარი', 'თებ.', 'მარ.', 'აპრ.', 'მაი.', 'ივნ.', 'ივლ.', 'აგვ.', 'სექ.', 'ოქტ.', 'ნოე.', 'დეკ.'];

const HALLS = [
    { id: 'h1', name: 'დარბაზი A', color: '#6366f1' },
    { id: 'h2', name: 'დარბაზი B', color: '#10b981' },
    { id: 'h3', name: 'სტუდია', color: '#f59e0b' },
];

const TEACHERS = [
    { id: 't1', name: 'ნინო ბ.' },
    { id: 't2', name: 'გიორგი კ.' },
    { id: 't3', name: 'სოფო კ.' },
];

const HALL_COLORS: Record<string, string> = Object.fromEntries(HALLS.map(h => [h.id, h.color]));

const EVENT_TYPES: { value: EventType; label: string }[] = [
    { value: 'group_class', label: 'ჯგუფური გაკ.' },
    { value: 'individual', label: 'ინდ. გაკ.' },
    { value: 'rental', label: 'გაქირავება' },
    { value: 'other', label: 'სხვა' },
];

const TIME_SLOTS = Array.from({ length: 14 }, (_, i) => `${(8 + i).toString().padStart(2, '0')}:00`); // 08:00-21:00

/* ─── Helpers ────────────────────────────────────────────────── */

function toDateStr(d: Date) {
    return d.toISOString().slice(0, 10);
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

function timeToMins(t: string) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function colorBg(hex: string) { return hex + '28'; }
function colorBorder(hex: string) { return hex + '66'; }

/* ─── Mock seed events ───────────────────────────────────────── */

const TODAY = new Date();

function makeEvent(id: string, title: string, type: EventType, hallId: string, teacherId: string, dayOffset: number, start: string, end: string, recurring: 'none' | 'weekly' = 'none'): CalendarEvent {
    const d = new Date(TODAY);
    d.setDate(TODAY.getDate() + dayOffset);
    return { id, org_id: 'demo', title, type, hall_id: hallId, teacher_id: teacherId, date: toDateStr(d), start_time: start, end_time: end, color: HALL_COLORS[hallId], recurring, created_at: '' };
}

const SEED_WEEK: CalendarEvent[] = [
    makeEvent('e1', 'Contemporary Dance', 'group_class', 'h1', 't1', 0, '09:00', '10:30', 'weekly'),
    makeEvent('e2', 'Ballet Beginners', 'group_class', 'h2', 't2', 0, '11:00', '12:30', 'weekly'),
    makeEvent('e3', 'ინდ. გაკ. — ნინო ბ.', 'individual', 'h3', 't1', 0, '14:00', '15:00'),
    makeEvent('e4', 'Hip-Hop Kids', 'group_class', 'h1', 't2', 1, '10:00', '11:30', 'weekly'),
    makeEvent('e5', 'Latin Dance', 'group_class', 'h2', 't3', 1, '17:00', '18:30', 'weekly'),
    makeEvent('e6', 'Salsa Intermediate', 'group_class', 'h1', 't3', 2, '18:00', '19:30', 'weekly'),
    makeEvent('e7', 'Ballet Advanced', 'group_class', 'h2', 't2', 2, '10:00', '11:30', 'weekly'),
    makeEvent('e8', 'ინდ. გაკ. — ანა ჩ.', 'individual', 'h3', 't1', 2, '16:00', '17:00'),
    makeEvent('e9', 'დარბ. A — ილიაუნი', 'rental', 'h1', 't1', 3, '13:00', '18:00'),
    makeEvent('e10', 'Contemporary Dance', 'group_class', 'h1', 't1', 4, '09:00', '10:30', 'weekly'),
    makeEvent('e11', 'Jazz Dance', 'group_class', 'h2', 't1', 4, '11:00', '12:30', 'weekly'),
    makeEvent('e12', 'ინდ. გაკ. — გ.კ.', 'individual', 'h3', 't2', 5, '15:00', '16:00'),
    makeEvent('e13', 'Latin Dance', 'group_class', 'h1', 't3', 6, '11:00', '12:30', 'weekly'),
];

// Expand weekly recurrences ±2 weeks
function expandEvents(base: CalendarEvent[]): CalendarEvent[] {
    const expanded: CalendarEvent[] = [];
    base.forEach(ev => {
        expanded.push(ev);
        if (ev.recurring === 'weekly') {
            for (let w = -2; w <= 2; w++) {
                if (w === 0) continue;
                const d = new Date(ev.date);
                d.setDate(d.getDate() + w * 7);
                expanded.push({ ...ev, id: `${ev.id}_w${w}`, date: toDateStr(d) });
            }
        }
    });
    return expanded;
}

const ALL_EVENTS = expandEvents(SEED_WEEK);

/* ─── EventChip component ────────────────────────────────────── */

function EventChip({ ev, onClick }: { ev: CalendarEvent; onClick: () => void }) {
    const hall = HALLS.find(h => h.id === ev.hall_id);
    const color = hall?.color ?? '#6366f1';
    return (
        <button onClick={e => { e.stopPropagation(); onClick(); }}
            className="w-full text-left px-2 py-1 rounded-lg mb-0.5 text-[10px] font-semibold leading-tight transition-all hover:brightness-110 truncate shadow-sm"
            style={{ background: colorBg(color), border: `1px solid ${colorBorder(color)}`, color }}>
            {ev.start_time} {ev.title}
        </button>
    );
}

/* ─── Event Detail Popup ─────────────────────────────────────── */

function EventPopup({ ev, onClose, onDelete }: { ev: CalendarEvent; onClose: () => void; onDelete: () => void }) {
    const hall = HALLS.find(h => h.id === ev.hall_id);
    const teacher = TEACHERS.find(t => t.id === ev.teacher_id);
    const color = hall?.color ?? '#6366f1';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative z-10 w-full max-w-xs bg-card border border-border-subtle rounded-2xl shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
                {/* Title + close */}
                <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1">
                        <p className="text-sm font-bold text-primary">{ev.title}</p>
                        <p className="text-[10px] text-muted mt-0.5">
                            {EVENT_TYPES.find(t => t.value === ev.type)?.label}
                            {ev.recurring === 'weekly' && ' · ყოველ კვ.'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-muted hover:text-primary transition-colors"><X className="w-4 h-4" /></button>
                </div>

                <div className="space-y-2.5 text-xs text-muted">
                    <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 opacity-40" />{ev.date} · {ev.start_time} – {ev.end_time}</div>
                    {hall && <div className="flex items-center gap-2"><DoorOpen className="w-3.5 h-3.5" style={{ color }} /><span style={{ color }}>{hall.name}</span></div>}
                    {teacher && <div className="flex items-center gap-2"><UserCheck className="w-3.5 h-3.5 opacity-40" />{teacher.name}</div>}
                    {ev.notes && <div className="flex items-start gap-2"><BookOpen className="w-3.5 h-3.5 opacity-40 mt-0.5" />{ev.notes}</div>}
                </div>

                <div className="flex gap-2 pt-1">
                    <button onClick={onDelete}
                        className="flex-1 py-2 border border-red-500/20 text-red-500/70 hover:text-red-500 hover:bg-red-500/5 text-xs rounded-xl transition-all">
                        წაშლა
                    </button>
                    <button onClick={onClose}
                        className="flex-1 py-2 bg-surface hover:bg-surface/80 text-primary text-xs rounded-xl transition-all font-medium border border-border-subtle/50">
                        დახურვა
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Add Event Form ─────────────────────────────────────────── */

const EMPTY_EV = { title: '', type: 'group_class' as EventType, hall_id: 'h1', teacher_id: 't1', date: '', start_time: '09:00', end_time: '10:30', notes: '', recurring: 'none' as const };

function AddEventModal({ defaultDate, onClose, onAdd }: { defaultDate: string; onClose: () => void; onAdd: (ev: CalendarEvent) => void }) {
    const [form, setForm] = useState({ ...EMPTY_EV, date: defaultDate });
    function setF(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

    function save() {
        if (!form.title.trim()) return;
        const hallColor = HALL_COLORS[form.hall_id] ?? '#6366f1';
        onAdd({ ...form, id: String(Date.now()), org_id: 'demo', color: hallColor, created_at: new Date().toISOString() });
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in slide-in-from-bottom-4 duration-300" onClick={onClose}>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative z-10 w-full max-w-sm bg-card border border-border-subtle rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                    <h2 className="text-sm font-bold text-primary">ახალი ღონისძიება</h2>
                    <button onClick={onClose} className="text-muted hover:text-primary transition-colors"><X className="w-4 h-4" /></button>
                </div>

                <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
                    <input value={form.title} onChange={e => setF('title', e.target.value)} placeholder="სათაური *"
                        className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/50 outline-none transition-all" />

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] text-muted mb-1 block uppercase tracking-wider font-bold opacity-70">ტიპი</label>
                            <select value={form.type} onChange={e => setF('type', e.target.value)}
                                className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-primary outline-none transition-all">
                                {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-muted mb-1 block uppercase tracking-wider font-bold opacity-70">გამეორება</label>
                            <select value={form.recurring} onChange={e => setF('recurring', e.target.value)}
                                className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-primary outline-none transition-all">
                                <option value="none">ერთჯერ.</option>
                                <option value="weekly">ყ. კვირა</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] text-muted mb-1 block uppercase tracking-wider font-bold opacity-70">დარბაზი</label>
                        <select value={form.hall_id} onChange={e => setF('hall_id', e.target.value)}
                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-primary outline-none transition-all">
                            {HALLS.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] text-muted mb-1 block uppercase tracking-wider font-bold opacity-70">მასწავლებელი</label>
                        <select value={form.teacher_id} onChange={e => setF('teacher_id', e.target.value)}
                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-primary outline-none transition-all">
                            {TEACHERS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="text-[10px] text-muted mb-1 block uppercase tracking-wider font-bold opacity-70">თარიღი</label>
                            <input type="date" value={form.date} onChange={e => setF('date', e.target.value)}
                                className="w-full bg-surface border border-border-subtle rounded-xl px-2 py-2.5 text-xs text-primary outline-none transition-all" />
                        </div>
                        <div>
                            <label className="text-[10px] text-muted mb-1 block uppercase tracking-wider font-bold opacity-70">დასაწ.</label>
                            <input type="time" value={form.start_time} onChange={e => setF('start_time', e.target.value)}
                                className="w-full bg-surface border border-border-subtle rounded-xl px-2 py-2.5 text-xs text-primary outline-none transition-all" />
                        </div>
                        <div>
                            <label className="text-[10px] text-muted mb-1 block uppercase tracking-wider font-bold opacity-70">დასასრ.</label>
                            <input type="time" value={form.end_time} onChange={e => setF('end_time', e.target.value)}
                                className="w-full bg-surface border border-border-subtle rounded-xl px-2 py-2.5 text-xs text-primary outline-none transition-all" />
                        </div>
                    </div>

                    <textarea value={form.notes} onChange={e => setF('notes', e.target.value)} rows={2} placeholder="შენიშვნა..."
                        className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2 text-xs text-primary placeholder:text-muted/40 outline-none resize-none transition-all" />
                </div>

                <div className="px-5 py-4 border-t border-border-subtle flex gap-2">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 border border-border-subtle text-muted hover:text-primary hover:bg-surface text-sm rounded-xl transition-all">გაუქ.</button>
                    <button onClick={save} disabled={!form.title.trim()}
                        className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                        შემატება
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Export helpers ─────────────────────────────────────────── */

function exportIcal(events: CalendarEvent[]) {
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//StudioFlow//Calendar//GEO',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
    ];
    events.forEach(ev => {
        const hall = HALLS.find(h => h.id === ev.hall_id);
        const teacher = TEACHERS.find(t => t.id === ev.teacher_id);
        const start = ev.date.replace(/-/g, '') + 'T' + ev.start_time.replace(':', '') + '00';
        const end = ev.date.replace(/-/g, '') + 'T' + ev.end_time.replace(':', '') + '00';
        lines.push(
            'BEGIN:VEVENT',
            `UID:${ev.id}@studioflow.ge`,
            `DTSTART;TZID=Asia/Tbilisi:${start}`,
            `DTEND;TZID=Asia/Tbilisi:${end}`,
            `SUMMARY:${ev.title}`,
            `DESCRIPTION:${teacher ? `მასწ: ${teacher.name}` : ''}`,
            `LOCATION:${hall?.name ?? ''}`,
            'END:VEVENT',
        );
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'studioflow_calendar.ics'; a.click();
    URL.revokeObjectURL(url);
}

async function exportExcel(events: CalendarEvent[]) {
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
            'გამეორება': ev.recurring === 'weekly' ? 'ყ. კვ.' : 'ერთჯ.',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'კალენდარი');
        XLSX.writeFile(wb, `studioflow_calendar_${new Date().toISOString().slice(0, 10)}.xlsx`);
        */
    } catch (err) {
        console.error('XLSX export failed:', err);
        alert('Excel-ის ექსპორტისთვის საჭიროა ბიბლიოთეკა. გთხოვთ გაუშვათ: npm install xlsx');
    }
}

async function exportPDF(events: CalendarEvent[]) {
    try {
        // const { jsPDF } = await import('jspdf');
        // const { default: autoTable } = await import('jspdf-autotable');
        alert('PDF-ის ექსპორტისთვის საჭიროა ბიბლიოთეკები. გთხოვთ გაუშვათ: npm install jspdf jspdf-autotable');
        /*
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(13);
        doc.text('StudioFlow — კალენდარი', 14, 18);
        doc.setFontSize(9);
        doc.text(`Generated: ${new Date().toLocaleDateString('ka-GE')}`, 14, 26);
        autoTable(doc, {
            startY: 32,
            head: [['სათ.', 'ტიპი', 'თარ.', 'დასაწ.', 'დასასრ.', 'დარბ.', 'მასწ.']],
            body: events.map(ev => [
                ev.title,
                EVENT_TYPES.find(t => t.value === ev.type)?.label ?? ev.type,
                ev.date, ev.start_time, ev.end_time,
                HALLS.find(h => h.id === ev.hall_id)?.name ?? '',
                TEACHERS.find(t => t.id === ev.teacher_id)?.name ?? '',
            ]),
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229], textColor: 255 },
        });
        doc.save(`studioflow_calendar_${new Date().toISOString().slice(0, 10)}.pdf`);
        */
    } catch (err) {
        console.error('PDF export failed:', err);
        alert('PDF-ის ექსპორტისთვის საჭიროა ბიბლიოთეკები. გთხოვთ გაუშვათ: npm install jspdf jspdf-autotable');
    }
}

/* ─── Main Calendar Page ─────────────────────────────────────── */

export default function CalendarPage() {
    const { t } = useT();
    const [view, setView] = useState<'week' | 'month'>('week');
    const [anchor, setAnchor] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>(ALL_EVENTS);
    const [filterHall, setFilterHall] = useState<string>('all');
    const [filterTeacher, setFilterTeacher] = useState<string>('all');
    const [selectedEv, setSelectedEv] = useState<CalendarEvent | null>(null);
    const [addDate, setAddDate] = useState<string | null>(null);

    // Filtered events
    const filtered = useMemo(() => events.filter(ev =>
        (filterHall === 'all' || ev.hall_id === filterHall) &&
        (filterTeacher === 'all' || ev.teacher_id === filterTeacher)
    ), [events, filterHall, filterTeacher]);

    // Week navigation
    const weekDates = getWeekDates(anchor);
    const weekLabel = `${weekDates[0].getDate()} ${GEO_MONTHS[weekDates[0].getMonth()]} – ${weekDates[6].getDate()} ${GEO_MONTHS[weekDates[6].getMonth()]} ${weekDates[6].getFullYear()}`;

    // Month navigation
    const monthYear = { y: anchor.getFullYear(), m: anchor.getMonth() };
    const monthDays = getDaysInMonth(monthYear.y, monthYear.m);
    const firstDow = (monthDays[0].getDay() + 6) % 7; // Mon=0
    const monthLabel = `${GEO_MONTHS[monthYear.m]} ${monthYear.y}`;

    function nav(dir: 1 | -1) {
        const d = new Date(anchor);
        view === 'week' ? d.setDate(d.getDate() + dir * 7) : d.setMonth(d.getMonth() + dir);
        setAnchor(d);
    }

    function addEvent(ev: CalendarEvent) { setEvents(p => [...p, ev]); }
    function deleteEvent(id: string) { setEvents(p => p.filter(e => e.id !== id)); }

    // Events on a specific date
    function dayEvents(dateStr: string) {
        return filtered.filter(e => e.date === dateStr).sort((a, b) => a.start_time.localeCompare(b.start_time));
    }

    // Events for a time slot in week view
    function slotEvents(dateStr: string, slotHour: string) {
        const slotMins = timeToMins(slotHour);
        return filtered.filter(e => e.date === dateStr && timeToMins(e.start_time) >= slotMins && timeToMins(e.start_time) < slotMins + 60);
    }

    return (
        <div className="flex flex-col gap-5 animate-fade-up h-full pb-8">
            {/* ── Top bar */}
            <div className="flex flex-wrap items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold text-primary">{t.calendar}</h1>
                    <p className="text-sm text-muted font-medium opacity-70">{view === 'week' ? weekLabel : monthLabel}</p>
                </div>

                <div className="flex items-center gap-2 ml-auto flex-wrap">
                    {/* Nav */}
                    <div className="flex items-center gap-1 bg-surface border border-border-subtle rounded-xl p-1 shadow-sm">
                        <button onClick={() => nav(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-card text-muted hover:text-primary transition-all active:scale-95"><ChevronLeft className="w-4 h-4" /></button>
                        <button onClick={() => setAnchor(new Date())} className="px-3 h-8 text-xs font-bold rounded-lg hover:bg-card text-muted hover:text-primary transition-all uppercase tracking-wider">{t.todayBtn}</button>
                        <button onClick={() => nav(1)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-card text-muted hover:text-primary transition-all active:scale-95"><ChevronRight className="w-4 h-4" /></button>
                    </div>

                    {/* View toggle */}
                    <div className="flex bg-surface border border-border-subtle rounded-xl p-1 gap-1 shadow-sm">
                        {([['week', <CalendarDays key="w" className="w-3.5 h-3.5" />, t.weekView], ['month', <LayoutGrid key="m" className="w-3.5 h-3.5" />, t.monthView]] as const).map(([v, icon, lbl]) => (
                            <button key={v} onClick={() => setView(v as 'week' | 'month')}
                                className={cn('flex items-center gap-2 px-3 h-8 text-xs font-bold rounded-lg transition-all',
                                    view === v ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'text-muted hover:text-primary')}>
                                {icon}<span className="hidden sm:inline">{lbl}</span>
                            </button>
                        ))}
                    </div>

                    {/* Filters */}
                    <select value={filterHall} onChange={e => setFilterHall(e.target.value)}
                        className="h-10 bg-surface border border-border-subtle rounded-xl px-3 text-xs text-muted font-bold outline-none focus:border-indigo-500/40 shadow-sm transition-all cursor-pointer">
                        <option value="all">{t.allHalls}</option>
                        {HALLS.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>

                    <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}
                        className="h-10 bg-surface border border-border-subtle rounded-xl px-3 text-xs text-muted font-bold outline-none focus:border-indigo-500/40 shadow-sm transition-all cursor-pointer">
                        <option value="all">{t.allTeachers}</option>
                        {TEACHERS.map(tc => <option key={tc.id} value={tc.id}>{tc.name}</option>)}
                    </select>

                    {/* Add event */}
                    <button onClick={() => setAddDate(toDateStr(new Date()))}
                        className="flex items-center gap-2 h-10 px-4 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all">
                        <Plus className="w-4 h-4" />{t.addEvent}
                    </button>

                    {/* Export dropdown */}
                    <div className="relative group">
                        <button className="flex items-center gap-2 h-10 px-3 bg-surface border border-border-subtle hover:border-border-subtle/50 text-muted hover:text-primary rounded-xl transition-all shadow-sm">
                            <Download className="w-4 h-4" />
                        </button>
                        <div className="absolute right-0 top-full mt-2 w-44 bg-card border border-border-subtle rounded-2xl shadow-2xl overflow-hidden z-30 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all translate-y-2 group-hover:translate-y-0 p-1">
                            <button onClick={() => exportIcal(filtered)}
                                className="w-full px-3 py-2.5 text-left text-xs text-primary hover:bg-surface rounded-xl flex items-center gap-3 transition-colors">
                                <Link className="w-4 h-4 text-blue-500" /> iCal (.ics)
                            </button>
                            <button onClick={() => exportExcel(filtered)}
                                className="w-full px-3 py-2.5 text-left text-xs text-primary hover:bg-surface rounded-xl flex items-center gap-3 transition-colors">
                                <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Excel (.xlsx)
                            </button>
                            <button onClick={() => exportPDF(filtered)}
                                className="w-full px-3 py-2.5 text-left text-xs text-primary hover:bg-surface rounded-xl flex items-center gap-3 transition-colors">
                                <FileText className="w-4 h-4 text-red-500" /> PDF Document
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Hall legend */}
            <div className="flex flex-wrap gap-2">
                {HALLS.map(h => (
                    <button key={h.id}
                        onClick={() => setFilterHall(filterHall === h.id ? 'all' : h.id)}
                        className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all shadow-sm',
                            filterHall === h.id || filterHall === 'all' ? 'opacity-100 scale-100' : 'opacity-30 scale-95')}
                        style={{ background: h.color + '15', borderColor: h.color + '40', color: h.color }}>
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: h.color }} />
                        {h.name}
                    </button>
                ))}
            </div>

            {/* ═══ WEEK VIEW ══════════════════════════════════════════ */}
            {view === 'week' && (
                <div className="flex-1 bg-card border border-border-subtle rounded-3xl overflow-hidden shadow-xl shadow-black/5 animate-in fade-in zoom-in-95 duration-500">
                    {/* Day header */}
                    <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-border-subtle/50 bg-surface/30">
                        <div className="border-r border-border-subtle/40" />
                        {weekDates.map((d, i) => {
                            const isToday = toDateStr(d) === toDateStr(new Date());
                            return (
                                <div key={i} className={cn('py-3.5 text-center border-r border-border-subtle/40 last:border-r-0 transition-colors', isToday ? 'bg-indigo-500/5' : '')}>
                                    <p className="text-[10px] text-muted uppercase tracking-widest font-black opacity-40">{GEO_DAYS[i]}</p>
                                    <p className={cn('text-base font-black mt-1', isToday ? 'text-indigo-500 underline decoration-2 underline-offset-4' : 'text-primary')}>{d.getDate()}</p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Time slots */}
                    <div className="overflow-y-auto max-h-[calc(100vh-320px)] scrollbar-thin scrollbar-thumb-border-subtle">
                        {TIME_SLOTS.map(slot => (
                            <div key={slot} className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-border-subtle/20 min-h-[72px] group">
                                <div className="border-r border-border-subtle/40 px-2 pt-2 bg-surface/10">
                                    <span className="text-[10px] text-muted/40 font-bold tabular-nums">{slot}</span>
                                </div>
                                {weekDates.map((d, di) => {
                                    const dateStr = toDateStr(d);
                                    const evs = slotEvents(dateStr, slot);
                                    return (
                                        <div key={di}
                                            className="border-r border-border-subtle/20 last:border-0 p-1 cursor-pointer hover:bg-surface/30 transition-all"
                                            onClick={() => setAddDate(dateStr)}>
                                            {evs.map(ev => <EventChip key={ev.id} ev={ev} onClick={() => setSelectedEv(ev)} />)}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ MONTH VIEW ═════════════════════════════════════════ */}
            {view === 'month' && (
                <div className="flex-1 bg-card border border-border-subtle rounded-3xl overflow-hidden shadow-xl shadow-black/5 animate-in fade-in zoom-in-95 duration-500">
                    {/* Day names */}
                    <div className="grid grid-cols-7 border-b border-border-subtle/50 bg-surface/30">
                        {GEO_DAYS.map(d => (
                            <div key={d} className="py-3 text-center text-[10px] font-black text-muted uppercase tracking-widest opacity-40 border-r border-border-subtle/40 last:border-0">{d}</div>
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
                                    className={cn('border-b border-r border-border-subtle/20 p-2 cursor-pointer hover:bg-surface/40 transition-all min-h-[100px] flex flex-col',
                                        col === 6 ? 'border-r-0' : '',
                                        isToday ? 'bg-indigo-500/5' : '')}
                                    onClick={() => setAddDate(dateStr)}>
                                    <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black mb-2 shadow-sm',
                                        isToday ? 'bg-indigo-500 text-white' : 'text-primary/70 bg-surface/50')}>
                                        {d.getDate()}
                                    </span>
                                    <div className="flex-1 space-y-1">
                                        {evs.slice(0, 4).map(ev => {
                                            const color = HALL_COLORS[ev.hall_id ?? ''] ?? '#6366f1';
                                            return (
                                                <button key={ev.id}
                                                    onClick={e => { e.stopPropagation(); setSelectedEv(ev); }}
                                                    className="w-full truncate text-left px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all hover:brightness-110 shadow-sm border border-border-subtle/10"
                                                    style={{ background: colorBg(color), color }}>
                                                    {ev.title}
                                                </button>
                                            );
                                        })}
                                        {evs.length > 4 && <p className="text-[9px] text-muted font-bold pl-1 opacity-50">+{evs.length - 4} სხვ.</p>}
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
                <EventPopup ev={selectedEv} onClose={() => setSelectedEv(null)} onDelete={() => { deleteEvent(selectedEv.id); setSelectedEv(null); }} />
            )}
            {addDate && (
                <AddEventModal defaultDate={addDate} onClose={() => setAddDate(null)} onAdd={addEvent} />
            )}
        </div>
    );
}
