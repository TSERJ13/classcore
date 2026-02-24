'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Zap, Mail, Lock, User, ArrowRight, ShieldCheck, Github, Chrome, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function RegisterPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(e.target as HTMLFormElement);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;
        const firstName = formData.get('firstName') as string;
        const lastName = formData.get('lastName') as string;
        const studioName = formData.get('studioName') as string;

        try {
            const { createClient } = await import('@/lib/supabase/client');
            const supabase = createClient();

            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/confirm`,
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        studio_name: studioName,
                    }
                }
            });

            if (signUpError) throw signUpError;

            if (data.user && !data.session) {
                setSuccess(true);
                setLoading(false);
            } else {
                window.location.href = '/dashboard';
            }
        } catch (err: any) {
            setError(err.message || 'რეგისტრაციისას დაფიქსირდა შეცდომა');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Abstract Backgrounds */}
            <div className="absolute top-0 left-0 w-[50%] h-full bg-indigo-50/50 blur-[120px] -z-10" />
            <div className="absolute bottom-0 right-0 w-[30%] h-1/2 bg-violet-50/50 blur-[100px] -z-10" />

            <div className="w-full max-w-[480px] space-y-8 animate-fade-up">
                {/* Logo */}
                <div className="flex flex-col items-center text-center space-y-4">
                    <Link href="/" className="group flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-600/30 logo-animate-hover logo-large overflow-hidden">
                            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain logo-white" />
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">ClassCore</h1>
                    </Link>
                    <div className="space-y-1">
                        <h2 className="text-xl font-black text-slate-800">შექმენი შენი სტუდია</h2>
                        <p className="text-sm text-slate-500 font-medium">დაიწყე 14 დღიანი უფასო საცდელი პერიოდით</p>
                    </div>
                </div>

                {/* Form Card */}
                <div className="bg-white/50 backdrop-blur-xl border border-slate-100 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-500/5">
                    {success ? (
                        <div className="text-center space-y-6 py-4 animate-fade-up">
                            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Mail className="w-10 h-10 text-emerald-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-slate-900">შეამოწმეთ ელ-ფოსტა</h3>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed px-4">
                                    რეგისტრაცია თითქმის დასრულებულია. გთხოვთ დაადასტუროთ თქვენი მეილი გამოგზავნილი ბმულით.
                                </p>
                            </div>
                            <button
                                onClick={() => window.location.href = '/login'}
                                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                            >
                                ავტორიზაციის გვერდი
                            </button>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <div className="mb-6 p-4 bg-red-50/50 border border-red-100 rounded-2xl text-[11px] font-bold text-red-500 italic text-center animate-fade-up">
                                    {error}
                                </div>
                            )}
                            <form onSubmit={handleRegister} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">სახელი</label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                            <input name="firstName" required placeholder="გიორგი" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">გვარი</label>
                                        <input name="lastName" required placeholder="კაპანაძე" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">სტუდიის სახელი</label>
                                    <div className="relative group">
                                        <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                        <input name="studioName" required placeholder="მაგ: My Dance Academy" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                        <input name="email" type="email" required placeholder="contact@studio.ge" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">პაროლი</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                        <input name="password" type="password" required placeholder="••••••••" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all" />
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 py-2 pl-1">
                                    <div className="mt-1">
                                        <input type="checkbox" id="terms" required className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                    </div>
                                    <label htmlFor="terms" className="text-[11px] font-medium text-slate-500 leading-relaxed">
                                        ვეთანხმები <Link href="#" className="text-indigo-600 font-bold hover:underline">წესებს და პირობებს</Link> და მონაცემთა დამუშავების პოლიტიკას.
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>ანგარიშის შექმნა <ArrowRight className="w-5 h-5" /></>
                                    )}
                                </button>
                            </form>
                        </>
                    )}

                    <div className="mt-8 pt-8 border-t border-slate-100">
                        <div className="flex items-center justify-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                            <ShieldCheck className="w-4 h-4" /> 100% უსაფრთხო და დაცული
                        </div>
                    </div>
                </div>

                <p className="text-center text-sm font-semibold text-slate-500 pb-10">
                    უკვე გაქვთ ანგარიში? <Link href="/login" className="text-indigo-600 font-black hover:underline underline-offset-4 decoration-2">შესვლა</Link>
                </p>
            </div>
        </div>
    );
}
