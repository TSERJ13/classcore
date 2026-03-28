'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Lock } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useUser } from '@/hooks/useUser';
import { useEffect } from 'react';

export default function LoginPage() {
    const { t } = useT();
    const { user, loading } = useUser();

    useEffect(() => {
        if (user && !loading) {
            const SUPER_ADMIN_EMAILS = [
                'adminclasscore@gmail.com',
                'support@classcore.ge', 
                'admin@classcore.ge',
                'tserj13@classcore.ge'
            ];
            const isSuperAdmin = user.email ? SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === user.email?.toLowerCase()) : false;
            
            if (isSuperAdmin) {
                window.location.href = '/superadmin';
            } else {
                window.location.href = '/dashboard';
            }
        }
    }, [user, loading]);

    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const setMobileMenuOpen = (_open: boolean) => { };
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const formData = new FormData(e.target as HTMLFormElement);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        try {
            const { createClient } = await import('@/lib/supabase/client');
            const supabase = createClient();

            // Clear any existing staff session first
            const { setStaffSession, validateStaffLogin } = await import('@/lib/settings-store');
            setStaffSession(null);

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) {
                // If Supabase fails, try local staff
                const staffResult = await validateStaffLogin(email, password);

                if (staffResult) {
                    if ('error' in staffResult) {
                        throw new Error(staffResult.error);
                    } else if ('staff' in staffResult) {
                        setStaffSession(staffResult);
                        window.location.href = '/dashboard';
                        return;
                    }
                }

                throw signInError;
            }

            window.location.href = '/dashboard';
        } catch (err: unknown) {
            const errorObj = err as { message?: string };
            let errorMessage = errorObj.message || t.loginError;

            // Map standard Supabase errors to localization if possible
            if (errorObj.message === 'Email not confirmed') {
                errorMessage = t.confirmEmail;
            } else if (errorObj.message === 'Invalid login credentials') {
                errorMessage = t.invalidCredentials;
            }

            setError(errorMessage);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Abstract Backgrounds */}
            <div className="absolute top-0 right-0 w-[50%] h-full bg-indigo-50/50 blur-[120px] -z-10" />
            <div className="absolute bottom-0 left-0 w-[30%] h-1/2 bg-violet-50/50 blur-[100px] -z-10" />

            <div className="w-full max-w-[420px] space-y-10 animate-fade-up">
                {/* Logo */}
                <div className="flex flex-col items-center text-center space-y-4">
                    <Link href="/" className="group flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-indigo-600/30 logo-animate-hover logo-large overflow-hidden">
                            <img src="/logo.svg" alt="Logo" className="w-full h-full object-cover" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">ClassCore</h1>
                    </Link>
                    <p className="text-slate-500 font-medium">{t.platformTitle}</p>
                </div>

                {/* Form Card */}
                <div className="bg-white/50 backdrop-blur-xl border border-slate-100 p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-500/5">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50/50 border border-red-100 rounded-2xl text-[11px] font-bold text-red-500 italic text-center animate-fade-up">
                            {error}
                        </div>
                    )}
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 tracking-widest pl-1">{t.email}</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    placeholder="email@studio.ge"
                                    className="w-full bg-transparent border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between pl-1 pr-1">
                                <label className="text-[11px] font-black text-slate-400 tracking-widest">{t.password}</label>
                                <button type="button" className="text-[10px] font-black text-indigo-600 tracking-widest hover:text-indigo-700">{t.forgotPassword}</button>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                <input
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder="••••••••"
                                    className="w-full bg-transparent border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-12 pr-12 py-4 text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.749 9.749 0 0 0 5.39-1.61"></path><line x1="2" x2="22" y1="2" y2="22"></line></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-5 bg-slate-900 border border-slate-800 text-white rounded-2xl font-black text-sm tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>{t.login} <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-slate-100 space-y-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
                            <div className="relative flex justify-center text-[10px] font-black tracking-widest"><span className="bg-white/50 px-4 text-slate-400">{t.orOtherMethod}</span></div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm text-slate-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#4285F4]"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><path d="M21.17 8H12"></path><path d="M3.95 6.06a9 9 0 0 1 0 11.88"></path><path d="M8.54 21.17a9 9 0 0 1 7.08 0"></path></svg> Google
                            </button>
                            <button className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm text-slate-600">
                                <svg className="w-4 h-4 text-[#0088cc]" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.45-.42-1.39-.89.03-.24.37-.49 1-.74 3.92-1.7 6.54-2.83 7.85-3.37 3.73-1.55 4.51-1.82 5.02-1.83.11 0 .36.03.52.17.13.12.17.28.19.4z" />
                                </svg> Telegram
                            </button>
                        </div>
                    </div>
                </div>

                <p className="text-center text-sm font-semibold text-slate-500">
                    {t.noAccount} <Link href="/registration" className="text-indigo-600 font-black hover:underline underline-offset-4 decoration-2">{t.registerNow}</Link>
                </p>
            </div>
        </div>
    );
}
