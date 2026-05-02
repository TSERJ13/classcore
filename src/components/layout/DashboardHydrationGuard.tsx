'use client';
import React, { useEffect, useState } from 'react';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { usePathname, useRouter } from 'next/navigation';
import { AppLogo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';

export function DashboardHydrationGuard({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    const { settings, firstSyncDone, isLoaded: studioLoaded } = useStudio();
    const { loading: authLoading, isVerified } = useUser();
    const [syncTimedOut, setSyncTimedOut] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setSyncTimedOut(true), 15000); // 15s fail-safe for slow sync
        return () => clearTimeout(timer);
    }, []);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted && !authLoading && isVerified === false) {
            console.log('🚪 [DashboardHydrationGuard] Session invalid or missing. Redirecting to login.');
            router.push('/login');
        }
    }, [mounted, authLoading, isVerified, router]);

    // REDIRECT logic for suspended accounts
    useEffect(() => {
        if (mounted && settings.suspended && pathname !== '/dashboard' && pathname !== '/billing') {
            router.replace('/dashboard');
        }
    }, [mounted, settings.suspended, pathname, router]);

    const [hasLocalData, setHasLocalData] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Check for scoped settings - if we have this, we can show the UI immediately
            const { getScopedKey } = require('@/lib/utils');
            const scopedSettingsKey = getScopedKey('cc_studio_settings', settings.studioSlug);
            const hasSettings = localStorage.getItem(scopedSettingsKey);
            
            // If we have settings AND at least some collections, we are good to go
            const hasCollections = localStorage.getItem(getScopedKey('cc_student_data', settings.studioSlug));
            
            if (hasSettings || hasCollections) {
                setHasLocalData(true);
            }
        }
    }, [settings.studioSlug]);

    // Block only the initial hydration to prevent server/client mismatch
    if (!mounted) return null;

    // 🚀 GUEST MODE FIX: If we are verified as "logged out", don't show the hydration loader
    // This prevents the "blank screen" in Guest Mode while waiting for a redirect.
    const isLoggedOut = isVerified === false;
    
    // Show loading overlay if:
    // 1. Auth is still loading
    // 2. OR: We haven't finished the first sync AND we don't have local data to show yet
    const isLoading = (authLoading || isVerified === null || (!studioLoaded && !hasLocalData && !syncTimedOut)) && !isLoggedOut;

    return (
        <>
            {/* Loading Overlay with Smooth Fade-out */}
            <div className={cn(
                "fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center p-8 transition-all duration-700",
                isLoading ? "opacity-100 scale-100" : "opacity-0 invisible scale-105 pointer-events-none"
            )}>
                <div className="flex flex-col items-center justify-center gap-12 -mt-20">
                    <div className="relative">
                        <AppLogo 
                            size={100} 
                            src={settings.logoDataUrl} 
                            radar 
                            loading 
                            className="relative z-10" 
                        />
                    </div>
                    <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <p className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.4em] animate-pulse">
                            {settings.studioName ? settings.studioName.toUpperCase() : 'მიმდინარეობს ჩატვირთვა...'}
                        </p>
                        <div className="w-48 h-0.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 animate-[loading-bar_2s_ease-in-out_infinite] shadow-[0_0_15px_rgba(79,70,229,0.3)]" />
                        </div>
                        {loadingStep && (
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                {loadingStep}
                            </p>
                        )}
                    </div>
                </div>

                <style jsx global>{`
                    @keyframes loading-bar {
                        0% { width: 0%; }
                        50% { width: 70%; }
                        100% { width: 100%; }
                    }
                `}</style>
            </div>

            {/* Dashboard Content - Always mounted after hydration for background init */}
            {children}
        </>
    );
}
