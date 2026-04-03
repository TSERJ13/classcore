import './globals.css';
import type { Metadata, Viewport } from 'next';
import React, { type ReactNode } from 'react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { StudioProvider } from '@/contexts/StudioContext';
import { ConfirmProvider } from '@/contexts/ConfirmContext';
import { cookies } from 'next/headers';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { CacheBuster } from '@/components/CacheBuster';

export const metadata: Metadata = {
    title: 'ClassCore | სტუდიის მართვის სისტემა',
    description: 'Universal CRM for dance studios, sports schools, yoga centers, and fitness studios.',
    keywords: ['CRM', 'studio', 'dance', 'sports', 'yoga', 'fitness', 'Georgia'],
    authors: [{ name: 'ClassCore', url: 'https://classcore.ge' }],
    icons: {
        icon: [
            { url: '/favicon-v4.png', type: 'image/png' },
            { url: '/icon-v4.png', sizes: '512x512', type: 'image/png' },
        ],
        apple: [
            { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
    },
    manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    userScalable: false,
    themeColor: '#4f46e5',
};



export default function RootLayout({ children }: { children: ReactNode }) {
    const cookieStore = cookies();
    const activeSlug = cookieStore.get('cc_active_slug')?.value || null;
    const activeLang = cookieStore.get('cc_lang')?.value as any || null;
    const studioNameRaw = cookieStore.get('cc_studio_name')?.value || '';
    const studioName = decodeURIComponent(studioNameRaw);

    return (
        <html lang={activeLang || 'ka'} suppressHydrationWarning>
            <head>
                <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
                <link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon.png" />
                <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
                <link rel="apple-touch-icon" sizes="167x167" href="/apple-touch-icon.png" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="default" />
                <meta name="apple-mobile-web-app-title" content="ClassCore" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="format-detection" content="telephone=no" />
                <meta name="msapplication-TileColor" content="#4f46e5" />
                <meta name="msapplication-tap-highlight" content="no" />
                <meta name="msapplication-TileImage" content="/icon-192.png" />
                {/* Splash screens could be added here if we had the specific sizes */}
            </head>
            <body className="min-h-screen bg-base antialiased font-sans">
                <CacheBuster />
                <LanguageProvider defaultLang={activeLang}>
                    <StudioProvider defaultSlug={activeSlug} defaultStudioName={studioName}>
                        <ConfirmProvider>
                            <GlobalErrorBoundary>
                                {children}
                            </GlobalErrorBoundary>
                        </ConfirmProvider>
                    </StudioProvider>
                </LanguageProvider>
            </body>
        </html>
    );
}
