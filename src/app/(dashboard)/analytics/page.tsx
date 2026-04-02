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
import { getExpenses, saveExpenses, MonthlyExpenses } from '@/lib/expense-store';
import { getStudentCheckins } from '@/lib/checkin-store';

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
            <button onClick={goToPrev} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-card text-muted hover:text-primary transition-colors">
                <ChevronLeft className="w-4 h-4" strokeWidth={3} />
            </button>
            <div className="min-w-[110px] text-center px-1">
                <p className="text-[10px] font-black text-primary tracking-wider">{displayMonth} {year}</p>
            </div>
            <button onClick={goToNext} disabled={isCurrentMonth()} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-card text-muted hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight className="w-4 h-4" strokeWidth={3} />
            </button>
        </div>
    );
}

// ─── Expense Modal ───────────────────────────────────────────────────────────

function ExpenseModal({ open, onClose, selectedMonth, branchId, t, l, settings }: any) {
    const [expenses, setExpenses] = useState<MonthlyExpenses>(getExpenses(selectedMonth, branchId));
    useEffect(() => {
        if (open) {
            setExpenses(getExpenses(selectedMonth, branchId));
        }
    }, [open, selectedMonth, branchId]);

    if (!open) return null;

    const fields = [
        { key: 'rent', label: t.rent, icon: Banknote },
        { key: 'electricity', label: t.electricity, icon: Settings2 },
        { key: 'gas', label: t.gas, icon: Settings2 },
        { key: 'water', label: t.water, icon: Settings2 },
        { key: 'cleaner', label: t.cleaner, icon: Users },
        { key: 'accountant', label: t.accountant, icon: CreditCard },
        { key: 'manager', label: t.manager, icon: Users },
        { key: 'other', label: t.otherExpenses, icon: Receipt },
    ];

    const total = Object.values(expenses).reduce((a, b) => (a || 0) + (b || 0), 0);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 animate-in fade-in duration-300">
            <div className="bg-card border border-border-subtle w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                <div className="px-8 py-6 border-b border-border-subtle flex items-center justify-between bg-surface/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                            <Receipt className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-primary tracking-tight">{t.manageExpenses}</h2>
                            <p className="text-[10px] font-black text-muted tracking-widest uppercase opacity-40">{selectedMonth}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface text-muted transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {fields.map((f) => (
                            <div key={f.key} className="space-y-1.5 focus-within:scale-[1.02] transition-transform">
                                <label className="text-[10px] font-black text-muted tracking-widest uppercase ml-1 opacity-50 flex items-center gap-1.5">
                                    <f.icon className="w-3 h-3" />
                                    {f.label}
                                </label>
                                <div className="relative group">
                                    <input
                                        type="number"
                                        value={expenses[f.key as keyof MonthlyExpenses] || ''}
                                        onChange={(e) => setExpenses(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
                                        className="w-full bg-surface border border-border-subtle rounded-2xl px-5 py-4 text-sm font-black text-primary transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 group-hover:bg-card"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted/30 uppercase">{settings.currency}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="px-8 py-6 bg-surface/50 border-t border-border-subtle flex flex-col sm:flex-row items-center gap-4 justify-between">
                    <div>
                        <p className="text-[10px] font-black text-muted tracking-widest uppercase opacity-40">{t.totalExpenses}</p>
                        <p className="text-2xl font-black text-primary">{formatCurrency(total, settings.currency)}</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => {
                                const zeroed = {
                                    rent: 0, electricity: 0, gas: 0, water: 0,
                                    cleaner: 0, accountant: 0, manager: 0, other: 0
                                };
                                setExpenses(zeroed);
                            }}
                            className="flex-1 sm:flex-none px-6 py-4 bg-rose-500/10 text-rose-600 text-[10px] font-black rounded-2xl hover:bg-rose-500/20 active:scale-95 transition-all tracking-widest uppercase"
                        >
                            {l('ყველას განულება', 'Обнулить всё', 'Reset to Zero')}
                        </button>
                        <button
                            onClick={() => {
                                saveExpenses(selectedMonth, branchId, expenses);
                                onClose();
                            }}
                            className="flex-1 sm:flex-none px-8 py-4 bg-indigo-600 text-white text-[10px] font-black rounded-2xl shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all tracking-widest uppercase"
                        >
                            {t.saveAction}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, change, trend, icon: Icon, color }: any) {
    const { t } = useT();
    const isUp = trend === 'up';

    return (
        <div className="bg-card border border-border-subtle rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:shadow-black/5 transition-all group">
            <div className="flex items-center justify-between mb-4">
                <div className={cn(
                    "w-12 h-12 rounded-2xl border flex items-center justify-center transition-transform group-hover:scale-110",
                    color === 'indigo' && "bg-indigo-500/10 border-indigo-500/20 text-indigo-600",
                    color === 'emerald' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-600",
                    color === 'violet' && "bg-violet-500/10 border-violet-500/20 text-violet-600",
                    color === 'amber' && "bg-amber-500/10 border-amber-500/20 text-amber-600",
                    color === 'rose' && "bg-rose-500/10 border-rose-500/20 text-rose-600",
                )}>
                    <Icon className="w-6 h-6" />
                </div>
                <div className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider border",
                    isUp ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"
                )}>
                    {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {change}
                </div>
            </div>
            <p className="text-2xl font-black text-primary tabular-nums tracking-tighter mb-1">{value}</p>
            <p className="text-[11px] font-black text-muted tracking-[0.15em] opacity-40">{(t[label as keyof typeof t] as string) || label}</p>
        </div>
    );
}

// ─── Bar Chart ───────────────────────────────────────────────────────────────

function SimpleBarChart({ data, maxValue, colorClass }: { data: { label: string, value: number, isPercent?: boolean }[], maxValue: number, colorClass: string }) {
    return (
        <div className="flex items-end justify-between h-48 gap-3 px-2 mt-6">
            {data.map((d, i) => {
                const height = maxValue > 0 ? Math.max((d.value / maxValue) * 100, d.value > 0 ? 8 : 4) : 4;
                // Get the base color from colorClass
                const isEmerald = colorClass.includes('emerald');
                const isViolet = colorClass.includes('violet');
                const isIndigo = colorClass.includes('indigo');

                let barBg = colorClass;
                let hoverBg = isEmerald ? 'bg-emerald-600' : isViolet ? 'bg-violet-600' : 'bg-indigo-600';
                let shadowColor = isEmerald ? 'rgba(16,185,129,0.3)' : isViolet ? 'rgba(139,92,246,0.3)' : 'rgba(79,70,229,0.3)';

                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-3 group/bar animate-fade-up h-full" style={{ animationDelay: `${i * 100}ms` }}>
                        <div className="relative w-full flex justify-center items-end h-full">
                            {/* Bar Container */}
                            <div className="w-full max-w-[28px] bg-surface/50 border border-border-subtle/20 rounded-xl relative flex items-end overflow-hidden h-full group-hover/bar:bg-surface/80 transition-colors">
                                {/* Bar Fill */}
                                <div className={cn("w-full transition-all duration-1000 ease-out z-10 rounded-t-lg", barBg)}
                                    style={{ height: `${height}%`, boxShadow: d.value > 0 ? `0 0 20px ${shadowColor}` : 'none' }}>
                                    {/* Shimmer Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/bar:translate-x-full transition-transform duration-1000" />
                                </div>

                                <div className={cn("absolute -top-10 left-1/2 -translate-x-1/2 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl opacity-0 group-hover/bar:opacity-100 transition-all scale-75 group-hover/bar:scale-100 whitespace-nowrap shadow-2xl z-20 pointer-events-none", hoverBg)}>
                                    {Math.round(d.value)}{d.isPercent ? '%' : ''}
                                </div>
                            </div>
                        </div>
                        <span className="text-[10px] font-black text-muted tracking-wide opacity-60 group-hover/bar:opacity-100 transition-opacity truncate w-full text-center">{d.label}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ─── AI Insights Modal ───────────────────────────────────────────────────────

function AIInsightModal({ open, onClose, currentStats, prevStats, selectedMonth, t, l }: any) {
    if (!open) return null;

    const [year, monthIdx] = selectedMonth.split('-').map(Number);
    const months = [t.jan, t.feb, t.mar, t.apr, t.may, t.jun, t.jul, t.aug, t.sep, t.oct, t.nov, t.dec];
    const monthName = months[monthIdx - 1];

    const revenueGrowth = prevStats?.totalRevenue > 0
        ? Math.round((currentStats.totalRevenue / prevStats.totalRevenue - 1) * 100)
        : 0;
    const attendanceGrowth = prevStats?.attendanceRate > 0
        ? Math.round((currentStats.attendanceRate / prevStats.attendanceRate - 1) * 100)
        : 0;

    const insights = [
        {
            icon: '📈',
            title: t.revenueTrend,
            text: revenueGrowth > 0
                ? l(`შემოსავალი გაიზარდა ${revenueGrowth}%-ით წინა თვესთან შედარებით. გირჩევთ ამ ტემპის შენარჩუნებას.`, `Доход вырос на ${revenueGrowth}% по сравнению с прошлым месяцем. Рекомендуем поддерживать этот темп.`, `Revenue grew by ${revenueGrowth}% compared to last month. Maintain this momentum.`)
                : revenueGrowth < 0
                    ? l(`შემოსავალი შემცირდა ${Math.abs(revenueGrowth)}%-ით. გაზარდეთ მარკეტინგული აქტივობა ახალი სტუდენტების მოსაზიდად.`, `Доход снизился на ${Math.abs(revenueGrowth)}%. Увеличьте маркетинговую активность для привлечения новых студентов.`, `Revenue decreased by ${Math.abs(revenueGrowth)}%. Increase marketing to attract new students.`)
                    : l('შემოსავალი სტაბილურია. სცადეთ ახალი ჯგუფების შეთავაზება ზრდის სტიმულირებისთვის.', 'Доход стабилен. Попробуйте предложить новые группы для стимулирования роста.', 'Revenue is stable. Consider offering new groups to stimulate growth.'),
        },
        {
            icon: '🎯',
            title: t.attendanceAnalysis,
            text: attendanceGrowth > 0
                ? l(`დასწრება გაიზარდა ${attendanceGrowth}%-ით. ეს მიუთითებს სტუდენტების კმაყოფილებაზე და მოტივაციაზე.`, `Посещаемость выросла на ${attendanceGrowth}%. Это свидетельствует об удовлетворённости студентов.`, `Attendance grew by ${attendanceGrowth}%. This indicates high student satisfaction and motivation.`)
                : l('სტაბილური დასწრება. განიხილეთ სპეციალური პროგრამები დასწრების გასაუმჯობესებლად.', 'Стабильная посещаемость. Рассмотрите специальные программы для улучшения посещаемости.', 'Stable attendance. Consider special programs to improve turnout.'),
        },
        {
            icon: '💡',
            title: t.recommendations,
            text: l(
                `სტუდენტების შეკავებისთვის გირჩევთ: 1) ერთ-ერთი ყველაზე ეფექტური მეთოდია სტუდენტებთან პირადი კომუნიკაცია. 2) გამართეთ თვიური განსაკუთრებული გახსნილი გაკვეთილები. 3) შეიმუშავეთ ლოიალობის პროგრამა.`,
                `Для удержания студентов рекомендуем: 1) Личная коммуникация со студентами — один из самых эффективных методов. 2) Проводите ежемесячные открытые уроки. 3) Разработайте программу лояльности.`,
                `For student retention: 1) Personal communication is the most effective method. 2) Hold monthly open/trial classes. 3) Develop a loyalty program.`
            ),
        },
        {
            icon: '🏆',
            title: t.mostPopular,
            text: l(
                'გირჩევთ ყველაზე პოპულარული ჯგუფებისთვის დამატებითი საათების დამატება. ეს პირდაპირ გაზრდის შემოსავალს.',
                'Рекомендуем добавить дополнительные часы для самых популярных групп. Это напрямую увеличит доход.',
                'Add more sessions for your most popular groups. This directly increases revenue.'
            ),
        },
    ];

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/20 animate-in fade-in duration-200" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto bg-card border border-border-subtle rounded-[2rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                    {/* Header */}
                    <div className="sticky top-0 bg-card/90 backdrop-blur-sm border-b border-border-subtle rounded-t-[2rem] px-6 py-4 flex items-center justify-between z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                <Lightbulb className="w-5 h-5 text-indigo-500" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-primary">{t.aiInsightTitle}</h2>
                                <p className="text-[10px] text-muted font-medium opacity-60">{monthName} {year}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-primary transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Stats Summary */}
                    <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b border-border-subtle">
                        <div className={cn("p-3 rounded-xl border", revenueGrowth >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20")}>
                            <p className="text-[10px] font-bold text-muted opacity-60 mb-0.5">{t.totalRevenue || 'Revenue'}</p>
                            <p className={cn("text-lg font-black", revenueGrowth >= 0 ? "text-emerald-600" : "text-red-500")}>
                                {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth}%
                            </p>
                            <p className="text-[9px] text-muted opacity-50">{t.vsLastMonth}</p>
                        </div>
                        <div className={cn("p-3 rounded-xl border", attendanceGrowth >= 0 ? "bg-violet-500/5 border-violet-500/20" : "bg-amber-500/5 border-amber-500/20")}>
                            <p className="text-[10px] font-bold text-muted opacity-60 mb-0.5">{t.attendanceRate || 'Attendance'}</p>
                            <p className={cn("text-lg font-black", attendanceGrowth >= 0 ? "text-violet-600" : "text-amber-500")}>
                                {attendanceGrowth >= 0 ? '+' : ''}{attendanceGrowth}%
                            </p>
                            <p className="text-[9px] text-muted opacity-50">{t.vsLastMonth}</p>
                        </div>
                    </div>

                    {/* Insights */}
                    <div className="px-6 py-4 space-y-3">
                        {insights.map((insight, i) => (
                            <div key={i} className="p-3 sm:p-4 bg-surface/50 border border-border-subtle/50 rounded-xl">
                                <div className="flex items-center gap-2.5 mb-1.5">
                                    <span className="text-xl">{insight.icon}</span>
                                    <h3 className="text-[11px] font-black text-primary tracking-wider uppercase">{insight.title}</h3>
                                </div>
                                <p className="text-[11px] sm:text-xs text-muted leading-relaxed opacity-80">{insight.text}</p>
                            </div>
                        ))}
                    </div>

                    <div className="px-6 pb-6">
                        <button onClick={onClose}
                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-xl transition-all uppercase tracking-widest">
                            {t.close}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
    const { t, lang } = useT();
    const { settings } = useStudio();
    const { user, profile } = useUser();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    const [stats, setStats] = useState<any[]>([]);
    const [revenueChartData, setRevenueChartData] = useState<any[]>([]);
    const [attendanceChartData, setAttendanceChartData] = useState<any[]>([]);
    const [salaryData, setSalaryData] = useState<any[]>([]);
    const [topGroupsData, setTopGroupsData] = useState<any[]>([]);
    const [showSalaries, setShowSalaries] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(getLocalISODate(new Date()).slice(0, 7)); // YYYY-MM
    const [refreshToggle, setRefreshToggle] = useState(0);
    const [prevMonthStats, setPrevMonthStats] = useState<any>(null);
    const [currentMonthStats, setCurrentMonthStats] = useState<any>(null);
    const [editingTeacher, setEditingTeacher] = useState<any>(null);
    const [showInsightsModal, setShowInsightsModal] = useState(false);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpenses>(getExpenses(selectedMonth, settings.activeBranchId || 'default'));
    const [showDetailed, setShowDetailed] = useState(false);
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [extraStats, setExtraStats] = useState<any>({
        inactiveSubs: 0,
        newStudents3m: 0,
        leftStudents3m: 0,
        yearlyRevenue: 0,
        activeSubs: 0
    });

    const [currentInsightIndex, setCurrentInsightIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentInsightIndex(prev => (prev + 1) % Math.max(1, extraStats.suggestions?.length || 1));
        }, 6000);
        return () => clearInterval(timer);
    }, [extraStats.suggestions]);

    const handleExport = () => {
        // Collect Analytics Data
        const analyticsRows = [
            ['STUDIOFLOW BUSINESS REPORT'],
            [`Studio: ${settings.studioName || 'ClassCore Studio'}`],
            [`Month: ${selectedMonth}`],
            [''],
            ['SECTION', 'METRIC', 'VALUE'],
            ['Overview', 'Daily Average Revenue', formatCurrency(currentMonthStats?.totalRevenue / 30 || 0, settings.currency)],
            ['Overview', 'Total Monthly Revenue', formatCurrency(currentMonthStats?.totalRevenue || 0, settings.currency)],
            ['Gauges', 'Average Attendance Rate', `${Math.round(currentMonthStats?.attendanceRate || 0)}%`],
            ['Gauges', 'Projected Yearly Revenue', formatCurrency(extraStats.yearlyRevenue || 0, settings.currency)],
            ['Demographics', 'Total Registered Students', stats[1]?.value || 0],
            ['Demographics', 'Total Active Subscriptions', extraStats.activeSubs],
            [''],
            ['TEACHER SALARY BREAKDOWN'],
            ['TEACHER', 'TYPE', 'RATE', 'BONUS', 'TOTAL', 'STATUS']
        ];

        // Collect Salary Data
        const salaryRows = salaryData.map(s => [
            s.teacher,
            s.type,
            s.rate,
            formatCurrency(s.bonus, settings.currency),
            formatCurrency(s.total, settings.currency),
            getStatusForTeacher(s.id, selectedMonth)
        ]);

        const allRows = [...analyticsRows, ...salaryRows];
        const csvContent = allRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `studioflow_report_${selectedMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadTeacherPDF = (teacherData: any) => {
        const salaryWin = window.open('', '_blank');
        if (!salaryWin) return;
        
        const html = `
            <html>
            <head>
                <title>Salary Receipt - ${teacherData.teacher}</title>
                <style>
                    body { font-family: 'Inter', -apple-system, sans-serif; padding: 60px; color: #1e293b; max-width: 800px; margin: 0 auto; background: #fff; line-height: 1.5; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 30px; margin-bottom: 40px; }
                    .studio-info { text-align: left; }
                    .studio-name { font-size: 28px; font-weight: 800; color: #6366f1; letter-spacing: -0.025em; }
                    .studio-tag { color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-top: 4px; }
                    .receipt-info { text-align: right; }
                    .receipt-title { font-size: 14px; font-weight: 800; text-transform: uppercase; color: #6366f1; letter-spacing: 0.05em; margin-bottom: 4px; }
                    .receipt-date { font-size: 18px; font-weight: 700; color: #334155; }
                    
                    .content { background: #f8fafc; border-radius: 24px; padding: 32px; border: 1px solid #f1f5f9; }
                    .row { display: flex; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid #e2e8f0; }
                    .row:last-of-type { border-bottom: none; }
                    .label { color: #64748b; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
                    .value { color: #1e293b; font-weight: 700; font-size: 15px; }
                    
                    .total-box { margin-top: 40px; text-align: right; }
                    .total-label { color: #64748b; font-weight: 800; font-size: 14px; text-transform: uppercase; margin-right: 20px; }
                    .total-value { font-size: 32px; font-weight: 900; color: #6366f1; }
                    
                    .footer { margin-top: 80px; padding-top: 24px; border-top: 1px solid #f1f5f9; text-align: center; }
                    .footer-text { color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="studio-info">
                        <div class="studio-name">${settings.studioName || 'ClassCore Studio'}</div>
                        <div class="studio-tag">Professional Studio Management</div>
                    </div>
                    <div class="receipt-info">
                        <div class="receipt-title">Salary Statement</div>
                        <div class="receipt-date">${selectedMonth}</div>
                    </div>
                </div>
                
                <div class="content">
                    <div class="row"><span class="label">Teacher</span> <span class="value">${teacherData.teacher}</span></div>
                    <div class="row"><span class="label">Payment Type</span> <span class="value">${teacherData.type}</span></div>
                    <div class="row"><span class="label">Base Rate</span> <span class="value">${typeof teacherData.rate === 'number' ? formatCurrency(teacherData.rate, settings.currency) : teacherData.rate}</span></div>
                    <div class="row"><span class="label">Monthly Bonus</span> <span class="value">${formatCurrency(teacherData.bonus, settings.currency)}</span></div>
                </div>

                <div class="total-box">
                    <span class="total-label">Total Net Pay</span>
                    <span class="total-value">${formatCurrency(teacherData.total, settings.currency)}</span>
                </div>

                <div class="footer">
                    <div class="footer-text">Generated by StudioFlow Business Suite</div>
                </div>
            </body>
            </html>
        `;
        
        salaryWin.document.write(html);
        salaryWin.document.close();
        setTimeout(() => {
            salaryWin.print();
        }, 500);
    };

    useEffect(() => {
        const refreshAnalytics = (monthStr: string) => {
            const students = getStudents();
            const sales = getSales();
            const allSubsMap = getSubscriptions();
            const allSubs = Object.values(allSubsMap).flat();
            const teachers = getTeachers();
            const events = getEvents();
            const plans = getPlans();
            const groups = getGroups();

            // Plan prices map
            const planPrices: Record<string, number> = {};
            plans.forEach(p => { planPrices[p.name] = p.price; });

            // Active subscriptions count (as denominator for attendance)
            const activeSubStudentIds = new Set(
                allSubs.filter(sub => sub.status === 'active').map(sub => sub.student_id)
            );
            const activeSubCount = activeSubStudentIds.size;

            // Revenue & Subscriptions for this month
            const filteredSales = sales.filter(s => s.date?.startsWith(monthStr));
            const filteredSubs = allSubs.filter(sub => sub.purchased_at?.startsWith(monthStr));

            const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.price * s.quantity), 0) +
                filteredSubs.reduce((sum, sub) => sum + (sub.amount_paid || planPrices[sub.plan] || 0), 0);

            // Attendance Rate based on active subscriber count
            let totalCheckins = 0;
            let daysWithCheckins = 0;
            const daysInMonth = new Date(parseInt(monthStr.split('-')[0]), parseInt(monthStr.split('-')[1]), 0).getDate();

            for (let d = 1; d <= daysInMonth; d++) {
                const dStr = `${monthStr}-${String(d).padStart(2, '0')}`;
                const key = getScopedKey(`cc_checkins_${dStr}`);
                try {
                    const recs = JSON.parse(localStorage.getItem(key) || '[]');
                    if (recs.length > 0) {
                        totalCheckins += recs.length;
                        daysWithCheckins++;
                    }
                } catch (e) { }
            }
            const avgDailyCheckins = daysWithCheckins > 0 ? totalCheckins / daysWithCheckins : 0;
            const denominator = activeSubCount > 0 ? activeSubCount : students.length;
            const attendanceRate = denominator > 0 ? (avgDailyCheckins / denominator) * 100 : 0;

            const daysData: any[] = [];
            for (let d = 1; d <= daysInMonth; d += 5) {
                const dStr = `${monthStr}-${String(d).padStart(2, '0')}`;
                const rangeEnd = Math.min(d + 4, daysInMonth);

                // Aggregate sales and subs for the 5-day range
                let rangeValue = 0;
                for (let day = d; day <= rangeEnd; day++) {
                    const currentDayStr = `${monthStr}-${String(day).padStart(2, '0')}`;
                    rangeValue += filteredSales.filter(s => s.date === currentDayStr).reduce((sum, s) => sum + s.price * s.quantity, 0);
                    rangeValue += filteredSubs.filter(s => s.purchased_at === currentDayStr).reduce((sum, sub) => sum + (sub.amount_paid || planPrices[sub.plan] || 0), 0);
                }

                daysData.push({ label: String(d).padStart(2, '0'), value: rangeValue });
            }

            // Attendance Chart - every 5 days
            const daysAttData: any[] = [];
            for (let d = 1; d <= daysInMonth; d += 5) {
                const dStr = `${monthStr}-${String(d).padStart(2, '0')}`;
                const key = getScopedKey(`cc_checkins_${dStr}`);
                let dailyCheckins = 0;
                try { dailyCheckins = JSON.parse(localStorage.getItem(key) || '[]').length; } catch (e) { }
                const rate = denominator > 0 ? (dailyCheckins / denominator) * 100 : 0;
                daysAttData.push({ label: String(d).padStart(2, '0'), value: rate, isPercent: true });
            }

            // Salaries
            const calculatedSalaries = teachers.map(t => {
                const teacherGroups = (t.assigned_group_ids && t.assigned_group_ids.length > 0)
                    ? t.assigned_group_ids
                    : events.filter(ev => ev.teacher_id === t.id).map(ev => ev.id);
                
                const subsForTeacher = filteredSubs.filter(sub => {
                    const plan = plans.find(p => p.name === sub.plan);
                    const groupId = (sub as any).group_id || (plan && plan.group_id);
                    return groupId && teacherGroups.includes(groupId);
                });

                const subRevenue = subsForTeacher.reduce((sum, sub) => {
                    return sum + (sub.amount_paid || planPrices[sub.plan] || 0);
                }, 0);

                const bonus = getTeacherBonusForMonth(t.id, monthStr);
                
                // Additive Calculation
                let total = bonus;
                const activeTypes: string[] = [];
                const rateParts: string[] = [];

                // 1. Percentage component
                if (t.salary_percentage) {
                    total += (subRevenue * t.salary_percentage) / 100;
                    activeTypes.push('Percentage');
                    rateParts.push(`${t.salary_percentage}%`);
                }

                // 2. Monthly component
                if (t.rate_per_month) {
                    total += t.rate_per_month;
                    activeTypes.push('Monthly');
                    rateParts.push(formatCurrency(t.rate_per_month, settings.currency));
                }

                // 3. Hourly component
                if (t.rate_per_hour) {
                    const teacherEvents = events.filter(e => e.teacher_id === t.id && e.date.startsWith(monthStr));
                    const totalMinutes = teacherEvents.reduce((acc, ev) => {
                        const [h1, m1] = ev.start_time.split(':').map(Number);
                        const [h2, m2] = ev.end_time.split(':').map(Number);
                        return acc + ((h2 * 60 + m2) - (h1 * 60 + m1));
                    }, 0);
                    const hours = totalMinutes / 60;
                    total += (hours * t.rate_per_hour);
                    activeTypes.push('Hourly');
                    rateParts.push(`${formatCurrency(t.rate_per_hour, settings.currency)}/hr`);
                }

                // Default if nothing set
                if (activeTypes.length === 0) {
                    const defPerc = t.salary_percentage || 50;
                    total += (subRevenue * defPerc) / 100;
                    activeTypes.push('Percentage');
                    rateParts.push(`${defPerc}%`);
                }

                return {
                    id: t.id,
                    teacher: `${t.first_name || ''} ${t.last_name || t.full_name || ''}`,
                    fullObject: t,
                    type: activeTypes.length > 1 ? 'Combined' : activeTypes[0],
                    rate: rateParts.join(' + '),
                    bonus: bonus,
                    total: total,
                    status: 'pending'
                };
            });

            const totalSalaryAmount = calculatedSalaries.reduce((sum, s) => sum + s.total, 0);

            // Top Groups
            const groupStats = groups.map(g => {
                const groupSubs = filteredSubs.filter(sub => {
                    const plan = plans.find(p => p.name === sub.plan);
                    const isLinked = (sub as any).group_id === g.id || (plan && plan.group_id === g.id);
                    if (isLinked) return true;
                    // Fallback: check if the student is enrolled in this group
                    const student = students.find(s => s.id === sub.student_id);
                    return student?.enrolled_group_ids?.includes(g.id);
                });
                const revenue = groupSubs.reduce((sum, sub) => sum + (sub.amount_paid || planPrices[sub.plan] || 0), 0);
                return { name: g.name, students: g.enrolled || 0, revenue: revenue, growth: '+0%' };
            })
                .filter(g => g.students > 0 || g.revenue > 0)
                .sort((a, b) => b.students - a.students || b.revenue - a.revenue)
                .slice(0, 5);

            // If no group data, show all events with 0 as fallback
            const finalGroups = groupStats.length > 0 ? groupStats : events.slice(0, 5).map(ev => ({
                name: ev.title, students: 0, revenue: 0, growth: '+0%'
            }));

            // Fiscal Year start: Sept 1st
            const fiscalYearYear = parseInt(monthStr.split('-')[0]);
            const fiscalYearStart = new Date(fiscalYearYear, 8, 1);
            if (new Date(monthStr + '-01') < fiscalYearStart) fiscalYearStart.setFullYear(fiscalYearStart.getFullYear() - 1);
            const fiscalYearStr = fiscalYearStart.toISOString().split('T')[0];
            const yearSalesRevenue = sales.filter(s => s.date >= fiscalYearStr).reduce((sum, s) => sum + s.price * s.quantity, 0);
            const yearSubRevenue = allSubs.filter(sub => sub.purchased_at >= fiscalYearStr).reduce((sum, sub) => sum + (sub.amount_paid || planPrices[sub.plan] || 0), 0);

            // 3 month boundaries from selected month
            const selectedMonthDate = new Date(monthStr + '-01');
            const endOfMonthDate = new Date(parseInt(monthStr.split('-')[0]), parseInt(monthStr.split('-')[1]), 0);
            const endMonthStr = endOfMonthDate.toISOString().split('T')[0];
            const threeMonthsAgo = new Date(selectedMonthDate);
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];
            const newStudents3m = students.filter(s => (s as any).created_at && (s as any).created_at >= threeMonthsAgoStr && (s as any).created_at <= endMonthStr).length;
            const leftStudents3m = students.filter(s => s.status === 'inactive' && (s as any).updated_at && (s as any).updated_at >= threeMonthsAgoStr && (s as any).updated_at <= endMonthStr).length;

            // Manual Expenses for this month
            const manualExpenses = getExpenses(monthStr, settings.activeBranchId || 'default');
            const manualExpensesTotal = Object.values(manualExpenses).reduce((a, b) => (a || 0) + (b || 0), 0);
            const totalExpenses = totalSalaryAmount + manualExpensesTotal;
            const netProfit = totalRevenue - totalExpenses;

            // Deep Financial Metrics
            const subRevenue = filteredSubs.reduce((sum, sub) => sum + (sub.amount_paid || planPrices[sub.plan] || 0), 0);
            const prodRevenue = filteredSales.reduce((sum, s) => sum + s.price * s.quantity, 0);
            const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
            const arpu = activeSubCount > 0 ? totalRevenue / activeSubCount : (students.length > 0 ? totalRevenue / students.length : 0);

            // --- Creative AI Logic ---
            
            // 1. Churn Risk Analysis
            const churnRiskStudents = students.filter(s => s.status === 'active').map(s => {
                const checkins = getStudentCheckins(s.id);
                if (checkins.length === 0) return { id: s.id, name: s.full_name || `${s.first_name} ${s.last_name}`, risk: 'high', reason: l('ჩეკინი არ დაფიქსირებულა', 'Нет посещений', 'No check-ins') };
                
                const lastCheckin = new Date(checkins[0].date);
                const daysSinceLast = Math.floor((new Date().getTime() - lastCheckin.getTime()) / (1000 * 3600 * 24));
                
                let risk: 'low' | 'medium' | 'high' | 'lost' = 'low';
                let reason = '';
                if (daysSinceLast >= 60) {
                    risk = 'lost';
                    reason = l('დაკარგული კლიენტი (60+ დღე)', 'Потерянный клиент (60+ дней)', 'Lost client (60+ days)');
                } else if (daysSinceLast > 14) {
                    risk = 'high';
                    reason = l('არ გამოჩენილა 2 კვირაზე მეტია', 'Не был более 2 недель', 'Absent for 2+ weeks');
                } else if (daysSinceLast > 7) {
                    risk = 'medium';
                    reason = l('არ გამოჩენილა 1 კვირაა', 'Не был 1 неделю', 'Absent for 1 week');
                }
                
                return { id: s.id, name: s.full_name || `${s.first_name} ${s.last_name}`, risk, reason, daysSinceLast };
            }).filter(s => s.risk !== 'low').sort((a, b) => (b.daysSinceLast || 0) - (a.daysSinceLast || 0)).slice(0, 5);

            // 2. Occupancy Analysis
            const occupancyStats = groups.map(g => ({
                name: g.name,
                rate: g.capacity > 0 ? Math.round((g.enrolled / g.capacity) * 100) : 0,
                enrolled: g.enrolled,
                capacity: g.capacity
            })).sort((a,b) => b.rate - a.rate);

            // 3. Peak Hours (Current Month)
            const hourCounts: Record<string, number> = {};
            const prefix = getScopedKey('cc_checkins_');
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(prefix) && key.includes(monthStr)) {
                   const dayCheckins = JSON.parse(localStorage.getItem(key) || '[]');
                   dayCheckins.forEach((c: any) => {
                       const hour = c.time?.split(':')[0] || '00';
                       hourCounts[hour] = (hourCounts[hour] || 0) + 1;
                   });
                }
            });
            const peakHours = Object.entries(hourCounts)
                .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 3);

            // 4. AI Live Highlights & Trends
            const today = getLocalISODate();
            const newStudentsToday = students.filter(s => (s as any).created_at === today).length;
            const revenueToday = filteredSales.filter(s => s.date === today).reduce((sum, s) => sum + s.price * s.quantity, 0) +
                                filteredSubs.filter(sub => sub.purchased_at === today).reduce((sum, sub) => sum + (sub.amount_paid || planPrices[sub.plan] || 0), 0);
            
            // Financial Comparison Logic
            const lastMonthDate = new Date(selectedMonthDate); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
            const lastMonthStr = lastMonthDate.toISOString().substring(0, 7);
            const lastYearDate = new Date(selectedMonthDate); lastYearDate.setFullYear(lastYearDate.getFullYear() - 1);
            const lastYearStr = lastYearDate.toISOString().substring(0, 7);

            const getMonthRevenue = (m: string) => {
                const subRev = allSubs.filter(sub => sub.purchased_at.startsWith(m)).reduce((sum, sub) => sum + (sub.amount_paid || planPrices[sub.plan] || 0), 0);
                const prodRev = sales.filter(s => s.date.startsWith(m)).reduce((sum, s) => sum + s.price * s.quantity, 0);
                return subRev + prodRev;
            };

            const prevMonthRevenue = getMonthRevenue(lastMonthStr);
            const prevYearRevenue = getMonthRevenue(lastYearStr);
            
            // Weekly Trend (Last 7 days vs previous 7 days)
            const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
            const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
            const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split('T')[0];
            
            const thisWeekRevenue = allSubs.filter(s => s.purchased_at >= sevenDaysAgoStr).reduce((sum, sub) => sum + (sub.amount_paid || planPrices[sub.plan] || 0), 0) +
                                  sales.filter(s => s.date >= sevenDaysAgoStr).reduce((sum, s) => sum + s.price * s.quantity, 0);
            const lastWeekRevenue = allSubs.filter(s => s.purchased_at >= fourteenDaysAgoStr && s.purchased_at < sevenDaysAgoStr).reduce((sum, sub) => sum + (sub.amount_paid || planPrices[sub.plan] || 0), 0) +
                                  sales.filter(s => s.date >= fourteenDaysAgoStr && s.date < sevenDaysAgoStr).reduce((sum, s) => sum + s.price * s.quantity, 0);
            const weeklyGrowthPercent = lastWeekRevenue > 0 ? Math.round(((thisWeekRevenue / lastWeekRevenue) - 1) * 100) : 0;

            // 5. AI Smart Suggestions (YouTube Studio Style)
            const suggestions: string[] = [];
            
            if (newStudentsToday > 0) {
                suggestions.push(l(`გილოცავ! დღეს ${newStudentsToday} ახალი სტუდენტი დაგემატა! 🚀`, `Поздравляем! Сегодня добавилось ${newStudentsToday} новых студентов! 🚀`, `Congrats! ${newStudentsToday} new students joined today! 🚀`));
            }
            if (revenueToday > 0) {
                suggestions.push(l(`დღევანდელი შემოსავალი: ${formatCurrency(revenueToday, settings.currency)}! შესანიშნავი შედეგია! 💰`, `Доход за сегодня: ${formatCurrency(revenueToday, settings.currency)}! Отличный результат! 💰`, `Today's revenue: ${formatCurrency(revenueToday, settings.currency)}! Great result! 💰`));
            }
            if (weeklyGrowthPercent > 5) {
                suggestions.push(l(`ამ კვირაში შემოსავალი ${weeklyGrowthPercent}%-ით გაიზარდა წინა კვირასთან შედარებით! 📈`, `На этой неделе доход вырос на ${weeklyGrowthPercent}% по сравнению с прошлой! 📈`, `Revenue increased by ${weeklyGrowthPercent}% this week compared to last! 📈`));
            }
            
            if (occupancyStats.filter(g => g.rate > 90).length > 0) {
                const fullGroups = occupancyStats.filter(g => g.rate > 90).map(g => g.name).join(', ');
                suggestions.push(l(`ყურადღება! ჯგუფები ${fullGroups} თითქმის სავსეა. 🈵`, `Внимание! Группы ${fullGroups} почти заполнены. 🈵`, `Heads up! Groups ${fullGroups} are almost full. 🈵`));
            }

            if (suggestions.length === 0) {
                if (churnRiskStudents.length > 0) {
                    suggestions.push(l(`${churnRiskStudents.length} სტუდენტია სტუდიის დატოვების რისკის ქვეშ. სცადეთ მათთან დაკავშირება.`, `${churnRiskStudents.length} студентов под риском ухода. Свяжитесь с ними.`, `${churnRiskStudents.length} students are at risk of leaving. Reach out to them.`));
                } else {
                    suggestions.push(l('სტუდია სტაბილურად მუშაობს. ფოკუსირდით მარკეტინგზე.', 'Студия работает стабильно. Фокус на маркетинг.', 'Studio is stable. Focus on marketing.'));
                }
            }

            const totalGrossRevenue = subRevenue + prodRevenue;

            setExtraStats({
                inactiveSubs: students.length - activeSubCount,
                newStudents3m,
                leftStudents3m,
                yearlyRevenue: yearSalesRevenue + yearSubRevenue,
                activeSubs: activeSubCount,
                totalExpenses,
                netProfit,
                manualExpenses,
                manualExpensesTotal,
                totalStudents: students.length,
                subRevenue,
                prodRevenue,
                profitMargin,
                arpu,
                churnRiskStudents,
                occupancyStats,
                peakHours,
                suggestions,
                totalGrossRevenue,
                prevMonthRevenue,
                prevYearRevenue,
                lateRenewals: students.filter(s => {
                    const studentSubs = Object.values(allSubsMap[s.id] || []);
                    const active = studentSubs.find(sub => sub.status === 'active');
                    const expired = studentSubs.filter(sub => sub.status === 'expired').sort((a, b) => b.expires_at.localeCompare(a.expires_at))[0];
                    return !active && expired && expired.expires_at < getLocalISODate();
                }).map(s => ({
                    id: s.id,
                    name: `${s.first_name || ''} ${s.last_name || s.full_name || ''}`,
                    lastExpiry: (Object.values(allSubsMap[s.id] || []).filter(sub => sub.status === 'expired').sort((a, b) => b.expires_at.localeCompare(a.expires_at))[0] as any)?.expires_at
                })),
                topPayers: students.map(s => {
                    const studentUnits = Object.values(allSubsMap[s.id] || []);
                    const totalSpent = studentUnits.reduce((sum, sub) => sum + (sub.amount_paid || planPrices[sub.plan] || 0), 0);
                    return { id: s.id, name: `${s.first_name || ''} ${s.last_name || s.full_name || ''}`, totalSpent };
                }).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10),
                branchStats: settings.branches.map(b => {
                    const branchStudents = students.filter(s => s.branch_id === b.id || (!s.branch_id && b.id === 'main'));
                    const branchRevenue = filteredSales.filter(s => s.studentId && students.find(st => st.id === s.studentId && (st.branch_id === b.id || (!st.branch_id && b.id === 'main')))).reduce((sum, s) => sum + s.price * s.quantity, 0) +
                        filteredSubs.filter(sub => students.find(st => st.id === sub.student_id && (st.branch_id === b.id || (!st.branch_id && b.id === 'main')))).reduce((sum, sub) => sum + (sub.amount_paid || planPrices[sub.plan] || 0), 0);
                    return { name: b.name, students: branchStudents.length, revenue: branchRevenue };
                })
            });

            return {
                totalRevenue, attendanceRate, totalSalaryAmount, totalExpenses, netProfit, manualExpenses, daysData, daysAttData, calculatedSalaries, overview: [
                    { label: 'totalRevenue', value: formatCurrency(totalRevenue, settings.currency), change: '+0%', trend: 'up', icon: CreditCard, color: 'indigo' },
                    { label: 'totalExpenses', value: formatCurrency(totalExpenses, settings.currency), change: '0', trend: 'down', icon: Receipt, color: 'rose' },
                    { label: 'netProfit', value: formatCurrency(netProfit, settings.currency), change: '0%', trend: 'up', icon: TrendingUp, color: 'emerald' },
                    { label: 'attendanceRate', value: `${Math.round(attendanceRate)}%`, change: '0%', trend: 'up', icon: CalendarCheck, color: 'violet' },
                ], finalGroups
            };
        };

        const result = refreshAnalytics(selectedMonth);
        setRevenueChartData(result.daysData);
        setAttendanceChartData(result.daysAttData);
        setSalaryData(result.calculatedSalaries);
        setStats(result.overview);
        setTopGroupsData(result.finalGroups);
        setCurrentMonthStats({ 
            totalRevenue: result.totalRevenue, 
            attendanceRate: result.attendanceRate,
            totalExpenses: result.totalExpenses,
            netProfit: result.netProfit,
            manualExpensesTotal: Object.values(result.manualExpenses).reduce((a: any, b: any) => (a || 0) + (b || 0), 0)
        });

        // Prev month for comparison
        const [y, m] = selectedMonth.split('-').map(Number);
        const prevMonthStr = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
        const prevResult = refreshAnalytics(prevMonthStr);
        setPrevMonthStats({ totalRevenue: prevResult.totalRevenue, attendanceRate: prevResult.attendanceRate });

    }, [lang, selectedMonth, settings.activeBranchId, refreshToggle]);

    // Listen for bonus updates to refresh analytics
    useEffect(() => {
        const h = () => setRefreshToggle(v => v + 1);
        window.addEventListener('cc_bonuses_updated', h);
        window.addEventListener('cc_salary_statuses_updated', h);
        window.addEventListener('cc_expenses_updated', h);
        return () => {
            window.removeEventListener('cc_bonuses_updated', h);
            window.removeEventListener('cc_salary_statuses_updated', h);
            window.removeEventListener('cc_expenses_updated', h);
        };
    }, []);

    const totalCalculated = salaryData.reduce((acc, s) => acc + s.total, 0);
    const revenueMax = Math.max(...revenueChartData.map(d => d.value), 100);

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-up pb-20">
            {/* Standard Header Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 px-4 sm:px-0">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-500/20">
                        <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-primary tracking-tight leading-none">{t.analytics}</h1>
                        <p className="text-[10px] font-black text-muted tracking-widest opacity-40 uppercase mt-1.5">{l('თვიური მიმოხილვა', 'Ежемесячный обзор', 'Monthly Overview')}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <MonthNavigator
                        selectedMonth={selectedMonth}
                        onSelect={setSelectedMonth}
                        t={t}
                        className="flex-1 sm:flex-none"
                    />
                    <button onClick={() => setShowExpenseModal(true)}
                        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-indigo-50/50 text-indigo-600 border border-indigo-200/50 hover:bg-indigo-100 transition-all shadow-sm shrink-0 active:scale-95"
                        title={t.manageExpenses}>
                        <Receipt className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleExport()}
                        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white text-black border border-border-subtle hover:bg-surface transition-all shadow-sm shrink-0 active:scale-95"
                        title={l('ჩამოტვირთვა', 'Скачать', 'Download')}>
                        <Download className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="space-y-6 px-4 sm:px-0">
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
                    
                    <div className="flex-1 w-full lg:max-w-2xl px-1 sm:px-2">
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

                    {/* 2. Expense Breakdown (Pie Chart) */}
                    <div className="bg-card border border-border-subtle rounded-3xl p-5 sm:p-6 shadow-lg flex flex-col items-center min-h-[340px] h-full">
                        <div className="w-full h-8 flex items-start justify-center">
                            <p className="text-[10px] font-black text-muted tracking-[0.2em] text-center leading-tight uppercase opacity-60 px-2 line-clamp-2">{t.expenses}</p>
                        </div>
                        <div className="h-44 w-full flex items-center justify-center">
                            <div className="scale-110">
                                <PieChart
                                    size={100}
                                    thickness={12}
                                    data={[
                                        { label: t.totalSalaries, value: currentMonthStats?.totalSalaryAmount || 0, color: '#f43f5e' },
                                        { label: t.rent, value: extraStats.manualExpenses?.rent || 0, color: '#fb923c' },
                                        { label: t.electricity + '/' + t.gas + '/' + t.water, value: (extraStats.manualExpenses?.electricity || 0) + (extraStats.manualExpenses?.gas || 0) + (extraStats.manualExpenses?.water || 0), color: '#facc15' },
                                        { label: t.otherExpenses, value: (extraStats.manualExpenses?.cleaner || 0) + (extraStats.manualExpenses?.accountant || 0) + (extraStats.manualExpenses?.manager || 0) + (extraStats.manualExpenses?.other || 0), color: '#94a3b8' },
                                    ]}
                                    centerLabel={
                                        <div className="text-center px-2">
                                            <span className="text-[10px] font-black text-primary leading-tight block">{formatCurrency(currentMonthStats?.totalExpenses || 0, settings.currency).split('.')[0]}</span>
                                        </div>
                                    }
                                />
                            </div>
                        </div>
                        <div className="mt-auto pt-4 flex flex-col items-start gap-1 w-full max-w-[140px] border-t border-border-subtle/30 cursor-default">
                            <div className="flex items-center gap-2 group transition-opacity">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                <p className="text-[8px] font-black text-primary opacity-60 uppercase tracking-tight">{t.totalSalaries}</p>
                            </div>
                            <div className="flex items-center gap-2 group transition-opacity">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                                <p className="text-[8px] font-black text-primary opacity-60 uppercase tracking-tight">{t.rent}</p>
                            </div>
                            <div className="flex items-center gap-2 group transition-opacity">
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                                <p className="text-[8px] font-black text-primary opacity-60 uppercase tracking-tight">{l('კომუნალურები', 'Коммунальные', 'Utilities')}</p>
                            </div>
                            <div className="flex items-center gap-2 group transition-opacity">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                                <p className="text-[8px] font-black text-primary opacity-60 uppercase tracking-tight">{t.otherExpenses}</p>
                            </div>
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
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                <p className="text-[8px] font-black text-primary opacity-60 uppercase tracking-tight">{t.oldLabel}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <p className="text-[8px] font-black text-emerald-500 uppercase tracking-tight">{t.new}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                <p className="text-[8px] font-black text-red-500 uppercase tracking-tight">{t.leftLabel}</p>
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
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <p className="text-[8px] font-black text-emerald-500 uppercase tracking-tight">{t.active}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-200 shrink-0" />
                                <p className="text-[8px] font-black text-primary opacity-20 uppercase tracking-tight">{t.inactive}</p>
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
                                            <p className="text-2xl font-black text-indigo-600 tabular-nums tracking-tighter">
                                                {extraStats.totalStudents > 0 ? Math.round((extraStats.activeSubs / extraStats.totalStudents) * 100) : 0}%
                                            </p>
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
                                        <div className="p-4 bg-white/40 rounded-2xl border border-emerald-500/5">
                                            <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">{l('წლიური პროგნოზი', 'Годовой прогноз', 'Annual Forecast')}</p>
                                            <p className="text-sm font-black text-emerald-700">{formatCurrency(Math.round(extraStats.yearlyRevenue || 0), settings.currency)}</p>
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
