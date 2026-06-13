'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { TrendingUp, CreditCard, Users, ShoppingBag } from 'lucide-react';
import { getStudioRegistry, loadSettings } from '@/lib/settings-store';
import { cn } from '@/lib/utils';
import { syncGlobalAdminRegistry } from '@/lib/admin-sync';
import { PLATFORM_PLAN_PRICES, platformPrice } from '@/lib/saas-billing';

interface BillingRecord { slug: string; name: string; logoUrl: string | null; plan: string; studentCount: number; activeSubsCount: number; subsRevenue: number; shopRevenue: number; totalRevenue: number; currency: string; }

const PLAN_COLORS: Record<string, string> = { 
    trial: 'text-muted bg-surface border border-border-subtle', 
    basic: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-blue-500/20', 
    enterprise: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20' 
};
const PLATFORM_PRICES: Record<string, number> = PLATFORM_PLAN_PRICES;

export default function BillingPage() {
    const { lang: saLang, t } = useT();
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<BillingRecord[]>([]);

    useEffect(() => { 
        setMounted(true);
        const init = async () => {
            setLoading(true);
            try {
                // DATABASE-FIRST: Always fetch from cloud
                const data = await syncGlobalAdminRegistry();
                if (data && Array.isArray(data)) {
                    const mapped: BillingRecord[] = data.map((s: any) => ({
                        slug: s.slug,
                        name: s.name,
                        logoUrl: s.logoUrl,
                        plan: s.plan || 'trial',
                        studentCount: s.studentCount || 0,
                        activeSubsCount: s.activeSubsCount || 0,
                        subsRevenue: s.subsRevenue ?? s.revenue ?? 0,
                        shopRevenue: s.shopRevenue ?? 0,
                        totalRevenue: s.revenue ?? 0,
                        currency: s.currency || 'GEL'
                    }));
                    setRecords(mapped); 
                }
            } catch (err) {
                console.error('Failed to sync billing data:', err);
                setRecords([]);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const totalStudents = records.reduce((s, r) => s + (r.studentCount || 0), 0);
    const totalShopRev = records.reduce((s, r) => s + (r.shopRevenue || 0), 0);
    const totalSubsRev = records.reduce((s, r) => s + (r.subsRevenue || 0), 0);
    const platformMRR = records.reduce((s, r) => s + (PLATFORM_PRICES[r.plan] || 0), 0);
    const planCounts = records.reduce((acc, r) => { acc[r.plan] = (acc[r.plan] || 0) + 1; return acc; }, {} as Record<string, number>);
    const curr = (r: BillingRecord) => r.currency === 'GEL' ? '₾' : r.currency === 'USD' ? '$' : '€';

    if (!mounted) return null;

    return (
        <div className="space-y-6 animate-fade-up">
            <div>
                <h1 className="text-2xl font-black text-primary tracking-tight">{t.sa_billing_title}</h1>
                <p className="text-sm text-muted mt-1">{t.sa_billing_desc}</p>
            </div>

            {loading ? (
                <div className="py-24 flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t.sa_billing_syncing}</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: t.sa_billing_platformMRR, value: `${platformMRR} ₾`, icon: CreditCard, color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', sub: t.sa_billing_mrrDesc },
                            { label: t.students, value: totalStudents, icon: Users, color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', sub: t.sa_billing_totalStudentsSub },
                            { label: t.sa_billing_subsRevenue, value: `${totalSubsRev.toLocaleString()} ₾`, icon: TrendingUp, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', sub: t.sa_billing_subsRevDesc },
                            { label: t.sa_billing_shopRevenue, value: `${totalShopRev.toLocaleString()} ₾`, icon: ShoppingBag, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', sub: t.sa_billing_shopRevDesc },
                        ].map(card => (
                            <div key={card.label} className="bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-2xl p-5 shadow-sm">
                                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', card.color)}><card.icon className="w-5 h-5" /></div>
                                <p className="text-xl font-black text-[#1e293b] dark:text-white tabular-nums">{card.value}</p>
                                <p className="text-xs text-muted mt-0.5 font-bold">{card.label}</p>
                                <p className="text-[10px] text-muted opacity-60 mt-0.5">{card.sub}</p>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {['trial', 'pro', 'custom'].map(plan => (
                            <div key={plan} className="bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-2xl p-4 text-center shadow-sm">
                                <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider', plan === 'trial' ? 'bg-zinc-500/10 text-zinc-500' : plan === 'pro' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-amber-500/10 text-amber-500')}>
                                    {plan === 'trial' ? t.sa_billing_trialLabel : plan === 'pro' ? t.sa_billing_proLabel : t.sa_billing_customLabel}
                                </span>
                                <p className="text-2xl font-black text-[#1e293b] dark:text-white mt-3 tabular-nums">{planCounts[plan] || 0}</p>
                                <p className="text-[10px] text-muted mt-0.5 uppercase tracking-widest font-black opacity-40">{t.sa_studios_studiosLabel}</p>
                                <p className="text-xs font-black text-muted mt-1 opacity-60">{`${(planCounts[plan] || 0) * platformPrice(plan)} ₾/${t.sa_billing_monthShort}`}</p>
                            </div>
                        ))}
                    </div>
                    <div className="bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-black/5 dark:border-border-subtle bg-black/[0.02] dark:bg-muted/5"><h2 className="text-sm font-black text-[#1e293b] dark:text-white uppercase tracking-wider">{t.sa_billing_perStudioRev}</h2></div>
                        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 border-b border-black/5 dark:border-border-subtle/50 text-[10px] font-black text-muted uppercase tracking-widest opacity-40">
                            <span>{t.sa_studios_studioLabel}</span><span className="text-center">{t.sa_studios_planLabel}</span><span className="text-center">{t.sa_billing_subsRevShort}</span><span className="text-right">{t.sa_billing_subsRevShort}</span><span className="text-right">{t.sa_billing_shopRevShort}</span>
                        </div>
                        {records.length === 0 ? (<div className="py-12 text-center text-muted"><p className="text-sm font-bold opacity-20">{t.noDataYet}</p></div>) : (
                            <div className="divide-y divide-border-subtle/30">
                                {[...records].sort((a, b) => b.totalRevenue - a.totalRevenue).map(r => (
                                    <div key={r.slug} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 items-center px-6 py-4 hover:bg-muted/5 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-surface border border-border-subtle flex items-center justify-center">
                                                {r.logoUrl ? <img src={r.logoUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-black text-muted opacity-40">{r.name.slice(0, 2).toUpperCase()}</span>}
                                            </div>
                                            <div className="min-w-0"><p className="text-xs font-black text-primary truncate">{r.name}</p><p className="text-[10px] text-muted opacity-40 font-mono">/{r.slug}</p></div>
                                        </div>
                                        <div className="text-center">
                                            <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-black uppercase', r.plan === 'trial' ? 'bg-zinc-500/10 text-zinc-500' : r.plan === 'pro' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-amber-500/10 text-amber-500')}>
                                                {r.plan === 'trial' ? t.sa_billing_trialLabel : r.plan === 'pro' ? t.sa_billing_proLabel : t.sa_billing_customLabel}
                                            </span>
                                        </div>
                                        <div className="text-center"><span className="text-sm font-black text-primary tabular-nums">{r.activeSubsCount}</span></div>
                                        <div className="text-right"><span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{r.subsRevenue.toLocaleString()} {curr(r)}</span></div>
                                        <div className="text-right"><span className="text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">{r.shopRevenue.toLocaleString()} {curr(r)}</span></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
