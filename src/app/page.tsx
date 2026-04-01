'use client';

import {
    Zap, Users, Calendar, Banknote, Shield, Star,
    ChevronRight, ArrowRight, Play, Check, Globe,
    LayoutDashboard, Laptop, Sparkles, TrendingUp, BarChart3,
    Activity, MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { useT } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Logo } from '@/components/ui/Logo';

const ICON_MAP: Record<string, any> = {
    Globe, Zap, Users, MessageSquare: Sparkles, Shield, Laptop, Check, LayoutDashboard, Banknote, Calendar, Sparkles
};

const SystemVideoOverview = ({ t, lang }: { t: any, lang: string }) => {
    const [scene, setScene] = useState(0);
    const scenes = [
        {
            title: lang === 'ka' ? "ერთიანი მართვის სისტემა" : lang === 'ru' ? "Единая система управления" : "Unified Management System",
            description: lang === 'ka' ? "აკონტროლეთ ყველა პროცესი ერთი ფანჯრიდან" : lang === 'ru' ? "Управляйте всеми процессами из одного окна" : "Control all processes from a single window",
            zoom: "scale(1) translate(0, 0)",
            img: "/overview.webp"
        },
        {
            title: lang === 'ka' ? "მოსწავლეების ბაზა" : lang === 'ru' ? "База учеников" : "Student Database",
            description: lang === 'ka' ? "სტუდენტების სრული სიის და აბონემენტების მართვა" : lang === 'ru' ? "Полный список студентов и управление абонементами" : "Full student list and subscription management",
            zoom: "scale(1) translate(0, 0)",
            img: "/dashboard_students.png"
        },
        {
            title: lang === 'ka' ? "ავტომატური განრიგი" : lang === 'ru' ? "Автоматическое расписание" : "Automated Schedule",
            description: lang === 'ka' ? "ჭკვიანი კალენდარი და დარბაზების დაჯავშნა" : lang === 'ru' ? "Умный календарь и бронирование залов" : "Smart calendar and room booking",
            zoom: "scale(1) translate(0, 0)",
            img: "/dashboard_calendar.png"
        },
        {
            title: lang === 'ka' ? "ფინანსური რეპორტები" : lang === 'ru' ? "Финансовые отчеты" : "Financial Reports",
            description: lang === 'ka' ? "შემოსავლების და ხარჯების დეტალური ანალიტიკა" : lang === 'ru' ? "Детальная аналитика доходов и расходов" : "Detailed income and expense analytics",
            zoom: "scale(1) translate(0, 0)",
            img: "/dashboard_finance.png"
        }
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            setScene((prev) => (prev + 1) % scenes.length);
        }, 6000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="relative w-full h-full overflow-hidden bg-[#020617]">
            {/* Background Base Image with Zoom/Pan Transformation */}
            <div className="absolute inset-0">
                {scenes.map((s, i) => (
                    <div
                        key={i}
                        className={cn(
                            "absolute inset-0 transition-all duration-[1500ms] ease-in-out",
                            scene === i ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-110 rotate-1"
                        )}
                    >
                        <Image
                            src={s.img}
                            alt={s.title}
                            fill
                            className="object-cover opacity-60 brightness-75"
                            priority={i === 0}
                            sizes="(max-width: 768px) 100vw, 1200px"
                        />
                    </div>
                ))}
            </div>

            {/* Overlays and Atmosphere */}
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.4)_100%)] pointer-events-none" />

            {/* Content Scene */}
            <div className="absolute inset-0 flex items-center justify-center p-6 md:p-12 pointer-events-none">
                <div className="max-w-xl w-full flex flex-col items-center text-center">
                    {scenes.map((s, i) => (
                        <div
                            key={i}
                            className={cn(
                                "transition-all duration-1000 absolute",
                                scene === i ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
                            )}
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/20 rounded-full mb-4">
                                <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                <span className="text-[10px] font-black tracking-widest text-indigo-300">Highlight 0{i + 1}</span>
                            </div>
                            <h3 className="text-2xl md:text-5xl font-black text-white mb-4 tracking-tight drop-shadow-2xl">
                                {s.title}
                            </h3>
                            <p className="text-base md:text-xl text-indigo-100/70 font-medium leading-relaxed drop-shadow-lg max-w-lg mx-auto">
                                {s.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Dynamic UI Elements (Floating Bits) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className={cn(
                    "hidden md:block absolute top-10 right-10 w-48 h-48 border border-white/5 rounded-full transition-all duration-1000",
                    scene % 2 === 0 ? "scale-110 rotate-45 border-white/10" : "scale-100 rotate-0"
                )} />
                <div className={cn(
                    "hidden md:block absolute -bottom-10 -left-10 w-64 h-64 border border-indigo-500/5 rounded-full transition-all duration-1000 delay-300",
                    scene % 2 !== 0 ? "scale-125 translate-x-10 translate-y-10 border-indigo-500/10" : "scale-100"
                )} />
            </div>

            {/* Navigation Dots */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
                {scenes.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => setScene(i)}
                        className="group relative flex items-center justify-center pointer-events-auto"
                    >
                        <div className={cn(
                            "h-1.5 transition-all duration-500 rounded-full",
                            scene === i ? "w-10 bg-indigo-500" : "w-3 bg-white/20 hover:bg-white/40"
                        )} />
                    </button>
                ))}
            </div>

            {/* Scanlines Effect */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_2px,3px_100%] z-10 opacity-30" />
        </div>
    );
};

export default function LandingPage() {
    const [scrolled, setScrolled] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [formData, setFormData] = useState({ name: '', phone: '', message: '' });
    const { t, lang } = useT();
    const { user } = useUser();
    const { settings } = useStudio();
    const [heroSet, setHeroSet] = useState(0);

    useEffect(() => {
        setMounted(true);
        setHeroSet(Math.floor(Math.random() * 3));
        const handleScroll = () => {
            const offset = window.scrollY || document.documentElement.scrollTop;
            setScrolled(offset > 10);
        };
        const content = document.getElementById('main-content');
        window.addEventListener('scroll', handleScroll);
        if (content) content.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (content) content.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const l = (ge: string, ru: string, en: string) =>
        lang === 'ka' ? ge : lang === 'ru' ? ru : en;

    const handleContactSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        setSubmitting(true);
        setSubmitStatus('idle');

        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                setSubmitStatus('success');
                setFormData({ name: '', phone: '', message: '' });
            } else {
                setSubmitStatus('error');
            }
        } catch (err) {
            setSubmitStatus('error');
        } finally {
            setSubmitting(false);
        }
    };

    const FEATURES_LIST = [
        { title: l('მონაცემების მიგრაცია', 'Миграция данных', 'Data Migration'), icon: 'Globe' },
        { title: l('სწრაფი ტექ. მხარდაჭერა', 'Быстрая техподдержка', 'Fast Support'), icon: 'Zap' },
        { title: l('ჯგუფების მართვა', 'Управление группами', 'Group Management'), icon: 'Users' },
        { title: l('ულიმიტო მოსწავლეები', 'Безлимитные ученики', 'Unlimited Students'), icon: 'Users' },
        { title: l('შიდა ჩატი', 'Внутренний чат', 'Internal Chat'), icon: 'MessageSquare' },
        { title: l('3 ადმინისტრატორი', '3 администратора', '3 Administrators'), icon: 'Shield' },
        { title: l('მოსწავლის პორტალი', 'Портал ученика', 'Student Portal'), icon: 'Laptop' },
        { title: l('დისტანციური რეგისტრაცია', 'Дистанционная регистрация', 'Remote Registration'), icon: 'Globe' },
        { title: l('ავტომატური SMS', 'Автоматические SMS', 'Auto SMS'), icon: 'Sparkles' },
        { title: l('დასწრების კონტროლი', 'Контроль посещаемости', 'Attendance Control'), icon: 'Check' },
        { title: l('ანალიტიკა და რეპორტინგი', 'Аналитика и отчеты', 'Analytics & Reporting'), icon: 'LayoutDashboard' },
        { title: l('ხელფასები გამოთვლა', 'Расчет зарплат', 'Salary Calculation'), icon: 'Banknote' },
        { title: l('სივრცეების იჯარა', 'Аренда пространств', 'Space Rental'), icon: 'Calendar' },
        { title: l('შიდა მაღაზია', 'Внутренний магазин', 'Internal Shop'), icon: 'Banknote' },
        { title: l('მობილური აპლიკაცია', 'Мобильное приложение', 'Mobile App'), icon: 'Laptop' },
    ];

    if (!mounted) return null;

    return (
        <div id="main-content" className="min-h-screen bg-white text-slate-900 scroll-smooth selection:bg-indigo-500 selection:text-white overflow-x-hidden">
            {/* Header */}
            <header className={cn(
                "fixed top-0 inset-x-0 z-[100] transition-all duration-300 px-4 md:px-8 py-3 md:py-5",
                scrolled 
                    ? "bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] opacity-100" 
                    : "bg-white/90 backdrop-blur-xl border-b border-transparent shadow-sm"
            )}>
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 h-10 md:h-14">
                    <Link href="/" className="flex items-center gap-2 md:gap-3 group shrink-0 h-full">
                        <div className="group-hover:scale-105 transition-transform shrink-0 h-full flex items-center">
                            <Logo size={48} className="md:w-14 md:h-14 w-10 h-10" />
                        </div>
                        <span className="text-[16px] md:text-[26px] font-black tracking-tighter text-slate-900 group-hover:text-indigo-600 transition-colors whitespace-nowrap">ClassCore</span>
                    </Link>

                    <nav className="hidden lg:flex items-center gap-8 translate-y-0.5">
                        {['Features', 'Pricing', 'About', 'Contact'].map(item => (
                            <a key={item} href={`#${item.toLowerCase()}`} className="text-[15px] font-bold text-slate-600 hover:text-indigo-600 transition-colors tracking-widest">
                                {item === 'Features' ? t.navFeatures : item === 'Pricing' ? t.navPricing : item === 'About' ? t.navAbout : t.navContact}
                            </a>
                        ))}
                    </nav>

                    <div className="flex items-center gap-3 md:gap-5 shrink-0 h-full">
                        <Link href={user ? "/dashboard" : "/login"} className="h-10 md:h-14 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[11px] md:text-[14px] font-black px-5 md:px-10 rounded-xl md:rounded-[1.25rem] shadow-xl shadow-indigo-600/20 transition-all tracking-wide whitespace-nowrap">
                            {user ? t.dashboard : t.login}
                        </Link>
                        <div className="scale-110 origin-right transition-transform">
                            <LanguageSwitcher compact={true} variant="landing" align="right" />
                        </div>
                    </div>
                </div>
            </header>

            <main>
                {/* Hero Section - Restored to previous version */}
                <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-slate-50/50">
                    <div className="absolute top-0 right-0 -z-10 w-[60%] h-full bg-gradient-to-bl from-indigo-50 to-transparent blur-3xl opacity-70" />
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div className="space-y-8 max-w-2xl text-center lg:text-left">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full">
                                    <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                                    <span className="text-[10px] font-black tracking-widest text-indigo-700">{t.heroNewEra}</span>
                                </div>
                                <h1 className="text-5xl lg:text-7xl font-black text-slate-900 leading-[1.1] tracking-tight whitespace-pre-line">
                                    {settings.landingContent?.heroTitle || t.heroTitle}
                                </h1>
                                <p className="text-xl text-slate-600 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0 whitespace-pre-line">
                                    {settings.landingContent?.heroSubtitle || t.heroSubtitle}
                                </p>
                                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 justify-center lg:justify-start">
                                    <Link href="/registration" className="w-full sm:w-auto px-10 py-4 bg-indigo-600 text-white rounded-[20px] font-black text-[15px] shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 tracking-wide">
                                        {t.heroStartFree} <ArrowRight className="w-5 h-5" />
                                    </Link>
                                    <Link href="/login" className="w-full sm:w-auto px-10 py-4 bg-white text-slate-700 rounded-[20px] font-black text-[12px] tracking-[0.1em] border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                                        <Play className="w-4 h-4 fill-slate-700" /> {l('პორტალზე შესვლა', 'Войти в портал', 'Portal')}
                                    </Link>
                                </div>
                            </div>

                            <div className="relative group flex items-center justify-center lg:h-[500px]">
                                {/* Animated Background Glow */}
                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[400px] bg-indigo-500/5 blur-[100px] rounded-full animate-pulse-subtle" />

                                {/* Dynamic Floating Data Cards */}
                                {heroSet === 0 && (
                                    <>
                                        {/* Set 1: Revenue & Students */}
                                        <div className="absolute -top-4 right-2 md:top-2 md:right-0 z-30 transform scale-[0.72] md:scale-[1.04] origin-top-right">
                                            <div className="bg-white/80 backdrop-blur-2xl p-2 md:p-4 rounded-[1.5rem] border border-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] animate-bounce-slow">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                                        <Banknote className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] font-black text-slate-400 tracking-[0.2em] mb-0.5">{l('შემოსავალი', 'Доход', 'Revenue')}</div>
                                                        <div className="flex items-baseline gap-1.5">
                                                            <div className="text-lg font-black text-slate-900">₾4,250</div>
                                                            <div className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md">+12%</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-3 h-10 w-full">
                                                    <svg viewBox="0 0 100 30" className="w-full h-full text-emerald-500 overflow-visible">
                                                        <path d="M0 25 Q 20 20, 30 15 T 50 18 T 70 5 T 100 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="absolute -bottom-16 -left-4 md:-bottom-2 md:-left-4 z-30 transform scale-[0.72] md:scale-[1.04] origin-top-left">
                                            <div className="bg-slate-900/95 backdrop-blur-2xl p-3 md:p-5 rounded-[2rem] border border-white/10 shadow-2xl animate-float-refined">
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex items-center justify-between gap-8">
                                                        <div className="space-y-0.5">
                                                            <div className="text-[9px] font-black text-white/40 tracking-[0.2em]">{l('სტუდენტები', 'Студенты', 'Students')}</div>
                                                            <div className="text-xl font-black text-white">1,240</div>
                                                        </div>
                                                        <div className="flex -space-x-2.5">
                                                            {[1, 2, 3].map(i => (
                                                                <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 overflow-hidden relative">
                                                                    <Image 
                                                                        src={`/avatars/student_${i}.png`} 
                                                                        alt="Student" 
                                                                        fill 
                                                                        className="object-cover" 
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: '85%' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {heroSet === 1 && (
                                    <>
                                        {/* Set 2: Attendance & Activity */}
                                        <div className="absolute -top-4 right-2 md:top-2 md:right-0 z-30 transform scale-[0.72] md:scale-[1.04] origin-top-right">
                                            <div className="bg-white/90 backdrop-blur-2xl p-3 md:p-4 rounded-[1.5rem] border border-slate-100 shadow-2xl animate-bounce-slow">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white">
                                                        <Activity className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] font-black text-slate-400 tracking-[0.2em]">{l('დასწრება', 'Посещаемость', 'Attendance')}</div>
                                                        <div className="text-xl font-black text-slate-900">94.2%</div>
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex gap-1">
                                                    {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                                                        <div key={i} className="flex-1 bg-indigo-100 rounded-full overflow-hidden flex flex-col justify-end h-8">
                                                            <div className="w-full bg-indigo-500 rounded-full" style={{ height: `${h}%` }} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="absolute -bottom-16 -left-4 md:-bottom-2 md:-left-4 z-30 transform scale-[0.72] md:scale-[1.04] origin-top-left">
                                            <div className="bg-white/90 backdrop-blur-2xl p-3 md:p-4 rounded-[2rem] border border-slate-100 shadow-2xl animate-float-refined">
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                                            <TrendingUp className="w-4 h-4" />
                                                        </div>
                                                        <div className="text-[10px] font-black text-slate-400 tracking-widest">{l('აქტიური აბონემენტი', 'Активные планы', 'Active Plans')}</div>
                                                    </div>
                                                    <div className="text-2xl font-black text-slate-900">856</div>
                                                    <div className="flex items-center gap-2 text-emerald-500 font-bold text-[10px]">
                                                        <ArrowRight className="w-3 h-3 -rotate-45" /> +24% {l('ამ თვეში', 'в этом месяце', 'this month')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {heroSet === 2 && (
                                    <>
                                        {/* Set 3: New Leads & Calendar */}
                                        <div className="absolute -top-4 right-2 md:top-2 md:right-0 z-30 transform scale-[0.72] md:scale-[1.04] origin-top-right">
                                            <div className="bg-white/90 backdrop-blur-2xl p-3 md:p-4 rounded-[1.5rem] border border-slate-100 shadow-2xl animate-bounce-slow">
                                                <div className="flex items-center gap-4 mb-3">
                                                    <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white">
                                                        <Users className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] font-black text-slate-400 tracking-[0.2em]">{l('ახალი ლიდები', 'Новые лиды', 'New Leads')}</div>
                                                        <div className="text-xl font-black text-slate-900">+42</div>
                                                    </div>
                                                </div>
                                                <div className="flex -space-x-2">
                                                    {[1, 2, 3, 4].map(i => (
                                                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 overflow-hidden relative">
                                                            <Image 
                                                                src={`/avatars/student_${i}.png`} 
                                                                alt="Student" 
                                                                fill 
                                                                className="object-cover" 
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="absolute -bottom-16 -left-4 md:-bottom-2 md:-left-4 z-30 transform scale-[0.72] md:scale-[1.04] origin-top-left">
                                            <div className="bg-indigo-600 text-white p-3 md:p-4 rounded-[2rem] shadow-2xl animate-float-refined">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <Calendar className="w-4 h-4 opacity-60" />
                                                    <div className="text-[9px] font-black tracking-[0.2em] opacity-60">{l('განრიგი', 'Расписание', 'Schedule')}</div>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="text-xs font-bold bg-white/10 px-2 py-1.5 rounded-lg border border-white/10">Yoga Class - 10:00</div>
                                                    <div className="text-xs font-bold bg-white/10 px-2 py-1.5 rounded-lg border border-white/10 opacity-60">Ballet - 12:30</div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Main Mockup Wrapper */}
                                <div className="relative z-10 p-2.5 bg-white/30 backdrop-blur-md rounded-[2.5rem] border border-white/50 shadow-[0_40px_100px_rgba(0,0,0,0.1)] transition-all duration-700 hover:scale-[1.01] group aspect-[16/10] md:aspect-video lg:h-[480px]">
                                    <div className="absolute -inset-0.5 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-[2.5rem] blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <Image
                                        src="/overview.webp"
                                        alt="ClassCore Dashboard Mockup"
                                        fill
                                        className="rounded-[2rem] object-cover shadow-2xl relative z-10"
                                        priority
                                        sizes="(max-width: 1024px) 100vw, 800px"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section id="features" className="py-24 bg-white relative">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center space-y-4 mb-20">
                            <h2 className="text-xs font-black text-indigo-600 tracking-[0.3em]">{t.mainFeatures}</h2>
                            <p className="text-4xl lg:text-5xl font-black text-slate-900">{t.allYourStudioNeeds}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[300px]">
                            {/* Management Card */}
                            <div className="md:col-span-8 group relative overflow-hidden bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 lg:p-12 hover:border-indigo-100 transition-all duration-500">
                                <div className="space-y-4 max-w-sm relative z-10">
                                    <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                                        <Users className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900">{FEATURES_LIST[2].title}</h3>
                                    <p className="text-slate-500 font-medium leading-relaxed">{l('მართეთ ჯგუფები, მოსწავლეები და დასწრება ერთ სრულყოფილ სივრცეში.', 'Управляйте группами, учениками и посещаемостью.', 'Manage groups, students, and attendance easily.')}</p>
                                </div>
                                <div className="absolute bottom-[-10%] right-[-5%] w-[60%] aspect-video bg-white rounded-3xl border border-slate-100 shadow-2xl p-4 translate-y-8 group-hover:translate-y-4 transition-transform duration-700">
                                    <div className="space-y-3">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                                <div className="w-24 h-2 bg-slate-200 rounded-full" />
                                                <Check className="w-4 h-4 text-emerald-500" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Automation Card */}
                            <div className="md:col-span-4 group relative overflow-hidden bg-indigo-600 rounded-[2.5rem] p-8 lg:p-10 text-white hover:bg-indigo-700 transition-all duration-500 shadow-xl shadow-indigo-600/20">
                                <div className="space-y-4 relative z-10">
                                    <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
                                        <Sparkles className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-2xl font-black">{FEATURES_LIST[8].title}</h3>
                                    <p className="text-indigo-100 font-medium opacity-80">{l('ავტომატური შეტყობინებები.', 'Автоматические уведомления.', 'Automated SMS alerts.')}</p>
                                </div>
                            </div>

                            {/* Analytics Card */}
                            <div className="md:col-span-4 group relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-8 lg:p-10 transition-all duration-500">
                                <div className="space-y-4 relative z-10">
                                    <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20">
                                        <LayoutDashboard className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-2xl font-black text-white">{FEATURES_LIST[10].title}</h3>
                                    <p className="text-slate-400 font-medium">{l('დეტალური რეპორტები.', 'Детальные отчеты.', 'Detailed insight reports.')}</p>
                                </div>
                            </div>

                            {/* Finance & Shop Card */}
                            <div className="md:col-span-8 group relative overflow-hidden bg-white border border-slate-100 rounded-[2.5rem] p-8 lg:p-10 flex flex-col md:flex-row gap-8 items-center hover:shadow-xl transition-all duration-500">
                                <div className="space-y-4 flex-1">
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center"><Banknote className="w-6 h-6" /></div>
                                        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center"><Calendar className="w-6 h-6" /></div>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900">{l('ფინანსური მართვა & მაღაზია', 'Финансы и Магазин', 'Finances & Shop')}</h3>
                                    <p className="text-slate-500 font-medium">{l('გადახდები და შიდა გაყიდვები.', 'Платежи и продажи.', 'Payments and in-store sales.')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* About Section */}
                <section id="about" className="py-24 bg-slate-50">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div className="space-y-8 text-center lg:text-left">
                                <h2 className="text-xs font-black text-indigo-600 tracking-[0.3em]">{t.navAbout}</h2>
                                <h3 className="text-4xl lg:text-5xl font-black text-slate-900 leading-tight">
                                    {l('ციფრული მომავალი თქვენი სტუდიისთვის', 'Цифровое будущее вашей студии', 'The digital future for your studio')}
                                </h3>
                                <p className="text-lg text-slate-600 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0">
                                    {l('ClassCore შეიქმნა ერთი მიზნით: დაეხმაროს სტუდიებს მართვის პროცესის სრულ ავტომატიზაციაში.', 'ClassCore был создан для автоматизации студий.', 'ClassCore was built to automate your studio management.')}
                                </p>
                                <div className="grid grid-cols-2 gap-6 pt-4 max-w-sm mx-auto lg:mx-0">
                                    <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
                                        <div className="text-3xl font-black text-indigo-600 mb-1">50+</div>
                                        <div className="text-[10px] font-black text-slate-400 tracking-widest">{l('სტუდია', 'Студий', 'Studios')}</div>
                                    </div>
                                    <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
                                        <div className="text-3xl font-black text-emerald-500 mb-1">99%</div>
                                        <div className="text-[10px] font-black text-slate-400 tracking-widest">{l('კმაყოფილი', 'Довольных', 'Happy')}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="relative grid grid-cols-2 gap-4 md:gap-6 p-6 md:p-8 bg-white rounded-[2.5rem] md:rounded-[3rem] border border-slate-200 shadow-2xl group overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                                {FEATURES_LIST.slice(0, 4).map((f, i) => (
                                    <div key={i} className="relative z-10 p-4 md:p-6 rounded-2xl md:rounded-3xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-white hover:shadow-xl transition-all duration-300 group/item">
                                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-600 mb-3 md:mb-4 group-hover/item:scale-110 transition-transform">
                                            {/* @ts-ignore */}
                                            {ICON_MAP[f.icon] ? React.createElement(ICON_MAP[f.icon], { className: "w-5 h-5 md:w-6 md:h-6" }) : <Star className="w-5 h-5 md:w-6 md:h-6" />}
                                        </div>
                                        <h4 className="text-[10px] md:text-sm font-black text-slate-900 tracking-wider leading-tight">{f.title}</h4>
                                    </div>
                                ))}

                                {/* Atmosphere elements */}
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-100/50 blur-3xl rounded-full" />
                                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-100/50 blur-3xl rounded-full" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* System Overview Section */}
                <section id="overview" className="py-24 bg-slate-900 border-y border-white/5 relative overflow-hidden">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
                    <div className="max-w-7xl mx-auto px-6 relative z-10">
                        <div className="text-center mb-16 space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
                                <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                                <span className="text-[10px] font-black tracking-widest text-indigo-300">{l('სისტემის მიმოხილვა', 'Обзор системы', 'System Overview')}</span>
                            </div>
                            <h2 className="text-4xl lg:text-6xl font-black text-white leading-tight tracking-tight">
                                {t.fullControl}
                            </h2>
                            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
                                {t.controlDesc}
                            </p>
                        </div>

                        <div className="relative group max-w-5xl mx-auto">
                            <div className="absolute -inset-4 bg-indigo-500/10 rounded-[2rem] blur-2xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
                            <div className="relative bg-[#020617] rounded-3xl overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] border border-white/10 h-[550px] md:h-auto md:aspect-video ring-1 ring-white/5">
                                <SystemVideoOverview t={t} lang={lang} />
                            </div>
                        </div>

                        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                {
                                    title: lang === 'ka' ? "სტუდენტების მართვა" : lang === 'ru' ? "Управление студентами" : "Student Management",
                                    desc: lang === 'ka' ? "სრული ბაზა, აბონემენტების აღრიცხვა და ისტორია" : lang === 'ru' ? "Полная база, учет абонементов и история" : "Full database, subscription tracking and history",
                                    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                                },
                                {
                                    title: lang === 'ka' ? "ჭკვიანი განრიგი" : lang === 'ru' ? "Умное расписание" : "Smart Scheduling",
                                    desc: lang === 'ka' ? "გაკვეთილების დაგეგმვა და ოთახების მართვა" : lang === 'ru' ? "Планирование занятий и управление залами" : "Session planning and room management",
                                    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                },
                                {
                                    title: lang === 'ka' ? "ფინანსური ანალიტიკა" : lang === 'ru' ? "Финансовая аналитика" : "Financial Analytics",
                                    desc: lang === 'ka' ? "შემოსავლების და ხარჯების დეტალური კონტროლი" : lang === 'ru' ? "Детальный контроль доходов и расходов" : "Detailed control of income and expenses",
                                    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                }
                            ].map((item, i) => (
                                <div key={i} className="group p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 hover:bg-white/[0.04] transition-all duration-300">
                                    <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-6 text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{item.title}</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Pricing Section */}
                <section id="pricing" className="py-24 bg-white relative">
                    <div className="max-w-7xl mx-auto px-6 text-center">
                        <div className="space-y-4 mb-20">
                            <h2 className="text-xs font-black text-indigo-600 tracking-[0.3em]">{t.navPricing}</h2>
                            <p className="text-4xl lg:text-5xl font-black text-slate-900">{t.choosePlan}</p>
                        </div>

                        <div className="max-w-2xl mx-auto relative px-6 py-12 md:p-16 rounded-3xl md:rounded-[4rem] border border-slate-100 bg-slate-900 shadow-2xl overflow-hidden group hover:border-indigo-500/50 transition-all duration-500 text-left">
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-indigo-600 text-white text-[10px] font-black tracking-widest rounded-full">{t.popular}</div>
                            <div className="relative z-10 space-y-12">
                                <div className="space-y-4">
                                    <h3 className="text-xl md:text-4xl font-black text-white">{l('სრული პაკეტი', 'Полный пакет', 'ClassCore Full')}</h3>
                                    <p className="text-lg font-medium text-slate-400">{t.plansSubtitle}</p>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl md:text-7xl font-black text-white">{formatCurrency(49, 'GEL')}</span>
                                    <span className="text-xl font-medium text-slate-500">/{t.billingPerMonth}</span>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-4 pt-10 border-t border-slate-800">
                                    {[l('ყველა ფუნქცია', 'Все функции', 'All Features'), l('ულიმიტო მოსწავლეები', 'Безлимитно учеников', 'Unlimited Students'), l('3 ადმინისტრატორი', '3 администратора', '3 Admins'), l('SMS პაკეტი', 'SMS пакет', 'SMS Included')].map((f, fi) => (
                                        <div key={fi} className="flex items-center gap-3">
                                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500"><Check className="w-3 h-3" /></div>
                                            <span className="text-sm font-semibold text-slate-300">{f}</span>
                                        </div>
                                    ))}
                                </div>
                                <Link href="/registration" className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black text-lg tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3">
                                    {t.heroStartFree} <ChevronRight className="w-5 h-5" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Contact Section */}
                <section id="contact" className="py-16 md:py-24 bg-slate-50 overflow-hidden">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
                        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center w-full">
                            <div className="space-y-6 md:space-y-8 text-center lg:text-left">
                                <h2 className="text-xs font-black text-indigo-600 tracking-[0.3em]">{t.navContact}</h2>
                                <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900">{l('დაგვიკავშირდით', 'Свяжитесь с нами', 'Get in Touch')}</h3>
                                <div className="space-y-4 pt-2 md:pt-4 flex flex-col items-center lg:items-start text-sm md:text-base">
                                    <div className="flex items-center gap-3 md:gap-4 text-slate-600 font-bold"><Globe className="w-4 h-4 md:w-5 md:h-5 text-indigo-500" /> support@classcore.ge</div>
                                    <div className="flex items-center gap-3 md:gap-4 text-slate-600 font-bold"><Zap className="w-4 h-4 md:w-5 md:h-5 text-indigo-500" /> +995 555 13 00 13</div>
                                </div>
                            </div>

                            <form onSubmit={handleContactSubmit} className="bg-white p-5 md:p-8 lg:p-12 rounded-3xl md:rounded-[3.5rem] border border-slate-100 shadow-2xl space-y-4 md:space-y-6 w-full max-w-full mx-auto">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                                    <input type="text" placeholder={l('სახელი', 'Имя', 'Name')} required className="w-full text-sm md:text-base px-5 py-3.5 md:px-6 md:py-4 bg-slate-50 rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                    <input type="text" placeholder={l('ტელეფონი', 'Телефон', 'Phone')} required className="w-full text-sm md:text-base px-5 py-3.5 md:px-6 md:py-4 bg-slate-50 rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                </div>
                                <textarea rows={4} placeholder={l('შეტყობინება', 'Сообщение', 'Message')} className="w-full text-sm md:text-base px-5 py-3.5 md:px-6 md:py-4 bg-slate-50 rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" value={formData.message} onChange={e => setFormData({ ...formData, message: e.target.value })} />
                                <button type="submit" disabled={submitting} className="w-full py-4 md:py-5 bg-indigo-600 text-white rounded-xl md:rounded-2xl font-black md:tracking-widest text-sm md:text-base hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50">
                                    {submitting ? '...' : l('გაგზავნა', 'Отправить', 'Send')}
                                </button>
                                {submitStatus === 'success' && <p className="text-center text-emerald-600 font-black text-[11px] md:text-sm">{l('წარმატებით გაიგზავნა', 'Отправлено успешно', 'Sent successfully')}</p>}
                            </form>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="py-20 bg-white border-t border-slate-100">
                <div className="max-w-7xl mx-auto px-6 text-center md:text-left">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-12">
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 justify-center md:justify-start">
                                <Logo size={32} animated={false} />
                                <span className="text-xl font-black">ClassCore</span>
                            </div>
                            <p className="text-slate-500 font-medium max-w-sm">© 2026 ClassCore. {t.allRightsReserved}</p>
                        </div>
                        <div className="flex flex-wrap justify-center md:justify-start gap-6 md:gap-12 text-[10px] md:text-sm font-black text-slate-400 tracking-widest uppercase">
                            <Link href="/privacy" className="hover:text-indigo-600 transition-colors">{l('კონფიდენციალურობა', 'Конфиденциальность', 'Privacy')}</Link>
                            <Link href="/terms" className="hover:text-indigo-600 transition-colors">{l('წესები და პირობები', 'Условия', 'Terms')}</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
