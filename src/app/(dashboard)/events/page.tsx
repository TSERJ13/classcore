'use client';

/**
 * Events — lightweight management page for one-off studio announcements
 * (campaigns, term starts, competitions), backed by the same
 * calendar_events table the Calendar page already writes to
 * (event-store.ts — that module hasn't moved to Server Actions yet, task
 * "Arch: Calendar/Events module to Server Actions" is still pending, so
 * this follows the same client-store convention rather than inventing a
 * second write path). Filtered to `type: 'other'` — the Calendar's own
 * "სხვა" event type — since a marketing campaign or competition isn't a
 * class/individual-lesson/rental booking. The dashboard's "Upcoming
 * Events" card reads the exact same data.
 */

import { useEffect, useState } from 'react';
import { Megaphone, Plus, Pencil, Trash2, X, Check, Calendar as CalendarIcon } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useStudio } from '@/contexts/StudioContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { getEvents, addEvent, updateEvent, deleteEvent } from '@/lib/event-store';
import { getLocalISODate } from '@/lib/utils';
import type { CalendarEvent } from '@/types';

type EventForm = { title: string; date: string; notes: string; color: string };
const EMPTY: EventForm = { title: '', date: getLocalISODate(new Date()), notes: '', color: '#f59e0b' };

export default function EventsPage() {
    const { lang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const { settings } = useStudio();
    const confirm = useConfirm();

    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<CalendarEvent | null>(null);
    const [form, setForm] = useState<EventForm>(EMPTY);

    const load = () => setEvents(getEvents().filter(e => e.type === 'other'));

    useEffect(() => {
        load();
        window.addEventListener('cc_calendar_events_update', load);
        return () => window.removeEventListener('cc_calendar_events_update', load);
    }, []);

    function openAdd() {
        setEditing(null);
        setForm(EMPTY);
        setShowForm(true);
    }

    function openEdit(ev: CalendarEvent) {
        setEditing(ev);
        setForm({ title: ev.title, date: ev.date, notes: ev.notes || '', color: ev.color || EMPTY.color });
        setShowForm(true);
    }

    function save() {
        if (!form.title.trim() || !form.date) return;
        if (editing) {
            updateEvent(editing.id, { title: form.title.trim(), date: form.date, notes: form.notes, color: form.color });
        } else {
            addEvent({
                id: `evt_${Date.now()}`,
                org_id: settings.orgId || 'demo',
                title: form.title.trim(),
                type: 'other',
                date: form.date,
                start_time: '00:00',
                end_time: '23:59',
                notes: form.notes,
                color: form.color,
                recurring: 'none',
                created_at: new Date().toISOString(),
            });
        }
        setShowForm(false);
        load();
    }

    async function remove(id: string) {
        if (!await confirm(l('წაშლა?', 'Удалить?', 'Delete?'))) return;
        deleteEvent(id);
        load();
    }

    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

    return (
        <div className="space-y-6 max-w-3xl mx-auto pb-10">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center flex-shrink-0">
                        <Megaphone className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-xl font-bold text-primary">{l('ღონისძიებები', 'События', 'Events')}</h1>
                        <p className="text-xs text-muted opacity-60">{l('კამპანიები, ვადები, ღონისძიებები', 'Кампании, сроки, события', 'Campaigns, deadlines, events')}</p>
                    </div>
                </div>
                <button onClick={openAdd}
                    className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-black text-xs px-4 h-11 rounded-xl tracking-wide shadow-lg shadow-indigo-500/25 transition-all flex-shrink-0">
                    <Plus className="w-4 h-4" />
                    <span>{l('დამატება', 'Добавить', 'Add')}</span>
                </button>
            </div>

            {sorted.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted opacity-40">
                    <Megaphone className="w-8 h-8 mb-2" />
                    <p className="text-xs font-bold">{l('ღონისძიება არ არის დაგეგმილი', 'Событий не запланировано', 'No events scheduled')}</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {sorted.map(ev => {
                        const d = new Date(ev.date);
                        return (
                            <div key={ev.id} className="flex items-center gap-4 bg-card border border-border-subtle rounded-2xl p-4 group">
                                <div className="w-12 h-12 rounded-xl bg-surface border border-border-subtle flex flex-col items-center justify-center flex-shrink-0">
                                    <span className="text-sm font-black text-primary leading-none">{d.getDate()}</span>
                                    <span className="text-[8px] font-bold text-muted uppercase leading-none mt-0.5">
                                        {d.toLocaleDateString(l('ka-GE', 'ru-RU', 'en-US'), { month: 'short' })}
                                    </span>
                                </div>
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color || '#f59e0b' }} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-primary truncate">{ev.title}</p>
                                    {ev.notes && <p className="text-xs text-muted opacity-60 truncate">{ev.notes}</p>}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button onClick={() => openEdit(ev)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors">
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => remove(ev.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showForm && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowForm(false)} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="bg-card border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
                                <h3 className="text-base font-bold text-primary flex items-center gap-2">
                                    <CalendarIcon className="w-4 h-4 text-indigo-500" />
                                    {editing ? l('ღონისძიების რედაქტირება', 'Редактировать событие', 'Edit event') : l('ახალი ღონისძიება', 'Новое событие', 'New event')}
                                </h3>
                                <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface text-muted transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="px-6 py-5 space-y-4">
                                <div>
                                    <label className="text-xs text-muted mb-1.5 block">{l('სახელი', 'Название', 'Title')} *</label>
                                    <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                        className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted mb-1.5 block">{l('თარიღი', 'Дата', 'Date')} *</label>
                                    <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                                        className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted mb-1.5 block">{l('აღწერა', 'Описание', 'Description')}</label>
                                    <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                                        rows={2}
                                        className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary outline-none resize-none" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted mb-1.5 block">{l('ფერი', 'Цвет', 'Color')}</label>
                                    <label className="flex items-center gap-3 bg-surface border border-border-subtle rounded-xl p-2 cursor-pointer">
                                        <span className="w-8 h-8 rounded-lg border border-black/10 flex-shrink-0 overflow-hidden relative">
                                            <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                                                className="absolute -inset-2 w-12 h-12 cursor-pointer opacity-0" />
                                            <div className="w-full h-full pointer-events-none" style={{ backgroundColor: form.color }} />
                                        </span>
                                        <span className="text-xs text-muted font-medium">{l('ფერის შერჩევა', 'Выбрать цвет', 'Choose color')}</span>
                                    </label>
                                </div>
                            </div>
                            <div className="flex gap-3 px-6 py-4 border-t border-border-subtle">
                                <button onClick={() => setShowForm(false)} className="flex-1 py-3 border border-border-subtle text-muted text-sm font-medium rounded-xl hover:bg-surface">
                                    {l('გაუქმება', 'Отмена', 'Cancel')}
                                </button>
                                <button onClick={save} disabled={!form.title.trim() || !form.date}
                                    className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
                                    <Check className="w-4 h-4" />
                                    {editing ? l('შენახვა', 'Сохранить', 'Save') : l('დამატება', 'Добавить', 'Add')}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
