'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Lock, User, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';

export default function RegisterPage() {
    const { t } = useT();
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
        const phone = formData.get('phone') as string;

        try {
            const { createClient } = await import('@/lib/supabase/client');
            const supabase = createClient();

            // Generate a clean slug from studio name
            const studioSlug = studioName.toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');

            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/confirm`,
                    data: {
                        role: 'owner',
                        first_name: firstName,
                        last_name: lastName,
                        full_name: `${firstName} ${lastName}`.trim(),
                        phone: phone,
                        studio_name: studioName,
                        org_id: crypto.randomUUID(),
                        studio_slug: studioSlug
                    }
                }
            });

            if (signUpError) throw signUpError;

            // Proactively seed local storage so the user sees their studio name immediately 
            // even before confirmation, or right after landing on dashboard.
            if (typeof window !== 'undefined') {
                localStorage.setItem('cc_active_studio_slug', studioSlug);
                localStorage.setItem('cc_studio_name', studioName);
                
                // Also set cookies for SSR consistency
                document.cookie = `cc_active_slug=${studioSlug}; path=/; max-age=31536000; SameSite=Lax`;
                document.cookie = `cc_studio_name=${encodeURIComponent(studioName)}; path=/; max-age=31536000; SameSite=Lax`;

                // Also create a basic settings object for this slug
                const key = `cc_studio_settings_${studioSlug}`;
                const basicSettings = {
                    studioName,
                    studioSlug,
                    language: 'ka',
                    currency: 'GEL',
                    branches: [{ id: 'main', name: 'მთავარი ფილიალი', is_active: true }],
                    staff: [{
                        id: data.user?.id || Math.random().toString(36).substring(2, 9),
                        org_id: (data.user?.user_metadata?.org_id) || crypto.randomUUID(),
                        first_name: firstName,
                        last_name: lastName,
                        full_name: `${firstName} ${lastName}`.trim(),
                        phone: phone,
                        email: email,
                        role: 'owner',
                        status: 'active',
                        permissions: { 
                            canViewAttendance: true, canViewSubscriptions: true, canViewStudents: true,
                            canViewCalendar: true, canEditCalendar: true, canViewGroups: true,
                            canViewTeachers: true, canViewHalls: true, canViewShop: true,
                            canViewAnalytics: true, canViewSMS: true, canAddStudents: true,
                            canDeleteRecords: true, manageBilling: true, viewFinancials: true,
                            manageInventory: true
                        },
                        created_at: new Date().toISOString()
                    }]
                };
                localStorage.setItem(key, JSON.stringify(basicSettings));

                // Also push to cloud immediately so SuperAdmin can see it
                try {
                    const { pushStudioStateToCloud } = await import('@/lib/sync-store');
                    await pushStudioStateToCloud(studioSlug, basicSettings.staff as any[], { studioName, studioSlug });
                } catch (err) {
                    console.error('Initial cloud push failed:', err);
                }
            }

            if (data.user && !data.session) {
                setSuccess(true);
                setLoading(false);
            } else {
                window.location.href = '/dashboard';
            }
        } catch (err: unknown) {
            const errorObj = err as { message?: string };
            setError(errorObj.message || t.registerError);
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
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-600/30 logo-animate-hover logo-large overflow-hidden">
                            <img src="/logo.svg" alt="Logo" className="w-full h-full object-cover" />
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">ClassCore</h1>
                    </Link>
                    <div className="space-y-1">
                        <h2 className="text-xl font-black text-slate-800">{t.createStudio}</h2>
                        <p className="text-sm text-slate-500 font-medium">{t.startTrial}</p>
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
                                <h3 className="text-xl font-black text-slate-900">{t.checkEmail}</h3>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed px-4">
                                    {t.registerSuccessMessage}
                                </p>
                            </div>
                            <button
                                onClick={() => window.location.href = '/login'}
                                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                            >
                                {t.login}
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
                                        <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.firstName}</label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                            <input name="firstName" required placeholder="Nino" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.lastName}</label>
                                        <input name="lastName" required placeholder="Beridze" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.studioName}</label>
                                    <div className="relative group">
                                        <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                        <input name="studioName" required placeholder="e.g. My Dance Academy" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.phoneLabel || 'ტელეფონი'}</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold group-focus-within:text-indigo-600 transition-colors">
                                            +995
                                        </div>
                                        <input name="phone" required type="tel" placeholder="5xx xx xx xx" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-16 pr-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.email}</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                        <input name="email" type="email" required placeholder="contact@studio.ge" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.password}</label>
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
                                        {t.agreeTerms}
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>{t.createAccount} <ArrowRight className="w-5 h-5" /></>
                                    )}
                                </button>
                            </form>
                        </>
                    )}

                    <div className="mt-8 pt-8 border-t border-slate-100">
                        <div className="flex items-center justify-center gap-2 text-[10px] font-black text-emerald-600 tracking-widest">
                            <ShieldCheck className="w-4 h-4" /> {t.secureAccount}
                        </div>
                    </div>
                </div>

                <p className="text-center text-sm font-semibold text-slate-500 pb-10">
                    {t.haveAccount} <Link href="/login" className="text-indigo-600 font-black hover:underline underline-offset-4 decoration-2">{t.login}</Link>
                </p>
            </div>
        </div>
    );
}
