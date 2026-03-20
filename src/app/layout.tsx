import './globals.css';
import type { Metadata, Viewport } from 'next';
import React, { type ReactNode } from 'react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { StudioProvider } from '@/contexts/StudioContext';
import { ConfirmProvider } from '@/contexts/ConfirmContext';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';

export const metadata: Metadata = {
    title: 'ClassCore | სტუდიის მართვის სისტემა',
    description: 'Universal CRM for dance studios, sports schools, yoga centers, and fitness studios.',
    keywords: ['CRM', 'studio', 'dance', 'sports', 'yoga', 'fitness', 'Georgia'],
    authors: [{ name: 'ClassCore', url: 'https://classcore.ge' }],
    icons: {
        icon: [
            { url: '/logo.svg' },
        ],
        shortcut: '/logo.svg',
        apple: [
            { url: '/logo.svg' },
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



export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ka" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{
                    __html: `
(function(){
  try {
    var K='cc_studio_settings',
        th={charcoal:'#0e0e12',midnight:'#080c14',abyss:'#050508',forest:'#071310',white:'#ffffff',ivory:'#fefcf8',cocoa:'#faf5ed'},
        surf={charcoal:'#111116',midnight:'#0d1424',abyss:'#0a0a0f',forest:'#112420',white:'#f8f9fa',ivory:'#faf8f3',cocoa:'#f3ede4'},
        card={charcoal:'#161620',midnight:'#121c30',abyss:'#0f0f16',forest:'#112420',white:'#ffffff',ivory:'#ffffff',cocoa:'#ffffff'},
        light=['white','ivory','cocoa'],
        s=localStorage.getItem(K),
        k='white';
    if(s) {
        try { k=JSON.parse(s).bgKey||'white'; } catch(e){ k='white'; }
    }
    var b=th[k]||th.white, su=surf[k]||surf.white, c=card[k]||card.white, 
        L=(light.indexOf(k)!==-1) || (k==='white'), 
        e=document.documentElement;
    e.style.setProperty('--bg-base',b);
    e.style.setProperty('--bg-surface',su);
    e.style.setProperty('--bg-card',c);
    e.style.setProperty('--text-primary',L?'#111827':'#ffffff');
    e.style.setProperty('--text-muted',L?'#6b7280':'rgba(255,255,255,0.6)');
    e.style.setProperty('--border-subtle',L?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.1)');
    e.style.setProperty('--accent', '239 84% 67%');
    e.style.setProperty('--accent-hex', '#6366f1');
    if(L) e.classList.add('light-theme'); else e.classList.remove('light-theme');
  } catch(e){ console.error('Theme init failed', e); }
})();
                ` }} />
                <link rel="apple-touch-icon" href="/logo.svg" />
            </head>
            <body className="min-h-screen bg-base antialiased font-sans">
                    <LanguageProvider>
                        <StudioProvider>
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
