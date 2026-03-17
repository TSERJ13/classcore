'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Users, Building2, CreditCard, MessageSquare,
    TrendingUp, ArrowUpRight, ArrowDownRight,
    Search, Bell, UserPlus, ShieldCheck, ChevronRight
} from 'lucide-react';
import { getStudioRegistry, loadSettings } from '@/lib/settings-store';
import { cn } from '@/lib/utils';
import Link from 'next/link';
// Recharts is currently unavailable in the environment — using premium CSS mockup

interface Stats {
    totalStudios: number;
    totalStudents: number;
    activeSubs: number;
    totalRevenue: number;
    totalSms: number;
    mrr: number;
}

const REVENUE_DATA = [
    { name: 'Jan', rev: 1200, sms: 4500 },
    { name: 'Feb', rev: 1900, sms: 5200 },
    { name: 'Mar', rev: 2400, sms: 6100 },
    { name: 'Apr', rev: 2800, sms: 5800 },
    { name: 'May', rev: 3200, sms: 7200 },
    { name: 'Jun', rev: 4100, sms: 8500 },
];

export default function SuperAdminDashboard() {
    const [stats, setStats] = useState<Stats>({
        totalStudios: 0, totalStudents: 0, activeSubs: 0,
        totalRevenue: 0, totalSms: 0, mrr: 0
    });

    useEffect(() => {
        const slugs = getStudioRegistry();
        let students = 0;
        let subs = 0;

        slugs.forEach(slug => {
            const settings = loadSettings(slug);
            const studentData = localStorage.getItem(`cc_student_data_${slug}`);
            if (studentData) {
                try {
                    students += Object.keys(JSON.parse(studentData)).length;
                } catch { }
            }
            subs++; // Mocking for now
        });

        setStats({
            totalStudios: slugs.length,
            totalStudents: students,
            activeSubs: subs,
            totalRevenue: subs * 49 * 6,
            totalSms: students * 12,
            mrr: subs * 49
        });
    }, []);

    return (
        <div className="space-y-8 animate-fade-in p-1 md:p-4 lg:p-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">System Overview</h1>
                    <p className="text-zinc-500 text-sm mt-1 font-medium">Real-time ClassCore SaaS metrics and performance</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center gap-2 text-xs font-bold text-zinc-400">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        System Status: Operational
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Active Studios"
                    value={stats.totalStudios}
                    icon={Building2}
                    trend="+12%"
                    color="indigo"
                />
                <StatCard
                    title="Total Students"
                    value={stats.totalStudents.toLocaleString()}
                    icon={Users}
                    trend="+5.4%"
                    color="emerald"
                />
                <StatCard
                    title="Monthly Revenue (MRR)"
                    value={`${stats.mrr}₾`}
                    icon={CreditCard}
                    trend="+8.2%"
                    color="amber"
                />
                <StatCard
                    title="SMS Sent (MTD)"
                    value={stats.totalSms.toLocaleString()}
                    icon={MessageSquare}
                    trend="+22%"
                    color="blue"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6">
                    <div className="flex items-center justify-between font-black">
                        <div>
                            <h2 className="text-lg text-white">Revenue Growth</h2>
                            <p className="text-zinc-500 text-xs font-medium">Monthly recurring revenue trends</p>
                        </div>
                        <select className="bg-zinc-800 border-none text-[10px] font-black text-zinc-300 rounded-lg px-3 py-1.5 outline-none uppercase tracking-widest">
                            <option>Last 6 Months</option>
                            <option>Last Year</option>
                        </select>
                    </div>

                    <div className="h-[320px] w-full flex items-end justify-between px-4 pb-8 bg-zinc-800/20 rounded-3xl relative overflow-hidden group/chart border border-zinc-800/50">
                        {/* Mock Graph with CSS */}
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-indigo-500/20 via-indigo-500 to-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.4)]" />

                        {REVENUE_DATA.map((d, i) => (
                            <div key={i} className="flex flex-col items-center gap-3 w-full group/bar">
                                <div
                                    className="w-8 bg-gradient-to-t from-indigo-500/20 to-indigo-500 rounded-t-lg transition-all duration-700 group-hover/bar:brightness-125"
                                    style={{ height: `${(d.rev / 5000) * 200}px` }}
                                />
                                <span className="text-[10px] font-black text-zinc-500 group-hover/bar:text-zinc-300 transition-colors uppercase tracking-widest">{d.name}</span>
                            </div>
                        ))}

                        <div className="absolute top-6 left-6 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Live Projection</span>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6">
                    <h2 className="text-lg font-black text-white">Quick Actions</h2>
                    <div className="grid grid-cols-1 gap-3">
                        <ActionButton icon={UserPlus} label="Register New Studio" href="/superadmin/studios" color="emerald" />
                        <ActionButton icon={Bell} label="Send Broadcast" href="/superadmin/broadcast" color="amber" />
                        <ActionButton icon={Search} label="Universal Search" href="/superadmin/search" color="indigo" />
                        <ActionButton icon={ShieldCheck} label="System Audit" href="/superadmin/system" color="zinc" />
                    </div>

                    <div className="pt-6 border-t border-zinc-800 space-y-4">
                        <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Recent Activity</h3>
                        <div className="space-y-5">
                            <ActivityItem studio="Elite Dance" action="New Subscription" time="2h ago" />
                            <ActivityItem studio="Yoga Flow" action="SMS Limit Reached" time="5h ago" />
                            <ActivityItem studio="Fitness Pro" action="Manual Payment" time="1d ago" />
                            <ActivityItem studio="Music Academy" action="Studio Created" time="2d ago" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, trend, color }: any) {
    const colors: any = {
        indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-[2.2rem] p-7 space-y-4 hover:border-zinc-700 transition-colors group">
            <div className="flex items-center justify-between">
                <div className={cn("p-4 rounded-2xl border transition-all group-hover:scale-110", colors[color])}>
                    <Icon className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
                    <TrendingUp className="w-3 h-3" />
                    {trend}
                </div>
            </div>
            <div>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.15em]">{title}</p>
                <p className="text-3xl font-black text-white mt-1.5">{value}</p>
            </div>
        </div>
    );
}

function ActionButton({ icon: Icon, label, href, color }: any) {
    const colors: any = {
        emerald: 'hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20',
        amber: 'hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20',
        indigo: 'hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/20',
        zinc: 'hover:bg-zinc-800 hover:text-white hover:border-zinc-700',
    };

    return (
        <Link href={href} className={cn(
            "flex items-center gap-4 p-4.5 bg-zinc-800/30 border border-zinc-800 rounded-2xl text-zinc-400 text-xs font-black transition-all group/btn py-4",
            colors[color]
        )}>
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center border border-zinc-800 group-hover/btn:border-current transition-colors">
                <Icon className="w-4 h-4" />
            </div>
            {label}
            <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover/btn:opacity-100 -translate-x-2 group-hover/btn:translate-x-0 transition-all" />
        </Link>
    );
}

function ActivityItem({ studio, action, time }: any) {
    return (
        <div className="flex items-center justify-between group cursor-default">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-black text-zinc-500 group-hover:bg-zinc-800 group-hover:text-zinc-300 transition-all">
                    {studio[0]}
                </div>
                <div>
                    <p className="text-xs font-black text-zinc-300 group-hover:text-white transition-colors">{studio}</p>
                    <p className="text-[10px] text-zinc-600 font-bold">{action}</p>
                </div>
            </div>
            <span className="text-[9px] text-zinc-700 font-black uppercase tracking-wider">{time}</span>
        </div>
    );
}
