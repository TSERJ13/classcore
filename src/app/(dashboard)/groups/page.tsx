'use client';

import Link from 'next/link';
import { BookOpen, Clock, Users, ChevronRight, Plus, GraduationCap, CalendarDays } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';

const MOCK_GROUPS = [
    { id: '1', name: 'Contemporary Dance', coach: 'ნინო ქობახიძე', teacherId: 't1', schedule: 'ორ, ოთხ · 18:00–19:30', capacity: 15, enrolled: 12, type: 'Dance', difficulty: null },
    { id: '2', name: 'Ballet', coach: 'თამარ ბაქრაძე', teacherId: 't2', schedule: 'სამ, პარ · 17:00–18:30', capacity: 10, enrolled: 8, type: 'Dance', difficulty: null },
    { id: '3', name: 'Yoga Beginners', coach: 'ელენე ჯგარკავა', teacherId: 't3', schedule: 'ორ, ოთხ, პარ · 8:00–9:00', capacity: 20, enrolled: 14, type: 'Yoga', difficulty: 'beginner' },
    { id: '4', name: 'Sports Group A', coach: 'ვახო ქობახიძე', teacherId: 't2', schedule: 'ყოველდღე · 10:00–12:00', capacity: 25, enrolled: 20, type: 'Sports', difficulty: null },
    { id: '5', name: 'Fitness Pro', coach: 'ლალი ბარბაქაძე', teacherId: 't1', schedule: 'ორ, ხუთ · 19:00–20:30', capacity: 18, enrolled: 7, type: 'Fitness', difficulty: 'advanced' },
];

const typeColor: Record<string, string> = {
    Dance: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    Sports: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    Yoga: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    Fitness: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

export default function GroupsPage() {
    const { t } = useT();

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-up pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary tracking-tight">{t.groups}</h1>
                    <p className="text-sm text-muted font-medium opacity-60">{MOCK_GROUPS.length} {t.groups.toLowerCase()}</p>
                </div>
                <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl shadow-indigo-600/20 touch-manipulation">
                    <Plus className="w-4 h-4" />
                    <span>{t.groups} +</span>
                </button>
            </div>

            <div className="grid gap-4 stagger">
                {MOCK_GROUPS.map(group => {
                    const fillPct = Math.round((group.enrolled / group.capacity) * 100);
                    return (
                        <div key={group.id} className="group bg-card border border-border-subtle hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/5 rounded-3xl p-5 transition-all duration-300">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2.5 mb-2">
                                        <h3 className="text-base font-black text-primary truncate group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{group.name}</h3>
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${typeColor[group.type]}`}>{group.type}</span>
                                        {group.difficulty && (
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-surface text-muted/60 border border-border-subtle uppercase tracking-wider">{group.difficulty}</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted font-bold mb-3 opacity-70 flex items-center gap-1.5">
                                        <GraduationCap className="w-3.5 h-3.5 opacity-40" />
                                        {group.coach}
                                    </p>
                                    <div className="flex flex-wrap gap-4 text-[11px] font-black text-muted opacity-50">
                                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{group.schedule}</span>
                                        <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{group.enrolled} / {group.capacity} (ტევადობა)</span>
                                    </div>

                                    {/* Cross-links */}
                                    <div className="flex gap-2.5 mt-4">
                                        <Link href="/teachers"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-indigo-600 text-[10px] font-black uppercase tracking-wider hover:bg-indigo-500/10 transition-all touch-manipulation">
                                            {t.teachers}
                                        </Link>
                                        <Link href="/calendar"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-indigo-600 text-[10px] font-black uppercase tracking-wider hover:bg-indigo-500/10 transition-all touch-manipulation">
                                            {t.calendar}
                                        </Link>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-3 pt-1">
                                    <div className="text-xs font-black text-indigo-600 tabular-nums bg-indigo-500/5 px-2 py-1 rounded-lg border border-indigo-500/10">{fillPct}%</div>
                                    <ChevronRight className="w-5 h-5 text-muted opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </div>
                            </div>
                            <div className="mt-5 w-full bg-surface rounded-full h-2 overflow-hidden shadow-inner">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(99,102,241,0.2)] ${fillPct > 85 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${fillPct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Cross-page quick nav */}
            <div className="bg-surface/50 border border-border-subtle rounded-3xl p-6 mt-4">
                <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-4 opacity-40">{t.linkedPages}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                        { href: '/teachers', label: t.teachers, icon: GraduationCap, color: '#6366f1', desc: 'აკადემიური პერსონალი' },
                        { href: '/calendar', label: t.calendar, icon: CalendarDays, color: '#8b5cf6', desc: 'სრული განრიგი' },
                        { href: '/attendance', label: t.attendance, icon: BookOpen, color: '#10b981', desc: 'დასწრების აღრიცხვა' },
                    ].map(l => (
                        <Link key={l.href} href={l.href}
                            className="flex items-center gap-3.5 p-4 rounded-2xl bg-card border border-border-subtle hover:border-indigo-500/30 hover:shadow-lg hover:shadow-black/5 transition-all touch-manipulation group">
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
    );
}
