'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DoorOpen, Users, Edit2, Calendar, ArrowRight, Plus, Trash2, Layout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HallModal } from '@/components/halls/HallModal';
import { useT } from '@/contexts/LanguageContext';
import type { Hall } from '@/types';
import { getHalls, saveHalls } from '@/lib/hall-store';
import { getGroups } from '@/lib/group-store';
import { useMemo } from 'react';


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

    const groups = getGroups();
    const hallStats = useMemo(() => {
        const stats: Record<string, number> = {};
        groups.forEach(g => {
            if (g.hall_id && g.schedule) {
                const slots = Array.isArray(g.schedule) ? g.schedule.length : 0;
                stats[g.hall_id] = (stats[g.hall_id] || 0) + slots;
            }
        });
        return stats;
    }, [groups]);

    const totalCapacity = halls.filter(h => h.is_active).reduce((s, h) => s + (h.capacity ?? 0), 0);
    const totalWeekEvents = Object.values(hallStats).reduce((a, b) => a + b, 0);

    return (
        <>
            <div className="space-y-8 animate-fade-up max-w-6xl mx-auto pb-10">
            {/* ── Top Header Row: Metrics & Add Action ── */}
            <div className="flex flex-row items-center justify-between gap-3 sm:gap-4 lg:gap-8">
                {/* Quick stats */}
                <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-6 overflow-x-auto no-scrollbar flex-1 sm:flex-none py-1">
                    {[
                        { label: t.halls, value: halls.length, icon: DoorOpen, colorCls: 'text-violet-600', bgCls: 'bg-violet-500/5' },
                        { label: t.capacity, value: totalCapacity, icon: Users, colorCls: 'text-indigo-600', bgCls: 'bg-indigo-500/5' },
                        { 
                            label: t.lessonsPerWeek, 
                            mobileLabel: 'კვირაში',
                            value: totalWeekEvents, 
                            icon: Calendar, 
                            colorCls: 'text-emerald-600', 
                            bgCls: 'bg-emerald-500/5' 
                        },
                    ].map(s => (
                        <div key={s.label} className={`flex flex-col justify-center px-4 sm:px-6 lg:px-10 h-12 lg:h-20 rounded-full border border-border-subtle/50 min-w-fit shadow-sm group hover:shadow-xl hover:shadow-black/5 transition-all text-center sm:text-left ${s.bgCls}`}>
                            <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
                                <s.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-6 lg:h-6 ${s.colorCls} opacity-60`} />
                                <span className="text-[13px] sm:text-[16px] lg:text-2xl font-black text-primary leading-none tabular-nums">{s.value}</span>
                            </div>
                            <p className="text-[7px] sm:text-[8px] lg:text-[10px] text-muted font-black tracking-widest mt-1 lg:mt-2 opacity-40 uppercase">
                                {(s as any).mobileLabel ? (
                                    <>
                                        <span className="hidden sm:inline">{s.label}</span>
                                        <span className="sm:hidden">{(s as any).mobileLabel}</span>
                                    </>
                                ) : s.label}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Add Hall Action */}
                <button onClick={openAdd}
                    className="flex-shrink-0 flex items-center justify-center gap-2 w-12 h-12 sm:w-auto px-0 sm:px-5 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white text-[11px] font-black tracking-widest rounded-[1.25rem] shadow-lg shadow-violet-600/20 transition-all touch-manipulation">
                    <div className="relative flex items-center">
                        <DoorOpen className="w-5 h-5 sm:w-4 sm:h-4" />
                        <Plus className="absolute -top-1 -right-2.5 w-3 h-3 text-white" />
                    </div>
                    <span className="hidden sm:inline">{t.addHall}</span>
                </button>
            </div>

                {/* Hall cards - Enlarged to 2 columns but with reduced height */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6 stagger">
                    {halls.map(hall => (
                        <div key={hall.id}
                            className="group bg-card border border-border-subtle hover:border-violet-500/40 hover:shadow-xl hover:shadow-violet-500/5 rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 transition-all duration-300 relative overflow-hidden flex flex-col gap-4">
                            
                            <div className="flex items-start gap-4 sm:gap-5">
                                {/* Avatar/Icon */}
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[1.2rem] sm:rounded-[1.5rem] bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-lg font-black text-white flex-shrink-0 shadow-lg shadow-violet-500/20 group-hover:scale-110 transition-transform overflow-hidden relative border-2 border-white/10">
                                    {hall.photo_url ? (
                                        <img src={hall.photo_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <DoorOpen className="w-6 h-6 sm:w-7 sm:h-7 text-white/40" />
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: hall.color }} />
                                </div>
 
                                {/* Base Info */}
                                <div className="flex-1 min-w-0 pt-0.5">
                                    <p className="text-base sm:text-lg font-black text-primary group-hover:text-violet-600 transition-colors tracking-tight truncate">{(t as any)[hall.name] || hall.name}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider',
                                            hall.is_active ? 'badge-active' : 'bg-surface text-muted border border-border-subtle')}>
                                            {hall.is_active ? t.active : t.closedShort}
                                        </span>
                                    </div>
                                </div>
                                {/* Actions - always visible at opacity-60, prominent on hover */}
                                <div className="absolute top-4 right-4 sm:top-5 sm:right-5 flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                                    <button onClick={(e) => { e.stopPropagation(); openEdit(hall); }}
                                        className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-surface border border-border-subtle text-muted hover:text-violet-600 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all shadow-sm">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Detailed Stats */}
                            <div className="grid grid-cols-2 gap-3 py-3 sm:py-4 border-y border-border-subtle/50">
                                <div className="flex flex-col gap-1 text-center">
                                    <div className="flex items-center justify-center gap-2 text-muted/40 font-black tracking-widest text-[8px] uppercase">
                                        <Layout className="w-3 h-3" />
                                        {t.sqMetersShort || 'SQ.M'}
                                    </div>
                                    <p className="text-sm sm:text-base font-black text-primary">{hall.sq_meters || '—'}</p>
                                </div>
                                <div className="flex flex-col gap-1 text-center">
                                    <div className="flex items-center justify-center gap-2 text-muted/40 font-black tracking-widest text-[8px] uppercase">
                                        <Users className="w-3 h-3" />
                                        {t.spotsShort}
                                    </div>
                                    <p className="text-sm sm:text-base font-black text-primary">{hall.capacity || '—'}</p>
                                </div>
                            </div>

                        </div>
                    ))}
                </div>

                {halls.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center text-muted/30">
                        <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
                            <DoorOpen className="w-10 h-10 opacity-20" />
                        </div>
                        <p className="text-base font-bold">{t.noData}</p>
                        <p className="text-xs font-medium mt-1">{t.tryAnotherSearch || 'დაამატეთ ახალი დარბაზი'}</p>
                    </div>
                )}

                {/* Cross-page quick nav */}
                <div className="bg-card border border-border-subtle rounded-[2.5rem] px-3 py-8 sm:p-8 mt-20 shadow-sm">
                    <p className="text-[10px] font-black text-muted tracking-[0.3em] mb-6 opacity-40 text-center">{t.linkedPages}</p>
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                        {[
                            { href: '/calendar', label: t.calendar, icon: Calendar, color: '#6366f1', desc: t.academicSchedule },
                            { href: '/groups', label: t.groups, icon: Users, color: '#f59e0b', desc: t.groupSchedule },
                            { href: '/analytics', label: t.analytics, icon: ArrowRight, color: '#10b981', desc: t.revenueStatus },
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

            <HallModal open={modalOpen} hall={editing} onClose={() => setModalOpen(false)} onSave={handleSave} onDelete={handleDelete} />
        </>
    );
}
