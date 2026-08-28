'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Mail, Lock, ArrowRight, Loader2, Sparkles, Shield, Globe } from 'lucide-react';
import { AppLogo } from '@/components/ui/Logo';
import { useT } from '@/contexts/LanguageContext';
import { useUser } from '@/hooks/useUser';
import { cn } from '@/lib/utils';
import { isSuperAdminEmail } from '@/lib/superadmin-emails';

export default function LoginPage() {
    const { t, lang } = useT();
    const { user, profile, loading } = useUser();
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isActivated, setIsActivated] = useState(false);
    const [loginStatus, setLoginStatus] = useState<string | null>(null);
    const [multipleStudios, setMultipleStudios] = useState<any[] | null>(null);

    const l = (ge: string, ru: string, en: string) => lang === 'ka' ? ge : lang === 'ru' ? ru : en;

    useEffect(() => {
        const url = new URL(window.location.href);
        const status = url.searchParams.get('status');
        const errorParam = url.searchParams.get('error');

        if (status === 'activated') {
            setIsActivated(true);
        } else if (errorParam === 'activation_failed') {
            setError(l('აქტივაცია ვერ მოხერხდა.', 'Ошибка активации.', 'Activation failed. Please contact support.'));
        }

        if (user && !loading) {
            if (profile?.is_activated === false) {
                (async () => {
                    const { createClient } = await import('@/lib/supabase/client');
                    const supabase = createClient();
                    await supabase.auth.signOut();
                    setError(l('თქვენი ექაუნთი ჯერ არ არის გააქტიურებული.', 'Ваш аккаунт еще не активирован.', 'Account not activated.'));
                })();
                return;
            }
            window.location.href = '/dashboard';
        }
    }, [user, loading, lang, profile]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const formData = new FormData(e.target as HTMLFormElement);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('TIMEOUT')), 60000)
        );

        try {
            const loginTask = (async () => {
                setLoginStatus(l('კავშირის დამყარება...', 'Установка соединения...', 'Establishing connection...'));
                const { createClient } = await import('@/lib/supabase/client');
                const supabase = createClient();
                const { setStaffSession, validateStaffLogin } = await import('@/lib/settings-store');
                setStaffSession(null);

                const isEmail = email.includes('@');
                let signedInUser = null;

                if (isEmail) {
                    setLoginStatus(l('ავტორიზაცია...', 'Вход...', 'Authenticating...'));
                    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                    
                    // We ALWAYS check staff login to find all studios they belong to (Studio Switcher logic)
                    setLoginStatus(l('სტუდიების შემოწმება...', 'Проверка студий...', 'Checking studios...'));
                    const staffResult = await validateStaffLogin(email, password);
                    
                    if (staffResult && !('error' in staffResult)) {
                        if (staffResult.type === 'single') {
                            setStaffSession({ staff: staffResult.staff, slug: staffResult.slug });
                            setIsSuccess(true);
                            setTimeout(() => { window.location.href = `/${staffResult.slug}/dashboard`; }, 1500);
                            return;
                        } else if (staffResult.type === 'multiple') {
                            setMultipleStudios(staffResult.studios);
                            setIsSubmitting(false); // Stop loading to show switcher
                            return;
                        }
                    }

                    if (error) {
                        // If supabase failed and no valid staff result was found, throw
                        if (!staffResult || 'error' in staffResult) {
                            throw error;
                        }
                    } else {
                        signedInUser = data.user;
                    }
                }

                if (!signedInUser) throw new Error('USER_NOT_FOUND');

                setLoginStatus(l('შესვლა...', 'Вход...', 'Logging in...'));
                setIsSuccess(true);
                const isSuperAdmin = isSuperAdminEmail(signedInUser?.email);
                
                if (signedInUser && !signedInUser.email_confirmed_at && !isSuperAdmin) {
                    await supabase.auth.signOut();
                    setError(l('გთხოვთ დაადასტუროთ თქვენი ელ-ფოსტა ავტორიზაციამდე.', 'Пожалуйста, подтвердите ваш email перед входом.', 'Please confirm your email before logging in.'));
                    setIsSubmitting(false);
                    setIsSuccess(false);
                    return;
                }

                setTimeout(() => {
                    // Default fallback if somehow staffResult didn't trigger
                    window.location.href = isSuperAdmin ? '/superadmin' : '/dashboard';
                }, 2000);
            })();

            await Promise.race([loginTask, timeoutPromise]);
            
        } catch (err: any) {
            console.error('Login error:', err);
            const isTimeout = err.message === 'TIMEOUT' || err.message === 'QUERY_TIMEOUT';
            const rawError = err.message || err.error_description || JSON.stringify(err);

            if (isTimeout) {
                setError(l('კავშირის დრო ამოიწურა. გთხოვთ შეამოწმოთ ინტერნეტი და სცადოთ თავიდან.', 'Время ожидания истекло.', 'Connection timeout.'));
            } else if (err.message === 'USER_NOT_FOUND' || err.message === 'Invalid login credentials' || err.message === 'არასწორი პაროლი') {
                setError(l('მომხმარებელი ვერ მოიძებნა.', 'Пользователь не найден.', 'User not found.'));
            } else {
                setError(`${l('შეცდომა:', 'Ошибка:', 'Error:')} ${rawError}`);
            }
            setIsSubmitting(false);
            setIsSuccess(false);
        }
    };

    // Attempt to get logo from local storage if the user has logged in before
    const getCachedLogo = () => {
        if (typeof window === 'undefined') return null;
        try {
            const settings = JSON.parse(localStorage.getItem('cc_studio_settings') || '{}');
            return settings.logoDataUrl;
        } catch { return null; }
    };

    const handleStudioSelect = async (studio: any) => {
        setIsSubmitting(true);
        setMultipleStudios(null); // Hide switcher
        setLoginStatus(l('სესია მზადდება...', 'Подготовка сессии...', 'Preparing session...'));
        
        try {
            const { setStaffSession } = await import('@/lib/settings-store');
            setStaffSession({ staff: studio.staff, slug: studio.slug });
            setIsSuccess(true);
            setTimeout(() => {
                window.location.href = `/${studio.slug}/dashboard`;
            }, 1500);
        } catch (err) {
            console.error(err);
            setError(l('შეცდომა სესიის შექმნისას.', 'Ошибка.', 'Error.'));
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden">
            <div className="fixed top-0 right-0 w-[50%] h-full bg-indigo-500/5 blur-[120px] -z-10" />
            <div className="fixed bottom-0 left-0 w-[30%] h-1/2 bg-violet-500/5 blur-[100px] -z-10" />
            
            <div className="w-full max-w-[440px] flex flex-col pt-0 pb-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="flex flex-col items-center gap-6 mb-4">
                    <Link href="/" className="group transition-all duration-500 hover:scale-110 active:scale-95">
                        <AppLogo size={100} transparent className="rounded-full" />
                    </Link>
                </div>

                <div className="bg-white p-8 sm:p-10 rounded-[3rem] border border-slate-100 shadow-2xl shadow-indigo-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>

                    {isActivated ? (
                        <div className="space-y-8 animate-in zoom-in-95 duration-500">
                             <div className="flex flex-col items-center gap-6">
                                <div className="w-20 h-20 rounded-[2rem] bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-xl shadow-emerald-500/10 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-emerald-500/5 animate-pulse" />
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 text-emerald-500 relative z-10 transition-transform group-hover:scale-110"><path d="M20 6 9 17l-5-5"/></svg>
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight leading-tight">
                                        {l('თქვენი პროფილი გააქტიურებულია!', 'Профиль успешно активирован!', 'Profile Successfully Activated!')}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-100 relative group overflow-hidden text-center">
                                <p className="text-[11px] text-slate-500 font-bold leading-relaxed uppercase tracking-wide">
                                    {l('თქვენი კოსმოსური სადგური მზად არის სამუშაოდ.', 'Ваша станция готова к работе.', 'Your command station is fully operational.')}
                                </p>
                            </div>

                            <button 
                                onClick={() => setIsActivated(false)}
                                className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-slate-900/10 active:scale-[0.98] transition-all hover:bg-slate-800 flex items-center justify-center gap-4 group"
                            >
                                {l('ავტორიზაციაზე გადასვლა', 'Перейти к логину', 'Proceed to Portal')}
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    ) : multipleStudios ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center space-y-2 mb-6">
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                                    {l('აირჩიეთ სტუდია', 'Выберите студию', 'Select Studio')}
                                </h3>
                                <p className="text-xs text-slate-500 font-medium">
                                    {l('თქვენს ანგარიშზე ნაპოვნია რამდენიმე სტუდია', 'Найдено несколько студий', 'Multiple studios found')}
                                </p>
                            </div>
                            
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 pb-2 scrollbar-thin scrollbar-thumb-slate-200">
                                {multipleStudios.map((studio, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleStudioSelect(studio)}
                                        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 hover:bg-indigo-50/30 transition-all text-left group"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden border border-slate-100">
                                            {studio.logoUrl ? (
                                                <img src={studio.logoUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-lg font-black text-slate-300 uppercase">{studio.name.substring(0,2)}</div>
                                            )}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <h4 className="text-sm font-black text-slate-900 truncate">{studio.name}</h4>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">/{studio.slug}</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="text-center space-y-3 mb-8 relative">
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter leading-none uppercase">{l('ავტორიზაცია', 'Вход', 'Access Portal')}</h2>
                                <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest leading-none flex items-center justify-center gap-3 opacity-90">
                                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                                    {l('სტუდიის მართვის სისტემა', 'Система управления', 'Studio Management OS')}
                                </p>
                            </div>

                            {error && (
                                <div className="mb-8 p-5 bg-red-50 border border-red-100/50 rounded-2xl flex items-start gap-4">
                                    <p className="text-[11px] text-red-600 font-bold leading-tight uppercase text-center w-full">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleLogin} className="space-y-6 relative">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500/80 uppercase tracking-widest ml-1 flex items-center gap-3 opacity-90">
                                        <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
                                            <Mail className="w-3.5 h-3.5" />
                                        </div>
                                        {l('ფოსტა', 'Почта', 'Identity (Email)')}
                                    </label>
                                    <input
                                        name="email"
                                        type="text"
                                        required
                                        placeholder="your@email.com"
                                        className="w-full h-11 bg-slate-50/50 border border-slate-100 rounded-2xl px-5 text-sm font-black text-slate-900 focus:ring-0 focus:border-indigo-500/30 transition-all outline-none placeholder:text-slate-300 shadow-xs"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between pl-1">
                                        <label className="text-[10px] font-black text-slate-500/80 uppercase tracking-widest flex items-center gap-3 opacity-90">
                                            <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
                                                <Lock className="w-3.5 h-3.5" />
                                            </div>
                                            {l('პაროლი', 'Пароль', 'Security Key')}
                                        </label>
                                        <Link href="/forgot-password" className="text-[11px] font-black text-indigo-600 px-1 hover:underline">
                                            {l('დაგავიწყდათ?', 'Забыли?', 'Recovery')}
                                        </Link>
                                    </div>
                                    <div className="relative group">
                                        <input
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            required
                                            placeholder="••••••••"
                                            className="w-full h-11 bg-slate-50/50 border border-slate-100 rounded-2xl px-5 text-sm font-black text-slate-900 focus:ring-0 focus:border-indigo-500/30 transition-all outline-none placeholder:text-slate-300 shadow-xs"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center space-y-6 pt-4 border-t border-slate-50 mt-6">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full h-12 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isSubmitting ? (
                                            <div className="flex items-center gap-3">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                {loginStatus && (
                                                    <span className="text-[9px] font-black uppercase tracking-widest animate-pulse">{loginStatus}</span>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                {l('შესვლა', 'Войти', 'Authorization')}
                                                <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>

                <p className="text-center text-sm font-semibold text-slate-500 mt-8">
                    {l('არ გაქვთ ანგარიში?', 'Нет аккаунта?', 'New pilot in HQ?')}{' '}
                    <Link href="/registration" className="text-indigo-600 font-black hover:underline underline-offset-4 decoration-2">
                        {l('რეგისტრაცია', 'Регистрация', 'Activate Signal')}
                    </Link>
                </p>

                <div className="text-center space-y-4 opacity-40 pt-10">
                    <div className="flex items-center justify-center gap-4">
                        <Shield className="w-4 h-4 text-slate-400" />
                        <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
                        <Globe className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 tracking-[0.5em] uppercase leading-none">Clascore.ge</p>
                </div>
            </div>

            {/* UNIFIED LOGIN SUCCESS TRANSITION */}
            {isSuccess && (
                <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center animate-in fade-in duration-500">
                    <div className="relative flex flex-col items-center gap-12 -mt-20">
                        <div className="absolute inset-0 bg-indigo-500/5 blur-[100px] rounded-full scale-150 animate-pulse" />
                        
                        <div className="relative">
                            <AppLogo 
                                size={100} 
                                radar 
                                loading 
                                src={getCachedLogo()}
                                className="relative z-10" 
                            />
                        </div>

                        <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                            <p className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.4em] animate-pulse">
                                {l('მიმდინარეობს ჩატვირთვა...', 'Загрузка...', 'Initiating Systems...')}
                            </p>
                            <div className="w-48 h-0.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-600 animate-[loading-bar_2s_ease-in-out_infinite] shadow-[0_0_15px_rgba(79,70,229,0.3)]" />
                            </div>
                        </div>
                    </div>

                    <style jsx global>{`
                        @keyframes loading-bar {
                            0% { width: 0%; }
                            50% { width: 70%; }
                            100% { width: 100%; }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
}
