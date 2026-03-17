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

        if (settings.studioSlug) {
            setBilling(getBillingState(settings.studioSlug));
        }
    }, [settings.studioSlug]);

    // SuperAdmin bypass
    if (impersonating) return <>{children}</>;

    // Wait for hydration
    if (!mounted) return <>{children}</>;

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

    // Suspended — full block
    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-10 text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                    <Lock className="w-8 h-8 text-red-400" />
                </div>
                <div>
                    <h1 className="text-xl font-black text-white mb-2">Dashboard დაბლოკილია</h1>
                    <p className="text-sm text-zinc-500">
                        გამოწერის ვადა {billing.daysOverdue} დღით გაგიდა. მომსახურების გამოსაყენებლად გთხოვთ დაფაროთ საფასური.
                    </p>
                </div>
                <div className="bg-zinc-800 rounded-2xl p-5">
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-2">გადასახდელი</p>
                    <p className="text-4xl font-black text-white">{SAAS_PRICE_GEL}₾<span className="text-sm text-zinc-500 font-bold">/თვე</span></p>
                </div>
                <Link href="/billing" className="flex items-center justify-center gap-2 w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-black rounded-2xl transition-all group">
                    <CreditCard className="w-5 h-5" />
                    გადახდაზე გადასვლა
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <p className="text-[10px] text-zinc-600">
                    დახმარება: support@classcore.ge
                </p>
            </div>
        </div>
    );
}
