'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TariffsRedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/subscriptions/plans');
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
}
