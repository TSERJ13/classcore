'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import Link from 'next/link';
import {
    UserPlus, Search, Phone, Mail, Users, User, BookOpen,
    ChevronRight, Edit2, Zap, CalendarDays, BarChart2, Trash2
} from 'lucide-react';
import { cn, getInitials, formatCurrency } from '@/lib/utils';
import { TeacherModal } from '@/components/teachers/TeacherModal';
import { useT } from '@/contexts/LanguageContext';
import { useStudio } from '@/contexts/StudioContext';
import type { Teacher } from '@/types';
import type { StaffMember } from '@/lib/settings-store';
import { getGroups } from '@/lib/group-store';



const STATUS_STYLE: Record<string, string> = {
    active: 'badge-active',
    on_leave: 'badge-warning',
    inactive: 'bg-surface text-muted border border-border-subtle',
};

export default function TeachersPage() {
    const { t } = useT();
    const { settings, addStaff, updateStaff, removeStaff } = useStudio();
    const { user, profile } = useUser();
    const groups = getGroups();
    const GROUP_MAP = Object.fromEntries(groups.map(g => [g.id, g.name]));

    const isDemo = !user || profile?.studio_name === 'Demo Dance Studio' || !profile?.studio_name;
    console.log('TeachersPage isDemo:', isDemo);

    const teachers = (settings.staff || []) as unknown as Teacher[];

    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Teacher | null>(null);

    const STATUS_LABEL: Record<string, string> = {
        active: t.active,
        on_leave: t.onLeave,
        inactive: t.inactive,
    };

    const filtered = teachers.filter(t => {
        const fullName = `${t.first_name || ''} ${t.last_name || t.full_name || ''}`.trim().toLowerCase();
        return fullName.includes(search.toLowerCase());
    });

    function openAdd() { setEditing(null); setModalOpen(true); }
    function openEdit(t: Teacher) { setEditing(t); setModalOpen(true); }

    function handleSave(data: Partial<Teacher>) {
        if (editing) {
            updateStaff(editing.id, data as any);
        } else {
            addStaff({
                ...data,
                status: data.status || 'active',
                permissions: data.permissions || {
                    canViewAttendance: true,
                    canViewSubscriptions: true,
                    canViewStudents: true,
                    canViewCalendar: true,
                    canEditCalendar: true,
                    canViewGroups: true,
                    canViewTeachers: true,
                    canViewHalls: true,
                    canViewShop: true,
                    canViewAnalytics: true,
                    canViewSMS: true
                }
            } as any);
        }
        setModalOpen(false);
    }

    function handleDelete(id: string) {
        if (window.confirm(t.confirmDelete)) {
            removeStaff(id);
        }
    }


    const activeCount = teachers.filter(t => t.status === 'active').length;
    const individualCount = teachers.filter(t => t.assigned_individual).length;

    return (
        <>
            <div className="space-y-8 animate-fade-up max-w-4xl mx-auto pb-10">
                {/* Header */}
                <div className="flex items-center justify-end mb-2">
                    <button onClick={openAdd}
                        className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 active:scale-[0.97] transition-all text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl shadow-violet-600/20 whitespace-nowrap">
                        <UserPlus className="w-4 h-4" />
                        <span>{t.addTeacher}</span>
                    </button>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    {[
                        { label: t.totalTeachersShort, value: String(teachers.length), icon: Users, cls: 'text-violet-600 bg-violet-500/10 border-violet-500/20' },
                        { label: t.indSessionsShort, value: String(individualCount), icon: User, cls: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20' },
                        { label: t.groupsShort, value: String(groups.length), icon: BookOpen, cls: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
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

                {/* Search */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-violet-500 transition-colors pointer-events-none" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.teacherSearchPlaceholder}
                        className="w-full bg-card border border-border-subtle rounded-2xl pl-11 pr-5 py-3 text-sm text-primary placeholder:text-muted/30 focus:outline-none focus:border-violet-500/60 transition-all shadow-sm" />
                </div>

                {/* Teacher cards */}
                <div className="grid gap-4 stagger">
                    {filtered.map(teacher => (
                        <div key={teacher.id}
                            className="group bg-card border-2 border-border-subtle hover:border-violet-500/40 hover:shadow-xl hover:shadow-violet-500/5 rounded-[2rem] p-6 transition-all duration-300 relative overflow-hidden flex flex-col">
                            <div className="flex items-start gap-5">
                                {/* Avatar */}
                                <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-lg font-black text-white flex-shrink-0 shadow-lg shadow-violet-500/20 group-hover:scale-110 transition-transform overflow-hidden">
                                    {teacher.photo_url ? (
                                        <img src={teacher.photo_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        getInitials(`${teacher.first_name || ''} ${teacher.last_name || teacher.full_name || ''}`)
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0 pt-0.5">
                                    <div className="flex flex-wrap items-center gap-2.5 mb-2">
                                        <p className="text-base font-black text-primary group-hover:text-violet-600 transition-colors uppercase tracking-tight">{teacher.first_name} {teacher.last_name}</p>
                                        <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider', STATUS_STYLE[teacher.status])}>
                                            {STATUS_LABEL[teacher.status]}
                                        </span>
                                    </div>


                                    {/* Contacts & rates */}
                                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] font-bold text-muted opacity-50 px-1">
                                        <span className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 opacity-40" />{teacher.phone}</span>
                                        {teacher.email && <span className="flex items-center gap-2 hidden md:flex"><Mail className="w-3.5 h-3.5 opacity-40" />{teacher.email}</span>}
                                        <div className="flex gap-4">
                                            {teacher.rate_per_hour && <span className="text-emerald-600 font-black tracking-tight">{formatCurrency(teacher.rate_per_hour, settings.currency)} / {t.perHourShort}</span>}
                                            {teacher.rate_per_month && <span className="text-emerald-600 font-black tracking-tight">{formatCurrency(teacher.rate_per_month, settings.currency)} / {t.perMonthShort}</span>}
                                            {teacher.salary_percentage && <span className="text-rose-500 font-black tracking-tight">{teacher.salary_percentage}% ({t.shareShort})</span>}
                                        </div>
                                    </div>

                                    {/* Assigned groups */}
                                    {(teacher.assigned_group_ids || []).length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border-subtle/50">
                                            {teacher.assigned_group_ids.map(gid => (
                                                <span key={gid} className="px-3 py-1.5 bg-surface border border-border-subtle text-muted text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <BookOpen className="w-3.5 h-3.5 text-violet-500" />{GROUP_MAP[gid] ?? gid}
                                                </span>
                                            ))}
                                            {teacher.assigned_individual && (
                                                <span className="px-3 py-1.5 bg-indigo-500/5 border border-indigo-500/10 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2">
                                                    <Zap className="w-3.5 h-3.5" />{t.indSessionShort}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Actions hover */}
                                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                    <button onClick={(e) => { e.stopPropagation(); openEdit(teacher); }}
                                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-surface border border-border-subtle text-muted hover:text-violet-600 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all shadow-sm">
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); if (window.confirm(t.confirmDelete)) handleDelete(teacher.id); }}
                                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-surface border border-border-subtle text-muted hover:text-red-500 hover:border-red-500/40 hover:bg-red-500/5 transition-all shadow-sm">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {filtered.length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center text-muted/30">
                            <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
                                <Users className="w-10 h-10 opacity-20" />
                            </div>
                            <p className="text-base font-bold">{t.noData}</p>
                            <p className="text-xs font-medium mt-1">{t.tryAnotherSearch}</p>
                        </div>
                    )}
                </div>

                {/* Cross-page quick nav */}
                <div className="bg-surface/50 border border-border-subtle rounded-3xl p-6 mt-6">
                    <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-4 opacity-40">{t.linkedPages}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                            { href: '/calendar', label: t.calendar, icon: CalendarDays, color: '#6366f1', desc: t.academicSchedule },
                            { href: '/groups', label: t.groups, icon: BookOpen, color: '#f59e0b', desc: t.activeGroups },
                            { href: '/attendance', label: t.attendance, icon: BarChart2, color: '#10b981', desc: t.attendanceAnalytics },
                        ].map(l => (
                            <Link key={l.href} href={l.href}
                                className="flex items-center gap-3.5 p-4 rounded-2xl bg-card border border-border-subtle hover:border-violet-500/30 hover:shadow-lg hover:shadow-black/5 transition-all group">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-inner"
                                    style={{ background: l.color + '10', border: `1px solid ${l.color}25` }}>
                                    <l.icon className="w-5 h-5" style={{ color: l.color }} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-primary truncate leading-tight">{l.label}</p>
                                    <p className="text-[10px] text-muted font-medium opacity-60 mt-0.5">{l.desc}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            <TeacherModal
                open={modalOpen}
                teacher={editing}
                groups={groups}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                onDelete={handleDelete}
            />
        </>
    );
}
