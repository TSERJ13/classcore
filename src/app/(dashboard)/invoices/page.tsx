'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
    FileText, Plus, Search, CheckCircle2, Clock, AlertCircle, 
    Download, Trash2, Printer, X, User, DollarSign, Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';
import { useStudio } from '@/contexts/StudioContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { 
    getInvoices, createInvoice, updateInvoice, deleteInvoice, type Invoice 
} from '@/lib/invoice-store';
import { getStudents } from '@/lib/student-store';
import type { Student } from '@/types';

export default function InvoicesPage() {
    const { t, lang } = useT();
    const { settings } = useStudio();
    const confirm = useConfirm();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
    const [modalOpen, setModalOpen] = useState(false);

    // Form state
    const [formStudent, setFormStudent] = useState('');
    const [formCustomName, setFormCustomName] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formAmount, setFormAmount] = useState<number | ''>('');
    const [formDueDate, setFormDueDate] = useState('');
    const [formNotes, setFormNotes] = useState('');

    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    useEffect(() => {
        const refresh = () => {
            setInvoices(getInvoices());
            setStudents(getStudents());
        };
        refresh();
        window.addEventListener('cc_invoices_update', refresh);
        return () => window.removeEventListener('cc_invoices_update', refresh);
    }, []);

    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
            const matchesSearch = !search || 
                inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
                inv.student_name.toLowerCase().includes(search.toLowerCase()) ||
                inv.items.some(it => it.description.toLowerCase().includes(search.toLowerCase()));
            return matchesStatus && matchesSearch;
        });
    }, [invoices, statusFilter, search]);

    const stats = useMemo(() => {
        const total = invoices.length;
        const paidTotal = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0);
        const pendingTotal = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + (i.amount || 0), 0);
        const overdueCount = invoices.filter(i => i.status === 'overdue').length;
        return { total, paidTotal, pendingTotal, overdueCount };
    }, [invoices]);

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        const studentObj = students.find(s => s.id === formStudent);
        const studentName = studentObj ? studentObj.full_name : (formCustomName.trim() || l('კლიენტი', 'Клиент', 'Client'));
        const amount = Number(formAmount) || 0;
        const now = new Date();
        const nextNum = `INV-${now.getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`;

        createInvoice({
            invoice_number: nextNum,
            student_id: formStudent || undefined,
            student_name: studentName,
            amount,
            currency: settings.currency || 'GEL',
            status: 'pending',
            issue_date: now.toISOString().split('T')[0],
            due_date: formDueDate || new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0],
            items: [{
                description: formDesc.trim() || l('სტუდიის მომსახურება', 'Услуга студии', 'Studio Service'),
                quantity: 1,
                price: amount
            }],
            notes: formNotes
        });

        setModalOpen(false);
        setFormStudent('');
        setFormCustomName('');
        setFormDesc('');
        setFormAmount('');
        setFormDueDate('');
        setFormNotes('');
    };

    const handleMarkPaid = (id: string) => {
        updateInvoice(id, { status: 'paid', payment_method: 'card' });
    };

    const handleDelete = async (id: string) => {
        if (!await confirm(t.deleteConfirm || 'დარწმუნებული ხართ, რომ გსურთ წაშლა?')) return;
        deleteInvoice(id);
    };

    const handlePrint = (inv: Invoice) => {
        window.print();
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight">
                        {l('ინვოისები', 'Инвойсы', 'Invoices')}
                    </h1>
                    <p className="text-xs sm:text-sm text-muted">
                        {l('მართეთ სტუდიის ანგარიშ-ფაქტურები და გადახდის მოთხოვნები', 'Управление инвойсами и счетами на оплату', 'Manage studio invoices and payment requests')}
                    </p>
                </div>
                <button
                    onClick={() => setModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    <span>{l('ახალი ინვოისი', 'Новый инвойс', 'New Invoice')}</span>
                </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-card border border-border-subtle rounded-2xl p-4 shadow-sm">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                        {l('სულ ინვოისები', 'Всего инвойсов', 'Total Invoices')}
                    </span>
                    <span className="text-2xl font-black text-primary">{stats.total}</span>
                </div>
                <div className="bg-card border border-border-subtle rounded-2xl p-4 shadow-sm">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                        {l('გადახდილი', 'Оплачено', 'Paid')}
                    </span>
                    <span className="text-2xl font-black text-emerald-400">{stats.paidTotal} {settings.currency || '₾'}</span>
                </div>
                <div className="bg-card border border-border-subtle rounded-2xl p-4 shadow-sm">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                        {l('გადასახდელი', 'Ожидает оплаты', 'Pending')}
                    </span>
                    <span className="text-2xl font-black text-amber-400">{stats.pendingTotal} {settings.currency || '₾'}</span>
                </div>
                <div className="bg-card border border-border-subtle rounded-2xl p-4 shadow-sm">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                        {l('ვადაგადაცილებული', 'Просрочено', 'Overdue')}
                    </span>
                    <span className="text-2xl font-black text-rose-400">{stats.overdueCount}</span>
                </div>
            </div>

            {/* Search and Tabs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border-subtle rounded-2xl p-2">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={l('ძებნა ინვოისის ნომრით ან კლიენტით...', 'Поиск по номеру или клиенту...', 'Search by invoice # or client...')}
                        className="w-full bg-surface border border-border-subtle rounded-xl pl-9 pr-4 py-2 text-xs text-primary outline-none focus:border-indigo-500/50"
                    />
                </div>
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {(['all', 'paid', 'pending', 'overdue'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setStatusFilter(tab)}
                            className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 capitalize",
                                statusFilter === tab
                                    ? "bg-indigo-500 text-white shadow-sm"
                                    : "text-muted hover:text-primary hover:bg-surface"
                            )}
                        >
                            {tab === 'all' && l('ყველა', 'Все', 'All')}
                            {tab === 'paid' && l('გადახდილი', 'Оплачено', 'Paid')}
                            {tab === 'pending' && l('გადასახდელი', 'Ожидает', 'Pending')}
                            {tab === 'overdue' && l('ვადაგასული', 'Просрочено', 'Overdue')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Invoices List / Table */}
            <div className="bg-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
                {filteredInvoices.length === 0 ? (
                    <div className="p-12 text-center">
                        <FileText className="w-12 h-12 text-muted/30 mx-auto mb-3" />
                        <p className="text-sm font-bold text-primary mb-1">
                            {l('ინვოისები არ მოიძებნა', 'Инвойсы не найдены', 'No invoices found')}
                        </p>
                        <p className="text-xs text-muted">
                            {l('შექმენით ახალი ინვოისი ღილაკზე დაჭერით', 'Создайте новый инвойс нажав кнопку сверху', 'Create a new invoice using the button above')}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-border-subtle bg-surface/50 text-muted uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="py-3 px-4">{l('ინვოისი', 'Инвойс', 'Invoice')}</th>
                                    <th className="py-3 px-4">{l('კლიენტი', 'Клиент', 'Client')}</th>
                                    <th className="py-3 px-4">{l('აღწერა', 'Описание', 'Description')}</th>
                                    <th className="py-3 px-4">{l('თანხა', 'Сумма', 'Amount')}</th>
                                    <th className="py-3 px-4">{l('გადახდის ვადა', 'Срок', 'Due Date')}</th>
                                    <th className="py-3 px-4">{l('სტატუსი', 'Статус', 'Status')}</th>
                                    <th className="py-3 px-4 text-right">{l('მოქმედება', 'Действие', 'Actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle/50">
                                {filteredInvoices.map(inv => (
                                    <tr key={inv.id} className="hover:bg-surface/30 transition-colors">
                                        <td className="py-3.5 px-4 font-black text-primary font-mono">
                                            {inv.invoice_number}
                                        </td>
                                        <td className="py-3.5 px-4 font-bold text-primary">
                                            {inv.student_name}
                                        </td>
                                        <td className="py-3.5 px-4 text-muted truncate max-w-[200px]">
                                            {inv.items?.[0]?.description || '—'}
                                        </td>
                                        <td className="py-3.5 px-4 font-black text-primary">
                                            {inv.amount} {inv.currency || 'GEL'}
                                        </td>
                                        <td className="py-3.5 px-4 text-muted">
                                            {inv.due_date}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {inv.status === 'paid' && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {l('გადახდილი', 'Оплачен', 'Paid')}
                                                </span>
                                            )}
                                            {inv.status === 'pending' && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                                    <Clock className="w-3 h-3" />
                                                    {l('მოლოდინში', 'Ожидает', 'Pending')}
                                                </span>
                                            )}
                                            {inv.status === 'overdue' && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                                                    <AlertCircle className="w-3 h-3" />
                                                    {l('ვადაგასული', 'Просрочен', 'Overdue')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="inline-flex items-center gap-1">
                                                {inv.status !== 'paid' && (
                                                    <button
                                                        onClick={() => handleMarkPaid(inv.id)}
                                                        title={l('გადახდილად მონიშვნა', 'Отметить оплаченным', 'Mark as paid')}
                                                        className="w-7 h-7 rounded-lg hover:bg-emerald-500/15 text-muted hover:text-emerald-400 flex items-center justify-center transition-colors"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handlePrint(inv)}
                                                    title={l('ამობეჭდვა', 'Печать', 'Print')}
                                                    className="w-7 h-7 rounded-lg hover:bg-surface text-muted hover:text-primary flex items-center justify-center transition-colors"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(inv.id)}
                                                    title={l('წაშლა', 'Удалить', 'Delete')}
                                                    className="w-7 h-7 rounded-lg hover:bg-rose-500/15 text-muted hover:text-rose-400 flex items-center justify-center transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Invoice Modal */}
            {modalOpen && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="bg-card border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
                                <h3 className="text-base font-bold text-primary">
                                    {l('ახალი ინვოისის შექმნა', 'Создание инвойса', 'Create Invoice')}
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
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-primary outline-none focus:border-indigo-500 mb-2"
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
                                            placeholder={l('ან შეიყვანეთ კლიენტის სახელი...', 'Имя клиента...', 'Or enter custom client name...')}
                                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2 text-xs text-primary outline-none focus:border-indigo-500"
                                        />
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs text-muted mb-1.5 block">
                                        {l('მომსახურების აღწერა', 'Описание услуги', 'Service Description')} *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formDesc}
                                        onChange={e => setFormDesc(e.target.value)}
                                        placeholder={l('მაგ: ყოველთვიური აბონემენტი', 'Напр: месячный абонемент', 'e.g. Monthly Subscription')}
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-primary outline-none focus:border-indigo-500"
                                    />
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
                                            placeholder="150"
                                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-primary outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">
                                            {l('გადახდის ვადა', 'Срок оплаты', 'Due Date')}
                                        </label>
                                        <input
                                            type="date"
                                            value={formDueDate}
                                            onChange={e => setFormDueDate(e.target.value)}
                                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-primary outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-muted mb-1.5 block">
                                        {l('შენიშვნა', 'Заметка', 'Notes')}
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={formNotes}
                                        onChange={e => setFormNotes(e.target.value)}
                                        placeholder={l('დამატებითი ინფორმაცია...', 'Дополнительная информация...', 'Optional notes...')}
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2 text-xs text-primary outline-none focus:border-indigo-500 resize-none"
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
                                        className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                                    >
                                        {l('შექმნა', 'Создать', 'Create')}
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
