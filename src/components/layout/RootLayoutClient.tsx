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
                    <CacheBuster>
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
                    </CacheBuster>
                ) : (
                    <div className="fixed inset-0 bg-base flex items-center justify-center">
                        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                    </div>
                )}
            </body>
        </html>
    );
}
