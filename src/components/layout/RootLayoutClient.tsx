'use client';

import React, { useState, useEffect } from 'react';
import { UserProvider } from '@/hooks/useUser';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { StudioProvider } from '@/contexts/StudioContext';
import { ConfirmProvider } from '@/contexts/ConfirmContext';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { CacheBuster } from '@/components/CacheBuster';

export function RootLayoutClient({ children, activeLang, activeSlug, studioName }: any) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    return (
        <html lang={activeLang || 'ka'} suppressHydrationWarning>
            <head>
                <link rel="apple-touch-icon" href="/logo.svg" />
            </head>
            <body className="min-h-screen bg-base antialiased font-sans" suppressHydrationWarning>
                {mounted ? (
                    <>
                        <CacheBuster />
                        <UserProvider>
                            <LanguageProvider defaultLang={activeLang}>
                                <StudioProvider defaultSlug={activeSlug} defaultStudioName={studioName}>
                                    <ConfirmProvider>
                                        <GlobalErrorBoundary>
                                            {children}
                                        </GlobalErrorBoundary>
                                    </ConfirmProvider>
                                </StudioProvider>
                            </LanguageProvider>
                        </UserProvider>
                    </>
                ) : (
                    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center">
                        <div className="flex flex-col items-center gap-12 animate-pulse">
                            {/* 🔥 PRE-HYDRATION BRANDING: Show Studio Logo if cached */}
                            {(() => {
                                if (typeof window === 'undefined') return null;
                                const slug = activeSlug || localStorage.getItem('cc_active_studio_slug');
                                if (!slug) return null;
                                const settingsRaw = localStorage.getItem(`cc_studio_settings_${slug}`);
                                if (settingsRaw) {
                                    try {
                                        const settings = JSON.parse(settingsRaw);
                                        const logo = settings.logoDataUrl;
                                        if (logo) {
                                            return (
                                                <div className="relative">
                                                    <img src={logo} className="w-24 h-24 object-contain drop-shadow-xl" alt="Studio Logo" />
                                                    <div className="absolute inset-0 bg-white/40 mix-blend-overlay animate-pulse rounded-full" />
                                                </div>
                                            );
                                        }
                                    } catch(e) {}
                                }
                                return null;
                            })() || (
                                <div className="w-16 h-16 bg-indigo-500 rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-500/20">
                                    <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                </div>
                            )}
                            
                            <div className="flex items-center gap-4">
                                <div className="h-6 w-[1px] bg-slate-200" />
                                <span className="text-[10px] font-black text-slate-300 tracking-[0.4em] uppercase">
                                    {studioName || 'ClassCore'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </body>
        </html>
    );
}
