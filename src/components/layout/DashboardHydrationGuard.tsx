'use client';
import React, { useEffect, useState } from 'react';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';

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

    // Block until: Hydrated AND Auth Loaded AND Session Verified
    if (!mounted || authLoading || isVerified === null) {
        return (
            <div className="fixed inset-0 bg-base z-[9999] flex flex-col items-center justify-center p-8">
                {/* Visual Nudge Downwards (mt-12) for better optical centering */}
                <div className="flex flex-col items-center justify-center gap-6">
                    <div className="w-[80px] h-[80px] flex items-center justify-center">
                        <Logo size={80} animated loading />
                    </div>
                    <div className="text-center space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                            ჩატვირთვა...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Full screen block is NO LONGER used here to allow Dashboard-Only mode.
    // The restriction is now handled via pathname redirect above.
    return <>{children}</>;
}
