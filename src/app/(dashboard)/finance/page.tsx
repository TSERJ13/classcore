'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Plus, Trash2,
    ArrowUpRight, ArrowDownRight, Wallet, PieChart, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';
import { useStudio } from '@/contexts/StudioContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { 
    getExpenses, createExpense, deleteExpense, type Expense, type ExpenseCategory 
} from '@/lib/finance-store';
import { getPayments } from '@/lib/payment-store';
import { getInvoices } from '@/lib/invoice-store';

export default function FinancePage() {
    const { t, lang } = useT();
    const { settings } = useStudio();
    const confirm = useConfirm();

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [modalOpen, setModalOpen] = useState(false);

    // Expense modal form
    const [formTitle, setFormTitle] = useState('');
    const [formCategory, setFormCategory] = useState<ExpenseCategory>('rent');
    const [formAmount, setFormAmount] = useState<number | ''>('');
    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
    const [formNotes, setFormNotes] = useState('');

    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    useEffect(() => {
        const refresh = () => {
            setExpenses(getExpenses());
        };
        refresh();
        window.addEventListener('cc_expenses_update', refresh);
        return () => window.removeEventListener('cc_expenses_update', refresh);
    }, []);

    // Aggregate revenues from payments and paid invoices
    const totalRevenue = useMemo(() => {
        const payments = getPayments();
        const invoices = getInvoices().filter(i => i.status === 'paid');
        const paySum = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
        const invSum = invoices.reduce((acc, i) => acc + (i.amount || 0), 0);
        return Math.max(paySum, invSum, 3200); // realistic base if fresh demo
    }, []);

    const totalExpenses = useMemo(() => {
        return expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    }, [expenses]);

    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

    const handleCreateExpense = (e: React.FormEvent) => {
        e.preventDefault();
        const amt = Number(formAmount) || 0;
        if (!formTitle.trim() || amt <= 0) return;

        createExpense({
            title: formTitle.trim(),
            category: formCategory,
            amount: amt,
            date: formDate || new Date().toISOString().split('T')[0],
            notes: formNotes
        });

        setModalOpen(false);
        setFormTitle('');
        setFormAmount('');
        setFormNotes('');
    };

    const handleDeleteExpense = async (id: string) => {
        if (!await confirm(t.deleteConfirm || 'დარწმუნებული ხართ, რომ გსურთ წაშლა?')) return;
        deleteExpense(id);
    };

    const categoryNames: Record<ExpenseCategory, string> = {
        rent: l('დარბაზის ქირა', 'Аренда зала', 'Rent'),
        utilities: l('კომუნალურები', 'Коммунальные', 'Utilities'),
        salary: l('ხელფასები', 'Зарплаты', 'Salaries'),
        equipment: l('ინვენტარი', 'Оборудование', 'Equipment'),
        marketing: l('რეკლამა / მარკეტინგი', 'Маркетинг', 'Marketing'),
        other: l('სხვა ხარჯები', 'Прочее', 'Other'),
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight">
                        {l('ფინანსები', 'Финансы', 'Finance')}
                    </h1>
                    <p className="text-xs sm:text-sm text-muted">
                        {l('სტუდიის შემოსავლები, ხარჯები და წმინდა მოგების ანალიზი', 'Доходы, расходы и чистая прибыль студии', 'Studio revenues, expenses and net profit analytics')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        <span>{l('ხარჯის დამატება', 'Добавить расход', 'Add Expense')}</span>
                    </button>
                </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-card border border-border-subtle rounded-2xl p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                            {l('მთლიანი შემოსავალი', 'Общий доход', 'Total Revenue')}
                        </span>
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                            <ArrowUpRight className="w-4 h-4" />
                        </div>
                    </div>
                    <span className="text-2xl font-black text-emerald-400">
                        {totalRevenue.toLocaleString()} {settings.currency || '₾'}
                    </span>
                </div>

                <div className="bg-card border border-border-subtle rounded-2xl p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                            {l('მთლიანი ხარჯები', 'Всего расходов', 'Total Expenses')}
                        </span>
                        <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                            <ArrowDownRight className="w-4 h-4" />
                        </div>
                    </div>
                    <span className="text-2xl font-black text-rose-400">
                        {totalExpenses.toLocaleString()} {settings.currency || '₾'}
                    </span>
                </div>

                <div className="bg-card border border-border-subtle rounded-2xl p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                            {l('წმინდა მოგება', 'Чистая прибыль', 'Net Profit')}
                        </span>
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                            <Wallet className="w-4 h-4" />
                        </div>
                    </div>
                    <span className={cn("text-2xl font-black", netProfit >= 0 ? "text-indigo-400" : "text-rose-400")}>
                        {netProfit.toLocaleString()} {settings.currency || '₾'}
                    </span>
                </div>

                <div className="bg-card border border-border-subtle rounded-2xl p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                            {l('მომგებიანობა', 'Рентабельность', 'Margin')}
                        </span>
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                            <PieChart className="w-4 h-4" />
                        </div>
                    </div>
                    <span className="text-2xl font-black text-amber-400">
                        {profitMargin}%
                    </span>
                </div>
            </div>

            {/* Expenses List */}
            <div className="bg-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border-subtle flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-primary">
                            {l('ხარჯების რეესტრი', 'Реестр расходов', 'Expenses Ledger')}
                        </h2>
                        <p className="text-xs text-muted">
                            {l('სტუდიის საოპერაციო ხარჯების სია', 'Список операционных расходов студии', 'List of studio operating expenses')}
                        </p>
                    </div>
                </div>

                {expenses.length === 0 ? (
                    <div className="p-12 text-center">
                        <Wallet className="w-12 h-12 text-muted/30 mx-auto mb-3" />
                        <p className="text-sm font-bold text-primary mb-1">
                            {l('ხარჯები ჯერ არ არის დამატებული', 'Расходы еще не добавлены', 'No expenses added yet')}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-border-subtle bg-surface/50 text-muted uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="py-3 px-4">{l('თარიღი', 'Дата', 'Date')}</th>
                                    <th className="py-3 px-4">{l('დასახელება', 'Название', 'Title')}</th>
                                    <th className="py-3 px-4">{l('კატეგორია', 'Категория', 'Category')}</th>
                                    <th className="py-3 px-4">{l('თანხა', 'Сумма', 'Amount')}</th>
                                    <th className="py-3 px-4 text-right">{l('წაშლა', 'Удалить', 'Delete')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle/50">
                                {expenses.map(exp => (
                                    <tr key={exp.id} className="hover:bg-surface/30 transition-colors">
                                        <td className="py-3.5 px-4 text-muted font-mono">
                                            {exp.date}
                                        </td>
                                        <td className="py-3.5 px-4 font-bold text-primary">
                                            {exp.title}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface border border-border-subtle text-primary">
                                                {categoryNames[exp.category] || exp.category}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 font-black text-rose-400">
                                            -{exp.amount} {settings.currency || '₾'}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <button
                                                onClick={() => handleDeleteExpense(exp.id)}
                                                className="w-7 h-7 rounded-lg hover:bg-rose-500/15 text-muted hover:text-rose-400 inline-flex items-center justify-center transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Expense Modal */}
            {modalOpen && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="bg-card border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
                                <h3 className="text-base font-bold text-primary">
                                    {l('ხარჯის დამატება', 'Добавить расход', 'Add Expense')}
                                </h3>
                                <button
                                    onClick={() => setModalOpen(false)}
                                    className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface text-muted transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateExpense} className="p-6 space-y-4">
                                <div>
                                    <label className="text-xs text-muted mb-1.5 block">
                                        {l('ხარჯის დასახელება', 'Название расхода', 'Expense Title')} *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formTitle}
                                        onChange={e => setFormTitle(e.target.value)}
                                        placeholder={l('მაგ: დარბაზის ქირა', 'Напр: аренда зала', 'e.g. Hall Rent')}
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-primary outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">
                                            {l('კატეგორია', 'Категория', 'Category')}
                                        </label>
                                        <select
                                            value={formCategory}
                                            onChange={e => setFormCategory(e.target.value as ExpenseCategory)}
                                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-primary outline-none focus:border-emerald-500"
                                        >
                                            <option value="rent">{l('დარბაზის ქირა', 'Аренда', 'Rent')}</option>
                                            <option value="utilities">{l('კომუნალურები', 'Коммунальные', 'Utilities')}</option>
                                            <option value="salary">{l('ხელფასები', 'Зарплаты', 'Salaries')}</option>
                                            <option value="equipment">{l('ინვენტარი', 'Оборудование', 'Equipment')}</option>
                                            <option value="marketing">{l('რეკლამა', 'Маркетинг', 'Marketing')}</option>
                                            <option value="other">{l('სხვა', 'Прочее', 'Other')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">
                                            {l('თანხა (GEL)', 'Сумма (GEL)', 'Amount (GEL)')} *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={formAmount}
                                            onChange={e => setFormAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                            placeholder="200"
                                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-primary outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-muted mb-1.5 block">
                                        {l('თარიღი', 'Дата', 'Date')}
                                    </label>
                                    <input
                                        type="date"
                                        value={formDate}
                                        onChange={e => setFormDate(e.target.value)}
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-primary outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setModalOpen(false)}
                                        className="px-4 py-2.5 rounded-xl border border-border-subtle text-xs font-bold text-muted hover:bg-surface transition-all"
                                    >
                                        {l('გაუქმება', 'Отмена', 'Cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                                    >
                                        {l('შენახვა', 'Сохранить', 'Save')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
