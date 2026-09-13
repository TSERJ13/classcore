'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, CalendarClock, Clock } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/contexts/LanguageContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useUser } from '@/hooks/useUser';
import { useStudio } from '@/contexts/StudioContext';
import { cn, formatDate } from '@/lib/utils';
import { getHalls } from '@/lib/hall-store';
import { getOpenSlots, publishOpenSlot, deleteOpenSlot } from '@/lib/event-store';
import type { CalendarEvent } from '@/types';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { StandardDatePicker } from '@/components/ui/StandardDatePicker';
import { generateTimeOptions } from '@/lib/date-utils';

function addOneHour(timeStr: string): string {
    const [h, m] = timeStr.split(':').map(Number);
    return `${String((h + 1) % 24).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}

/**
 * 7B, open-slot path: lets a teacher (or an admin on their behalf) publish
 * free individual-lesson times ahead of any specific booking. Students/admins
 * pick from these in BookIndividualLessonModal instead of proposing an
 * arbitrary time — see docs/tasks.md Follow-up #11.
 */
export default function IndividualAvailabilityPage() {
    const { t } = useT();
    const confirm = useConfirm();
    const { profile } = useUser();
    const { settings } = useStudio();

    const isTeacher = profile?.role === 'teacher';
    const staff = (settings.staff || []).filter(s => s.role === 'teacher' || s.role === 'coach');
    const [teacherId, setTeacherId] = useState(isTeacher ? profile.id : (staff[0]?.id || ''));
    const halls = getHalls().filter(h => h.is_active !== false);

    const [slots, setSlots] = useState<CalendarEvent[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [hallId, setHallId] = useState(halls[0]?.id || '');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('18:00');
    const [endTime, setEndTime] = useState('19:00');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const timeOptions = generateTimeOptions();

    useEffect(() => {
        const load = () => setSlots(getOpenSlots(teacherId || undefined));
        load();
        window.addEventListener('cc_calendar_events_update', load);
        return () => window.removeEventListener('cc_calendar_events_update', load);
    }, [teacherId]);

    async function handlePublish() {
        setError('');
        setSaving(true);
        try {
            publishOpenSlot({ teacherId, hallId, date, startTime, endTime });
            setSlots(getOpenSlots(teacherId || undefined));
            setShowForm(false);
            setDate('');
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setError(message === 'SLOT_CONFLICT' ? t.slotConflict : message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (!(await confirm(t.deleteConfirm))) return;
        deleteOpenSlot(id);
        setSlots(getOpenSlots(teacherId || undefined));
    }

    return (
        <div className="space-y-8 max-w-3xl mx-auto pb-10">
            <div className="flex items-center gap-3">
                <Link href="/subscriptions" className="flex items-center justify-center w-12 h-12 bg-surface border border-border-subtle rounded-[1.25rem] text-muted hover:text-primary hover:bg-surface-hover transition-all flex-shrink-0">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-xl font-bold text-primary">{t.individualAvailabilityLabel}</h1>
                </div>
            </div>

            {!isTeacher && (
                <div>
                    <label className="text-xs text-muted mb-1.5 block">{t.calTeacher}</label>
                    <SearchSelect
                        options={staff.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name || ''}` }))}
                        value={teacherId}
                        onChange={setTeacherId}
                        placeholder={t.selectTeacher}
                    />
                </div>
            )}

            <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-muted tracking-widest uppercase">{t.bookLesson}</h2>
                <button onClick={() => setShowForm(v => !v)}
                    className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 text-white font-black text-[10px] px-4 py-2.5 rounded-xl tracking-widest transition-all">
                    <Plus className="w-3.5 h-3.5" /> {t.add}
                </button>
            </div>

            {showForm && (
                <div className="bg-card border border-border-subtle rounded-2xl p-5 space-y-4">
                    <div>
                        <label className="text-xs text-muted mb-1.5 block">{t.hall}</label>
                        <SearchSelect options={halls.map(h => ({ value: h.id, label: h.name }))} value={hallId} onChange={setHallId} placeholder={t.hall} />
                    </div>
                    <StandardDatePicker label={t.selectDate} value={date} onChange={setDate} />
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-muted mb-1.5 block">{t.startTime}</label>
                            <SearchSelect options={timeOptions} value={startTime} allowCustom onChange={v => { setStartTime(v); setEndTime(addOneHour(v)); }} />
                        </div>
                        <div>
                            <label className="text-xs text-muted mb-1.5 block">{t.endTime}</label>
                            <SearchSelect options={timeOptions} value={endTime} allowCustom onChange={setEndTime} />
                        </div>
                    </div>
                    {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
                    <button onClick={handlePublish} disabled={!hallId || !date || saving}
                        className={cn('w-full py-3 text-white text-sm font-semibold rounded-xl', saving ? 'bg-indigo-400' : 'bg-indigo-500 hover:bg-indigo-600')}>
                        {t.add}
                    </button>
                </div>
            )}

            <div className="space-y-3">
                {slots.length === 0 && (
                    <div className="py-16 text-center text-muted/40">
                        <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">{t.noData}</p>
                    </div>
                )}
                {slots.map(slot => {
                    const hall = halls.find(h => h.id === slot.hall_id);
                    return (
                        <div key={slot.id} className="flex items-center justify-between bg-card border border-border-subtle rounded-2xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-primary">{formatDate(slot.date)} · {slot.start_time}–{slot.end_time}</p>
                                    <p className="text-xs text-muted">{hall?.name || '—'}</p>
                                </div>
                            </div>
                            <button onClick={() => handleDelete(slot.id)}
                                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-500/10 text-muted/40 hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
