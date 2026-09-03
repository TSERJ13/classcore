'use client';

import React from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { isOwnerOrAdmin } from '@/lib/access';

import { useT } from '@/contexts/LanguageContext';

interface PermissionGuardProps {
    permKey?: string;
    adminOnly?: boolean;
    children: React.ReactNode;
}

export function PermissionGuard({ permKey, adminOnly, children }: PermissionGuardProps) {
    const { profile, loading } = useUser();
    const { lang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const isOwnerAdmin = isOwnerOrAdmin(profile?.role) || !profile?.role;

    if (isOwnerAdmin) {
        return <>{children}</>;
    }

    if (adminOnly) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[65vh] p-6 text-center animate-in fade-in duration-300">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-4 shadow-xl">
                    <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-primary mb-2">
                    {l('წვდომა შეზღუდულია', 'Доступ ограничен', 'Access Restricted')}
                </h2>
                <p className="text-sm text-muted max-w-md mb-6">
                    {l(
                        'ეს გვერდი ხელმისაწვდომია მხოლოდ სტუდიის ადმინისტრატორისთვის.',
                        'Эта страница доступна только для администратора студии.',
                        'This page is only accessible to studio administrators.'
                    )}
                </p>
                <Link href="/dashboard" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95">
                    {l('← მთავარ გვერდზე დაბრუნება', '← Вернуться на главную', '← Back to Dashboard')}
                </Link>
            </div>
        );
    }

    if (permKey && !(profile as any)?.[permKey]) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[65vh] p-6 text-center animate-in fade-in duration-300">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-4 shadow-xl">
                    <Lock className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-primary mb-2">
                    {l('წვდომა შეზღუდულია', 'Доступ ограничен', 'Access Restricted')}
                </h2>
                <p className="text-sm text-muted max-w-md mb-6">
                    {l(
                        'თქვენ არ გაქვთ ამ გვერდის ნახვის უფლება. გთხოვთ მიმართოთ სტუდიის ადმინისტრატორს წვდომის მისანიჭებლად.',
                        'У вас нет прав на просмотр этой страницы. Пожалуйста, обратитесь к администратору студии.',
                        'You do not have permission to view this page. Please contact your studio administrator.'
                    )}
                </p>
                <Link href="/dashboard" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95">
                    {l('← მთავარ გვერდზე დაბრუნება', '← Вернуться на главную', '← Back to Dashboard')}
                </Link>
            </div>
        );
    }

    return <>{children}</>;
}
