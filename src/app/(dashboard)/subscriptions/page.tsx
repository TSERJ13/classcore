'use client';

import { useState } from 'react';
import {
    Plus, Users, User, Check, Pencil, Trash2, Zap, Clock,
    CreditCard, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

type PlanType = 'group' | 'individual';
type Period = 'sessions' | 'monthly' | 'unlimited';

interface Plan {
    id: string;
    name: string;
    type: PlanType;
    period: Period;
    session_count?: number;
    validity_days?: number;
    price: number;
    coach?: string;
    is_active: boolean;
}

const INITIAL_PLANS: Plan[] = [
    { id: '1', name: '4 გაკვეთილი', type: 'group', period: 'sessions', session_count: 4, validity_days: 30, price: 80, is_active: true },
    { id: '2', name: '8 გაკვეთილი', type: 'group', period: 'sessions', session_count: 8, validity_days: 45, price: 150, is_active: true },
    { id: '3', name: '12 გაკვეთილი', type: 'group', period: 'sessions', session_count: 12, validity_days: 60, price: 200, is_active: true },
    { id: '4', name: 'ყოველთვიური (შეუზღუდავი)', type: 'group', period: 'unlimited', validity_days: 30, price: 180, is_active: true },
    { id: '5', name: '1 ინდ. გაკვეთილი', type: 'individual', period: 'sessions', session_count: 1, price: 50, coach: 'ნინო ბერიძე', is_active: true },
    { id: '6', name: '5 ინდ. გაკვეთილი', type: 'individual', period: 'sessions', session_count: 5, validity_days: 60, price: 230, coach: 'ნინო ბერიძე', is_active: true },
    { id: '7', name: '10 ინდ. გაკვეთილი', type: 'individual', period: 'sessions', session_count: 10, validity_days: 90, price: 420, coach: 'გიორგი კ.', is_active: false },
];

const EMPTY_PLAN: Omit<Plan, 'id'> = {
    name: '', type: 'group', period: 'sessions', session_count: 8, validity_days: 30, price: 0, is_active: true,
};

const PERIODS: { value: Period; label: string }[] = [
    { value: 'sessions', label: 'სესიები' },
    { value: 'monthly', label: 'ყოველთვიური' },
    { value: 'unlimited', label: 'შეუზღუდავი' },
];

export default function SubscriptionsPage() {
    const { t } = useT();
    const [plans, setPlans] = useState<Plan[]>(INITIAL_PLANS);
    const [tab, setTab] = useState<PlanType>('group');
    const [showForm, setShowForm] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [form, setForm] = useState(EMPTY_PLAN);

    const filtered = plans.filter(p => p.type === tab);

    function openAdd() {
        setEditingPlan(null);
        setForm({ ...EMPTY_PLAN, type: tab });
        setShowForm(true);
    }

    function openEdit(p: Plan) {
        setEditingPlan(p);
        setForm({ name: p.name, type: p.type, period: p.period, session_count: p.session_count, validity_days: p.validity_days, price: p.price, coach: p.coach, is_active: p.is_active });
        setShowForm(true);
    }

    function savePlan() {
        if (!form.name || !form.price) return;
        if (editingPlan) {
            setPlans(prev => prev.map(p => p.id === editingPlan.id ? { ...p, ...form } : p));
        } else {
            setPlans(prev => [...prev, { ...form, id: String(Date.now()) }]);
        }
        setShowForm(false);
    }

    function deletePlan(id: string) {
        setPlans(prev => prev.filter(p => p.id !== id));
    }

    function toggleActive(id: string) {
        setPlans(prev => prev.map(p => p.id === id ? { ...p, is_active: !p.is_active } : p));
    }

    return (
        <div className="space-y-6 animate-fade-up max-w-3xl">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-primary">{t.subscriptions}</h1>
                    <p className="text-sm text-muted">{plans.filter(p => p.is_active).length} {t.active.toLowerCase()}</p>
                </div>
                <button onClick={openAdd}
                    className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.97] touch-manipulation">
                    <Plus className="w-3.5 h-3.5" />
                    {t.add}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {([['group', t.groupClass, Users], ['individual', t.individualClass, User]] as const).map(([v, lbl, Icon]) => (
                    <button key={v} onClick={() => setTab(v)}
                        className={cn(
                            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all touch-manipulation',
                            tab === v ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'bg-surface border border-border-subtle text-muted hover:text-primary'
                        )}>
                        <Icon className="w-4 h-4" />
                        {lbl}
                        <span className={cn(
                            'px-1.5 py-0.5 rounded-md text-[10px] font-bold',
                            tab === v ? 'bg-white/20 text-white' : 'bg-surface border border-border-subtle text-muted/60'
                        )}>
                            {plans.filter(p => p.type === v).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Plan cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filtered.map(plan => (
                    <div key={plan.id}
                        className={cn(
                            'group bg-card border rounded-2xl p-5 transition-all duration-200 relative',
                            plan.is_active ? 'border-border-subtle hover:border-border-subtle/20 shadow-sm' : 'border-border-subtle/40 opacity-50'
                        )}>
                        {/* Top row */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                                    plan.type === 'group' ? 'bg-indigo-500/15 border border-indigo-500/25' : 'bg-violet-500/15 border border-violet-500/25'
                                )}>
                                    {plan.type === 'group'
                                        ? <Users className="w-5 h-5 text-indigo-400" />
                                        : <User className="w-5 h-5 text-violet-400" />}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-primary">{plan.name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        {plan.period === 'sessions' && plan.session_count && (
                                            <span className="text-[10px] text-muted">{plan.session_count} სესია</span>
                                        )}
                                        {plan.period === 'unlimited' && (
                                            <span className="flex items-center gap-1 text-[10px] text-emerald-400/70"><Zap className="w-2.5 h-2.5" />შეუზღუდავი</span>
                                        )}
                                        {plan.period === 'monthly' && (
                                            <span className="flex items-center gap-1 text-[10px] text-blue-500/70"><Clock className="w-2.5 h-2.5" />თვიური</span>
                                        )}
                                        {plan.validity_days && <span className="text-[10px] text-muted/40">· {plan.validity_days} დღე</span>}
                                    </div>
                                </div>
                            </div>
                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(plan)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface text-muted/40 hover:text-primary transition-colors">
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => deletePlan(plan.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-muted/40 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Price */}
                        <div className="flex items-end justify-between">
                            <p className="text-2xl font-bold text-primary tabular-nums">
                                {plan.price} <span className="text-sm font-medium text-muted">₾</span>
                            </p>
                            <button onClick={() => toggleActive(plan.id)}
                                className={cn(
                                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all',
                                    plan.is_active
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-white/[0.05] text-white/30 border border-white/[0.07]'
                                )}>
                                {plan.is_active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                                {plan.is_active ? t.active : t.inactive}
                            </button>
                        </div>

                        {/* Coach tag */}
                        {plan.coach && (
                            <p className="mt-2 text-[10px] text-muted">ტრენერი: {plan.coach}</p>
                        )}
                    </div>
                ))}

                {/* Add card */}
                <button onClick={openAdd}
                    className="border-2 border-dashed border-border-subtle hover:border-indigo-500/40 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-muted/40 hover:text-indigo-500 transition-all min-h-[140px] group touch-manipulation">
                    <div className="w-10 h-10 rounded-xl bg-surface group-hover:bg-indigo-500/10 border border-border-subtle flex items-center justify-center transition-all">
                        <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium">{t.add}</span>
                </button>
            </div>

            {/* ─── Plan Form Modal ─────────────────────────────── */}
            {showForm && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="bg-card border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
                                <h3 className="text-base font-bold text-primary">{editingPlan ? t.edit : t.add}</h3>
                                <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface text-muted transition-colors">
                                    <span className="text-lg">×</span>
                                </button>
                            </div>

                            <div className="px-6 py-5 space-y-4">
                                {/* Type */}
                                <div className="grid grid-cols-2 gap-2">
                                    {(['group', 'individual'] as const).map(tp => (
                                        <button key={tp} onClick={() => setForm(p => ({ ...p, type: tp }))}
                                            className={cn('py-2.5 rounded-xl text-xs font-semibold border transition-all',
                                                form.type === tp ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600' : 'border-border-subtle text-muted')}>
                                            {tp === 'group' ? `👥 ${t.groupClass}` : `👤 ${t.individualClass}`}
                                        </button>
                                    ))}
                                </div>

                                {/* Name */}
                                <div>
                                    <label className="text-xs text-muted mb-1.5 block">სახელი *</label>
                                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                        placeholder="მაგ: 12 გაკვეთილი"
                                        className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/30 outline-none" />
                                </div>

                                {/* Period */}
                                <div>
                                    <label className="text-xs text-muted mb-1.5 block">ტიპი</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {PERIODS.map(p => (
                                            <button key={p.value} onClick={() => setForm(f => ({ ...f, period: p.value }))}
                                                className={cn('py-2 rounded-xl text-xs font-medium border transition-all',
                                                    form.period === p.value ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600' : 'border-border-subtle text-muted')}>
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {/* Session count */}
                                    {form.period === 'sessions' && (
                                        <div>
                                            <label className="text-xs text-muted mb-1.5 block">სესიები</label>
                                            <input type="number" value={form.session_count ?? ''} min={1}
                                                onChange={e => setForm(p => ({ ...p, session_count: Number(e.target.value) }))}
                                                className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary outline-none" />
                                        </div>
                                    )}
                                    {/* Validity */}
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">ვალიდობა (დღე)</label>
                                        <input type="number" value={form.validity_days ?? ''} min={1}
                                            onChange={e => setForm(p => ({ ...p, validity_days: Number(e.target.value) }))}
                                            className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary outline-none" />
                                    </div>
                                    {/* Price */}
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">ფასი (₾) *</label>
                                        <input type="number" value={form.price || ''} min={0}
                                            onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))}
                                            className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary outline-none" />
                                    </div>
                                </div>

                                {/* Coach */}
                                {form.type === 'individual' && (
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">ტრენერი</label>
                                        <input value={form.coach ?? ''} onChange={e => setForm(p => ({ ...p, coach: e.target.value }))}
                                            placeholder="ტრენერის სახელი"
                                            className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/30 outline-none" />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 px-6 pb-5">
                                <button onClick={() => setShowForm(false)}
                                    className="flex-1 py-3 border border-border-subtle text-muted text-sm font-medium rounded-xl hover:bg-surface transition-colors">
                                    {t.cancel}
                                </button>
                                <button onClick={savePlan} disabled={!form.name || !form.price}
                                    className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                                    <Check className="w-4 h-4" />
                                    {t.save}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                    { label: t.totalStudents, value: '142', icon: Users, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
                    { label: t.activeSubscriptions, value: plans.filter(p => p.is_active).length.toString(), icon: CreditCard, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                    { label: t.individualClass, value: '23', icon: User, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
                ].map(s => (
                    <div key={s.label} className={`border rounded-2xl p-4 flex items-center gap-3 bg-card border-border-subtle shadow-sm`}>
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${s.color}`}>
                            <s.icon className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-primary tabular-nums">{s.value}</p>
                            <p className="text-[10px] text-muted">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
