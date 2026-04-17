'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Zap, Lock, ArrowRight, CheckCircle2, Shield, Loader2 } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('პაროლები არ ემთხვევა');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { createClient } = await import('@/lib/supabase/client');
            const supabase = createClient();
            const { error: resetError } = await supabase.auth.updateUser({ password });
            
            if (resetError) throw resetError;
            
            setSuccess(true);
            setTimeout(() => {
                router.push('/login');
            }, 3000);
        } catch (err: any) {
            setError(err.message || 'პაროლის შეცვლა ვერ მოხერხდა');
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
                    <Link href="/" className="group transition-all duration-500 hover:scale-110 active:scale-95">
                        <Logo size={80} transparent />
                    </Link>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">ახალი პაროლი</h1>
                    <p className="text-slate-500 font-medium px-6">შეიყვანეთ თქვენი ახალი უსაფრთხოების კოდი</p>
                </div>

                {/* Form Card */}
                <div className="bg-white/50 backdrop-blur-xl border border-slate-100 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-500/5">
                    {success ? (
                        <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-lg font-black text-slate-900 leading-none">წარმატებით შეიცვალა</h2>
                                <p className="text-sm text-slate-500 font-medium pt-2">ახლა შეგიძლიათ შეხვიდეთ ახალი პაროლით.</p>
                            </div>
                            <div className="flex items-center justify-center gap-2 text-xs font-black text-indigo-400 animate-pulse pt-4">
                                <Loader2 className="w-3 h-3 animate-spin" /> ავტომატური გადაყვანა...
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleReset} className="space-y-8">
                            {error && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-[10px] font-black text-red-500 uppercase tracking-tight text-center">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">ახალი პაროლი</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                                        <input
                                            type="password"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-900 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">გაიმეორეთ პაროლი</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                                        <input
                                            type="password"
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-900 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm tracking-widest uppercase flex items-center justify-center gap-3 shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>პაროლის შეცვლა <ArrowRight className="w-5 h-5" /></>
                                )}
                            </button>
                        </form>
                    )}
                </div>

                <div className="text-center pt-8 opacity-40">
                    <div className="flex items-center justify-center gap-4">
                        <Shield className="w-4 h-4 text-slate-400" />
                        <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
                        <Zap className="w-4 h-4 text-slate-400" />
                    </div>
                </div>
            </div>
        </div>
    );
}
