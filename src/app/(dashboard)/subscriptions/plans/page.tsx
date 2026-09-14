'use client';

import { useState, useEffect } from 'react';
import {
    ToggleLeft, ToggleRight, ArrowLeft, Plus, Users, User, Zap, Pencil, Trash2, Check, Home, FolderPlus, Star, Ticket, Minus, Snowflake, Umbrella
} from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/contexts/LanguageContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { THEMES, type ThemeKey, ensureUniqueName, ensureUniqueSlug, saveSettings, isFeatureEnabled } from '@/lib/settings-store';
import { cn, formatCurrency } from '@/lib/utils';
import { StandardDatePicker } from '@/components/ui/StandardDatePicker';
import { useStudio } from '@/contexts/StudioContext';
import { getPlans, savePlans, deletePlan as deletePlanInStore, type Plan, type RentalPeriod } from '@/lib/plan-store';
import { getGroups, type Group } from '@/lib/group-store';

type PlanType = 'group' | 'personal' | 'individual' | 'rental';
type Period = 'sessions' | 'monthly' | 'unlimited';





const EMPTY_PLAN: Omit<Plan, 'id'> = {
    name: '', type: 'group', period: 'sessions', session_count: 8, validity_days: 30, price: 0, is_active: true,
};

const PERIODS: { value: Period; label: any }[] = [
    { value: 'sessions', label: (t: any) => t.sessionsShort },
    { value: 'monthly', label: (t: any) => t.monthlyShortLabel },
    { value: 'unlimited', label: (t: any) => t.unlimitedShortLabel },
];

// Static Tailwind classes per tariff type — kept literal (not templated) so the JIT compiler picks them up.
const TYPE_META: Record<PlanType, { Icon: any; iconWrap: string; iconColor: string; typeBtn: string }> = {
    group: { Icon: Users, iconWrap: 'bg-indigo-500/15 border border-indigo-500/25', iconColor: 'text-indigo-400', typeBtn: 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400' },
    personal: { Icon: Ticket, iconWrap: 'bg-emerald-500/15 border border-emerald-500/25', iconColor: 'text-emerald-400', typeBtn: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' },
    individual: { Icon: User, iconWrap: 'bg-violet-500/15 border border-violet-500/25', iconColor: 'text-violet-400', typeBtn: 'bg-violet-500/10 border-violet-500/40 text-violet-400' },
    rental: { Icon: Home, iconWrap: 'bg-amber-500/15 border border-amber-500/25', iconColor: 'text-amber-400', typeBtn: 'bg-amber-500/10 border-amber-500/40 text-amber-400' },
};

export default function PlansManagementPage() {
    const { t } = useT();
    const { settings, updateSettings } = useStudio();
    const confirm = useConfirm();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [tab, setTab] = useState<PlanType>('group');

    useEffect(() => {
        const load = () => {
            setPlans(getPlans());
            setGroups(getGroups());
        };
        load();
        window.addEventListener('cc_subscription_plans_update', load);
        return () => window.removeEventListener('cc_subscription_plans_update', load);
    }, []);

    const [showForm, setShowForm] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [form, setForm] = useState(EMPTY_PLAN);
    const [localPausePrices, setLocalPausePrices] = useState<{ '7': number; '14': number; '30': number; '60': number }>({ '7': 0, '14': 0, '30': 0, '60': 0 });
    const [savingPause, setSavingPause] = useState(false);
    const [savedPause, setSavedPause] = useState(false);
    const [savingPlan, setSavingPlan] = useState(false);
    const [localVacation, setLocalVacation] = useState<{ active: boolean; startDate: string; endDate: string }>({ active: false, startDate: '', endDate: '' });
    const [savingVacation, setSavingVacation] = useState(false);
    const [savedVacation, setSavedVacation] = useState(false);

    useEffect(() => {
        if (settings.pausePrices) {
            setLocalPausePrices(settings.pausePrices);
        }
        if (settings.vacationMode) {
            setLocalVacation(settings.vacationMode);
        }
    }, [settings.pausePrices, settings.vacationMode]);

    const filtered = plans.filter(p => p.type === tab);

    function openAdd() {
        setEditingPlan(null);
        const defaults: Partial<Plan> =
            tab === 'group' ? { period: 'monthly' } :
            tab === 'personal' ? { period: 'sessions' } :
            tab === 'rental' ? { rental_period: 'hourly' as RentalPeriod } : {};
        setForm({ ...EMPTY_PLAN, type: tab, freeze_options: [], ...defaults });
        setShowForm(true);
    }

    function openEdit(p: Plan) {
        setEditingPlan(p);
        setForm({
            name: p.name,
            type: p.type,
            period: p.period,
            session_count: p.session_count,
            validity_days: p.validity_days,
            price: p.price,
            coach: p.coach,
            group_id: p.group_id,
            is_active: p.is_active,
            teacher_id: p.teacher_id,
            rental_period: p.rental_period,
            freeze_options: p.freeze_options || [],
            payment_window: p.payment_window,
        });
        setShowForm(true);
    }

    const teacherRequiredMissing = form.type === 'individual' && !form.teacher_id;

    async function savePlan() {
        if (!form.name || !form.price || teacherRequiredMissing) return;
        setSavingPlan(true);
        try {
            let next: Plan[];
            if (editingPlan) {
                next = plans.map(p => p.id === editingPlan.id ? { ...p, ...form } : p);
            } else {
                next = [...plans, { ...form, id: String(Date.now()) } as Plan];
            }
            setPlans(next);
            await savePlans(next);
            setShowForm(false);
        } finally {
            setSavingPlan(false);
        }
    }

    async function deletePlan(id: string) {
        if (!await confirm(t.deleteConfirm)) return;
        await deletePlanInStore(id);
        // The UI will refresh via the cc_subscription_plans_update event listener already in place
    }

    function toggleActive(id: string) {
        const next = plans.map(p => {
            if (p.id !== id) return p;
            const newActive = !p.is_active;
            const updated = { ...p, is_active: newActive };
            if (updated.data && typeof updated.data === 'object') {
                updated.data = { ...updated.data, is_active: newActive };
            }
            return updated;
        });
        setPlans(next);
        savePlans(next);
    }

    // Mark plan as default — only ONE plan can be default per type at a time
    function toggleDefault(id: string) {
        const target = plans.find(p => p.id === id);
        if (!target) return;
        const willBeDefault = !target.is_default;
        const next = plans.map(p => {
            if (p.type !== target.type) return p;
            const isDef = willBeDefault ? p.id === id : false;
            const updated = { ...p, is_default: isDef };
            if (updated.data && typeof updated.data === 'object') {
                updated.data = { ...updated.data, is_default: isDef };
            }
            return updated;
        });
        setPlans(next);
        savePlans(next);
    }

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-10">
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
                {([['group', t.monthlyShortLabel, Users], ['personal', t.personalClass, Ticket], ['individual', t.individualClass, User], ['rental', t.rental, Home]] as const)
                    .filter(([v]) => v !== 'personal' || isFeatureEnabled(settings, 'personalPlans'))
                    .filter(([v]) => v !== 'individual' || isFeatureEnabled(settings, 'individualLessons'))
                    .filter(([v]) => v !== 'rental' || isFeatureEnabled(settings, 'hallRental'))
                    .map(([v, lbl, Icon]) => (
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
                                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', TYPE_META[plan.type].iconWrap)}>
                                    {(() => { const { Icon } = TYPE_META[plan.type]; return <Icon className={cn('w-5 h-5', TYPE_META[plan.type].iconColor)} />; })()}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-sm font-bold text-primary truncate">{plan.name}</p>
                                        {plan.is_default && (
                                            <span className="flex items-center gap-0.5 text-[8px] font-black tracking-widest bg-amber-500/15 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded-md uppercase flex-shrink-0">
                                                <Star className="w-2 h-2 fill-amber-500" />
                                                {t.defaultPlan}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        {plan.period === 'sessions' && plan.session_count && <span className="text-[10px] text-muted">{plan.session_count} {t.visits}</span>}
                                        {plan.period === 'unlimited' && <span className="flex items-center gap-1 text-[10px] text-emerald-400/70"><Zap className="w-2.5 h-2.5" />{t.notAccounted}</span>}
                                        {plan.validity_days && <span className="text-[10px] text-muted/40">· {plan.validity_days} {t.day}</span>}
                                        {plan.type === 'individual' && plan.teacher_id && (
                                            <span className="text-[10px] text-muted/60">· {(settings.staff || []).find(s => s.id === plan.teacher_id)?.first_name || ''}</span>
                                        )}
                                        {plan.type === 'rental' && plan.rental_period && (
                                            <span className="text-[10px] text-muted/60">· {plan.rental_period === 'hourly' ? t.hourly : t.monthlyShortLabel}</span>
                                        )}
                                        {plan.freeze_options && plan.freeze_options.length > 0 && (
                                            <span className="flex items-center gap-0.5 text-[10px] text-sky-400/70"><Snowflake className="w-2.5 h-2.5" />{plan.freeze_options.length}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className={cn("flex items-center gap-1 transition-opacity", plan.is_default ? "opacity-100" : "sm:opacity-0 sm:group-hover:opacity-100")}>
                                <button onClick={() => toggleDefault(plan.id)}
                                    title={plan.is_default ? t.removeDefault : t.setAsDefault}
                                    className={cn(
                                        "w-7 h-7 flex items-center justify-center rounded-lg transition-colors",
                                        plan.is_default
                                            ? "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
                                            : "hover:bg-surface text-muted/40 hover:text-amber-500"
                                    )}>
                                    <Star className={cn("w-3.5 h-3.5", plan.is_default && "fill-amber-500")} />
                                </button>
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
                    <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setShowForm(false)} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="bg-card border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
                                <h3 className="text-base font-bold text-primary">{editingPlan ? t.edit : t.add} {t.subscription}</h3>
                                <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface text-muted transition-colors">×</button>
                            </div>

                            <div className="px-6 py-5 space-y-4">
                                <div className="grid grid-cols-4 gap-2">
                                    {(['group', 'personal', 'individual', 'rental'] as const)
                                        .filter(tp => tp !== 'personal' || isFeatureEnabled(settings, 'personalPlans'))
                                        .filter(tp => tp !== 'individual' || isFeatureEnabled(settings, 'individualLessons'))
                                        .filter(tp => tp !== 'rental' || isFeatureEnabled(settings, 'hallRental'))
                                        .map(tp => (
                                        <button key={tp} onClick={() => setForm(p => ({
                                            ...p, type: tp,
                                            ...(tp === 'group' ? { period: 'monthly' as Period } : {}),
                                            ...(tp === 'personal' && p.type !== 'personal' ? { period: 'sessions' as Period } : {}),
                                            ...(tp === 'rental' ? { rental_period: p.rental_period || 'hourly' as RentalPeriod } : {}),
                                        }))}
                                            className={cn('py-3 rounded-2xl text-[10px] font-black tracking-widest uppercase border transition-all flex flex-col items-center gap-2',
                                                form.type === tp ? TYPE_META[tp].typeBtn : 'border-border-subtle text-muted opacity-40 hover:opacity-100')}>
                                            {(() => { const { Icon } = TYPE_META[tp]; return <Icon className="w-5 h-5" />; })()}
                                            {tp === 'group' ? t.monthlyShortLabel : tp === 'personal' ? t.personalClass : tp === 'individual' ? t.individualClass : t.rental}
                                        </button>
                                    ))}
                                </div>

                                <div>
                                    <label className="text-xs text-muted mb-1.5 block">{t.planName} *</label>
                                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                        className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary outline-none" />
                                </div>

                                {form.type === 'personal' && (
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">{t.typeLabel}</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {PERIODS.filter(p => p.value !== 'monthly').map(p => (
                                                <button key={p.value} onClick={() => setForm(f => ({ ...f, period: p.value }))}
                                                    className={cn('py-2 rounded-xl text-xs font-medium border transition-all',
                                                        form.period === p.value ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500' : 'border-border-subtle text-muted')}>
                                                    {typeof p.label === 'function' ? p.label(t) : p.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {form.type === 'individual' && (
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">{t.calTeacher} *</label>
                                        <select value={form.teacher_id || ''} onChange={e => setForm(p => ({ ...p, teacher_id: e.target.value }))}
                                            className={cn('w-full bg-surface border rounded-xl px-3 py-2.5 text-sm text-primary outline-none',
                                                teacherRequiredMissing ? 'border-red-500/50' : 'border-border-subtle')}>
                                            <option value="">{t.selectTeacher}</option>
                                            {(settings.staff || []).map(s => (
                                                <option key={s.id} value={s.id}>{s.first_name} {s.last_name || ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {form.type === 'rental' && (
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">{t.typeLabel}</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['hourly', 'monthly'] as const).map(rp => (
                                                <button key={rp} onClick={() => setForm(p => ({ ...p, rental_period: rp }))}
                                                    className={cn('py-2 rounded-xl text-xs font-medium border transition-all',
                                                        form.rental_period === rp ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' : 'border-border-subtle text-muted')}>
                                                    {rp === 'hourly' ? t.hourly : t.monthlyShortLabel}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {form.type === 'rental' ? (
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">{t.price} ({settings.currency}) *</label>
                                        <input type="number" value={form.price || ''} onChange={e => {
                                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                                            setForm(p => ({ ...p, price: val }));
                                        }}
                                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-sm outline-none" />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-3">
                                        {form.period === 'sessions' && (
                                            <div>
                                                <label className="text-xs text-muted mb-1.5 block">{t.sessionCountLabel}</label>
                                                <input type="number" value={form.session_count || ''} onChange={e => {
                                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                                    setForm(p => ({ ...p, session_count: val }));
                                                }}
                                                    className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-sm outline-none" />
                                            </div>
                                        )}
                                        <div>
                                            <label className="text-xs text-muted mb-1.5 block">{t.validityDaysInput}</label>
                                            <input type="number" value={form.validity_days || ''} onChange={e => {
                                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                                setForm(p => ({ ...p, validity_days: val }));
                                            }}
                                                className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-sm outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted mb-1.5 block">{t.price} ({settings.currency}) *</label>
                                            <input type="number" value={form.price || ''} onChange={e => {
                                                const val = e.target.value === '' ? 0 : Number(e.target.value);
                                                setForm(p => ({ ...p, price: val }));
                                            }}
                                                className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-sm outline-none" />
                                        </div>
                                    </div>
                                )}

                                {form.type === 'group' && (
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">{t.paymentWindowLabel}</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <input type="number" min="1" max="31" placeholder="1" value={form.payment_window?.startDay ?? ''} onChange={e => {
                                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                                setForm(p => ({ ...p, payment_window: { startDay: val ?? 1, endDay: p.payment_window?.endDay ?? 5 } }));
                                            }}
                                                className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-sm outline-none" />
                                            <input type="number" min="1" max="31" placeholder="5" value={form.payment_window?.endDay ?? ''} onChange={e => {
                                                const val = e.target.value === '' ? undefined : Number(e.target.value);
                                                setForm(p => ({ ...p, payment_window: { startDay: p.payment_window?.startDay ?? 1, endDay: val ?? 5 } }));
                                            }}
                                                className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-sm outline-none" />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs text-muted block flex items-center gap-1"><Snowflake className="w-3 h-3" /> {t.freezeOptionsLabel}</label>
                                        <button onClick={() => setForm(p => ({ ...p, freeze_options: [...(p.freeze_options || []), { days: 7, price: 0 }] }))}
                                            className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400">
                                            {t.addFreezeOption}
                                        </button>
                                    </div>
                                    {(form.freeze_options || []).length > 0 && (
                                        <div className="space-y-2">
                                            {(form.freeze_options || []).map((fo, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <input type="number" min="1" value={fo.days} placeholder={t.days}
                                                        onChange={e => {
                                                            const val = Number(e.target.value) || 0;
                                                            setForm(p => ({ ...p, freeze_options: (p.freeze_options || []).map((x, i) => i === idx ? { ...x, days: val } : x) }));
                                                        }}
                                                        className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2 text-sm outline-none" />
                                                    <input type="number" min="0" value={fo.price} placeholder={t.price}
                                                        onChange={e => {
                                                            const val = Number(e.target.value) || 0;
                                                            setForm(p => ({ ...p, freeze_options: (p.freeze_options || []).map((x, i) => i === idx ? { ...x, price: val } : x) }));
                                                        }}
                                                        className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2 text-sm outline-none" />
                                                    <button onClick={() => setForm(p => ({ ...p, freeze_options: (p.freeze_options || []).filter((_, i) => i !== idx) }))}
                                                        className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-muted/40 hover:text-red-500 transition-colors">
                                                        <Minus className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {(form.type === 'group' || form.type === 'personal') && (
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">{t.group || 'ჯგუფი'}</label>
                                        <select 
                                            value={form.group_id || ''} 
                                            onChange={e => setForm(p => ({ ...p, group_id: e.target.value }))}
                                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-primary outline-none"
                                        >
                                            <option value="">{t.allGroups || 'ყველა ჯგუფი'}</option>
                                            {groups.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 px-6 pb-5">
                                <button onClick={() => setShowForm(false)} className="flex-1 py-3 border border-border-subtle text-muted text-sm font-medium rounded-xl hover:bg-surface">{t.cancel}</button>
                                <button onClick={savePlan} disabled={!form.name || !form.price || savingPlan || teacherRequiredMissing} className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
                                    {savingPlan ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Check className="w-4 h-4" />
                                    )}
                                    {savingPlan ? t.saving : t.save}
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
                        <p className="text-[10px] text-muted/50 mt-1">{t.legacyFreezeNote || 'ეს ნაგულისხმევი ფასებია — ტარიფს, რომელზეც ზემოთ საკუთარი გაყინვის პერიოდები აქვს მითითებული, ისინი აქვს პრიორიტეტი.'}</p>
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
                                        value={localPausePrices[days] || ''}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                                            setLocalPausePrices(prev => ({ ...prev, [days]: val }));
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

                    <div className="mt-8 flex justify-end">
                        <button 
                            onClick={async () => {
                                setSavingPause(true);
                                updateSettings({ pausePrices: localPausePrices });
                                setTimeout(() => {
                                    setSavingPause(false);
                                    setSavedPause(true);
                                    setTimeout(() => setSavedPause(false), 2000);
                                }, 600);
                            }}
                            disabled={savingPause}
                            className={cn(
                                "flex items-center gap-2 px-6 py-2.5 text-[11px] font-black tracking-widest rounded-xl shadow-lg transition-all active:scale-95 uppercase",
                                savedPause 
                                    ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                                    : "bg-[#6d28d9] hover:bg-[#5b21b6] text-white shadow-[#6d28d9]/20"
                            )}
                        >
                            {savingPause ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : savedPause ? (
                                <Check className="w-4 h-4" />
                            ) : (
                                <Check className="w-4 h-4" />
                            )}
                            {savingPause ? t.saving || 'ინახება...' : savedPause ? t.saved || 'შენახულია' : t.saveChanges || 'შენახვა'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Studio Vacation Mode (Subscriptions PRD §13) */}
            <div className="bg-surface border border-border-subtle rounded-2xl overflow-hidden shadow-sm pt-6">
                <div className="px-6 border-b border-border-subtle pb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-primary flex items-center gap-2"><Umbrella className="w-4 h-4 text-sky-500" /> {t.vacationModeLabel}</h2>
                        <p className="text-sm text-muted mt-1">{t.vacationModeDesc}</p>
                    </div>
                    <button onClick={() => setLocalVacation(p => ({ ...p, active: !p.active }))}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest transition-all',
                            localVacation.active ? 'bg-sky-500/10 text-sky-600 border border-sky-500/20' : 'bg-white/[0.05] text-muted/40 border border-border-subtle'
                        )}>
                        {localVacation.active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                        {t.vacationActiveToggle}
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <StandardDatePicker
                            label={t.vacationStartDate}
                            value={localVacation.startDate}
                            onChange={v => setLocalVacation(p => ({ ...p, startDate: v }))}
                        />
                        <StandardDatePicker
                            label={t.vacationEndDate}
                            value={localVacation.endDate}
                            onChange={v => setLocalVacation(p => ({ ...p, endDate: v }))}
                        />
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={async () => {
                                setSavingVacation(true);
                                updateSettings({ vacationMode: localVacation });
                                setTimeout(() => {
                                    setSavingVacation(false);
                                    setSavedVacation(true);
                                    setTimeout(() => setSavedVacation(false), 2000);
                                }, 600);
                            }}
                            disabled={savingVacation || !localVacation.startDate || !localVacation.endDate}
                            className={cn(
                                "flex items-center gap-2 px-6 py-2.5 text-[11px] font-black tracking-widest rounded-xl shadow-lg transition-all active:scale-95 uppercase disabled:opacity-40",
                                savedVacation
                                    ? "bg-emerald-500 text-white shadow-emerald-500/20"
                                    : "bg-[#6d28d9] hover:bg-[#5b21b6] text-white shadow-[#6d28d9]/20"
                            )}
                        >
                            {savingVacation ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Check className="w-4 h-4" />
                            )}
                            {savingVacation ? t.saving || 'ინახება...' : savedVacation ? t.saved || 'შენახულია' : t.saveChanges || 'შენახვა'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Business-type feature toggles (Subscriptions PRD §3) */}
            <div className="bg-surface border border-border-subtle rounded-2xl overflow-hidden shadow-sm pt-6">
                <div className="px-6 border-b border-border-subtle pb-4">
                    <h2 className="text-base font-bold text-primary">{t.featureTogglesLabel}</h2>
                    <p className="text-sm text-muted mt-1">{t.featureTogglesDesc}</p>
                </div>
                <div className="p-6 space-y-3">
                    {([['personalPlans', t.personalClass, Ticket], ['individualLessons', t.individualClass, User], ['hallRental', t.rental, Home]] as const).map(([key, label, Icon]) => {
                        const enabled = isFeatureEnabled(settings, key);
                        return (
                            <div key={key} className="flex items-center justify-between p-3 bg-card border border-border-subtle rounded-xl">
                                <div className="flex items-center gap-2.5">
                                    <Icon className="w-4 h-4 text-muted" />
                                    <span className="text-sm font-semibold text-primary">{label}</span>
                                </div>
                                <button
                                    onClick={() => updateSettings({ enabledFeatures: { ...settings.enabledFeatures, [key]: !enabled } })}
                                    className={cn(
                                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all',
                                        enabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/[0.05] text-white/30 border border-white/[0.07]'
                                    )}>
                                    {enabled ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                                    {enabled ? t.active : t.inactive}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
