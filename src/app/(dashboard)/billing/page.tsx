'use client';

import { useState } from 'react';
import { Zap, Check, Shield, CreditCard, Calendar, AlertTriangle, ExternalLink, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';

type Period = 'monthly' | 'annual';

const GATEWAYS = [
    { id: 'flitt', name: 'Flitt', logo: '💳', desc: 'TBC-ის შვილობილი · ყოველთვიური გადახდა' },
    { id: 'tbc', name: 'TBC Pay', logo: '🏦', desc: 'TBC Bank · ბარათით' },
    { id: 'bog', name: 'BOG Pay', logo: '🏛️', desc: 'საქართველოს ბანკი · ბარათით' },
];

export default function BillingPage() {
    const { t } = useT();
    const [period, setPeriod] = useState<Period>('monthly');
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [selectedGateway, setSelectedGateway] = useState<string>('flitt');
    const [step, setStep] = useState<'plans' | 'pay'>('plans');

    const PLANS = [
        {
            id: 'starter', name: 'Starter', monthly: 49, annual: 399, annualPerMonth: 33, highlight: false,
            features: [t.billingF150, t.billingFSubs, t.billingFAtt, t.billingFApp, '1 ' + t.billingFAdmin],
            cta: t.billingSelectStarter,
        },
        {
            id: 'growth', name: 'Growth', monthly: 99, annual: 799, annualPerMonth: 67, highlight: true,
            features: [t.billingFUnlim, t.billingFRental, t.billingFPortal, t.billingFReports, '3 ' + t.billingFAdmin, 'API access'],
            cta: t.billingSelectGrowth,
        },
        {
            id: 'enterprise', name: 'Enterprise', monthly: 0, annual: 0, annualPerMonth: 0, highlight: false,
            features: [t.billingFEverything, 'Custom domain', 'SLA 99.9%', 'Dedicated support', 'Custom integrations'],
            cta: t.billingContact,
        },
    ];
    const daysLeft = 5;

    return (
        <div className="max-w-5xl mx-auto space-y-10 animate-fade-up pb-20">
            {/* Trial warning banner */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-5 shadow-xl shadow-amber-500/5">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 animate-pulse">
                    <AlertTriangle className="w-7 h-7 text-amber-600" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                    <p className="text-base font-black text-amber-700 uppercase tracking-tight">{daysLeft} {t.billingTrialDays}</p>
                    <p className="text-sm text-amber-700/60 font-medium mt-1">{t.billingTrialWarn}</p>
                </div>
                <div className="text-4xl font-black text-amber-600 tabular-nums flex-shrink-0 opacity-40">{daysLeft}</div>
            </div>

            {/* Header */}
            <div className="text-center space-y-3">
                <h1 className="text-4xl font-black text-primary tracking-tight leading-tight">{t.billingHeading}</h1>
                <p className="text-muted text-base font-medium opacity-60 max-w-lg mx-auto">{t.billingSubheading}</p>

                {/* Period toggle */}
                <div className="inline-flex items-center mt-8 bg-surface border border-border-subtle rounded-2xl p-1.5 shadow-inner">
                    {(['monthly', 'annual'] as const).map(p => (
                        <button key={p} onClick={() => setPeriod(p)}
                            className={cn(
                                'px-6 py-2.5 rounded-xl text-xs font-black transition-all uppercase tracking-widest',
                                period === p ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 scale-105' : 'text-muted hover:text-primary'
                            )}>
                            {p === 'monthly' ? t.billingMonthly : t.billingAnnual}
                            {p === 'annual' && <span className="ml-2 bg-emerald-500/20 text-emerald-700 px-2 py-0.5 rounded-lg text-[10px] uppercase">-33%</span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PLANS.map(plan => (
                    <div key={plan.id}
                        className={cn(
                            'relative rounded-[2.5rem] p-8 border transition-all flex flex-col',
                            plan.highlight
                                ? 'bg-card border-indigo-500/30 shadow-2xl shadow-indigo-500/10 scale-105 z-10'
                                : 'bg-card border-border-subtle hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/5',
                            selectedPlan === plan.id && !plan.highlight && 'ring-2 ring-indigo-500/50'
                        )}
                        onClick={() => setSelectedPlan(plan.id)}
                    >
                        {plan.highlight && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-xl uppercase tracking-widest animate-bounce">
                                ⭐ პოპულარული
                            </div>
                        )}

                        <div className="mb-8">
                            <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-3">{plan.name}</p>
                            {plan.monthly === 0 ? (
                                <p className="text-4xl font-black text-primary tracking-tight">Custom</p>
                            ) : (
                                <div className="flex items-baseline gap-1">
                                    <span className="text-5xl font-black text-primary tabular-nums tracking-tighter">
                                        {period === 'monthly' ? plan.monthly : plan.annualPerMonth}
                                    </span>
                                    <span className="text-muted text-lg font-black opacity-30">₾</span>
                                    <span className="text-muted text-xs font-bold ml-1 opacity-50 uppercase tracking-widest">/ {t.billingPerMonth}</span>
                                </div>
                            )}
                            {period === 'annual' && plan.monthly > 0 && (
                                <p className="text-[11px] font-black text-emerald-600 mt-2 uppercase tracking-wide">
                                    {plan.annual} ₾ / წელიწადში
                                </p>
                            )}
                        </div>

                        <ul className="space-y-4 mb-10 flex-1">
                            {plan.features.map(f => (
                                <li key={f} className="flex items-start gap-3 text-sm font-bold text-primary/70 leading-snug">
                                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Check className="w-3 h-3 text-emerald-600" strokeWidth={4} />
                                    </div>
                                    {f}
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={e => { e.stopPropagation(); setSelectedPlan(plan.id); setStep('pay'); }}
                            className={cn(
                                'w-full py-4 rounded-2xl text-xs font-black transition-all uppercase tracking-widest active:scale-[0.97]',
                                plan.id === 'enterprise'
                                    ? 'bg-surface border border-border-subtle text-muted hover:border-indigo-500/40 hover:text-primary'
                                    : plan.highlight
                                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/30'
                                        : 'bg-surface text-primary/80 hover:bg-surface/80 border border-border-subtle'
                            )}>
                            {plan.cta}
                        </button>
                    </div>
                ))}
            </div>

            {/* Payment method */}
            {step === 'pay' && selectedPlan && (
                <div className="bg-card border border-border-subtle rounded-[2.5rem] p-10 space-y-8 shadow-2xl shadow-black/5 animate-in slide-in-from-bottom duration-500 max-w-2xl mx-auto">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                            <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-primary tracking-tight">{t.billingPayMethod}</h2>
                            <p className="text-xs font-bold text-muted opacity-60">აირჩიეთ გადახდის არხი გაგრძელებისთვის</p>
                        </div>
                    </div>

                    <div className="grid gap-3">
                        {GATEWAYS.map(gw => (
                            <label key={gw.id}
                                className={cn(
                                    'flex items-center gap-5 p-5 rounded-3xl border cursor-pointer transition-all',
                                    selectedGateway === gw.id
                                        ? 'bg-indigo-500/5 border-indigo-500/40 shadow-xl shadow-indigo-500/5'
                                        : 'bg-surface/30 border-border-subtle hover:bg-surface/60'
                                )}>
                                <input type="radio" name="gateway" value={gw.id} checked={selectedGateway === gw.id}
                                    onChange={() => setSelectedGateway(gw.id)} className="sr-only" />
                                <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">{gw.logo}</span>
                                <div className="flex-1">
                                    <p className="text-base font-black text-primary">{gw.name}</p>
                                    <p className="text-[11px] font-bold text-muted opacity-60">{gw.desc}</p>
                                </div>
                                <div className={cn(
                                    'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                                    selectedGateway === gw.id ? 'border-indigo-600 bg-indigo-600' : 'border-border-subtle'
                                )}>
                                    {selectedGateway === gw.id && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                                </div>
                            </label>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 border-t border-border-subtle">
                        <div className="flex items-center gap-3 text-[11px] font-bold text-muted opacity-50 uppercase tracking-wider">
                            <Shield className="w-4 h-4 text-emerald-500" />
                            <span>{t.billingSecure}</span>
                        </div>
                        <button className="w-full sm:w-auto px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-2xl transition-all shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-3 active:scale-95 group">
                            {t.billingProceed}
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            )}

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 pt-10 border-t border-border-subtle/50">
                {[
                    { lbl: '15-დღიანი ტესტირება', icon: '✅' },
                    { lbl: 'SSL დაცული გადახდა', icon: '🔒' },
                    { lbl: 'Bank of Georgia · TBC Bank', icon: '🇬🇪' },
                    { lbl: 'მონაცემები დაცულია', icon: '🛡️' },
                    { lbl: 'გაუქმება ნებისმიერ დროს', icon: '↩️' }
                ].map(b => (
                    <div key={b.lbl} className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-widest opacity-40">
                        <span>{b.icon}</span>
                        <span>{b.lbl}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
