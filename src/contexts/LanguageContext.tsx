'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, type Lang, type Translations } from '@/lib/i18n';

export type { Translations };

interface LangContextValue {
    lang: Lang;
    setLang: (l: Lang, mode?: 'persistent' | 'session') => void;
    t: Translations;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LanguageProvider({ children, defaultLang }: { children: React.ReactNode; defaultLang?: Lang | null }) {
    // Initial persistent state from SSR (cookie) or default
    const [persistentLang, setPersistentLangState] = useState<Lang>(defaultLang || 'ka');
    // Session state (resets on tab close/new session)
    const [sessionLang, setSessionLangState] = useState<Lang | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        setIsLoaded(true);
        
        const syncFromStorage = () => {
            // Priority 1: Session override
            const storedSession = sessionStorage.getItem('cc_lang_session') as Lang;
            if (storedSession && ['ka', 'en', 'ru'].includes(storedSession)) {
                setSessionLangState(storedSession);
            }
            
            // Priority 2: Persistent preference
            const storedPersistent = localStorage.getItem('cc_lang') as Lang;
            if (storedPersistent && ['ka', 'en', 'ru'].includes(storedPersistent)) {
                setPersistentLangState(storedPersistent);
            }
        };

        syncFromStorage();
    }, []);

    const setLang = useCallback((l: Lang, mode: 'persistent' | 'session' = 'persistent') => {
        if (mode === 'session') {
            setSessionLangState(l);
            sessionStorage.setItem('cc_lang_session', l);
        } else {
            // Persistent change
            setPersistentLangState(l);
            setSessionLangState(null); // Clear session override when persistent is changed
            sessionStorage.removeItem('cc_lang_session');
            
            localStorage.setItem('cc_lang', l);
            document.cookie = `cc_lang=${l}; path=/; max-age=31536000; SameSite=Lax`;
        }
    }, []);

    // Effective language
    const lang = sessionLang || persistentLang;
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
        return {
            lang: 'ka' as Lang,
            setLang: () => { },
            t: translations.ka
        };
    }
    return ctx;
}

export function useLanguage() {
    const { lang, setLang, t } = useT();
    
    const l = useCallback((ka: string, ru: string, en: string) => {
        if (lang === 'ka') return ka;
        if (lang === 'ru') return ru;
        return en;
    }, [lang]);

    return { lang, setLang, t, l };
}
