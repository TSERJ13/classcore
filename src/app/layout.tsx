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



import { UserProvider } from '@/hooks/useUser';

export default function RootLayout({ children }: { children: ReactNode }) {
    const cookieStore = cookies();
    const activeSlug = cookieStore.get('cc_active_slug')?.value || null;
    const activeLang = cookieStore.get('cc_lang')?.value as any || null;
    const studioNameRaw = cookieStore.get('cc_studio_name')?.value || '';
    const studioName = decodeURIComponent(studioNameRaw);

    return <RootLayoutClient activeLang={activeLang} activeSlug={activeSlug} studioName={studioName}>{children}</RootLayoutClient>;
}

function RootLayoutClient({ children, activeLang, activeSlug, studioName }: any) {
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
