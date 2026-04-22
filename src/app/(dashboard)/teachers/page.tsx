'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import Link from 'next/link';
import {
    UserPlus, Search, Phone, Mail, Users, User, BookOpen,
    ChevronRight, Edit2, Zap, CalendarDays, BarChart2, Trash2, MessageSquare
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
    const { t, lang } = useT();
    const { settings, addStaff, updateStaff, removeStaff } = useStudio();
    const { user, profile } = useUser();
    
    const [groups, setGroups] = useState(getGroups());
    useEffect(() => {
        const load = () => setGroups(getGroups());
        window.addEventListener('cc_groups_update', load);
        return () => window.removeEventListener('cc_groups_update', load);
    }, []);

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
        removeStaff(id);
    }


    const activeCount = teachers.filter(t => t.status === 'active').length;
    const individualCount = teachers.filter(t => t.assigned_individual).length;

    return (
        <>
            <div className="space-y-8 animate-fade-up max-w-7xl mx-auto pb-10">
            {/* ── Top Header Row: Metrics & Add Action ── */}
            <div className="flex flex-row items-center justify-between gap-3 sm:gap-4 lg:gap-8">
                {/* Quick stats - Scoped and Clean */}
                <div className="flex items-center gap-2 sm:gap-3 lg:gap-6 overflow-x-auto no-scrollbar flex-1 py-1">
                    {[
                        { label: t.totalTeachersShort, value: String(teachers.length), icon: Users, colorCls: 'text-violet-600', bgCls: 'bg-violet-500/5' },
                        { label: t.indSessionsShort, value: String(individualCount), icon: User, colorCls: 'text-indigo-600', bgCls: 'bg-indigo-500/5' },
                        { label: t.groupsShort, value: String(groups.length), icon: BookOpen, colorCls: 'text-emerald-600', bgCls: 'bg-emerald-500/5' },
                    ].map(s => (
                        <div key={s.label} className={`flex flex-col justify-center px-4 sm:px-6 lg:px-10 h-12 lg:h-20 rounded-full border border-border-subtle/50 min-w-fit transition-all text-center sm:text-left ${s.bgCls}`}>
                            <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
                                <s.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-6 lg:h-6 ${s.colorCls} opacity-60`} />
                                <span className="text-[13px] sm:text-[16px] lg:text-2xl font-black text-primary leading-none tabular-nums">{s.value}</span>
                            </div>
                            <p className="text-[7px] sm:text-[8px] lg:text-[10px] text-muted font-black tracking-widest mt-1 lg:mt-2 opacity-40 uppercase">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Add Teacher Action */}
                <button onClick={openAdd}
                    className="flex-shrink-0 flex items-center justify-center gap-2 w-12 h-12 sm:w-auto px-0 sm:px-6 bg-[#6d28d9] hover:bg-[#5b21b6] active:scale-95 text-white text-[11px] font-black tracking-widest rounded-[1.25rem] transition-all touch-manipulation">
                    <UserPlus className="w-5 h-5" />
                    <span className="hidden sm:inline uppercase">{t.addTeacher}</span>
                </button>
            </div>

            {/* Teacher cards */}
                <div className="grid gap-4 stagger">
                    {filtered.map(teacher => (
                        <div key={teacher.id}
                            className="group bg-card border-2 border-border-subtle hover:border-violet-500/40 hover:shadow-xl hover:shadow-violet-500/5 rounded-3xl p-4 transition-all duration-300 relative overflow-hidden flex flex-col">
                            <div className="flex items-start gap-4">
                                {/* Avatar with Status Dot */}
                                <div className="relative flex-shrink-0">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-base font-black text-white shadow-lg shadow-violet-500/20 group-hover:scale-105 transition-transform overflow-hidden">
                                        {teacher.photo_url ? (
                                            <img src={teacher.photo_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            getInitials(`${teacher.first_name || ''} ${teacher.last_name || teacher.full_name || ''}`)
                                        )}
                                    </div>
                                    <div className={cn(
                                        "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card shadow-sm",
                                        teacher.status === 'active' ? "bg-emerald-500" : 
                                        teacher.status === 'on_leave' ? "bg-amber-500" : "bg-muted"
                                    )} />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-sm font-black text-primary group-hover:text-violet-600 transition-colors tracking-tight truncate">
                                            {teacher.first_name} {teacher.last_name}
                                        </p>
                                        
                                        {/* Actions */}
                                        <button onClick={(e) => { e.stopPropagation(); openEdit(teacher); }}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface border border-border-subtle text-muted hover:text-violet-600 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all shadow-sm">
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                    </div>

                                    {/* Contacts & rates - more compact */}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-muted/60">
                                        <div className="flex items-center gap-2">
                                            <a href={`tel:${teacher.phone}`} className="flex items-center gap-1.5 hover:text-indigo-500 transition-colors">
                                                <Phone className="w-3 h-3 opacity-40 shrink-0" />
                                                {teacher.phone}
                                            </a>
                                            <a href={`sms:${teacher.phone}`} className="p-1 px-1.5 bg-indigo-500/5 hover:bg-indigo-500/10 rounded-md transition-all active:scale-90 group/sms">
                                                <MessageSquare className="w-3 h-3 text-indigo-500 opacity-60 group-hover/sms:opacity-100" />
                                            </a>
                                        </div>
                                        <div className="flex gap-3">
                                            {teacher.rate_per_hour && <span className="text-emerald-600 font-black tracking-tight">{formatCurrency(teacher.rate_per_hour, settings.currency)}/h</span>}
                                            {teacher.rate_per_month && <span className="text-emerald-600 font-black tracking-tight">{formatCurrency(teacher.rate_per_month, settings.currency)}/m</span>}
                                        </div>
                                    </div>

                                    {/* Assigned groups - even smaller font */}
                                    {(teacher.assigned_group_ids || []).length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2.5 pt-2.5 border-t border-border-subtle/30">
                                            {teacher.assigned_group_ids.map(gid => (
                                                <span key={gid} className="px-2 py-0.5 bg-surface text-muted/50 text-[8px] font-black tracking-wider rounded-md flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    <BookOpen className="w-2.5 h-2.5 text-violet-500/50" />{GROUP_MAP[gid] ?? gid}
                                                </span>
                                            ))}
                                            {teacher.assigned_individual && (
                                                <span className="px-2 py-0.5 bg-indigo-500/5 text-indigo-600/60 text-[8px] font-black tracking-wider rounded-md flex items-center gap-1">
                                                    <Zap className="w-2.5 h-2.5" />{t.indSessionShort}
                                                </span>
                                            )}
                                        </div>
                                    )}
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
                <div className="bg-card border border-border-subtle rounded-[2.5rem] px-3 py-8 sm:p-8 mt-20 shadow-sm">
                    <p className="text-[10px] font-black text-muted tracking-[0.3em] mb-6 opacity-40 text-center">{t.linkedPages}</p>
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                        {[
                            { href: '/calendar', label: t.calendar, icon: CalendarDays, color: '#6366f1', desc: t.academicSchedule },
                            { href: '/groups', label: t.groups, icon: BookOpen, color: '#f59e0b', desc: t.activeGroups },
                            { href: '/attendance', label: t.attendance, icon: BarChart2, color: '#10b981', desc: t.attendanceAnalytics },
                        ].map(l => (
                            <Link key={l.href} href={l.href}
                                className="flex flex-col items-center text-center gap-2 sm:gap-3 px-1.5 py-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-surface/50 border border-border-subtle hover:border-violet-500/30 hover:bg-card hover:shadow-2xl hover:shadow-black/5 transition-all duration-300 touch-manipulation group">
                                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all shadow-inner"
                                    style={{ background: l.color + '10', border: `1px solid ${l.color}25` }}>
                                    <l.icon className="w-5 h-5 sm:w-7 sm:h-7" style={{ color: l.color }} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] sm:text-sm font-black text-primary leading-tight mb-0.5 sm:mb-1">{l.label}</p>
                                    <p className="text-[8px] sm:text-[10px] text-muted font-bold opacity-60 tracking-widest line-clamp-1 sm:line-clamp-none">{l.desc}</p>
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
