'use client';

import { useState, useEffect } from 'react';
import {
    TrendingUp, Users, CreditCard,
    CalendarCheck, ArrowUpRight, ArrowDownRight,
    Download, X, Lightbulb, BarChart3,
    Banknote, Clock, Wallet, CheckCircle2, Eye, EyeOff,
    Edit2, ChevronLeft, ChevronRight, Calculator
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
                <p className="text-[10px] font-black text-primary uppercase tracking-wider">{displayMonth} {year}</p>
            </div>
            <button onClick={goToNext} disabled={isCurrentMonth()} className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-card text-muted hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight className="w-4 h-4" strokeWidth={3} />
            </button>
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
                    "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                    isUp ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"
                )}>
                    {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {change}
                </div>
            </div>
            <p className="text-2xl font-black text-primary tabular-nums tracking-tighter mb-1">{value}</p>
            <p className="text-[11px] font-black text-muted uppercase tracking-[0.15em] opacity-40">{(t[label as keyof typeof t] as string) || label}</p>
        </div>
    );
}

// ─── Bar Chart ───────────────────────────────────────────────────────────────

function SimpleBarChart({ data, maxValue, colorClass }: { data: { label: string, value: number, isPercent?: boolean }[], maxValue: number, colorClass: string }) {
    return (
        <div className="flex items-end justify-between h-48 gap-3 px-2 mt-6">
            {data.map((d, i) => {
                const height = maxValue > 0 ? Math.max((d.value / maxValue) * 100, d.value > 0 ? 8 : 2) : 2;
                // Get the base color from colorClass (extracting-from-indigo-600)
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
                                <div className={cn("w-full transition-all duration-1000 ease-out z-10", barBg)}
                                    style={{ height: `${height}%`, boxShadow: `0 0 20px ${shadowColor}` }}>
                                    {/* Shimmer Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/bar:translate-x-full transition-transform duration-1000" />
                                </div>

                                <div className={cn("absolute -top-10 left-1/2 -translate-x-1/2 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl opacity-0 group-hover/bar:opacity-100 transition-all scale-75 group-hover/bar:scale-100 whitespace-nowrap shadow-2xl z-20 pointer-events-none", hoverBg)}>
                                    {Math.round(d.value)}{d.isPercent ? '%' : ''}
                                </div>
                            </div>
                        </div>
                        <span className="text-[9px] font-black text-muted uppercase tracking-[0.2em] opacity-30 group-hover/bar:opacity-100 transition-opacity truncate w-full text-center">{d.label}</span>
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
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border-subtle rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
                    {/* Header */}
                    <div className="sticky top-0 bg-card/90 backdrop-blur-sm border-b border-border-subtle rounded-t-[2.5rem] px-8 py-6 flex items-center justify-between z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                <Lightbulb className="w-6 h-6 text-indigo-500" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-primary">{t.aiInsightTitle}</h2>
                                <p className="text-xs text-muted font-medium opacity-60">{monthName} {year}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-primary transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Stats Summary */}
                    <div className="px-8 py-6 grid grid-cols-2 gap-4 border-b border-border-subtle">
                        <div className={cn("p-4 rounded-2xl border", revenueGrowth >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20")}>
                            <p className="text-xs font-bold text-muted opacity-60 mb-1">{t.totalRevenue || 'Revenue'}</p>
                            <p className={cn("text-xl font-black", revenueGrowth >= 0 ? "text-emerald-600" : "text-red-500")}>
                                {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth}%
                            </p>
                            <p className="text-[10px] text-muted opacity-50">{t.vsLastMonth}</p>
                        </div>
                        <div className={cn("p-4 rounded-2xl border", attendanceGrowth >= 0 ? "bg-violet-500/5 border-violet-500/20" : "bg-amber-500/5 border-amber-500/20")}>
                            <p className="text-xs font-bold text-muted opacity-60 mb-1">{t.attendanceRate || 'Attendance'}</p>
                            <p className={cn("text-xl font-black", attendanceGrowth >= 0 ? "text-violet-600" : "text-amber-500")}>
                                {attendanceGrowth >= 0 ? '+' : ''}{attendanceGrowth}%
                            </p>
                            <p className="text-[10px] text-muted opacity-50">{t.vsLastMonth}</p>
                        </div>
                    </div>

                    {/* Insights */}
                    <div className="px-8 py-6 space-y-4">
                        {insights.map((insight, i) => (
                            <div key={i} className="p-5 bg-surface/50 border border-border-subtle/50 rounded-2xl">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-2xl">{insight.icon}</span>
                                    <h3 className="text-sm font-black text-primary uppercase tracking-wider">{insight.title}</h3>
                                </div>
                                <p className="text-sm text-muted leading-relaxed opacity-80">{insight.text}</p>
                            </div>
                        ))}
                    </div>

                    <div className="px-8 pb-8">
                        <button onClick={onClose}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all">
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
    const [extraStats, setExtraStats] = useState<any>({
        inactiveSubs: 0,
        newStudents3m: 0,
        leftStudents3m: 0,
        yearlyRevenue: 0,
        activeSubs: 0
    });

    const handleExport = () => {
        // Collect Analytics Data
        const analyticsRows = [
            ['Section', 'Metric', 'Value'],
            ['Overview', t.averageDaily, formatCurrency(currentMonthStats?.totalRevenue / 30 || 0, settings.currency)],
            ['Overview', t.thisMonthAve, formatCurrency(currentMonthStats?.totalRevenue || 0, settings.currency)],
            ['Gauges', t.attendanceRate, `${Math.round(currentMonthStats?.attendanceRate || 0)}%`],
            ['Gauges', t.yearlyRevenue || 'Yearly', formatCurrency(extraStats.yearlyRevenue || 0, settings.currency)],
            ['Demographics', t.totalStudents || 'Total Students', stats[1]?.value || 0],
            ['Demographics', t.activeSubscriptions, extraStats.activeSubs],
            ['', '', ''], // Spacer
            ['Teacher Salaries', '', ''],
            ['Teacher', 'Type', 'Rate', 'Bonus', 'Total', 'Status']
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
        const csvContent = allRows.map(row => row.join(',')).join('\n');
        
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

    useEffect(() => {
        const refreshAnalytics = (monthStr: string) => {
            const students = getStudents();
            const sales = getSales();
            const allSubsMap = getSubscriptions();
            const allSubs = Object.values(allSubsMap).flat();
            const teachers = getTeachers();
            const events = getEvents();
            const plans = getPlans();

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
                    : events.filter(e => e.teacher_id === t.id).map(e => e.id);
                
                const subsForTeacher = filteredSubs.filter(sub => {
                    const plan = plans.find(p => p.name === sub.plan);
                    return plan && plan.group_id && teacherGroups.includes(plan.group_id);
                });

                const subRevenue = subsForTeacher.reduce((sum, sub) => {
                    const price = planPrices[sub.plan] || (sub as any).price || 0;
                    if (price > 0) return sum + price;
                    const match = sub.teacher_comment?.match(/(\d+\.?\d*)/);
                    return sum + (match ? parseFloat(match[0]) : 0);
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

            // Top Groups - all events (not just group_class for broader data)
            const groupStats = events
                .map(ev => {
                    const count = students.filter(s =>
                        s.enrolled_group_ids?.includes(ev.id)
                    ).length;
                    const groupSubs = filteredSubs.filter(sub => {
                        const plan = plans.find(p => p.name === sub.plan);
                        return plan && plan.group_id === ev.id;
                    });
                    const revenue = groupSubs.reduce((sum, sub) => sum + (planPrices[sub.plan] || 0), 0);
                    return { name: ev.title, students: count, revenue: revenue, growth: '+0%' };
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

            setExtraStats({
                inactiveSubs: students.length - activeSubCount,
                newStudents3m,
                leftStudents3m,
                yearlyRevenue: yearSalesRevenue + yearSubRevenue,
                activeSubs: activeSubCount
            });

            return {
                totalRevenue, attendanceRate, totalSalaryAmount, daysData, daysAttData, calculatedSalaries, overview: [
                    { label: 'totalRevenue', value: formatCurrency(totalRevenue, settings.currency), change: '+0%', trend: 'up', icon: CreditCard, color: 'indigo' },
                    { label: 'totalStudents', value: String(students.length), change: '0', trend: 'up', icon: Users, color: 'emerald' },
                    { label: 'attendanceRate', value: `${Math.round(attendanceRate)}%`, change: '0%', trend: 'up', icon: CalendarCheck, color: 'violet' },
                    { label: 'totalSalaries', value: formatCurrency(totalSalaryAmount, settings.currency), change: '0%', trend: 'up', icon: Wallet, color: 'rose' },
                ], finalGroups
            };
        };

        const result = refreshAnalytics(selectedMonth);
        setRevenueChartData(result.daysData);
        setAttendanceChartData(result.daysAttData);
        setSalaryData(result.calculatedSalaries);
        setStats(result.overview);
        setTopGroupsData(result.finalGroups);
        setCurrentMonthStats({ totalRevenue: result.totalRevenue, attendanceRate: result.attendanceRate });

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
        return () => {
            window.removeEventListener('cc_bonuses_updated', h);
            window.removeEventListener('cc_salary_statuses_updated', h);
        };
    }, []);

    const totalCalculated = salaryData.reduce((acc, s) => acc + s.total, 0);

    const revenueMax = Math.max(...revenueChartData.map(d => d.value), 100);

    return (
        <div className="max-w-6xl mx-auto space-y-10 animate-fade-up pb-20">
            {/* Header Controls */}
            <div className="flex items-center justify-between sm:justify-end gap-2 px-2 sm:px-0">
                <div className="flex items-center gap-2">
                    <button onClick={() => handleExport()}
                        className="w-10 h-10 flex items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 hover:bg-indigo-500/20 transition-all shrink-0"
                        title={l('ჩამოტვირთვა', 'Скачать', 'Download')}>
                        <Download className="w-5 h-5" />
                    </button>
                </div>
                <MonthNavigator selectedMonth={selectedMonth} onSelect={setSelectedMonth} t={t} />
            </div>

            {/* ─── 2-2-1 Analytics Grid (Unified) ─── */}
            <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6">
                {/* 1. Revenue Overview (Merged Gauges) */}
                <div className="bg-card border border-border-subtle rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 shadow-lg flex flex-col items-center justify-between min-h-[220px] sm:min-h-[280px]">
                    <div className="flex items-center justify-center text-center w-full mb-2">
                        <p className="text-[8px] sm:text-[10px] font-black text-muted uppercase tracking-[0.1em] sm:tracking-[0.2em]">{t.revenueOverview || l('მიმოხილვა', 'Обзор', 'Overview')}</p>
                    </div>
                    
                    <div className="flex-1 flex flex-col sm:flex-row items-center justify-around w-full gap-4 py-2">
                        {/* Daily Gauge */}
                        <div className="flex flex-col items-center text-center">
                            <div className="scale-[0.6] sm:scale-75 origin-center">
                                <GaugeChart
                                    size={100}
                                    thickness={14}
                                    value={currentMonthStats?.totalRevenue / 30 || 0}
                                    total={currentMonthStats?.totalRevenue / 10 || 1}
                                    color="#f59e0b"
                                    centerLabel={
                                        <div className="space-y-0.5">
                                            <span className="text-xl font-black text-primary block leading-none">{Math.round((currentMonthStats?.totalRevenue / 30) / (currentMonthStats?.totalRevenue / 10) * 100 || 0)}%</span>
                                        </div>
                                    }
                                />
                            </div>
                            <p className="text-[8px] font-black text-muted uppercase mt-1">{t.averageDaily}</p>
                            <p className="text-[10px] font-black text-primary">{formatCurrency(currentMonthStats?.totalRevenue / 30 || 0, settings.currency)}</p>
                        </div>

                        {/* Monthly Gauge */}
                        <div className="flex flex-col items-center text-center">
                            <div className="scale-[0.6] sm:scale-75 origin-center">
                                <GaugeChart
                                    size={100}
                                    thickness={14}
                                    value={currentMonthStats?.totalRevenue || 0}
                                    total={extraStats.yearlyRevenue * 1.2 || 1}
                                    color="#8b5cf6"
                                    centerLabel={
                                        <div className="space-y-0.5">
                                            <span className="text-xl font-black text-primary block leading-none">{Math.round((currentMonthStats?.totalRevenue / (extraStats.yearlyRevenue * 1.2 || 1)) * 100 || 0)}%</span>
                                        </div>
                                    }
                                />
                            </div>
                            <p className="text-[8px] font-black text-muted uppercase mt-1">{t.thisMonthAve}</p>
                            <p className="text-[10px] font-black text-primary">{formatCurrency(currentMonthStats?.totalRevenue || 0, settings.currency)}</p>
                        </div>
                    </div>
                </div>

                {/* 2. Students Pie Chart */}
                <div className="bg-card border border-border-subtle rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 flex flex-col items-center shadow-lg min-h-[220px] sm:min-h-[280px]">
                    <div className="flex items-center justify-center text-center w-full mb-3">
                        <p className="text-[8px] sm:text-[10px] font-black text-muted uppercase tracking-[0.1em] sm:tracking-[0.2em]">{t.students3m}</p>
                    </div>
                    <div className="scale-[0.6] sm:scale-[0.85] origin-center">
                        <PieChart
                            size={120}
                            thickness={18}
                            data={[
                                { label: 'Existing', value: Math.max(0, stats[1]?.value ? parseInt(stats[1].value) - extraStats.newStudents3m : 0), color: '#6366f1' },
                                { label: 'New', value: extraStats.newStudents3m, color: '#10b981' },
                                { label: 'Left', value: extraStats.leftStudents3m, color: '#ef4444' }
                            ]}
                            centerLabel={
                                <div className="space-y-0.5">
                                    <span className="text-xl sm:text-2xl font-black text-primary block leading-none">{stats[1]?.value || 0}</span>
                                    <span className="text-[8px] sm:text-[10px] text-muted font-bold block uppercase tracking-tighter opacity-40">{t.total}</span>
                                </div>
                            }
                        />
                    </div>
                    <div className="mt-auto flex flex-wrap justify-center gap-2 sm:gap-4 pb-2">
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-indigo-500" />
                            <span className="text-[7px] sm:text-[9px] font-bold text-primary/60">{t.oldLabel}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500" />
                            <span className="text-[7px] sm:text-[9px] font-bold text-emerald-500">{t.new}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500" />
                            <span className="text-[7px] sm:text-[9px] font-bold text-red-500">{t.leftLabel}</span>
                        </div>
                    </div>
                </div>

                {/* 3. Subscriptions Pie Chart */}
                <div className="bg-card border border-border-subtle rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 flex flex-col items-center shadow-lg min-h-[220px] sm:min-h-[280px]">
                    <div className="flex items-center justify-center text-center w-full mb-3">
                        <p className="text-[8px] sm:text-[10px] font-black text-muted uppercase tracking-[0.1em] sm:tracking-[0.2em]">{t.activeSubscriptions}</p>
                    </div>
                    <div className="scale-[0.6] sm:scale-[0.85] origin-center">
                        <PieChart
                            size={120}
                            thickness={18}
                            data={[
                                { label: 'Active', value: extraStats.activeSubs, color: '#10b981' },
                                { label: 'Inactive', value: extraStats.inactiveSubs, color: '#64748b20' }
                            ]}
                            centerLabel={
                                <div className="space-y-0.5">
                                    <span className="text-xl sm:text-2xl font-black text-primary block leading-none">{extraStats.activeSubs}</span>
                                    <span className="text-[8px] sm:text-[10px] text-muted font-bold block uppercase tracking-tighter opacity-40">{t.active}</span>
                                </div>
                            }
                        />
                    </div>
                    <div className="mt-auto flex justify-center gap-4 pb-2">
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500" />
                            <span className="text-[7px] sm:text-[9px] font-bold text-emerald-500">{t.active}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-slate-200" />
                            <span className="text-[7px] sm:text-[9px] font-bold text-primary/30 uppercase">{t.more}</span>
                        </div>
                    </div>
                </div>

                {/* 4. Attendance Rate Chart */}
                <div className="bg-card border border-border-subtle rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-8 shadow-sm flex flex-col min-h-[220px] sm:min-h-[280px]">
                    <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2 min-h-[24px] sm:min-h-[32px]">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-600 shrink-0">
                            <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                        <h2 className="text-[10px] sm:text-sm font-black text-primary tracking-tight leading-tight">{t.attendanceRateShort || t.attendanceRate}</h2>
                    </div>
                    <div className="flex-1 scale-90 sm:scale-100 origin-bottom">
                        {attendanceChartData.length > 0 ? (
                            <SimpleBarChart
                                data={attendanceChartData}
                                maxValue={100}
                                colorClass="bg-gradient-to-t from-violet-500 to-violet-400"
                            />
                        ) : (
                            <div className="h-32 sm:h-48 flex items-center justify-center text-muted opacity-40 text-[10px]">
                                {t.noData}
                            </div>
                        )}
                    </div>
                </div>

                {/* 5. Revenue Dynamics (Full Width - THE '1') */}
                <div className="col-span-2 bg-card border border-border-subtle rounded-[1.5rem] sm:rounded-[2.5rem] p-4 sm:p-8 shadow-sm flex flex-col min-h-[220px] sm:min-h-[320px]">
                    <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2 min-h-[32px] sm:min-h-[48px]">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0">
                            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <h2 className="text-xs sm:text-lg font-black text-primary tracking-tight leading-tight">{t.revenueDynamics}</h2>
                    </div>
                    <p className="text-[8px] sm:text-xs font-bold text-muted opacity-40 mb-2 sm:mb-4 uppercase tracking-wider">{t.revenue} ({settings.currency})</p>
                    <div className="flex-1 scale-95 sm:scale-100 origin-bottom">
                        {revenueChartData.length > 0 ? (
                            <SimpleBarChart
                                data={revenueChartData}
                                maxValue={revenueMax}
                                colorClass="bg-gradient-to-t from-emerald-500 to-emerald-400"
                            />
                        ) : (
                            <div className="h-32 sm:h-48 flex items-center justify-center text-muted opacity-40 text-[10px]">
                                {t.noData}
                            </div>
                        )}
                    </div>
                </div>
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
                                <p className="text-[9px] font-black text-muted uppercase tracking-widest opacity-40">{t.totalSalaries}</p>
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

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-surface/30">
                                <th className="px-8 py-4 text-left text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">{t.teacherTable}</th>
                                <th className="px-8 py-4 text-center text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">{t.typeTable}</th>
                                <th className="px-8 py-4 text-center text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">{t.volumeTable}</th>
                                {showSalaries && (
                                    <>
                                        <th className="px-8 py-4 text-center text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">{t.bonusTable}</th>
                                        <th className="px-8 py-4 text-center text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">{t.totalAmount}</th>
                                    </>
                                )}
                                <th className="px-8 py-4 text-right text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">{t.statusTable}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/50">
                            {salaryData.length > 0 ? salaryData.map((item, i) => (
                                <tr key={i} className="group hover:bg-surface/40 transition-colors">
                                    <td className="px-8 py-5">
                                        <p className="text-sm font-black text-primary group-hover:text-rose-600 transition-colors uppercase tracking-tight">{item.teacher}</p>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border",
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
                                            <button onClick={() => setEditingTeacher(item.fullObject)} className="p-2 rounded-lg hover:bg-violet-500/10 hover:text-violet-600 transition-colors opacity-0 group-hover:opacity-100">
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleExport()} className="p-2 rounded-lg hover:bg-indigo-500/10 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100">
                                                <Download className="w-3.5 h-3.5" />
                                            </button>
                                            {getStatusForTeacher(item.id, selectedMonth) === 'pending' ? (
                                                <button 
                                                    onClick={() => toggleSalaryStatus(item.id, selectedMonth)}
                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                                                >
                                                    <Banknote className="w-3.5 h-3.5" />
                                                    {t.pay}
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => toggleSalaryStatus(item.id, selectedMonth)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-sm"
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
                    <div className="bg-surface/30 px-8 py-6 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-8">
                        <div>
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 mb-1">{t.totalPaidThisMonth}</p>
                            <p className="text-xl font-black text-emerald-600 tabular-nums">
                                {formatCurrency(
                                    salaryData.filter(s => getStatusForTeacher(s.id, selectedMonth) === 'paid').reduce((acc, curr) => acc + curr.total, 0),
                                    settings.currency
                                )}
                            </p>
                        </div>
                        <div className="w-px h-8 bg-border-subtle hidden sm:block" />
                        <div>
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 mb-1">{t.totalPendingThisMonth}</p>
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
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-surface/10">
                                <th className="px-8 py-4 text-left text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">{t.groupName}</th>
                                <th className="px-8 py-4 text-center text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">{t.students}</th>
                                <th className="px-8 py-4 text-center text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">{t.revenue}</th>
                                <th className="px-8 py-4 text-right text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">{t.growthTable || 'Growth'}</th>
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
            </div>

            {/* AI Insights Footer */}
            <div className="bg-indigo-600 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center gap-10 shadow-2xl shadow-indigo-600/40 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />

                <div className="flex-1 text-center md:text-left space-y-4 relative z-10">
                    <h3 className="text-3xl font-black text-white tracking-tight leading-tight">{t.aiInsightTitle}</h3>
                    <div className="space-y-2">
                        <p className="text-indigo-100 text-base font-medium opacity-90 max-w-md">
                            {prevMonthStats && currentMonthStats ? (
                                currentMonthStats.totalRevenue > prevMonthStats.totalRevenue
                                    ? l(
                                        `თქვენი შემოსავალი გაიზარდა ${Math.round((currentMonthStats.totalRevenue / (prevMonthStats.totalRevenue || 1) - 1) * 100)}%-ით. დეტალები — დააწვდით ღილაკს.`,
                                        `Доход вырос на ${Math.round((currentMonthStats.totalRevenue / (prevMonthStats.totalRevenue || 1) - 1) * 100)}%. Подробности — нажмите кнопку.`,
                                        `Revenue up ${Math.round((currentMonthStats.totalRevenue / (prevMonthStats.totalRevenue || 1) - 1) * 100)}%. See details.`
                                    )
                                    : l('შემოსავალი სტაბილურია. გირჩევთ ახალი ჯგუფების გახსნა.', 'Доход стабилен. Рекомендуем открыть новые группы.', 'Revenue stable. Consider opening new groups.')
                            ) : t.aiInsightDesc}
                        </p>
                        <p className="text-indigo-200/60 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {l('AI ანალიზი მზად არის', 'AI анализ готов', 'AI analysis ready')}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 relative z-10">
                    <button onClick={() => setShowInsightsModal(true)}
                        className="px-10 py-5 bg-white text-indigo-600 text-sm font-black rounded-3xl transition-all shadow-2xl shadow-black/10 hover:shadow-black/20 hover:scale-105 active:scale-95 whitespace-nowrap uppercase tracking-widest">
                        {t.aiInsightDetails || l('დეტალებად', 'Подробнее', 'View Details')}
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
        </div>
    );
}
