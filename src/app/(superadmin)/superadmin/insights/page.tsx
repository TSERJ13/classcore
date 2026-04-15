'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/contexts/LanguageContext';
import {
    BarChart3,
    TrendingUp,
    Users,
    MousePointer2,
    Ticket,
    ExternalLink,
    Clock,
    Filter
} from 'lucide-react';
import { getActionLogs, type ActionLog } from '@/lib/analytics';
import { formatCurrency } from '@/lib/utils';

export default function InsightsPage() {
    const { t } = useT();
    const [mounted, setMounted] = useState(false);
    const [logs, setLogs] = useState<ActionLog[]>([]);
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
        setMounted(true);
        setLogs(getActionLogs().reverse());

        const handleUpdate = () => {
            setLogs(getActionLogs().reverse());
        };
        window.addEventListener('cc_analytics_update', handleUpdate);
        return () => window.removeEventListener('cc_analytics_update', handleUpdate);
    }, []);

    const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.action === filter);

    const stats = {
        totalActions: logs.length,
        planClicks: logs.filter(l => l.action === 'plan_click').length,
        promoUses: logs.filter(l => l.action === 'promo_code_attempt' && l.metadata.success).length,
        portalVisits: logs.filter(l => l.action === 'portal_visit').length,
    };

    if (!mounted) return null;

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-up pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-primary dark:text-white tracking-tight">{t.sa_insights_title}</h1>
                    <p className="text-muted text-sm font-medium opacity-60">{t.sa_insights_desc}</p>
                </div>

                <div className="flex items-center gap-2 bg-muted/10 p-1 rounded-2xl border border-border-subtle shadow-inner">
                    {['all', 'plan_click', 'promo_code_attempt', 'portal_visit'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-indigo-600 text-white shadow-md' : 'text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-muted/10'
                                }`}
                        >
                            {f === 'all' ? t.sa_insights_filterAll :
                                f === 'plan_click' ? t.sa_insights_filterPlans :
                                    f === 'promo_code_attempt' ? t.sa_insights_filterPromos :
                                        t.sa_insights_filterPortal}
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest">{t.sa_insights_totalEvents}</span>
                    </div>
                    <p className="text-3xl font-black text-[#1e293b] dark:text-white">{stats.totalActions}</p>
                </div>
                <div className="bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                            <MousePointer2 className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest">{t.sa_insights_planClicks}</span>
                    </div>
                    <p className="text-3xl font-black text-[#1e293b] dark:text-white">{stats.planClicks}</p>
                </div>
                <div className="bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                            <Ticket className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest">{t.sa_insights_promoSuccess}</span>
                    </div>
                    <p className="text-3xl font-black text-[#1e293b] dark:text-white">{stats.promoUses}</p>
                </div>
                <div className="bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-600">
                            <Users className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest">{t.sa_insights_portalVisits}</span>
                    </div>
                    <p className="text-3xl font-black text-[#1e293b] dark:text-white">{stats.portalVisits}</p>
                </div>
            </div>

            {/* Event Log */}
            <div className="bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-[2.5rem] overflow-hidden shadow-xl shadow-black/5 dark:shadow-indigo-500/5">
                <div className="px-8 py-6 border-b border-black/5 dark:border-border-subtle bg-black/[0.02] dark:bg-muted/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        < BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <h2 className="text-lg font-black text-primary dark:text-white tracking-tight">{t.sa_insights_recentActivity}</h2>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-muted/5 border-b border-border-subtle">
                                <th className="px-8 py-4 text-left text-[10px] font-black text-muted uppercase tracking-widest opacity-40">Time</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-muted uppercase tracking-widest opacity-40">Action</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-muted uppercase tracking-widest opacity-40">Studio</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-muted uppercase tracking-widest opacity-40">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/30">
                            {filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-muted/5 transition-colors group">
                                    <td className="px-8 py-4">
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-muted">
                                            <Clock className="w-3 h-3 opacity-40" />
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </div>
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-current/20 ${log.action === 'plan_click' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                                                log.action === 'promo_code_attempt' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                                                    log.action === 'portal_visit' ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' :
                                                        'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                                            }`}>
                                            {log.action.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className="text-xs font-black text-primary">{log.slug}</span>
                                    </td>
                                    <td className="px-8 py-4">
                                        <div className="text-[10px] font-mono text-muted max-w-xs truncate">
                                            {JSON.stringify(log.metadata)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-8 py-12 text-center text-muted text-sm font-medium italic opacity-40">
                                        {t.sa_insights_noActivity}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
