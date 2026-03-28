'use client';

import { useState, useEffect } from 'react';
import { X, CreditCard, Calendar, Save, Trash2, Pause } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useUser } from '@/hooks/useUser';
import { useStudio } from '@/contexts/StudioContext';
import { type SubscriptionInfo, pauseActiveSubscription } from '@/lib/subscription-store';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { cn } from '@/lib/utils';

interface SubscriptionModalProps {
    open: boolean;
    subscription: SubscriptionInfo | null;
    onClose: () => void;
    onSave: (data: SubscriptionInfo) => void;
    onDelete?: (studentId: string, subId: string) => void;
    centered?: boolean;
}

export function SubscriptionModal({ open, subscription, onClose, onSave, onDelete, centered = false }: SubscriptionModalProps) {
    const { t } = useT();
    const { user, profile } = useUser();
    const confirm = useConfirm();
    const { settings } = useStudio();
    const [form, setForm] = useState<SubscriptionInfo | null>(null);
    const isTeacher = profile?.role === 'teacher';

    useEffect(() => {
        if (open && subscription) {
            setForm({ ...subscription });
        } else {
            setForm(null);
        }
    }, [open, subscription]);

    if (!open || !form) return null;

    const isSessionBased = form.type === 'sessions';

    return (
        <>
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className={cn(
                "fixed z-[101] flex flex-col bg-card border-border-subtle shadow-2xl overflow-hidden transition-all duration-300",
                centered
                    ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] sm:w-[min(100vw,512px)] max-h-[92dvh] border rounded-[2.5rem] animate-in fade-in zoom-in-95"
                    : "inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-[min(100vw,420px)] max-h-[92dvh] sm:max-h-none sm:border-l border-t sm:border-t-0 animate-in slide-in-from-bottom sm:slide-in-from-right rounded-t-[2.5rem] sm:rounded-none"
            )}>
                {/* Handle for mobile */}
                <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing">
                    <div className="w-10 h-1.5 rounded-full bg-border-subtle opacity-60" />
                </div>
                {/* Header */}
                <div className="p-6 border-b border-border-subtle bg-surface/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-primary tracking-tight">{t.editSubscription}</h2>
                            <p className="text-[10px] font-bold text-muted opacity-40">ID: {form.id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface text-muted transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    {/* Plan Name */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted tracking-widest px-1">{t.studentName}</label>
                        <input
                            type="text"
                            value={form.plan}
                            onChange={(e) => setForm({ ...form, plan: e.target.value })}
                            className="w-full bg-surface border border-border-subtle rounded-2xl px-4 py-3 text-sm font-bold text-primary outline-none focus:border-indigo-500/40 transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Status */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted tracking-widest px-1">{t.studentStatus}</label>
                            <SearchSelect
                                options={[
                                    { value: 'active', label: t.active },
                                    { value: 'paused', label: t.paused },
                                    { value: 'expired', label: t.expired }
                                ]}
                                value={form.status}
                                onChange={(val: string) => setForm({ ...form, status: val as 'active' | 'paused' | 'expired' })}
                                className="!border-border-subtle hover:!border-indigo-500/40"
                            />
                        </div>

                        {/* Type */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted tracking-widest px-1">{t.subscriptionType}</label>
                            <SearchSelect
                                options={[
                                    { value: 'sessions', label: t.typeSessions },
                                    { value: 'monthly', label: t.monthly }
                                ]}
                                value={form.type}
                                onChange={(val: string) => setForm({
                                    ...form,
                                    type: val as 'sessions' | 'monthly',
                                    sessions_total: val === 'monthly' ? null : (form.sessions_total || 12)
                                })}
                                className="!border-border-subtle hover:!border-indigo-500/40"
                            />
                        </div>
                    </div>

                    {isSessionBased && (
                        <div className="grid grid-cols-2 gap-4">
                            {/* Sessions Used */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted tracking-widest px-1">{t.used}</label>
                                <input
                                    type="number"
                                    value={form.sessions_used}
                                    onChange={(e) => setForm({ ...form, sessions_used: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-surface border border-border-subtle rounded-2xl px-4 py-3 text-sm font-bold text-primary outline-none focus:border-indigo-500/40 transition-all"
                                />
                            </div>
                            {/* Sessions Total */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted tracking-widest px-1">{t.total}</label>
                                <input
                                    type="number"
                                    value={form.sessions_total || ''}
                                    onChange={(e) => setForm({ ...form, sessions_total: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-surface border border-border-subtle rounded-2xl px-4 py-3 text-sm font-bold text-primary outline-none focus:border-indigo-500/40 transition-all"
                                    placeholder="∞"
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        {/* Purchased At */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted tracking-widest px-1">{t.purchaseDate}</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/30" />
                                <input
                                    type="date"
                                    value={form.purchased_at}
                                    onChange={(e) => setForm({ ...form, purchased_at: e.target.value })}
                                    className="w-full bg-surface border border-border-subtle rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-primary outline-none focus:border-indigo-500/40 transition-all"
                                />
                            </div>
                        </div>
                        {/* Expires At */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted tracking-widest px-1">{t.expiryDate}</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/30" />
                                <input
                                    type="date"
                                    value={form.expires_at}
                                    onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                                    className="w-full bg-surface border border-border-subtle rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-primary outline-none focus:border-indigo-500/40 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Teacher Comment */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted tracking-widest px-1">{t.comment}</label>
                        <textarea
                            value={form.teacher_comment || ''}
                            onChange={(e) => setForm({ ...form, teacher_comment: e.target.value })}
                            className="w-full bg-surface border border-border-subtle rounded-2xl px-4 py-3 text-sm font-bold text-primary outline-none focus:border-indigo-500/40 transition-all min-h-[80px] resize-none"
                            placeholder={t.commentPlaceholder}
                        />
                    </div>

                    {/* Pause Subscription Section */}
                    {form.status === 'active' && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-4">
                            <h3 className="text-xs font-black text-amber-600 flex items-center gap-2">
                                <Pause className="w-4 h-4" /> აბონემენტის დაპაუზება
                            </h3>
                            <div className="flex gap-2">
                                {(['7', '14', '30', '60'] as const).map(daysStr => {
                                    const days = parseInt(daysStr) as 7 | 14 | 30 | 60;
                                    const cost = settings.pausePrices?.[daysStr] || 0;

                                    return (
                                        <button
                                            key={daysStr}
                                            onClick={async () => {
                                                const msg = cost > 0
                                                    ? `ანგარიშიდან ჩამოიჭრება ${cost} ${settings.currency}. გსურთ ${days} დღით შეჩერება?`
                                                    : `გსურთ აბონემენტის ${days} დღით შეჩერება უფასოდ?`;
                                                if (await confirm(msg)) {
                                                    pauseActiveSubscription(form.student_id, form.id, days);
                                                    onClose(); // Close modal, letting the parent refresh
                                                    // Trigger global refresh so subscriptions list updates
                                                    window.dispatchEvent(new Event('cc_student_update'));
                                                }
                                            }}
                                            className="flex-1 py-2 flex flex-col items-center justify-center bg-white/50 hover:bg-white text-xs font-bold text-amber-700 rounded-xl transition-all border border-amber-500/10 active:scale-95"
                                        >
                                            <span>{days} {t.days || 'დღე'}</span>
                                            {cost > 0 && <span className="text-[9px] font-black opacity-60 mt-0.5">{cost} {settings.currency}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-surface/50 border-t border-border-subtle flex items-center justify-between gap-3">
                    {onDelete && !isTeacher && (
                        <button
                            onClick={async () => {
                                if (await confirm(t.deleteSubConfirm)) {
                                    onDelete(form.student_id, form.id);
                                    onClose();
                                }
                            }}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-red-500/5 text-red-500 hover:bg-red-500/10 transition-all font-bold text-xs"
                        >
                            <Trash2 className="w-4 h-4" />
                            {t.delete}
                        </button>
                    )}
                    <div className="flex items-center gap-3 ml-auto">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 rounded-2xl text-xs font-bold text-muted hover:text-primary transition-all"
                        >
                            {t.cancel}
                        </button>
                        <button
                            onClick={() => onSave(form)}
                            className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 transition-all active:scale-[0.98] font-bold text-xs"
                        >
                            <Save className="w-4 h-4" />
                            {t.save}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
