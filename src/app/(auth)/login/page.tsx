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
                </div>

                <p className="text-center text-sm font-semibold text-slate-500">
                    {t.noAccount} <Link href="/registration" className="text-indigo-600 font-black hover:underline underline-offset-4 decoration-2">{t.registerNow}</Link>
                </p>
            </div>
        </div>
    );
}
