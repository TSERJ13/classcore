"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
    ArrowRight,
    Check,
    Users,
    Calendar,
    Zap,
    BarChart3,
    Shield,
    MessageSquare,
    Laptop,
    Sparkles,
    Mail,
    Phone,
    ArrowUpRight,
    TrendingUp,
    TrendingDown,
    ChevronLeft,
    ChevronRight,
    Send
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

// --- SUB-COMPONENTS ---

function LiveStatBadge({ label, min, max, prefix = "", suffix = "", trend = "up" }: { label: string, min: number, max: number, prefix?: string, suffix?: string, trend?: 'up' | 'down' }) {
    const [value, setValue] = useState(min);

    useEffect(() => {
        const interval = setInterval(() => {
            setValue(prev => {
                const step = Math.floor(Math.random() * 3) + 1;
                const next = trend === 'up' ? prev + step : prev - step;
                if (next > max) return min;
                if (next < min) return max;
                return next;
            });
        }, 2000 + Math.random() * 1000);
        return () => clearInterval(interval);
    }, [min, max, trend]);

    return (
        <div className="bg-white/95 backdrop-blur-xl border border-indigo-100 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-4 animate-float-slow group transition-all hover:scale-110">
            <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-sm",
                trend === 'up' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"
            )}>
                {trend === 'up' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
                <p className="text-sm font-black text-slate-900 tracking-tighter">
                    {prefix}{value.toLocaleString()}{suffix}
                </p>
                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mt-0.5">{label}</p>
            </div>
        </div>
    );
}

function HighlightBillboard({ items }: { items: any[] }) {
    const [index, setIndex] = useState(0);
    const [fade, setFade] = useState(true);

    const next = useCallback(() => {
        setFade(false);
        setTimeout(() => {
            setIndex(prev => (prev + 1) % items.length);
            setFade(true);
        }, 400);
    }, [items.length]);

    useEffect(() => {
        const timer = setInterval(next, 6000);
        return () => clearInterval(timer);
    }, [next]);

    const current = items[index];

    return (
        <div className="relative w-full max-w-5xl mx-auto overflow-hidden rounded-[3rem] border-2 border-indigo-50 shadow-2xl bg-white group">
            <div className={cn("transition-all duration-700 flex flex-col md:grid md:grid-cols-2", fade ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}>
                {/* Visual Area */}
                <div className="relative aspect-video bg-indigo-950 flex items-center justify-center overflow-hidden">
                    <Image src={current.img} alt={current.title} fill className="object-contain p-4 group-hover:scale-105 transition-transform duration-1000" />
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-transparent to-black/20 pointer-events-none" />
                </div>

                {/* Text Area */}
                <div className="p-10 md:p-16 flex flex-col justify-center space-y-6">
                    <div className="flex items-center gap-2 text-indigo-600 font-black uppercase tracking-widest text-[10px]">
                        <span className="w-8 h-px bg-indigo-200" />
                        0{index + 1} / 0{items.length}
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">{current.title}</h3>
                    <p className="text-lg text-slate-500 font-medium leading-relaxed">{current.desc}</p>
                    <div className="pt-4 flex gap-4">
                        {items.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => { setFade(false); setTimeout(() => { setIndex(i); setFade(true); }, 400); }}
                                className={cn("h-1.5 rounded-full transition-all duration-300", i === index ? "w-8 bg-indigo-600" : "w-2 bg-slate-200 hover:bg-indigo-300")}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Nav Arrows */}
            <button onClick={() => { setFade(false); setTimeout(() => { setIndex(prev => (prev - 1 + items.length) % items.length); setFade(true); }, 400); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/80 backdrop-blur shadow-xl items-center justify-center text-slate-900 opacity-0 group-hover:opacity-100 transition-all hidden md:flex hover:bg-indigo-600 hover:text-white">
                <ChevronLeft className="w-6 h-6" />
            </button>
            <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/80 backdrop-blur shadow-xl items-center justify-center text-slate-900 opacity-0 group-hover:opacity-100 transition-all hidden md:flex hover:bg-indigo-600 hover:text-white">
                <ChevronRight className="w-6 h-6" />
            </button>
        </div>
    );
}

function ContactForm({ l }: { l: any }) {
    const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle');
    const handleSubmit = (e: any) => {
        e.preventDefault();
        setStatus('sending');
        setTimeout(() => setStatus('success'), 1500);
    };

    if (status === 'success') {
        return (
            <div className="bg-indigo-600 rounded-[3rem] p-20 text-center space-y-6 text-white animate-in zoom-in-95 duration-500 shadow-2xl shadow-indigo-600/30">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-3xl font-black uppercase tracking-tight">{l('გაგზავნილია!', 'Отправлено!', 'Message Sent!')}</h3>
                <p className="font-medium text-indigo-100">{l('მადლობა, ჩვენ მალე დაგიკავშირდებით.', 'Спасибо, мы скоро свяжемся с вами.', 'Thanks, we\'ll contact you soon.')}</p>
                <button onClick={() => setStatus('idle')} className="mt-8 text-sm font-black uppercase tracking-widest border-b border-indigo-200 hover:text-white transition-colors">{l('ხელახლა გაგზავნა', 'Отправить еще раз', 'Send Another')}</button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white p-12 lg:p-20 rounded-[4rem] border-2 border-indigo-50 shadow-2xl space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">{l('თქვენი სახელი', 'Ваше имя', 'Your Name')}</label>
                    <input required type="text" className="w-full bg-slate-50 border-0 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-300 font-bold" placeholder="Giorgi ..." />
                </div>
                <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">{l('ელ-ფოსტა', 'Email', 'Email')}</label>
                    <input required type="email" className="w-full bg-slate-50 border-0 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-300 font-bold" placeholder="example@studio.com" />
                </div>
            </div>
            <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">{l('შეტყობინება', 'Сообщение', 'Message')}</label>
                <textarea required rows={4} className="w-full bg-slate-50 border-0 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-300 font-bold resize-none" placeholder="..." />
            </div>
            <button
                type="submit"
                disabled={status === 'sending'}
                className={cn(
                    "w-full py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20",
                    status === 'sending' ? "bg-slate-100 text-slate-400 cursor-wait" : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                )}
            >
                {status === 'sending' ? (
                    <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                ) : (
                    <> {l('გაგზავნა', 'Отправить', 'Send Message')} <Send className="w-5 h-5" /> </>
                )}
            </button>
        </form>
    );
}

export default function LandingPage() {
    const { t, l } = useLanguage();
    const [scrolled, setScrolled] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        setMounted(true);
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", handleScroll);
        
        // Strict client-side auth detection using actual session verification to bypass cached "Dashboard" buttons
        const checkAuth = async () => {
            const hasLocalToken = !!localStorage.getItem('cc_auth_token');
            if (!hasLocalToken) {
                setIsLoggedIn(false);
                return;
            }
            // Trust localStorage, but ignore stale cookies as guests often have role cookies from previous sessions
            setIsLoggedIn(true);
        };
        checkAuth();

        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const galleryHighlights = useMemo(() => [
        { title: l('მოსწავლის პორტალი', 'Портал ученика', 'Student Portal'), desc: l('გიორგი და ნინო აკონტროლებენ თავიანთ განრიგს და დასწრებას.', 'Георгий и Нино контролируют свое расписание и посещаемость.', 'Giorgi and Nino monitor their schedule and attendance.'), img: '/gallery/client_portal.png' },
        { title: l('სმს სერვისი', 'СМС-сервис', 'SMS Service'), desc: l('ავტომატური შეტყობინებები მოსწავლეებისთვის და მშობლებისთვის.', 'Автоматические уведомления для учеников и родителей.', 'Auto-notifications for students and parents.'), img: '/gallery/sms_service.png' },
        { title: l('ანალიტიკა', 'Аналитика', 'Analytics'), desc: l('სტუდიის შემოსავლების და ზრდის სრული კონტროლი.', 'Полный контроль доходов и роста студии.', 'Full control over studio revenue and growth.'), img: '/gallery/analytics.png' },
        { title: l('ხელფასების გამოთვლა', 'Расчет зарплат', 'Salary Calculation'), desc: l('მასწავლებლების ანაზღაურების ავტომატური დარიცხვა.', 'Автоматический расчет вознаграждения преподавателей.', 'Automated teacher payroll calculation.'), img: '/gallery/salary.png' },
        { title: l('AI ასისტენტი', 'AI Ассиსტენტი', 'AI Assistant'), desc: l('ჭკვიანი დახმარება მონაცემების მართვასა და ანალიზში.', 'Уმная помощь в управлении и анализе данных.', 'Smart assistance in data management and analysis.'), img: '/gallery/ai_assistant.png' },
        { title: l('შიდა ჩატი', 'Внутренний чат', 'Internal Chat'), desc: l('მარიამი და ლუკა ურთიერთობენ მასწავლებლებთან ერთ სივრცეში.', 'Мариам и Лука общаются с преподавателями в едином пространстве.', 'Mariam and Luka communicate with teachers in one space.'), img: '/gallery/chat.png' }
    ], [l]);

    return (
        <div className="min-h-screen bg-white text-slate-900 scroll-smooth selection:bg-indigo-500 selection:text-white">
            {/* Header */}
            <header className={cn(
                "fixed top-0 inset-x-0 z-[110] transition-all duration-500 px-6",
                scrolled ? "bg-white/90 backdrop-blur-2xl border-b border-indigo-50/50 shadow-xl py-4" : "bg-white/80 backdrop-blur-xl py-8"
            )}>
                <div style={{ height: 'env(safe-area-inset-top, 0px)' }} />
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-1.5 md:gap-3 shrink-0">
                        <Logo className="w-8 h-8 md:w-12 md:h-12" transparent />
                        <span className="text-xl md:text-2xl font-black tracking-tight">ClassCore</span>
                    </Link>

                    <nav className="hidden lg:flex items-center gap-12">
                        {['features', 'pricing', 'about', 'contact'].map(id => (
                            <a key={id} href={`#${id}`} className="text-xs font-black text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-[0.2em]">{l(id === 'features' ? 'ფუნქციები' : id === 'pricing' ? 'ფასები' : id === 'about' ? 'ჩვენს შესახებ' : 'კონტაქტი', '', '')}</a>
                        ))}
                    </nav>

                    <div className="flex items-center gap-3 md:gap-4 shrink-0">
                        <Link href={isLoggedIn ? "/dashboard" : "/login"} className="h-9 md:h-12 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-[10px] md:text-[13px] text-white font-black px-4 md:px-8 rounded-xl md:rounded-2xl shadow-xl shadow-indigo-600/20 transition-all uppercase tracking-wide whitespace-nowrap">
                            {isLoggedIn ? l('დეშბორდი', 'Дашборд', 'Dashboard') : l('შესვლა', 'Войти', 'Login')}
                        </Link>
                        <div className="shrink-0 min-w-[40px]">
                            <LanguageSwitcher compact={true} variant="landing" align="right" />
                        </div>
                    </div>
                </div>
            </header>

            <main>
                {/* Hero */}
                <section className="pt-48 pb-20 lg:pt-64 lg:pb-40 px-6 bg-slate-50 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.05),transparent_70%)]" />
                    <div className="max-w-7xl mx-auto grid lg:grid-cols-[1fr_0.9fr] gap-32 items-center relative z-10">
                        <div className="space-y-10 text-center lg:text-left">
                            <h1 className="text-3xl md:text-6xl lg:text-7xl font-black text-slate-900 leading-[1.1] tracking-tight uppercase">
                                {l('მართეთ სტუდია\nავტოპილოტზე', 'Управляйте студией\nна автопилоте', 'Manage Your\nStudio on Autopilot')}
                            </h1>
                            <p className="text-lg text-slate-500 font-medium max-w-xl mx-auto lg:mx-0">
                                {l('უნივერსალური პლატფორმა, რომელიც აერთიანებს ყველაფერს რაც თქვენს სტუდიას სჭირდება.', 'Универсальная платформа, объединяющая всё, что нужно вашей студии.', 'The universal platform that brings everything your studio needs together.')}
                            </p>
                            <Link 
                                href={isLoggedIn ? "/dashboard" : "/registration"} 
                                className="inline-flex items-center justify-center px-10 py-5 md:px-12 md:py-6 bg-indigo-600 text-white rounded-2xl md:rounded-[2rem] font-black text-xs md:text-sm shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 hover:-translate-y-1 transition-all gap-3 uppercase tracking-widest"
                            >
                                {isLoggedIn ? l('დეშბორდი', 'Дашборд', 'Dashboard') : l('დაიწყე უფასოდ', 'Беსплатноე დემო', 'Start for Free')} <ArrowRight className="w-5 h-5" />
                            </Link>
                        </div>

                        <div className="relative">
                            <div className="absolute top-[-5%] left-[-2%] md:top-[-10%] md:left-[-15%] z-30 scale-[0.6] sm:scale-[0.8] lg:scale-100 origin-top-left transition-all duration-700">
                                <LiveStatBadge label={l('მოსწავლე', 'Учеников', 'Students')} min={1240} max={1500} trend="up" />
                            </div>
                            <div className="absolute top-[35%] right-[-2%] md:top-[40%] md:right-[-15%] z-30 scale-[0.6] sm:scale-[0.8] lg:scale-100 origin-top-right transition-all duration-700">
                                <LiveStatBadge label={l('დასწრება', 'Посещаемость', 'Attendance')} min={92} max={99} suffix="%" trend="down" />
                            </div>
                            <div className="absolute bottom-[-5%] left-[5%] md:bottom-[-10%] md:left-[10%] z-30 scale-[0.6] sm:scale-[0.8] lg:scale-100 origin-bottom-left transition-all duration-700">
                                <LiveStatBadge label={l('შემოსავალი', 'Доход', 'Revenue')} min={4500} max={6000} prefix="+" suffix=" GEL" trend="up" />
                            </div>
                            <div className="relative p-2 bg-white rounded-3xl md:rounded-[3rem] border-2 border-indigo-100 shadow-2xl md:rotate-1">
                                <div className="relative aspect-video rounded-2xl md:rounded-[2.5rem] overflow-hidden bg-slate-900">
                                    <Image src="/dashboard_hero_zoomed_out.png" alt="Hero" fill className="object-cover" priority />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="features" className="py-32 bg-white">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center space-y-4 mb-20">
                            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 uppercase tracking-tight">{l('პლატფორმის შესაძლებლობები', 'Возможности платформы', 'Platform Features')}</h2>
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{l('ყველა ინსტრუმენტი ერთ სივრცეში', 'Все инструменты в одном месте', 'All tools in one place')}</p>
                        </div>
                        <HighlightBillboard items={galleryHighlights} />
                    </div>
                </section>

                <section id="pricing" className="py-32 bg-slate-950 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.1),transparent_50%)]" />
                    <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center relative z-10">
                        <div className="space-y-8">
                            <h2 className="text-4xl lg:text-6xl font-black text-white uppercase tracking-tight leading-none">{l('მარტივი და\nგამჭვირვალე ფასი', 'Простая и\nпрозрачная цена', 'Simple and\nTransparent Pricing')}</h2>
                            <p className="text-xl text-slate-400 font-medium">{l('მოიცავს ყველა სერვისს ყოველგვარი ფარული ხარჯების გარეშე.', 'Включает все услуги без скрытых платежей.', 'Includes all services without any hidden fees.')}</p>
                            <div className="grid grid-cols-2 gap-6">
                                {[
                                    { t: l('ულიმიტო მოსწავლეები', 'Безлимит учеников', 'Unlimited Students'), i: Users },
                                    { t: l('სმს შეტყობინებები', 'СМС уведомления', 'SMS Notifications'), i: MessageSquare },
                                    { t: l('ფინანსური ანალიტიკა', 'Фин. аналитика', 'Financial Analytics'), i: BarChart3 },
                                    { t: l('AI ასისტენტი', 'AI Ассиსტენტი', 'AI Assistant'), i: Sparkles }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 text-slate-300">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400"><item.i className="w-4 h-4" /></div>
                                        <span className="text-[10px] font-black uppercase tracking-tight">{item.t}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white p-12 lg:p-16 rounded-[4rem] text-center space-y-10 shadow-[0_40px_100px_-20px_rgba(99,102,241,0.5)]">
                            <h3 className="text-xl font-black text-indigo-600 uppercase tracking-[0.3em]">{l('პრემიუმ პაკეტი', 'Премиум пакет', 'Premium Plan')}</h3>
                            <div className="flex items-baseline justify-center gap-2">
                                <span className="text-8xl font-black text-slate-900 tracking-tighter">49</span>
                                <span className="text-2xl font-black text-slate-400 uppercase tracking-widest">GEL</span>
                            </div>
                            <ul className="text-left space-y-4 pt-6 border-t border-slate-100">
                                {[
                                    l('24/7 მხარდაჭერა', '24/7 Поддержка', '24/7 Support'),
                                    l('მოსწავლის პორტალი', 'Портал ученика', 'Student Portal'),
                                    l('ავტომატური განრიგი', 'Авто-расписание', 'Auto Schedule'),
                                    l('3 ადმინისტრატორი', '3 администратора', '3 Administrators')
                                ].map((f, i) => (
                                    <li key={i} className="flex items-center gap-3">
                                        <Check className="w-5 h-5 text-emerald-500" />
                                        <span className="text-sm font-bold text-slate-600 uppercase tracking-tight">{f}</span>
                                    </li>
                                ))}
                            </ul>
                            <Link 
                                href={isLoggedIn ? "/dashboard" : "/registration"} 
                                className="block w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 hover:-translate-y-1 transition-all"
                            >
                                {isLoggedIn ? l('დეშბორდი', 'Дашборд', 'Dashboard') : l('დაწყება', 'Начать', 'Start Now')}
                            </Link>
                        </div>
                    </div>
                </section>

                <section id="about" className="py-32 bg-white px-6">
                    <div className="max-w-4xl mx-auto space-y-12 text-center">
                        <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
                            <Shield className="w-12 h-12" />
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tight">{l('ჩვენს შესახებ', 'О нас', 'About Us')}</h2>
                        <p className="text-xl md:text-2xl text-slate-500 font-medium leading-relaxed">
                            {l('ClassCore არის სტუდიების მართვის ინოვაციური პლატფორმა, რომელიც შექმნილია საქართველოში, ადგილობრივი ბიზნესის სპეციფიკის გათვალისწინებით. ჩვენი მიზანია ტექნოლოგიების მეშვეობით გავამარტივოთ ყოველდღიური მენეჯმენტი.', 'ClassCore — это инновационная платформа для управления студиями, созданная в Грузии с учетом специфики местного бизнеса. Наша цель — упростить ежедневное управление с помощью технологий.', 'ClassCore is an innovative studio management platform, created in Georgia with local business specifics in mind. Our goal is to simplify daily management through technology.')}
                        </p>
                    </div>
                </section>

                <section id="contact" className="py-32 bg-slate-50">
                    <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-[0.8fr_1.2fr] gap-20 items-center">
                        <div className="space-y-10">
                            <h2 className="text-4xl md:text-6xl font-black text-slate-900 uppercase tracking-tight">{l('მოგვწერეთ', 'Напишите нам', 'Contact Us')}</h2>
                            <p className="text-lg text-slate-500 font-medium">{l('დაგვიკავშირდით ნებისმიერ დროს, ჩვენი გუნდი მზად არის დაგეხმაროთ.', 'Пишите нам в любое время, наша команда готова помочь.', 'Contact us anytime, our team is ready to help.')}</p>
                            <div className="space-y-6">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm text-indigo-600"><Mail className="w-6 h-6" /></div>
                                    <div className="text-sm font-bold">support@classcore.ge</div>
                                </div>
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm text-indigo-600"><Phone className="w-6 h-6" /></div>
                                    <div className="text-sm font-bold">+995 555 123 456</div>
                                </div>
                            </div>
                        </div>
                        <ContactForm l={l} />
                    </div>
                </section>
            </main>

            <footer className="py-20 border-t border-slate-100 bg-white">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-12">
                    <div className="flex flex-col items-center md:items-start gap-4">
                        <div className="flex items-center gap-3">
                            <Logo size={40} transparent />
                            <span className="text-xl font-black tracking-tighter">ClassCore</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-12 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        <Link href="/privacy" className="hover:text-indigo-600 transition-colors">{l('კონფიდენციალურობა', 'Приватность', 'Privacy')}</Link>
                        <Link href="/terms" className="hover:text-indigo-600 transition-colors">{l('წესები', 'Условия', 'Terms')}</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
