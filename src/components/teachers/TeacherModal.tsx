'use client';

import { useState, useEffect } from 'react';
import { X, User, Phone, Mail, Briefcase, DollarSign, BookOpen, Check, Trash2, AlertTriangle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Teacher, TeacherStatus } from '@/types';

interface Group { id: string; name: string; }

interface TeacherModalProps {
    open: boolean;
    teacher: Teacher | null;
    groups: Group[];
    onClose: () => void;
    onSave: (data: Partial<Teacher>) => void;
    onDelete?: (id: string) => void;
}

const SPECIALTIES = ['Contemporary', 'Ballet', 'Hip-Hop', 'Salsa', 'Bachata', 'Tango', 'Jazz', 'Modern', 'Yoga', 'Pilates', 'Fitness', 'სხვა'];

const STATUSES: { value: TeacherStatus; label: string; cls: string }[] = [
    { value: 'active', label: '✓ აქტიური', cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' },
    { value: 'on_leave', label: '⏸ შვებულება', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-600' },
    { value: 'inactive', label: '✕ არააქტიური', cls: 'bg-surface border-border-subtle text-muted opacity-60' },
];

const EMPTY: Partial<Teacher> = {
    full_name: '', phone: '', email: '', specialty: [],
    bio: '', rate_per_hour: undefined, rate_per_month: undefined,
    assigned_group_ids: [], assigned_individual: false, status: 'active',
};

export function TeacherModal({ open, teacher, groups, onClose, onSave, onDelete }: TeacherModalProps) {
    const [form, setForm] = useState<Partial<Teacher>>({ ...EMPTY });
    const [showDelete, setShowDelete] = useState(false);
    const isEdit = !!teacher;

    useEffect(() => {
        if (open) {
            setForm(teacher ? { ...teacher } : { ...EMPTY });
            setShowDelete(false);
        }
    }, [open, teacher]);

    function setF(k: keyof Teacher, v: unknown) {
        setForm(p => ({ ...p, [k]: v }));
    }

    function toggleSpecialty(s: string) {
        const arr = form.specialty ?? [];
        setF('specialty', arr.includes(s) ? arr.filter(x => x !== s) : [...arr, s]);
    }

    function toggleGroup(id: string) {
        const arr = form.assigned_group_ids ?? [];
        setF('assigned_group_ids', arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
    }

    function save() {
        if (!form.full_name?.trim() || !form.phone?.trim()) return;
        onSave(form);
        onClose();
    }

    if (!open) return null;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />

            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col bg-card border-l border-border-subtle shadow-2xl animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center shadow-inner">
                            <User className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-primary">{isEdit ? 'მასწავლებლის ჩასწორება' : 'ახალი მასწავლებელი'}</h2>
                            <p className="text-xs text-muted mt-0.5 font-medium opacity-70">{isEdit ? teacher!.full_name : 'სტაფის წევრი'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-primary transition-all active:scale-95"><X className="w-5 h-5" /></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-thin scrollbar-thumb-border-subtle">

                    {/* Basic info */}
                    <section className="space-y-4">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40">ძირითადი ინფო</p>

                        <div>
                            <label className="text-xs text-muted mb-1.5 flex items-center gap-2 block font-medium"><User className="w-3.5 h-3.5 opacity-50" /> სახელი *</label>
                            <input value={form.full_name ?? ''} onChange={e => setF('full_name', e.target.value)}
                                placeholder="მაგ: ნინო ბერიძე"
                                className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/30 outline-none transition-all" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-muted mb-1.5 flex items-center gap-2 block font-medium"><Phone className="w-3.5 h-3.5 opacity-50" /> ტელეფონი *</label>
                                <input value={form.phone ?? ''} onChange={e => setF('phone', e.target.value)}
                                    placeholder="577 XX XX XX"
                                    className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/30 outline-none transition-all" />
                            </div>
                            <div>
                                <label className="text-xs text-muted mb-1.5 flex items-center gap-2 block font-medium"><Mail className="w-3.5 h-3.5 opacity-50" /> ელ.ფოსტა</label>
                                <input value={form.email ?? ''} onChange={e => setF('email', e.target.value)}
                                    placeholder="email@gmail.com"
                                    className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/30 outline-none transition-all" />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-muted mb-1.5 block font-medium">მოკლე ბიო</label>
                            <textarea value={form.bio ?? ''} onChange={e => setF('bio', e.target.value)}
                                rows={2} placeholder="მოკლე აღწერა..."
                                className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/30 outline-none resize-none transition-all" />
                        </div>
                    </section>

                    {/* Specialty */}
                    <section className="space-y-4">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 flex items-center gap-2"><Briefcase className="w-3 h-3" /> სპეციალობა</p>
                        <div className="flex flex-wrap gap-2">
                            {SPECIALTIES.map(s => (
                                <button key={s} onClick={() => toggleSpecialty(s)}
                                    className={cn('px-3 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm',
                                        form.specialty?.includes(s)
                                            ? 'bg-indigo-500/10 border-indigo-500/35 text-indigo-600 scale-105'
                                            : 'bg-surface border-border-subtle text-muted hover:text-primary hover:border-border-subtle/60')}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Assigned groups */}
                    <section className="space-y-4">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 flex items-center gap-2"><Users className="w-3 h-3" /> ჯგუფები</p>
                        {groups.length > 0 ? (
                            <div className="space-y-2">
                                {groups.map(g => {
                                    const assigned = form.assigned_group_ids?.includes(g.id);
                                    return (
                                        <label key={g.id}
                                            className={cn('flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all shadow-sm',
                                                assigned ? 'bg-indigo-500/5 border-indigo-500/40 translate-x-1' : 'bg-surface/50 border-border-subtle hover:border-border-subtle/60')}>
                                            <input type="checkbox" checked={assigned ?? false} onChange={() => toggleGroup(g.id)} className="sr-only" />
                                            <div className={cn('w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all',
                                                assigned ? 'bg-indigo-500 border-indigo-500 shadow-md' : 'border-border-subtle bg-card')}>
                                                {assigned && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                                            </div>
                                            <div className="flex-1 flex items-center gap-3">
                                                <BookOpen className="w-4 h-4 text-muted opacity-40" />
                                                <span className={cn('text-sm font-bold', assigned ? 'text-primary' : 'text-muted')}>{g.name}</span>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-xs text-muted italic opacity-50 px-2">ჯგუფები ჯერ არ არის შექმნილი</p>
                        )}

                        {/* Individual sessions toggle */}
                        <label className={cn('flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all shadow-sm',
                            form.assigned_individual ? 'bg-indigo-500/5 border-indigo-500/40 translate-x-1' : 'bg-surface/50 border-border-subtle')}>
                            <input type="checkbox" checked={form.assigned_individual ?? false}
                                onChange={() => setF('assigned_individual', !form.assigned_individual)} className="sr-only" />
                            <div className={cn('w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all',
                                form.assigned_individual ? 'bg-indigo-500 border-indigo-500 shadow-md' : 'border-border-subtle bg-card')}>
                                {form.assigned_individual && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                            </div>
                            <div>
                                <p className={cn('text-sm font-bold', form.assigned_individual ? 'text-primary' : 'text-muted')}>ინდ. გაკვეთილები</p>
                                <p className="text-[10px] text-muted opacity-50 font-medium">ღებულობს ინდივიდუალურ სეანსებს</p>
                            </div>
                        </label>
                    </section>

                    {/* Rates */}
                    <section className="space-y-4">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 flex items-center gap-2"><DollarSign className="w-3 h-3" /> ანაზღაურება (₾)</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-muted mb-1.5 block font-medium">საათ/გაკვ. განაკვეთი</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted opacity-40 text-xs">₾</span>
                                    <input type="number" min="0" value={form.rate_per_hour ?? ''}
                                        onChange={e => setF('rate_per_hour', e.target.value ? Number(e.target.value) : undefined)}
                                        placeholder="50"
                                        className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl pl-7 pr-3 py-2.5 text-sm text-primary font-black placeholder:text-muted/30 outline-none transition-all" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-muted mb-1.5 block font-medium">ყოველთვიური ფიქსი</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted opacity-40 text-xs">₾</span>
                                    <input type="number" min="0" value={form.rate_per_month ?? ''}
                                        onChange={e => setF('rate_per_month', e.target.value ? Number(e.target.value) : undefined)}
                                        placeholder="800"
                                        className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl pl-7 pr-3 py-2.5 text-sm text-primary font-black placeholder:text-muted/30 outline-none transition-all" />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Status */}
                    <section className="space-y-4 pb-4">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40">სტატუსი</p>
                        <div className="grid grid-cols-3 gap-2">
                            {STATUSES.map(s => (
                                <button key={s.value} onClick={() => setF('status', s.value)}
                                    className={cn('py-3 px-2 rounded-xl text-xs font-bold border transition-all shadow-sm',
                                        form.status === s.value ? s.cls : 'bg-surface border-border-subtle text-muted hover:text-primary')}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 border-t border-border-subtle px-6 py-5 bg-card/50 backdrop-blur-md">
                    {isEdit && !showDelete && (
                        <button onClick={() => setShowDelete(true)}
                            className="w-full mb-4 py-2.5 text-red-500/60 hover:text-red-500 text-xs font-bold border border-red-500/10 hover:border-red-500/30 rounded-xl transition-all flex items-center justify-center gap-2">
                            <Trash2 className="w-4 h-4" /> მასწავლებლის წაშლა
                        </button>
                    )}
                    {showDelete && (
                        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2 duration-300">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs font-black text-red-600">წავშალოთ?</p>
                                <p className="text-[10px] text-red-600/60 font-medium">ეს ქმედება საბოლოოა</p>
                            </div>
                            <button onClick={() => { onDelete?.(teacher!.id); onClose(); }}
                                className="px-4 py-1.5 bg-red-500 text-white text-[11px] font-bold rounded-lg hover:bg-red-600 active:scale-95 transition-all">წაშლა</button>
                            <button onClick={() => setShowDelete(false)} className="text-[11px] font-bold text-muted hover:text-primary transition-colors">გაუქ.</button>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button onClick={onClose}
                            className="flex-1 py-3 border border-border-subtle hover:bg-surface text-muted hover:text-primary text-sm font-bold rounded-xl transition-all shadow-sm">
                            გაუქმება
                        </button>
                        <button onClick={save} disabled={!form.full_name?.trim() || !form.phone?.trim()}
                            className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 active:scale-95">
                            <Check className="w-5 h-5" /> შენახვა
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
