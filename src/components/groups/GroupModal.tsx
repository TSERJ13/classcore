'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { X, BookOpen, Clock, Users, Check, Trash2, AlertTriangle, GraduationCap, Plus, Calendar } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useUser } from '@/hooks/useUser';
import { cn } from '@/lib/utils';
import { getTeachers } from '@/lib/teacher-store';
import { syncGroupScheduleToCalendar } from '@/lib/event-store';
import { type ScheduleSlot, slotsToDisplay } from '@/lib/group-store';
import type { Teacher } from '@/types';
import { SearchSelect, SearchSelectOption } from '@/components/ui/SearchSelect';
import { generateTimeOptions } from '@/lib/date-utils';

interface GroupModalProps {
    open: boolean;
    group?: {
        id: string;
        name: string;
        coach?: string;
        teacherId?: string;
        schedule?: string;
        schedule_slots?: ScheduleSlot[];
        capacity?: number;
        type?: string;
        difficulty?: string | null;
        hall_id?: string;
        secondaryTeacherId?: string;
        secondaryTeacherName?: string;
        primaryTeacherPercentage?: number;
        secondaryTeacherPercentage?: number;
    };
    onClose: () => void;
    onSave: (data: Partial<{
        id: string; name: string; coach: string; teacherId: string;
        schedule: string; schedule_slots: ScheduleSlot[];
        capacity: number; type: string; difficulty: string | null; hall_id: string;
        color: string;
        secondaryTeacherId: string; secondaryTeacherName: string;
        primaryTeacherPercentage: number; secondaryTeacherPercentage: number;
    }>) => void;
    onDelete?: (id: string) => void;
    [key: string]: unknown;
}

// Day labels (Mon–Sun)
const DAY_LABELS_KA = ['ორ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'];
const DAY_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LABELS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const DAY_FULL_KA = ['ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი', 'კვირა'];
const DAY_FULL_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Schedule display handled by group-store slotsToDisplay

// ─── Default time slot ───────────────────────────────────────────
const DEFAULT_SLOT: ScheduleSlot = { dayOfWeek: 0, startTime: '13:00', endTime: '14:00' };

export function GroupModal({ open, group, onClose, onSave, onDelete }: GroupModalProps) {
    const { t, lang } = useT();
    const { user, profile } = useUser();
    const isEdit = !!group;
    const isTeacher = profile?.role === 'teacher';

    const [form, setForm] = useState({
        id: '',
        name: '',
        coach: '',
        teacherId: '',
        capacity: 15,
        type: 'Dance',
        difficulty: '' as string | null,
        hall_id: 'h1',
        color: '#6366f1',
        secondaryTeacherId: '',
        secondaryTeacherName: '',
        primaryTeacherPercentage: 0,
        secondaryTeacherPercentage: 0,
    });

    const [slots, setSlots] = useState<ScheduleSlot[]>([]);
    const [saving, setSaving] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [teachers, setTeachers] = useState<Teacher[]>([]);

    const teacherOptions: SearchSelectOption[] = teachers.map(tc => {
        const name = tc.full_name || `${tc.first_name || ''} ${tc.last_name || ''}`.trim() || tc.phone || tc.id;
        return {
            value: tc.id,
            label: name,
            subLabel: tc.phone
        };
    });

    const dayLabels = lang === 'ka' ? DAY_LABELS_KA : lang === 'ru' ? DAY_LABELS_RU : DAY_LABELS_EN;
    const timeOptions = generateTimeOptions(30);

    useEffect(() => {
        setTeachers(getTeachers());
    }, [open]);

    useEffect(() => {
        if (open && group) {
            setForm({
                id: group.id ?? '',
                name: group.name ?? '',
                coach: group.coach ?? '',
                teacherId: group.teacherId ?? '',
                capacity: group.capacity ?? 15,
                type: group.type ?? 'Dance',
                difficulty: group.difficulty ?? null,
                hall_id: group.hall_id ?? 'h1',
                color: (group as any).color ?? '#6366f1',
                secondaryTeacherId: group.secondaryTeacherId ?? '',
                secondaryTeacherName: group.secondaryTeacherName ?? '',
                primaryTeacherPercentage: group.primaryTeacherPercentage ?? 0,
                secondaryTeacherPercentage: group.secondaryTeacherPercentage ?? 0,
            });
            setSlots(group.schedule_slots?.length ? group.schedule_slots : [{ ...DEFAULT_SLOT }]);
            setShowDelete(false);
        } else if (open) {
            setForm({ 
                id: '', name: '', coach: '', teacherId: '', capacity: 15, type: 'Dance', difficulty: '', hall_id: 'h1', color: '#6366f1',
                secondaryTeacherId: '', secondaryTeacherName: '', primaryTeacherPercentage: 0, secondaryTeacherPercentage: 0 
            });
            setSlots([{ ...DEFAULT_SLOT }]);
            setShowDelete(false);
        }
    }, [group, open]);

    if (!open) return null;

    const toggleDaySlot = (dayIdx: number) => {
        setSlots(prev => {
            const existing = prev.find(s => s.dayOfWeek === dayIdx);
            if (existing) {
                return prev.filter(s => s.dayOfWeek !== dayIdx);
            } else {
                // Default to 10:00 - 11:30 or use times from first existing slot if any
                const base = prev[0] || DEFAULT_SLOT;
                return [...prev, { dayOfWeek: dayIdx, startTime: base.startTime, endTime: base.endTime }];
            }
        });
    };

    const updateSlotTime = (dayIdx: number, field: 'startTime' | 'endTime', val: string) => {
        setSlots(prev => prev.map(s => {
            if (s.dayOfWeek === dayIdx) {
                if (field === 'startTime') {
                    const [h, m] = val.split(':').map(Number);
                    if (!isNaN(h) && !isNaN(m)) {
                        const endH = (h + 1) % 24;
                        const endTime = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                        return { ...s, startTime: val, endTime };
                    }
                }
                return { ...s, [field]: val };
            }
            return s;
        }));
    };

    const save = async () => {
        if (!form.name || saving) return;
        try {
            setSaving(true);
            await new Promise(r => setTimeout(r, 400));

            const groupId = form.id || `g_${Date.now()}`;
            const scheduleDisplay = slotsToDisplay(slots, lang);

            onSave({
                ...form,
                id: groupId,
                schedule: scheduleDisplay,
                schedule_slots: slots,
            });

            // Sync recurring events to calendar
            if (slots.length > 0) {
                try {
                    await syncGroupScheduleToCalendar(groupId, form.name, form.teacherId, form.hall_id, slots, form.color, form.secondaryTeacherId);
                } catch (syncErr) {
                    console.error('[GroupModal] Calendar sync failed, but group saved locally:', syncErr);
                }
            }

            onClose();
        } catch (err) {
            console.error('[GroupModal] Save failed:', err);
        } finally {
            setSaving(false);
        }
    };

    const inputCls = "w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/30 outline-none transition-all shadow-sm";

    const dayFullLabels = lang === 'ka' ? DAY_FULL_KA : DAY_FULL_EN;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className={cn(
                "fixed z-50 flex flex-col bg-card shadow-2xl transition-all duration-300 overflow-hidden",
                "inset-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[500px] sm:max-h-none",
                "animate-in slide-in-from-bottom sm:slide-in-from-right",
                "rounded-none sm:rounded-none"
            )}>


                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle flex-shrink-0 bg-card/80 backdrop-blur-md sticky top-0 z-10">
                    <div>
                        <h2 className="text-base font-bold text-primary">{isEdit ? t.editGroup : t.newGroup}</h2>
                        <p className="text-xs text-muted mt-0.5 opacity-70">{isEdit ? group.name : t.addGroupDescription}</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-primary transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-5 sm:space-y-6 overscroll-contain">

                    {/* Group name */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1 flex items-center gap-2 uppercase">
                            <BookOpen className="w-3 h-3" /> {t.groupName}
                        </label>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Dance Group..." 
                            className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-2xl px-4 py-3 text-[13px] sm:text-sm text-primary placeholder:text-muted/30 outline-none transition-all shadow-sm" />
                    </div>

                    {/* Teacher */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1 flex items-center gap-2 uppercase">
                            <GraduationCap className="w-3 h-3" /> {t.teachers}
                        </label>
                        <SearchSelect
                            options={teacherOptions}
                            value={form.teacherId || ''}
                            onChange={val => {
                                const teacher = teachers.find(tc => tc.id === val);
                                const name = teacher ? (teacher.full_name || `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim()) : '';
                                setForm({ ...form, teacherId: val, coach: name, primaryTeacherPercentage: teacher?.salary_percentage || 0 });
                            }}
                            placeholder={t.selectTeacher}
                        />
                        {form.teacherId && (
                            <div className="flex items-center justify-between px-1 mt-2">
                                <span className="text-[10px] font-black text-muted/40 uppercase tracking-widest">{t.salaryPercentage || 'Share %'}</span>
                                <div className="relative w-24">
                                    <input 
                                        type="number" 
                                        value={form.primaryTeacherPercentage || ''} 
                                        onChange={e => setForm({ ...form, primaryTeacherPercentage: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-surface/50 border border-border-subtle/50 rounded-xl px-3 py-1.5 text-xs font-black text-indigo-600 outline-none focus:border-indigo-500/40"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-600/30">%</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Secondary Teacher Toggle & Section */}
                    <div className="space-y-3 p-4 bg-surface/50 border border-border-subtle rounded-2xl">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-muted tracking-widest opacity-40 flex items-center gap-2">
                                <Users className="w-3 h-3" /> {lang === 'ka' ? 'მეორე მასწავლებელი' : 'Secondary Teacher'}
                            </label>
                            {!form.secondaryTeacherId && (
                                <button 
                                    onClick={() => setForm({ ...form, secondaryTeacherId: 'placeholder', secondaryTeacherPercentage: 0 })}
                                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                                >
                                    <Plus className="w-3 h-3" /> {t.add || 'დამატება'}
                                </button>
                            )}
                        </div>

                        {form.secondaryTeacherId ? (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <SearchSelect
                                    options={teacherOptions}
                                    value={form.secondaryTeacherId === 'placeholder' ? '' : form.secondaryTeacherId}
                                    onChange={val => {
                                        const teacher = teachers.find(tc => tc.id === val);
                                        const name = teacher ? (teacher.full_name || `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim()) : '';
                                        setForm({ ...form, secondaryTeacherId: val, secondaryTeacherName: name, secondaryTeacherPercentage: teacher?.salary_percentage || 0 });
                                    }}
                                    placeholder={t.selectTeacher}
                                />

                                {form.secondaryTeacherId !== 'placeholder' && (
                                    <div className="space-y-3 pt-2 border-t border-border-subtle/30">
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-[10px] font-black text-muted/40 uppercase tracking-widest">{lang === 'ka' ? 'დამხმარის წილი %' : 'Assistant Share %'}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="relative w-24">
                                                    <input 
                                                        type="number" 
                                                        value={form.secondaryTeacherPercentage || ''} 
                                                        onChange={e => setForm({ ...form, secondaryTeacherPercentage: parseInt(e.target.value) || 0 })}
                                                        className="w-full bg-surface/50 border border-border-subtle/50 rounded-xl px-3 py-1.5 text-xs font-black text-violet-600 outline-none focus:border-violet-500/40"
                                                        placeholder="0"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-violet-600/30">%</span>
                                                </div>
                                                <button 
                                                    onClick={() => setForm({ ...form, secondaryTeacherId: '', secondaryTeacherName: '', secondaryTeacherPercentage: 0 })}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors shrink-0"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-[10px] text-muted italic opacity-40 py-2 border border-dashed border-border-subtle rounded-xl text-center">
                                {lang === 'ka' ? 'ერთი მასწავლებელი (100%)' : 'Single Teacher (100% share)'}
                            </p>
                        )}
                    </div>

                    {/* Color selector */}
                    <div>
                        <label className="text-[10px] text-muted mb-2 block tracking-wider font-bold opacity-70 flex items-center gap-2">
                            <Plus className="w-3 h-3" /> {t.groupColor}
                        </label>
                        <label className="flex items-center gap-3 bg-surface border border-border-subtle rounded-xl p-2 cursor-pointer hover:border-indigo-500/40 transition-colors">
                            <span className="w-8 h-8 rounded-lg shadow-sm border border-black/10 flex-shrink-0 overflow-hidden relative">
                                <input type="color" value={form.color || '#6366f1'} onChange={e => setForm({ ...form, color: e.target.value })}
                                    className="absolute -inset-2 w-12 h-12 cursor-pointer opacity-0" />
                                <div className="w-full h-full pointer-events-none" style={{ backgroundColor: form.color || '#6366f1' }} />
                            </span>
                            <span className="text-xs text-muted font-medium select-none truncate">{t.chooseAnotherColor}</span>
                        </label>
                    </div>

                    {/* ─── Schedule Builder (Simplified Multi-Day) ─────────────────────────────── */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1 flex items-center gap-2 uppercase">
                                <Calendar className="w-3 h-3" /> {t.schedule}
                            </label>
                        </div>

                        <div className="bg-surface/50 border border-border-subtle rounded-2xl p-4 space-y-4">
                            <label className="text-[10px] text-muted block tracking-wider font-black opacity-40">{t.selectDaysAndTimes}</label>
                            <div className="flex items-center justify-between gap-1">
                                {[0, 1, 2, 3, 4, 5, 6].map(d => {
                                    const isActive = slots.some(s => s.dayOfWeek === d);
                                    return (
                                        <button key={d} onClick={() => toggleDaySlot(d)}
                                            className={cn(
                                                "flex-1 h-9 rounded-lg text-[10px] font-black transition-all border shrink-0",
                                                isActive ? "bg-indigo-500 border-indigo-500 text-white shadow-md shadow-indigo-500/20" : "bg-card border-border-subtle text-muted hover:border-indigo-500/40"
                                            )}>
                                            {dayLabels[d]}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="space-y-2">
                                {slots.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((slot) => {
                                    return (
                                        <div key={slot.dayOfWeek} className="flex flex-row items-center gap-2 bg-card/30 p-2 rounded-xl border border-border-subtle/20">
                                            <span className="text-[10px] font-black text-primary w-12 pl-1 truncate">{dayLabels[slot.dayOfWeek]}</span>
                                            <div className="flex-1 flex items-center gap-1.5">
                                                <SearchSelect 
                                                    options={timeOptions}
                                                    value={slot.startTime}
                                                    allowCustom
                                                    onChange={val => updateSlotTime(slot.dayOfWeek, 'startTime', val)}
                                                    className="flex-1 !border-none [&>div]:bg-surface/50 [&>div]:px-2 [&>div]:py-1 [&>div]:text-[10px] [&>div]:min-h-[28px]"
                                                />
                                                <span className="text-muted/20 font-black text-[10px]">-</span>
                                                <SearchSelect 
                                                    options={timeOptions}
                                                    value={slot.endTime}
                                                    allowCustom
                                                    onChange={val => updateSlotTime(slot.dayOfWeek, 'endTime', val)}
                                                    className="flex-1 !border-none [&>div]:bg-surface/50 [&>div]:px-2 [&>div]:py-1 [&>div]:text-[10px] [&>div]:min-h-[28px]"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {slots.length === 0 && (
                                <p className="text-xs text-muted opacity-40 italic text-center py-2">
                                    {t.atLeastOneDay}
                                </p>
                            )}
                        </div>

                        {/* Calendar sync notice */}
                        {slots.length > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
                                <Calendar className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                                <p className="text-[10px] font-bold text-indigo-500 opacity-80">
                                    {t.calendarUpdateNotice}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Capacity & Type */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1 flex items-center gap-2 uppercase">
                                <Users className="w-3 h-3" /> {t.capacity}
                            </label>
                            <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })} 
                                className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-2xl px-4 py-3 text-[13px] sm:text-sm text-primary placeholder:text-muted/30 outline-none transition-all shadow-sm" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1 flex items-center gap-2 uppercase">
                                <BookOpen className="w-3 h-3" /> {t.subscriptionType}
                            </label>
                            <SearchSelect
                                options={[
                                    { value: 'Dance', label: 'Dance' },
                                    { value: 'Yoga', label: 'Yoga' },
                                    { value: 'Fitness', label: 'Fitness' },
                                    { value: 'Sports', label: 'Sports' }
                                ]}
                                value={form.type}
                                onChange={(val: string) => setForm({ ...form, type: val })}
                                className="!border-border-subtle hover:!border-indigo-500/40 [&>div]:py-3.5 [&>div]:px-4"
                            />
                        </div>
                    </div>

                    {/* Difficulty */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1">
                            {t.difficulty}
                        </label>
                        <SearchSelect
                            options={[
                                { value: '', label: t.difficultyDefault },
                                { value: 'beginner', label: t.difficultyBeginner },
                                { value: 'intermediate', label: t.difficultyIntermediate },
                                { value: 'advanced', label: t.difficultyAdvanced }
                            ]}
                            value={form.difficulty || ''}
                            onChange={(val: string) => setForm({ ...form, difficulty: (val || null) as string | null })}
                            className="!border-border-subtle hover:!border-indigo-500/40 [&>div]:py-3.5 [&>div]:px-4"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 sm:px-5 sm:py-4 border-t border-border-subtle space-y-2 sm:space-y-3 flex-shrink-0 bg-card/80 backdrop-blur-md sticky bottom-0 z-10 pb-safe-offset-2">
                    {isEdit && !showDelete && !isTeacher && (
                        <button onClick={() => setShowDelete(true)} className="w-full py-2 sm:py-2.5 text-red-500/60 hover:text-red-500 text-[10px] sm:text-xs font-bold border border-red-500/10 hover:border-red-500/30 rounded-xl transition-all flex items-center justify-center gap-2 text-center px-2">
                            <Trash2 className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{t.deleteGroup}</span>
                        </button>
                    )}
                    {showDelete && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-red-600">{t.deleteQuestion}</p>
                            </div>
                            <button onClick={() => { if (group?.id) onDelete?.(group.id); onClose(); }} className="px-3 py-1 bg-red-500 text-white text-[10px] font-bold rounded-lg hover:bg-red-600 active:scale-95 transition-all">{t.delete}</button>
                            <button onClick={() => setShowDelete(false)} className="text-[10px] font-bold text-muted hover:text-primary transition-colors">{t.cancel}</button>
                        </div>
                    )}
                    <div className="flex gap-2 sm:gap-3">
                        <button onClick={onClose} className="flex-1 py-3 border border-border-subtle hover:bg-surface text-muted text-[10px] sm:text-sm font-bold rounded-xl transition-all uppercase tracking-widest">{t.cancel}</button>
                        <button onClick={save} disabled={!form.name || saving} className="flex-[1.5] py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[10px] xs:text-[11px] sm:text-sm font-black rounded-xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 sm:gap-2 uppercase tracking-widest px-2">
                            {saving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />}
                            <span className="truncate">{saving ? t.loading : t.saveAndSync}</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
