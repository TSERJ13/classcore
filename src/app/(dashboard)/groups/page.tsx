'use client';

import Link from 'next/link';
import { BookOpen, Clock, Users, ChevronRight, Plus, GraduationCap, CalendarDays, Search, Pencil } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { GroupModal } from '@/components/groups/GroupModal';
import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { getGroups, saveGroups, deleteGroup, type Group, slotsToDisplay } from '@/lib/group-store';
import { deleteGroupEvents } from '@/lib/event-store';
import { useStudio } from '@/contexts/StudioContext';
import { getTeachers } from '@/lib/teacher-store';
import { cn } from '@/lib/utils';

const typeColor: Record<string, string> = {
    Dance: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    Sports: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    Yoga: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    Fitness: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

export default function GroupsPage() {
    const { t, lang } = useT();
    const { user, profile } = useUser();
    const isDemo = !user || profile?.studio_name === 'Demo Dance Studio' || !profile?.studio_name;

    const [groups, setGroups] = useState<Group[]>([]);

    const { settings, updateStaff } = useStudio();
    useEffect(() => {
        function load() { setGroups(getGroups()); }
        load();
        window.addEventListener('cc_groups_update', load);
        return () => window.removeEventListener('cc_groups_update', load);
    }, [settings.activeBranchId]);

    const [editing, setEditing] = useState<Group | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    function handleSave(data: Partial<Group>) {
        let updated: Group[];
        const oldTeacherId = editing?.teacherId;
        const newTeacherId = data.teacherId;

        if (editing) {
            updated = groups.map(g => g.id === editing.id ? { ...g, ...data } as Group : g);
        } else {
            const newGroup: Group = {
                id: data.id || `g_${Date.now()}`,
                name: data.name || '',
                coach: data.coach || '',
                teacherId: data.teacherId || '',
                secondaryTeacherId: data.secondaryTeacherId || '',
                secondaryTeacherName: data.secondaryTeacherName || '',
                primaryTeacherPercentage: data.primaryTeacherPercentage || 0,
                secondaryTeacherPercentage: data.secondaryTeacherPercentage || 0,
                schedule: data.schedule || '',
                schedule_slots: data.schedule_slots || [],
                capacity: data.capacity || 20,
                enrolled: 0,
                type: data.type || 'Dance',
                difficulty: data.difficulty || null,
                hall_id: data.hall_id || '',
                color: data.color || '#6366f1',
            };
            updated = [...groups, newGroup];
        }

        // Sync with StudioContext Teachers
        const gid = editing?.id || updated[updated.length - 1].id;

        // 1. Primary Teacher Sync
        if (oldTeacherId !== newTeacherId) {
            if (oldTeacherId) {
                const oldT = settings.staff.find(s => s.id === oldTeacherId);
                if (oldT) {
                    const nextGroups = (oldT.assigned_group_ids || []).filter(id => id !== gid);
                    updateStaff(oldTeacherId, { assigned_group_ids: nextGroups });
                }
            }
            if (newTeacherId) {
                const newT = settings.staff.find(s => s.id === newTeacherId);
                if (newT) {
                    const nextGroups = Array.from(new Set([...(newT.assigned_group_ids || []), gid]));
                    updateStaff(newTeacherId, { assigned_group_ids: nextGroups });
                }
            }
        }

        // 2. Secondary Teacher Sync
        const oldSecondaryId = editing?.secondaryTeacherId;
        const newSecondaryId = data.secondaryTeacherId;
        if (oldSecondaryId !== newSecondaryId) {
            if (oldSecondaryId) {
                const oldST = settings.staff.find(s => s.id === oldSecondaryId);
                if (oldST) {
                    const nextGroups = (oldST.assigned_group_ids || []).filter(id => id !== gid);
                    updateStaff(oldSecondaryId, { assigned_group_ids: nextGroups });
                }
            }
            if (newSecondaryId) {
                const newST = settings.staff.find(s => s.id === newSecondaryId);
                if (newST) {
                    const nextGroups = Array.from(new Set([...(newST.assigned_group_ids || []), gid]));
                    updateStaff(newSecondaryId, { assigned_group_ids: nextGroups });
                }
            }
        }

        setGroups(updated);
        saveGroups(updated);
    }

    function handleDelete(id: string) {
        deleteGroup(id); // Store handles sync and state
        deleteGroupEvents(id);
    }

    const [teachers, setTeachers] = useState(getTeachers());
    useEffect(() => {
        const load = () => setTeachers(getTeachers());
        window.addEventListener('cc_teacher_update', load);
        return () => window.removeEventListener('cc_teacher_update', load);
    }, []);

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-up pb-10">
            {/* ── Top Header Row: Metrics & Add Action ── */}
            <div className="flex flex-row items-center justify-between gap-3 sm:gap-4">
                {/* Metrics Bar */}
                {(() => {
                    const totalStudents = groups.reduce((s, g) => s + (g.enrolled || 0), 0);
                    const avgFill = groups.length > 0 ? Math.round(groups.reduce((s, g) => s + ((g.enrolled / g.capacity) * 100), 0) / groups.length) : 0;

                    return (
                        <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-6 overflow-x-auto no-scrollbar flex-1 sm:flex-none py-1">
                            {/* Groups Stat */}
                            <div className="flex flex-col justify-center px-4 sm:px-6 lg:px-10 h-12 lg:h-20 rounded-full bg-violet-500/5 border border-border-subtle/50 min-w-fit">
                                <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
                                    <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-6 lg:h-6 text-violet-600 opacity-60" />
                                    <span className="text-[13px] sm:text-[16px] lg:text-2xl font-black text-primary leading-none">{groups.length}</span>
                                </div>
                                <span className="text-[7px] sm:text-[8px] lg:text-[10px] font-black text-muted tracking-[0.2em] uppercase opacity-40 mt-1 lg:mt-2">{t.groupsShort}</span>
                            </div>
                            {/* Students Stat */}
                            <div className="flex flex-col justify-center px-4 sm:px-6 lg:px-10 h-12 lg:h-20 rounded-full bg-indigo-500/5 border border-border-subtle/50 min-w-fit">
                                <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
                                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-6 lg:h-6 text-indigo-600 opacity-60" />
                                    <span className="text-[13px] sm:text-[16px] lg:text-2xl font-black text-primary leading-none">{totalStudents}</span>
                                </div>
                                <span className="text-[7px] sm:text-[8px] lg:text-[10px] font-black text-muted tracking-[0.2em] uppercase opacity-40 mt-1 lg:mt-2">{t.activeStudentsShort}</span>
                            </div>
                            {/* Fill Rate Stat */}
                            <div className="flex flex-col justify-center px-4 sm:px-6 lg:px-10 h-12 lg:h-20 rounded-full bg-emerald-500/5 border border-border-subtle/50 min-w-fit">
                                <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
                                    <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-6 lg:h-6 text-emerald-600 opacity-60" />
                                    <span className="text-[13px] sm:text-[16px] lg:text-2xl font-black text-primary leading-none">{avgFill}%</span>
                                </div>
                                <span className="text-[7px] sm:text-[8px] lg:text-[10px] font-black text-muted tracking-[0.2em] uppercase opacity-40 mt-1 lg:mt-2">{t.fillRateShort}</span>
                            </div>
                        </div>
                    );
                })()}

                {/* Add Group Action */}
                {/* Add Group Action */}
                <button onClick={() => { setEditing(null); setModalOpen(true); }}
                    className="flex-shrink-0 flex items-center justify-center gap-2 w-12 h-12 sm:w-auto px-0 sm:px-6 bg-[#6d28d9] hover:bg-[#5b21b6] active:scale-95 text-white text-[11px] font-black tracking-widest rounded-[1.25rem] transition-all touch-manipulation">
                    <div className="relative">
                        <Users className="w-5 h-5 sm:w-4 sm:h-4 text-white" />
                        <Plus className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-[#6d28d9] rounded-full border border-white/20" />
                    </div>
                    <span className="hidden sm:inline uppercase">{t.addToGroup}</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
                {groups.filter(g => {
                    if (profile?.role === 'teacher' || profile?.role === 'coach') {
                        return profile.assigned_group_ids?.includes(g.id);
                    }
                    return true;
                }).map(group => {
                    const fillPct = Math.round((group.enrolled / group.capacity) * 100);
                    const teacher = teachers.find(tc => tc.id === group.teacherId);
                    const secondaryTeacher = group.secondaryTeacherId ? teachers.find(tc => tc.id === group.secondaryTeacherId) : null;
                    const gColor = group.color || '#6366f1';

                    return (
                        <div key={group.id} className="group relative bg-card border border-border-subtle hover:border-indigo-500/30 rounded-[1.5rem] p-4 transition-all duration-300 overflow-hidden flex flex-col gap-3 min-h-[140px]">
                            {/* Color Accent Bar */}
                            <div className="absolute top-0 left-0 w-full h-[4px]" style={{ backgroundColor: gColor, opacity: 0.6 }} />
                            
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-[14px] sm:text-[16px] font-black text-primary leading-tight line-clamp-1 uppercase tracking-tight group-hover:text-indigo-600 transition-colors uppercase">{group.name}</h3>
                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black border tracking-widest shrink-0 ${typeColor[group.type] || typeColor.Dance}`}>{group.type}</span>
                                    </div>
                                                                  <div className="flex items-center gap-2">
                                        <div className="flex -space-x-3 overflow-hidden">
                                            <div className="w-8 h-8 rounded-full bg-surface border border-border-subtle flex items-center justify-center shrink-0 overflow-hidden relative z-10">
                                                {teacher?.photo_url ? (
                                                    <img src={teacher.photo_url} alt={teacher.full_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <GraduationCap className="w-4 h-4 text-muted opacity-40" />
                                                )}
                                            </div>
                                            {secondaryTeacher && (
                                                <div className="w-8 h-8 rounded-full bg-surface border border-border-subtle flex items-center justify-center shrink-0 overflow-hidden relative group-hover:translate-x-1 transition-transform">
                                                    {secondaryTeacher.photo_url ? (
                                                        <img src={secondaryTeacher.photo_url} alt={secondaryTeacher.full_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-indigo-50 flex items-center justify-center">
                                                            <Users className="w-3 h-3 text-indigo-400 opacity-60" />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[10px] font-bold text-primary truncate leading-none block">
                                                {teacher?.full_name || group.coach || t.noTeacher}
                                                {group.secondaryTeacherId && (
                                                    <span className="text-muted/40 font-medium ml-1">
                                                        + {secondaryTeacher?.full_name || group.secondaryTeacherName}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Edit Action - faint by default, prominent on hover */}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setEditing(group); setModalOpen(true); }}
                                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-surface border border-border-subtle text-muted group-hover:text-indigo-600 hover:border-indigo-500/40 transition-all opacity-60 group-hover:opacity-100 active:scale-90 shrink-0"
                                >
                                    <Pencil className="w-3.5 h-3.5" /> 
                                </button>
                            </div>

                                <div className="mt-auto">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                                            {[0, 1, 2, 3, 4, 5, 6].map(d => {
                                                const isActive = group.schedule_slots?.some(s => s.dayOfWeek === d);
                                                const labels = lang === 'ka' ? ['ო', 'ს', 'ო', 'ხ', 'პ', 'შ', 'კ'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
                                                return (
                                                    <div key={d} className={cn(
                                                        "w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black border transition-all shrink-0",
                                                        isActive 
                                                            ? "bg-indigo-500 border-indigo-500/20 text-white shadow-sm" 
                                                            : "bg-surface border-border-subtle/30 text-muted opacity-30"
                                                    )}>
                                                        {labels[d]}
                                                    </div>
                                                );
                                            })}
                                            <div className="w-px h-4 bg-border-subtle/30 mx-1" />
                                            <span className="text-[10px] font-black text-primary/60 whitespace-nowrap">
                                                {group.schedule_slots?.[0]?.startTime}
                                            </span>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-1.5 bg-indigo-500/5 px-2 py-1.5 rounded-xl border border-indigo-500/10 h-8">
                                            <span className="text-[9px] font-black text-indigo-600 tracking-tight">{group.enrolled}/{group.capacity}</span>
                                            <div className="w-px h-3 bg-indigo-500/20" />
                                            <span className="text-[9px] font-black text-indigo-500/60">{fillPct}%</span>
                                        </div>
                                    </div>

                                    <div className="relative w-full bg-surface rounded-full h-1 overflow-hidden shadow-inner mt-2">
                                        <div
                                            className="h-full rounded-full transition-all duration-1000"
                                            style={{ width: `${Math.min(100, fillPct)}%`, backgroundColor: fillPct > 85 ? '#f59e0b' : gColor, boxShadow: `0 0 8px ${fillPct > 85 ? '#f59e0b' : gColor}40` }}
                                        />
                                    </div>
                                </div>
                        </div>
                    );
                })}
            </div>

            {groups.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-muted/30">
                    <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
                        <BookOpen className="w-10 h-10 opacity-20" />
                    </div>
                    <p className="text-base font-bold">{t.noData}</p>
                    <p className="text-xs font-medium mt-1">{t.tryAnotherSearch || 'დაამატეთ ახალი ჯგუფი'}</p>
                </div>
            )}

            {/* Cross-page quick nav */}
            <div className="bg-card border border-border-subtle rounded-[2.5rem] px-3 py-8 sm:p-8 mt-20 shadow-sm">
                <p className="text-[10px] font-black text-muted tracking-[0.3em] mb-6 opacity-40 text-center">{t.linkedPages}</p>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-4">
                    {[
                        { href: '/teachers', label: t.teachers, icon: GraduationCap, color: '#6366f1', desc: t.academicStaff },
                        { href: '/calendar', label: t.calendar, icon: CalendarDays, color: '#8b5cf6', desc: t.fullSchedule },
                        { href: '/attendance', label: t.attendance, icon: BookOpen, color: '#10b981', desc: t.attendanceRecording },
                    ].map(l => (
                        <Link key={l.href} href={l.href}
                            className="flex flex-col items-center text-center gap-1.5 sm:gap-3 px-1 py-3 sm:p-6 rounded-xl sm:rounded-3xl bg-surface/50 border border-border-subtle hover:border-indigo-500/30 hover:bg-card hover:shadow-2xl hover:shadow-black/5 transition-all duration-300 touch-manipulation group">
                            <div className="w-9 h-9 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all shadow-inner"
                                style={{ background: l.color + '10', border: `1px solid ${l.color}25` }}>
                                <l.icon className="w-4 h-4 sm:w-7 sm:h-7" style={{ color: l.color }} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] sm:text-sm font-black text-primary leading-tight mb-0.5 sm:mb-1">{l.label}</p>
                                <p className="text-[7px] sm:text-[10px] text-muted font-bold opacity-60 tracking-widest line-clamp-1 sm:line-clamp-none">{l.desc}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            <GroupModal
                open={modalOpen}
                group={editing || undefined}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                onDelete={handleDelete}
            />
        </div>
    );
}
