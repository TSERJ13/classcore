'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { X, DoorOpen, Users, Palette, Check, Trash2, AlertTriangle, Camera, Layout } from 'lucide-react';
import MainPortal from '@/components/ui/MainPortal';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';
import { useUser } from '@/hooks/useUser';
import type { Hall } from '@/types';

interface HallModalProps {
    open: boolean;
    hall: Hall | null;
    onClose: () => void;
    onSave: (data: Partial<Hall>) => void;
    onDelete?: (id: string) => void;
}

// Colors removed in favor of native picker

const EMPTY: Partial<Hall> = {
    name: '', capacity: undefined, color: '#6366f1', description: '', is_active: true,
    photo_url: '', sq_meters: undefined,
};

export function HallModal({ open, hall, onClose, onSave, onDelete }: HallModalProps) {
    const { t } = useT();
    const { user, profile } = useUser();
    const [form, setForm] = useState<Partial<Hall>>({ ...EMPTY });
    const [showDelete, setShowDelete] = useState(false);
    const isEdit = !!hall;
    const isTeacher = profile?.role === 'teacher';

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
        <MainPortal>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className={cn(
                "fixed z-[9999] flex flex-col bg-card transition-all duration-300 overflow-hidden",
                "inset-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[500px] sm:max-h-none top-0 bottom-0 !top-0",
                "animate-in fade-in duration-300 sm:slide-in-from-right",
                "rounded-none sm:rounded-none overflow-x-hidden max-w-full"
            )}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle flex-shrink-0 bg-white/90 backdrop-blur-md sticky top-0 z-10 transition-all duration-300">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: (form.color ?? '#6366f1') + '22', border: `1px solid ${form.color ?? '#6366f1'}44` }}>
                            <DoorOpen className="w-5 h-5 transition-all" style={{ color: form.color ?? '#6366f1' }} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-primary leading-tight">
                                {isEdit ? t.editHall : t.newHall}
                            </h2>
                            <p className="text-xs text-muted mt-0.5 font-medium opacity-70 tracking-tight">
                                {isEdit ? (t as any)[hall!.name!] || hall!.name : t.hallDescription || 'Manage studio space'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-primary transition-all active:scale-95">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                    {/* Body */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-5 sm:space-y-6 overscroll-contain pb-32">
                        <div className="flex items-center gap-4 mb-2">
                            <button
                                onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = (e: Event) => {
                                        const target = e.target as HTMLInputElement;
                                        const file = target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (ev) => setF('photo_url', ev.target?.result as string);
                                            reader.readAsDataURL(file);
                                        }
                                    };
                                    input.click();
                                }}
                                className="relative w-20 h-20 rounded-2xl bg-indigo-500/5 border-2 border-dashed border-indigo-500/20 hover:border-indigo-500/50 flex items-center justify-center flex-shrink-0 overflow-hidden group transition-all"
                            >
                                {form.photo_url ? (
                                    <>
                                        <img src={form.photo_url} alt="" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Camera className="w-5 h-5 text-white" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-1 text-indigo-500/40 group-hover:text-indigo-500 transition-colors">
                                        <Camera className="w-5 h-5" />
                                        <span className="text-[10px] font-black">{t.hallPhoto}</span>
                                    </div>
                                )}
                            </button>
                            <div className="min-w-0">
                                <p className="text-sm font-black text-primary truncate">{(t as any)[form.name!] || form.name || t.hallName}</p>
                                <p className="text-[10px] text-muted font-medium opacity-60 tracking-wider">{t.uploadHallPhoto}</p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1 uppercase">{t.hallName} *</label>
                            <input value={form.name ?? ''} onChange={e => setF('name', e.target.value)}
                                placeholder={t.hallNamePlaceholder}
                                className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-2xl px-4 py-3 text-[12px] sm:text-sm text-primary placeholder:text-muted/30 outline-none transition-all shadow-sm" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted tracking-widest px-1 flex items-center gap-1.5 h-4 uppercase">
                                    <Users className="w-3 h-3" /> {t.capacity}
                                </label>
                                 <input type="number" min="1" value={form.capacity ?? ''}
                                    onChange={e => setF('capacity', e.target.value ? Number(e.target.value) : undefined)}
                                    placeholder="30"
                                    className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-2xl px-4 py-3 text-[12px] sm:text-sm text-primary placeholder:text-muted/30 outline-none transition-all" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted tracking-widest px-1 flex items-center gap-1.5 h-4 uppercase">
                                    <Layout className="w-3 h-3" /> {t.sqMeters || 'Sq. Meters'}
                                </label>
                                 <input type="number" min="1" value={form.sq_meters ?? ''}
                                    onChange={e => setF('sq_meters', e.target.value ? Number(e.target.value) : undefined)}
                                    placeholder="150"
                                    className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-2xl px-4 py-3 text-[12px] sm:text-sm text-primary placeholder:text-muted/30 outline-none transition-all shadow-sm" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1 uppercase">{t.hallStatus}</label>
                            <button onClick={() => setF('is_active', !form.is_active)}
                                className={cn('w-full py-2.5 px-4 rounded-2xl text-[10px] font-black tracking-widest border transition-all uppercase',
                                    form.is_active ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600' : 'bg-surface border-border-subtle text-muted opacity-60')}>
                                {form.is_active ? `✓ ${t.activeStatus}` : `✕ ${t.closedStatus}`}
                            </button>
                        </div>

                        <div>
                            <label className="text-[10px] text-muted mb-2 block tracking-wider font-bold opacity-70 flex items-center gap-2">
                                <Palette className="w-3 h-3" /> {t.hallColor}
                            </label>
                            <label className="flex items-center gap-3 bg-surface border border-border-subtle rounded-xl p-2 cursor-pointer hover:border-indigo-500/40 transition-colors">
                                <span className="w-8 h-8 rounded-lg border border-black/10 flex-shrink-0 overflow-hidden relative">
                                    <input type="color" value={form.color || '#6366f1'} onChange={e => setF('color', e.target.value)}
                                        className="absolute -inset-2 w-12 h-12 cursor-pointer opacity-0" />
                                    <div className="w-full h-full pointer-events-none" style={{ backgroundColor: form.color || '#6366f1' }} />
                                </span>
                                <span className="text-xs text-muted font-medium select-none truncate">{t.chooseAnotherColor}</span>
                            </label>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1 uppercase">{t.notes}</label>
                            <textarea value={form.description ?? ''} onChange={e => setF('description', e.target.value)}
                                rows={2} placeholder={t.commentPlaceholder}
                                className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-2xl px-4 py-3 text-[13px] sm:text-sm text-primary placeholder:text-muted/30 outline-none resize-none transition-all" />
                        </div>
                    </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-border-subtle bg-white/90 backdrop-blur-md sticky bottom-0 z-10 pb-10 sm:pb-8 flex-shrink-0">
                    {isEdit && !showDelete && !isTeacher && (
                        <button onClick={() => setShowDelete(true)}
                            className="w-full mb-4 py-2 text-red-500/60 hover:text-red-500 text-[10px] sm:text-xs font-bold border border-red-500/10 hover:border-red-500/30 rounded-xl transition-all flex items-center justify-center gap-2">
                            <Trash2 className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{t.deleteHall}</span>
                        </button>
                    )}
                    {showDelete && (
                        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2 duration-300">
                            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-[10px] sm:text-xs font-black text-red-600">{t.deleteQuestion}</p>
                            </div>
                            <button onClick={() => { onDelete?.(hall!.id); onClose(); }} className="px-3 py-1 sm:px-4 sm:py-1.5 bg-red-500 text-white text-[10px] sm:text-[11px] font-bold rounded-lg hover:bg-red-600 active:scale-95 transition-all">{t.delete}</button>
                            <button onClick={() => setShowDelete(false)} className="text-[10px] sm:text-[11px] font-bold text-muted hover:text-primary transition-colors">{t.cancel}</button>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button onClick={onClose}
                            className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-[11px] sm:text-xs uppercase tracking-widest transition-all text-center">
                            {t.cancel}
                        </button>
                        <button onClick={save} disabled={!form.name?.trim()}
                            className="flex-1 py-3 bg-[#6d28d9] hover:bg-[#5b21b6] disabled:opacity-40 text-white rounded-xl font-black text-[11px] sm:text-xs active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                        >
                            <Check className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" /> <span className="truncate">{isEdit ? t.save : t.add}</span>
                        </button>
                    </div>
                </div>
            </div>
        </MainPortal>
    );
}
