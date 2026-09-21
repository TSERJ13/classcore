import './globals.css';
import type { Metadata, Viewport } from 'next';
import React, { type ReactNode } from 'react';

export const metadata: Metadata = {
    title: 'ClassCore | სტუდიის მართვის სისტემა',
    description: 'Universal CRM for dance studios, sports schools, yoga centers, and fitness studios.',
    keywords: ['CRM', 'studio', 'dance', 'sports', 'yoga', 'fitness', 'Georgia'],
    authors: [{ name: 'ClassCore', url: 'https://classcore.ge' }],
    icons: {
        icon: [
            { url: '/logo.svg', type: 'image/svg+xml' },
        ],
        shortcut: '/logo.svg',
        apple: [
            { url: '/logo.svg', type: 'image/svg+xml' },
        ],
    },
    manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    userScalable: false,
    themeColor: '#6366f1',
};



import { cookies, headers } from 'next/headers';
import { RootLayoutClient } from '@/components/layout/RootLayoutClient';

export default function RootLayout({ children }: { children: ReactNode }) {
    const cookieStore = cookies();
    const headersList = headers();
    const host = headersList.get('host') || '';
    const isAppDomain = host.includes('classcore.app');

    const activeSlug = cookieStore.get('cc_active_slug')?.value || null;
    let activeLang = cookieStore.get('cc_lang')?.value as any || null;
    if (!activeLang && isAppDomain) {
        activeLang = 'en';
    }
    const studioNameRaw = cookieStore.get('cc_studio_name')?.value || '';
    const studioName = decodeURIComponent(studioNameRaw);

    return (
        <RootLayoutClient 
            activeLang={activeLang} 
            activeSlug={activeSlug} 
            studioName={studioName}
            isAppDomain={isAppDomain}
        >
            {children}
        </RootLayoutClient>
    );
}
