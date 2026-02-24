import type { Metadata, Viewport } from 'next';
import React, { type ReactNode } from 'react';
import '@/app/globals.css';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { StudioProvider } from '@/contexts/StudioContext';

export const metadata: Metadata = {
    title: 'ClassCore | სტუდიის მართვის სისტემა',
    description: 'Universal CRM for dance studios, sports schools, yoga centers, and fitness studios.',
    keywords: ['CRM', 'studio', 'dance', 'sports', 'yoga', 'fitness', 'Georgia'],
    authors: [{ name: 'ClassCore', url: 'https://classcore.ge' }],
    icons: {
        icon: '/favicon.png',
        shortcut: '/favicon.png',
        apple: '/favicon.png',
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    userScalable: false,
    themeColor: '#3E2723',
};

const themeInitScript = `
(function(){
  var STORAGE_KEY = 'sf_studio_settings';
  var th={charcoal:'#0e0e12',slate:'#0d1117',midnight:'#080c14',zinc:'#18181b',abyss:'#050508',forest:'#071310',cosmos:'#0c0a14',white:'#ffffff',ivory:'#fefcf8',cocoa:'#faf5ed'};
  var surf={charcoal:'#111116',slate:'#161b22',midnight:'#0d1424',zinc:'#1c1c1f',abyss:'#0a0a0f',forest:'#0c1c18',cosmos:'#120f1e',white:'#f8f9fa',ivory:'#faf8f3',cocoa:'#f3ede4'};
  var card={charcoal:'#161620',slate:'#1c2128',midnight:'#121c30',zinc:'#212125',abyss:'#0f0f16',forest:'#112420',cosmos:'#181428',white:'#ffffff',ivory:'#ffffff',cocoa:'#ffffff'};
  var light=['white','ivory','cocoa'];
  var stored = localStorage.getItem(STORAGE_KEY);
  var bgKey = 'white';
  try { if(stored) bgKey = JSON.parse(stored).bgKey || 'white'; } catch(e){}
  var b=th[bgKey]||th.white, s=surf[bgKey]||surf.white, c=card[bgKey]||card.white;
  var isL=light.indexOf(bgKey)!==-1;
  var el=document.documentElement;
  el.style.setProperty('--bg-base',b);el.style.setProperty('--bg-surface',s);el.style.setProperty('--bg-card',c);
  el.style.setProperty('--text-primary',isL?'#111827':'#ffffff');
  el.style.setProperty('--text-muted',isL?'#6b7280':'rgba(255,255,255,0.6)');
  el.style.setProperty('--border-subtle',isL?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.1)');
  if(isL)el.classList.add('light-theme');else el.classList.remove('light-theme');
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ka" suppressHydrationWarning>
            <head />
            <body
                className="min-h-screen bg-base text-[var(--text-primary)] antialiased"
                style={{ backgroundColor: 'var(--bg-base, #3E2723)', color: 'var(--text-primary, #EFEBE9)' }}
            >
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
                <LanguageProvider>
                    <StudioProvider>
                        {children}
                    </StudioProvider>
                </LanguageProvider>
            </body>
        </html>
    );
}
