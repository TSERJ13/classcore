
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { loadSettings, saveSettings } from '@/lib/settings-store';
import { StudioSettings, SubscriptionLog, ThemeKey } from '@/types';
import { getActiveSlug, STORAGE_KEY, getScopedKey, markLocalUpdate } from '@/lib/utils';
import { ensureStudioExists, fetchFullStudioState, syncRecordToCloud } from '@/lib/master-sync';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';

interface StudioContextType {
    settings: StudioSettings;
    isLoaded: boolean;
    firstSyncDone: boolean;
    isSyncing: boolean;
    activeBranchId: string;
    setActiveBranchId: (id: string) => void;
    updateSettings: (updates: Partial<StudioSettings>) => void;
    setLogo: (url: string | null) => void;
    setTheme: (theme: ThemeKey) => void;
    setStudioName: (name: string) => void;
    setNotification: (key: keyof StudioSettings['notifications'], val: boolean) => void;
    setSecurity: (key: keyof StudioSettings['security'], val: any) => void;
    setCurrency: (c: 'GEL' | 'USD' | 'EUR') => void;
    setLanguage: (l: 'ka' | 'ru' | 'en') => void;
    setTimezone: (tz: string) => void;
    setGoogleCalendar: (enabled: boolean) => void;
    setPausePrice: (days: string, price: number) => void;
    setOwnerInfo: (info: any) => void;
    saveSettings: (updates: Partial<StudioSettings>, current?: any, slug?: string) => StudioSettings;
    updateStaff: (id: string, updates: any) => void;
    removeStaff: (id: string) => void;
    addStaff: (member: any) => void;
    addBranch: (branch: any) => void;
    removeBranch: (id: string) => void;
    updateBranch: (id: string, updates: any) => void;
    addSubscriptionLog: (log: Omit<SubscriptionLog, 'id' | 'date'>) => void;
    setCustomRoles: (roles: string[]) => void;
    addToTrash: (item: any) => void;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

export const StudioProvider: React.FC<{ children: React.ReactNode; defaultSlug?: string | null; defaultStudioName?: string | null }> = ({ children, defaultSlug, defaultStudioName }) => {
    const { user, profile } = useUser();
    
    const [settings, setSettings] = useState<StudioSettings>(() => {
        const base = loadSettings(defaultSlug || undefined);
        if (defaultStudioName && !base.studioName) {
            base.studioName = defaultStudioName;
        }
        if (defaultSlug && !base.studioSlug) {
            base.studioSlug = defaultSlug;
        }
        return base;
    });

    const [isLoaded, setIsLoaded] = useState(false);
    const [firstSyncDone, setFirstSyncDone] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [activeBranchId, setActiveBranchId] = useState('main');

    useEffect(() => {
        if (defaultSlug) {
            localStorage.setItem('cc_active_studio_slug', defaultSlug);
        }
    }, [defaultSlug]);

    const lastSyncedSlugRef = useRef<string | null>(null);

    const bootstrap = useCallback(async () => {
        if (!user) return;
        setIsSyncing(true);

        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            
            let activeSlug = getActiveSlug() || defaultSlug;
            
            const userEmail = profile?.email || (user as any)?.email || session?.user?.email;
            if (userEmail === "stdancegroup@gmail.com") {
                activeSlug = "stdancestudio";
                localStorage.setItem("cc_active_studio_slug", "stdancestudio");
                document.cookie = `cc_active_slug=stdancestudio; path=/; max-age=31536000; SameSite=Lax`;
            }

            if (!activeSlug || activeSlug === "dashboard") {
                const cookieSlug = document.cookie.split('; ').find(row => row.startsWith('cc_active_slug='))?.split('=')[1];
                if (cookieSlug) activeSlug = cookieSlug;
            }

            if (!activeSlug || ["subscriptions", "settings", "dashboard"].includes(activeSlug)) {
                 activeSlug = getActiveSlug() || defaultSlug;
            }

            const { fetchFullStudioState, ensureStudioExists, pushCollectionToCloud } = await import("@/lib/master-sync");
            
            // PRIORITY 1: Profile Org ID
            let targetOrgId = profile?.org_id;

            if (!targetOrgId) {
                targetOrgId = await ensureStudioExists(activeSlug || "default", settings.studioName);
            }

            if (targetOrgId) {
                console.log('📡 [MasterSync] Anchor Resolved:', targetOrgId);
                
                // Unlock RLS
                if (user) {
                    await supabase.from('profiles').update({ org_id: targetOrgId }).eq('id', user.id);
                }

                const state = await fetchFullStudioState(activeSlug || "default", targetOrgId);
                
                if (state) {
                    const studentStore = await import("@/lib/student-store");
                    const collectionsToRescue = [
                        { table: 'students', local: studentStore.getStudentsAllBranches(), cloud: state.students },
                        { table: 'staff', local: (await import("@/lib/teacher-store")).getTeachers(), cloud: state.staff },
                        { table: 'groups', local: (await import("@/lib/group-store")).getGroups(), cloud: state.groups },
                        { table: 'halls', local: (await import("@/lib/hall-store")).getHalls(), cloud: state.halls },
                        { table: 'subscriptions', local: Object.values((await import("@/lib/subscription-store")).getSubscriptions()).flat(), cloud: state.subscriptions },
                        { table: 'subscription_plans', local: (await import("@/lib/plan-store")).getPlans(), cloud: state.subscription_plans }
                    ];

                    let rescueHappened = false;
                    const rescueFlag = `cc_rescue_done_${activeSlug}`;
                    if (!localStorage.getItem(rescueFlag)) {
                        for (const col of collectionsToRescue) {
                            if (col.local.length > (col.cloud?.length || 0) && col.local.length > 0) {
                                await pushCollectionToCloud(col.table, col.local, targetOrgId);
                                rescueHappened = true;
                            }
                        }
                        localStorage.setItem(rescueFlag, Date.now().toString());
                    }
                    
                    const finalState = rescueHappened ? await fetchFullStudioState(activeSlug || "default", targetOrgId) : state;
                    if (!finalState) return;

                    const unwrap = (arr: any[]) => (arr || []).map(item => ({ ...(item.data || {}), ...item, data: undefined }));
                    const updates = {
                        orgId: targetOrgId,
                        studioSlug: activeSlug || "stdancestudio",
                        studioName: finalState.studio?.studio_name || (finalState as any).settingsRecord?.studio_name || profile?.studio_name || (userEmail === "stdancegroup@gmail.com" ? "S_T Dance Studio" : settings.studioName),
                        logoDataUrl: (finalState as any).settingsRecord?.logo_url || finalState.studio?.settings?.logo_url || settings.logoDataUrl,
                        staff: unwrap(finalState.staff).length > 0 ? unwrap(finalState.staff) : settings.staff,
                        branches: finalState.branches?.length > 0 ? finalState.branches : settings.branches
                    };

                    const settingsKey = `cc_studio_settings_${activeSlug}`;
                    localStorage.setItem(settingsKey, JSON.stringify({ ...loadSettings(activeSlug), ...updates }));
                    localStorage.setItem(`cc_org_id_${activeSlug}`, targetOrgId);
                    document.cookie = `cc_org_id_${activeSlug}=${targetOrgId}; path=/; max-age=31536000; SameSite=Lax`;
                    
                    setSettings(prev => ({ ...prev, ...updates }));
                    
                    const mapping: any = {
                        cc_teachers: unwrap(finalState.staff),
                        cc_branches: finalState.branches,
                        cc_halls: unwrap(finalState.halls),
                        cc_groups: unwrap(finalState.groups),
                        cc_student_data: Array.isArray(finalState.students) ? finalState.students.reduce((acc: any, s: any) => {
                            const student = { ...(s.data || {}), ...s, data: undefined };
                            return { ...acc, [student.id]: student };
                        }, {}) : {},
                        cc_calendar_events: unwrap(finalState.calendar_events),
                        cc_subscription_plans: unwrap(finalState.subscription_plans)
                    };

                    Object.entries(mapping).forEach(([key, data]) => {
                        const targetKey = getScopedKey(key, activeSlug);
                        if (data && (!Array.isArray(data) || data.length > 0)) {
                            localStorage.setItem(targetKey, JSON.stringify(data));
                        }
                    });
                    
                    setFirstSyncDone(true);
                }
            }
        } catch (err) {
            console.error('❌ [StudioContext] Bootstrap failed:', err);
        } finally {
            setIsSyncing(false);
            setIsLoaded(true);
        }
    }, [user, profile, defaultSlug, settings.studioName, settings.studioSlug]);

    useEffect(() => {
        if (user && !isLoaded) {
            bootstrap();
        }
    }, [user, isLoaded, bootstrap]);

    const updateSettings = (updates: Partial<StudioSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...updates };
            saveSettings(updates, prev, next.studioSlug);
            return next;
        });
    };

    const value: StudioContextType = {
        settings,
        isLoaded,
        firstSyncDone,
        isSyncing,
        activeBranchId,
        setActiveBranchId,
        updateSettings,
        setLogo: (url) => updateSettings({ logoDataUrl: url }),
        setTheme: (theme) => updateSettings({ themeKey: theme }),
        setStudioName: (name) => updateSettings({ studioName: name }),
        setNotification: (key, val) => updateSettings({ notifications: { ...settings.notifications, [key]: val } }),
        setSecurity: (key, val) => updateSettings({ security: { ...settings.security, [key]: val } }),
        setCurrency: (c) => updateSettings({ currency: c }),
        setLanguage: (l) => updateSettings({ language: l }),
        setTimezone: (tz) => updateSettings({ timezone: tz }),
        setGoogleCalendar: (enabled) => updateSettings({ googleCalendar: { ...settings.googleCalendar, enabled } }),
        setPausePrice: (days, price) => updateSettings({ pausePrices: { ...settings.pausePrices, [days]: price } }),
        setOwnerInfo: (info) => updateSettings({ owner_info: info }),
        saveSettings,
        updateStaff: (id, updates) => {},
        removeStaff: (id) => {},
        addStaff: (member) => {},
        addBranch: (branch) => {},
        removeBranch: (id) => {},
        updateBranch: (id, updates) => {},
        addSubscriptionLog: (log) => {},
        setCustomRoles: (roles) => {},
        addToTrash: (item) => {}
    };

    return (
        <StudioContext.Provider value={value}>
            {children}
        </StudioContext.Provider>
    );
};

export const useStudio = () => {
    const context = useContext(StudioContext);
    if (context === undefined) {
        throw new Error('useStudio must be used within a StudioProvider');
    }
    return context;
};
