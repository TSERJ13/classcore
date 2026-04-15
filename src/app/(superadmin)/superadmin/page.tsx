'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Users, Building2, CreditCard, MessageSquare,
    TrendingUp, ArrowUpRight, ArrowDownRight,
    Search, Bell, UserPlus, ShieldCheck, ChevronRight,
    AlertTriangle
} from 'lucide-react';
import { getStudioRegistry, loadSettings } from '@/lib/settings-store';
import { getScopedKey } from '@/lib/utils';
import { getBillingState, getPaymentLogs } from '@/lib/saas-billing';
import { cn } from '@/lib/utils';
import { syncGlobalAdminRegistry } from '@/lib/admin-sync';
import Link from 'next/link';
import SupportChat from '@/components/superadmin/SupportChat';
import { useT } from '@/contexts/LanguageContext';

export default function SuperAdminDashboard() {
    const { lang, t } = useT();
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [slugs, setSlugs] = useState<string[]>([]);
    const [stats, setStats] = useState({
        totalStudios: 0, totalStudents: 0, activeSubs: 0,
        totalRevenue: 0, totalSms: 0, mrr: 0
    });
    const [revenueTimeline, setRevenueTimeline] = useState<{name: string, rev: number}[]>([]);
    const [recentEvents, setRecentEvents] = useState<{studio: string, action: string, time: string}[]>([]);

    useEffect(() => {
        setMounted(true);
        const init = async () => {
            setLoading(true);
            try {
                // DATABASE-FIRST: Fetch truth from cloud
                const verified = await syncGlobalAdminRegistry();
                const cloudSlugs = Array.isArray(verified) ? verified.map((s: any) => s.slug) : [];
                setSlugs(cloudSlugs);
            } catch (err) {
                console.error('Failed to sync dashboard:', err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (loading) return;

        let students = 0;
        let activeSubs = 0;
        let totalRev = 0;
        let mrr = 0;
        let totalSms = 0;

        const allPayments: any[] = [];
        const monthTotals: Record<string, number> = {};
        const now = new Date();

        slugs.forEach((slug: string) => {
            // Students
            try {
                const studentDataKey = getScopedKey('cc_student_data', slug);
                const studentData = localStorage.getItem(studentDataKey);
                if (studentData) students += Object.keys(JSON.parse(studentData)).length;
            } catch {}

            // Billing & MRR
            const billing = getBillingState(slug);
            if (billing.status === 'active' || billing.status === 'overdue') {
                activeSubs++;
                mrr += 49;
            }

            // Payments & History
            const payments = getPaymentLogs(slug);
            payments.forEach((p: any) => {
                totalRev += p.amount;
                const d = new Date(p.date);
                const monthKey = d.toLocaleString('default', { month: 'short' });
                monthTotals[monthKey] = (monthTotals[monthKey] || 0) + p.amount;
                allPayments.push({ ...p, studioSlug: slug });
            });
        });

        // Prepare revenue timeline (last 6 months)
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(now.getMonth() - i);
            const m = d.toLocaleString('default', { month: 'short' });
            months.push({ name: m, rev: monthTotals[m] || 0 });
        }
        setRevenueTimeline(months);

        // Recent Events (Last 4 payments/registrations)
        const events = allPayments.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map(p => ({
            studio: loadSettings(p.studioSlug).studioName,
            action: t.sa_manualPayment,
            time: `${Math.floor((now.getTime() - new Date(p.date).getTime()) / (1000 * 60 * 60))}${t.sa_hoursAgo}`
        }));
        if (events.length === 0) {
            events.push({ studio: t.navSectionSystem, action: t.sa_noRecords, time: t.now });
        }
        setRecentEvents(events);

        setStats({
            totalStudios: slugs.filter(s => s !== 'demo.classcore.ge').length,
            totalStudents: students,
            activeSubs,
            totalRevenue: totalRev,
            totalSms: students * 8, // Estimated
            mrr
        });
    }, [slugs, lang, loading]);

    const handleGlobalPurge = async () => {
        if (!confirm(t.sa_purgeWarning)) return;
        
        try {
            const res = await fetch('/api/superadmin/global-purge', {
                method: 'POST',
                body: JSON.stringify({ secret: 'cc-master-purge-2026' }),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                alert(t.sa_systemPurged);
                localStorage.clear();
                window.location.href = '/';
            } else {
                alert(data.error || 'Error during purge');
            }
        } catch (err) {
            alert('Request failed');
        }
    };

    if (!mounted) return null;

    return (
        <div className="space-y-8 animate-fade-in p-1 md:p-4 lg:p-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-primary tracking-tight">
                        {t.sa_systemOverview}
                    </h1>
                    <p className="text-muted text-sm mt-1 font-medium">
                        {t.sa_metricsDesc}
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="py-24 flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t.sa_syncingData}</p>
                </div>
            ) : (
                <>
                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title={t.sa_activeStudios}
                            value={stats.totalStudios}
                            icon={Building2}
                            trend="+12%"
                            color="indigo"
                            lang={lang}
                        />
                        <StatCard
                            title={t.students}
                            value={stats.totalStudents.toLocaleString()}
                            icon={Users}
                            trend="+5.4%"
                            color="emerald"
                            lang={lang}
                        />
                        <StatCard
                            title={t.sa_revenueMRR}
                            value={`${stats.mrr}₾`}
                            icon={CreditCard}
                            trend="+8.2%"
                            color="amber"
                            lang={lang}
                        />
                        <StatCard
                            title={t.sa_smsSentMTD}
                            value={stats.totalSms.toLocaleString()}
                            icon={MessageSquare}
                            trend="+22%"
                            color="blue"
                            lang={lang}
                        />
                    </div>

                    {/* Charts & Activity Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">

                            {/* Overdue & Expiring Studios Lists */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Overdue Studios */}
                                <div className="bg-white/95 dark:bg-white/[0.02] backdrop-blur-xl border border-black/10 dark:border-rose-500/20 rounded-[2.5rem] p-6 space-y-4 shadow-xl shadow-black/5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                                            <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-primary dark:text-white uppercase tracking-wider">{t.sa_overduePayments}</h3>
                                            <p className="text-[10px] text-muted font-bold uppercase tracking-widest">{t.sa_studiosNeedingAttention}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-2">
                                        {slugs.filter((s: string) => getBillingState(s).status === 'overdue').length === 0 ? (
                                            <p className="text-[10px] text-muted font-bold uppercase py-4 text-center italic">{t.sa_noOverduePayments}</p>
                                        ) : (
                                            slugs.filter((s: string) => getBillingState(s).status === 'overdue').slice(0, 3).map((slug: string) => (
                                                <div key={slug} className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 group hover:border-rose-500/30 transition-all">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-[10px] font-black text-rose-500">{loadSettings(slug).studioName[0]}</div>
                                                        <span className="text-xs font-bold text-primary dark:text-white group-hover:text-rose-400">{loadSettings(slug).studioName}</span>
                                                    </div>
                                                    <ArrowUpRight className="w-4 h-4 text-muted group-hover:text-rose-500" />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Expiring Soon */}
                                <div className="bg-white/95 dark:bg-white/[0.02] backdrop-blur-xl border border-black/10 dark:border-amber-500/20 rounded-[2.5rem] p-6 space-y-4 shadow-xl shadow-black/5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                                            <Building2 className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-primary dark:text-white uppercase tracking-wider">{t.sa_expiringSoonTitle}</h3>
                                            <p className="text-[10px] text-muted font-bold uppercase tracking-widest">{t.sa_retentionPriority}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-2">
                                        {slugs.filter((s: string) => {
                                            const state = getBillingState(s);
                                            return state.status === 'active' && state.daysLeftInTrial <= 7;
                                        }).length === 0 ? (
                                            <p className="text-[10px] text-muted font-bold uppercase py-4 text-center italic">{t.sa_noExpiringSoon}</p>
                                        ) : (
                                            slugs.filter((s: string) => {
                                            const state = getBillingState(s);
                                            return state.status === 'active' && state.daysLeftInTrial <= 7;
                                            }).slice(0, 3).map((slug: string) => (
                                                <div key={slug} className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 group hover:border-amber-500/30 transition-all">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-[10px] font-black text-amber-500">{loadSettings(slug).studioName[0]}</div>
                                                        <span className="text-xs font-bold text-primary dark:text-white group-hover:text-amber-400">{loadSettings(slug).studioName}</span>
                                                    </div>
                                                    <span className="text-[9px] font-black text-amber-500 uppercase">{getBillingState(slug).daysLeftInTrial} {t.sa_daysLeft}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/95 dark:bg-white/[0.02] backdrop-blur-xl border border-black/10 dark:border-white/5 rounded-[2.5rem] p-6 md:p-8 space-y-6 shadow-xl shadow-black/5">
                                <div className="flex items-center justify-between font-black">
                                    <div>
                                        <h2 className="text-lg text-primary">{t.sa_revenueGrowth}</h2>
                                        <p className="text-muted text-[10px] font-bold uppercase opacity-40">{t.sa_mrrTrends}</p>
                                    </div>
                                     <select className="bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-[10px] font-black text-muted rounded-lg px-3 py-1.5 outline-none uppercase tracking-widest border transition-colors hover:bg-black/10 dark:hover:bg-white/10">
                                        <option>{t.sa_last6Months}</option>
                                        <option>{t.sa_lastYear}</option>
                                    </select>
                                </div>

                                <div className="h-[280px] w-full flex items-end justify-between px-4 pb-8 bg-black/[0.01] dark:bg-white/[0.01] rounded-3xl relative overflow-hidden group/chart border border-black/5 dark:border-white/5 shadow-inner">
                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500/40 to-indigo-500/0 shadow-[0_0_20px_rgba(99,102,241,0.2)]" />
                                    {revenueTimeline.map((d, i) => (
                                        <div key={i} className="flex flex-col items-center gap-3 w-full group/bar">
                                            <div
                                                className="w-6 md:w-8 bg-gradient-to-t from-indigo-500/10 to-indigo-500 rounded-t-lg transition-all duration-700 group-hover/bar:brightness-110 shadow-sm relative"
                                                style={{ height: `${Math.max(4, (d.rev / (Math.max(...revenueTimeline.map(x => x.rev)) || 5000)) * 180)}px` }}
                                            >
                                                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/bar:opacity-100 transition-opacity rounded-t-lg" />
                                            </div>
                                            <span className="text-[10px] font-black text-muted group-hover/bar:text-primary transition-colors uppercase tracking-widest opacity-40">{d.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/95 dark:bg-white/[0.02] backdrop-blur-xl border border-black/10 dark:border-white/5 rounded-[2.5rem] p-6 md:p-8 space-y-6 shadow-xl shadow-black/5">
                            <h2 className="text-lg font-black text-primary">{t.sa_quickActions}</h2>
                            <div className="grid grid-cols-1 gap-3">
                                <ActionButton icon={UserPlus} label={t.sa_registerNewStudio} href="/superadmin/studios" color="emerald" />
                                <ActionButton icon={Bell} label={t.sa_sendNotifications} href="/superadmin/broadcast" color="amber" />
                                <button 
                                    onClick={() => window.dispatchEvent(new CustomEvent('cc-open-search'))}
                                    className={cn(
                                        "flex items-center gap-4 p-4 md:p-5 bg-white/[0.02] border border-black/5 dark:border-white/5 rounded-2xl text-muted text-[10px] font-black transition-all group/btn shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:bg-indigo-500/5 hover:text-indigo-400 hover:border-indigo-500/10"
                                    )}
                                >
                                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover/btn:border-current transition-colors shadow-inner">
                                        <Search className="w-4 h-4 md:w-4.5 md:h-4.5" />
                                    </div>
                                    <span className="uppercase tracking-widest">{t.sa_universalSearch}</span>
                                    <ChevronRight className="w-4 h-4 ml-auto opacity-20 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 transition-all text-current" />
                                </button>
                                <ActionButton icon={ShieldCheck} label={t.permViewAnalytics} href="/superadmin/system" color="zinc" />
                                
                                {/* Master Purge Button */}
                                <button 
                                    onClick={handleGlobalPurge}
                                    className="flex items-center gap-4 p-4 md:p-5 bg-rose-500/5 border border-rose-500/10 rounded-2xl text-rose-500 text-[10px] font-black transition-all group/purge shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:bg-rose-500 hover:text-white"
                                >
                                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 group-hover/purge:border-white/40 transition-colors shadow-inner">
                                        <AlertTriangle className="w-4 h-4 md:w-4.5 md:h-4.5" />
                                    </div>
                                    <span className="uppercase tracking-widest">{t.sa_fullDatabasePurge}</span>
                                    <ChevronRight className="w-4 h-4 ml-auto opacity-20 group-hover/purge:opacity-100 group-hover/purge:translate-x-1 transition-all" />
                                </button>
                            </div>

                            <div className="pt-6 border-t border-white/5 space-y-4">
                                <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">{t.sa_recentActivity}</h3>
                                <div className="space-y-5">
                                    {recentEvents.map((ev, i) => (
                                        <ActivityItem key={i} studio={ev.studio} action={ev.action} time={ev.time} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function StatCard({ title, value, icon: Icon, trend, color, lang }: any) {
    const colors: any = {
        indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/10',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/10',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/10',
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/10',
    };

    return (
        <div className="bg-white/95 dark:bg-white/[0.02] backdrop-blur-xl border border-black/5 dark:border-white/5 rounded-[2rem] p-4 md:p-7 space-y-3 md:space-y-4 hover:border-indigo-500/20 transition-all group shadow-xl shadow-black/5">
            <div className="flex items-center justify-between">
                <div className={cn("w-10 h-10 md:w-14 md:h-14 rounded-2xl border flex items-center justify-center transition-all group-hover:scale-110 group-hover:rotate-3 shadow-inner", colors[color])}>
                    <Icon className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div className="flex items-center gap-1 text-[8px] md:text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 md:px-2.5 md:py-1.5 rounded-full border border-emerald-500/10">
                    <TrendingUp className="w-3 h-3" />
                    {trend}
                </div>
            </div>
            <div>
                <p className="text-muted text-[8px] md:text-[10px] font-black uppercase tracking-[0.15em] line-clamp-1 opacity-40">{title}</p>
                <div className="flex items-baseline gap-1 mt-0.5 md:mt-1">
                    <p className="text-xl md:text-3xl font-black text-[#1e293b] dark:text-white tabular-nums tracking-tighter">{value}</p>
                    {title.includes('MRR') && <span className="text-[9px] md:text-xs font-bold text-muted opacity-40">/ {t.sa_perMonth}</span>}
                </div>
            </div>
        </div>
    );
}

function ActionButton({ icon: Icon, label, href, color }: any) {
    const colors: any = {
        emerald: 'hover:bg-emerald-500/5 hover:text-emerald-400 hover:border-emerald-500/10',
        amber: 'hover:bg-amber-500/5 hover:text-amber-400 hover:border-amber-500/10',
        indigo: 'hover:bg-indigo-500/5 hover:text-indigo-400 hover:border-indigo-500/10',
        zinc: 'hover:bg-white/5 hover:text-primary hover:border-white/10',
    };

    return (
        <Link href={href} className={cn(
            "flex items-center gap-4 p-4 md:p-5 bg-white/[0.02] border border-white/5 rounded-2xl text-muted text-[10px] font-black transition-all group/btn shadow-sm hover:shadow-lg hover:-translate-y-0.5",
            colors[color]
        )}>
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover/btn:border-current transition-colors shadow-inner">
                <Icon className="w-4 h-4 md:w-4.5 md:h-4.5" />
            </div>
            <span className="uppercase tracking-widest">{label}</span>
            <ChevronRight className="w-4 h-4 ml-auto opacity-20 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 transition-all text-current" />
        </Link>
    );
}

function ActivityItem({ studio, action, time }: any) {
    return (
        <div className="flex items-center justify-between group cursor-default">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 flex items-center justify-center text-xs font-black text-muted group-hover:bg-indigo-500/10 group-hover:text-indigo-400 transition-all shadow-sm">
                    {studio[0]}
                </div>
                <div>
                    <p className="text-xs font-black text-muted group-hover:text-primary transition-colors">{studio}</p>
                    <p className="text-[10px] text-muted opacity-40 font-bold">{action}</p>
                </div>
            </div>
            <span className="text-[9px] text-muted font-black uppercase tracking-wider opacity-20">{time}</span>
        </div>
    );
}
