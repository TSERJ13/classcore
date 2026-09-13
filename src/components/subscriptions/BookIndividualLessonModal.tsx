'use client';

import { useState } from 'react';
import { X, CalendarClock, Check } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useUser } from '@/hooks/useUser';
import { type SubscriptionInfo } from '@/lib/subscription-store';
import { createIndividualBooking } from '@/lib/event-store';
import { getHalls } from '@/lib/hall-store';
import { getStudents } from '@/lib/student-store';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { StandardDatePicker } from '@/components/ui/StandardDatePicker';
import { generateTimeOptions } from '@/lib/date-utils';
import { getLocalISODate, cn } from '@/lib/utils';
import MainPortal from '@/components/ui/MainPortal';

interface BookIndividualLessonModalProps {
    subscription: SubscriptionInfo;
    onClose: () => void;
    onBooked: () => void;
}

function addOneHour(timeStr: string): string {
    const [h, m] = timeStr.split(':').map(Number);
    return `${String((h + 1) % 24).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}

/**
 * 7B, direct-assignment path: books ONE lesson time against an
 * already-purchased individual credit. The other 7B path (a teacher
 * pre-publishing open slots for students to pick from) isn't built yet —
 * see docs/tasks.md Phase 6.
 */
export function BookIndividualLessonModal({ subscription, onClose, onBooked }: BookIndividualLessonModalProps) {
    const { t } = useT();
    const { profile } = useUser();
    const halls = getHalls().filter(h => h.is_active !== false);
    const student = getStudents().find(s => s.id === (subscription.student_id || '').split(',')[0].trim());

    const [hallId, setHallId] = useState(halls[0]?.id || '');
    const [date, setDate] = useState(getLocalISODate());
    const [startTime, setStartTime] = useState('18:00');
    const [endTime, setEndTime] = useState('19:00');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<'confirmed' | 'pending' | null>(null);

    const timeOptions = generateTimeOptions();
    const isTeacher = profile?.role === 'teacher';

    async function handleBook() {
        setError('');
        setSaving(true);
        try {
            const event = createIndividualBooking({
                subId: subscription.id,
                studentId: subscription.student_id,
                studentName: student?.full_name || subscription.plan,
                teacherId: subscription.teacher_id || '',
                hallId,
                date,
                startTime,
                endTime,
                createdByTeacher: isTeacher,
            });
            setResult(event.booking_status === 'confirmed' ? 'confirmed' : 'pending');
            onBooked();
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setError(message === 'SLOT_CONFLICT' ? t.slotConflict : message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <MainPortal>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div className="bg-card border border-border-subtle rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
                        <h3 className="text-base font-bold text-primary flex items-center gap-2">
                            <CalendarClock className="w-4 h-4 text-indigo-500" /> {t.bookLesson}
                        </h3>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface text-muted transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {result ? (
                        <div className="px-6 py-8 text-center space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                                <Check className="w-6 h-6 text-emerald-500" />
                            </div>
                            <p className="text-sm font-semibold text-primary">
                                {result === 'confirmed' ? t.bookingConfirmed : t.pendingConfirmation}
                            </p>
                            <button onClick={onClose} className="mt-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl">
                                {t.close || 'დახურვა'}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="px-6 py-5 space-y-4">
                                <div>
                                    <label className="text-xs text-muted mb-1.5 block">{t.hall}</label>
                                    <SearchSelect
                                        options={halls.map(h => ({ value: h.id, label: h.name }))}
                                        value={hallId}
                                        onChange={setHallId}
                                        placeholder={t.hall}
                                    />
                                </div>
                                <StandardDatePicker label={t.selectDate} value={date} onChange={setDate} />
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">{t.startTime}</label>
                                        <SearchSelect
                                            options={timeOptions}
                                            value={startTime}
                                            allowCustom
                                            onChange={v => { setStartTime(v); setEndTime(addOneHour(v)); }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">{t.endTime}</label>
                                        <SearchSelect options={timeOptions} value={endTime} allowCustom onChange={setEndTime} />
                                    </div>
                                </div>
                                {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
                            </div>
                            <div className="flex gap-3 px-6 pb-5">
                                <button onClick={onClose} className="flex-1 py-3 border border-border-subtle text-muted text-sm font-medium rounded-xl hover:bg-surface">
                                    {t.cancel}
                                </button>
                                <button
                                    onClick={handleBook}
                                    disabled={!hallId || !date || !startTime || !endTime || saving}
                                    className={cn(
                                        'flex-1 py-3 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2',
                                        saving ? 'bg-indigo-400' : 'bg-indigo-500 hover:bg-indigo-600'
                                    )}
                                >
                                    {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                                    {t.bookLesson}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </MainPortal>
    );
}
