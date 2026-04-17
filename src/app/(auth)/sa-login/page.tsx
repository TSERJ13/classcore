'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Mail, Lock, ShieldCheck } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useT } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

const SUPER_ADMIN_EMAILS = [
    'adminclasscore@gmail.com',
    'support@classcore.ge', 
    'admin@classcore.ge',
    'sergi.tsivtsivadze@gmail.com'
];

export default function SALoginPage() {
    const [mounted, setMounted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { user, logout } = useUser();
    const { t } = useT();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        if (user && user.email) {
            const email = user.email.toLowerCase();
            const isAdmin = SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === email);
            if (isAdmin) {
                window.location.href = '/superadmin';
            } else {
                // If they are logged in but not a superadmin, 
                // we show an error but DON'T auto-redirect immediately so they can sign out
                setError(`Logged in as ${user.email}, but you are not a Super Admin.`);
            }
        }
    }, [user]);

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(e.target as HTMLFormElement);
        let email = (formData.get('email') as string).trim().toLowerCase();
        const password = formData.get('password') as string;

        // Domain auto-completion for official emails
        if (email === 'admin' || email === 'support') {
            email = email + '@classcore.ge';
        }

        if (!SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === email)) {
            setError('Access restricted to SuperAdmin personnel only. Connection logged.');
            setLoading(false);
            return;
        }

        try {
            const { createClient } = await import('@/lib/supabase/client');
            const supabase = createClient();

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) throw signInError;

            window.location.href = '/superadmin';
        } catch (err: unknown) {
            const errorObj = err as { message?: string };
            let errorMessage = errorObj.message || t.loginError;

            if (errorObj.message === 'Invalid login credentials') {
                errorMessage = t.invalidCredentials;
            }

            setError(errorMessage);
            setLoading(false);
        }
    };

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Dark/Secure Abstract Backgrounds */}
            <div className="absolute top-0 right-0 w-[40%] h-full bg-red-900/10 blur-[120px] -z-10" />
            <div className="absolute bottom-0 left-0 w-[40%] h-1/2 bg-indigo-900/10 blur-[100px] -z-10" />

            <div className="absolute top-6 right-6 z-50">
                <LanguageSwitcher />
            </div>

            <div className="w-full max-w-[420px] space-y-10 animate-fade-up">
                {/* Header */}
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto shadow-2xl">
                        <ShieldCheck className="w-8 h-8 text-white relative z-10" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">{t.adminLogin}</h1>
                    <p className="text-zinc-500 font-black tracking-[0.2em] text-[10px]">{t.hqLoginSub}</p>
                </div>

                {/* Form Card */}
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-10 rounded-[2.5rem] shadow-2xl">
                    {error && (
                        <div className="mb-6 space-y-4">
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-[11px] font-bold text-red-500 tracking-widest text-center animate-fade-up">
                                {error}
                            </div>
                            {user && (
                                <button 
                                    onClick={() => logout()}
                                    className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-[10px] font-black tracking-widest transition-all"
                                >
                                    Sign Out & Try Another Account
                                </button>
                            )}
                        </div>
                    )}
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-500 tracking-widest pl-1">{t.adminEmail}</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500 group-focus-within:text-white transition-colors" />
                                <input
                                    name="email"
                                    type="text"
                                    required
                                    placeholder="Login"
                                    className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-zinc-600 focus:ring-4 focus:ring-zinc-800/50 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-white placeholder:text-zinc-600 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-500 tracking-widest pl-1">{t.passcode}</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-500 group-focus-within:text-white transition-colors" />
                                <input
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder="Password"
                                    className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-zinc-600 focus:ring-4 focus:ring-zinc-800/50 rounded-2xl pl-12 pr-12 py-4 text-sm font-bold text-white placeholder:text-zinc-600 outline-none transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                                >
                                    {showPassword ? <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.749 9.749 0 0 0 5.39-1.61"></path><line x1="2" x2="22" y1="2" y2="22"></line></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-4 py-5 bg-white text-black hover:bg-zinc-200 border border-transparent rounded-2xl font-black text-sm tracking-widest flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            ) : (
                                t.authenticate
                            )}
                        </button>
                    </form>
                </div>
            </div>
            <div className="absolute bottom-6 text-[10px] font-black tracking-widest text-zinc-600">
                {t.restrictedZone}
            </div>
        </div>
    );
}
