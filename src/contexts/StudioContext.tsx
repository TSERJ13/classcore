'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { loadSettings, saveSettings, patchNotifications, patchSecurity, applyTheme, applyBg, type StudioSettings, type ThemeKey, type BgKey, DEFAULT_SETTINGS } from '@/lib/settings-store';

interface StudioContextValue {
    settings: StudioSettings;
    setTheme: (k: ThemeKey) => void;
    setBg: (k: BgKey) => void;
    setStudioName: (n: string) => void;
    setStudioSlug: (s: string) => void;
    setLogo: (dataUrl: string | null) => void;
    setNotification: (key: keyof StudioSettings['notifications'], val: boolean) => void;
    setSecurity: (key: keyof StudioSettings['security'], val: number | boolean) => void;
    setLandingContent: (content: Partial<StudioSettings['landingContent']>) => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);

    useEffect(() => {
        // Hydrate from localStorage after mount
        setSettings(loadSettings());
    }, []);

    // Apply theme on mount + whenever theme/bg changes
    useEffect(() => { applyTheme(settings.themeKey); }, [settings.themeKey]);
    useEffect(() => { applyBg(settings.bgKey); }, [settings.bgKey]);

    const setTheme = useCallback((k: ThemeKey) => {
        setSettings(saveSettings({ themeKey: k }));
        applyTheme(k);
    }, []);

    const setBg = useCallback((k: BgKey) => {
        setSettings(saveSettings({ bgKey: k }));
        applyBg(k);
    }, []);

    const setStudioName = useCallback((n: string) => {
        setSettings(saveSettings({ studioName: n }));
    }, []);

    const setStudioSlug = useCallback((s: string) => {
        setSettings(saveSettings({ studioSlug: s }));
    }, []);

    const setLogo = useCallback((dataUrl: string | null) => {
        setSettings(saveSettings({ logoDataUrl: dataUrl }));
    }, []);

    const setNotification = useCallback((key: keyof StudioSettings['notifications'], val: boolean) => {
        setSettings(patchNotifications({ [key]: val }));
    }, []);

    const setSecurity = useCallback((key: keyof StudioSettings['security'], val: number | boolean) => {
        setSettings(patchSecurity({ [key]: val }));
    }, []);

    const setLandingContent = useCallback((content: Partial<StudioSettings['landingContent']>) => {
        setSettings(saveSettings({ landingContent: { ...settings.landingContent, ...content } }));
    }, [settings.landingContent]);

    return (
        <StudioContext.Provider value={{ settings, setTheme, setBg, setStudioName, setStudioSlug, setLogo, setNotification, setSecurity, setLandingContent }}>
            {children}
        </StudioContext.Provider>
    );
}

export function useStudio() {
    const ctx = useContext(StudioContext);
    if (!ctx) throw new Error('useStudio must be used inside StudioProvider');
    return ctx;
}
