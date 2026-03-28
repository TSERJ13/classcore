'use client';

import { useState, useEffect } from 'react';
import {
    ToggleLeft, ToggleRight, ArrowLeft, Plus, Users, User, Zap, Pencil, Trash2, Check, Home, FolderPlus
} from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/contexts/LanguageContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { THEMES, BG_THEMES, type ThemeKey, type BgKey, ensureUniqueName, ensureUniqueSlug, saveSettings } from '@/lib/settings-store';
import { cn, formatCurrency } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';
import { getPlans, savePlans, type Plan } from '@/lib/plan-store';

type PlanType = 'group' | 'individual';
type Period = 'sessions' | 'monthly' | 'unlimited';





const EMPTY_PLAN: Omit<Plan, 'id'> = {
    name: '', type: 'group', period: 'sessions', session_count: 8, validity_days: 30, price: 0, is_active: true,
};

const PERIODS: { value: Period; label: any }[] = [
    { value: 'sessions', label: (t: any) => t.sessionsShort },
    { value: 'monthly', label: (t: any) => t.monthlyShortLabel },
    { value: 'unlimited', label: (t: any) => t.unlimitedShortLabel },
];

export default function PlansManagementPage() {
    const { t } = useT();
    const { settings } = useStudio();
    const confirm = useConfirm();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [tab, setTab] = useState<PlanType>('group');

    useEffect(() => {
        const load = () => setPlans(getPlans());
        load();
        window.addEventListener('cc_subscription_update', load);
        return () => window.removeEventListener('cc_subscription_update', load);
    }, []);

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
        let next: Plan[];
        if (editingPlan) {
            next = plans.map(p => p.id === editingPlan.id ? { ...p, ...form } : p);
        } else {
            next = [...plans, { ...form, id: String(Date.now()) } as Plan];
        }
        setPlans(next);
        savePlans(next);
        setShowForm(false);
    }

    async function deletePlan(id: string) {
        if (!await confirm(t.deleteConfirm)) return;
        const next = plans.filter(p => p.id !== id);
        setPlans(next);
        savePlans(next);
    }

    function toggleActive(id: string) {
        const next = plans.map(p => p.id === id ? { ...p, is_active: !p.is_active } : p);
        setPlans(next);
        savePlans(next);
    }

    return (
        <div className="space-y-8 animate-fade-up max-w-6xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-row items-stretch justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    <Link href="/subscriptions" className="flex items-center justify-center w-12 h-12 bg-surface border border-border-subtle rounded-[1.25rem] text-muted hover:text-primary hover:bg-surface-hover transition-all flex-shrink-0">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="min-w-0 flex flex-col justify-center">
                        <h1 className="text-sm sm:text-xl font-bold text-primary truncate leading-tight">{t.priceManagement || 'ტარიფები'}</h1>
                        <p className="text-[10px] sm:text-sm text-muted truncate">{t.priceManagementDesc || 'აბონემენტების ფასები და მართვა'}</p>
                    </div>
                </div>
                <button onClick={openAdd}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-black text-[10px] sm:text-xs px-3 sm:px-5 h-12 rounded-[1.25rem] tracking-widest shadow-lg shadow-indigo-500/25 transition-all flex-shrink-0">
                    <FolderPlus className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{t.add}</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex w-full h-12 bg-surface border border-border-subtle rounded-[1.25rem] p-1 gap-1">
                {([['group', t.groupClass, Users], ['individual', t.individualClass, User], ['rental', t.rental, Home]] as const).map(([v, lbl, Icon]) => (
                    <button key={v} onClick={() => setTab(v as PlanType)}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-1 sm:px-4 h-full rounded-xl text-[9px] sm:text-xs font-black tracking-widest transition-all truncate',
                            tab === v ? 'bg-indigo-500 text-white shadow-md' : 'text-muted hover:text-primary hover:bg-surface-hover'
                        )}>
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{lbl}</span>
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
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                                    plan.type === 'group' ? 'bg-indigo-500/15 border border-indigo-500/25' :
                                        plan.type === 'individual' ? 'bg-violet-500/15 border border-violet-500/25' :
                                            'bg-amber-500/15 border border-amber-500/25'
                                )}>
                                    {plan.type === 'group' ? <Users className="w-5 h-5 text-indigo-400" /> :
                                        plan.type === 'individual' ? <User className="w-5 h-5 text-violet-400" /> :
                                            <Home className="w-5 h-5 text-amber-400" />}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-primary truncate">{plan.name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        {plan.period === 'sessions' && plan.session_count && <span className="text-[10px] text-muted">{plan.session_count} {t.visits}</span>}
                                        {plan.period === 'unlimited' && <span className="flex items-center gap-1 text-[10px] text-emerald-400/70"><Zap className="w-2.5 h-2.5" />{t.notAccounted}</span>}
                                        {plan.validity_days && <span className="text-[10px] text-muted/40">· {plan.validity_days} {t.day}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(plan)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface text-muted/40 hover:text-primary transition-colors">
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => deletePlan(plan.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-muted/40 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-end justify-between">
                            <p className="text-2xl font-bold text-primary tabular-nums">
                                {formatCurrency(plan.price, settings.currency)}
                            </p>
                            <button onClick={() => toggleActive(plan.id)}
                                className={cn(
                                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all',
                                    plan.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/[0.05] text-white/30 border border-white/[0.07]'
                                )}>
                                {plan.is_active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                                {plan.is_active ? t.active : t.inactive}
                            </button>
                        </div>
                    </div>
                ))}

                <button onClick={openAdd}
                    className="border-2 border-dashed border-border-subtle hover:border-indigo-500/40 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-muted/40 hover:text-indigo-500 transition-all min-h-[140px] group">
                    <div className="w-10 h-10 rounded-xl bg-surface group-hover:bg-indigo-500/10 border border-border-subtle flex items-center justify-center transition-all">
                        <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium">{t.add}</span>
                </button>
            </div>

            {/* Plan Form Modal */}
            {showForm && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="bg-card border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
                                <h3 className="text-base font-bold text-primary">{editingPlan ? t.edit : t.add} {t.subscription}</h3>
                                <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface text-muted transition-colors">×</button>
                            </div>

                            <div className="px-6 py-5 space-y-4">
                                <div className="grid grid-cols-3 gap-2">
                                    {(['group', 'individual', 'rental'] as const).map(tp => (
                                        <button key={tp} onClick={() => setForm(p => ({ ...p, type: tp }))}
                                            className={cn('py-2.5 rounded-xl text-xs font-semibold border transition-all',
                                                form.type === tp ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600' : 'border-border-subtle text-muted')}>
                                            {tp === 'group' ? `👥 ${t.groupClass}` : tp === 'individual' ? `👤 ${t.indSessionShort}` : `🏠 ${t.rental}`}
                                        </button>
                                    ))}
                                </div>

                                <div>
                                    <label className="text-xs text-muted mb-1.5 block">{t.planName} *</label>
                                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                        className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary outline-none" />
                                </div>

                                <div>
                                    <label className="text-xs text-muted mb-1.5 block">{t.typeLabel}</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {PERIODS.map(p => (
                                            <button key={p.value} onClick={() => setForm(f => ({ ...f, period: p.value }))}
                                                className={cn('py-2 rounded-xl text-xs font-medium border transition-all',
                                                    form.period === p.value ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600' : 'border-border-subtle text-muted')}>
                                                {typeof p.label === 'function' ? p.label(t) : p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    {form.period === 'sessions' && (
                                        <div>
                                            <label className="text-xs text-muted mb-1.5 block">{t.sessionCountLabel}</label>
                                            <input type="number" value={form.session_count ?? ''} onChange={e => setForm(p => ({ ...p, session_count: Number(e.target.value) }))}
                                                className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-sm outline-none" />
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">{t.validityDaysInput}</label>
                                        <input type="number" value={form.validity_days ?? ''} onChange={e => setForm(p => ({ ...p, validity_days: Number(e.target.value) }))}
                                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-sm outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">{t.price} ({settings.currency})</label>
                                        <input type="number" value={form.price || ''} onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))}
                                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-sm outline-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 px-6 pb-5">
                                <button onClick={() => setShowForm(false)} className="flex-1 py-3 border border-border-subtle text-muted text-sm font-medium rounded-xl hover:bg-surface">{t.cancel}</button>
                                <button onClick={savePlan} disabled={!form.name || !form.price} className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
                                    <Check className="w-4 h-4" /> {t.save}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Subscription Freeze Settings */}
            <div className="mt-12 bg-surface border border-border-subtle rounded-2xl overflow-hidden shadow-sm pt-6">
                <div className="px-6 border-b border-border-subtle pb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-primary">{t.pauseMgmt || 'შეჩერების მართვა'}</h2>
                        <p className="text-sm text-muted mt-1">{t.pausePricesDesc || 'აბონემენტის გაყინვის ფასების მართვა'}</p>
                    </div>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {(['7', '14', '30', '60'] as const).map(days => (
                            <div key={days} className="space-y-2">
                                <label className="text-xs font-bold text-muted tracking-widest px-1">{days} {t.day}</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        value={settings.pausePrices?.[days] ?? 0}
                                        onChange={(e) => {
                                            const val = Math.max(0, parseInt(e.target.value) || 0);
                                            saveSettings({ pausePrices: { ...settings.pausePrices, [days]: val } });
                                        }}
                                        className="w-full bg-card border border-border-subtle rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-primary transition-colors"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-bold text-sm select-none opacity-40">
                                        {settings.currency === 'GEL' ? '₾' : settings.currency === 'USD' ? '$' : '€'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
