
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { loadSettings, saveSettings } from '@/lib/settings-store';
import { StudioSettings, SubscriptionLog } from '@/types/studio';
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
    // Specific setters for settings page
    setLogo: (url: string | null) => void;
    setTheme: (theme: ThemeKey) => void;
    setStudioName: (name: string) => void;
    setStudioSlug: (slug: string) => void;
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

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, profile } = useUser();
    const [settings, setSettings] = useState<StudioSettings>(() => loadSettings());
    const [trash, setTrash] = useState<any[]>(loadSettings().trash || []);
    const [isLoaded, setIsLoaded] = useState(false);
    const [firstSyncDone, setFirstSyncDone] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [activeBranchId, setActiveBranchId] = useState('main');

    useEffect(() => {
        // We MUST run this even if settings.studioSlug is empty IF we are logged in
        async function bootstrap() {
            let activeSlug = getActiveSlug();
            
            // EMERGENCY RECOVERY FOR stdancestudio
            if (activeSlug === "subscriptions" || activeSlug === "settings" || !activeSlug) {
                const userEmail = profile?.email || (user as any)?.email;
                if (userEmail === "stdancegroup@gmail.com") {
                    console.log("🚨 [Emergency] Redirecting corrupted slug to stdancestudio");
                    activeSlug = "stdancestudio";
                    localStorage.setItem("cc_active_studio_slug", "stdancestudio");
                }
            }

            if (!activeSlug || ["superadmin", "dashboard", "auth", "admin", "login", "settings", "billing", "analytics", "history", "attendance", "students", "teachers", "halls", "groups", "calendar", "shop", "sms-manager", "subscriptions"].includes(activeSlug)) {
                setIsLoaded(true);
                return;
            }

            try {
                const targetOrgId = await import("@/lib/master-sync").then(mod => mod.ensureStudioExists(activeSlug || "default", settings.studioName));
                if (targetOrgId) {
                    const { fetchFullStudioState } = await import("@/lib/master-sync");
                    const state = await fetchFullStudioState(activeSlug || "default", targetOrgId);
                    if (state) {
                        console.log('✅ [MasterSync] Hydrated state for Org:', state.org_id);
                        
                        // UNWRAP DATA FOR COLLECTIONS
                        const unwrap = (arr: any[]) => (arr || []).map(item => ({ ...(item.data || {}), ...item, data: undefined }));
                        const unwrappedStaff = unwrap(state.staff);

                        const updates = {
                            orgId: targetOrgId,
                            studioName: state.studio?.studio_name || settings.studioName,
                            logoDataUrl: (state as any).settingsRecord?.logo_url || state.studio?.settings?.logo_url || settings.logoDataUrl,
                            staff: unwrappedStaff.length > 0 ? unwrappedStaff : settings.staff,
                            branches: state.branches?.length > 0 ? state.branches : settings.branches
                        };
                        
                        setSettings(prev => {
                            const next = { ...prev, ...updates, studioSlug: activeSlug };
                            saveSettings(updates, prev, activeSlug);
                            return next;
                        });

                        const mapping: any = {
                            cc_teachers: unwrappedStaff,
                            cc_branches: state.branches,
                            cc_halls: unwrap(state.halls),
                            cc_groups: unwrap(state.groups),
                            cc_student_data: Array.isArray(state.students) 
                                ? state.students.reduce((acc: any, s: any) => ({ ...acc, [s.id]: { ...(s.data || {}), ...s, data: undefined } }), {})
                                : state.students,
                            cc_subscriptions: unwrap(state.subscriptions),
                            cc_checkins: unwrap(state.attendance),
                            cc_sales: unwrap(state.sales),
                            cc_expenses: unwrap(state.expenses),
                            cc_trash: unwrap(state.trash)
                        };

                        Object.entries(mapping).forEach(([key, data]) => {
                            const targetKey = getScopedKey(key, activeSlug);
                            localStorage.setItem(targetKey, JSON.stringify(data || (key === 'cc_student_data' ? {} : [])));
                        });

                        localStorage.setItem(`cc_last_sync_${activeSlug}`, Date.now().toString());
                        localStorage.setItem('cc_active_studio_slug', activeSlug);

                        ['cc_groups_update', 'cc_halls_update', 'cc_student_update', 'cc_teacher_update', 
                         'cc_subscription_update', 'cc_checkin_update', 'cc_sales_update', 'cc_expense_update', 'cc_trash_update']
                            .forEach(e => window.dispatchEvent(new CustomEvent(e, { detail: { isRemote: true } })));
                    }
                }
            } catch (err) {
                console.error('❌ [MasterSync] Bootstrap failed:', err);
            } finally {
                setIsSyncing(false);
                setFirstSyncDone(true);
            }
        }

        bootstrap();
    }, [isLoaded, settings.studioSlug, user, profile]);

    useEffect(() => {
        const defaultSlug = getActiveSlug();
        const local = loadSettings(defaultSlug || undefined);
        setSettings(local);
        setTrash(local.trash || []);
        setIsLoaded(true);
    }, []);

    const updateSettings = useCallback((updates: Partial<StudioSettings>) => {
        // PERMANENT PROTECTION: Never allow manual updates to studioSlug from the UI
        if ('studioSlug' in updates) {
            delete updates.studioSlug;
        }
        
        if (Object.keys(updates).length === 0) return;

        setSettings(prev => {
            const next = { ...prev, ...updates };
            // Note: saveSettings in settings-store.ts expects (payload, current_state, slug)
            import('@/lib/settings-store').then(mod => {
                mod.saveSettings(updates, prev, prev.studioSlug);
            });
            
            if (prev.studioSlug && prev.orgId) {
                const name = updates.studioName || prev.studioName;
                const metadata = { 
                    logo_url: next.logoDataUrl,
                    theme: next.themeKey,
                    currency: next.currency,
                    language: next.language
                };
                import('@/lib/master-sync').then(mod => {
                    mod.pushFullStudioMetadata(prev.studioSlug, name, metadata);
                    if (updates.logoDataUrl || updates.accentColor || updates.themeKey) {
                        mod.syncRecordToCloud('studio_settings', { 
                            org_id: prev.orgId, 
                            logo_url: next.logoDataUrl,
                            theme: next.themeKey
                        }, prev.orgId);
                    }
                });
            }
            return next;
        });
    }, []);

    const setLogo = (url: string | null) => updateSettings({ logoDataUrl: url });
    const setTheme = (key: ThemeKey) => updateSettings({ themeKey: key });
    const setStudioName = (name: string) => updateSettings({ studioName: name });
    const setNotification = (key: keyof StudioSettings['notifications'], val: boolean) => {
        updateSettings({ notifications: { ...settings.notifications, [key]: val } });
    };
    const setSecurity = (key: keyof StudioSettings['security'], val: any) => {
        updateSettings({ security: { ...settings.security, [key]: val } });
    };
    const setCurrency = (c: 'GEL' | 'USD' | 'EUR') => updateSettings({ currency: c });
    const setLanguage = (l: 'ka' | 'ru' | 'en') => updateSettings({ language: l });
    const setTimezone = (tz: string) => updateSettings({ timezone: tz });
    const setGoogleCalendar = (enabled: boolean) => updateSettings({ googleCalendarEnabled: enabled });
    const setPausePrice = (days: string, price: number) => {
        updateSettings({ pausePrices: { ...settings.pausePrices, [days]: price } });
    };
    const setOwnerInfo = (info: any) => updateSettings({ owner_info: info });

    const updateStaff = useCallback((id: string, updates: any) => {
        setSettings(prev => {
            const list = [...(prev.staff || [])];
            const idx = list.findIndex(s => s.id === id);
            if (idx > -1) {
                const updatedMember = { ...list[idx], ...updates };
                list[idx] = updatedMember;
                const next = { ...prev, staff: list };
                
                // 1. Sync to local storage settings
                import('@/lib/settings-store').then(mod => mod.saveSettings({ staff: list }, prev, prev.studioSlug));
                
                // 2. Sync teacher record to CLOUD table
                if (prev.orgId) {
                    import('@/lib/master-sync').then(mod => {
                        mod.syncRecordToCloud('staff', {
                            id,
                            org_id: prev.orgId,
                            full_name: `${updatedMember.first_name || ''} ${updatedMember.last_name || ''}`.trim() || updatedMember.full_name,
                            data: updatedMember
                        }, prev.orgId);
                    });
                }
                
                return next;
            }
            return prev;
        });
    }, []);

    const removeStaff = useCallback((id: string) => {
        setSettings(prev => {
            const list = (prev.staff || []).filter(s => s.id !== id);
            const next = { ...prev, staff: list };
            import('@/lib/settings-store').then(mod => mod.saveSettings({ staff: list }, prev, prev.studioSlug));
            
            // Sync deletion to CLOUD
            if (prev.orgId) {
                import('@/lib/master-sync').then(mod => mod.deleteRecordFromCloud('staff', id, prev.orgId));
            }
            
            return next;
        });
    }, []);

    const addStaff = useCallback((member: any) => {
        setSettings(prev => {
            const newId = member.id || `staff_${Math.random().toString(36).substr(2, 9)}`;
            const newMember = { ...member, id: newId };
            const list = [...(prev.staff || []), newMember];
            const next = { ...prev, staff: list };
            
            import('@/lib/settings-store').then(mod => mod.saveSettings({ staff: list }, prev, prev.studioSlug));
            
            // Sync to CLOUD staff table
            if (prev.orgId) {
                import('@/lib/master-sync').then(mod => {
                    mod.syncRecordToCloud('staff', {
                        id: newId,
                        org_id: prev.orgId,
                        full_name: `${newMember.first_name || ''} ${newMember.last_name || ''}`.trim() || newMember.full_name,
                        data: newMember
                    }, prev.orgId);
                });
            }
            
            return next;
        });
    }, []);

    const addBranch = useCallback((branch: any) => {
        setSettings(prev => {
            const list = [...(prev.branches || []), branch];
            const next = { ...prev, branches: list };
            import('@/lib/settings-store').then(mod => mod.saveSettings({ branches: list }, prev, prev.studioSlug));
            return next;
        });
    }, []);

    const removeBranch = useCallback((id: string) => {
        setSettings(prev => {
            const list = (prev.branches || []).filter(b => b.id !== id);
            const next = { ...prev, branches: list };
            import('@/lib/settings-store').then(mod => mod.saveSettings({ branches: list }, prev, prev.studioSlug));
            return next;
        });
    }, []);

    const updateBranch = useCallback((id: string, updates: any) => {
        setSettings(prev => {
            const list = [...(prev.branches || [])];
            const idx = list.findIndex(b => b.id === id);
            if (idx > -1) {
                list[idx] = { ...list[idx], ...updates };
                const next = { ...prev, branches: list };
                import('@/lib/settings-store').then(mod => mod.saveSettings({ branches: list }, prev, prev.studioSlug));
                return next;
            }
            return prev;
        });
    }, []);

    const addToTrash = useCallback((item: any) => {
        setTrash(prev => {
            const next = [item, ...prev].slice(0, 50);
            import('@/lib/settings-store').then(mod => mod.saveSettings({ trash: next } as any, settings, settings.studioSlug));
            return next;
        });
    }, [settings]);

    const addSubscriptionLog = useCallback((log: Omit<SubscriptionLog, 'id' | 'date'>) => {
        setSettings(prev => {
            const subscriptionLogs = [...(prev.subscriptionLogs || [])];
            subscriptionLogs.unshift({
                ...log,
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                studentName: log.studentName,
                branchId: (log.branchId || activeBranchId || 'main') as string,
                branchName: (log.branchName || prev.branches.find(b => b.id === (log.branchId || activeBranchId))?.name || 'Main') as string,
                performedBy: log.issuedByName || 'Admin'
            });
            import('@/lib/settings-store').then(mod => mod.saveSettings({ subscriptionLogs }, prev, prev.studioSlug));
            return prev;
        });
    }, [activeBranchId]);

    const setCustomRoles = useCallback((roles: string[]) => {
        setSettings(prev => {
            const next = { ...prev, customRoles: roles };
            import('@/lib/settings-store').then(mod => mod.saveSettings({ customRoles: roles }, prev, prev.studioSlug));
            return next;
        });
    }, []);

    return (
        <StudioContext.Provider value={{ 
            settings, 
            isLoaded, 
            firstSyncDone,
            isSyncing,
            activeBranchId, 
            setActiveBranchId,
            updateSettings,
            setLogo,
            setTheme,
            setStudioName,
            setStudioSlug,
            setNotification,
            setSecurity,
            setCurrency,
            setLanguage,
            setTimezone,
            setGoogleCalendar,
            setPausePrice,
            setOwnerInfo,
            saveSettings: (s, c, sl) => {
                const result = loadSettings(sl); // Dummy for type
                import('@/lib/settings-store').then(mod => mod.saveSettings(s, c || settings, sl || settings.studioSlug));
                return result;
            },
            updateStaff,
            removeStaff,
            addStaff,
            addBranch,
            removeBranch,
            updateBranch,
            addSubscriptionLog,
            setCustomRoles,
            addToTrash
        }}>
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
