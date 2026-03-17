'use client';

import Link from 'next/link';
import { BookOpen, Clock, Users, ChevronRight, Plus, GraduationCap, CalendarDays } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { GroupModal } from '@/components/groups/GroupModal';
import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { getGroups, saveGroups, type Group, slotsToDisplay } from '@/lib/group-store';
import { deleteGroupEvents } from '@/lib/event-store';
import { useStudio } from '@/contexts/StudioContext';
import { getTeachers } from '@/lib/teacher-store';

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

    const { settings } = useStudio();
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
        if (editing) {
            updated = groups.map(g => g.id === editing.id ? { ...g, ...data } as Group : g);
        } else {
            const newGroup: Group = {
                id: data.id || String(Date.now()),
                name: data.name || '',
                coach: data.coach || '',
                teacherId: data.teacherId || '',
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
        setGroups(updated);
        saveGroups(updated);
    }

    function handleDelete(id: string) {
        const updated = groups.filter(g => g.id !== id);
        setGroups(updated);
        saveGroups(updated);
        deleteGroupEvents(id);
    }

    const teachers = getTeachers();

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-up pb-10 px-4 sm:px-0">
            <div className="flex items-center justify-end mb-2">
                <button onClick={() => { setEditing(null); setModalOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white text-sm font-black px-6 py-3.5 rounded-2xl shadow-xl shadow-indigo-600/20 touch-manipulation">
                    <Plus className="w-5 h-5" />
                    <span>{t.addToGroup}</span>
                </button>
            </div>

            {/* Quick stats */}
            {(() => {
                const totalStudents = groups.reduce((s, g) => s + (g.enrolled || 0), 0);
                const avgFill = groups.length > 0 ? Math.round(groups.reduce((s, g) => s + ((g.enrolled / g.capacity) * 100), 0) / groups.length) : 0;

                return (
                    <div className="grid grid-cols-3 gap-3 sm:gap-4">
                        {[
                            { label: t.groupsShort, value: String(groups.length), icon: BookOpen, cls: 'text-violet-600 bg-violet-500/10 border-violet-500/20' },
                            { label: t.activeStudentsShort, value: String(totalStudents), icon: Users, cls: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20' },
                            { label: t.fillRateShort, value: avgFill + '%', icon: GraduationCap, cls: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
                        ].map(s => (
                            <div key={s.label} className="bg-card border border-border-subtle rounded-3xl p-3 sm:p-5 flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4 shadow-sm group hover:shadow-xl hover:shadow-black/5 transition-all text-center sm:text-left">
                                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl border flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform ${s.cls}`}>
                                    <s.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-lg sm:text-xl font-black text-primary tabular-nums leading-none tracking-tight">{s.value}</p>
                                    <p className="text-[8px] sm:text-[10px] text-muted font-black uppercase tracking-widest mt-1 opacity-40 truncate">{s.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 stagger">
                {groups.map(group => {
                    const fillPct = Math.round((group.enrolled / group.capacity) * 100);
                    const teacher = teachers.find(tc => tc.id === group.teacherId);
                    const gColor = group.color || '#6366f1';

                    return (
                        <div key={group.id} onClick={() => { setEditing(group); setModalOpen(true); }}
                            className="group bg-card border border-border-subtle hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/5 rounded-[2rem] p-6 transition-all duration-500 cursor-pointer relative overflow-hidden flex flex-col justify-between h-full">

                            {/* Color Accent Bar */}
                            <div className="absolute top-0 left-0 w-full h-[6px]" style={{ backgroundColor: gColor, opacity: 0.6 }} />

                            <div className="relative flex items-start justify-between gap-4 mb-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <h3 className="text-lg font-black text-primary truncate group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{group.name}</h3>
                                        <div className="flex flex-wrap gap-2">
                                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black border uppercase tracking-widest shrink-0 ${typeColor[group.type] || typeColor.Dance}`}>{group.type}</span>
                                            {group.difficulty && (
                                                <span className="px-2.5 py-1 rounded-full text-[9px] font-black bg-surface text-muted/60 border border-border-subtle uppercase tracking-widest shrink-0">{group.difficulty}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-full border border-border-subtle bg-surface flex-shrink-0 overflow-hidden shadow-inner flex items-center justify-center">
                                            {teacher?.photo_url ? (
                                                <img src={teacher.photo_url} alt={group.coach} className="w-full h-full object-cover" />
                                            ) : (
                                                <GraduationCap className="w-5 h-5 text-muted/40" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-black text-primary/80 truncate leading-none mb-1">{group.coach}</p>
                                            <p className="text-[9px] font-bold text-muted uppercase tracking-widest opacity-60">{t.teachers}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-3 pt-1 shrink-0">
                                    <div className="text-xs font-black text-indigo-600 tabular-nums bg-indigo-500/5 px-2.5 py-1 rounded-xl border border-indigo-500/10 shadow-sm">{fillPct}%</div>
                                    <ChevronRight className="w-5 h-5 text-muted opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3 text-[10px] font-black text-muted uppercase tracking-widest">
                                    <div className="flex items-center gap-2 bg-surface/50 p-2.5 rounded-xl border border-border-subtle/30">
                                        <Clock className="w-3.5 h-3.5 opacity-40" />
                                        <span className="truncate">{slotsToDisplay(group.schedule_slots || [], lang)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-surface/50 p-2.5 rounded-xl border border-border-subtle/30">
                                        <Users className="w-3.5 h-3.5 opacity-40" />
                                        <span>{group.enrolled} / {group.capacity}</span>
                                    </div>
                                </div>

                                <div className="relative w-full bg-surface rounded-full h-2.5 overflow-hidden shadow-inner">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(99,102,241,0.2)] ${fillPct > 85 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                        style={{ width: `${fillPct}%`, backgroundColor: fillPct > 85 ? undefined : gColor }}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Cross-page quick nav */}
            <div className="bg-card border border-border-subtle rounded-[2.5rem] p-8 mt-8 shadow-sm">
                <p className="text-[10px] font-black text-muted uppercase tracking-[0.3em] mb-6 opacity-40 text-center">{t.linkedPages}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { href: '/teachers', label: t.teachers, icon: GraduationCap, color: '#6366f1', desc: t.academicStaff },
                        { href: '/calendar', label: t.calendar, icon: CalendarDays, color: '#8b5cf6', desc: t.fullSchedule },
                        { href: '/attendance', label: t.attendance, icon: BookOpen, color: '#10b981', desc: t.attendanceRecording },
                    ].map(l => (
                        <Link key={l.href} href={l.href}
                            className="flex flex-col items-center text-center gap-3 p-6 rounded-3xl bg-surface/50 border border-border-subtle hover:border-indigo-500/30 hover:bg-card hover:shadow-2xl hover:shadow-black/5 transition-all duration-300 touch-manipulation group">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all shadow-inner"
                                style={{ background: l.color + '10', border: `1px solid ${l.color}25` }}>
                                <l.icon className="w-7 h-7" style={{ color: l.color }} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-black text-primary leading-tight mb-1">{l.label}</p>
                                <p className="text-[10px] text-muted font-bold opacity-60 uppercase tracking-widest">{l.desc}</p>
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
