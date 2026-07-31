'use client';

import { useState, useEffect } from 'react';
import {
    TrendingUp, Users, CreditCard,
    CalendarCheck, ArrowUpRight, ArrowDownRight,
    Download, X, Lightbulb, BarChart3,
    Banknote, Clock, Wallet, CheckCircle2, Eye, EyeOff,
    Edit2, ChevronLeft, ChevronRight, Calculator,
    LayoutGrid, GraduationCap, ShoppingBag, Receipt, Settings2,
    Sparkles, AlertCircle
} from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { cn, getLocalISODate, formatCurrency } from '@/lib/utils';
import { useUser } from '@/hooks/useUser';
import { useStudio } from '@/contexts/StudioContext';
import { getStudents } from '@/lib/student-store';
import { getSales } from '@/lib/sales-store';
import { getSubscriptions } from '@/lib/subscription-store';
import { getTeachers, updateTeacher } from '@/lib/teacher-store';
import { getEvents } from '@/lib/event-store';
import { getPlans } from '@/lib/plan-store';
import { getMonthlyBonuses, getTeacherBonusForMonth, setTeacherBonus } from '@/lib/bonus-store';
import { getSalaryStatuses, toggleSalaryStatus, getStatusForTeacher } from '@/lib/salary-status-store';
import { TeacherModal } from '@/components/teachers/TeacherModal';
import { getGroups } from '@/lib/group-store';
import { PieChart, GaugeChart } from '@/components/ui/PieChart';
import { getScopedKey } from '@/lib/settings-store';
import { getStudentCheckins } from '@/lib/checkin-store';
import { buildPlanPrices, subRevenue as calcSubRevenue, pctChange, generateInsights } from '@/lib/studio-stats';

// ─── Month Navigator ─────────────────────────────────────────────────────────

function MonthNavigator({ selectedMonth, onSelect, t, className }: { selectedMonth: string, onSelect: (m: string) => void, t: any, className?: string }) {
    const months = [t.jan, t.feb, t.mar, t.apr, t.may, t.jun, t.jul, t.aug, t.sep, t.oct, t.nov, t.dec];
    const [year, monthIdx] = selectedMonth.split('-').map(Number);
    const displayMonth = months[monthIdx - 1];

    const goToPrev = () => {
        if (monthIdx === 1) {
            onSelect(`${year - 1}-12`);
        } else {
            onSelect(`${year}-${String(monthIdx - 1).padStart(2, '0')}`);
        }
    };

    const goToNext = () => {
        const now = new Date();
        const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        if (selectedMonth >= currentYM) return; // Don't go beyond current month
        if (monthIdx === 12) {
            onSelect(`${year + 1}-01`);
        } else {
            onSelect(`${year}-${String(monthIdx + 1).padStart(2, '0')}`);
        }
    };

    const isCurrentMonth = () => {
        const now = new Date();
        return selectedMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    };

    return (
        <div className={cn("flex items-center gap-3 bg-surface border border-border-subtle rounded-2xl px-3 py-2.5 shadow-inner", className)}>
            
                        <button onClick={() => handleExport()}
                            className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-2xl bg-white text-black border border-border-subtle hover:bg-surface transition-all shadow-sm shrink-0 active:scale-95"
                            title={l('ჩამოტვირთვა', 'Скачать', 'Download')}>
                            <Download className="w-5 h-5 sm:w-5 sm:h-5" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
            {/* 1. AI Studio Assistant - Premium Dynamic Hero */}
            <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-6 md:p-8 relative overflow-hidden group shadow-2xl shadow-indigo-600/30 mb-6 sm:mb-8 transition-all duration-500 hover:scale-[1.01] w-full">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 animate-pulse" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />
                
                <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-6 lg:gap-8">
                    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 text-center sm:text-left">
                        <div className="relative shrink-0">
                            <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner group-hover:rotate-6 transition-transform">
                                <Sparkles className="w-5 h-5 sm:w-8 sm:h-8 text-white animate-pulse" />
                            </div>
                            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 bg-emerald-400 rounded-full border-2 border-indigo-600 animate-ping" />
                        </div>
                        <div className="space-y-0.5 sm:space-y-1">
                            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[8px] sm:text-[10px] font-black uppercase tracking-widest border border-emerald-400/30">
                                    {l('ლაივ რეჟიმი', 'Live Режим', 'Live Mode')}
                                </span>
                                <h2 className="text-[15px] sm:text-xl font-black text-white tracking-tight uppercase">AI Assistant</h2>
                            </div>
                            <p className="text-indigo-100/60 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em]">{l('სტუდიის ინტელექტი', 'Интеллект студии', 'Studio Intelligence')}</p>
                        </div>
                    </div>
                    
                    <div className="flex-1 w-full lg:max-w-4xl px-1 sm:px-2">
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-white/15 shadow-2xl overflow-hidden relative min-h-[60px] sm:min-h-[80px] flex items-center group/card">
                            <div className="absolute top-0 left-0 w-1 sm:w-1.5 h-full bg-emerald-400 opacity-60 group-hover/card:bg-white transition-colors" />
                            <p className="text-xs sm:text-base font-bold text-white leading-tight sm:leading-relaxed italic animate-in fade-in slide-in-from-right-8 duration-700">
                                "{(extraStats.suggestions || [])[currentInsightIndex] || l('მონაცემების ანალიზი...', 'Аналиზ მონაცემების...', 'Analyzing studio data...')}"
                            </p>
                            <div className="absolute bottom-2 right-4 flex gap-1.5 opacity-40">
                                {(extraStats.suggestions || []).map((_: any, i: number) => (
                                    <div key={i} className={cn("w-1.5 h-1.5 rounded-full bg-white transition-all", i === currentInsightIndex ? "w-4 opacity-100" : "opacity-40")} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

                {/* Round Charts Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    {/* 1. Net Profit (Gauge) */}
                    <div className="bg-card border border-border-subtle rounded-3xl p-5 sm:p-6 shadow-lg flex flex-col items-center min-h-[340px] h-full">
                        <div className="w-full h-8 flex items-start justify-center">
                            <p className="text-[10px] font-black text-muted tracking-[0.2em] text-center leading-tight uppercase opacity-60 px-2 line-clamp-2">{t.netProfit}</p>
                        </div>
                        <div className="h-44 w-full flex items-center justify-center">
                            <div className="relative flex items-center justify-center scale-110">
                                <GaugeChart
                                    size={100}
                                    thickness={12}
                                    value={Math.max(0, currentMonthStats?.netProfit || 0)}
                                    total={currentMonthStats?.totalRevenue || 1}
                                    color="#10b981"
                                    centerLabel={
                                        <div className="text-center">
                                            <span className="text-xl font-black text-primary block leading-none">{Math.round((currentMonthStats?.netProfit / (currentMonthStats?.totalRevenue || 1)) * 100 || 0)}%</span>
                                        </div>
                                    }
                                />
                            </div>
                        </div>
                        <div className="mt-auto pt-4 w-full flex flex-col items-center gap-1.5">
                            <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <p className="text-[10px] font-black text-emerald-500">{formatCurrency(currentMonthStats?.netProfit || 0, settings.currency)}</p>
                            </div>
                            <p className="text-[8px] font-bold text-muted uppercase tracking-[0.1em] opacity-40">{t.netProfit}</p>
                        </div>
                    </div>

                    {/* 3. Students Pie Chart */}
                    <div className="bg-card border border-border-subtle rounded-3xl p-5 sm:p-6 shadow-lg flex flex-col items-center min-h-[340px] h-full">
                        <div className="w-full h-8 flex items-start justify-center">
                            <p className="text-[10px] font-black text-muted tracking-[0.2em] text-center leading-tight uppercase opacity-60 px-2 line-clamp-2">{t.students3m}</p>
                        </div>
                        <div className="h-44 w-full flex items-center justify-center">
                            <div className="scale-110">
                                <PieChart
                                    size={100}
                                    thickness={12}
                                    data={[
                                        { label: t.oldLabel, value: Math.max(0, extraStats.totalStudents - extraStats.newStudents3m), color: '#6366f1' },
                                        { label: t.new, value: extraStats.newStudents3m, color: '#10b981' },
                                        { label: t.leftLabel, value: extraStats.leftStudents3m, color: '#ef4444' }
                                    ]}
                                    centerLabel={
                                        <div className="text-center">
                                            <span className="text-xl font-black text-primary block leading-none">{extraStats.totalStudents}</span>
                                            <span className="text-[8px] text-muted font-bold block tracking-tighter opacity-40">{t.total}</span>
                                        </div>
                                    }
                                />
                            </div>
                        </div>
                        <div className="mt-auto pt-4 flex flex-col items-start gap-1 w-full max-w-[140px] border-t border-border-subtle/30 cursor-default">
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                    <p className="text-[8px] font-black text-primary opacity-60 uppercase tracking-tight">{t.oldLabel}</p>
                                </div>
                                <span className="text-[8px] font-black text-indigo-500">{Math.max(0, extraStats.totalStudents - extraStats.newStudents3m)}</span>
                            </div>
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    <p className="text-[8px] font-black text-emerald-500 uppercase tracking-tight">{t.new}</p>
                                </div>
                                <span className="text-[8px] font-black text-emerald-500">{extraStats.newStudents3m}</span>
                            </div>
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                    <p className="text-[8px] font-black text-red-500 uppercase tracking-tight">{t.leftLabel}</p>
                                </div>
                                <span className="text-[8px] font-black text-red-500">{extraStats.leftStudents3m}</span>
                            </div>
                        </div>
                    </div>

                    {/* 4. Subscriptions Pie Chart */}
                    <div className="bg-card border border-border-subtle rounded-3xl p-5 sm:p-6 shadow-lg flex flex-col items-center min-h-[340px] h-full">
                        <div className="w-full h-8 flex items-start justify-center">
                            <p className="text-[10px] font-black text-muted tracking-[0.2em] text-center leading-tight uppercase opacity-60 px-2 line-clamp-2">{t.activeSubscriptions}</p>
                        </div>
                        <div className="h-44 w-full flex items-center justify-center">
                            <div className="scale-110">
                                <PieChart
                                    size={100}
                                    thickness={12}
                                    data={[
                                        { label: t.active, value: extraStats.activeSubs, color: '#10b981' },
                                        { label: t.inactive, value: extraStats.inactiveSubs, color: '#e2e8f080' }
                                    ]}
                                    centerLabel={
                                        <div className="text-center">
                                            <span className="text-xl font-black text-primary block leading-none">{extraStats.activeSubs}</span>
                                            <span className="text-[8px] text-muted font-bold block tracking-tighter opacity-40">{t.active}</span>
                                        </div>
                                    }
                                />
                            </div>
                        </div>
                        <div className="mt-auto pt-4 flex flex-col items-start gap-1 w-full max-w-[140px] border-t border-border-subtle/30 cursor-default">
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    <p className="text-[8px] font-black text-emerald-500 uppercase tracking-tight">{t.active}</p>
                                </div>
                                <span className="text-[8px] font-black text-emerald-500">{extraStats.activeSubs}</span>
                            </div>
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-200 shrink-0" />
                                    <p className="text-[8px] font-black text-primary opacity-20 uppercase tracking-tight">{t.inactive}</p>
                                </div>
                                <span className="text-[8px] font-black text-primary opacity-20">{extraStats.inactiveSubs}</span>
                            </div>
                        </div>
                    </div>
                </div>


                {/* Bar Charts Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {/* 5. Revenue Chart (Bar) */}
                    <div className="bg-card border border-border-subtle rounded-3xl p-6 sm:p-8 shadow-lg min-h-[320px] flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <h2 className="text-sm sm:text-base font-black text-primary tracking-tight">{t.revenue}</h2>
                        </div>
                        <div className="flex-1">
                            {revenueChartData.length > 0 ? (
                                <SimpleBarChart data={revenueChartData} maxValue={revenueMax} colorClass="bg-gradient-to-t from-indigo-500 to-indigo-400" />
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted opacity-40 text-xs">{t.noData}</div>
                            )}
                        </div>
                    </div>

                    {/* 6. Attendance Chart (Bar) */}
                    <div className="bg-card border border-border-subtle rounded-3xl p-6 sm:p-8 shadow-lg min-h-[320px] flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600">
                                <CalendarCheck className="w-5 h-5" />
                            </div>
                            <h2 className="text-sm sm:text-base font-black text-primary tracking-tight">{t.attendanceRate}</h2>
                        </div>
                        <div className="flex-1">
                            {attendanceChartData.length > 0 ? (
                                <SimpleBarChart data={attendanceChartData} maxValue={100} colorClass="bg-gradient-to-t from-violet-500 to-violet-400" />
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted opacity-40 text-xs">{t.noData}</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Analytics Section - Premium Bento Evolution */}
            <div className="bg-card border border-border-subtle rounded-[2.5rem] overflow-hidden shadow-sm mt-12 mb-12 group/bento">
                <button 
                    onClick={() => setShowDetailed(!showDetailed)}
                    className="w-full px-8 py-8 flex items-center justify-between hover:bg-surface/30 transition-all group"
                >
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200 group-hover:scale-110 transition-transform">
                            <Calculator className="w-7 h-7" />
                        </div>
                        <div className="text-left">
                            <h2 className="text-2xl font-black text-primary tracking-tighter uppercase">{l('ვრცელი სტატისტიკა', 'Подробная статистика', 'Detailed Statistics')}</h2>
                            <p className="text-xs font-bold text-muted tracking-wide opacity-60 mt-1">
                                {showDetailed ? l('დახურვა', 'Закрыть', 'Click to collapse summary') : l('გაშლა დეტალური ინტელექტისთვის', 'Развернуть для детального интеллекта', 'Expand for deep business intelligence')}
                            </p>
                        </div>
                    </div>
                    <div className={cn("w-12 h-12 rounded-full bg-surface border border-border-subtle flex items-center justify-center transition-all duration-500 shadow-inner", showDetailed ? "rotate-90 bg-indigo-600 text-white border-indigo-600" : "group-hover:bg-card")}>
                        <ChevronRight className="w-6 h-6 opacity-60 group-hover:opacity-100" />
                    </div>
                </button>

                {showDetailed && (
                    <div className="px-8 pb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                        {/* Premium Bento Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            
                            {/* 1. Student Intelligence (MoM Performance) */}
                            <div className="lg:col-span-2 bg-gradient-to-br from-indigo-50/50 to-white rounded-[2rem] border border-indigo-100/50 p-6 flex flex-col md:flex-row gap-6 relative overflow-hidden group hover:shadow-2xl hover:shadow-indigo-100 transition-all duration-500">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                                
                                <div className="flex-1 space-y-8">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                                            <TrendingUp className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="text-base font-black text-primary uppercase tracking-tight">{l('ფინანსური ზრდის ანალიზი', 'Анализ финансового роста', 'Financial Growth Analysis')}</h4>
                                            <p className="text-[9px] font-black text-muted uppercase tracking-widest opacity-40">{l('თვიური დინამიკა (MoM)', 'Месячная динамика', 'Monthly Pulse')}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-muted uppercase tracking-widest opacity-60">{l('შემოსავალი', 'Доход', 'Revenue')}</p>
                                            <p className="text-2xl font-black text-primary tabular-nums tracking-tighter">{formatCurrency(currentMonthStats?.totalRevenue || 0, settings.currency)}</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                <span className={cn("text-[9px] font-black flex items-center", currentMonthStats?.totalRevenue >= (extraStats.prevMonthRevenue || 0) ? "text-emerald-500" : "text-rose-500")}>
                                                    {currentMonthStats?.totalRevenue >= (extraStats.prevMonthRevenue || 0) ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                                                    {extraStats.prevMonthRevenue > 0 
                                                        ? (currentMonthStats?.totalRevenue >= extraStats.prevMonthRevenue 
                                                            ? `${Math.round((currentMonthStats.totalRevenue / extraStats.prevMonthRevenue - 1) * 100)}%`
                                                            : formatCurrency(Math.abs(currentMonthStats.totalRevenue - extraStats.prevMonthRevenue), settings.currency))
                                                        : '+100%'}
                                                </span>
                                                <span className="text-[8px] text-muted font-bold opacity-40 uppercase">vs Last Month</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-muted uppercase tracking-widest opacity-60">{l('ზრდა', 'Рост', 'Growth')}</p>
                                            <p className="text-2xl font-black text-emerald-600 tabular-nums tracking-tighter">+{Math.round((currentMonthStats?.newStudents || 0) / (extraStats.totalStudents || 1) * 100)}%</p>
                                            <p className="text-[8px] text-muted font-bold opacity-40 uppercase mt-1">Expansion Index</p>
                                        </div>
                                        <div className="hidden lg:block space-y-1">
                                            <p className="text-[9px] font-black text-muted uppercase tracking-widest opacity-60">{l('შენარჩუნება', 'Удержание', 'Retention')}</p>
                                            <div className="flex items-baseline gap-2">
                                                <p className="text-2xl font-black text-indigo-600 tabular-nums tracking-tighter">
                                                    {extraStats.totalStudents > 0 ? Math.round((extraStats.activeSubs / extraStats.totalStudents) * 100) : 0}%
                                                </p>
                                                <span className="text-[10px] font-black text-indigo-600/40">({extraStats.activeSubs || 0} {l('სტუდ.', 'студ.', 'stud.')})</span>
                                            </div>
                                            <p className="text-[8px] text-muted font-bold opacity-40 uppercase mt-1">Loyalty Score</p>
                                        </div>
                                    </div>

                                    <div className="h-2.5 bg-indigo-100 rounded-full overflow-hidden shadow-inner">
                                        <div className="h-full bg-indigo-600 rounded-full transition-all duration-1000 w-[65%]" />
                                    </div>
                                </div>
                            </div>
                            
                            {/* 2. Churn Risk (Alert Card) */}
                            <div className="bg-rose-500/5 rounded-[2rem] border border-rose-500/10 p-6 hover:bg-rose-500/10 transition-all duration-300 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-[60px]" />
                                <div className="space-y-4 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 shadow-sm border border-rose-500/20">
                                            <AlertCircle className="w-5 h-5" />
                                        </div>
                                        <h4 className="text-sm font-black text-rose-700 uppercase tracking-wider">{l('სტუდიის დატოვების რისკი', 'Риск ухода из студии', 'Risk of leaving')}</h4>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        {extraStats.churnRiskStudents?.slice(0, 3).map((s: any) => (
                                            <div key={s.id} className="flex items-center justify-between group/item p-3 bg-white/40 rounded-2xl border border-rose-500/10 hover:bg-white transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("w-2 h-2 rounded-full", s.risk === 'high' ? "bg-red-500 animate-pulse" : "bg-orange-400")} />
                                                    <span className="text-sm font-bold text-primary">{s.name}</span>
                                                </div>
                                                <ArrowUpRight className="w-4 h-4 text-rose-500 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                            </div>
                                        ))}
                                        {(extraStats.churnRiskStudents?.length || 0) === 0 && (
                                            <div className="flex flex-col items-center justify-center py-6 text-center">
                                                <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-20 mb-2" />
                                                <p className="text-xs text-muted font-bold opacity-60 uppercase tracking-widest">{l('რისკები არ არის', 'Рисков нет', 'Healthy metrics')}</p>
                                            </div>
                                        )}
                                    </div>

                                    {extraStats.churnRiskStudents?.length > 3 && (
                                        <button className="w-full py-3 bg-rose-500 text-white text-[10px] font-black rounded-xl uppercase tracking-[0.2em] shadow-lg shadow-rose-200 hover:scale-105 active:scale-95 transition-all">
                                            {l('იხილეთ ყველა', 'Смотреть всех', 'View All Risks')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* 3. Financial Intelligence Card */}
                            <div className="bg-emerald-500/5 rounded-[2rem] border border-emerald-500/10 p-6 flex flex-col justify-between hover:bg-emerald-500/10 transition-all duration-300">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                                            <TrendingUp className="w-5 h-5" />
                                        </div>
                                        <h4 className="text-sm font-black text-primary uppercase tracking-wider opacity-60">{l('მოგების ანალიზი', 'Анализ прибыли', 'Profit Intelligence')}</h4>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">{l('სუფთა მოგება (მარჟა)', 'Чистая прибыль (Маржа)', 'Net Profit (Margin)')}</p>
                                        <div className="flex items-end gap-2">
                                            <p className="text-3xl font-black text-emerald-600 tabular-nums">{extraStats.profitMargin?.toFixed(1)}%</p>
                                            <ArrowUpRight className="w-5 h-5 text-emerald-500 mb-1" />
                                        </div>
                                        <p className="text-[11px] font-bold text-muted/60 mt-2">
                                            {l(
                                                `თქვენი სუფთა მოგება ამ თვეში არის ${formatCurrency(extraStats.netProfit || 0, settings.currency)} ${formatCurrency(extraStats.subRevenue + extraStats.prodRevenue, settings.currency)}-დან.`,
                                                `Ваша чистая прибыль за этот месяц составляет ${formatCurrency(extraStats.netProfit || 0, settings.currency)} из ${formatCurrency(extraStats.subRevenue + extraStats.prodRevenue, settings.currency)}.`,
                                                `Your net profit this month is ${formatCurrency(extraStats.netProfit || 0, settings.currency)} out of ${formatCurrency(extraStats.subRevenue + extraStats.prodRevenue, settings.currency)}.`
                                            )}
                                        </p>
                                    </div>
                                    <div className="pt-4 grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-white/40 rounded-2xl border border-emerald-500/5">
                                            <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">{l('საშ. ჩეკი (ARPU)', 'Ср. чек (ARPU)', 'Avg Ticket (ARPU)')}</p>
                                            <p className="text-sm font-black text-primary">{formatCurrency(extraStats.arpu || 0, settings.currency)}</p>
                                        </div>
                                        <div className="p-4 bg-white/40 rounded-2xl border border-rose-500/5">
                                            <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">{l('პასიური (გასაახლებელი)', 'Не продлили', 'Late Renewals')}</p>
                                            <p className="text-sm font-black text-rose-600">{(extraStats.lateRenewals || []).length} {l('სტუდ.', 'студ.', 'stud.')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Financial Comparison (Yearly/Monthly Focus) */}
                            <div className="bg-blue-500/5 rounded-[2rem] border border-blue-500/10 p-6 flex flex-col justify-between hover:bg-blue-500/10 transition-all duration-300">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                                            <BarChart3 className="w-5 h-5" />
                                        </div>
                                        <h4 className="text-sm font-black text-primary uppercase tracking-wider opacity-60">{l('ზრდის შედარება', 'Сравнение роста', 'Growth Comparison')}</h4>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div className="p-3 rounded-2xl bg-white/40 border border-blue-500/5">
                                            <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-1">{l('წინა თვე (MoM)', 'Прошлый месяц (MoM)', 'vs Last Month (MoM)')}</p>
                                            <div className="flex items-center justify-between">
                                                <p className="text-lg font-black text-primary tabular-nums">{formatCurrency(extraStats.prevMonthRevenue || 0, settings.currency)}</p>
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-lg text-[9px] font-black",
                                                    (extraStats.totalGrossRevenue >= (extraStats.prevMonthRevenue || 0)) ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
                                                )}>
                                                    {extraStats.prevMonthRevenue > 0 
                                                        ? (extraStats.totalGrossRevenue >= extraStats.prevMonthRevenue 
                                                            ? `${Math.round(((extraStats.totalGrossRevenue / extraStats.prevMonthRevenue) - 1) * 100)}%`
                                                            : formatCurrency(Math.abs(extraStats.totalGrossRevenue - extraStats.prevMonthRevenue), settings.currency))
                                                        : '+100%'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-white/40 border border-blue-500/5">
                                            <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">{l('წინა წელი (YoY)', 'Прошлый год (YoY)', 'vs Last Year (YoY)')}</p>
                                            <div className="flex items-center justify-between">
                                                <p className="text-xl font-black text-primary tabular-nums">{formatCurrency(extraStats.prevYearRevenue || 0, settings.currency)}</p>
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-lg text-[10px] font-black",
                                                    (extraStats.totalGrossRevenue >= (extraStats.prevYearRevenue || 0)) ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
                                                )}>
                                                    {extraStats.prevYearRevenue > 0 ? `${Math.round(((extraStats.totalGrossRevenue / extraStats.prevYearRevenue) - 1) * 100)}%` : '+100%'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t border-blue-500/5">
                                    <p className="text-[10px] font-bold text-muted/60 leading-relaxed italic">
                                        {l('ფინანსური აქცენტი: სტაბილური ზრდა უზრუნველყოფს სტუდიის განვითარებას.', 'Финансовый акцент: стабильный рост обеспечивает развитие студии.', 'Financial Focus: Consistent growth ensures studio development.')}
                                    </p>
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>

            {/* Salary Calculation Section */}
            <div id="salaries-section" className="bg-card border border-border-subtle rounded-[2.5rem] overflow-hidden shadow-sm">
                <div className="px-8 py-6 border-b border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                            <Calculator className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-black text-primary tracking-tight">{t.salaryCalculation}</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <MonthNavigator
                            selectedMonth={selectedMonth}
                            onSelect={setSelectedMonth}
                            t={t}
                            className="scale-90"
                        />
                        <div className="h-8 w-px bg-border-subtle mx-2 hidden md:block" />
                        <div className="flex items-center gap-2">
                            <div className="text-right hidden sm:block">
                                <p className="text-[9px] font-black text-muted tracking-widest opacity-40">{t.totalSalaries}</p>
                                <p className="text-sm font-black text-primary tabular-nums">{formatCurrency(totalCalculated, settings.currency)}</p>
                            </div>
                            <button
                                onClick={() => setShowSalaries(!showSalaries)}
                                className={cn(
                                    "p-2.5 rounded-xl border transition-all active:scale-95",
                                    showSalaries ? "bg-rose-500 border-rose-600 text-white shadow-lg shadow-rose-500/20" : "bg-surface border-border-subtle text-muted"
                                )}
                            >
                                {showSalaries ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-surface/30">
                                <th className="px-8 py-4 text-left text-[10px] font-black text-muted tracking-[0.2em] opacity-40">{t.teacherTable}</th>
                                <th className="px-8 py-4 text-center text-[10px] font-black text-muted tracking-[0.2em] opacity-40">{t.typeTable}</th>
                                <th className="px-8 py-4 text-center text-[10px] font-black text-muted tracking-[0.2em] opacity-40">{t.volumeTable}</th>
                                {showSalaries && (
                                    <>
                                        <th className="px-8 py-4 text-center text-[10px] font-black text-muted tracking-[0.2em] opacity-40">{t.bonusTable}</th>
                                        <th className="px-8 py-4 text-center text-[10px] font-black text-muted tracking-[0.2em] opacity-40">{t.totalAmount}</th>
                                    </>
                                )}
                                <th className="px-8 py-4 text-right text-[10px] font-black text-muted tracking-[0.2em] opacity-40">{t.statusTable}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/50">
                            {salaryData.length > 0 ? salaryData.map((item, i) => (
                                <tr key={i} className="group hover:bg-surface/40 transition-colors">
                                    <td className="px-8 py-5">
                                        <p className="text-sm font-black text-primary group-hover:text-rose-600 transition-colors tracking-tight">{item.teacher}</p>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider border",
                                            item.type === 'Monthly' ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" : 
                                            item.type === 'Hourly' ? "bg-violet-500/10 text-violet-600 border-violet-500/20" :
                                            item.type === 'Combined' ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                            "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                        )}>
                                            {item.type === 'Monthly' ? t.monthly : 
                                             item.type === 'Hourly' ? t.hourly : 
                                             item.type === 'Percentage' ? t.percentageShort || 'Share' :
                                             item.type === 'Combined' ? l('კომბინირებული', 'Комбинир.', 'Combined') : item.type}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <span className="text-xs font-black text-primary tabular-nums">{typeof item.rate === 'number' ? formatCurrency(item.rate, settings.currency) : item.rate}</span>
                                    </td>
                                    {showSalaries ? (
                                        <>
                                            <td className="px-8 py-5 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="text-[10px] font-black text-emerald-600/40">+</span>
                                                    <input
                                                        type="number"
                                                        value={item.bonus || ''}
                                                        onChange={(e) => setTeacherBonus(item.id, selectedMonth, Number(e.target.value))}
                                                        className="w-16 bg-transparent border-none focus:outline-none text-xs font-black text-emerald-600 tabular-nums p-0 placeholder:text-muted/10 text-center"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <span className="text-sm font-black text-primary tabular-nums">{formatCurrency(item.total, settings.currency)}</span>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-8 py-5 text-center"><span className="text-sm font-black text-primary/10 select-none">••••</span></td>
                                            <td className="px-8 py-5 text-center"><span className="text-sm font-black text-primary/10 select-none">••••</span></td>
                                        </>
                                    )}
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <button onClick={() => setEditingTeacher(item.fullObject)} className="p-2 rounded-lg bg-surface hover:bg-violet-500/10 text-muted hover:text-violet-600 transition-colors opacity-100 shadow-sm" title={t.edit || 'Edit'}>
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleDownloadTeacherPDF(item)} className="p-2 rounded-lg bg-surface hover:bg-indigo-500/10 text-muted hover:text-indigo-600 transition-colors opacity-100 shadow-sm" title={l('PDF გადმოწერა', 'Скачать PDF', 'Download PDF')}>
                                                <Download className="w-3.5 h-3.5" />
                                            </button>
                                            {getStatusForTeacher(item.id, selectedMonth) === 'pending' ? (
                                                <button 
                                                    onClick={() => toggleSalaryStatus(item.id, selectedMonth)}
                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black tracking-wider shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                                                >
                                                    <Banknote className="w-3.5 h-3.5" />
                                                    {t.pay}
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => toggleSalaryStatus(item.id, selectedMonth)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-wider border bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-sm"
                                                >
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {t.paidAmount}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="px-8 py-10 text-center">
                                        <p className="text-xs text-muted/40 font-medium italic">{t.salaryEmpty}</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Salary View */}
                <div className="md:hidden divide-y divide-border-subtle/30 px-4">
                    {salaryData.length > 0 ? salaryData.map((item, i) => (
                        <div key={i} className="py-4 space-y-3">
                            <div className="flex items-start justify-between">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-black text-primary tracking-tight truncate mb-0.5">{item.teacher}</p>
                                    <span className={cn(
                                        "px-1.5 py-0 rounded-md text-[7px] font-black tracking-wider border inline-block",
                                        item.type === 'Monthly' ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" : 
                                        item.type === 'Hourly' ? "bg-violet-500/10 text-violet-600 border-violet-500/20" :
                                        item.type === 'Combined' ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                        "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                    )}>
                                        {item.type === 'Monthly' ? t.monthly : 
                                         item.type === 'Hourly' ? t.hourly : 
                                         item.type === 'Percentage' ? t.percentageShort || 'Share' :
                                         item.type === 'Combined' ? l('კომბინირებული', 'Комбинир.', 'Combined') : item.type}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button onClick={() => handleDownloadTeacherPDF(item)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-500 shadow-sm hover:bg-indigo-100 transition-colors">
                                        <Download className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setEditingTeacher(item.fullObject)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-violet-50 border border-violet-100 text-violet-500 shadow-sm hover:bg-violet-100 transition-colors">
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    {getStatusForTeacher(item.id, selectedMonth) === 'pending' ? (
                                        <button 
                                            onClick={() => toggleSalaryStatus(item.id, selectedMonth)}
                                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white text-[8px] font-black tracking-wider shadow-lg active:scale-95"
                                        >
                                            {t.pay}
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => toggleSalaryStatus(item.id, selectedMonth)}
                                            className="h-7 px-2 rounded-full text-[8px] font-black tracking-wider border bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                        >
                                            {t.paidAmount}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 rounded-xl bg-surface/50 border border-border-subtle/50">
                                    <p className="text-[7px] font-black text-muted tracking-widest uppercase opacity-40 mb-0.5">{t.volumeTable}</p>
                                    <p className="text-[10px] font-black text-primary tabular-nums truncate">{typeof item.rate === 'number' ? formatCurrency(item.rate, settings.currency) : item.rate}</p>
                                </div>
                                <div className="p-2 rounded-xl bg-surface/50 border border-border-subtle/50">
                                    <p className="text-[7px] font-black text-muted tracking-widest uppercase opacity-40 mb-0.5">{t.bonusTable}</p>
                                    <div className="flex items-center gap-0.5">
                                        <span className="text-[9px] font-black text-emerald-600/40">+</span>
                                        <input
                                            type="number"
                                            value={item.bonus || ''}
                                            onChange={(e) => setTeacherBonus(item.id, selectedMonth, Number(e.target.value))}
                                            className="w-full bg-transparent border-none focus:outline-none text-[10px] font-black text-emerald-600 tabular-nums p-0"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-between">
                                <span className="text-[9px] font-black text-indigo-600/60 tracking-widest uppercase">{t.totalAmount}</span>
                                {showSalaries ? (
                                    <span className="text-sm font-black text-indigo-600 tabular-nums">{formatCurrency(item.total, settings.currency)}</span>
                                ) : (
                                    <span className="text-sm font-black text-indigo-600/20 select-none">••••</span>
                                )}
                            </div>
                        </div>
                    )) : (
                        <div className="py-10 text-center">
                            <p className="text-xs text-muted/40 font-medium italic">{t.salaryEmpty}</p>
                        </div>
                    )}
                </div>

                <div className="bg-surface/30 px-8 py-6 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-8">
                        <div>
                            <p className="text-[10px] font-black text-muted tracking-widest opacity-40 mb-1">{t.totalPaidThisMonth}</p>
                            <p className="text-xl font-black text-emerald-600 tabular-nums">
                                {formatCurrency(
                                    salaryData.filter(s => getStatusForTeacher(s.id, selectedMonth) === 'paid').reduce((acc, curr) => acc + curr.total, 0),
                                    settings.currency
                                )}
                            </p>
                        </div>
                        <div className="w-px h-8 bg-border-subtle hidden sm:block" />
                        <div>
                            <p className="text-[10px] font-black text-muted tracking-widest opacity-40 mb-1">{t.totalPendingThisMonth}</p>
                            <p className="text-xl font-black text-amber-600 tabular-nums">
                                {formatCurrency(
                                    salaryData.filter(s => getStatusForTeacher(s.id, selectedMonth) === 'pending').reduce((acc, curr) => acc + curr.total, 0),
                                    settings.currency
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Groups Table */}
            <div className="bg-card border border-border-subtle rounded-[2.5rem] overflow-hidden shadow-sm">
                <div className="px-8 py-6 border-b border-border-subtle flex items-center justify-between bg-surface/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                            <Users className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-black text-primary tracking-tight">{t.popularGroups}</h2>
                    </div>
                </div>
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-surface/10">
                                <th className="px-8 py-4 text-left text-[10px] font-black text-muted tracking-[0.2em] opacity-40">{t.groupName}</th>
                                <th className="px-8 py-4 text-center text-[10px] font-black text-muted tracking-[0.2em] opacity-40">{t.students}</th>
                                <th className="px-8 py-4 text-center text-[10px] font-black text-muted tracking-[0.2em] opacity-40">{t.revenue}</th>
                                <th className="px-8 py-4 text-right text-[10px] font-black text-muted tracking-[0.2em] opacity-40">{l('ზრდა', 'Рост', 'Growth')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/50">
                            {topGroupsData.length > 0 ? topGroupsData.map((group, i) => (
                                <tr key={i} className="group hover:bg-surface/40 transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-[10px] font-black text-primary opacity-60">
                                                {String(i + 1).padStart(2, '0')}
                                            </div>
                                            <span className="text-sm font-black text-primary group-hover:text-indigo-600 transition-colors">{group.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <span className="text-sm font-black text-primary tabular-nums">{group.students}</span>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <span className="text-sm font-black text-primary tabular-nums">{formatCurrency(group.revenue, settings.currency)}</span>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <span className={cn("text-xs font-black tracking-tight", group.growth.startsWith('+') ? "text-emerald-600" : "text-red-500")}>
                                            {group.growth}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="px-8 py-10 text-center">
                                        <p className="text-xs text-muted/40 font-medium italic">{t.groupsEmpty}</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Popular Groups UI */}
                <div className="md:hidden divide-y divide-border-subtle/30 px-4">
                    {topGroupsData.length > 0 ? topGroupsData.map((group, i) => (
                        <div key={i} className="py-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center text-[10px] font-black text-primary opacity-60">
                                        {String(i + 1).padStart(2, '0')}
                                    </div>
                                    <span className="text-sm font-black text-primary">{group.name}</span>
                                </div>
                                <span className={cn("text-xs font-black tracking-tight", group.growth.startsWith('+') ? "text-emerald-600" : "text-red-500")}>
                                    {group.growth}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 bg-surface/30 rounded-2xl p-4 border border-border-subtle/20">
                                <div>
                                    <p className="text-[9px] font-black text-muted tracking-widest uppercase opacity-40 mb-1">{t.students}</p>
                                    <p className="text-sm font-black text-primary tabular-nums">{group.students}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-muted tracking-widest uppercase opacity-40 mb-1">{t.revenue}</p>
                                    <p className="text-sm font-black text-primary tabular-nums">{formatCurrency(group.revenue, settings.currency)}</p>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="py-10 text-center">
                            <p className="text-xs text-muted/40 font-medium italic">{t.groupsEmpty}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Insights Footer */}
            <div className="bg-indigo-600 rounded-3xl sm:rounded-[2rem] p-5 sm:p-6 md:p-10 flex flex-col md:flex-row items-center gap-4 sm:gap-6 md:gap-10 shadow-2xl shadow-indigo-600/40 relative overflow-hidden w-full">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />

                <div className="flex-1 text-center md:text-left space-y-2 relative z-10 w-full">
                    <h3 className="text-lg sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">{t.aiInsightTitle || l('AI ანალიტიკა', 'AI Аналитика', 'AI Analytics')}</h3>
                    <div className="space-y-1.5 flex flex-col items-center md:items-start">
                        <p className="text-indigo-100 text-[11px] sm:text-sm md:text-base font-medium opacity-90 max-w-md">
                            {prevMonthStats && currentMonthStats ? (
                                currentMonthStats.totalRevenue > prevMonthStats.totalRevenue
                                    ? t.aiRevenueUp.replace('{percent}', Math.round((currentMonthStats.totalRevenue / (prevMonthStats.totalRevenue || 1) - 1) * 100).toString())
                                    : t.aiRevenueStable
                            ) : t.aiInsightDesc}
                        </p>
                        <p className="text-indigo-200/60 text-[9px] sm:text-xs font-bold tracking-widest flex items-center gap-1 sm:gap-2">
                            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            {t.aiAnalysisReady}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 relative z-10 w-full md:w-auto shrink-0 mt-2 md:mt-0">
                    <button onClick={() => setShowInsightsModal(true)}
                        className="w-full md:w-auto px-6 py-4 sm:px-10 sm:py-5 bg-white text-indigo-600 text-xs sm:text-sm font-black rounded-xl sm:rounded-3xl transition-all shadow-xl hover:shadow-black/20 hover:scale-105 active:scale-95 whitespace-nowrap tracking-widest text-center">
                        {t.aiInsightDetails}
                    </button>
                </div>
            </div>

            {/* AI Insights Modal */}
            <AIInsightModal
                open={showInsightsModal}
                onClose={() => setShowInsightsModal(false)}
                currentStats={currentMonthStats}
                prevStats={prevMonthStats}
                selectedMonth={selectedMonth}
                t={t}
                l={l}
            />

            {/* Teacher Editor Modal */}
            <TeacherModal
                open={!!editingTeacher}
                teacher={editingTeacher}
                groups={getGroups()}
                onClose={() => setEditingTeacher(null)}
                onSave={(data) => {
                    if (editingTeacher?.id) {
                        updateTeacher(editingTeacher.id, data);
                        setSelectedMonth(prev => { const v = prev; return v; });
                    }
                    setEditingTeacher(null);
                }}
            />

            {/* Expense Manager Modal */}
            <ExpenseModal 
                open={showExpenseModal}
                onClose={() => setShowExpenseModal(false)}
                selectedMonth={selectedMonth}
                branchId={settings.activeBranchId || 'default'}
                t={t}
                l={l}
                settings={settings}
            />
        </div>
    );
}
