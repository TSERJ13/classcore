'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';
import { pushStudioStateToCloud } from '@/lib/sync-store';
import { 
    Mail, Lock, User, ArrowRight, Sparkles, Building2, 
    UserSquare2, CheckCircle2, ChevronRight, 
    MailSearch, Globe, Shield, AlertCircle 
} from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { cn, compactSlugify } from '@/lib/utils';

type Step = 'account' | 'success';

const POPULAR_DOMAINS = ['gmail.com', 'outlook.com', 'icloud.com', 'yahoo.com', 'mail.ru', 'box.az'];

const COUNTRIES = [
    { code: 'GE', name: 'Georgia', dial: '+995', flag: '🇬🇪' },
    { code: 'US', name: 'USA', dial: '+1', flag: '🇺🇸' },
    { code: 'GB', name: 'UK', dial: '+44', flag: '🇬🇧' },
    { code: 'RU', name: 'Russia', dial: '+7', flag: '🇷🇺' },
    { code: 'UA', name: 'Ukraine', dial: '+380', flag: '🇺🇦' },
    { code: 'TR', name: 'Turkey', dial: '+90', flag: '🇹🇷' },
    { code: 'AZ', name: 'Azerbaijan', dial: '+994', flag: '🇦🇿' },
    { code: 'AM', name: 'Armenia', dial: '+374', flag: '🇦🇲' },
];

export default function RegisterPage() {
    const { t, lang } = useT();
    const [step, setStep] = useState<Step>('account');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [studioName, setStudioName] = useState('');
    const [phone, setPhone] = useState('');
    const [country, setCountry] = useState(COUNTRIES[0]);
    const [agreed, setAgreed] = useState(false);
    
    const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
    const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [regData, setRegData] = useState({ email: '', studioSlug: '' });

    const l = (ge: string, ru: string, en: string) => lang === 'ka' ? ge : lang === 'ru' ? ru : en;

    useEffect(() => {
        fetch('https://ipapi.co/json/')
            .then(res => res.json())
            .then(data => {
                const found = COUNTRIES.find(c => c.code === data.country_code);
                if (found) setCountry(found);
            })
            .catch(() => console.log('IP Detection failed, defaulting to GE'));
    }, []);

    useEffect(() => {
        let score = 0;
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;
        setPasswordStrength(score);
    }, [password]);

    const handleEmailChange = (val: string) => {
        setEmail(val);
        if (val.includes('@')) {
            const [prefix, domainPart] = val.split('@');
            if (prefix) {
                const matches = POPULAR_DOMAINS.filter(d => d.startsWith(domainPart)).map(d => `${prefix}@${d}`);
                setEmailSuggestions(matches);
                setShowEmailSuggestions(matches.length > 0);
            } else {
                setShowEmailSuggestions(false);
            }
        } else {
            setShowEmailSuggestions(false);
        }
    };

    const handleInitialRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordStrength < 2) {
            setError(l('პაროლი ძალიან სუსტია', 'Пароль слишком слабый', 'Password is too weak'));
            return;
        }
        if (!agreed) {
            setError(l('გთხოვთ დაეთანხმოთ წესებს და პირობებს', 'Пожалуйста, примите условия', 'Please agree to Terms & Conditions'));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { createClient } = await import('@/lib/supabase/client');
            const supabase = createClient();

            let studioSlug = compactSlugify(studioName);
            const { data: cloudList } = await supabase.from('studio_settings').select('studio_slug, staff_emails');
            if (cloudList) {
                const existingSlugs = cloudList.map(s => s.studio_slug as string);
                let counter = 1;
                while (existingSlugs.includes(studioSlug)) {
                    const match = cloudList.find(s => s.studio_slug === studioSlug);
                    const emails = (match?.staff_emails || []) as string[];
                    if (emails.includes(email.toLowerCase().trim())) break;

                    studioSlug = `${compactSlugify(studioName)}${counter++}`;
                }
            }

            const orgId = crypto.randomUUID();
            if (typeof window !== 'undefined') {
                Object.keys(localStorage).forEach(k => { if (k.startsWith('cc_')) localStorage.removeItem(k); });
            }

            const { data, error: signUpError } = await supabase.auth.signUp({
                email, password, options: { 
                    emailRedirectTo: `${window.location.origin}/auth/confirm`,
                    data: { role: 'owner', first_name: firstName, last_name: lastName, org_id: orgId, studio_slug: studioSlug }
                }
            });

            if (signUpError && !signUpError.message.includes('already registered')) {
                throw signUpError;
            }

            const fullPhone = `${country.dial}${phone}`;
            
            if (typeof window !== 'undefined') {
                localStorage.setItem('cc_active_studio_slug', studioSlug);
                localStorage.setItem(`cc_active_branch_${studioSlug}`, 'main');
                const key = `cc_studio_settings_${studioSlug}`;
                const basicSettings = {
                    orgId, studioName, studioSlug, language: 'ka', currency: 'GEL',
                    branches: [{ id: 'main', name: 'მთავარი ფილიალი', is_active: true }],
                    owner_info: { first_name: firstName, last_name: lastName, email, phone: fullPhone },
                    staff: [{
                        id: data?.user?.id || crypto.randomUUID(), org_id: orgId, firstName, lastName,
                        role: 'owner', status: 'active', permissions: { admin: true }, created_at: new Date().toISOString()
                    }]
                };
                localStorage.setItem(key, JSON.stringify(basicSettings));
                await pushStudioStateToCloud(studioSlug, basicSettings.staff as any, basicSettings, 0, orgId);
                localStorage.setItem('cc_force_initial_sync', 'true');
            }

            setRegData({ email, studioSlug });
            setStep('success');
        } catch (err: any) {
            setError(err.message || 'Error occurred');
        } finally {
            setLoading(false);
        }
    };

    const getStrengthColor = () => {
        if (passwordStrength <= 1) return 'bg-red-500';
        if (passwordStrength === 2) return 'bg-orange-400';
        if (passwordStrength === 3) return 'bg-yellow-400';
        return 'bg-emerald-500';
    };

    const getStrengthText = () => {
        if (passwordStrength <= 1) return l('სუსტი', 'Слабый', 'Weak');
        if (passwordStrength === 2) return l('საშუალო', 'Средний', 'Fair');
        if (passwordStrength === 3) return l('კარგი', 'Хороший', 'Good');
        return l('ძლიერი', 'Сильный', 'Strong');
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
            <div className="fixed top-0 right-0 w-[50%] h-full bg-indigo-500/5 blur-[120px] -z-10" />
            <div className="fixed bottom-0 left-0 w-[30%] h-1/2 bg-violet-500/5 blur-[100px] -z-10" />
            
            {loading && (
                <div className="fixed inset-0 bg-white/95 backdrop-blur-md z-[9999] flex flex-col items-center justify-center gap-8 transition-all duration-700 animate-in fade-in">
                    <Logo size={120} animated loading />
                    <div className="text-center space-y-2">
                        <p className="font-black uppercase text-sm tracking-[0.4em] text-slate-900 animate-pulse">Creating Studio Cosmos</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">Synchronizing Mission Control</p>
                    </div>
                </div>
            )}

            <div className="w-full max-w-[480px] lg:max-w-[1000px] space-y-10 py-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <div className="flex flex-col items-center gap-8 mb-4">
                    <Link href="/" className="group transition-all duration-500 hover:scale-110 active:scale-95">
                        <Logo size={96} transparent />
                    </Link>
                </div>

                <div className="bg-white p-10 sm:p-14 lg:p-16 rounded-[3rem] border border-slate-100 shadow-2xl shadow-indigo-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
                    
                    {step === 'account' && (
                        <div className="relative">
                            <div className="text-center space-y-3 mb-12">
                                <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight uppercase">{l('რეგისტრაცია', 'Регистрация', 'Fast Registration')}</h2>
                                <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest leading-none flex items-center justify-center gap-2 opacity-80">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Launch your Studio in 60s
                                </p>
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-100/50 p-5 rounded-2xl flex items-start gap-4 animate-shake mb-8">
                                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                                    <p className="text-[11px] text-red-600 font-bold leading-tight uppercase">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleInitialRegister} className="grid grid-cols-1 lg:grid-cols-2 lg:gap-16 lg:items-start">
                                {/* Left Column: Profile & Studio (User Preferred Position) */}
                                <div className="space-y-8 order-1 lg:order-1">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 opacity-70">
                                                <User className="w-3 h-3" />
                                                {l('სახელი', 'Имя', 'First Name')}
                                            </label>
                                            <input 
                                                value={firstName} onChange={e => setFirstName(e.target.value)}
                                                required 
                                                className="w-full h-10 bg-slate-50/50 border border-slate-100 rounded-xl px-4 text-sm font-black text-slate-900 focus:ring-0 focus:border-indigo-500/30 transition-all outline-none placeholder:text-slate-300 shadow-xs" 
                                                placeholder="John"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 opacity-70">
                                                <UserSquare2 className="w-3 h-3" />
                                                {l('გვარი', 'Фамилия', 'Last Name')}
                                            </label>
                                            <input 
                                                value={lastName} onChange={e => setLastName(e.target.value)}
                                                required 
                                                className="w-full h-10 bg-slate-50/50 border border-slate-100 rounded-xl px-4 text-sm font-black text-slate-900 focus:ring-0 focus:border-indigo-500/30 transition-all outline-none placeholder:text-slate-300 shadow-xs"
                                                placeholder="Doe"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 opacity-70">
                                            <Building2 className="w-3 h-3" />
                                            {l('სტუდიის სახელი', 'Студия', 'Studio Name')}
                                        </label>
                                        <input 
                                            value={studioName} onChange={e => setStudioName(e.target.value)}
                                            required 
                                            className="w-full h-10 bg-slate-50/50 border border-slate-100 rounded-xl px-4 text-sm font-black text-slate-900 focus:ring-0 focus:border-indigo-500/30 transition-all outline-none placeholder:text-slate-300 shadow-xs"
                                            placeholder="Gravity Dance Studio"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 opacity-70">
                                            <PhoneIcon className="w-3 h-3" />
                                            {l('ტელეფონი', 'Телефон', 'Phone')}
                                        </label>
                                        <div className="flex gap-3">
                                            <div className="relative group/country">
                                                <select 
                                                    value={country.code} 
                                                    onChange={(e) => setCountry(COUNTRIES.find(c => c.code === e.target.value)!)}
                                                    className="h-10 w-[90px] bg-slate-50/50 border border-slate-100 rounded-xl pl-3 pr-1 text-xs font-black text-slate-900 appearance-none outline-none focus:border-indigo-500/30 transition-all cursor-pointer shadow-xs"
                                                >
                                                    {COUNTRIES.map(c => (
                                                        <option key={c.code} value={c.code}>{c.flag} {c.dial}</option>
                                                    ))}
                                                </select>
                                                <Globe className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300" />
                                            </div>
                                            <input 
                                                value={phone} onChange={e => setPhone(e.target.value)}
                                                required 
                                                type="tel"
                                                className="flex-1 h-10 bg-slate-50/50 border border-slate-100 rounded-xl px-4 text-sm font-black text-slate-900 focus:ring-0 focus:border-indigo-500/30 transition-all outline-none placeholder:text-slate-300 shadow-xs"
                                                placeholder="555..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Security & Auth */}
                                <div className="space-y-8 order-2 lg:order-2 mt-8 lg:mt-0">
                                    <div className="space-y-2 relative">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 opacity-70">
                                            <Mail className="w-3 h-3" />
                                            {l('ფოსტა', 'Почта', 'Email')}
                                        </label>
                                        <input 
                                            value={email} onChange={e => handleEmailChange(e.target.value)}
                                            name="email" type="email" required 
                                            className="w-full h-10 bg-slate-50/50 border border-slate-100 rounded-xl px-4 text-sm font-black text-slate-900 focus:ring-0 focus:border-indigo-500/30 transition-all outline-none placeholder:text-slate-300 shadow-xs"
                                            placeholder="your@email.com"
                                        />
                                        {showEmailSuggestions && (
                                            <div className="absolute top-12 left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 border-2 border-indigo-50">
                                                {emailSuggestions.map((s, i) => (
                                                    <button 
                                                        key={i} type="button" 
                                                        onClick={() => { setEmail(s); setShowEmailSuggestions(false); }}
                                                        className="w-full px-6 py-3.5 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-none"
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2 opacity-70">
                                            <Lock className="w-3 h-3" />
                                            {l('პაროლი', 'Пароль', 'Security Key')}
                                        </label>
                                        <input 
                                            value={password} onChange={e => setPassword(e.target.value)}
                                            type="password" required 
                                            className="w-full h-10 bg-slate-50/50 border border-slate-100 rounded-xl px-4 text-sm font-black text-slate-900 focus:ring-0 focus:border-indigo-500/30 transition-all outline-none placeholder:text-slate-300 shadow-xs"
                                            placeholder="••••••••"
                                        />
                                        {password.length > 0 && (
                                            <div className="px-2 pt-2 space-y-2.5">
                                                <div className="flex gap-2 h-1.5">
                                                    {[1, 2, 3, 4].map((i) => (
                                                        <div 
                                                            key={i} 
                                                            className={cn(
                                                                "flex-1 rounded-full transition-all duration-500",
                                                                i <= passwordStrength ? getStrengthColor() : "bg-slate-100"
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <p className={cn("text-[10px] font-black uppercase tracking-widest", passwordStrength <= 1 ? "text-red-500" : "text-slate-400")}>
                                                        {getStrengthText()}
                                                    </p>
                                                    <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">{l('მინ. 8 სიმბოლო', 'Мин. 8 символов', 'Min. 8 chars')}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-4 pb-2">
                                        <label className="flex items-center gap-4 cursor-pointer group">
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
                                                {l('ვეთანხმები', 'Я согласен с', 'I agree to')} <span className="text-indigo-600 hover:text-indigo-700 underline decoration-indigo-200 underline-offset-4">{l('წესებსა და კონფიდენციალობას', 'Правилами и Кабиเนტომ', 'Privacy & Terms')}</span>
                                            </p>
                                        </label>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={loading || passwordStrength < 2 || !agreed}
                                        className={cn(
                                            "w-full h-12 rounded-2xl font-black uppercase tracking-[0.2em] text-sm transition-all duration-300 flex items-center justify-center gap-3 mt-8 relative overflow-hidden group",
                                            loading || passwordStrength < 2 || !agreed 
                                                ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                                                : "bg-slate-900 text-white shadow-2xl shadow-indigo-500/20 active:scale-[0.98] hover:bg-slate-800"
                                        )}
                                    >
                                        {l('რეგისტრაცია', 'Регистрация', 'Activate Account')}
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                                    </button>

                                    <p className="text-center lg:text-left text-sm font-black text-slate-400 tracking-tight mt-10">
                                        {l('უკვე გაქვთ ანგარიში?', 'Уже есть аккаунт?', 'Already a Cosmos pilot?')} <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-black decoration-indigo-200 hover:underline underline-offset-4">{l('შესვლა', 'Войти', 'Login')}</Link>
                                    </p>
                                </div>
                            </form>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="text-center py-10 animate-in fade-in zoom-in duration-700">
                            <div className="flex flex-col items-center gap-8 mb-12">
                                <Link href="/" className="group transition-all duration-500 hover:scale-110 active:scale-95">
                                    <Logo size={96} transparent />
                                </Link>
                            </div>
                            
                            <div className="space-y-6">
                                <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none uppercase">{l('წარმატება!', 'Успех!', 'Welcome!')}</h2>
                                <div className="space-y-3 py-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{l('ანგარიში შეიქმნა', 'Аккаунт создан', 'Mission Control Ready')}</p>
                                    <p className="text-base font-black text-indigo-600 bg-indigo-50/50 py-3 inline-block px-8 rounded-full border border-indigo-100/50 shadow-sm">
                                        {regData.email}
                                    </p>
                                </div>
                                <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100/50 space-y-4 shadow-sm">
                                    <div className="flex items-center justify-center gap-3 text-indigo-500">
                                        <MailSearch className="w-6 h-6" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">{l('შეამოწმეთ ფოსტა', 'Проверьте почту', 'Verification Required')}</p>
                                    </div>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                                        {l('გთხოვთ დაადასტუროთ თქვენი ელ-ფოსტა სისტემაში შესვლამდე', 'Пожалуйста, подтвердите вашу почту перед входом', 'A portal link has been sent to your primary frequency. Confirm to activate.')}
                                    </p>
                                </div>
                                
                                <Link href="/login" className="w-full h-12 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-sm shadow-xl shadow-slate-900/10 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-8 hover:bg-slate-800">
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

function PhoneIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}
