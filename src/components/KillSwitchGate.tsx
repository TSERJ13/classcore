'use client';

import { useEffect, useState } from 'react';
import { useStudio } from '@/contexts/StudioContext';
import { getBillingState, BillingState, SAAS_PRICE_GEL } from '@/lib/saas-billing';
import { AlertTriangle, Lock, CreditCard, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface Props { children: React.ReactNode; }

export default function KillSwitchGate({ children }: Props) {
    const { settings } = useStudio();
    const [billing, setBilling] = useState<BillingState | null>(null);
    const [impersonating, setImpersonating] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // SuperAdmin impersonation bypass
        const imp = localStorage.getItem('cc_sa_impersonate');
        if (imp) { setImpersonating(true); return; }

        const checkBilling = () => {
            if (settings.studioSlug) {
                setBilling(getBillingState(settings.studioSlug));
            }
        };

        checkBilling();

        window.addEventListener('cc_billing_update', checkBilling);
        window.addEventListener('cc_data_hydrated', checkBilling);
        window.addEventListener('cc_subscription_update', checkBilling);

        return () => {
            window.removeEventListener('cc_billing_update', checkBilling);
            window.removeEventListener('cc_data_hydrated', checkBilling);
            window.removeEventListener('cc_subscription_update', checkBilling);
        };
    }, [settings.studioSlug]);

    // SuperAdmin bypass
    if (impersonating) return <>{children}</>;

    // Wait for hydration to avoid mismatch between server (mock) and client (reset)
    if (!mounted) return null;

    // Loading or trial/active — show normally
    if (!billing || billing.status === 'trial' || billing.status === 'active') {
        return (
            <>
                {billing?.status === 'trial' && billing.daysLeftInTrial <= 7 && (
                    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-sm text-amber-700 font-bold">
                            <AlertTriangle className="w-4 h-4" />
                            Trial: {billing.daysLeftInTrial} დღე დარჩა — შემდეგ {SAAS_PRICE_GEL}₾/თვე
                        </div>
                        <Link href="/billing" className="text-xs font-black text-amber-700 underline underline-offset-2 hover:text-amber-900 whitespace-nowrap">
                            გადახდა →
                        </Link>
                    </div>
                )}
                {children}
            </>
        );
    }

    // Overdue — show warning banner but allow access
    if (billing.status === 'overdue') {
        return (
            <>
                <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-red-700 font-bold">
                        <AlertTriangle className="w-4 h-4" />
                        გადახდის ვადა გავიდა! {billing.daysOverdue} დღის შეფერხება — {2 - billing.daysOverdue} დღე დარჩა ბლოკამდე
                    </div>
                    <Link href="/billing" className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs font-black rounded-lg hover:bg-red-700 transition-all whitespace-nowrap">
                        <CreditCard className="w-3 h-3" /> გადახდა
                    </Link>
                </div>
                {children}
            </>
        );
    }

    // Suspended or Manually Blocked — full block
    if (billing.status === 'suspended' || billing.manualBlock) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 select-none">
                <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-10 text-center space-y-6 animate-in zoom-in-95 duration-500">
                    <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto shadow-2xl shadow-red-500/5">
                        <Lock className="w-10 h-10 text-red-500" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white mb-3 tracking-tight">
                            {billing.manualBlock ? 'სტუდია დაპაუზებულია' : 'წვდომა შეზღუდულია'}
                        </h1>
                        <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                            {billing.manualBlock 
                                ? 'თქვენი სტუდიის გვერდი დროებით შეჩერებულია ადმინისტრაციის მიერ. გთხოვთ დაუკავშირდეთ მხარდაჭერას დეტალებისთვის.' 
                                : `გადახდის ვადა ${billing.daysOverdue} დღით გადაცილებულია. მომსახურების გასაგრძელებლად გთხოვთ დაფაროთ საფასური.`}
                        </p>
                    </div>
                    
                    {!billing.manualBlock && (
                        <>
                            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-6 shadow-inner">
                                <p className="text-[10px] text-zinc-500 font-black tracking-[0.2em] uppercase mb-2">გადასახდელი</p>
                                <div className="flex items-baseline justify-center gap-1">
                                    <p className="text-5xl font-black text-white tabular-nums">{SAAS_PRICE_GEL}₾</p>
                                    <p className="text-sm text-zinc-500 font-bold">/თვე</p>
                                </div>
                            </div>
                            <Link href="/billing" className="flex items-center justify-center gap-3 w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-600/20 group hover:scale-[1.02] active:scale-95">
                                <CreditCard className="w-5 h-5" />
                                გადახდაზე გადასვლა
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </>
                    )}

                    <div className="pt-4 border-t border-zinc-800/50">
                        <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-1">დახმარება</p>
                        <p className="text-xs text-indigo-400 font-bold">support@classcore.ge</p>
                    </div>
                </div>
            </div>
        );
    }

    // Default return logic fallback
    return <>{children}</>;
}
