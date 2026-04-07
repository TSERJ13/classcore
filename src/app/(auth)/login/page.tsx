'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Mail, Lock, ArrowRight, Loader2, Sparkles, Shield, Globe, Zap } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { useT } from '@/contexts/LanguageContext';
import { useUser } from '@/hooks/useUser';
import { cn } from '@/lib/utils';

export default function LoginPage() {
    const { t, lang } = useT();
    const { user, loading } = useUser();
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const l = (ge: string, ru: string, en: string) => lang === 'ka' ? ge : lang === 'ru' ? ru : en;

    useEffect(() => {
        const url = new URL(window.location.href);
        const status = url.searchParams.get('status');
        const errorParam = url.searchParams.get('error');

        if (status === 'activated') {
            setError(l('ანგარიში წარმატებით გააქტიურდა!', 'Аккаунт успешно активирован!', 'Account successfully activated!'));
        } else if (errorParam === 'activation_failed') {
            setError(l('აქტივაცია ვერ მოხერხდა.', 'Ошибка активации.', 'Activation failed. Please contact support.'));
        }

        if (user && !loading) {
            if (user.user_metadata?.is_activated === false) {
                const { createClient } = require('@/lib/supabase/client');
                const supabase = createClient();
                supabase.auth.signOut().then(() => {
                    setError(l('თქვენი ექაუნთი ჯერ არ არის გააქტიურებული.', 'Ваш аккаунт еще არი გააქტიურებული.', 'Account not activated.'));
                });
                return;
            }

            const SUPER_ADMIN_EMAILS = ['adminclasscore@gmail.com', 'support@classcore.ge', 'admin@classcore.ge', 'tserj13@classcore.ge'];
            const isSuperAdmin = user.email ? SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === user.email?.toLowerCase()) : false;
            
            if (isSuperAdmin) {
                window.location.href = '/superadmin';
            } else {
                window.location.href = '/dashboard';
            }
        }
    }, [user, loading, lang]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const formData = new FormData(e.target as HTMLFormElement);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('TIMEOUT')), 20000)
        );

        try {
            const loginTask = (async () => {
                const { createClient } = await import('@/lib/supabase/client');
                const supabase = createClient();
                const { setStaffSession, validateStaffLogin } = await import('@/lib/settings-store');
                setStaffSession(null);

                const isEmail = email.includes('@');
                let signedInUser = null;
                let signInError = null;

                if (isEmail) {
                    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                    signedInUser = data.user;
                    signInError = error;
                }

                if (!signedInUser) {
                    const staffResult = await validateStaffLogin(email, password);
                    if (staffResult) {
                        if ('error' in staffResult) throw new Error(staffResult.error);
                        if ('staff' in staffResult) {
                            setStaffSession(staffResult);
                            setIsSuccess(true);
                            setTimeout(() => { window.location.href = '/dashboard'; }, 2000);
                            return;
                        }
                    }
                    if (signInError) throw signInError;
                    throw new Error('USER_NOT_FOUND');
                }

                if (signedInUser?.user_metadata?.is_activated === false) {
                    await supabase.auth.signOut();
                    setError(l('თქვენი ექაუნთი ჯერ არ არის გააქტიურებული.', 'Ваш аккаунт еще არი გააქტიურებული.', 'Account not activated.'));
                    setIsSubmitting(false);
                    return;
                }

                const SUPER_ADMIN_EMAILS = ['adminclasscore@gmail.com', 'support@classcore.ge', 'admin@classcore.ge', 'tserj13@classcore.ge'];
                const isSuperAdmin = email && SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === email.toLowerCase());

                setIsSuccess(true);
                setTimeout(() => {
                    window.location.href = isSuperAdmin ? '/superadmin' : '/dashboard';
                }, 2000);
            })();

            await Promise.race([loginTask, timeoutPromise]);
            
        } catch (err: any) {
            console.error('Login error:', err);
            const isTimeout = err.message === 'TIMEOUT' || err.message === 'QUERY_TIMEOUT';

            if (isTimeout) {
                setError(l('კავშირის დრო ამოიწურა. გთხოვთ შეამოწმოთ ინტერნეტი და სცადოთ თავიდან.', 'Время ожидания истекло. Проверьте интернет и попробуйте снова.', 'Connection timeout. Please check your internet and retry.'));
            } else if (err.message === 'USER_NOT_FOUND' || err.message === 'Invalid login credentials' || err.message === 'არასწორი პაროლი' || err.message?.includes('მომხმარებელი ვერ მოიძებნა')) {
                setError(l('მომხმარებელი ვერ მოიძებნა. გთხოვთ გაიაროთ რეგისტრაცია.', 'Пользователь не найден. Зарегистрируйтесь.', 'User not found. Please register.'));
            } else if (err.message === 'Email not confirmed') {
                setError(t.confirmEmail);
            } else if (err.message?.includes('Failed to fetch') || err.message?.includes('network')) {
                setError(l('ინტერნეტის შეცდომა. გთხოვთ შეამოწმოთ კავშირი.', 'Ошибка сети. Проверьте соединение.', 'Network error. Please check your connection.'));
            } else {
                setError(err.message || t.loginError);
            }
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden relative">
            <div className="fixed top-0 right-0 w-[50%] h-full bg-indigo-500/5 blur-[120px] -z-10" />
            <div className="fixed bottom-0 left-0 w-[30%] h-1/2 bg-violet-500/5 blur-[100px] -z-10" />
            
            <div className="w-full max-w-[440px] flex flex-col pt-0 pb-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="flex flex-col items-center gap-6 mb-4">
                    <Link href="/" className="group transition-all duration-500 hover:scale-110 active:scale-95">
                        <Logo size={110} transparent />
                    </Link>
                </div>

                <div className="bg-white p-8 sm:p-10 rounded-[3rem] border border-slate-100 shadow-2xl shadow-indigo-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
                    
                    <div className="text-center space-y-3 mb-10 relative">
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none uppercase">{l('ავტორიზაცია', 'Вход', 'Access Portal')}</h2>
                        <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest leading-none flex items-center justify-center gap-3 opacity-90">
                            <Sparkles className="w-4 h-4 animate-pulse" />
                            {l('სტუდიის მართვის სისტემა', 'Система управления', 'Studio Management OS')}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-8 p-5 bg-red-50 border border-red-100/50 rounded-2xl flex items-start gap-4 animate-shake">
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
                                placeholder={l('შეიყვანეთ იმეილი...', 'Введите почту...', 'your@frequency.com')}
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
                                <Link href="/forgot-password" className="text-[11px] font-black text-indigo-600 px-1 tracking-tighter hover:text-indigo-700 transition-colors uppercase decoration-indigo-200 hover:underline">
                                    {l('დაგავიწყდათ?', 'Забыли?', 'Recovery')}
                                </Link>
                            </div>
                            <div className="relative group">
                                <input
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder={l('შეიყვანეთ პაროლი...', 'Введите პაროლი...', '••••••••')}
                                    className="w-full h-11 bg-slate-50/50 border border-slate-100 rounded-2xl px-5 text-sm font-black text-slate-900 focus:ring-0 focus:border-indigo-500/30 transition-all outline-none placeholder:text-slate-300 shadow-xs"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.749 9.749 0 0 0 5.39-1.61"></path><line x1="22" x2="2" y1="2" y2="22"></line></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col items-center space-y-6 pt-4 border-t border-slate-50 mt-6">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-slate-900/10 active:scale-[0.98] transition-all hover:bg-slate-800 flex items-center justify-center gap-2 relative overflow-hidden group disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        {l('შესვლა', 'Войти', 'Authorization')}
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
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
                    <p className="text-[10px] font-black text-slate-400 tracking-[0.5em] uppercase leading-none">ClassCore COSMOS OS</p>
                </div>
            </div>

            {/* CREATIVE LOGIN SUCCESS TRANSITION */}
            {isSuccess && (
                <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center animate-in fade-in duration-500">
                    <div className="relative flex flex-col items-center gap-12">
                        <div className="absolute inset-0 bg-indigo-500/10 blur-[100px] rounded-full scale-150 animate-pulse" />
                        
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500/20 blur-[40px] animate-ping rounded-full scale-75" />
                            <Logo size={120} animated loading className="relative z-10" />
                        </div>

                        <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                            <p className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] animate-pulse">
                                {l('მიმდინარეობს ავტორიზაცია...', 'Авторизация...', 'Authenticating Pulse...')}
                            </p>
                            <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                <div className="h-full bg-indigo-600 animate-[loading-bar_2s_ease-in-out_forwards] shadow-[0_0_15px_rgba(79,70,229,0.5)]" />
                            </div>
                        </div>
                    </div>

                    <style jsx global>{`
                        @keyframes loading-bar {
                            0% { width: 0%; }
                            20% { width: 10%; }
                            60% { width: 45%; }
                            100% { width: 100%; }
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
}
