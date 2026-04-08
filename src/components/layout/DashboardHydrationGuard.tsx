'use client';
import { useEffect, useState } from 'react';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Mail, Phone, LogOut } from 'lucide-react';

export function DashboardHydrationGuard({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    const { settings } = useStudio();
    const { loading: authLoading, isVerified } = useUser();
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted && !authLoading && isVerified === false) {
            console.log('🚪 [DashboardHydrationGuard] Session invalid or missing. Redirecting to login.');
            router.push('/login');
        }
    }, [mounted, authLoading, isVerified, router]);

    const handleLogout = () => {
        localStorage.removeItem('cc_sa_impersonate');
        document.cookie = "cc_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        window.location.href = '/';
    };

    // Block until: Hydrated AND Auth Loaded AND Session Verified
    if (!mounted || authLoading || isVerified === null) {
        return (
            <div className="min-h-screen bg-base flex flex-col items-center justify-center p-8 space-y-4">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
                    სესია მოწმდება...
                </p>
            </div>
        );
    }

    if (settings.suspended) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
                {/* Abstract Background Blobs */}
                <div className="absolute top-0 left-0 w-[50%] h-full bg-rose-50/50 blur-[120px] -z-10" />
                <div className="absolute bottom-0 right-0 w-[30%] h-1/2 bg-indigo-50/50 blur-[100px] -z-10" />
                
                <div className="w-full max-w-md space-y-8 text-center animate-in fade-in zoom-in duration-500">
                    <div className="flex flex-col items-center gap-6">
                        <div className="w-20 h-20 rounded-[2.5rem] bg-rose-500 text-white flex items-center justify-center shadow-2xl shadow-rose-500/30 animate-bounce">
                            <ShieldAlert className="w-10 h-10" />
                        </div>
                        
                        <div className="space-y-3">
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">სტუდია შეჩერებულია</h1>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Studio is Suspended</p>
                        </div>
                    </div>

                    <div className="bg-white/60 backdrop-blur-xl border border-rose-100 p-8 rounded-[2.5rem] shadow-2xl shadow-rose-500/5 space-y-6">
                        <p className="text-sm text-slate-600 font-medium leading-relaxed italic">
                            სტუდიის მომსახურება დროებით შეჩერებულია გადაუხდელობის ან ტექნიკური მიზეზების გამო. გთხოვთ დაუკავშირდეთ ადმინისტრაციას.
                        </p>
                        
                        <div className="h-[1px] bg-gradient-to-r from-transparent via-rose-100 to-transparent" />

                        <div className="space-y-3">
                            <a href="mailto:support@classcore.ge" className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100 hover:border-indigo-500/30 transition-all group">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Support</p>
                                    <p className="text-sm font-black text-slate-800">support@classcore.ge</p>
                                </div>
                            </a>
                            
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <Phone className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Call Admin</p>
                                    <p className="text-sm font-black text-slate-800">+995 5xx xx xx xx</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleLogout}
                        className="flex items-center gap-3 mx-auto px-8 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl transition-all active:scale-95"
                    >
                        <LogOut className="w-4 h-4" /> გამოსვლა (Sign Out)
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
