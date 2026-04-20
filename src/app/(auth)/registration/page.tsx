'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
    Sparkles, 
    Mail, 
    Lock, 
    User, 
    Building2, 
    ArrowRight, 
    ChevronRight,
    Shield,
    Globe,
    CheckCircle2,
    Eye,
    EyeOff,
    AlertCircle,
    Phone
} from 'lucide-react';
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Logo } from "@/components/ui/Logo";
import { cn, compactSlugify } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const COUNTRIES = [
    { code: 'GE', dial: '+995', flag: '🇬🇪' },
    { code: 'RU', dial: '+7', flag: '🇷🇺' },
    { code: 'US', dial: '+1', flag: '🇺🇸' },
];

export default function RegistrationPage() {
    const { l, lang } = useLanguage();
    const router = useRouter();
    const [step, setStep] = useState<'initial' | 'success'>('initial');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [agreed, setAgreed] = useState(false);

    // Form State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [studioName, setStudioName] = useState('');
    const [phone, setPhone] = useState('');
    const [dialCode, setDialCode] = useState('+995');
    const [regData, setRegData] = useState<any>(null);

    useEffect(() => {
        sessionStorage.removeItem('cc_lang_session');
    }, []);

    const getPasswordStrength = () => {
        if (!password) return 0;
        let strength = 0;
        if (password.length >= 6) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        return strength;
    };

    const handleInitialRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!agreed) return;
        
        setLoading(true);
        setError(null);

        try {
            const supabase = createClient();
            const fullPhone = dialCode + phone.replace(/\s/g, '');
            const studioSlug = compactSlugify(studioName);
            console.log('📝 [Registration] Generated slug:', studioSlug, 'for studio:', studioName);

            if (!studioSlug) {
                throw new Error(l('გთხოვთ შეიყვანოთ ვალიდური სტუდიის სახელი', 'Пожалуйста, введите корректное название студии', 'Please enter a valid studio name'));
            }
            
            const { error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        studio_name: studioName,
                        studio_slug: studioSlug,
                        phone: fullPhone,
                        primary_lang: lang,
                        role: 'owner',
                        is_activated: true
                    },
                    emailRedirectTo: `${window.location.origin}/login?status=verification_sent`
                }
            });

            if (authError) throw authError;

            // SCORCHED EARTH CLEANUP: Wiping all local data to ensure a clean slate for the new studio
            if (typeof window !== 'undefined') {
                Object.keys(localStorage).forEach(key => {
                    // We remove everything that could contain data (students, calendar, checkins etc.)
                    // but keep the language preference and the active slug we just worked with.
                    if (key.startsWith('cc_') && 
                        !key.includes('lang') && 
                        !key.includes('active_studio_slug')) {
                        localStorage.removeItem(key);
                    }
                });
                
                // CRITICAL FIX: Seed initial settings so first login pushes proper owner data to SuperAdmin!
                const initialSettings = {
                    studioSlug: studioSlug,
                    studioName: studioName,
                    language: lang,
                    owner_info: {
                        first_name: firstName,
                        last_name: lastName,
                        email: email,
                        phone: fullPhone
                    },
                    staff: [{
                        id: Math.random().toString(36).substring(2, 9),
                        first_name: firstName,
                        last_name: lastName,
                        full_name: `${firstName} ${lastName}`.trim(),
                        email: email,
                        phone: fullPhone,
                        role: 'owner',
                        status: 'active',
                        created_at: new Date().toISOString()
                    }]
                };
                localStorage.setItem(`cc_studio_settings_${studioSlug}`, JSON.stringify(initialSettings));

                // 1. Force the next sync pulse to OVERWRITE cloud instead of MERGING (prevents orphan leaks)
                localStorage.setItem(`cc_is_fresh_${studioSlug}`, 'true');
                // 2. Mark onboarding as in progress to guide initial UI
                localStorage.setItem('cc_onboarding_in_progress', 'true');
            }

            // 3. Trigger Branded Welcome/Activation Email via our SMTP
            try {
                await fetch('/api/auth/send-activation-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email,
                        firstName,
                        activationLink: `${window.location.origin}/login?status=activated`
                    })
                });
            } catch (e) {
                console.error('Failed to send branded welcome email:', e);
                // We don't throw here as the user is already signed up in Supabase
            }

            setRegData({ email });
            setStep('success');
        } catch (err: any) {
            console.error('Registration error:', err);
            setError(err.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden relative animate-fade-up">
            <div className="fixed top-0 right-0 w-[50%] h-full bg-indigo-500/5 blur-[120px] -z-10" />
            <div className="fixed bottom-0 left-0 w-[30%] h-1/2 bg-violet-500/5 blur-[100px] -z-10" />

            <div className="w-full max-w-4xl relative z-10 flex flex-col gap-8 pt-0 pb-8 duration-700">
                <div className="flex flex-col items-center gap-6">
                    <Link href="/" className="group transition-all duration-500 hover:scale-110 active:scale-95">
                        <Logo size={110} transparent />
                    </Link>
                </div>

                <div className="bg-white p-8 sm:p-10 rounded-[3rem] border border-slate-100 shadow-2xl shadow-indigo-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
                    
                    {step === 'initial' && (
                        <div className="space-y-8">
                            <div className="text-center space-y-3 mb-10 relative">
                                <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none uppercase">{l('რეგისტრაცია', 'Регистрация', 'Fast Registration')}</h2>
                                <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest leading-none flex items-center justify-center gap-3 opacity-90">
                                    <Sparkles className="w-4 h-4 animate-pulse" />
                                    {l('დაიწყე სტუდიის მართვა 60 წამში', 'Запустите студию за 60 сек', 'Launch your studio in 60s')}
                                </p>
                            </div>

                            {error && (
                                <div className="max-w-2xl mx-auto bg-red-50 border border-red-100/50 p-5 rounded-2xl flex items-start gap-4 mb-8">
                                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                                    <p className="text-[11px] text-red-600 font-bold leading-tight uppercase">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleInitialRegister} className="space-y-6 relative">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                    {/* Left Column: Identity & Contact */}
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-500/80 uppercase tracking-widest ml-1 flex items-center gap-3 opacity-90">
                                                    <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
                                                        <User className="w-3.5 h-3.5" />
                                                    </div>
                                                    {l('სახელი', 'Имя', 'First Name')}
                                                </label>
                                                <input 
                                                    value={firstName} onChange={e => setFirstName(e.target.value)}
                                                    required 
                                                    className="w-full h-11 bg-slate-50/50 border border-slate-100 rounded-2xl px-5 text-sm font-black text-slate-900 focus:ring-0 focus:border-indigo-500/30 transition-all outline-none placeholder:text-slate-300 shadow-xs" 
                                                    placeholder={l('სახელი...', 'Имя...', 'Jane')}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-500/80 uppercase tracking-widest ml-1 flex items-center gap-3 opacity-90">
                                                    <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
                                                        <User className="w-3.5 h-3.5" />
                                                    </div>
                                                    {l('გვარი', 'Фамилия', 'Last Name')}
                                                </label>
                                                <input 
                                                    value={lastName} onChange={e => setLastName(e.target.value)}
                                                    required 
                                                    className="w-full h-11 bg-slate-50/50 border border-slate-100 rounded-2xl px-5 text-sm font-black text-slate-900 focus:ring-0 focus:border-indigo-500/30 transition-all outline-none placeholder:text-slate-300 shadow-xs"
                                                    placeholder={l('გვარი...', 'Фамилия...', 'Doe')}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500/80 uppercase tracking-widest ml-1 flex items-center gap-3 opacity-90">
                                                <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
                                                    <Building2 className="w-3.5 h-3.5" />
                                                </div>
                                                {l('სტუდიის სახელი', 'Название студии', 'Studio Identity')}
                                            </label>
                                            <input 
                                                value={studioName} onChange={e => setStudioName(e.target.value)}
                                                required 
                                                className="w-full h-11 bg-slate-50/50 border border-slate-100 rounded-2xl px-5 text-sm font-black text-slate-900 focus:ring-0 focus:border-indigo-500/30 transition-all outline-none placeholder:text-slate-300 shadow-xs"
                                                placeholder={l('სტუდიის სახელი...', 'Название студии...', 'Cosmos Dance Studio')}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500/80 uppercase tracking-widest ml-1 flex items-center gap-3 opacity-90">
                                                <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
                                                    <Phone className="w-3.5 h-3.5" />
                                                </div>
                                                {l('ტელეფონი', 'Телефон', 'Comm Link (Phone)')}
                                            </label>
                                            <div className="flex gap-2 min-w-0">
                                                <div className="relative shrink-0 w-[70px]">
                                                    <select 
                                                        value={dialCode} onChange={e => setDialCode(e.target.value)}
                                                        className="appearance-none w-full h-11 bg-slate-50/50 border border-slate-100 rounded-2xl px-0 text-center text-lg focus:ring-0 focus:border-indigo-500/30 transition-all outline-none shadow-xs cursor-pointer"
                                                    >
                                                        {COUNTRIES.map(c => (
                                                            <option key={c.code} value={c.dial} className="text-sm">{c.flag}</option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                                                        <Globe className="w-2.5 h-2.5" />
                                                    </div>
                                                </div>
                                                <input 
                                                    value={phone} onChange={e => setPhone(e.target.value)}
                                                    required 
                                                    type="tel"
                                                    className="flex-1 min-w-0 h-11 bg-slate-50/50 border border-slate-100 rounded-2xl px-4 text-sm font-black text-slate-900 focus:ring-0 focus:border-indigo-500/30 transition-all outline-none placeholder:text-slate-300 shadow-xs"
                                                    placeholder="555..."
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Security & Auth */}
                                    <div className="space-y-6">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500/80 uppercase tracking-widest ml-1 flex items-center gap-3 opacity-90">
                                                <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
                                                    <Mail className="w-3.5 h-3.5" />
                                                </div>
                                                {l('ფოსტა', 'Почта', 'Identity (Email)')}
                                            </label>
                                            <input 
                                                value={email} onChange={e => setEmail(e.target.value)}
                                                required 
                                                type="email"
                                                className="w-full h-11 bg-slate-50/50 border border-slate-100 rounded-2xl px-5 text-sm font-black text-slate-900 focus:ring-0 focus:border-indigo-500/30 transition-all outline-none placeholder:text-slate-300 shadow-xs"
                                                placeholder={l('იმეილი...', 'Почта...', 'jane@cosmos.space')}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500/80 uppercase tracking-widest ml-1 flex items-center gap-3 opacity-90">
                                                <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
                                                    <Lock className="w-3.5 h-3.5" />
                                                </div>
                                                {l('პაროლი', 'Пароль', 'Security Key')}
                                            </label>
                                            <div className="relative group">
                                                <input 
                                                    value={password} onChange={e => setPassword(e.target.value)}
                                                    required 
                                                    type={showPassword ? "text" : "password"}
                                                    className="w-full h-11 bg-slate-50/50 border border-slate-100 rounded-2xl px-5 text-sm font-black text-slate-900 focus:ring-0 focus:border-indigo-500/30 transition-all outline-none placeholder:text-slate-300 shadow-xs"
                                                    placeholder="••••••••"
                                                />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            
                                            {/* Password Strength Indicator */}
                                            {password && (
                                                <div className="px-1 pt-1.5 space-y-2">
                                                    <div className="flex gap-1.5 h-1">
                                                        {[1, 2, 3].map((s) => (
                                                            <div key={s} className={cn(
                                                                "flex-1 rounded-full transition-all duration-500",
                                                                getPasswordStrength() >= s 
                                                                    ? s === 1 ? "bg-red-400" : s === 2 ? "bg-amber-400" : "bg-emerald-400"
                                                                    : "bg-slate-100"
                                                            )} />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-500/80 uppercase tracking-widest ml-1 flex items-center gap-3 opacity-90">
                                                <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
                                                    <Globe className="w-3.5 h-3.5" />
                                                </div>
                                                {l('პლატფორმის ენა', 'Язык платформы', 'System Language')}
                                            </label>
                                            <LanguageSwitcher 
                                                variant="landing" 
                                                mode="persistent" 
                                                align="left"
                                                className="w-full h-11 bg-slate-50/50 border-slate-100 rounded-2xl px-5 flex items-center justify-between shadow-xs hover:border-indigo-100 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Footer - Centered Actions */}
                                <div className="flex flex-col items-center space-y-6 pt-4 border-t border-slate-50 mt-6">
                                    <div className="w-full max-w-sm">
                                        <label className="flex items-center justify-center gap-4 cursor-pointer group">
                                            <div className="relative">
                                                <input 
                                                    type="checkbox" 
                                                    checked={agreed} onChange={e => setAgreed(e.target.checked)}
                                                    className="sr-only" 
                                                />
                                                <div className={cn(
                                                    "w-6 h-6 rounded-xl border-2 transition-all duration-300 flex items-center justify-center",
                                                    agreed ? "bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-500/30" : "border-slate-200 bg-slate-50/50 group-hover:border-slate-300"
                                                )}>
                                                    {agreed && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                </div>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-500 leading-tight">
                                                {l('ვეთანხმები', 'Я согласен с', 'I agree to')} <span className="text-indigo-600 hover:text-indigo-700 underline decoration-indigo-200 underline-offset-4">{l('წესებსა და კონფიდენციალობას', 'правилами', 'Privacy & Terms')}</span>
                                            </p>
                                        </label>
                                    </div>

                                    <div className="w-full max-w-sm space-y-6">
                                        <button 
                                            type="submit" 
                                            disabled={loading || getPasswordStrength() < 2 || !agreed}
                                            className={cn(
                                                "w-full h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-sm transition-all duration-300 flex items-center justify-center gap-4 relative overflow-hidden group",
                                                loading || getPasswordStrength() < 2 || !agreed 
                                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                                                    : "bg-slate-900 text-white shadow-2xl shadow-indigo-500/20 active:scale-[0.98] hover:bg-slate-800"
                                            )}
                                        >
                                            {loading ? l('გთხოვთ მოიცადოთ...', 'Загрузка...', 'Connecting...') : (
                                                <>
                                                    {l('რეგისტრაცია', 'Реეგისტრაცია', 'Activate Account')}
                                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                                                </>
                                            )}
                                        </button>
                                        
                                        <p className="text-center text-sm font-black text-slate-400 tracking-tight">
                                            {l('უკვე გაქვთ ანგარიში?', 'Уже есть аккаунт?', 'Already a Cosmos pilot?')} <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-black decoration-indigo-200 hover:underline underline-offset-4">{l('შესვლა', 'Войти', 'Login')}</Link>
                                        </p>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="text-center py-10 animate-fade-up">
                            <div className="flex flex-col items-center gap-8 mb-12">
                                <Link href="/" className="group transition-all duration-500 hover:scale-110 active:scale-95">
                                    <Logo size={110} transparent />
                                </Link>
                            </div>
                            
                            <div className="space-y-6">
                                <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none uppercase">{l('წარმატება!', 'Успех!', 'Welcome!')}</h2>
                                <div className="space-y-3 py-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{l('ანგარიში შეიქმნა', 'Аккаунт создан', 'Mission Control Ready')}</p>
                                    <p className="text-base font-black text-indigo-600 bg-indigo-50/50 py-3 inline-block px-8 rounded-full border border-indigo-100/50 shadow-sm">
                                        {regData?.email}
                                    </p>
                                </div>
                                <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100/50 space-y-4 shadow-sm">
                                    <div className="flex items-center justify-center gap-3 text-indigo-500">
                                        <Sparkles className="w-6 h-6" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">{l('შეამოწმეთ ფოსტა', 'Проверьте почту', 'Verification Required')}</p>
                                    </div>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                                        {l('გთხოვთ დაადასტუროთ თქვენი ელ-ფოსტა სისტემაში შესვლამდე', 'Пожалуйста, подтвердите вашу почту перед входом', 'A portal link has been sent to your primary frequency. Confirm to activate.')}
                                    </p>
                                </div>
                                
                                <Link href="/login" className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-sm shadow-xl shadow-slate-900/10 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-8 hover:bg-slate-800">
                                    {l('შესვლა', 'Войти', 'Ignition (Login)')}
                                    <ChevronRight className="w-5 h-5" />
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="text-center space-y-4 opacity-40 pt-10">
                    <div className="flex items-center justify-center gap-4">
                        <Shield className="w-4 h-4 text-slate-400" />
                        <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
                        <Globe className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 tracking-[0.5em] uppercase leading-none">ClassCore COSMOS OS</p>
                </div>
            </div>
        </div>
    );
}
