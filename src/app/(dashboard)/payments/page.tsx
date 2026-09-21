'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Banknote, Plus, Search, CheckCircle2, RotateCcw, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';
import { useStudio } from '@/contexts/StudioContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { 
    getPayments, createPayment, refundPayment, type PaymentRecord 
} from '@/lib/payment-store';
import { getStudents } from '@/lib/student-store';
import type { Student } from '@/types';

export default function PaymentsPage() {
    const { lang } = useT();
    const { settings } = useStudio();
    const confirm = useConfirm();

    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [search, setSearch] = useState('');
    const [methodFilter, setMethodFilter] = useState<'all' | 'cash' | 'card' | 'transfer'>('all');
    const [modalOpen, setModalOpen] = useState(false);

    // Form
    const [formStudent, setFormStudent] = useState('');
    const [formCustomName, setFormCustomName] = useState('');
    const [formAmount, setFormAmount] = useState<number | ''>('');
    const [formMethod, setFormMethod] = useState<'cash' | 'card' | 'transfer'>('card');
    const [formItemType] = useState<'subscription' | 'lesson' | 'rental' | 'shop' | 'other'>('subscription');
    const [formDesc, setFormDesc] = useState('');
    const [formDate] = useState(new Date().toISOString().split('T')[0]);

    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    useEffect(() => {
        const refresh = () => {
            setPayments(getPayments());
            setStudents(getStudents());
        };
        refresh();
        window.addEventListener('cc_payments_update', refresh);
        return () => window.removeEventListener('cc_payments_update', refresh);
    }, []);

    const filteredPayments = useMemo(() => {
        return payments.filter(p => {
            const matchesMethod = methodFilter === 'all' || p.payment_method === methodFilter;
            const matchesSearch = !search || 
                p.student_name.toLowerCase().includes(search.toLowerCase()) ||
                p.description.toLowerCase().includes(search.toLowerCase()) ||
                p.id.toLowerCase().includes(search.toLowerCase());
            return matchesMethod && matchesSearch;
        });
    }, [payments, methodFilter, search]);

    const stats = useMemo(() => {
        const active = payments.filter(p => p.status === 'completed');
        const totalAmt = active.reduce((s, p) => s + (p.amount || 0), 0);
        const count = active.length;
        const avg = count > 0 ? Math.round(totalAmt / count) : 0;
        return { totalAmt, count, avg };
    }, [payments]);

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        const studentObj = students.find(s => s.id === formStudent);
        const studentName = studentObj ? studentObj.full_name : (formCustomName.trim() || l('კლიენტი', 'Клиент', 'Client'));
        const amt = Number(formAmount) || 0;
        if (amt <= 0) return;

        createPayment({
            student_id: formStudent || undefined,
            student_name: studentName,
            amount: amt,
            payment_method: formMethod,
            item_type: formItemType,
            description: formDesc.trim() || l('სტუდიის გადახდა', 'Оплата студии', 'Studio payment'),
            date: formDate || new Date().toISOString().split('T')[0],
            status: 'completed',
            processed_by: 'ადმინი'
        });

        setModalOpen(false);
        setFormStudent('');
        setFormCustomName('');
        setFormAmount('');
        setFormDesc('');
    };

    const handleRefund = async (id: string) => {
        if (!await confirm(l('დარწმუნებული ხართ, რომ გსურთ თანხის დაბრუნება (Refund)?', 'Вы уверены, что хотите оформить возврат?', 'Are you sure you want to refund this payment?'))) return;
        refundPayment(id);
    };

    const methodBadges = {
        cash: { label: l('ნაღდი', 'Наличные', 'Cash'), color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
        card: { label: l('ბარათი', 'Карта', 'Card'), color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
        transfer: { label: l('გადარიცხვა', 'Перевод', 'Transfer'), color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight">
                        {l('გადახდები', 'Платежи', 'Payments')}
                    </h1>
                    <p className="text-xs sm:text-sm text-muted">
                        {l('ყველა შემოსული გადახდა და ტრანზაქციების ჟურნალი', 'Все входящие платежи и журнал транзакций', 'All incoming payments and transaction ledger')}
                    </p>
                </div>
                <button
                    onClick={() => setModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold shadow-lg shadow-teal-500/20 transition-all active:scale-95 shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    <span>{l('გადახდის გატარება', 'Провести платеж', 'Record Payment')}</span>
                </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-card border border-border-subtle rounded-2xl p-4 shadow-sm">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                        {l('სულ მიღებული თანხა', 'Всего получено', 'Total Collected')}
                    </span>
                    <span className="text-2xl font-black text-teal-400">
                        {stats.totalAmt.toLocaleString()} {settings.currency || '₾'}
                    </span>
                </div>
                <div className="bg-card border border-border-subtle rounded-2xl p-4 shadow-sm">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                        {l('ტრანზაქციების რაოდენობა', 'Количество транзакций', 'Transactions Count')}
                    </span>
                    <span className="text-2xl font-black text-primary">{stats.count}</span>
                </div>
                <div className="bg-card border border-border-subtle rounded-2xl p-4 shadow-sm">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                        {l('საშუალო გადახდა', 'Средний чек', 'Average Check')}
                    </span>
                    <span className="text-2xl font-black text-amber-400">
                        {stats.avg.toLocaleString()} {settings.currency || '₾'}
                    </span>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border-subtle rounded-2xl p-2">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={l('ძებნა კლიენტით ან აღწერით...', 'Поиск по клиенту или описанию...', 'Search by client or description...')}
                        className="w-full bg-surface border border-border-subtle rounded-xl pl-9 pr-4 py-2 text-xs text-primary outline-none focus:border-teal-500/50"
                    />
                </div>
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {(['all', 'card', 'cash', 'transfer'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setMethodFilter(tab)}
                            className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 capitalize",
                                methodFilter === tab
                                    ? "bg-teal-500 text-white shadow-sm"
                                    : "text-muted hover:text-primary hover:bg-surface"
                            )}
                        >
                            {tab === 'all' && l('ყველა', 'Все', 'All')}
                            {tab === 'card' && l('ბარათი', 'Карта', 'Card')}
                            {tab === 'cash' && l('ნაღდი', 'Наличные', 'Cash')}
                            {tab === 'transfer' && l('გადარიცხვა', 'Перевод', 'Transfer')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Payments Table */}
            <div className="bg-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
                {filteredPayments.length === 0 ? (
                    <div className="p-12 text-center">
                        <Banknote className="w-12 h-12 text-muted/30 mx-auto mb-3" />
                        <p className="text-sm font-bold text-primary mb-1">
                            {l('გადახდები არ მოიძებნა', 'Платежи не найдены', 'No payments found')}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-border-subtle bg-surface/50 text-muted uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="py-3 px-4">{l('თარიღი', 'Дата', 'Date')}</th>
                                    <th className="py-3 px-4">{l('კლიენტი', 'Клиент', 'Client')}</th>
                                    <th className="py-3 px-4">{l('დანიშნულება', 'Назначение', 'Item / Reason')}</th>
                                    <th className="py-3 px-4">{l('მეთოდი', 'Способ', 'Method')}</th>
                                    <th className="py-3 px-4">{l('თანხა', 'Сумма', 'Amount')}</th>
                                    <th className="py-3 px-4">{l('სტატუსი', 'Статус', 'Status')}</th>
                                    <th className="py-3 px-4 text-right">{l('მოქმედება', 'Действие', 'Actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle/50">
                                {filteredPayments.map(p => (
                                    <tr key={p.id} className="hover:bg-surface/30 transition-colors">
                                        <td className="py-3.5 px-4 text-muted font-mono whitespace-nowrap">
                                            {p.date}
                                        </td>
                                        <td className="py-3.5 px-4 font-bold text-primary">
                                            {p.student_name}
                                        </td>
                                        <td className="py-3.5 px-4 text-muted truncate max-w-[220px]">
                                            {p.description}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className={cn("inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border", methodBadges[p.payment_method].color)}>
                                                {methodBadges[p.payment_method].label}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 font-black text-teal-400 whitespace-nowrap">
                                            +{p.amount} {settings.currency || '₾'}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {p.status === 'completed' ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {l('შესრულებული', 'Выполнен', 'Completed')}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400">
                                                    <RotateCcw className="w-3 h-3" />
                                                    {l('დაბრუნებული', 'Возврат', 'Refunded')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            {p.status === 'completed' && (
                                                <button
                                                    onClick={() => handleRefund(p.id)}
                                                    title={l('თანხის დაბრუნება (Refund)', 'Оформить возврат', 'Refund')}
                                                    className="w-7 h-7 rounded-lg hover:bg-rose-500/15 text-muted hover:text-rose-400 inline-flex items-center justify-center transition-colors"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Payment Modal */}
            {modalOpen && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="bg-card border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
                                <h3 className="text-base font-bold text-primary">
                                    {l('გადახდის გატარება', 'Проведение платежа', 'Record Payment')}
                                </h3>
                                <button
                                    onClick={() => setModalOpen(false)}
                                    className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface text-muted transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreate} className="p-6 space-y-4">
                                <div>
                                    <label className="text-xs text-muted mb-1.5 block">
                                        {l('მოსწავლე / კლიენტი', 'Ученик / Клиент', 'Student / Client')}
                                    </label>
                                    <select
                                        value={formStudent}
                                        onChange={e => setFormStudent(e.target.value)}
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-primary outline-none focus:border-teal-500 mb-2"
                                    >
                                        <option value="">{l('— აირჩიეთ მოსწავლე ან შეიყვანეთ ქვემოთ —', '— Выберите или введите ниже —', '— Select student or enter custom —')}</option>
                                        {students.map(s => (
                                            <option key={s.id} value={s.id}>{s.full_name}</option>
                                        ))}
                                    </select>
                                    {!formStudent && (
                                        <input
                                            type="text"
                                            value={formCustomName}
                                            onChange={e => setFormCustomName(e.target.value)}
                                            placeholder={l('ან შეიყვანეთ კლიენტის სახელი...', 'Имя клиента...', 'Or enter client name...')}
                                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2 text-xs text-primary outline-none focus:border-teal-500"
                                        />
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
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
                                            placeholder="100"
                                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-primary outline-none focus:border-teal-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">
                                            {l('გადახდის მეთოდი', 'Способ оплаты', 'Method')}
                                        </label>
                                        <select
                                            value={formMethod}
                                            onChange={e => setFormMethod(e.target.value as any)}
                                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-primary outline-none focus:border-teal-500"
                                        >
                                            <option value="card">{l('საბანკო ბარათი', 'Карта', 'Card')}</option>
                                            <option value="cash">{l('ნაღდი ფული', 'Наличные', 'Cash')}</option>
                                            <option value="transfer">{l('გადარიცხვა', 'Перевод', 'Bank Transfer')}</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-muted mb-1.5 block">
                                        {l('დანიშნულება / აღწერა', 'Назначение / Описание', 'Reason / Description')} *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formDesc}
                                        onChange={e => setFormDesc(e.target.value)}
                                        placeholder={l('მაგ: აბონემენტის გადახდა', 'Напр: оплата абонемента', 'e.g. Subscription payment')}
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-primary outline-none focus:border-teal-500"
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
                                        className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-xs font-bold text-white shadow-lg shadow-teal-500/20 transition-all active:scale-95"
                                    >
                                        {l('გატარება', 'Провести', 'Record')}
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
