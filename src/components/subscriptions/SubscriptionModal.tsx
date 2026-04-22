'use client';

import { useState, useEffect } from 'react';
import { X, CreditCard, Calendar, Save, Trash2, Pause, Check } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useUser } from '@/hooks/useUser';
import { useStudio } from '@/contexts/StudioContext';
import { type SubscriptionInfo, pauseActiveSubscription } from '@/lib/subscription-store';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { StandardDatePicker } from '@/components/ui/StandardDatePicker';
import { cn } from '@/lib/utils';
import MainPortal from '@/components/ui/MainPortal';

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
        <MainPortal>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className={cn(
                "fixed z-[9999] flex flex-col bg-card shadow-2xl transition-all duration-300 overflow-hidden",
                "inset-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[500px] sm:max-h-none top-0 bottom-0 !top-0",
                "animate-in fade-in duration-300 sm:slide-in-from-right",
                "rounded-none sm:rounded-none overflow-x-hidden max-w-full"
            )}>
                {/* Mobile Drag Handle */}
                <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing">
                    <div className="w-10 h-1.5 rounded-full bg-border-subtle opacity-60" />
                </div>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle flex-shrink-0 bg-white/90 backdrop-blur-md sticky top-0 z-10 transition-all duration-300">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-inner">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-primary leading-tight">
                                {t.editSubscription}
                            </h2>
                            <p className="text-xs text-muted mt-0.5 font-medium opacity-70 tracking-tight">
                                ID: {form.id}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-primary transition-all active:scale-95">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-5 sm:space-y-6 overscroll-contain pb-32">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <StandardDatePicker
                            label={t.purchaseDate}
                            value={form.purchased_at}
                            onChange={(v) => setForm({ ...form, purchased_at: v })}
                        />
                        <StandardDatePicker
                            label={t.expiryDate}
                            value={form.expires_at}
                            onChange={(v) => setForm({ ...form, expires_at: v })}
                        />
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
                <div className="px-5 py-4 border-t border-border-subtle bg-white/90 backdrop-blur-md flex-shrink-0 sticky bottom-0 z-10 pb-10 sm:pb-8">
                    <div className="flex gap-3">
                        {onDelete && !isTeacher && (
                            <button
                                onClick={async () => {
                                    if (await confirm(t.deleteSubConfirm)) {
                                        onDelete(form.student_id, form.id);
                                        onClose();
                                    }
                                }}
                                className="px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-all font-bold text-[11px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate">{t.delete}</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-[11px] sm:text-xs uppercase tracking-widest transition-all text-center"
                        >
                            {t.cancel}
                        </button>
                        <button
                            onClick={() => onSave(form)}
                            className="flex-1 py-3 bg-[#6d28d9] hover:bg-[#5b21b6] text-white rounded-xl font-black text-[11px] sm:text-xs active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                        >
                            <Check className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                            <span className="truncate">{t.save}</span>
                        </button>
                    </div>
                </div>
            </div>
        </MainPortal>
    );
}
