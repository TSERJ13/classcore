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

export function LanguageProvider({ children, defaultLang }: { children: React.ReactNode; defaultLang?: Lang | null }) {
    // Initial state MUST match SSR (defaultLang from cookie) to avoid hydration errors
    const [lang, setLangState] = useState<Lang>(defaultLang || 'ka');
    const [isLoaded, setIsLoaded] = useState(false);

    // After mount, sync with localStorage if it differs from the cookie-based SSR default
    useEffect(() => {
        // Initial sync of isLoaded, but DO NOT override 'lang' from prop immediately 
        // to avoid hydration mismatch. SSR and first Client render should be identical.
        setIsLoaded(true);
    }, []);

    const setLang = useCallback((l: Lang) => {
        setLangState(l);
        localStorage.setItem('cc_lang', l);
        // Set cookie for SSR sync
        document.cookie = `cc_lang=${l}; path=/; max-age=31536000; SameSite=Lax`;
    }, []);

    // Use the current state (initialized from defaultLang for SSR or localStorage for client)
    const t = (translations && translations[lang]) ? translations[lang] : translations.ka;

    return (
        <LangContext.Provider value={{ lang, setLang, t }}>
            {children}
        </LangContext.Provider>
    );
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
