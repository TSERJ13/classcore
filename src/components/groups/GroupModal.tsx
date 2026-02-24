'use client';

import { useState, useEffect } from 'react';
import { X, BookOpen, User, Clock, Users, Check, Trash2, AlertTriangle, GraduationCap } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface GroupModalProps {
    open: boolean;
    group?: any;
    onClose: () => void;
    onSave: (data: any) => void;
    onDelete?: (id: string) => void;
}

export function GroupModal({ open, group, onClose, onSave, onDelete }: GroupModalProps) {
    const { t } = useT();
    const isEdit = !!group;
    const [form, setForm] = useState({
        id: '',
        name: '',
        coach: '',
        schedule: '',
        capacity: 15,
        type: 'Dance',
        difficulty: '',
    });
    const [saving, setSaving] = useState(false);
    const [showDelete, setShowDelete] = useState(false);

    useEffect(() => {
        if (open && group) {
            setForm({
                id: group.id ?? '',
                name: group.name ?? '',
                coach: group.coach ?? '',
                schedule: group.schedule ?? '',
                capacity: group.capacity ?? 15,
                type: group.type ?? 'Dance',
                difficulty: group.difficulty ?? '',
            });
            setShowDelete(false);
        } else if (open) {
            setForm({ id: '', name: '', coach: '', schedule: '', capacity: 15, type: 'Dance', difficulty: '' });
            setShowDelete(false);
        }
    }, [group, open]);

    if (!open) return null;

    const save = async () => {
        setSaving(true);
        await new Promise(r => setTimeout(r, 400));
        onSave(form);
        setSaving(false);
        onClose();
    };

    const inputCls = "w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/30 outline-none transition-all shadow-sm";

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border-subtle shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle flex-shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-primary">{isEdit ? 'ჯგუფის რედაქტირება' : 'ახალი ჯგუფი'}</h2>
                        <p className="text-xs text-muted mt-0.5">{isEdit ? group.name : 'დაამატეთ ახალი სასწავლო ჯგუფი'}</p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-primary transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 px-1 flex items-center gap-2">
                                <BookOpen className="w-3 h-3" /> დასახელება
                            </label>
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="მაგ: Contemporary Dance" className={inputCls} />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 px-1 flex items-center gap-2">
                                <GraduationCap className="w-3 h-3" /> მასწავლებელი
                            </label>
                            <input value={form.coach} onChange={e => setForm({ ...form, coach: e.target.value })} placeholder="სახელი გვარი" className={inputCls} />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 px-1 flex items-center gap-2">
                                <Clock className="w-3 h-3" /> განრიგი
                            </label>
                            <input value={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.value })} placeholder="მაგ: ორ, ოთხ · 18:00–19:30" className={inputCls} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 px-1 flex items-center gap-2">
                                    <Users className="w-3 h-3" /> ტევადობა
                                </label>
                                <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) })} className={inputCls} />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 px-1 flex items-center gap-2">
                                    <BookOpen className="w-3 h-3" /> ტიპი
                                </label>
                                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inputCls}>
                                    <option value="Dance">Dance</option>
                                    <option value="Yoga">Yoga</option>
                                    <option value="Fitness">Fitness</option>
                                    <option value="Sports">Sports</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 px-1 flex items-center gap-2">
                                    სირთულე
                                </label>
                                <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })} className={inputCls}>
                                    <option value="">Default</option>
                                    <option value="beginner">Beginner</option>
                                    <option value="intermediate">Intermediate</option>
                                    <option value="advanced">Advanced</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 px-1 flex items-center gap-2">
                                    ფერი
                                </label>
                                <div className="flex gap-2 p-1 bg-surface border border-border-subtle rounded-xl overflow-x-auto no-scrollbar">
                                    {['indigo', 'emerald', 'rose', 'amber', 'blue'].map(c => (
                                        <button key={c} onClick={() => setForm({ ...form, type: c.charAt(0).toUpperCase() + c.slice(1) })}
                                            className={cn('w-6 h-6 rounded-lg flex-shrink-0 transition-all border-2',
                                                form.type.toLowerCase() === c ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-60')}
                                            style={{ background: `var(--${c}-500, ${c})` }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-border-subtle space-y-3 flex-shrink-0 bg-card/80 backdrop-blur-md">
                    {isEdit && !showDelete && (
                        <button onClick={() => setShowDelete(true)} className="w-full py-2.5 text-red-500/60 hover:text-red-500 text-xs font-bold border border-red-500/10 hover:border-red-500/30 rounded-xl transition-all flex items-center justify-center gap-2">
                            <Trash2 className="w-4 h-4" /> {t.delete || 'ჯგუფის წაშლა'}
                        </button>
                    )}
                    {showDelete && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2 duration-300">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs font-black text-red-600">წავშალოთ?</p>
                            </div>
                            <button onClick={() => { onDelete?.(group.id); onClose(); }} className="px-4 py-1.5 bg-red-500 text-white text-[11px] font-bold rounded-lg hover:bg-red-600 active:scale-95 transition-all">წაშლა</button>
                            <button onClick={() => setShowDelete(false)} className="text-[11px] font-bold text-muted hover:text-primary transition-colors">გაუქ.</button>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 border border-border-subtle hover:bg-surface text-muted text-sm font-bold rounded-xl transition-all">გაუქმება</button>
                        <button onClick={save} disabled={!form.name || saving} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-black rounded-xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-5 h-5" />}
                            შენახვა
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
