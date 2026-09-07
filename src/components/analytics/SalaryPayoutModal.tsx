'use client';

import React, { useState, useEffect } from 'react';
import { X, Banknote, CheckCircle2, Clock, RotateCcw, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { getTeacherSalaryPayment, updateTeacherSalaryPayment } from '@/lib/salary-status-store';

interface SalaryPayoutModalProps {
    open: boolean;
    onClose: () => void;
    teacher: {
        id: string;
        teacher: string;
        total: number;
        type?: string;
        rate?: string;
    } | null;
    selectedMonth: string; // YYYY-MM
    currency: string;
    lang?: string;
}

export function SalaryPayoutModal({
    open,
    onClose,
    teacher,
    selectedMonth,
    currency,
    lang = 'ka'
}: SalaryPayoutModalProps) {
    const [amount, setAmount] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    useEffect(() => {
        if (open && teacher) {
            const payment = getTeacherSalaryPayment(teacher.id, selectedMonth, teacher.total);
            // If already paid something, initialize input to that paid amount or remaining
            if (payment.paidAmount > 0) {
                setAmount(String(payment.paidAmount));
            } else {
                setAmount(String(teacher.total));
            }
            setNotes(payment.notes || '');
        }
    }, [open, teacher, selectedMonth]);

    if (!open || !teacher) return null;

    const payment = getTeacherSalaryPayment(teacher.id, selectedMonth, teacher.total);
    const total = teacher.total;
    const currentPaid = payment.paidAmount;
    const currentRemaining = Math.max(0, total - currentPaid);

    const numAmount = Math.max(0, Number(amount) || 0);
    const simulatedRemaining = Math.max(0, total - numAmount);

    const handleSave = () => {
        setIsSaving(true);
        try {
            updateTeacherSalaryPayment(teacher.id, selectedMonth, numAmount, total, notes);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setIsSaving(true);
        try {
            updateTeacherSalaryPayment(teacher.id, selectedMonth, 0, total, '');
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div 
                className="w-full max-w-md bg-surface border border-border-subtle rounded-3xl shadow-2xl overflow-hidden animate-scale-up"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle bg-surface/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shadow-sm">
                            <Banknote className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-primary tracking-tight">
                                {l('ხელფასის გაცემა', 'Выплата зарплаты', 'Salary Payout')}
                            </h3>
                            <p className="text-xs font-medium text-muted/60 tracking-tight">
                                {teacher.teacher} • <span className="text-primary font-bold">{selectedMonth}</span>
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-surface border border-border-subtle/60 flex items-center justify-center text-muted hover:text-primary transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* 3 Stats Overview Cards */}
                    <div className="grid grid-cols-3 gap-2.5">
                        <div className="p-3 rounded-2xl bg-surface-elevated/40 border border-border-subtle/60 text-center">
                            <p className="text-[10px] font-black text-muted tracking-wider uppercase opacity-40 mb-0.5">
                                {l('დარიცხული', 'Начислено', 'Accrued')}
                            </p>
                            <p className="text-sm font-black text-primary tabular-nums">
                                {formatCurrency(total, currency)}
                            </p>
                        </div>
                        <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                            <p className="text-[10px] font-black text-emerald-600/60 tracking-wider uppercase mb-0.5 flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                {l('გაცემული', 'Выдано', 'Paid')}
                            </p>
                            <p className="text-sm font-black text-emerald-600 tabular-nums">
                                {formatCurrency(currentPaid, currency)}
                            </p>
                        </div>
                        <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-center">
                            <p className="text-[10px] font-black text-amber-600/60 tracking-wider uppercase mb-0.5 flex items-center justify-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {l('დარჩენილი', 'Остаток', 'Remaining')}
                            </p>
                            <p className="text-sm font-black text-amber-600 tabular-nums">
                                {formatCurrency(currentRemaining, currency)}
                            </p>
                        </div>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-primary tracking-tight">
                                {l('გასაცემი თანხა', 'Сумма выплаты', 'Payout Amount')}
                            </label>
                            {numAmount >= total && total > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    {l('სრულად გაცემა', 'Полная выплата', 'Full Payout')}
                                </span>
                            )}
                            {numAmount > 0 && numAmount < total && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                    <Clock className="w-2.5 h-2.5" />
                                    {l('ნაწილობრივი გაცემა', 'Частичная выплата', 'Partial Payout')}
                                </span>
                            )}
                            {numAmount === 0 && (
                                <span className="text-[10px] font-black text-muted/40 tracking-wider uppercase">
                                    {l('გაუცემელი (0₾)', 'Не выдано (0₾)', 'Unpaid (0₾)')}
                                </span>
                            )}
                        </div>

                        <div className="relative">
                            <input 
                                type="number"
                                min="0"
                                max={total * 2}
                                step="any"
                                autoFocus
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0"
                                className="w-full bg-surface border-2 border-border-subtle focus:border-emerald-500 rounded-2xl px-4 py-3 text-lg font-black text-primary outline-none transition-all tabular-nums"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-muted/50 pointer-events-none">
                                {currency === 'GEL' ? '₾' : currency}
                            </div>
                        </div>

                        {/* Quick Action Presets */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            <button
                                type="button"
                                onClick={() => setAmount(String(total))}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-surface hover:bg-emerald-500/10 hover:text-emerald-600 border border-border-subtle hover:border-emerald-500/30 text-muted transition-colors"
                            >
                                {l('სრულად', 'Полностью', 'Full')} ({formatCurrency(total, currency)})
                            </button>
                            {currentRemaining > 0 && currentRemaining !== total && (
                                <button
                                    type="button"
                                    onClick={() => setAmount(String(currentRemaining))}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-surface hover:bg-amber-500/10 hover:text-amber-600 border border-border-subtle hover:border-amber-500/30 text-muted transition-colors"
                                >
                                    {l('დარჩენილი', 'Остаток', 'Remaining')} ({formatCurrency(currentRemaining, currency)})
                                </button>
                            )}
                            {total > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setAmount(String(Math.round(total / 2)))}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-surface hover:bg-violet-500/10 hover:text-violet-600 border border-border-subtle hover:border-violet-500/30 text-muted transition-colors"
                                >
                                    50% ({formatCurrency(Math.round(total / 2), currency)})
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setAmount('0')}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-surface hover:bg-rose-500/10 hover:text-rose-600 border border-border-subtle hover:border-rose-500/30 text-muted transition-colors ml-auto"
                            >
                                0 ₾
                            </button>
                        </div>
                    </div>

                    {/* Notes (optional) */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-muted/60 tracking-tight">
                            {l('შენიშვნა (არასავალდებულო)', 'Примечание (необязательно)', 'Note (optional)')}
                        </label>
                        <input 
                            type="text"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder={l('მაგ. ავანსი, გადარიცხვა თიბისიდან, ნაღდი...', 'Напр. аванс, перевод, наличные...', 'e.g. advance, bank transfer, cash...')}
                            className="w-full bg-surface border border-border-subtle focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-primary font-medium outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-border-subtle bg-surface/50 gap-3">
                    {currentPaid > 0 ? (
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 text-xs font-black transition-colors"
                            title={l('გადახდის გაუქმება და 0-ზე დაბრუნება', 'Сбросить выплату на 0', 'Reset payout to 0')}
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {l('გაუქმება (0₾)', 'Сброс (0₾)', 'Reset (0₾)')}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl text-xs font-black text-muted hover:text-primary transition-colors"
                        >
                            {l('დახურვა', 'Закрыть', 'Cancel')}
                        </button>
                    )}

                    <div className="flex items-center gap-2">
                        {currentPaid > 0 && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-3 py-2.5 rounded-xl text-xs font-black text-muted hover:text-primary transition-colors"
                            >
                                {l('დახურვა', 'Закрыть', 'Cancel')}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            {isSaving ? l('ინახება...', 'Сохранение...', 'Saving...') : l('შენახვა', 'Сохранить', 'Save Payout')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
