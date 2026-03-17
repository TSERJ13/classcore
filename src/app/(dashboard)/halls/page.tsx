'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, DoorOpen, Users, Edit2, Calendar, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HallModal } from '@/components/halls/HallModal';
import { useT } from '@/contexts/LanguageContext';
import type { Hall } from '@/types';
import { getHalls, saveHalls } from '@/lib/hall-store';

const HALL_WEEK_EVENTS: Record<string, number> = { h1: 12, h2: 8, h3: 4, h4: 0 };

export default function HallsPage() {
    const { t } = useT();
    const [halls, setHalls] = useState<Hall[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Hall | null>(null);

    useEffect(() => {
        const stored = getHalls();
        setHalls(stored as unknown as Hall[]);
    }, []);

    function openAdd() { setEditing(null); setModalOpen(true); }
    function openEdit(h: Hall) { setEditing(h); setModalOpen(true); }

    function handleSave(data: Partial<Hall>) {
        let updated: Hall[];
        if (editing) {
            updated = halls.map(h => h.id === editing.id ? { ...h, ...data } : h);
        } else {
            updated = [...halls, {
                id: String(Date.now()), org_id: 'demo', created_at: new Date().toISOString(),
                name: '', color: '#6366f1', is_active: true, ...data,
            }];
        }
        setHalls(updated);
        saveHalls(updated as any);
    }

    function handleDelete(id: string) {
        const updated = halls.filter(h => h.id !== id);
        setHalls(updated);
        saveHalls(updated as any);
    }

    const activeHalls = halls.filter(h => h.is_active).length;
    const totalCapacity = halls.filter(h => h.is_active).reduce((s, h) => s + (h.capacity ?? 0), 0);
    const totalWeekEvents = Object.values(HALL_WEEK_EVENTS).reduce((a, b) => a + b, 0);

    return (
        <>
            <div className="space-y-8 animate-fade-up max-w-4xl mx-auto pb-10">
                {/* Header */}
                <div className="flex items-center justify-end mb-2">
                    <button onClick={openAdd}
                        className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl shadow-violet-500/20 transition-all active:scale-[0.97]">
                        <Plus className="w-4 h-4" /> {t.addHall}
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    {[
                        { label: t.halls, value: String(halls.length), icon: DoorOpen, cls: 'text-violet-600 bg-violet-500/10 border-violet-500/20' },
                        { label: t.capacity, value: String(totalCapacity), icon: Users, cls: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20' },
                        { label: t.lessonsPerWeek, value: String(totalWeekEvents), icon: Calendar, cls: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
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

                {/* Hall cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {halls.map(hall => (
                        <div key={hall.id}
                            className="group bg-card border border-border-subtle hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/5 rounded-3xl p-5 transition-all duration-300 flex items-center gap-5">
                            <div className="w-20 h-20 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/10 transition-colors overflow-hidden relative">
                                {hall.photo_url ? (
                                    <img src={hall.photo_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                ) : (
                                    <DoorOpen className="w-8 h-8 text-indigo-500/40 group-hover:scale-110 transition-all duration-500" />
                                )}
                                <div className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: hall.color }} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-sm font-bold text-primary/90">{(t as any)[hall.name] || hall.name}</p>
                                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold',
                                        hall.is_active ? 'badge-active' : 'bg-surface text-muted border border-border-subtle')}>
                                        {hall.is_active ? t.active : t.closedShort}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-x-3 text-[11px] text-muted">
                                    {hall.capacity && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{hall.capacity} {t.spotsShort}</span>}
                                    {hall.description && <span className="hidden sm:block truncate max-w-48">{hall.description}</span>}
                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{HALL_WEEK_EVENTS[hall.id] ?? 0} {t.lessonsPerWeek}</span>
                                </div>
                                {/* Quick links */}
                                <div className="flex gap-2 mt-2">
                                    <Link href="/calendar"
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400/70 text-[10px] hover:bg-indigo-500/20 transition-colors">
                                        <Calendar className="w-2.5 h-2.5" />{t.calendar}
                                    </Link>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hall.color }} />
                                <button onClick={() => openEdit(hall)}
                                    className="w-8 h-8 flex items-center justify-center rounded-xl text-muted hover:text-primary hover:bg-surface transition-all opacity-0 group-hover:opacity-100">
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Cross-page quick nav */}
                <div className="bg-card border border-border-subtle rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">{t.linkedPages}</p>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { href: '/calendar', label: t.calendar, icon: Calendar, desc: t.academicSchedule, color: '#6366f1' },
                            { href: '/groups', label: t.groups, icon: Users, desc: t.groupSchedule, color: '#f59e0b' },
                            { href: '/analytics', label: t.analytics, icon: ArrowRight, desc: t.revenueStatus, color: '#8b5cf6' },
                        ].map(l => (
                            <Link key={l.href} href={l.href}
                                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border-subtle hover:border-border-subtle/20 hover:bg-surface transition-all">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: l.color + '18', border: `1px solid ${l.color}33` }}>
                                    <l.icon className="w-3.5 h-3.5" style={{ color: l.color }} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-primary/70 truncate">{l.label}</p>
                                    <p className="text-[10px] text-muted">{l.desc}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            <HallModal open={modalOpen} hall={editing} onClose={() => setModalOpen(false)} onSave={handleSave} onDelete={handleDelete} />
        </>
    );
}
