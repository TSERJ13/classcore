'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, CreditCard, Users, ShoppingBag } from 'lucide-react';
import { getStudioRegistry, loadSettings } from '@/lib/settings-store';
import { cn } from '@/lib/utils';

interface BillingRecord { slug: string; name: string; logoUrl: string | null; plan: string; studentCount: number; activeSubsCount: number; subsRevenue: number; shopRevenue: number; totalRevenue: number; currency: string; }

function loadBilling(): BillingRecord[] {
    return getStudioRegistry().map(slug => {
        const s = loadSettings(slug);
        const meta = (() => { try { return JSON.parse(localStorage.getItem(`cc_sa_meta_${slug}`) || '{}'); } catch { return {}; } })();
        let studentCount = 0; try { const raw = localStorage.getItem(`cc_student_data_${slug}`) || localStorage.getItem('cc_student_data'); if (raw) studentCount = Object.keys(JSON.parse(raw)).length; } catch { }
        let activeSubsCount = 0, subsRevenue = 0;
        try { const raw = localStorage.getItem(`cc_student_subscriptions_${slug}`) || localStorage.getItem('cc_student_subscriptions'); if (raw) Object.values(JSON.parse(raw)).forEach((subs: unknown) => { if (!Array.isArray(subs)) return; subs.forEach((sub: { status?: string; amount_paid?: number }) => { if (sub.status === 'active') { activeSubsCount++; subsRevenue += sub.amount_paid || 0; } }); }); } catch { }
        let shopRevenue = 0; try { const raw = localStorage.getItem(`cc_shop_sales_${slug}`) || localStorage.getItem('cc_shop_sales'); if (raw) JSON.parse(raw).forEach((sale: { total_amount?: number }) => { shopRevenue += sale.total_amount || 0; }); } catch { }
        return { slug, name: s.studioName, logoUrl: s.logoDataUrl, plan: meta.plan || 'trial', studentCount, activeSubsCount, subsRevenue, shopRevenue, totalRevenue: subsRevenue + shopRevenue, currency: s.currency || 'GEL' };
    });
}

const PLAN_COLORS: Record<string, string> = { trial: 'text-zinc-400 bg-zinc-800', basic: 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20', enterprise: 'text-amber-400 bg-amber-500/10 border border-amber-500/20' };
const PLATFORM_PRICES: Record<string, number> = { trial: 0, basic: 49, enterprise: 0 };

export default function BillingPage() {
    const [records, setRecords] = useState<BillingRecord[]>([]);
    useEffect(() => { setRecords(loadBilling()); }, []);

    const totalStudents = records.reduce((s, r) => s + r.studentCount, 0);
    const totalShopRev = records.reduce((s, r) => s + r.shopRevenue, 0);
    const totalSubsRev = records.reduce((s, r) => s + r.subsRevenue, 0);
    const platformMRR = records.reduce((s, r) => s + (PLATFORM_PRICES[r.plan] || 0), 0);
    const planCounts = records.reduce((acc, r) => { acc[r.plan] = (acc[r.plan] || 0) + 1; return acc; }, {} as Record<string, number>);
    const curr = (r: BillingRecord) => r.currency === 'GEL' ? '₾' : r.currency === 'USD' ? '$' : '€';

    return (
        <div className="space-y-6 animate-fade-up">
            <div><h1 className="text-2xl font-black text-white tracking-tight">Global Billing</h1><p className="text-sm text-zinc-500 mt-1">Revenue overview across all studios</p></div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Platform MRR', value: `$${platformMRR}`, icon: CreditCard, color: 'bg-indigo-500/10 text-indigo-400', sub: 'Monthly recurring' },
                    { label: 'Total Students', value: totalStudents, icon: Users, color: 'bg-violet-500/10 text-violet-400', sub: 'All studios' },
                    { label: 'Subs Revenue', value: `${totalSubsRev.toLocaleString()} ₾`, icon: TrendingUp, color: 'bg-emerald-500/10 text-emerald-400', sub: 'Subscription income' },
                    { label: 'Shop Revenue', value: `${totalShopRev.toLocaleString()} ₾`, icon: ShoppingBag, color: 'bg-amber-500/10 text-amber-400', sub: 'Product sales' },
                ].map(card => (
                    <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', card.color)}><card.icon className="w-5 h-5" /></div>
                        <p className="text-xl font-black text-white">{card.value}</p>
                        <p className="text-xs text-zinc-500 mt-0.5 font-bold">{card.label}</p>
                        <p className="text-[10px] text-zinc-700 mt-0.5">{card.sub}</p>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
                {['trial', 'basic', 'enterprise'].map(plan => (
                    <div key={plan} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
                        <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider', PLAN_COLORS[plan])}>{plan.replace('_', ' ')}</span>
                        <p className="text-2xl font-black text-white mt-3">{planCounts[plan] || 0}</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">studios</p>
                        <p className="text-xs font-black text-zinc-500 mt-1">{`${(planCounts[plan] || 0) * PLATFORM_PRICES[plan]} ₾/mo`}</p>
                    </div>
                ))}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800"><h2 className="text-sm font-black text-white uppercase tracking-wider">Per-Studio Revenue</h2></div>
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 border-b border-zinc-800/50 text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                    <span>Studio</span><span className="text-center">Plan</span><span className="text-center">Subs</span><span className="text-right">Subs Rev.</span><span className="text-right">Shop Rev.</span>
                </div>
                {records.length === 0 ? (<div className="py-12 text-center text-zinc-600"><p className="text-sm font-bold">No data yet</p></div>) : (
                    <div className="divide-y divide-zinc-800/30">
                        {[...records].sort((a, b) => b.totalRevenue - a.totalRevenue).map(r => (
                            <div key={r.slug} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 items-center px-6 py-4 hover:bg-zinc-800/20 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 flex items-center justify-center">
                                        {r.logoUrl ? <img src={r.logoUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] font-black text-zinc-400">{r.name.slice(0, 2).toUpperCase()}</span>}
                                    </div>
                                    <div className="min-w-0"><p className="text-xs font-black text-white truncate">{r.name}</p><p className="text-[10px] text-zinc-600 font-mono">/{r.slug}</p></div>
                                </div>
                                <div className="text-center"><span className={cn('px-2 py-0.5 rounded-full text-[9px] font-black uppercase', PLAN_COLORS[r.plan])}>{r.plan.replace('_', ' ')}</span></div>
                                <div className="text-center"><span className="text-sm font-black text-white">{r.activeSubsCount}</span></div>
                                <div className="text-right"><span className="text-sm font-black text-emerald-400">{r.subsRevenue.toLocaleString()} {curr(r)}</span></div>
                                <div className="text-right"><span className="text-sm font-black text-amber-400">{r.shopRevenue.toLocaleString()} {curr(r)}</span></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
