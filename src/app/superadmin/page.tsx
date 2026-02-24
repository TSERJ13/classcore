'use client';

import React from 'react';
import {
    Users,
    Settings,
    ShieldAlert,
    Activity,
    Database,
    Globe,
    ShieldCheck,
    Search,
    ChevronRight,
    ArrowUpRight,
    Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SuperadminPage() {
    const STATS = [
        { label: 'Total Studios', value: '1,284', grow: '+12%', icon: Globe, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Active Users', value: '42.5k', grow: '+8%', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'System Health', value: '99.9%', grow: 'Stable', icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Database Size', value: '1.2 TB', grow: '+4%', icon: Database, color: 'text-rose-600', bg: 'bg-rose-50' },
    ];

    const RECENT_STUDIOS = [
        { id: 'ST-001', name: 'Elite Dance Studio', slug: 'elite-dance', plan: 'Enterprise', status: 'Active', date: '2 mins ago' },
        { id: 'ST-002', name: 'Zen Yoga Center', slug: 'zen-yoga', plan: 'Pro', status: 'Active', date: '15 mins ago' },
        { id: 'ST-003', name: 'Sparta MMA Club', slug: 'sparta-mma', plan: 'Basic', status: 'Pending', date: '1 hour ago' },
        { id: 'ST-004', name: 'Art Ballet School', slug: 'art-ballet', plan: 'Enterprise', status: 'Active', date: '3 hours ago' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Superadmin Sidebar Overlay */}
            <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col pt-8">
                <div className="px-6 mb-10 flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <ShieldAlert className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white tracking-widest uppercase">ClassCore</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Superadmin Panel</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    <NavItem icon={LayoutDashboard} label="Dashboard" active />
                    <NavItem icon={Globe} label="Studios" />
                    <NavItem icon={Users} label="Account Managers" />
                    <NavItem icon={Database} label="System Logs" />
                    <NavItem icon={Settings} label="Global Config" />
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <div className="bg-slate-800/50 rounded-2xl p-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Backup Status</p>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-bold text-slate-300">All systems green</span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-10">
                <header className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Overview</h1>
                        <p className="text-slate-500 font-medium mt-1">Real-time infrastructure and studio management.</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input placeholder="Search studios, logs..." className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all w-64 shadow-sm" />
                        </div>
                        <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
                            <Filter className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-4 gap-6 mb-10">
                    {STATS.map(s => (
                        <div key={s.label} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
                            <div className="flex items-center gap-4 mb-4">
                                <div className={cn("p-3 rounded-2xl", s.bg)}>
                                    <s.icon className={cn("w-6 h-6", s.color)} />
                                </div>
                                <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg ml-auto">{s.grow}</span>
                            </div>
                            <p className="text-2xl font-black text-slate-900 tracking-tight">{s.value}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
                        </div>
                    ))}
                </div>

                <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-lg font-black text-slate-900 px-2">Recent Studios</h3>
                        <button className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1.5">
                            View All <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Studio Name</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Created</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {RECENT_STUDIOS.map(st => (
                                    <tr key={st.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-900">{st.name}</span>
                                                <span className="text-[11px] text-slate-400 mt-0.5">{st.slug}.classcore.ge</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={cn(
                                                "text-[10px] font-black px-2.5 py-1 rounded-lg uppercase",
                                                st.plan === 'Enterprise' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'
                                            )}>
                                                {st.plan}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("w-1.5 h-1.5 rounded-full", st.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500')} />
                                                <span className="text-xs font-bold text-slate-700">{st.status}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-xs font-medium text-slate-400">{st.date}</td>
                                        <td className="px-8 py-5 text-right">
                                            <button className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all flex items-center justify-center">
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}

function LayoutDashboard(props: any) {
    return <Activity {...props} />;
}

function NavItem({ icon: Icon, label, active = false }: { icon: any; label: string; active?: boolean }) {
    return (
        <button className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm",
            active
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
        )}>
            <Icon className="w-5 h-5" />
            {label}
        </button>
    );
}
