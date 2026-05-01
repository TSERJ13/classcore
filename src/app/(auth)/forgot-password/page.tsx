'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Zap, Mail, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AppLogo } from '@/components/ui/Logo';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { createClient } = await import('@/lib/supabase/client');
            const supabase = createClient();
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
            setSent(true);
        } catch (err) {
            console.error(err);
        } finally {
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
                    <Link href="/" className="group flex flex-col items-center gap-2">
                        <AppLogo size={80} transparent />
                    </Link>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">პაროლის აღდგენა</h1>
                    <p className="text-slate-500 font-medium px-6">გაგვიზიარეთ თქვენი ელ.ფოსტა და გამოგიგზავნით ინსტრუქციას</p>
                </div>

                {/* Form Card */}
                <div className="bg-white/50 backdrop-blur-xl border border-slate-100 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-500/5">
                    {sent ? (
                        <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-lg font-black text-slate-900">წერილი გაიგზავნა!</h2>
                                <p className="text-sm text-slate-500 font-medium">შეამოწმეთ {email} ინსტრუქციისთვის.</p>
                            </div>
                            <Link href="/login" className="flex items-center justify-center gap-2 text-sm font-black text-indigo-600 hover:text-indigo-700 transition-colors tracking-widest pt-2">
                                <ArrowLeft className="w-4 h-4" /> უკან დაბრუნება
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 tracking-widest pl-1">ელ.ფოსტა</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="email@classcore.ge"
                                        className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-900 outline-none transition-all shadow-sm"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>გაგზავნა <ArrowRight className="w-5 h-5" /></>
                                )}
                            </button>

                            <Link href="/login" className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors tracking-[0.2em]">
                                <ArrowLeft className="w-3.5 h-3.5" /> უკან შესვლაზე
                            </Link>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
