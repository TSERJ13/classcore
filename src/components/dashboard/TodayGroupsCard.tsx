'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Users, Check, Clock, ChevronRight, Sparkles, Plus } from 'lucide-react';
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

function getInitials(name: string) {
    if (!name) return 'S';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
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
    const [animatingId, setAnimatingId] = useState<string | null>(null);

    const activeDate = currentDate || new Date();
    const activeDateStr = getLocalISODate(activeDate);
    const dayOfWeek = (activeDate.getDay() + 6) % 7;

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
        const events = ['cc_checkins_update', 'cc_groups_update', 'cc_student_update', 'cc_calendar_events_update', 'cc_branch_change'];
        events.forEach(e => window.addEventListener(e, loadData));
        return () => events.forEach(e => window.removeEventListener(e, loadData));
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

    const activeGroup = useMemo(() => todayGroups.find(g => g.id === activeGroupId) || null, [todayGroups, activeGroupId]);

    const enrolledStudents = useMemo(() => {
        if (!activeGroupId) return [];
        return students.filter(s => s.enrolled_group_ids?.includes(activeGroupId));
    }, [students, activeGroupId]);

    // Map of checked-in students
    const checkinMap = useMemo(() => {
        const m = new Map<string, CheckinRecord>();
        checkins.forEach(c => { if (c.studentId) m.set(c.studentId, c); });
        return m;
    }, [checkins]);

    const handleCheckin = async (student: Student) => {
        if (!activeGroup) return;
        const alreadyIn = checkinMap.has(student.id);
        if (alreadyIn) return; // don't double-check
        setAnimatingId(student.id);
        recordCheckin(student.id, student.full_name, 'manual', undefined, activeGroup.id);
        setCheckins(getTodayCheckins());
        if (onRefreshDashboard) onRefreshDashboard();
        setTimeout(() => setAnimatingId(null), 600);
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

    const attendedCount = useMemo(() => enrolledStudents.filter(s => checkinMap.has(s.id)).length, [enrolledStudents, checkinMap]);

    return (
        <div className="bg-card border border-border-subtle rounded-2xl overflow-hidden flex flex-col h-full min-h-[460px] shadow-xs">
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
                                        onClick={() => setActiveGroupId(group.id)}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex-shrink-0 border cursor-pointer",
                                            isSelected
                                                ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                                                : "bg-card hover:bg-surface text-muted border-border-subtle"
                                        )}
                                    >
                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: group.color || '#6366f1' }} />
                                        <span className="truncate max-w-[130px]">{group.name}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Group meta + attendance counter */}
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
                                            {l('მასწ.:', 'Учитель:', 'Coach:')} <strong className="text-primary">{teacherName}</strong>
                                        </span>
                                    )}
                                    {hallName && (
                                        <span className="truncate hidden md:inline">
                                            {l('დარბ.:', 'Зал:', 'Hall:')} <strong className="text-primary">{hallName}</strong>
                                        </span>
                                    )}
                                </div>
                                {/* Attendance progress */}
                                <span className={cn(
                                    "flex-shrink-0 font-bold px-2 py-0.5 rounded-md",
                                    attendedCount > 0 && attendedCount === enrolledStudents.length
                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                        : "bg-surface text-muted"
                                )}>
                                    {attendedCount}/{enrolledStudents.length}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* ── Student Grid (2 columns, attendance-style) ── */}
                    <div className="flex-1 overflow-y-auto max-h-[390px] p-3">
                        {enrolledStudents.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {enrolledStudents.map(student => {
                                    const isPresent = checkinMap.has(student.id);
                                    const isAnimating = animatingId === student.id;
                                    const initials = getInitials(student.full_name || 'S');

                                    return (
                                        <button
                                            key={student.id}
                                            onClick={() => handleCheckin(student)}
                                            disabled={isPresent}
                                            className={cn(
                                                "relative flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all active:scale-95 cursor-pointer",
                                                isPresent
                                                    ? "bg-emerald-500/10 border-emerald-500 shadow-md shadow-emerald-500/10"
                                                    : "bg-surface border-border-subtle hover:border-indigo-400/50 hover:bg-surface/80",
                                                isAnimating && "scale-95"
                                            )}
                                        >
                                            {/* Photo / Avatar */}
                                            <div className={cn(
                                                "w-10 h-10 rounded-full border-[2.5px] flex items-center justify-center overflow-hidden flex-shrink-0 transition-all",
                                                isPresent
                                                    ? "border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.35)]"
                                                    : "border-border-subtle"
                                            )}>
                                                {student.photo_url ? (
                                                    <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className={cn(
                                                        "w-full h-full flex items-center justify-center font-black text-[11px]",
                                                        isPresent ? "bg-emerald-500 text-white" : "bg-indigo-500/15 text-indigo-400"
                                                    )}>
                                                        {initials}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Name */}
                                            <p className={cn(
                                                "text-[10px] font-bold text-center leading-tight w-full truncate px-0.5",
                                                isPresent ? "text-emerald-700 dark:text-emerald-300" : "text-primary"
                                            )}>
                                                {student.full_name}
                                            </p>

                                            {/* Check / Plus badge */}
                                            <div className={cn(
                                                "absolute top-1 right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center",
                                                isPresent ? "bg-emerald-500 shadow-sm" : "bg-surface border border-border-subtle"
                                            )}>
                                                {isPresent
                                                    ? <Check className="w-2 h-2 text-white stroke-[3]" />
                                                    : <Plus className="w-2 h-2 text-muted/50 stroke-[2]" />
                                                }
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-10 text-center flex flex-col items-center justify-center h-full">
                                <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
                                    <Sparkles className="w-6 h-6" />
                                </div>
                                <p className="text-xs font-bold text-primary mb-1">
                                    {l('ამ ჯგუფში მოსწავლეები არ არიან ჩაწერილი', 'В этой группе нет записанных учеников', 'No students enrolled in this group')}
                                </p>
                                <p className="text-[11px] text-muted">
                                    {l('გადადით ჯგუფების მართვაში მოსწავლეების დასამატებლად', 'Перейдите в раздел Группы', 'Go to Groups to add students')}
                                </p>
                            </div>
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
