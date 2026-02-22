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
    { value: 'active', label: '✓ აქტიური', cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' },
    { value: 'on_leave', label: '⏸ შვებულება', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-300' },
    { value: 'inactive', label: '✕ არააქტიური', cls: 'bg-white/[0.05] border-white/[0.1] text-white/40' },
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
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col bg-[#13131a] border-l border-white/[0.08] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08] flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                            <User className="w-4 h-4 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">{isEdit ? 'მასწავლებლის ჩასწორება' : 'ახალი მასწავლებელი'}</h2>
                            <p className="text-xs text-white/35 mt-0.5">{isEdit ? teacher!.full_name : 'სტაფის წევრი'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/[0.07] text-white/40"><X className="w-5 h-5" /></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                    {/* Basic info */}
                    <section className="space-y-3">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">ძირითადი ინფო</p>

                        <div>
                            <label className="text-xs text-white/40 mb-1.5 flex items-center gap-1.5 block"><User className="w-3 h-3" /> სახელი *</label>
                            <input value={form.full_name ?? ''} onChange={e => setF('full_name', e.target.value)}
                                placeholder="მაგ: ნინო ბერიძე"
                                className="w-full bg-[#1c1c26] border border-white/[0.08] focus:border-violet-500/60 rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder:text-white/25 outline-none" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-white/40 mb-1.5 flex items-center gap-1.5 block"><Phone className="w-3 h-3" /> ტელეფონი *</label>
                                <input value={form.phone ?? ''} onChange={e => setF('phone', e.target.value)}
                                    placeholder="577 XX XX XX"
                                    className="w-full bg-[#1c1c26] border border-white/[0.08] focus:border-violet-500/60 rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder:text-white/25 outline-none" />
                            </div>
                            <div>
                                <label className="text-xs text-white/40 mb-1.5 flex items-center gap-1.5 block"><Mail className="w-3 h-3" /> ელ.ფოსტა</label>
                                <input value={form.email ?? ''} onChange={e => setF('email', e.target.value)}
                                    placeholder="email@gmail.com"
                                    className="w-full bg-[#1c1c26] border border-white/[0.08] focus:border-violet-500/60 rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder:text-white/25 outline-none" />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-white/40 mb-1.5 block">მოკლე ბიო</label>
                            <textarea value={form.bio ?? ''} onChange={e => setF('bio', e.target.value)}
                                rows={2} placeholder="მოკლე აღწერა..."
                                className="w-full bg-[#1c1c26] border border-white/[0.08] focus:border-violet-500/60 rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder:text-white/25 outline-none resize-none" />
                        </div>
                    </section>

                    {/* Specialty */}
                    <section className="space-y-3">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2"><Briefcase className="w-3 h-3" /> სპეციალობა</p>
                        <div className="flex flex-wrap gap-2">
                            {SPECIALTIES.map(s => (
                                <button key={s} onClick={() => toggleSpecialty(s)}
                                    className={cn('px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                                        form.specialty?.includes(s)
                                            ? 'bg-violet-500/15 border-violet-500/35 text-violet-300'
                                            : 'bg-[#1c1c26] border-white/[0.08] text-white/50 hover:text-white/75')}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Assigned groups */}
                    <section className="space-y-3">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2"><Users className="w-3 h-3" /> ჯგუფები</p>
                        {groups.length > 0 ? (
                            <div className="space-y-2">
                                {groups.map(g => {
                                    const assigned = form.assigned_group_ids?.includes(g.id);
                                    return (
                                        <label key={g.id}
                                            className={cn('flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                                                assigned ? 'bg-violet-500/10 border-violet-500/25' : 'bg-[#1c1c26] border-white/[0.07] hover:border-white/[0.14]')}>
                                            <input type="checkbox" checked={assigned ?? false} onChange={() => toggleGroup(g.id)} className="sr-only" />
                                            <div className={cn('w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all',
                                                assigned ? 'bg-violet-500 border-violet-500' : 'border-white/[0.2]')}>
                                                {assigned && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <div className="flex-1 flex items-center gap-2">
                                                <BookOpen className="w-3.5 h-3.5 text-white/30" />
                                                <span className="text-sm text-white/75">{g.name}</span>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-xs text-white/25 italic">ჯგუფები ჯერ არ არის შექმნილი</p>
                        )}

                        {/* Individual sessions toggle */}
                        <label className={cn('flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                            form.assigned_individual ? 'bg-indigo-500/10 border-indigo-500/25' : 'bg-[#1c1c26] border-white/[0.07]')}>
                            <input type="checkbox" checked={form.assigned_individual ?? false}
                                onChange={() => setF('assigned_individual', !form.assigned_individual)} className="sr-only" />
                            <div className={cn('w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0',
                                form.assigned_individual ? 'bg-indigo-500 border-indigo-500' : 'border-white/[0.2]')}>
                                {form.assigned_individual && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div>
                                <p className="text-sm text-white/75">ღებულობს ინდ. გაკვეთილებს</p>
                                <p className="text-[10px] text-white/35">ინდივიდუალური სეანსის ბოქსი</p>
                            </div>
                        </label>
                    </section>

                    {/* Rates */}
                    <section className="space-y-3">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2"><DollarSign className="w-3 h-3" /> ანაზღაურება (₾)</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-white/40 mb-1.5 block">საათ/გაკვ. განაკვეთი</label>
                                <input type="number" min="0" value={form.rate_per_hour ?? ''}
                                    onChange={e => setF('rate_per_hour', e.target.value ? Number(e.target.value) : undefined)}
                                    placeholder="50"
                                    className="w-full bg-[#1c1c26] border border-white/[0.08] focus:border-violet-500/60 rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder:text-white/25 outline-none" />
                            </div>
                            <div>
                                <label className="text-xs text-white/40 mb-1.5 block">ყოველთვიური ფიქსი</label>
                                <input type="number" min="0" value={form.rate_per_month ?? ''}
                                    onChange={e => setF('rate_per_month', e.target.value ? Number(e.target.value) : undefined)}
                                    placeholder="800"
                                    className="w-full bg-[#1c1c26] border border-white/[0.08] focus:border-violet-500/60 rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder:text-white/25 outline-none" />
                            </div>
                        </div>
                    </section>

                    {/* Status */}
                    <section className="space-y-3">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">სტატუსი</p>
                        <div className="grid grid-cols-3 gap-2">
                            {STATUSES.map(s => (
                                <button key={s.value} onClick={() => setF('status', s.value)}
                                    className={cn('py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all',
                                        form.status === s.value ? s.cls : 'bg-[#1c1c26] border-white/[0.08] text-white/45 hover:text-white/70')}>
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 border-t border-white/[0.08] px-6 py-4">
                    {isEdit && !showDelete && (
                        <button onClick={() => setShowDelete(true)}
                            className="w-full mb-3 py-2.5 text-red-400/70 hover:text-red-400 text-xs font-medium border border-red-500/15 hover:border-red-500/35 rounded-xl transition-all flex items-center justify-center gap-2">
                            <Trash2 className="w-3.5 h-3.5" /> მასწავლებლის წაშლა
                        </button>
                    )}
                    {showDelete && (
                        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                            <p className="text-xs text-red-300 flex-1">ნამდვილად წაშლა?</p>
                            <button onClick={() => { onDelete?.(teacher!.id); onClose(); }}
                                className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors">წაშლა</button>
                            <button onClick={() => setShowDelete(false)} className="text-xs text-white/40 hover:text-white/70 transition-colors">გაუქმება</button>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button onClick={onClose}
                            className="flex-1 py-3 border border-white/[0.10] text-white/60 text-sm font-medium rounded-xl hover:border-white/[0.2] transition-colors">
                            გაუქმება
                        </button>
                        <button onClick={save} disabled={!form.full_name?.trim() || !form.phone?.trim()}
                            className="flex-1 py-3 bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20">
                            <Check className="w-4 h-4" /> შენახვა
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
