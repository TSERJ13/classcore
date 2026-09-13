'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Users, UserCheck, Check, Clock, ChevronRight, Sparkles } from 'lucide-react';
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
        return () => {
            window.removeEventListener('cc_checkins_update', listener);
            window.removeEventListener('cc_groups_update', listener);
            window.removeEventListener('cc_student_update', listener);
            window.removeEventListener('cc_calendar_events_update', listener);
        };
    }, [loadData]);

    // Filter today's groups: by schedule_slots or calendar events for today
    const todayGroups = useMemo(() => {
        if (!groups.length) return [];
        const filtered = groups.filter(g => {
            const hasSlot = g.schedule_slots?.some(s => s.dayOfWeek === dayOfWeek);
            const hasEvent = events.some(e => e.date === activeDateStr && e.group_id === g.id);
            return hasSlot || hasEvent;
        });
        return filtered.length > 0 ? filtered : groups;
    }, [groups, events, activeDateStr, dayOfWeek]);

    // Ensure an active group is selected
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

    // Find enrolled students for active group
    const enrolledStudents = useMemo(() => {
        if (!activeGroupId) return [];
        return students.filter(s => s.enrolled_group_ids?.includes(activeGroupId));
    }, [students, activeGroupId]);

    // Separate into expected (not checked in today) and attended (checked in today)
    const { expectedStudents, attendedStudents } = useMemo(() => {
        const attendedMap = new Map<string, CheckinRecord>();
        checkins.forEach(c => {
            if (c.studentId) {
                attendedMap.set(c.studentId, c);
            }
        });

        const expected: Student[] = [];
        const attended: { student: Student; checkin: CheckinRecord }[] = [];

        enrolledStudents.forEach(s => {
            const c = attendedMap.get(s.id);
            if (c) {
                attended.push({ student: s, checkin: c });
            } else {
                expected.push(s);
            }
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
        return `${slot.startTime} - ${slot.endTime}`;
    }, [activeGroup, dayOfWeek]);

    return (
        <div className="bg-card border border-border-subtle rounded-2xl overflow-hidden flex flex-col h-full min-h-[460px] shadow-xs transition-all">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                        <Users className="w-4 h-4" />
                    </div>
                    <div>
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
                </div>
                <Link
                    href="/groups"
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5 group"
                >
                    <span>{l('ყველა ჯგუფი', 'Все группы', 'All Groups')}</span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
            </div>

            {/* Groups Tabs (Horizontal scrollable pill tabs) */}
            {todayGroups.length > 0 ? (
                <div className="p-3 border-b border-border-subtle bg-surface/30">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {todayGroups.map(group => {
                            const isSelected = group.id === activeGroupId;
                            const slot = group.schedule_slots?.find(s => s.dayOfWeek === dayOfWeek);
                            return (
                                <button
                                    key={group.id}
                                    onClick={() => {
                                        setActiveGroupId(group.id);
                                        setActiveTab('expected');
                                    }}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0 border cursor-pointer",
                                        isSelected
                                            ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                                            : "bg-card hover:bg-surface text-muted border-border-subtle"
                                    )}
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: group.color || '#6366f1' }}
                                    />
                                    <span className="truncate max-w-[140px]">{group.name}</span>
                                    {slot && (
                                        <span className={cn(
                                            "text-[10px] font-medium px-1.5 py-0.5 rounded-md",
                                            isSelected ? "bg-white/20 text-white" : "bg-muted/10 text-muted"
                                        )}>
                                            {slot.startTime}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Active Group Details Sub-bar */}
                    {activeGroup && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle/50 text-[11px] text-muted">
                            <div className="flex items-center gap-3 truncate">
                                {slotDisplay && (
                                    <span className="flex items-center gap-1 font-semibold text-primary/80">
                                        <Clock className="w-3 h-3 text-indigo-400" />
                                        {slotDisplay}
                                    </span>
                                )}
                                {teacherName && (
                                    <span className="truncate">
                                        {l('მასწავლებელი:', 'Учитель:', 'Coach:')} <strong className="text-primary">{teacherName}</strong>
                                    </span>
                                )}
                                {hallName && (
                                    <span className="hidden sm:inline truncate">
                                        {l('დარბაზი:', 'Зал:', 'Hall:')} <strong className="text-primary">{hallName}</strong>
                                    </span>
                                )}
                            </div>

                            {/* Status Filter Pills: მოსასვლელი vs გამოცხადდა */}
                            <div className="flex items-center gap-1 bg-surface p-0.5 rounded-lg border border-border-subtle flex-shrink-0">
                                <button
                                    onClick={() => setActiveTab('expected')}
                                    className={cn(
                                        "px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                                        activeTab === 'expected'
                                            ? "bg-amber-500/15 text-amber-500 dark:text-amber-400"
                                            : "text-muted hover:text-primary"
                                    )}
                                >
                                    {l('მოსასვლელი', 'Ожидаются', 'Expected')} ({expectedStudents.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('attended')}
                                    className={cn(
                                        "px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                                        activeTab === 'attended'
                                            ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
                                            : "text-muted hover:text-primary"
                                    )}
                                >
                                    {l('გამოცხადდა', 'Посетили', 'Attended')} ({attendedStudents.length})
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                    <Users className="w-10 h-10 text-muted/30 mb-2" />
                    <p className="text-xs text-muted font-medium">
                        {l('დღეს ჯგუფური გაკვეთილები არ არის ჩანიშნული', 'На сегодня нет групповых занятий', 'No group classes scheduled today')}
                    </p>
                </div>
            )}

            {/* Students List Container */}
            <div className="flex-1 overflow-y-auto divide-y divide-border-subtle max-h-[380px]">
                {activeTab === 'expected' ? (
                    expectedStudents.length > 0 ? (
                        expectedStudents.map(student => {
                            const isDone = justCheckedInId === student.id;
                            const initial = (student.full_name || 'S').trim().substring(0, 1).toUpperCase();
                            return (
                                <div
                                    key={student.id}
                                    className="flex items-center justify-between p-3.5 hover:bg-surface/50 transition-colors group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {student.photo_url ? (
                                            <img
                                                src={student.photo_url}
                                                alt=""
                                                className="w-9 h-9 rounded-full object-cover border border-border-subtle flex-shrink-0"
                                            />
                                        ) : (
                                            <div className="w-9 h-9 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                                                {initial}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-primary truncate group-hover:text-indigo-400 transition-colors">
                                                {student.full_name}
                                            </p>
                                            <p className="text-[11px] text-muted truncate">
                                                {student.phone || l('ჯგუფური მეცადინეობა', 'Групповое занятие', 'Group Class')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Check-in Action Button (Matching mockup: 'დასწრება') */}
                                    <button
                                        onClick={() => handleCheckin(student)}
                                        disabled={isDone}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 flex-shrink-0 cursor-pointer border shadow-xs",
                                            isDone
                                                ? "bg-emerald-500 text-white border-emerald-500"
                                                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40"
                                        )}
                                    >
                                        {isDone ? (
                                            <>
                                                <Check className="w-3.5 h-3.5" />
                                                <span>{l('ჩაინიშნა', 'Отмечено', 'Checked in')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <UserCheck className="w-3.5 h-3.5" />
                                                <span>{l('დასწრება', 'Визит', 'Check-in')}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-10 text-center flex flex-col items-center justify-center">
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
                                    ? l('ამ ჯგუფისთვის ყველა მოსასვლელი სტუდენტი აღრიცხულია.', 'Для этой группы все ученики отмечены.', 'All expected students for this group have been recorded.')
                                    : l('ჯგუფში მოსწავლეების დასამატებლად გადადით ჯგუფების მართვაში.', 'Перейдите в раздел Группы, чтобы добавить учеников.', 'Add students to this group in the Groups page.')}
                            </p>
                        </div>
                    )
                ) : (
                    // Attended Students Tab
                    attendedStudents.length > 0 ? (
                        attendedStudents.map(({ student, checkin }) => {
                            const initial = (student.full_name || 'S').trim().substring(0, 1).toUpperCase();
                            return (
                                <div
                                    key={student.id}
                                    className="flex items-center justify-between p-3.5 hover:bg-surface/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        {student.photo_url ? (
                                            <img
                                                src={student.photo_url}
                                                alt=""
                                                className="w-9 h-9 rounded-full object-cover border border-border-subtle flex-shrink-0"
                                            />
                                        ) : (
                                            <div className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                                                {initial}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-primary truncate">
                                                {student.full_name}
                                            </p>
                                            <p className="text-[11px] text-muted truncate">
                                                {student.phone || l('ჯგუფური მეცადინეობა', 'Групповое занятие', 'Group Class')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Checked-in status badge */}
                                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                        <Check className="w-3 h-3" />
                                        <span>{checkin.time || l('გამოცხადდა', 'Посетил', 'Attended')}</span>
                                    </span>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-10 text-center flex flex-col items-center justify-center">
                            <Clock className="w-10 h-10 text-muted/30 mb-2" />
                            <p className="text-xs text-muted font-medium">
                                {l('ჯერ არცერთი მოსწავლე არ გამოცხადებულა', 'Пока никто из учеников не отметился', 'No students have checked in yet')}
                            </p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
