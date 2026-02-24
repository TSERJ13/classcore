'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import Link from 'next/link';
import {
    UserPlus, Search, Phone, Mail, Users, User, BookOpen,
    Star, ChevronRight, Edit2, Zap, CalendarDays, BarChart2,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { TeacherModal } from '@/components/teachers/TeacherModal';
import { useT } from '@/contexts/LanguageContext';
import type { Teacher } from '@/types';

const MOCK_GROUPS = [
    { id: 'g1', name: 'Contemporary Dance' },
    { id: 'g2', name: 'Ballet Beginners' },
    { id: 'g3', name: 'Ballet Advanced' },
    { id: 'g4', name: 'Hip-Hop Kids' },
    { id: 'g5', name: 'Latin Dance' },
];

const GROUP_MAP = Object.fromEntries(MOCK_GROUPS.map(g => [g.id, g.name]));

const INITIAL_TEACHERS: Teacher[] = [
    {
        id: 't1', org_id: 'demo', full_name: 'ნინო ბერიძე', phone: '577 11 22 33', email: 'nino@studio.ge',
        specialty: ['Contemporary', 'Jazz'], bio: 'GITIS კურსდამთავრებული, 8 წლის გამოცდილება.',
        rate_per_hour: 50, rate_per_month: 1200,
        assigned_group_ids: ['g1', 'g2'], assigned_individual: true, status: 'active', created_at: '2025-09-01',
    },
    {
        id: 't2', org_id: 'demo', full_name: 'გიორგი კვირიკაშვილი', phone: '555 33 44 55', email: 'giorgi@studio.ge',
        specialty: ['Ballet', 'Modern'],
        rate_per_hour: 45, rate_per_month: 900,
        assigned_group_ids: ['g3', 'g4'], assigned_individual: false, status: 'active', created_at: '2025-10-15',
    },
    {
        id: 't3', org_id: 'demo', full_name: 'სოფო კაციტაძე', phone: '598 55 66 77',
        specialty: ['Salsa', 'Bachata', 'Latin Dance'], bio: 'Latin Dance World Championship 2023 finalistი.',
        rate_per_hour: 60,
        assigned_group_ids: ['g5'], assigned_individual: true, status: 'active', created_at: '2025-11-01',
    },
    {
        id: 't4', org_id: 'demo', full_name: 'ანა ჩხეიძე', phone: '511 77 88 99',
        specialty: ['Hip-Hop'],
        rate_per_hour: 35,
        assigned_group_ids: [], assigned_individual: true, status: 'on_leave', created_at: '2026-01-10',
    },
];

const STATUS_STYLE: Record<string, string> = {
    active: 'badge-active',
    on_leave: 'badge-warning',
    inactive: 'bg-surface text-muted border border-border-subtle',
};

export default function TeachersPage() {
    const { t } = useT();
    const { user, profile } = useUser();
    const isDemo = !user || profile?.studio_name === 'Demo Dance Studio' || !profile?.studio_name;

    const [teachers, setTeachers] = useState<Teacher[]>([]);

    useEffect(() => {
        if (isDemo) {
            setTeachers(INITIAL_TEACHERS);
        } else {
            setTeachers([INITIAL_TEACHERS[0]]);
        }
    }, [isDemo]);

    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Teacher | null>(null);

    const STATUS_LABEL: Record<string, string> = {
        active: t.active,
        on_leave: t.onLeave,
        inactive: t.inactive,
    };

    const filtered = teachers.filter(t =>
        t.full_name.toLowerCase().includes(search.toLowerCase()) ||
        t.specialty.some(s => s.toLowerCase().includes(search.toLowerCase()))
    );

    function openAdd() { setEditing(null); setModalOpen(true); }
    function openEdit(t: Teacher) { setEditing(t); setModalOpen(true); }

    function handleSave(data: Partial<Teacher>) {
        if (editing) {
            setTeachers(prev => prev.map(t => t.id === editing.id ? { ...t, ...data } : t));
        } else {
            setTeachers(prev => [...prev, {
                id: String(Date.now()), org_id: 'demo', created_at: new Date().toISOString(),
                full_name: '', phone: '', specialty: [], assigned_group_ids: [], assigned_individual: false, status: 'active',
                ...data,
            }]);
        }
    }

    function handleDelete(id: string) {
        setTeachers(prev => prev.filter(t => t.id !== id));
    }

    const activeCount = teachers.filter(t => t.status === 'active').length;
    const individualCount = teachers.filter(t => t.assigned_individual).length;

    return (
        <>
            <div className="space-y-8 animate-fade-up max-w-4xl mx-auto pb-10">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-primary tracking-tight">{t.teachers}</h1>
                        <p className="text-sm text-muted font-medium opacity-60">{teachers.length} სტაფი · {activeCount} {t.active.toLowerCase()}</p>
                    </div>
                    <button onClick={openAdd}
                        className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 active:scale-[0.97] transition-all text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl shadow-violet-600/20 whitespace-nowrap">
                        <UserPlus className="w-4 h-4" />
                        <span>{t.addTeacher}</span>
                    </button>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { label: 'სულ მასწ.', value: String(teachers.length), icon: Users, cls: 'text-violet-600 bg-violet-500/10 border-violet-500/20' },
                        { label: 'ინდ. სეს.', value: String(individualCount), icon: User, cls: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20' },
                        { label: 'ჯგუფები', value: String(MOCK_GROUPS.length), icon: BookOpen, cls: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
                    ].map(s => (
                        <div key={s.label} className="bg-card border border-border-subtle rounded-3xl p-5 flex items-center gap-4 shadow-sm group hover:shadow-xl hover:shadow-black/5 transition-all">
                            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform ${s.cls}`}>
                                <s.icon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-xl font-black text-primary tabular-nums leading-none tracking-tight">{s.value}</p>
                                <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-1 opacity-40">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Search */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-violet-500 transition-colors pointer-events-none" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="სახელი, სპეციალობა..."
                        className="w-full bg-card border border-border-subtle rounded-2xl pl-11 pr-5 py-3 text-sm text-primary placeholder:text-muted/30 focus:outline-none focus:border-violet-500/60 transition-all shadow-sm" />
                </div>

                {/* Teacher cards */}
                <div className="grid gap-4 stagger">
                    {filtered.map(teacher => (
                        <div key={teacher.id}
                            className="group bg-card border border-border-subtle hover:border-violet-500/30 hover:shadow-xl hover:shadow-violet-500/5 rounded-[2rem] p-6 transition-all duration-300">
                            <div className="flex items-start gap-5">
                                {/* Avatar */}
                                <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-lg font-black text-white flex-shrink-0 shadow-lg shadow-violet-500/20 group-hover:scale-110 transition-transform overflow-hidden">
                                    {teacher.photo_url ? (
                                        <img src={teacher.photo_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        getInitials(teacher.full_name)
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0 pt-0.5">
                                    <div className="flex flex-wrap items-center gap-2.5 mb-2">
                                        <p className="text-base font-black text-primary group-hover:text-violet-600 transition-colors uppercase tracking-tight">{teacher.full_name}</p>
                                        <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider', STATUS_STYLE[teacher.status])}>
                                            {STATUS_LABEL[teacher.status]}
                                        </span>
                                    </div>

                                    {/* Specialties */}
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {teacher.specialty.map(s => (
                                            <span key={s} className="px-3 py-1 bg-violet-600/5 border border-violet-500/10 text-violet-600 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors group-hover:bg-violet-600/10">
                                                <Star className="w-3 h-3" />{s}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Contacts & rates */}
                                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] font-bold text-muted opacity-50 px-1">
                                        <span className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 opacity-40" />{teacher.phone}</span>
                                        {teacher.email && <span className="flex items-center gap-2 hidden md:flex"><Mail className="w-3.5 h-3.5 opacity-40" />{teacher.email}</span>}
                                        <div className="flex gap-4">
                                            {teacher.rate_per_hour && <span className="text-emerald-600 font-black tracking-tight">{teacher.rate_per_hour}₾ / სთ</span>}
                                            {teacher.rate_per_month && <span className="text-emerald-600 font-black tracking-tight">{teacher.rate_per_month}₾ / თვე</span>}
                                            {teacher.salary_percentage && <span className="text-rose-500 font-black tracking-tight">{teacher.salary_percentage}% (წილი)</span>}
                                        </div>
                                    </div>

                                    {/* Assigned groups */}
                                    {teacher.assigned_group_ids.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border-subtle/50">
                                            {teacher.assigned_group_ids.map(gid => (
                                                <span key={gid} className="px-3 py-1.5 bg-surface border border-border-subtle text-muted text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <BookOpen className="w-3.5 h-3.5 text-violet-500" />{GROUP_MAP[gid] ?? gid}
                                                </span>
                                            ))}
                                            {teacher.assigned_individual && (
                                                <span className="px-3 py-1.5 bg-indigo-500/5 border border-indigo-500/10 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2">
                                                    <Zap className="w-3.5 h-3.5" />ინდ. სესია
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col items-end gap-3 pt-1">
                                    <button onClick={() => openEdit(teacher)}
                                        className="w-10 h-10 flex items-center justify-center rounded-2xl bg-surface border border-border-subtle text-muted hover:text-violet-600 hover:border-violet-500/40 hover:shadow-lg transition-all active:scale-95 group-hover:translate-x-0">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <ChevronRight className="w-6 h-6 text-muted opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
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
                            <p className="text-xs font-medium mt-1">სცადეთ სხვა საძიებო სიტყვა</p>
                        </div>
                    )}
                </div>

                {/* Cross-page quick nav */}
                <div className="bg-surface/50 border border-border-subtle rounded-3xl p-6 mt-6">
                    <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-4 opacity-40">{t.linkedPages}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                            { href: '/calendar', label: t.calendar, icon: CalendarDays, color: '#6366f1', desc: 'აკადემიური გრაფიკი' },
                            { href: '/groups', label: t.groups, icon: BookOpen, color: '#f59e0b', desc: 'აქტიური ჯგუფები' },
                            { href: '/attendance', label: t.attendance, icon: BarChart2, color: '#10b981', desc: 'დასწრების ანალიტიკა' },
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
                groups={MOCK_GROUPS}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                onDelete={handleDelete}
            />
        </>
    );
}
