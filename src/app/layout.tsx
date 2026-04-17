import './globals.css';
import type { Metadata, Viewport } from 'next';
import React, { type ReactNode } from 'react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { StudioProvider } from '@/contexts/StudioContext';
import { ConfirmProvider } from '@/contexts/ConfirmContext';
import { cookies } from 'next/headers';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { CacheBuster } from '@/components/CacheBuster';
import { Zap } from 'lucide-react';

export const metadata: Metadata = {
    title: 'ClassCore | სტუდიის მართვის სისტემა',
    description: 'Universal CRM for dance studios, sports schools, yoga centers, and fitness studios.',
    keywords: ['CRM', 'studio', 'dance', 'sports', 'yoga', 'fitness', 'Georgia'],
    icons: {
        icon: [
            { url: '/favicon-v4.png', type: 'image/png' },
            { url: '/icon-v4.png', sizes: '512x512', type: 'image/png' },
        ],
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    userScalable: false,
    themeColor: '#4f46e5',
};

function FloatingLeaf({ color, delay, left, size }: { color: string, delay: string, left: string, size: string }) {
    return (
        <div 
            className="leaf" 
            style={{ 
                color, 
                left, 
                width: size, 
                height: size, 
                animationDuration: `${10 + Math.random() * 10}s`,
                animationDelay: delay 
            }} 
        />
    );
}

function LeavesBackground() {
    const leaves = [
        { color: '#D46A43', left: '10%', size: '20px', delay: '0s' },
        { color: '#8B2635', left: '25%', size: '25px', delay: '2s' },
        { color: '#E9C46A', left: '40%', size: '18px', delay: '5s' },
        { color: '#BC6C25', left: '60%', size: '22px', delay: '1s' },
        { color: '#606C38', left: '80%', size: '24px', delay: '7s' },
        { color: '#D46A43', left: '95%', size: '15px', delay: '3s' },
    ];

    return (
        <div className="leaves-container">
            {leaves.map((leaf, i) => <FloatingLeaf key={i} {...leaf} />)}
        </div>
    );
}

export default function RootLayout({ children }: { children: ReactNode }) {
    const cookieStore = cookies();
    const activeLang = cookieStore.get('cc_lang')?.value as any || 'ka';

    return (
        <html lang={activeLang} suppressHydrationWarning>
            <head>
                <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
            </head>
            <body className="min-h-screen bg-base antialiased font-sans transition-colors duration-500 overflow-x-hidden">
                <LeavesBackground />
                <CacheBuster />
                <LanguageProvider defaultLang={activeLang}>
                    <ConfirmProvider>
                        <GlobalErrorBoundary>
                            <StudioProvider>
                                {children}
                                <div className="fixed bottom-4 left-0 right-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none z-50">
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 shadow-xl scale-90">
                                        <Zap className="w-2.5 h-2.5 text-indigo-400" />
                                        <span className="text-[8px] font-black tracking-[0.3em] text-white/50 uppercase">System Integrity: Scorched Earth v2.1</span>
                                    </div>
                                </div>
                            </StudioProvider>
                        </GlobalErrorBoundary>
                    </ConfirmProvider>
                </LanguageProvider>
            </body>
        </html>
    );
}
