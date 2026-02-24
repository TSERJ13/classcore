'use client';

import {
    Zap, Users, Calendar, Banknote, Shield, Star,
    ChevronRight, ArrowRight, Play, Check, Globe,
    LayoutDashboard, Laptop, Sparkles, Menu, X
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';

export default function LandingPage() {
    const { settings } = useStudio();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const ICON_MAP: Record<string, any> = {
        Users, Calendar, Banknote, CheckCircle2: Check, LayoutDashboard, Globe, Shield, Star, Sparkles, Zap
    };

    const PLANS = [
        {
            name: 'Starter',
            price: '49',
            desc: 'პატარა სტუდიებისთვის',
            features: ['20 სტუდენტი', '3 ჯგუფი', 'დასწრების აღრიცხვა', 'Email მხარდაჭერა'],
            color: 'text-indigo-600',
            bg: 'bg-indigo-600',
            popular: false
        },
        {
            name: 'Growth',
            price: '99',
            desc: 'მზარდი ბიზნესისთვის',
            features: ['შეუზღუდავი სტუდენტები', 'ჯგუფების მართვა', 'ფინანსური ანალიტიკა', 'SMS შეხსენებები', 'პრიორიტეტული მხარდაჭერა'],
            color: 'text-violet-600',
            bg: 'bg-violet-600',
            popular: true
        },
        {
            name: 'Enterprise',
            price: '199',
            desc: 'დიდი ქსელებისთვის',
            features: ['მრავალი ფილიალი', 'API წვდომა', 'White-label ოფცია', 'პერსონალური მენეჯერი'],
            color: 'text-emerald-600',
            bg: 'bg-emerald-600',
            popular: false
        }
    ];

    return (
        <div className="min-h-screen bg-white text-slate-900 scroll-smooth selection:bg-indigo-500 selection:text-white">
            {/* Header */}
            <header className={cn(
                "fixed top-0 inset-x-0 z-[100] transition-all duration-300 px-6 py-4",
                scrolled ? "bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-sm" : "bg-transparent"
            )}>
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {settings.logoDataUrl ? (
                            <img
                                src={settings.logoDataUrl}
                                alt="Logo"
                                className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-black/5 logo-animate-hover logo-white logo-large"
                            />
                        ) : (
                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 relative group logo-animate-hover logo-large">
                                <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain logo-white rounded-xl"
                                    onError={(e) => (e.currentTarget.style.display = 'none')} />
                                <Zap className="w-6 h-6 text-white absolute inset-0 m-auto opacity-0" strokeWidth={2.5} />
                            </div>
                        )}
                        <span className="text-xl font-black tracking-tight text-slate-900">ClassCore</span>
                    </div>

                    <nav className="hidden md:flex items-center gap-8">
                        {['Features', 'Pricing', 'About', 'Contact'].map(item => (
                            <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">
                                {item === 'Features' ? 'ფუნქციები' : item === 'Pricing' ? 'ფასები' : item === 'About' ? 'ჩვენს შესახებ' : 'კონტაქტი'}
                            </a>
                        ))}
                    </nav>

                    <div className="flex items-center gap-4">
                        <Link href="/login" className="text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">
                            შესვლა
                        </Link>
                        <Link href="/register" className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-xl shadow-indigo-600/20 transition-all">
                            დაწყება
                        </Link>
                    </div>
                </div>
            </header>

            <main>
                {/* Hero Section */}
                <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                    <div className="absolute top-0 right-0 -z-10 w-[60%] h-full bg-gradient-to-bl from-indigo-50/50 to-transparent blur-3xl opacity-70" />
                    <div className="absolute top-1/4 -left-20 -z-10 w-[40%] h-1/2 bg-gradient-to-tr from-violet-50/50 to-transparent blur-3xl opacity-70 rotate-12" />

                    <div className="max-w-7xl mx-auto px-6 text-center lg:text-left">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div className="space-y-8 max-w-2xl mx-auto lg:mx-0">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full">
                                    <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-indigo-700">სტუდიის მართვის ახალი ეპოქა</span>
                                </div>
                                <h1 className="text-5xl lg:text-7xl font-black text-slate-900 leading-[1.1] tracking-tight whitespace-pre-line">
                                    {settings.landingContent.heroTitle}
                                </h1>
                                <p className="text-xl text-slate-600 font-medium leading-relaxed max-w-xl whitespace-pre-line">
                                    {settings.landingContent.heroSubtitle}
                                </p>
                                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 justify-center lg:justify-start">
                                    <Link href="/register" className="w-full sm:w-auto px-8 py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-2">
                                        დაიწყეთ უფასოდ <ArrowRight className="w-5 h-5" />
                                    </Link>
                                    <button className="w-full sm:w-auto px-8 py-5 bg-white text-slate-700 border border-slate-200 rounded-2xl font-black text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                                        <Play className="w-5 h-5 fill-slate-700" /> დემო ვერსია
                                    </button>
                                </div>
                                <div className="flex items-center gap-4 pt-6 justify-center lg:justify-start">
                                    <div className="flex -space-x-3">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden">
                                                <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="" className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-sm font-bold text-slate-500">
                                        <span className="text-slate-900">50+</span> სტუდია უკვე გვენდობა
                                    </div>
                                </div>
                            </div>

                            <div className="relative">
                                {/* Mockup Image Frame */}
                                <div className="relative z-10 p-2 bg-slate-900/5 backdrop-blur-sm rounded-[2.5rem] border border-slate-200/50 shadow-2xl">
                                    <div className="bg-white rounded-[2rem] overflow-hidden border border-slate-200 aspect-[4/3] relative group">
                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-violet-500/10 mix-blend-overlay" />
                                        <img src="https://placehold.co/800x600/8b5cf6/ffffff?text=Studio+Management" alt="App Mockup" className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700" />

                                        {/* Floating UI elements */}
                                        <div className="absolute top-6 left-6 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-2xl border border-white/50 animate-bounce-slow">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                                                    <Sparkles className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">დღევანდელი შემოსავალი</p>
                                                    <p className="text-sm font-black text-slate-900">1,200 ₾</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-2xl border border-white/50 animate-float">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-600">
                                                    <Users className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">აქტიური სტუდენტები</p>
                                                    <p className="text-sm font-black text-slate-900">142</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Abstract shapes */}
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl animate-pulse" />
                                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-violet-600/10 rounded-full blur-3xl animate-pulse delay-700" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section id="features" className="py-24 bg-slate-50/50">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center space-y-4 mb-16">
                            <h2 className="text-xs font-black text-indigo-600 uppercase tracking-[0.3em]">ძირითადი ფუნქციები</h2>
                            <p className="text-4xl lg:text-5xl font-black text-slate-900">ყველაფერი რაც თქვენს <br />სტუდიას სჭირდება</p>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {settings.landingContent.features.map((f, i) => {
                                const Icon = ICON_MAP[f.icon] || Sparkles;
                                return (
                                    <div key={i} className="group p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-2 transition-all duration-300">
                                        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg mb-6 group-hover:scale-110 transition-transform bg-indigo-500")}>
                                            <Icon className="w-7 h-7" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 mb-3">{f.title}</h3>
                                        <p className="text-slate-600 font-medium leading-relaxed">{f.desc}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Dashboard Preview Section */}
                <section className="py-24 overflow-hidden">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="bg-slate-900 rounded-[3.5rem] p-8 lg:p-20 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-[50%] h-full bg-indigo-500/10 blur-[120px]" />
                            <div className="absolute bottom-0 left-0 w-[30%] h-1/2 bg-violet-600/10 blur-[100px]" />

                            <div className="grid lg:grid-cols-2 gap-16 items-center relative z-10">
                                <div className="space-y-8">
                                    <h2 className="text-4xl lg:text-6xl font-black text-white leading-tight">სრული კონტროლი თქვენს ხელთაა</h2>
                                    <p className="text-slate-400 text-lg font-medium leading-relaxed">
                                        ჩვენი დეშბორდი შექმნილია მაქსიმალური ეფექტურობისთვის. ერთი შეხედვით ხედავთ სტუდიის ყველა მნიშვნელოვან მაჩვენებელს.
                                    </p>
                                    <ul className="space-y-4">
                                        {['ინტუიციური ინტერფეისი', 'მუქი და ღია რეჟიმები', 'მობილურით მართვა', 'მრავალენოვანი მხარდაჭერა'].map((item, i) => (
                                            <li key={i} className="flex items-center gap-3 text-white font-bold">
                                                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                </div>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                    <Link href="/dashboard" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-slate-900 rounded-2xl font-black hover:scale-105 active:scale-95 transition-all">
                                        ნახეთ დემო <ChevronRight className="w-5 h-5" />
                                    </Link>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] group-hover:bg-indigo-500/30 transition-all" />
                                    <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-3xl p-3 shadow-2xl relative">
                                        <div className="bg-slate-900 rounded-2xl overflow-hidden aspect-video relative">
                                            <img src="https://placehold.co/1200x800/6366f1/ffffff?text=ClassCore+Dashboard" alt="App UI" className="w-full h-full object-cover opacity-60" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-20 h-20 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-2xl cursor-pointer hover:scale-110 active:scale-95 transition-all">
                                                    <Play className="w-8 h-8 fill-slate-900 ml-1" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Pricing Section */}
                <section id="pricing" className="py-24">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center space-y-4 mb-20">
                            <h2 className="text-xs font-black text-indigo-600 uppercase tracking-[0.3em]">გეგმები და ფასები</h2>
                            <p className="text-4xl lg:text-5xl font-black text-slate-900">აირჩიეთ თქვენი გეგმა</p>
                            <p className="text-slate-500 font-medium">14 დღიანი უფასო საცდელი პერიოდი ყველა გეგმაზე</p>
                        </div>

                        <div className="grid lg:grid-cols-3 gap-8">
                            {PLANS.map((plan, i) => (
                                <div key={i} className={cn(
                                    "relative p-10 rounded-[3rem] border transition-all duration-300 group",
                                    plan.popular
                                        ? "bg-slate-900 border-slate-900 shadow-2xl shadow-indigo-500/20 scale-105 z-10"
                                        : "bg-white border-slate-100 hover:border-slate-200 shadow-sm"
                                )}>
                                    {plan.popular && (
                                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
                                            რეკომენდებული
                                        </div>
                                    )}
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className={cn("text-2xl font-black mb-1", plan.popular ? "text-white" : "text-slate-900")}>{plan.name}</h3>
                                            <p className={cn("text-sm font-medium", plan.popular ? "text-slate-400" : "text-slate-500")}>{plan.desc}</p>
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <span className={cn("text-4xl font-black", plan.popular ? "text-white" : "text-slate-900")}>{plan.price} ₾</span>
                                            <span className={cn("text-sm font-medium", plan.popular ? "text-slate-500" : "text-slate-400")}>/თვე</span>
                                        </div>
                                        <div className="space-y-4 pt-6">
                                            {plan.features.map((f, fi) => (
                                                <div key={fi} className="flex items-center gap-3">
                                                    <Check className={cn("w-5 h-5", plan.popular ? "text-emerald-400" : "text-indigo-600")} strokeWidth={3} />
                                                    <span className={cn("text-sm font-semibold", plan.popular ? "text-slate-300" : "text-slate-600")}>{f}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <Link href="/register" className={cn(
                                            "w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 mt-6",
                                            plan.popular
                                                ? "bg-indigo-600 text-white hover:bg-indigo-500"
                                                : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                                        )}>
                                            დაწყება <ArrowRight className="w-4 h-4" />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-24 relative overflow-hidden">
                    <div className="absolute inset-0 bg-indigo-600" />
                    <div className="absolute top-0 right-0 w-[40%] h-full bg-white/10 skew-x-12 translate-x-1/2" />

                    <div className="max-w-4xl mx-auto px-6 text-center relative z-10 space-y-10">
                        <h2 className="text-4xl lg:text-7xl font-black text-white leading-tight uppercase italic tracking-tighter">
                            მზად ხართ სტუდიის <br />შემდეგ ეტაპზე გადასაყვანად?
                        </h2>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link href="/register" className="w-full sm:w-auto px-10 py-6 bg-white text-indigo-600 rounded-3xl font-black text-xl shadow-2xl shadow-black/20 hover:scale-105 active:scale-95 transition-all">
                                დაიწყეთ დღესვე
                            </Link>
                            <Link href="/contact" className="w-full sm:w-auto px-10 py-6 bg-transparent text-white border-2 border-white/30 hover:bg-white/10 rounded-3xl font-black text-xl transition-all">
                                კონსულტაცია
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-100 py-16">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-4 gap-12">
                        <div className="col-span-2 space-y-6">
                            <div className="flex items-center gap-3">
                                {settings.logoDataUrl ? (
                                    <img
                                        src={settings.logoDataUrl}
                                        alt="Logo"
                                        className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-black/5"
                                    />
                                ) : (
                                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 relative group">
                                        <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain logo-white rounded-xl"
                                            onError={(e) => (e.currentTarget.style.display = 'none')} />
                                        <Zap className="w-6 h-6 text-white absolute inset-0 m-auto opacity-0" strokeWidth={2.5} />
                                    </div>
                                )}
                                <span className="text-2xl font-black tracking-tight text-slate-900">ClassCore</span>
                            </div>
                            <p className="text-slate-500 font-medium max-w-sm">
                                საუკეთესო ინსტრუმენტი თქვენი ბიზნესის ზრდისთვის. ჩვენ ვზრუნავთ ტექნიკურ მხარეზე, თქვენ კი — შემოქმედებაზე.
                            </p>
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">პროდუქტი</h4>
                            <ul className="space-y-4 text-slate-500 font-semibold text-sm">
                                <li><a href="#features" className="hover:text-indigo-600 transition-colors">ფუნქციები</a></li>
                                <li><a href="#pricing" className="hover:text-indigo-600 transition-colors">ფასები</a></li>
                                <li><a href="#" className="hover:text-indigo-600 transition-colors">დემო</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">კონტაქტი</h4>
                            <ul className="space-y-4 text-slate-500 font-semibold text-sm">
                                <li>support@classcore.ge</li>
                                <li>+995 555 12 34 56</li>
                                <li>თბილისი, საქართველო</li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-16 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">© 2026 ClassCore. All rights reserved.</p>
                        <div className="flex gap-6">
                            <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors"><Zap className="w-5 h-5" /></a>
                            <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors"><LayoutDashboard className="w-5 h-5" /></a>
                            <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors"><Laptop className="w-5 h-5" /></a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

// Add these to globals.css if not present
// @keyframes float {
//   0%, 100% { transform: translateY(0); }
//   50% { transform: translateY(-20px); }
// }
// .animate-float { animation: float 6s ease-in-out infinite; }
// .animate-bounce-slow { animation: bounce 4s infinite; }
