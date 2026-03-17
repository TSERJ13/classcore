'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, type Lang, type Translations } from '@/lib/i18n';

export type { Translations };

interface LangContextValue {
    lang: Lang;
    setLang: (l: Lang) => void;
    t: Translations;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [lang, setLangState] = useState<Lang>('ka');
    const [isLoaded, setIsLoaded] = useState(false);

    // Persist choice to localStorage
    useEffect(() => {
        // Fallback timer: force load if it hangs
        const timer = setTimeout(() => {
            if (!isLoaded) {
                console.warn('LanguageProvider: Hydration timed out, forcing load');
                setIsLoaded(true);
            }
        }, 2000);

        try {
            const saved = localStorage.getItem('cc_lang') as Lang | null;

            if (saved && translations && typeof translations === 'object' && saved in translations) {
                setLangState(saved);
            } else {
                console.warn('LanguageProvider: Invalid or missing saved lang, defaulting to ka');
            }

            setIsLoaded(true);
        } catch (err) {
            console.error('LanguageProvider Hydration Error:', err);
            setIsLoaded(true);
        }

        return () => clearTimeout(timer);
    }, []);

    const setLang = useCallback((l: Lang) => {
        setLangState(l);
        if (typeof window !== 'undefined') localStorage.setItem('cc_lang', l);
    }, []);

    // Prevent hydration flicker? No, user wants it gone. 
    // Just render children immediately to avoid the dark blue screen.
    if (!isLoaded) return children;

    try {
        const t = (translations && translations[lang]) ? translations[lang] : translations.ka;
        return (
            <LangContext.Provider value={{ lang, setLang, t }}>
                {children}
            </LangContext.Provider>
        );
    } catch (err) {
        console.error('LanguageProvider Error:', err);
        return (
            <div className="min-h-screen bg-red-950 flex flex-col items-center justify-center text-white p-6 text-center">
                <h1 className="text-2xl font-black mb-4 uppercase tracking-wider">Critical Translation Error</h1>
                <div className="bg-black/40 p-6 rounded-3xl border border-red-500/30 max-w-lg mb-8">
                    <pre className="text-red-400 text-xs font-mono text-left whitespace-pre-wrap">
                        {String(err)}
                    </pre>
                </div>
                <button
                    onClick={() => { localStorage.clear(); window.location.reload(); }}
                    className="px-8 py-4 bg-white text-red-900 rounded-[2rem] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                >
                    Clear Cache & Reload
                </button>
            </div>
        );
    }
}

export function useT() {
    const ctx = useContext(LangContext);
    if (!ctx) {
        // Fallback for safety during hydration or if used outside provider
        return {
            lang: 'ka' as Lang,
            setLang: () => { },
            t: translations.ka
        };
    }
    return ctx;
}
