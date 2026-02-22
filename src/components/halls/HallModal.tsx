'use client';

import { useState, useEffect } from 'react';
import { X, DoorOpen, Users, Palette, Check, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Hall } from '@/types';

interface HallModalProps {
    open: boolean;
    hall: Hall | null;
    onClose: () => void;
    onSave: (data: Partial<Hall>) => void;
    onDelete?: (id: string) => void;
}

const COLORS = [
    { hex: '#6366f1', label: 'ინდიგო' },
    { hex: '#8b5cf6', label: 'იასამანი' },
    { hex: '#ec4899', label: 'ვარდისფ.' },
    { hex: '#f59e0b', label: 'ყვითელი' },
    { hex: '#10b981', label: 'მწვანე' },
    { hex: '#3b82f6', label: 'ლურჯი' },
    { hex: '#ef4444', label: 'წითელი' },
    { hex: '#14b8a6', label: 'ტეალი' },
    { hex: '#f97316', label: 'ნარინჯი' },
];

const EMPTY: Partial<Hall> = {
    name: '', capacity: undefined, color: '#6366f1', description: '', is_active: true,
};

export function HallModal({ open, hall, onClose, onSave, onDelete }: HallModalProps) {
    const [form, setForm] = useState<Partial<Hall>>({ ...EMPTY });
    const [showDelete, setShowDelete] = useState(false);
    const isEdit = !!hall;

    useEffect(() => {
        if (open) { setForm(hall ? { ...hall } : { ...EMPTY }); setShowDelete(false); }
    }, [open, hall]);

    function setF(k: keyof Hall, v: unknown) { setForm(p => ({ ...p, [k]: v })); }

    function save() {
        if (!form.name?.trim()) return;
        onSave(form);
        onClose();
    }

    if (!open) return null;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-full max-w-sm bg-card border border-border-subtle rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: (form.color ?? '#6366f1') + '22', border: `1px solid ${form.color ?? '#6366f1'}44` }}>
                                <DoorOpen className="w-4 h-4" style={{ color: form.color ?? '#6366f1' }} />
                            </div>
                            <h2 className="text-sm font-bold text-primary">{isEdit ? 'დარბაზის ჩასწ.' : 'ახალი დარბაზი'}</h2>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface text-muted transition-colors"><X className="w-4 h-4" /></button>
                    </div>

                    {/* Body */}
                    <div className="px-5 py-5 space-y-4">
                        <div>
                            <label className="text-xs text-muted mb-1.5 block font-medium">სახელი *</label>
                            <input value={form.name ?? ''} onChange={e => setF('name', e.target.value)}
                                placeholder="მაგ: დარბაზი A"
                                className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/30 outline-none transition-all" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted mb-1.5 flex items-center gap-1.5 block font-medium"><Users className="w-3 h-3" /> ტევადობა</label>
                                <input type="number" min="1" value={form.capacity ?? ''}
                                    onChange={e => setF('capacity', e.target.value ? Number(e.target.value) : undefined)}
                                    placeholder="30"
                                    className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/30 outline-none transition-all" />
                            </div>
                            <div>
                                <label className="text-xs text-muted mb-1.5 block font-medium">სტატუსი</label>
                                <button onClick={() => setF('is_active', !form.is_active)}
                                    className={cn('w-full py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all',
                                        form.is_active ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600' : 'bg-surface border-border-subtle text-muted opacity-60')}>
                                    {form.is_active ? '✓ აქტიური' : '✕ დახურული'}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-muted mb-2 flex items-center gap-1.5 block font-medium"><Palette className="w-3 h-3" /> ფერი</label>
                            <div className="flex flex-wrap gap-2">
                                {COLORS.map(c => (
                                    <button key={c.hex} onClick={() => setF('color', c.hex)} title={c.label}
                                        className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center shadow-sm"
                                        style={{
                                            backgroundColor: c.hex,
                                            borderColor: form.color === c.hex ? 'var(--text-primary)' : 'transparent',
                                            transform: form.color === c.hex ? 'scale(1.15)' : 'scale(1)',
                                        }}>
                                        {form.color === c.hex && <Check className="w-3.5 h-3.5 text-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-muted mb-1.5 block font-medium">აღწერა</label>
                            <textarea value={form.description ?? ''} onChange={e => setF('description', e.target.value)}
                                rows={2} placeholder="ოთახის შესახებ..."
                                className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/30 outline-none resize-none transition-all" />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-5 pb-5 space-y-2">
                        {isEdit && !showDelete && (
                            <button onClick={() => setShowDelete(true)}
                                className="w-full py-2 text-red-500/60 hover:text-red-500 text-xs font-semibold border border-red-500/10 hover:border-red-500/30 rounded-xl transition-all flex items-center justify-center gap-2">
                                <Trash2 className="w-3 h-3" /> დარბაზის წაშლა
                            </button>
                        )}
                        {showDelete && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-200">
                                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                <p className="text-[11px] text-red-600 font-medium flex-1">წავშალოთ?</p>
                                <button onClick={() => { onDelete?.(hall!.id); onClose(); }} className="text-xs font-bold text-red-600 active:scale-95">წაშლა</button>
                                <button onClick={() => setShowDelete(false)} className="text-xs text-muted">გაუქ.</button>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button onClick={onClose}
                                className="flex-1 py-2.5 border border-border-subtle hover:bg-surface text-muted hover:text-primary text-sm font-semibold rounded-xl transition-all">
                                გაუქმება
                            </button>
                            <button onClick={save} disabled={!form.name?.trim()}
                                className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                                <Check className="w-4 h-4" /> შენახვა
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
