'use client';
import React, { useEffect, useState } from 'react';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';

export function DashboardHydrationGuard({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    const { settings } = useStudio();
    const { loading: authLoading, isVerified } = useUser();
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

    // REDIRECT logic for suspended accounts: Only allow Dashboard Home
    useEffect(() => {
        if (mounted && settings.suspended && pathname !== '/dashboard' && pathname !== '/billing') {
            console.log('🚫 [DashboardHydrationGuard] Account suspended. Redirecting to Dashboard Home.');
            router.replace('/dashboard');
        }
    }, [mounted, settings.suspended, pathname, router]);

    const handleLogout = () => {
        localStorage.removeItem('cc_sa_impersonate');
        document.cookie = "cc_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        window.location.href = '/';
    };

    // Block only the initial hydration to prevent server/client mismatch
    if (!mounted) return null;

    const isLoading = authLoading || isVerified === null;

    return (
        <>
            {/* Loading Overlay with Smooth Fade-out */}
            <div className={cn(
                "fixed inset-0 bg-base z-[9999] flex flex-col items-center justify-center p-8 transition-all duration-700 pointer-events-none",
                isLoading ? "opacity-100" : "opacity-0 invisible scale-105"
            )}>
                <div className="flex flex-col items-center justify-center gap-6">
                    <div className="w-[60px] h-[60px] flex items-center justify-center">
                        <Logo size={60} animated loading />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">
                            ჩატვირთვა...
                        </p>
                    </div>
                </div>
            </div>

            {/* Dashboard Content - Always mounted after hydration for background init */}
            {children}
        </>
    );
}
