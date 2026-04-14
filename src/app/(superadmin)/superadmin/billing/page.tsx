import { useState, useEffect } from 'react';
import { TrendingUp, CreditCard, Users, ShoppingBag } from 'lucide-react';
import { getStudioRegistry, loadSettings } from '@/lib/settings-store';
import { cn } from '@/lib/utils';
import { syncGlobalAdminRegistry } from '@/lib/admin-sync';

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

const PLAN_COLORS: Record<string, string> = { 
    trial: 'text-muted bg-surface border border-border-subtle', 
    basic: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20', 
    enterprise: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20' 
};
const PLATFORM_PRICES: Record<string, number> = { trial: 0, basic: 49, enterprise: 0 };

export default function BillingPage() {
    const [mounted, setMounted] = useState(false);
    const [records, setRecords] = useState<BillingRecord[]>([]);
    const [lang, setLang] = useState<'ka' | 'en'>('ka');
    useEffect(() => { 
        setMounted(true);
        const init = async () => {
            const data = await syncGlobalAdminRegistry();
            const mapped: BillingRecord[] = data.map((s: any) => ({
                slug: s.slug,
                name: s.name,
                logoUrl: s.logoUrl,
                plan: s.plan,
                studentCount: s.studentCount,
                activeSubsCount: s.activeSubsCount || 0,
                subsRevenue: s.revenue || 0, // Using consolidated revenue for now
                shopRevenue: 0, // Split reporting removed for true global simplicity
                totalRevenue: s.revenue || 0,
                currency: s.currency || 'GEL'
            }));
            setRecords(mapped); 
            const storedLang = localStorage.getItem('cc_sa_lang') as 'ka' | 'en';
            if (storedLang) setLang(storedLang);
        };
        init();
    }, []);

    const totalStudents = records.reduce((s, r) => s + r.studentCount, 0);
    const totalShopRev = records.reduce((s, r) => s + r.shopRevenue, 0);
    const totalSubsRev = records.reduce((s, r) => s + r.subsRevenue, 0);
    const platformMRR = records.reduce((s, r) => s + (PLATFORM_PRICES[r.plan] || 0), 0);
    const planCounts = records.reduce((acc, r) => { acc[r.plan] = (acc[r.plan] || 0) + 1; return acc; }, {} as Record<string, number>);
    const curr = (r: BillingRecord) => r.currency === 'GEL' ? '₾' : r.currency === 'USD' ? '$' : '€';

    if (!mounted) return null;

    return (
        <div className="space-y-6 animate-fade-up">
            <div><h1 className="text-2xl font-black text-primary tracking-tight">{lang === 'ka' ? 'გლობალური ფინანსები' : 'Global Billing'}</h1><p className="text-sm text-muted mt-1">{lang === 'ka' ? 'შემოსავლების მიმოხილვა ყველა სტუდიაში' : 'Revenue overview across all studios'}</p></div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: lang === 'ka' ? 'პლატფორმის MRR' : 'Platform MRR', value: `${platformMRR} ₾`, icon: CreditCard, color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', sub: lang === 'ka' ? 'ყოველთვიური განმეორებადი' : 'Monthly recurring' },
                    { label: lang === 'ka' ? 'ჯამური მოსწავლეები' : 'Total Students', value: totalStudents, icon: Users, color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', sub: lang === 'ka' ? 'ყველა სტუდია' : 'All studios' },
                    { label: lang === 'ka' ? 'აბონიმენტების შემოსავალი' : 'Subs Revenue', value: `${totalSubsRev.toLocaleString()} ₾`, icon: TrendingUp, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', sub: lang === 'ka' ? 'შემოსავალი აბონიმენტებიდან' : 'Subscription income' },
                    { label: lang === 'ka' ? 'მაღაზიის შემოსავალი' : 'Shop Revenue', value: `${totalShopRev.toLocaleString()} ₾`, icon: ShoppingBag, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', sub: lang === 'ka' ? 'გაყიდვები მაღაზიიდან' : 'Product sales' },
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
                            {plan === 'trial' ? 'ტრიალი' : plan === 'pro' ? 'პრო' : 'სპეციალური'}
                        </span>
                        <p className="text-2xl font-black text-[#1e293b] dark:text-white mt-3 tabular-nums">{planCounts[plan] || 0}</p>
                        <p className="text-[10px] text-muted mt-0.5 uppercase tracking-widest font-black opacity-40">{lang === 'ka' ? 'სტუდია' : 'studios'}</p>
                        <p className="text-xs font-black text-muted mt-1 opacity-60">{`${(planCounts[plan] || 0) * (plan === 'pro' ? 49 : 0)} ₾/${lang === 'ka' ? 'თვე' : 'mo'}`}</p>
                    </div>
                ))}
            </div>
            <div className="bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-black/5 dark:border-border-subtle bg-black/[0.02] dark:bg-muted/5"><h2 className="text-sm font-black text-[#1e293b] dark:text-white uppercase tracking-wider">{lang === 'ka' ? 'შემოსავალი სტუდიების მიხედვით' : 'Per-Studio Revenue'}</h2></div>
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-3 border-b border-black/5 dark:border-border-subtle/50 text-[10px] font-black text-muted uppercase tracking-widest opacity-40">
                    <span>{lang === 'ka' ? 'სტუდია' : 'Studio'}</span><span className="text-center">{lang === 'ka' ? 'გეგმა' : 'Plan'}</span><span className="text-center">{lang === 'ka' ? 'აბონ' : 'Subs'}</span><span className="text-right">{lang === 'ka' ? 'აბონ. შემოს.' : 'Subs Rev.'}</span><span className="text-right">{lang === 'ka' ? 'მაღაზიის შემოს.' : 'Shop Rev.'}</span>
                </div>
                {records.length === 0 ? (<div className="py-12 text-center text-muted"><p className="text-sm font-bold opacity-20">{lang === 'ka' ? 'მონაცემები არ არის' : 'No data yet'}</p></div>) : (
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
                                        {r.plan === 'trial' ? 'ტრიალი' : r.plan === 'pro' ? 'პრო' : 'სპეციალური'}
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
        </div>
    );
}
