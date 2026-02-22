'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, type Lang, type Translations } from '@/lib/i18n';

interface LangContextValue {
    lang: Lang;
    setLang: (l: Lang) => void;
    t: Translations;
}

const LangContext = createContext<LangContextValue>({
    lang: 'ka',
    setLang: () => { },
    t: translations.ka,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [lang, setLangState] = useState<Lang>('ka');

    // Persist choice to localStorage
    useEffect(() => {
        const saved = localStorage.getItem('sf_lang') as Lang | null;
        if (saved && saved in translations) setLangState(saved);
    }, []);

    const setLang = useCallback((l: Lang) => {
        setLangState(l);
        if (typeof window !== 'undefined') localStorage.setItem('sf_lang', l);
    }, []);

    return (
        <LangContext.Provider value={{ lang, setLang, t: translations[lang] }}>
            {children}
        </LangContext.Provider>
    );
}

export function useT() {
    return useContext(LangContext);
}
