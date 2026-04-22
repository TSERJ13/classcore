'use client';

import { useState, useEffect } from 'react';
import {
    Plus, CalendarDays, Clock, CalendarRange, Phone, Banknote,
    CheckCircle2, XCircle, AlertCircle, ChevronRight, X, Search, Filter, FileText, Trash2
} from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { cn, formatCurrency } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';
import type { HallRental, RentalType, PaymentStatus } from '@/types';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { StandardDatePicker } from '@/components/ui/StandardDatePicker';
import { generateTimeOptions } from '@/lib/date-utils';

const RENTAL_TYPES: { value: RentalType; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: 'hourly', label: 'საათობრივი/დღიური', icon: <Clock className="w-4 h-4" />, desc: 'ერთი დღე, კონკრეტული საათები' },
    { value: 'multiday', label: 'რამდენიმე დღე', icon: <CalendarRange className="w-4 h-4" />, desc: 'თარიღის ინტერვალი' },
    { value: 'monthly', label: 'თვიური', icon: <CalendarDays className="w-4 h-4" />, desc: 'ფიქსირებული ყოველთვიური' },
];

const HALLS = ['დარბაზი #1', 'დარბაზი #2', 'სტუდია A', 'სტუდია B'];

const MOCK_RENTALS: HallRental[] = [
    { id: '1', org_id: 'demo', renter_name: 'ლელა მამულაშვილი', renter_phone: '577 11 22 33', hall_name: 'დარბაზი #1', rental_type: 'hourly', start_date: '2026-02-22', end_date: '2026-02-22', start_time: '18:00', end_time: '21:00', total_price: 150, deposit: 50, payment_status: 'partial', event_type: 'დაბადების დღე', created_at: '2026-02-19' },
    { id: '2', org_id: 'demo', renter_name: 'TBC Dance Academy', renter_phone: '598 33 44 55', hall_name: 'სტუდია A', rental_type: 'monthly', start_date: '2026-03-01', end_date: '2026-03-31', total_price: 800, deposit: 200, payment_status: 'paid', event_type: 'რეპეტიცია', created_at: '2026-02-18' },
    { id: '3', org_id: 'demo', renter_name: 'გიორგი ბერიძე', renter_phone: '555 44 55 66', hall_name: 'დარბაზი #2', rental_type: 'multiday', start_date: '2026-02-25', end_date: '2026-02-27', total_price: 360, deposit: 100, payment_status: 'pending', event_type: 'ფოტო სეია', created_at: '2026-02-17' },
];

const PAY_STATUS_INFO: Record<PaymentStatus, { icon: React.ReactNode; label: string; cls: string }> = {
    paid: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'გადახდილია', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    pending: { icon: <AlertCircle className="w-3.5 h-3.5" />, label: 'გადასახდელი', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    partial: { icon: <Clock className="w-3.5 h-3.5" />, label: 'ნაწილობრივ', cls: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
    cancelled: { icon: <XCircle className="w-3.5 h-3.5" />, label: 'გაუქმებული', cls: 'bg-red-500/10 text-red-600 border-red-500/20' },
};

const TYPE_LABELS: Record<RentalType, string> = {
    hourly: 'საათობრივი', multiday: 'რამდენიმე დღე', monthly: 'თვიური',
};

const EMPTY: Omit<HallRental, 'id' | 'org_id' | 'created_at'> = {
    renter_name: '', renter_phone: '', renter_email: '',
    hall_name: HALLS[0], rental_type: 'hourly',
    start_date: '', end_date: '', start_time: '', end_time: '',
    total_price: 0, deposit: 0, payment_status: 'pending',
    event_type: '', notes: '',
    contract_url: '',
};

export default function HallRentalPage() {
    const { t } = useT();
    const { settings } = useStudio();
    const confirm = useConfirm();
    const [rentals, setRentals] = useState<HallRental[]>(MOCK_RENTALS);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<HallRental | null>(null);
    const [form, setForm] = useState(EMPTY);
    const [step, setStep] = useState(1);
    const [search, setSearch] = useState('');
    const [hallFilter, setHallFilter] = useState('all');


    const timeOptions = generateTimeOptions(15);

    function set(k: string, v: string | number) { setForm(p => ({ ...p, [k]: v })); }
    function openAdd() { setEditing(null); setForm(EMPTY); setStep(1); setModalOpen(true); }
    function openEdit(r: HallRental) { setEditing(r); setForm(r); setStep(2); setModalOpen(true); }

    function saveRental() {
        if (editing) {
            setRentals(prev => prev.map(r => r.id === editing.id ? { ...r, ...form } as HallRental : r));
        } else {
            setRentals(prev => [{
                ...form, id: String(Date.now()), org_id: settings.orgId || 'demo', created_at: new Date().toISOString(),
            } as HallRental, ...prev]);
        }
        setModalOpen(false);
    }

    function deleteRental(id: string) {
        setRentals(prev => prev.filter(r => r.id !== id));
        setModalOpen(false);
    }

    const filtered = rentals.filter(r => {
        const matchesSearch = r.renter_name.toLowerCase().includes(search.toLowerCase()) || r.hall_name?.toLowerCase().includes(search.toLowerCase());
        const matchesHall = hallFilter === 'all' || r.hall_name === hallFilter;
        return matchesSearch && matchesHall;
    });

    const totalRevenue = rentals.reduce((s, r) => s + (r.payment_status !== 'cancelled' ? r.total_price : 0), 0);
    const paidTotal = rentals.filter(r => r.payment_status === 'paid').reduce((s, r) => s + r.total_price, 0);

    return (
        <div className="space-y-8 animate-fade-up max-w-7xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-primary tracking-tight">{t.hallRental}</h1>
                    <p className="text-sm text-muted font-medium opacity-60">{rentals.length} {t.addRental.toLowerCase()}</p>
                </div>
                <button onClick={openAdd}
                    className="flex items-center justify-center gap-2 bg-[#6d28d9] hover:bg-[#5b21b6] active:scale-[0.97] transition-all text-white text-sm font-bold px-6 py-3.5 rounded-[1.25rem] shadow-xl shadow-violet-600/30 whitespace-nowrap uppercase tracking-widest">
                    <Plus className="w-4 h-4" />
                    <span>{t.addRental}</span>
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: t.monthlyRevenue, value: formatCurrency(totalRevenue, settings.currency), icon: Banknote, cls: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20' },
                    { label: t.paid, value: formatCurrency(paidTotal, settings.currency), icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
                    { label: 'ჯავშნები', value: String(rentals.length), icon: CalendarDays, cls: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
                ].map(s => (
                    <div key={s.label} className="bg-card border border-border-subtle rounded-3xl p-5 flex items-center gap-4 shadow-sm group hover:shadow-xl hover:shadow-black/5 transition-all">
                        <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform ${s.cls}`}>
                            <s.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xl font-black text-primary tabular-nums leading-none tracking-tight">{s.value}</p>
                            <p className="text-[10px] text-muted font-black tracking-widest mt-1 opacity-40">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search & Filter */}
            <div className="flex gap-3">
                <div className="relative flex-1 min-w-0 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
                    <input type="text" placeholder={t.search} value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-card border border-border-subtle rounded-2xl pl-11 pr-5 py-3 text-sm text-primary placeholder:text-muted/30 focus:outline-none focus:border-indigo-500/60 transition-all shadow-sm" />
                </div>
                <div className="w-[200px] shrink-0">
                    <SearchSelect
                        options={[
                            { value: 'all', label: t.allHalls || 'ყველა დარბაზი' },
                            ...HALLS.map(h => ({ value: h, label: h }))
                        ]}
                        value={hallFilter}
                        onChange={setHallFilter}
                        className="!border-border-subtle hover:!border-indigo-500/30 shadow-sm [&>div]:py-3 [&>div]:px-4"
                    />
                </div>
                <button className="flex items-center gap-2 bg-card border border-border-subtle hover:border-indigo-500/30 text-muted hover:text-primary text-xs font-bold px-4 py-3 rounded-2xl transition-all flex-shrink-0 shadow-sm">
                    <Filter className="w-4 h-4" />
                    <span className="hidden sm:inline">{t.filter}</span>
                </button>
            </div>

            {/* Rentals list */}
            <div className="grid gap-4 stagger">
                {filtered.map(r => {
                    const status = PAY_STATUS_INFO[r.payment_status];
                    return (
                        <div key={r.id} onClick={() => openEdit(r)}
                            className="group bg-card border border-border-subtle hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/5 rounded-[2rem] p-6 transition-all duration-300 cursor-pointer overflow-hidden">
                            <div className="flex items-start gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-500/10 transition-colors">
                                    {r.rental_type === 'hourly' && <Clock className="w-7 h-7 text-indigo-500" />}
                                    {r.rental_type === 'multiday' && <CalendarRange className="w-7 h-7 text-indigo-500" />}
                                    {r.rental_type === 'monthly' && <CalendarDays className="w-7 h-7 text-indigo-500" />}
                                </div>

                                <div className="flex-1 min-w-0 pt-0.5">
                                    <div className="flex flex-wrap items-center gap-2.5 mb-2">
                                        <p className="text-base font-black text-primary group-hover:text-indigo-600 transition-colors leading-tight tracking-tight">{r.renter_name}</p>
                                        <span className={cn('px-3 py-1 rounded-full text-[10px] font-black tracking-wider border flex items-center gap-1.5', status.cls)}>
                                            {status.icon}
                                            {status.label}
                                        </span>
                                        <span className="text-[10px] text-muted font-black tracking-widest bg-surface border border-border-subtle rounded-full px-2.5 py-1 opacity-60">{TYPE_LABELS[r.rental_type]}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-bold text-muted opacity-50">
                                        {r.hall_name && (
                                            <span className="flex items-center gap-1.5">
                                                <div className="w-1 h-1 rounded-full bg-indigo-500" />
                                                {r.hall_name}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1.5">
                                            <CalendarDays className="w-3.5 h-3.5 opacity-40" />
                                            {r.start_date}{r.start_date !== r.end_date ? ` → ${r.end_date}` : ''}
                                        </span>
                                        {r.start_time && (
                                            <span className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 opacity-40" />
                                                {r.start_time} – {r.end_time}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-5 mt-4 pt-4 border-t border-border-subtle/50">
                                        <div>
                                            <p className="text-xl font-black text-primary tabular-nums tracking-tighter">{formatCurrency(r.total_price, settings.currency)}</p>
                                            <p className="text-[9px] font-black text-muted tracking-widest opacity-40 mt-1">ჯამური ფასი</p>
                                        </div>
                                        {r.deposit > 0 && (
                                            <div>
                                                <p className="text-sm font-black text-indigo-600 tabular-nums tracking-tight">{formatCurrency(r.deposit, settings.currency)}</p>
                                                <p className="text-[9px] font-black text-muted tracking-widest opacity-40 mt-1">დეპოზიტი</p>
                                            </div>
                                        )}
                                        <div className="ml-auto flex items-center gap-3">
                                            {r.contract_url && (
                                                <button onClick={(e) => { e.stopPropagation(); window.open(r.contract_url, '_blank'); }}
                                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition-all border border-indigo-500/20" title="კონტრაქტის ნახვა">
                                                    <FileText className="w-5 h-5" />
                                                </button>
                                            )}
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border-subtle rounded-xl text-[10px] font-black text-muted group-hover:text-primary transition-colors">
                                                <Phone className="w-3 h-3 text-indigo-500" />
                                                {r.renter_phone}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-3 pt-1">
                                    <button onClick={(e) => { e.stopPropagation(); openEdit(r); }}
                                        className="w-10 h-10 flex items-center justify-center rounded-2xl bg-surface border border-border-subtle text-muted hover:text-indigo-600 hover:border-indigo-500/40 hover:shadow-lg transition-all active:scale-95">
                                        <Plus className="w-4 h-4 rotate-45" />
                                    </button>
                                    <ChevronRight className="w-6 h-6 text-muted opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all mt-1" />
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filtered.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center text-muted/30">
                        <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
                            <CalendarDays className="w-10 h-10 opacity-20" />
                        </div>
                        <p className="text-base font-bold">ჯავშნები ვერ მოიძებნა</p>
                        <p className="text-xs font-medium mt-1">სცადეთ სხვა საძიებო სიტყვა</p>
                    </div>
                )}
            </div>

            {/* ─── Add Rental Modal ──────────────────────────── */}
            {modalOpen && (
                <>
                    <div className="fixed inset-0 z-[60] bg-black/20" onClick={() => setModalOpen(false)} />
                    <div className="fixed inset-y-0 right-0 z-[70] w-full max-w-md flex flex-col bg-card border-l border-border-subtle shadow-2xl animate-in slide-in-from-right duration-300">
                        <div className="flex items-center justify-between px-8 py-6 border-b border-border-subtle flex-shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-primary tracking-tight">{editing ? 'ჯავშნის რედაქტირება' : 'ახალი ჯავშანი'}</h2>
                                <p className="text-[10px] font-black text-indigo-600 tracking-widest mt-1 opacity-70">{editing ? editing.renter_name : `ნაბიჯი ${step} / 2`}</p>
                            </div>
                            <button onClick={() => setModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-surface text-muted transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 scrollbar-thin">
                            {editing && step === 2 && (
                                <div className="space-y-4">
                                    <button onClick={async () => { if (await confirm('ნამდვილად გსურთ წაშლა?')) deleteRental(editing.id); }}
                                        className="w-full py-2.5 text-red-500/60 hover:text-red-500 text-xs font-bold border border-red-500/10 hover:border-red-500/30 rounded-xl transition-all flex items-center justify-center gap-2">
                                        <Trash2 className="w-4 h-4" /> ჯავშნის წაშლა
                                    </button>
                                </div>
                            )}
                            {step === 1 ? (
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black text-muted tracking-[0.2em] mb-4 opacity-40">გაქირავების ტიპი</p>
                                    {RENTAL_TYPES.map(rt => (
                                        <button key={rt.value} onClick={() => { set('rental_type', rt.value); setStep(2); }}
                                            className={cn(
                                                'w-full flex items-center gap-5 p-5 rounded-3xl border transition-all text-left group',
                                                form.rental_type === rt.value ? 'bg-indigo-500/5 border-indigo-500/40 shadow-xl shadow-indigo-500/5' : 'bg-surface/30 border-border-subtle hover:bg-surface/60'
                                            )}>
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 flex-shrink-0 group-hover:scale-110 transition-transform">
                                                {rt.icon}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-primary group-hover:text-indigo-600 transition-colors tracking-tight">{rt.label}</p>
                                                <p className="text-[10px] font-bold text-muted mt-1 opacity-60 leading-tight">{rt.desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6 pb-10">
                                    {/* Renter info */}
                                    <p className="text-[10px] font-black text-muted tracking-[0.2em] opacity-40">გამქირავებელი</p>
                                    <div className="space-y-4">
                                        {[
                                            { key: 'renter_name', label: 'სახელი *', ph: 'სახელი და გვარი' },
                                            { key: 'renter_phone', label: 'ტელეფონი *', ph: '577 XX XX XX' },
                                            { key: 'renter_email', label: 'ელ.ფოსტა', ph: 'email@gmail.com' },
                                            { key: 'event_type', label: 'ღონისძიების ტიპი', ph: 'კონცერტი, ფოტო სეია...' },
                                        ].map(f => (
                                            <div key={f.key}>
                                                <label className="text-[11px] font-black text-muted mb-2 block tracking-wider opacity-60">{f.label}</label>
                                                <input value={(form as Record<string, string | number>)[f.key] as string ?? ''}
                                                    onChange={e => set(f.key, e.target.value)} placeholder={f.ph}
                                                    className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-2xl px-4 py-3.5 text-sm font-bold text-primary placeholder:text-muted/30 outline-none transition-all shadow-inner" />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Hall */}
                                    <div className="border-t border-border-subtle/50 pt-6">
                                        <label className="text-[11px] font-black text-muted mb-2 block tracking-wider opacity-60">დარბაზი</label>
                                        <SearchSelect
                                            options={HALLS.map(h => ({ value: h, label: h }))}
                                            value={form.hall_name || ''}
                                            onChange={val => set('hall_name', val)}
                                            className="!border-border-subtle hover:!border-indigo-500/60 shadow-inner [&>div]:py-3.5 [&>div]:px-4"
                                            placeholder="აირჩიეთ დარბაზი"
                                        />
                                    </div>

                                    {/* Dates */}
                                    <div className="border-t border-border-subtle/50 pt-6 space-y-4">
                                        <StandardDatePicker
                                            label="დაწყების თარიღი *"
                                            value={form.start_date}
                                            onChange={val => set('start_date', val)}
                                        />

                                        <StandardDatePicker
                                            label={form.rental_type === 'hourly' ? 'დასრულების თარიღი' : 'ბოლო თარიღი'}
                                            value={form.end_date}
                                            onChange={val => set('end_date', val)}
                                        />

                                        {form.rental_type === 'hourly' && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[11px] font-black text-muted mb-2 block tracking-wider opacity-60">დაწყ. საათი</label>
                                                    <SearchSelect 
                                                        options={timeOptions}
                                                        value={form.start_time ?? ''}
                                                        onChange={val => set('start_time', val)}
                                                        placeholder="09:00"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-black text-muted mb-2 block tracking-wider opacity-60">დამთ. საათი</label>
                                                    <SearchSelect 
                                                        options={timeOptions}
                                                        value={form.end_time ?? ''}
                                                        onChange={val => set('end_time', val)}
                                                        placeholder="10:30"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Prices */}
                                    <div className="border-t border-border-subtle/50 pt-6 grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[11px] font-black text-muted mb-2 block tracking-wider opacity-60">ჯამური ფასი ({settings.currency}) *</label>
                                            <input type="number" min="0" value={form.total_price || ''}
                                                onChange={e => set('total_price', Number(e.target.value))}
                                                className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-2xl px-4 py-3.5 text-sm font-black text-primary outline-none shadow-inner" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-black text-muted mb-2 block tracking-wider opacity-60">დეპოზიტი ({settings.currency})</label>
                                            <input type="number" min="0" value={form.deposit || ''}
                                                onChange={e => set('deposit', Number(e.target.value))}
                                                className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-2xl px-4 py-3.5 text-sm font-black text-primary outline-none shadow-inner" />
                                        </div>
                                    </div>

                                    {/* Payment status */}
                                    <div className="border-t border-border-subtle/50 pt-6">
                                        <label className="text-[11px] font-black text-muted mb-3 block tracking-wider opacity-60">გადახდის სტატუსი</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['pending', 'partial', 'paid', 'cancelled'] as PaymentStatus[]).map(ps => {
                                                const info = PAY_STATUS_INFO[ps];
                                                return (
                                                    <button key={ps} onClick={() => set('payment_status', ps)}
                                                        className={cn('py-3.5 rounded-2xl text-[10px] font-black tracking-widest border transition-all flex items-center justify-center gap-2',
                                                            form.payment_status === ps ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-[1.02]' : 'bg-surface border-border-subtle text-muted hover:border-indigo-500/40')}>
                                                        <div className={cn('w-4 h-4 flex-shrink-0', form.payment_status === ps ? 'text-white' : 'text-indigo-500 opacity-60')}>
                                                            {info.icon}
                                                        </div>
                                                        {info.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="border-t border-border-subtle/50 pt-6">
                                        <label className="text-[11px] font-black text-muted mb-2 block tracking-wider opacity-60">{t.notes}</label>
                                        <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)}
                                            rows={3} placeholder="დამატებითი ინფო..."
                                            className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-2xl px-4 py-3.5 text-sm font-bold text-primary placeholder:text-muted/30 outline-none resize-none shadow-inner" />
                                    </div>

                                    {/* Contract upload */}
                                    <div className="border-t border-border-subtle/50 pt-6">
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="text-[11px] font-black text-muted tracking-wider opacity-60">კონტრაქტი / საბუთი</label>
                                            {(form as { contract_url?: string }).contract_url && (
                                                <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">ატვირთულია</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = 'application/pdf,image/*';
                                                input.onchange = (e: Event) => {
                                                    const target = e.target as HTMLInputElement;
                                                    const file = target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (ev) => set('contract_url', ev.target?.result as string);
                                                        reader.readAsDataURL(file);
                                                    }
                                                };
                                                input.click();
                                            }}
                                            className="w-full py-4 bg-surface border-2 border-dashed border-border-subtle hover:border-indigo-500/40 text-xs font-bold text-muted hover:text-indigo-600 rounded-2xl transition-all shadow-inner flex items-center justify-center gap-2 group-inner"
                                        >
                                            <FileText className="w-4 h-4 opacity-40 group-inner-hover:scale-110 transition-transform" />
                                            {(form as { contract_url?: string }).contract_url ? 'საბუთის შეცვლა' : 'კონტრაქტის ატვირთვა (PDF/JPG)'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 px-8 py-6 border-t border-border-subtle flex-shrink-0 bg-card/50">
                            {step === 2 && (
                                <button onClick={() => setStep(1)} className="px-6 py-4 bg-surface border border-border-subtle text-muted text-xs font-black tracking-widest rounded-2xl hover:bg-surface/80 transition-all active:scale-95">
                                    უკან
                                </button>
                            )}
                            <button onClick={saveRental}
                                disabled={step === 2 && (!form.renter_name || !form.renter_phone || !form.start_date || !form.total_price)}
                                className="flex-1 py-4 bg-[#6d28d9] hover:bg-[#5b21b6] disabled:opacity-40 text-white text-sm font-black tracking-[0.15em] rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-violet-600/30 transition-all active:scale-[0.98]">
                                {step === 1 ? 'გაგრძელება →' : 'შენახვა'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
