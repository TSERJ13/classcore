'use client';

import { useState, useMemo, useEffect } from 'react';
import { Check, Shield, CreditCard, AlertTriangle, ArrowRight, Tag } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';
import { useStudio } from '@/contexts/StudioContext';
import { getBillingState, SAAS_PRICE_GEL, recordPayment } from '@/lib/saas-billing';
import { logAction } from '@/lib/analytics';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

type Period = '1' | '3' | '6' | '12';

const PERIOD_DISCOUNTS: Record<Period, { desc: string; off: number; text: string }> = {
    '1': { desc: '1 თვე', off: 0, text: '49 ₾' },
    '3': { desc: '3 თვე', off: 0.10, text: '-10%' },
    '6': { desc: '6 თვე', off: 0.15, text: '-15%' },
    '12': { desc: '12 თვე', off: 0.20, text: '-20%' },
};

export default function BillingPage() {
    const { t, lang } = useT();
    const { settings } = useStudio();
    const [period, setPeriod] = useState<Period>('1');
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [selectedGateway, setSelectedGateway] = useState<string>('card');
    const [step, setStep] = useState<'plans' | 'pay'>('plans');
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handlePlanClick = (id: string, months: number) => {
        setSelectedPlan(id);
        logAction('plan_click', settings.studioSlug || 'unknown', { planId: id, months });
    };
    const [promoCode, setPromoCode] = useState('');
    const [promoDiscount, setPromoDiscount] = useState(0);
    const [promoError, setPromoError] = useState('');

    const billing = useMemo(() =>
        settings.studioSlug ? getBillingState(settings.studioSlug) : null
        , [settings.studioSlug]);

    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    const METHODS = [
        { id: 'card', name: l('საბანკო ბარათი', 'Банковская карта', 'Credit Card'), logo: '💳', desc: l('მყისიერი აქტივაცია', 'Мгновенная активация', 'Instant activation') },
        { id: 'transfer', name: l('საბანკო გადარიცხვა', 'Банковский перевод', 'Bank Transfer'), logo: '🏦', desc: l('საჭიროებს კაბინეტის კოდს', 'Требует код кабинета', 'Requires Cabinet Code') },
    ];



    const PLANS = [
        {
            id: 'basic', name: 'Premium', highlight: true,
            features: [
                l('ულიმიტო ადმინისტრატორები', 'Безлимитные администраторы', 'Unlimited Administrators'),
                l('მოსწავლის პორტალი (QR & განრიგი)', 'Портал ученика (QR и Расписание)', 'Student Portal (QR & Schedule)'),
                l('ავტომატური SMS შეტყობინებები', 'Автоматические SMS уведомления', 'Automated SMS Notifications'),
                l('ფინანსური აღრიცხვა & POS', 'Финансовый учет и POS', 'Financial Accounting & POS'),
                l('დასწრების ონლაინ კონტროლი', 'Онлайн контроль посещаемости', 'Online Attendance Control'),
                l('ანალიტიკა და რეპორტინგი', 'Аналитика и репорты', 'Analytics & Reporting'),
                l('API ინტეგრაციის მხარდაჭერა', 'Поддержка API интеграции', 'API Integration Support'),
                l('ულიმიტო სტუმრები და ჯგუფები', 'Безлимитные студенты и группы', 'Unlimited Students & Groups')
            ],
            cta: l('გამოწერა', 'Подписаться', 'Subscribe Now'),
        }
    ];

    const currentPeriodMonths = parseInt(period);
    const periodDiscount = PERIOD_DISCOUNTS[period].off;
    const baseMonthlyPrice = 49;

    let displayMonthly = baseMonthlyPrice;
    let totalDiscountPrice = baseMonthlyPrice;

    if (currentPeriodMonths > 1) {
        displayMonthly = Math.round(baseMonthlyPrice * (1 - periodDiscount));
        totalDiscountPrice = displayMonthly * currentPeriodMonths;
    }

    // Apply promo discount if any
    if (promoDiscount > 0) {
        totalDiscountPrice = Math.round(totalDiscountPrice * (1 - promoDiscount));
    }

    const daysLeft = billing?.daysLeftInTrial || 0;

    const handleApplyPromo = () => {
        setPromoError('');
        const code = promoCode.toUpperCase().trim();
        if (code === 'START20') {
            setPromoDiscount(0.20);
            logAction('promo_code_attempt', settings.studioSlug || 'unknown', { code, success: true });
        } else if (code === 'SAVE10') {
            setPromoDiscount(0.10);
            logAction('promo_code_attempt', settings.studioSlug || 'unknown', { code, success: true });
        } else {
            setPromoError(l('არასწორი პრომო კოდი', 'Неверный промокод', 'Invalid promo code'));
            setPromoDiscount(0);
            logAction('promo_code_attempt', settings.studioSlug || 'unknown', { code, success: false });
        }
    };

    const handleProceed = () => {
        if (!settings.studioSlug) return;
        recordPayment(settings.studioSlug, selectedGateway as any, totalDiscountPrice, currentPeriodMonths);
        alert(l('მადლობა! გადახდა მიღებულია.', 'Спасибо! Платеж приняტ.', 'Thank you! Payment received.'));
        window.location.reload();
    };

    return (
        <PermissionGuard adminOnly={true}>
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-up pb-20">
            {/* Quick overview cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-6 pb-2">
                <div className="bg-card border border-border-subtle rounded-3xl p-3 sm:p-6 flex flex-col sm:flex-row items-center sm:items-center justify-between shadow-sm text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 flex-shrink-0">
                            <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[8px] sm:text-[10px] font-black text-muted tracking-widest leading-none mb-1 opacity-40">{l('კაბინეტის კოდი', 'Код кабинета', 'Cabinet Code')}</p>
                            <p className="text-sm sm:text-2xl font-black text-primary tracking-widest truncate">{settings.cabinetCode || '------'}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border-subtle rounded-3xl p-3 sm:p-6 flex flex-col sm:flex-row items-center sm:items-center justify-between shadow-sm text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 flex-shrink-0">
                            <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[8px] sm:text-[10px] font-black text-muted tracking-widest leading-none mb-1 opacity-40">{t.balance || l('ბალანსი', 'Баланс', 'Balance')}</p>
                            <p className="text-sm sm:text-2xl font-black text-[#1e293b] dark:text-white tracking-tight truncate">
                                {isMounted ? formatCurrency(billing?.accountBalance || 0, settings.currency) : '...'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Trial warning banner */}
            {isMounted && billing?.plan === 'trial' && billing?.status === 'trial' && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-3 sm:p-6 flex items-center gap-3 sm:gap-5 shadow-xl shadow-amber-500/5">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 animate-pulse">
                        <AlertTriangle className="w-5 h-5 sm:w-7 sm:h-7 text-amber-600" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                        <p className="text-sm sm:text-base font-black text-amber-700 tracking-tight truncate">{daysLeft} {t.billingTrialDays}</p>
                        <p className="text-[10px] sm:text-sm text-amber-700/60 font-medium mt-0.5 line-clamp-1">{t.billingTrialWarn}</p>
                    </div>
                    <div className="text-2xl sm:text-4xl font-black text-amber-600 tabular-nums flex-shrink-0 opacity-40">{daysLeft}</div>
                </div>
            )}

            {/* Header */}
            <div className="text-center space-y-3">
                <h1 className="text-4xl font-black text-primary tracking-tight leading-tight">{t.billingHeading}</h1>
                <p className="text-muted text-base font-medium opacity-60 max-w-lg mx-auto">{t.billingSubheading}</p>

                {/* Period toggle */}
                <div className="flex flex-nowrap justify-center gap-1 sm:gap-2 mt-8 bg-surface border border-border-subtle rounded-2xl p-1.5 sm:p-2 shadow-inner max-w-lg mx-auto overflow-hidden">
                    {(Object.keys(PERIOD_DISCOUNTS) as Period[]).map(p => (
                        <button key={p} onClick={() => setPeriod(p)}
                            className={cn(
                                'flex-1 min-w-0 px-1 sm:px-4 py-2 sm:py-3 rounded-xl text-[10px] sm:text-xs font-black transition-all tracking-tight sm:tracking-widest flex flex-col items-center gap-0.5 sm:gap-1',
                                period === p ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 scale-[1.02]' : 'bg-surface hover:bg-surface-hover text-muted hover:text-primary border border-transparent'
                            )}>
                            <span className="whitespace-nowrap">{PERIOD_DISCOUNTS[p].desc}</span>
                            <span className={cn(
                                "text-[8px] sm:text-[10px] px-1 sm:px-2 py-0.5 rounded-lg whitespace-nowrap",
                                period === p ? "bg-white/20 text-white" : "bg-emerald-500/10 text-emerald-600"
                            )}>
                                {PERIOD_DISCOUNTS[p].text}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Plan cards */}
            <div className="flex justify-center">
                {PLANS.map(plan => (
                    <div key={plan.id}
                        className={cn(
                            'relative rounded-[2.5rem] p-10 border transition-all flex flex-col w-full max-w-md',
                            plan.highlight
                                ? 'bg-card border-indigo-500/30 shadow-2xl shadow-indigo-500/10 scale-105 z-10'
                                : 'bg-card border-border-subtle hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/5',
                            selectedPlan === plan.id && !plan.highlight && 'ring-2 ring-indigo-500/50'
                        )}
                        onClick={() => setSelectedPlan(plan.id)}
                    >
                        {plan.highlight && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-xl tracking-widest animate-bounce">
                                ⭐ {t.billingPopular}
                            </div>
                        )}

                        <div className="mb-8 text-center flex flex-col items-center">
                            <p className="text-xs font-black text-indigo-600 tracking-[0.2em] mb-3">{plan.name}</p>

                            <div className="flex items-baseline justify-center gap-1">
                                <span className="text-6xl font-black text-primary tabular-nums tracking-tighter">
                                    {formatCurrency(displayMonthly, settings.currency)}
                                </span>
                                <span className="text-muted text-xs font-bold ml-1 opacity-50 tracking-widest">/ {t.billingPerMonth}</span>
                            </div>

                            {currentPeriodMonths > 1 && (
                                <p className="text-[12px] font-black text-emerald-600 mt-3 tracking-wide bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                                    {l('სულ გადასახდელი: ', 'Итого: ', 'Total Due: ')} {formatCurrency(totalDiscountPrice, settings.currency)}
                                </p>
                            )}
                        </div>

                        <ul className="space-y-4 mb-10 flex-1">
                            {plan.features.map(f => (
                                <li key={f} className="flex items-center justify-center gap-3 text-sm font-bold text-primary/70 leading-snug">
                                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Check className="w-3 h-3 text-emerald-600" strokeWidth={4} />
                                    </div>
                                    {f}
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={e => { e.stopPropagation(); handlePlanClick(plan.id, currentPeriodMonths); setStep('pay'); }}
                            className={cn(
                                'w-full py-4 rounded-2xl text-xs font-black transition-all tracking-widest active:scale-[0.97]',
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
                    {/* Promo Code Section — MOVED UP */}
                    <div className="bg-surface/50 border border-border-subtle rounded-3xl p-6 space-y-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 border border-indigo-500/20">
                                <Tag className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-primary tracking-tight">{l('პრომო კოდი', 'Промокод', 'Promo Code')}</p>
                                <p className="text-[10px] font-bold text-muted opacity-60 tracking-widest">{l('გაქვთ ფასდაკლების კოდი?', 'Есть промокод?', 'Have a discount code?')}</p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 relative">
                            <input
                                type="text"
                                placeholder={l('შეიყვანეთ კოდი', 'Введите код', 'Enter code')}
                                value={promoCode}
                                onChange={e => setPromoCode(e.target.value)}
                                className={cn(
                                    "w-full sm:flex-1 bg-card border rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all tracking-widest",
                                    promoError ? "border-red-500/50 text-red-500 bg-red-500/[0.02]" : "border-border-subtle focus:border-indigo-500/40",
                                    promoDiscount > 0 && "border-emerald-500/50 text-emerald-600 bg-emerald-500/[0.02]"
                                )}
                            />
                            <button
                                onClick={handleApplyPromo}
                                className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[11px] font-black tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                            >
                                {l('გააქტიურება', 'Активировать', 'Apply')}
                            </button>
                        </div>
                        {promoError && <p className="text-[10px] font-black text-red-500 px-1 animate-shake">{promoError}</p>}
                        {promoDiscount > 0 && <p className="text-[10px] font-black text-emerald-600 px-1 tracking-widest flex items-center gap-1.5 animate-bounce-subtle">✨ {l('ფასდაკლება აქტიურია', 'Скидка активна', 'Discount applied')} (-{promoDiscount * 100}%)</p>}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                                <CreditCard className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-primary tracking-tight">{t.billingPayMethod}</h2>
                                <p className="text-xs font-bold text-muted opacity-60">{t.billingChooseChannel}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3">
                        {METHODS.map(gw => (
                            <div key={gw.id} className="space-y-2">
                                <label className={cn(
                                    'flex items-center gap-5 p-5 rounded-3xl border cursor-pointer transition-all hover:bg-surface/60',
                                    selectedGateway === gw.id
                                        ? 'bg-indigo-500/5 border-indigo-500/40 shadow-xl shadow-indigo-500/5'
                                        : 'bg-surface/30 border-border-subtle'
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

                                {selectedGateway === gw.id && (gw.id === 'cash' || gw.id === 'transfer') && (
                                    <div className="pl-16 pr-4 pb-2 animate-in slide-in-from-top-2 duration-300">
                                        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex flex-col gap-2 relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50 rounded-l-2xl" />
                                            <p className="text-[11px] font-bold text-amber-600/80 tracking-widest leading-relaxed">
                                                {l(
                                                    'ᲛᲜᲘᲨᲕᲜᲔᲚᲝᲕᲐᲜᲘᲐ: ᲒᲐᲓᲐᲮᲓᲘᲡ/ᲒᲐᲓᲐᲠᲘᲪᲮᲕᲘᲡ ᲓᲐᲜᲘᲨᲜᲣᲚᲔᲑᲐᲨᲘ ᲐᲣᲪᲘᲚᲔᲑᲚᲐᲓ ᲛᲘᲣᲗᲘᲗᲔᲗ ᲗᲥᲕᲔᲜᲘ ᲙᲐᲑᲘᲜᲔᲢᲘᲡ ᲙᲝᲓᲘ: ',
                                                    'ВАЖНО: В НАЗНАЧЕНИИ ПЛАТЕЖА/ПЕРЕВОДА ОБЯЗАТЕЛЬНО УКАЖИТЕ ВАШ КОД КАБИНЕТА: ',
                                                    'IMPORTANT: IN THE PAYMENT/TRANSFER REFERENCE, YOU MUST INCLUDE YOUR CABINET CODE: '
                                                )}
                                            </p>
                                            <p className="text-xl font-black text-amber-600 tracking-[0.2em]">{settings.cabinetCode}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 border-t border-border-subtle">
                        <div className="flex items-center gap-3 text-[11px] font-bold text-muted opacity-50 tracking-wider">
                            <Shield className="w-4 h-4 text-emerald-500" />
                            <span>{t.billingSecure}</span>
                        </div>
                        <button
                            onClick={handleProceed}
                            className="w-full sm:w-auto px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black rounded-2xl transition-all shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-3 active:scale-95 group">
                            {t.billingProceed}
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            )}

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 pt-10 border-t border-border-subtle/50">
                {[
                    { lbl: t.billingTrial15, icon: '✅' },
                    { lbl: t.billingSSL, icon: '🔒' },
                    { lbl: t.billingBanks, icon: '🇬🇪' },
                    { lbl: t.billingDataProtected, icon: '🛡️' },
                    { lbl: t.billingCancelAnytime, icon: '↩️' }
                ].map(b => (
                    <div key={b.lbl} className="flex items-center gap-2 text-[10px] font-black text-muted tracking-widest opacity-40">
                        <span>{b.icon}</span>
                        <span>{b.lbl}</span>
                    </div>
                ))}
            </div>
            </div>
        </PermissionGuard>
    );
}
