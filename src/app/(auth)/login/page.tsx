'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Zap, Mail, Lock, ArrowRight, Eye, EyeOff, Github, Chrome } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LoginPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(e.target as HTMLFormElement);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        try {
            const { createClient } = await import('@/lib/supabase/client');
            const supabase = createClient();

            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) throw signInError;

            window.location.href = '/dashboard';
        } catch (err: any) {
            let errorMessage = err.message || 'შესვლისას დაფიქსირდა შეცდომა';

            if (err.message === 'Email not confirmed') {
                errorMessage = 'გთხოვთ დაადასტუროთ თქვენი ელ-ფოსტა სისტემაში შესასვლელად.';
            } else if (err.message === 'Invalid login credentials') {
                errorMessage = 'ელ-ფოსტა ან პაროლი არასწორია.';
            }

            setError(errorMessage);
            setLoading(false);
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
                        <div className="w-14 h-14 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-indigo-600/30 logo-animate-hover logo-large overflow-hidden">
                            <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain logo-white" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">ClassCore</h1>
                    </Link>
                    <p className="text-slate-500 font-medium">სტუდიის მართვის პლატფორმა</p>
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
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">ელ.ფოსტა</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    placeholder="email@studio.ge"
                                    className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-900 placeholder:text-slate-300 outline-none transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between pl-1 pr-1">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">პაროლი</label>
                                <button type="button" className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700">დაგავიწყდათ?</button>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                <input
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder="••••••••"
                                    className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-12 pr-12 py-4 text-sm font-bold text-slate-900 placeholder:text-slate-300 outline-none transition-all shadow-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-5 bg-slate-900 border border-slate-800 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>შესვლა <ArrowRight className="w-5 h-5" /></>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-slate-100 space-y-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100" /></div>
                            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest"><span className="bg-white/50 px-4 text-slate-400">ან სხვა მეთოდით</span></div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 transition-all font-bold text-sm text-slate-600">
                                <Chrome className="w-4 h-4 text-[#4285F4]" /> Google
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
                    არ გაქვთ ანგარიში? <Link href="/register" className="text-indigo-600 font-black hover:underline underline-offset-4 decoration-2">დარეგისტრირდით</Link>
                </p>
            </div>
        </div>
    );
}
