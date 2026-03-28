'use client';

import { useEffect, useState } from 'react';

export function DashboardHydrationGuard({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="min-h-screen bg-base flex flex-col items-center justify-center p-8 space-y-4">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
            </div>
        );
    }

    return <>{children}</>;
}
