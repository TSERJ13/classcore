'use client';

import { useState, useEffect } from 'react';
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
    const [logs, setLogs] = useState<ActionLog[]>([]);
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
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

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-up pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-primary tracking-tight">User Insights</h1>
                    <p className="text-muted text-sm font-medium opacity-60">Track behavior patterns and billing performance</p>
                </div>

                <div className="flex items-center gap-2 bg-surface/50 p-1 rounded-2xl border border-border-subtle">
                    {['all', 'plan_click', 'promo_code_attempt', 'portal_visit'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-muted hover:text-primary'
                                }`}
                        >
                            {f.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-card border border-border-subtle rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                            <TrendingUp className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest">Total Events</span>
                    </div>
                    <p className="text-3xl font-black text-primary">{stats.totalActions}</p>
                </div>
                <div className="bg-card border border-border-subtle rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                            <MousePointer2 className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest">Plan Clicks</span>
                    </div>
                    <p className="text-3xl font-black text-primary">{stats.planClicks}</p>
                </div>
                <div className="bg-card border border-border-subtle rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                            <Ticket className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest">Promo Success</span>
                    </div>
                    <p className="text-3xl font-black text-primary">{stats.promoUses}</p>
                </div>
                <div className="bg-card border border-border-subtle rounded-3xl p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-600">
                            <Users className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest">Portal Visits</span>
                    </div>
                    <p className="text-3xl font-black text-primary">{stats.portalVisits}</p>
                </div>
            </div>

            {/* Event Log */}
            <div className="bg-card border border-border-subtle rounded-[2.5rem] overflow-hidden shadow-xl shadow-black/5">
                <div className="px-8 py-6 border-b border-border-subtle bg-surface/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BarChart3 className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-lg font-black text-primary tracking-tight">Recent Activity</h2>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-surface/50 border-b border-border-subtle">
                                <th className="px-8 py-4 text-left text-[10px] font-black text-muted uppercase tracking-widest">Time</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-muted uppercase tracking-widest">Action</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-muted uppercase tracking-widest">Studio</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-muted uppercase tracking-widest">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/50">
                            {filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-surface/30 transition-colors">
                                    <td className="px-8 py-4">
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-muted">
                                            <Clock className="w-3 h-3 opacity-40" />
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </div>
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${log.action === 'plan_click' ? 'bg-emerald-500/10 text-emerald-600' :
                                                log.action === 'promo_code_attempt' ? 'bg-amber-500/10 text-amber-600' :
                                                    log.action === 'portal_visit' ? 'bg-cyan-500/10 text-cyan-600' :
                                                        'bg-slate-500/10 text-slate-600'
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
                                        No activity recorded yet
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
