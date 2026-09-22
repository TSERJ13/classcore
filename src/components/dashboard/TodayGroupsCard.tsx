'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Users, Check, Clock, ChevronRight, Sparkles, Plus, X } from 'lucide-react';
import { cn, getLocalISODate } from '@/lib/utils';
import { getGroups, type Group } from '@/lib/group-store';
import { getStudents } from '@/lib/student-store';
import { getTodayCheckins, recordCheckin, type CheckinRecord } from '@/lib/checkin-store';
import { getTeachers } from '@/lib/teacher-store';
import { getHalls } from '@/lib/hall-store';
import { getEvents } from '@/lib/event-store';
import type { Student } from '@/types';
import Link from 'next/link';

interface TodayGroupsCardProps {
    lang?: 'ka' | 'ru' | 'en';
    onRefreshDashboard?: () => void;
    currentDate?: Date;
}

export function TodayGroupsCard({ lang = 'ka', onRefreshDashboard, currentDate }: TodayGroupsCardProps) {
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    
    const [groups, setGroups] = useState<Group[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [checkins, setCheckins] = useState<CheckinRecord[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [halls, setHalls] = useState<any[]>([]);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'expected' | 'attended'>('expected');
    const [justCheckedInId, setJustCheckedInId] = useState<string | null>(null);

    const activeDate = currentDate || new Date();
    const activeDateStr = getLocalISODate(activeDate);
    const dayOfWeek = (activeDate.getDay() + 6) % 7; // 0=Mon, ..., 6=Sun

    const loadData = useCallback(() => {
        setGroups(getGroups());
        setStudents(getStudents());
        setCheckins(getTodayCheckins());
        setEvents(getEvents());
        setTeachers(getTeachers());
        setHalls(getHalls());
    }, []);

    useEffect(() => {
        loadData();
        const listener = () => loadData();
        window.addEventListener('cc_checkins_update', listener);
        window.addEventListener('cc_groups_update', listener);
        window.addEventListener('cc_student_update', listener);
        window.addEventListener('cc_calendar_events_update', listener);
        window.addEventListener('cc_branch_change', listener);
        return () => {
            window.removeEventListener('cc_checkins_update', listener);
            window.removeEventListener('cc_groups_update', listener);
            window.removeEventListener('cc_student_update', listener);
            window.removeEventListener('cc_calendar_events_update', listener);
            window.removeEventListener('cc_branch_change', listener);
        };
    }, [loadData]);

    const todayGroups = useMemo(() => {
        if (!groups.length) return [];
        const filtered = groups.filter(g => {
            const hasSlot = g.schedule_slots?.some(s => s.dayOfWeek === dayOfWeek);
            const hasEvent = events.some(e => e.date === activeDateStr && e.group_id === g.id);
            return hasSlot || hasEvent;
        });
        return filtered.length > 0 ? filtered : groups;
    }, [groups, events, activeDateStr, dayOfWeek]);

    useEffect(() => {
        if (todayGroups.length > 0) {
            if (!activeGroupId || !todayGroups.some(g => g.id === activeGroupId)) {
                setActiveGroupId(todayGroups[0].id);
            }
        } else {
            setActiveGroupId(null);
        }
    }, [todayGroups, activeGroupId]);

    const activeGroup = useMemo(() => {
        return todayGroups.find(g => g.id === activeGroupId) || null;
    }, [todayGroups, activeGroupId]);

    const enrolledStudents = useMemo(() => {
        if (!activeGroupId) return [];
        return students.filter(s => s.enrolled_group_ids?.includes(activeGroupId));
    }, [students, activeGroupId]);

    const { expectedStudents, attendedStudents } = useMemo(() => {
        const attendedMap = new Map<string, CheckinRecord>();
        checkins.forEach(c => {
            if (c.studentId) attendedMap.set(c.studentId, c);
        });
        const expected: Student[] = [];
        const attended: { student: Student; checkin: CheckinRecord }[] = [];
        enrolledStudents.forEach(s => {
            const c = attendedMap.get(s.id);
            if (c) attended.push({ student: s, checkin: c });
            else expected.push(s);
        });
        return { expectedStudents: expected, attendedStudents: attended };
    }, [enrolledStudents, checkins]);

    const handleCheckin = async (student: Student) => {
        if (!activeGroup) return;
        setJustCheckedInId(student.id);
        recordCheckin(student.id, student.full_name, 'manual', undefined, activeGroup.id);
        setCheckins(getTodayCheckins());
        if (onRefreshDashboard) onRefreshDashboard();
        setTimeout(() => setJustCheckedInId(null), 1500);
    };

    const teacherName = useMemo(() => {
        if (!activeGroup?.teacherId) return null;
        const t = teachers.find(x => x.id === activeGroup.teacherId);
        return t?.name || null;
    }, [activeGroup, teachers]);

    const hallName = useMemo(() => {
        if (!activeGroup?.hall_id) return null;
        const h = halls.find(x => x.id === activeGroup.hall_id);
        return h?.name || null;
    }, [activeGroup, halls]);

    const slotDisplay = useMemo(() => {
        if (!activeGroup?.schedule_slots?.length) return null;
        const slot = activeGroup.schedule_slots.find(s => s.dayOfWeek === dayOfWeek) || activeGroup.schedule_slots[0];
        if (!slot) return null;
        return `${slot.startTime} – ${slot.endTime}`;
    }, [activeGroup, dayOfWeek]);

    const displayStudents = activeTab === 'expected' ? expectedStudents : attendedStudents.map(x => x.student);
    const checkinMap = useMemo(() => {
        const m = new Map<string, CheckinRecord>();
        attendedStudents.forEach(({ student, checkin }) => m.set(student.id, checkin));
        return m;
    }, [attendedStudents]);

    return (
        <div className="bg-card border border-border-subtle rounded-2xl overflow-hidden flex flex-col h-full min-h-[460px] shadow-xs transition-all">
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                        <Users className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-primary tracking-tight">
                            {l('დღევანდელი ჯგუფები', 'Группы на сегодня', "Today's Groups")}
                        </h2>
                        {todayGroups.length > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400">
                                {todayGroups.length}
                            </span>
                        )}
                    </div>
                </div>
                <Link
                    href="/groups"
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5 group"
                >
                    <span>{l('ყველა ჯგუფი', 'Все группы', 'All Groups')}</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
            </div>

            {todayGroups.length > 0 ? (
                <>
                    {/* ── Group Tabs ── */}
                    <div className="px-3 pt-3 pb-2 border-b border-border-subtle bg-surface/20">
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                            {todayGroups.map(group => {
                                const isSelected = group.id === activeGroupId;
                                const slot = group.schedule_slots?.find(s => s.dayOfWeek === dayOfWeek);
                                return (
                                    <button
                                        key={group.id}
                                        onClick={() => { setActiveGroupId(group.id); setActiveTab('expected'); }}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex-shrink-0 border cursor-pointer",
                                            isSelected
                                                ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                                                : "bg-card hover:bg-surface text-muted border-border-subtle"
                                        )}
                                    >
                                        <span
                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: group.color || '#6366f1' }}
                                        />
                                        <span className="truncate max-w-[130px]">{group.name}</span>
                                        {slot && (
                                            <span className={cn(
                                                "text-[9px] font-semibold px-1 py-0.5 rounded-md",
                                                isSelected ? "bg-white/20 text-white" : "bg-muted/10 text-muted"
                                            )}>
                                                {slot.startTime}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Active group meta + tab switcher */}
                        {activeGroup && (
                            <div className="flex items-center justify-between mt-2 text-[11px] text-muted">
                                <div className="flex items-center gap-3 truncate">
                                    {slotDisplay && (
                                        <span className="flex items-center gap-1 font-semibold text-primary/80">
                                            <Clock className="w-3 h-3 text-indigo-400" />
                                            {slotDisplay}
                                        </span>
                                    )}
                                    {teacherName && (
                                        <span className="truncate hidden sm:inline">
                                            {l('მასწავლებელი:', 'Учитель:', 'Coach:')} <strong className="text-primary">{teacherName}</strong>
                                        </span>
                                    )}
                                    {hallName && (
                                        <span className="truncate hidden md:inline">
                                            {l('დარბაზი:', 'Зал:', 'Hall:')} <strong className="text-primary">{hallName}</strong>
                                        </span>
                                    )}
                                </div>

                                {/* Expected / Attended tab pills */}
                                <div className="flex items-center gap-0.5 bg-surface p-0.5 rounded-lg border border-border-subtle flex-shrink-0">
                                    <button
                                        onClick={() => setActiveTab('expected')}
                                        className={cn(
                                            "px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                                            activeTab === 'expected'
                                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                                : "text-muted hover:text-primary"
                                        )}
                                    >
                                        {l('მოსასვლელი', 'Ожидаются', 'Expected')} <span className="opacity-70">({expectedStudents.length})</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('attended')}
                                        className={cn(
                                            "px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                                            activeTab === 'attended'
                                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                : "text-muted hover:text-primary"
                                        )}
                                    >
                                        {l('გამოცხადდა', 'Посетили', 'Attended')} <span className="opacity-70">({attendedStudents.length})</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Student List ── */}
                    <div className="flex-1 overflow-y-auto max-h-[380px]">
                        {displayStudents.length > 0 ? (
                            <div className="p-3 space-y-1.5">
                                {displayStudents.map((student, idx) => {
                                    const isAttended = activeTab === 'attended';
                                    const isDone = justCheckedInId === student.id;
                                    const checkin = checkinMap.get(student.id);
                                    const initial = (student.full_name || 'S').trim().substring(0, 2).toUpperCase();

                                    return (
                                        <div
                                            key={student.id}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                                                isAttended
                                                    ? "bg-emerald-500/5 border border-emerald-500/15"
                                                    : "bg-surface/60 border border-border-subtle hover:border-indigo-500/20 hover:bg-surface"
                                            )}
                                        >
                                            {/* Row number */}
                                            <span className="text-[10px] font-bold text-muted/40 w-4 text-right flex-shrink-0 select-none">
                                                {idx + 1}
                                            </span>

                                            {/* Avatar */}
                                            {student.photo_url ? (
                                                <img
                                                    src={student.photo_url}
                                                    alt=""
                                                    className="w-8 h-8 rounded-xl object-cover border border-border-subtle flex-shrink-0"
                                                />
                                            ) : (
                                                <div className={cn(
                                                    "w-8 h-8 rounded-xl font-black text-[11px] flex items-center justify-center flex-shrink-0 border",
                                                    isAttended
                                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                                        : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                                )}>
                                                    {initial}
                                                </div>
                                            )}

                                            {/* Name & phone */}
                                            <div className="flex-1 min-w-0">
                                                <p className={cn(
                                                    "text-[13px] font-bold truncate leading-tight",
                                                    isAttended ? "text-emerald-700 dark:text-emerald-300" : "text-primary"
                                                )}>
                                                    {student.full_name}
                                                </p>
                                                {student.phone && (
                                                    <p className="text-[10px] text-muted truncate leading-tight mt-0.5">
                                                        {student.phone}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Action: check-in button OR attended badge */}
                                            {isAttended ? (
                                                <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20 flex-shrink-0">
                                                    <Check className="w-3 h-3 stroke-[2.5]" />
                                                    <span>{checkin?.time || l('გამოცხ.', 'Посетил', 'In')}</span>
                                                </span>
                                            ) : (
                                                /* Attendance-style square checkbox */
                                                <button
                                                    onClick={() => handleCheckin(student)}
                                                    disabled={isDone}
                                                    title={l('დასწრების ჩაწერა', 'Отметить посещение', 'Mark attendance')}
                                                    className={cn(
                                                        "w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all active:scale-90 flex-shrink-0 cursor-pointer",
                                                        isDone
                                                            ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                                                            : "bg-surface border-border-subtle text-muted/30 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/5"
                                                    )}
                                                >
                                                    {isDone ? (
                                                        <Check className="w-5 h-5 stroke-[3]" />
                                                    ) : (
                                                        <Plus className="w-5 h-5 stroke-[2.5]" />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* Empty states */
                            activeTab === 'expected' ? (
                                <div className="p-10 text-center flex flex-col items-center justify-center h-full">
                                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                                        <Sparkles className="w-6 h-6" />
                                    </div>
                                    <p className="text-xs font-bold text-primary mb-1">
                                        {enrolledStudents.length > 0
                                            ? l('ყველა მოსწავლე გამოცხადდა! 🎉', 'Все ученики уже на месте! 🎉', 'All students have attended! 🎉')
                                            : l('ამ ჯგუფში მოსწავლეები არ არიან ჩაწერილი', 'В этой группе нет записанных учеников', 'No students enrolled in this group')}
                                    </p>
                                    <p className="text-[11px] text-muted max-w-[220px]">
                                        {enrolledStudents.length > 0
                                            ? l('ყველა მოსასვლელი სტუდენტი აღრიცხულია.', 'Для этой группы все ученики отмечены.', 'All expected students have been recorded.')
                                            : l('ჯგუფში მოსწავლეების დასამატებლად გადადით ჯგუფების მართვაში.', 'Перейдите в раздел Группы, чтобы добавить учеников.', 'Add students to this group in the Groups page.')}
                                    </p>
                                </div>
                            ) : (
                                <div className="p-10 text-center flex flex-col items-center justify-center h-full">
                                    <Clock className="w-10 h-10 text-muted/30 mb-2" />
                                    <p className="text-xs text-muted font-medium">
                                        {l('ჯერ არცერთი მოსწავლე არ გამოცხადებულა', 'Пока никто из учеников не отметился', 'No students have checked in yet')}
                                    </p>
                                </div>
                            )
                        )}
                    </div>
                </>
            ) : (
                <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                    <Users className="w-10 h-10 text-muted/30 mb-2" />
                    <p className="text-xs text-muted font-medium">
                        {l('დღეს ჯგუფური გაკვეთილები არ არის ჩანიშნული', 'На сегодня нет групповых занятий', 'No group classes scheduled today')}
                    </p>
                </div>
            )}
        </div>
    );
}
