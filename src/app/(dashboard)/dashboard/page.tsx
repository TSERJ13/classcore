'use client';

import { useState } from 'react';
import { useT } from '@/contexts/LanguageContext';
import {
    Users, CreditCard, CalendarCheck, TrendingUp,
    UserPlus, ClipboardList, ArrowUpRight, Zap,
    Activity, ChevronLeft, ChevronRight, Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/hooks/useUser';

// ─── Mini calendar helpers ──────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay(); // 0=Sun
}

const MONTH_NAMES_KA = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const MONTH_NAMES_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK_KA = ['კვ', 'ორ', 'სა', 'ოთ', 'ხუ', 'პა', 'შა'];
const WEEK_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const WEEK_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Days with events (demo)
const EVENT_DAYS = new Set([3, 7, 12, 15, 20, 22, 25]);

function MiniCalendar({ lang, selectedDate, onSelect }: { lang: string; selectedDate: Date; onSelect: (d: Date) => void }) {
    const [year, setYear] = useState(selectedDate.getFullYear());
    const [month, setMonth] = useState(selectedDate.getMonth());
    const now = new Date();
    const today = now.getDate();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const months = lang === 'ka' ? MONTH_NAMES_KA : lang === 'ru' ? MONTH_NAMES_RU : MONTH_NAMES_EN;
    const weeks = lang === 'ka' ? WEEK_KA : lang === 'ru' ? WEEK_RU : WEEK_EN;

    function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
    function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-primary">{months[month]} {year}</span>
                <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-primary transition-colors">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
                {weeks.map(w => (
                    <div key={w} className="text-center text-[10px] font-bold text-muted/40 py-1">{w}</div>
                ))}
            </div>
            {/* Days */}
            <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((d, i) => {
                    if (!d) return <div key={i} />;
                    const isToday = isCurrentMonth && d === today;
                    const hasEvent = EVENT_DAYS.has(d);
                    return (
                        <button key={i}
                            onClick={() => onSelect(new Date(year, month, d))}
                            className={cn(
                                "relative flex flex-col items-center justify-center h-8 rounded-lg group transition-colors hover:bg-surface",
                                selectedDate.getDate() === d && selectedDate.getMonth() === month && selectedDate.getFullYear() === year && "bg-indigo-500/10 border border-indigo-500/20"
                            )}>
                            <span className={cn('text-xs font-medium leading-none transition-colors',
                                isToday
                                    ? 'w-6 h-6 flex items-center justify-center bg-indigo-500 text-white rounded-full font-bold'
                                    : (selectedDate.getDate() === d && selectedDate.getMonth() === month && selectedDate.getFullYear() === year)
                                        ? 'text-indigo-400 font-bold'
                                        : 'text-primary/60 group-hover:text-primary'
                            )}>
                                {d}
                            </span>
                            {hasEvent && !isToday && (
                                <span className={cn("absolute bottom-1 w-1 h-1 rounded-full",
                                    (selectedDate.getDate() === d && selectedDate.getMonth() === month && selectedDate.getFullYear() === year) ? "bg-indigo-400" : "bg-indigo-400/70"
                                )} />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Today's schedule ───────────────────────────────────────────────────────

const SCHEDULE = [
    { time: '09:00', name: 'Contemporary Dance', teacher: 'ნინო კ.', count: 8, color: 'bg-indigo-500', days: [1, 3, 5] },
    { time: '11:00', name: 'Ballet', teacher: 'ანა ბ.', count: 12, color: 'bg-pink-500', days: [1, 2, 4] },
    { time: '13:30', name: 'Yoga Beginners', teacher: 'გიორგი მ.', count: 6, color: 'bg-emerald-500', days: [1, 3, 5, 0] },
    { time: '16:00', name: 'Hip-Hop', teacher: 'დავით ლ.', count: 10, color: 'bg-amber-500', days: [2, 4, 6] },
    { time: '18:30', name: 'Sports Group A', teacher: 'მარიამ ა.', count: 9, color: 'bg-violet-500', days: [1, 3, 5] },
    { time: '10:00', name: 'Zumba', teacher: 'ელენე გ.', count: 15, color: 'bg-orange-500', days: [2, 4, 6] },
    { time: '20:00', name: 'Latino Mix', teacher: 'გიო ს.', count: 11, color: 'bg-rose-500', days: [1, 3, 5] },
];

// ─── Recent activity ────────────────────────────────────────────────────────

const activity = [
    { name: 'ნინო ბერიძე', action: 'check-in', group: 'Contemporary Dance', time: '10 წინ', avatar: 'NB', color: 'from-violet-500 to-indigo-600' },
    { name: 'გიორგი კვირიკაშვილი', action: 'subscription', group: '3 months plan', time: '25 წინ', avatar: 'GK', color: 'from-indigo-500 to-blue-600' },
    { name: 'ანა ჩხეიძე', action: 'check-in', group: 'Yoga Beginners', time: '1 სთ', avatar: 'AC', color: 'from-emerald-500 to-teal-600' },
    { name: 'დავით მეფარიშვილი', action: 'new', group: 'Sports Group A', time: '2 სთ', avatar: 'DM', color: 'from-amber-500 to-orange-600' },
    { name: 'მარიამ ლომიძე', action: 'check-in', group: 'Ballet', time: '3 სთ', avatar: 'ML', color: 'from-pink-500 to-rose-600' },
    { name: 'ლუკა ჯავახიშვილი', action: 'subscription', group: '1 month plan', time: '4 სთ', avatar: 'LJ', color: 'from-cyan-500 to-blue-600' },
];

function actionBadge(action: string, lang: string) {
    if (action === 'check-in') return { label: lang === 'ru' ? 'Отметка' : lang === 'en' ? 'Check-in' : 'შემოსვლა', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' };
    if (action === 'subscription') return { label: lang === 'ru' ? 'Абонемент' : lang === 'en' ? 'Subscription' : 'აბონემენტი', cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20' };
    return { label: lang === 'ru' ? 'Новый' : lang === 'en' ? 'New' : 'ახალი', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20' };
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const { t, lang } = useT();
    const { profile, user } = useUser();
    const [selectedDate, setSelectedDate] = useState(new Date());

    const isDemo = !user || profile?.studio_name === 'Demo Dance Studio' || !profile?.studio_name;

    const getLocalizedDate = (date: Date, lang: string) => {
        const weekdays = {
            ka: ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'],
            en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            ru: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
        };
        const months = {
            ka: ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'],
            en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
            ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
        };

        const day = date.getDate();
        const month = months[lang as keyof typeof months][date.getMonth()];
        const weekday = weekdays[lang as keyof typeof weekdays][date.getDay()];
        const year = date.getFullYear();

        if (lang === 'ka') return `${weekday}, ${day} ${month} ${year}`;
        if (lang === 'ru') return `${weekday}, ${day} ${month} ${year}`;
        return `${weekday}, ${day} ${month} ${year}`;
    };

    const dateStr = getLocalizedDate(selectedDate, lang);

    const stats = [
        { label: t.totalStudents, value: isDemo ? '142' : '1', change: isDemo ? '+8' : '0', sub: lang === 'ru' ? 'в этом месяце' : lang === 'en' ? 'this month' : 'ამ თვეში', icon: Users, color: 'indigo' },
        { label: t.activeSubscriptions, value: isDemo ? '118' : '1', change: isDemo ? '+12' : '0', sub: lang === 'ru' ? 'новых' : lang === 'en' ? 'new' : 'ახალი', icon: CreditCard, color: 'emerald' },
        { label: t.todayAttendance, value: isDemo ? '34' : '0', change: isDemo ? '83%' : '0%', sub: lang === 'ru' ? 'посещаемость' : lang === 'en' ? 'rate' : 'დასწრება', icon: CalendarCheck, color: 'violet' },
        { label: t.monthlyRevenue, value: isDemo ? '14 200' : '0', change: isDemo ? '+18%' : '0%', sub: lang === 'ru' ? 'рост' : lang === 'en' ? 'growth' : 'გაზრდა', icon: TrendingUp, color: 'amber' },
    ];

    const colorMap: Record<string, { bg: string; text: string; border: string; glow: string }> = {
        indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20', glow: 'shadow-indigo-500/10' },
        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/10' },
        violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', glow: 'shadow-violet-500/10' },
        amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', glow: 'shadow-amber-500/10' },
    };

    const nowHour = new Date().getHours();
    const isToday = selectedDate.toDateString() === new Date().toDateString();

    const dayOfWeek = selectedDate.getDay();
    const filteredSchedule = SCHEDULE
        .filter(s => s.days.includes(dayOfWeek))
        .sort((a, b) => a.time.localeCompare(b.time));

    const currentClass = isToday ? (isDemo ? filteredSchedule.find(s => {
        const h = parseInt(s.time.split(':')[0]);
        return h <= nowHour && h + 2 > nowHour;
    }) : null) : null;

    return (
        <div className="space-y-5 animate-fade-up">

            {/* ─── Top bar ─── */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-primary">
                        {lang === 'ka' ? `მოგესალმები, ${profile?.first_name || ''}` : t.welcomeBack} 👋
                    </h1>
                    <p className="text-sm text-muted font-bold mt-0.5 uppercase tracking-wide">
                        {profile?.studio_name || 'ClassCore Studio'} · <span className="text-indigo-400 capitalize">{dateStr}</span>
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {currentClass && (
                        <div className="hidden lg:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-medium text-emerald-400">{currentClass.name}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2">
                        <Zap className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-xs font-medium text-indigo-400">Trial</span>
                    </div>
                </div>
            </div>

            {/* ─── Stats ─── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.map(s => {
                    const Icon = s.icon;
                    const c = colorMap[s.color];
                    return (
                        <div key={s.label} className={`bg-card border border-border-subtle rounded-2xl p-4 hover:border-border-subtle/20 transition-all duration-200 shadow-lg ${c.glow}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-8 h-8 ${c.bg} border ${c.border} rounded-xl flex items-center justify-center`}>
                                    <Icon className={`w-4 h-4 ${c.text}`} strokeWidth={2} />
                                </div>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${c.bg} ${c.text} ${c.border}`}>
                                    {s.change}
                                </span>
                            </div>
                            <p className="text-2xl font-black text-primary tabular-nums leading-none mb-1">
                                {s.value}{s.label === t.monthlyRevenue && <span className="text-sm font-medium text-muted ml-1">₾</span>}
                            </p>
                            <p className="text-[11px] text-primary/45 leading-snug">{s.label}</p>
                            <p className="text-[10px] text-muted/40 mt-0.5">{s.sub}</p>
                        </div>
                    );
                })}
            </div>

            {/* ─── Main 3-column grid ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                {/* ── Left: Calendar + Quick actions ── */}
                <div className="lg:col-span-3 space-y-4">

                    {/* Calendar */}
                    <div className="bg-card border border-border-subtle rounded-2xl p-4">
                        <MiniCalendar lang={lang} selectedDate={selectedDate} onSelect={setSelectedDate} />
                    </div>

                    {/* Quick actions */}
                    <div className="bg-card border border-border-subtle rounded-2xl p-4">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-3">{t.quickActions}</p>
                        <div className="space-y-2">
                            {[
                                { label: t.addStudent, icon: UserPlus, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', href: '/students' },
                                { label: t.markAttendance, icon: ClipboardList, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', href: '/attendance' },
                            ].map(a => {
                                const Icon = a.icon;
                                return (
                                    <a key={a.href} href={a.href}
                                        className="flex items-center gap-3 p-2.5 rounded-xl bg-surface hover:bg-surface/80 border border-border-subtle hover:border-border-subtle/20 transition-all group">
                                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 ${a.color}`}>
                                            <Icon className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-xs font-medium text-primary/60 group-hover:text-primary transition-colors flex-1">{a.label}</span>
                                        <ArrowUpRight className="w-3.5 h-3.5 text-muted transition-colors" />
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ── Middle: Today's schedule ── */}
                <div className="lg:col-span-4 bg-card border border-border-subtle rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                        <div className="flex items-center gap-2">
                            <CalendarCheck className="w-4 h-4 text-muted" />
                            <h2 className="text-sm font-semibold text-primary">
                                {lang === 'ru' ? 'Расписание' : lang === 'en' ? "Schedule" : 'განრიგი'}{' '}
                                {isToday ? (lang === 'ru' ? 'сегодня' : lang === 'en' ? 'today' : 'დღეს') : ''}
                            </h2>
                        </div>
                        <a href="/calendar" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                            {lang === 'en' ? 'All →' : lang === 'ru' ? 'Все →' : 'ყველა →'}
                        </a>
                    </div>
                    <div className="divide-y divide-border-subtle max-h-[400px] overflow-y-auto">
                        {!isDemo ? (
                            <div className="p-10 text-center">
                                <p className="text-xs text-muted/40 font-medium italic">
                                    {lang === 'ka' ? 'განრიგი ცარიელია. დაამატეთ თქვენი პირველი ჯგუფი' : lang === 'ru' ? 'Расписание пусто. Добавьте свою первую группу' : 'Schedule is empty. Add your first group'}
                                </p>
                            </div>
                        ) : filteredSchedule.length > 0 ? (
                            filteredSchedule.map((cls, i) => {
                                const h = parseInt(cls.time.split(':')[0]);
                                const isCurrent = isToday && h <= nowHour && h + 2 > nowHour;
                                return (
                                    <div key={i} className={`flex items-center gap-3 px-5 py-3.5 hover:bg-surface transition-colors ${isCurrent ? 'bg-surface' : ''}`}>
                                        <div className="w-10 text-center flex-shrink-0">
                                            <p className={`text-xs font-bold tabular-nums ${isCurrent ? 'text-indigo-400' : 'text-muted/40'}`}>{cls.time}</p>
                                        </div>
                                        <div className={`w-1 h-8 rounded-full flex-shrink-0 ${cls.color}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-primary' : 'text-primary/75'}`}>{cls.name}</p>
                                            <p className="text-[11px] text-muted truncate">{cls.teacher}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <span className={`text-xs font-bold ${isCurrent ? 'text-emerald-400' : 'text-primary/40'}`}>{cls.count}</span>
                                            <Users className="w-3 h-3 text-muted" />
                                            {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-10 text-center">
                                <p className="text-xs text-muted/40 font-medium">
                                    {lang === 'ka' ? 'ამ დღეს ჯგუფები არ არის' : lang === 'ru' ? 'В этот день занятий нет' : 'No classes for this day'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right: Recent activity ── */}
                <div className="lg:col-span-5 bg-card border border-border-subtle rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-muted" />
                            <h2 className="text-sm font-semibold text-primary">{t.recentActivity}</h2>
                        </div>
                        <a href="/attendance" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                            {lang === 'en' ? 'All →' : lang === 'ru' ? 'Все →' : 'ყველა →'}
                        </a>
                    </div>
                    <div className="divide-y divide-border-subtle">
                        {isDemo ? activity.map((item, i) => {
                            const badge = actionBadge(item.action, lang);
                            return (
                                <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-surface transition-colors">
                                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                        <span className="text-[10px] font-bold text-white">{item.avatar}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-primary/85 truncate">{item.name}</p>
                                        <p className="text-[11px] text-muted truncate">{item.group}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${badge.cls}`}>{badge.label}</span>
                                        <span className="text-[10px] text-muted">{item.time}</span>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="p-10 text-center">
                                <p className="text-xs text-muted/40 font-medium italic">
                                    {lang === 'ka' ? 'აქტივობა არ არის' : lang === 'ru' ? 'Активности нет' : 'No activity yet'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Attendance progress bar ─── */}
            <div className="bg-card border border-border-subtle rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-sm font-semibold text-primary">{t.todayAttendance}</p>
                        <p className="text-[11px] text-muted mt-0.5">
                            {isDemo
                                ? (lang === 'ru' ? '34 из 41 студентов' : lang === 'en' ? '34 of 41 students' : '34 სტუდენტი 41-დან')
                                : (lang === 'ru' ? '0 из 0 студентов' : lang === 'en' ? '0 of 0 students' : '0 სტუდენტი 0-დან')
                            }
                        </p>
                    </div>
                    <span className="text-2xl font-black text-primary">{isDemo ? '83%' : '0%'}</span>
                </div>
                <div className="w-full bg-surface rounded-full h-3 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 rounded-full relative overflow-hidden transition-all duration-1000"
                        style={{ width: isDemo ? '83%' : '0%' }}>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                    </div>
                </div>
                <div className="flex justify-between mt-2">
                    <span className="text-[10px] text-muted">0%</span>
                    <span className="text-[10px] text-muted">100%</span>
                </div>
            </div>

        </div>
    );
}
