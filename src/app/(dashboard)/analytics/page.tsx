'use client';

import { useState } from 'react';
import {
    BarChart2, TrendingUp, Users, CreditCard,
    CalendarCheck, ArrowUpRight, ArrowDownRight,
    Filter, Download, CalendarDays, ChevronDown,
    Banknote, Clock, Wallet, CheckCircle2
} from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

// ─── Mock Data ──────────────────────────────────────────────────────────────

const OVERVIEW_STATS = [
    { label: 'Total Revenue', value: '14,200 ₾', change: '+12.5%', trend: 'up', icon: CreditCard, color: 'indigo' },
    { label: 'Total Students', value: '142', change: '+8', trend: 'up', icon: Users, color: 'emerald' },
    { label: 'Avg Attendance', value: '83%', change: '-2.1%', trend: 'down', icon: CalendarCheck, color: 'violet' },
    { label: 'Total Salaries', value: '4,850 ₾', change: '+5.2%', trend: 'up', icon: Wallet, color: 'rose' },
];

const REVENUE_DATA = [
    { month: 'Jan', value: 9200 },
    { month: 'Feb', value: 10500 },
    { month: 'Mar', value: 12100 },
    { month: 'Apr', value: 11800 },
    { month: 'May', value: 13500 },
    { month: 'Jun', value: 14200 },
];

const ATTENDANCE_DATA = [
    { day: 'Mon', rate: 85 },
    { day: 'Tue', rate: 78 },
    { day: 'Wed', rate: 92 },
    { day: 'Thu', rate: 88 },
    { day: 'Fri', rate: 80 },
    { day: 'Sat', rate: 95 },
    { day: 'Sun', rate: 70 },
];

const TOP_GROUPS = [
    { name: 'Contemporary Dance', students: 24, revenue: 1200, growth: '+15%' },
    { name: 'Ballet Beginners', students: 18, revenue: 900, growth: '+10%' },
    { name: 'Hip-Hop Kids', students: 15, revenue: 750, growth: '+5%' },
    { name: 'Yoga Morning', students: 12, revenue: 600, growth: '-2%' },
];

const SALARY_BREAKDOWN = [
    { teacher: 'ნინო ბერიძე', type: 'Monthly', rate: 1200, bonus: 150, hours: 0, total: 1350, status: 'paid' },
    { teacher: 'გიორგი კვირიკაშვილი', type: 'Hourly', rate: 45, bonus: 0, hours: 32, total: 1440, status: 'pending' },
    { teacher: 'სოფო კაციტაძე', type: 'Hourly', rate: 60, bonus: 100, hours: 18, total: 1180, status: 'paid' },
    { teacher: 'ანა ჩხეიძე', type: 'Hourly', rate: 35, bonus: 0, hours: 25, total: 875, status: 'pending' },
];

// ─── Components ─────────────────────────────────────────────────────────────

function StatCard({ stat, t }: { stat: typeof OVERVIEW_STATS[0], t: any }) {
    const Icon = stat.icon;
    const isUp = stat.trend === 'up';

    return (
        <div className="bg-card border border-border-subtle rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:shadow-black/5 transition-all group">
            <div className="flex items-center justify-between mb-4">
                <div className={cn(
                    "w-12 h-12 rounded-2xl border flex items-center justify-center transition-transform group-hover:scale-110",
                    stat.color === 'indigo' && "bg-indigo-500/10 border-indigo-500/20 text-indigo-600",
                    stat.color === 'emerald' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-600",
                    stat.color === 'violet' && "bg-violet-500/10 border-violet-500/20 text-violet-600",
                    stat.color === 'amber' && "bg-amber-500/10 border-amber-500/20 text-amber-600",
                    stat.color === 'rose' && "bg-rose-500/10 border-rose-500/20 text-rose-600",
                )}>
                    <Icon className="w-6 h-6" />
                </div>
                <div className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                    isUp ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"
                )}>
                    {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {stat.change}
                </div>
            </div>
            <p className="text-3xl font-black text-primary tabular-nums tracking-tighter mb-1">{stat.value}</p>
            <p className="text-[11px] font-black text-muted uppercase tracking-[0.15em] opacity-40">{stat.label}</p>
        </div>
    );
}

function SimpleBarChart({ data, maxValue, colorClass }: { data: { month?: string, day?: string, value?: number, rate?: number }[], maxValue: number, colorClass: string }) {
    return (
        <div className="flex items-end justify-between h-48 gap-2 px-2 mt-6">
            {data.map((d, i) => {
                const val = d.value || d.rate || 0;
                const height = (val / maxValue) * 100;
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                        <div className="relative w-full flex justify-center">
                            <div className={cn("w-full max-w-[24px] rounded-t-xl transition-all duration-500 ease-out group-hover:brightness-110 relative", colorClass)}
                                style={{ height: `${height}%` }}>
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl">
                                    {val}{d.rate ? '%' : ''}
                                </div>
                            </div>
                        </div>
                        <span className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40">{d.month || d.day}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
    const { t } = useT();
    const [period, setPeriod] = useState('This Month');

    const totalPaid = SALARY_BREAKDOWN.filter(s => s.status === 'paid').reduce((acc, s) => acc + s.total, 0);
    const totalPending = SALARY_BREAKDOWN.filter(s => s.status === 'pending').reduce((acc, s) => acc + s.total, 0);

    return (
        <div className="max-w-6xl mx-auto space-y-10 animate-fade-up pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-primary tracking-tight leading-tight">{t.analytics}</h1>
                    <p className="text-muted text-base font-medium opacity-60">ფინანსური ანალიზი და სახელფასო უწყისი</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-surface border border-border-subtle rounded-2xl p-1 shadow-inner flex items-center">
                        {['Week', 'Month', 'Year'].map(p => (
                            <button key={p} onClick={() => setPeriod(p)}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    period.includes(p) ? "bg-white text-primary shadow-lg" : "text-muted hover:text-primary"
                                )}>
                                {p}
                            </button>
                        ))}
                    </div>
                    <button className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95">
                        <Download className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {OVERVIEW_STATS.map(stat => (stat.label !== 'Active Plans' &&
                    <StatCard key={stat.label} stat={stat} t={t} />
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Revenue Chart */}
                <div className="bg-card border border-border-subtle rounded-[2.5rem] p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-black text-primary tracking-tight">შემოსავლების დინამიკა</h2>
                        </div>
                        <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">+18% vs Last Year</span>
                    </div>
                    <p className="text-xs font-bold text-muted opacity-40 mb-8 uppercase tracking-wider">ყოველთვიური შემოსავალი (₾)</p>

                    <SimpleBarChart data={REVENUE_DATA} maxValue={15000} colorClass="bg-gradient-to-t from-indigo-600 to-indigo-400" />
                </div>

                {/* Attendance Chart */}
                <div className="bg-card border border-border-subtle rounded-[2.5rem] p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600">
                                <CalendarCheck className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-black text-primary tracking-tight">დასწრების მაჩვენებელი</h2>
                        </div>
                        <span className="text-xs font-black text-muted uppercase tracking-widest opacity-40">Weekly Average: 83%</span>
                    </div>
                    <p className="text-xs font-bold text-muted opacity-40 mb-8 uppercase tracking-wider">დღიური დასწრების პროცენტი (%)</p>

                    <SimpleBarChart data={ATTENDANCE_DATA} maxValue={100} colorClass="bg-gradient-to-t from-violet-600 to-violet-400" />
                </div>
            </div>

            {/* Salary Calculation Section */}
            <div className="bg-card border border-border-subtle rounded-[2.5rem] overflow-hidden shadow-sm">
                <div className="px-8 py-6 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                            <Banknote className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-black text-primary tracking-tight">ხელფასების გამოთვლა</h2>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40">გაცემული</p>
                            <p className="text-lg font-black text-emerald-600 tabular-nums">{totalPaid} ₾</p>
                        </div>
                        <div className="w-px h-8 bg-border-subtle opacity-50" />
                        <div className="text-center">
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40">გასაცემი</p>
                            <p className="text-lg font-black text-amber-600 tabular-nums">{totalPending} ₾</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-surface/10">
                                <th className="px-8 py-4 text-left text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">მასწავლებელი</th>
                                <th className="px-8 py-4 text-center text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">ტიპი</th>
                                <th className="px-8 py-4 text-center text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">განაკვეთი / საათები</th>
                                <th className="px-8 py-4 text-center text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">ბონუსი</th>
                                <th className="px-8 py-4 text-center text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">ჯამი</th>
                                <th className="px-8 py-4 text-right text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">სტატუსი</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/50">
                            {SALARY_BREAKDOWN.map((item, i) => (
                                <tr key={i} className="group hover:bg-surface/40 transition-colors">
                                    <td className="px-8 py-5">
                                        <p className="text-sm font-black text-primary group-hover:text-rose-600 transition-colors uppercase tracking-tight">{item.teacher}</p>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border",
                                            item.type === 'Monthly' ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" : "bg-violet-500/10 text-violet-600 border-violet-500/20"
                                        )}>
                                            {item.type === 'Monthly' ? 'თვიური' : 'საათობრივი'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-primary tabular-nums">{item.rate} ₾ {item.hours > 0 ? '' : '/ თვე'}</span>
                                            {item.hours > 0 && <span className="text-[10px] font-bold text-muted opacity-60 uppercase">{item.hours} სთ</span>}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <span className="text-xs font-black text-emerald-600 tabular-nums">{item.bonus > 0 ? `+${item.bonus} ₾` : '—'}</span>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <span className="text-sm font-black text-primary tabular-nums">{item.total} ₾</span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                            item.status === 'paid' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                        )}>
                                            {item.status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                            {item.status === 'paid' ? 'გაცემული' : 'გასაცემი'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Top Groups Table */}
            <div className="bg-card border border-border-subtle rounded-[2.5rem] overflow-hidden shadow-sm">
                <div className="px-8 py-6 border-b border-border-subtle flex items-center justify-between bg-surface/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                            <Users className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-black text-primary tracking-tight">პოპულარული ჯგუფები</h2>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-surface/10">
                                <th className="px-8 py-4 text-left text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">ჯგუფის სახელი</th>
                                <th className="px-8 py-4 text-center text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">სტუდენტები</th>
                                <th className="px-8 py-4 text-center text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">შემოსავალი</th>
                                <th className="px-8 py-4 text-right text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">ზრდა</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/50">
                            {TOP_GROUPS.map((group, i) => (
                                <tr key={i} className="group hover:bg-surface/40 transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-[10px] font-black text-primary opacity-60">
                                                0{i + 1}
                                            </div>
                                            <span className="text-sm font-black text-primary group-hover:text-indigo-600 transition-colors">{group.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <span className="text-sm font-black text-primary tabular-nums">{group.students}</span>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <span className="text-sm font-black text-primary tabular-nums">{group.revenue} ₾</span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <span className={cn(
                                            "text-xs font-black tracking-tight",
                                            group.growth.startsWith('+') ? "text-emerald-600" : "text-red-500"
                                        )}>
                                            {group.growth}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Insights Footer */}
            <div className="bg-indigo-600 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center gap-10 shadow-2xl shadow-indigo-600/40 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />

                <div className="flex-1 text-center md:text-left space-y-4 relative z-10">
                    <h3 className="text-3xl font-black text-white tracking-tight leading-tight">მზად ხართ უფრო დეტალური <br />ანალიზისთვის?</h3>
                    <p className="text-indigo-100 text-base font-medium opacity-80 max-w-md">ჩვენი AI ასისტენტი დაგეხმარებათ აღმოაჩინოთ ფარული ტენდენციები თქვენს ბიზნესში.</p>
                </div>

                <button className="px-10 py-5 bg-white text-indigo-600 text-sm font-black rounded-3xl transition-all shadow-2xl shadow-black/10 hover:shadow-black/20 hover:scale-105 active:scale-95 whitespace-nowrap relative z-10 uppercase tracking-widest">
                    AI ინსაიტების ჩართვა
                </button>
            </div>
        </div>
    );
}
