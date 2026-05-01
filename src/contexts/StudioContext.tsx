'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { loadSettings, saveSettings } from '@/lib/settings-store';
import { useUser } from '@/hooks/useUser';
import { getActiveSlug, getScopedKey } from '@/lib/utils';
import type { StudioSettings, Branch } from '@/types';

interface StudioContextType {
    settings: StudioSettings;
    updateSettings: (updates: Partial<StudioSettings>) => void;
    isLoaded: boolean;
    loadingStep: string;
    firstSyncDone: boolean;
    isSyncing: boolean;
    activeBranchId: string;
    setActiveBranch: (id: string) => void;
    addBranch: (name: string, address?: string) => void;
    refreshData: () => Promise<void>;
    
    // Setters required by SettingsPage
    setTheme: (key: any) => void;
    setStudioName: (name: string) => void;
    setLogo: (url: string | null) => void;
    setNotification: (key: string, val: boolean) => void;
    setSecurity: (key: string, val: any) => void;
    setCurrency: (cur: string) => void;
    setLanguage: (lang: string) => void;
    setTimezone: (tz: string) => void;
    setGoogleCalendar: (id: string) => void;
    setPausePrice: (p: number) => void;
    updateStaff: (id: string, data: any) => void;
    removeStaff: (id: string) => void;
    removeBranch: (id: string) => void;
    updateBranch: (id: string, data: any) => void;
    setCustomRoles: (roles: any) => void;
    addStaff: (member: any) => void;
    setOwnerInfo: (info: any) => void;
    saveSettings: (updates: any, prev?: any, slug?: string) => void;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

export const StudioProvider: React.FC<{ children: React.ReactNode; defaultSlug?: string | null; defaultStudioName?: string | null }> = ({ children, defaultSlug, defaultStudioName }) => {
    const { user, profile, loading: userLoading } = useUser();
    
    const [settings, setSettings] = useState<StudioSettings>(() => {
        const base = loadSettings(defaultSlug || undefined);
        if (defaultStudioName && !base.studioName) base.studioName = defaultStudioName;
        if (defaultSlug && !base.studioSlug) base.studioSlug = defaultSlug;
        return base;
    });
    const [isLoaded, setIsLoaded] = useState(false);
    const [loadingStep, setLoadingStep] = useState<string>('');
    const [firstSyncDone, setFirstSyncDone] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [activeBranchId, setActiveBranchId] = useState('main');

    const lastSyncedSlugRef = useRef<string | null>(null);

    const hydrate = useCallback(async (isAuto = false) => {
        let activeSlug = getActiveSlug() || defaultSlug || profile?.studio_slug;
        
        if (!activeSlug || ["auth", "login", "superadmin", "subscriptions", "settings"].includes(activeSlug)) {
             if (profile?.studio_slug) {
                 activeSlug = profile.studio_slug;
             } else {
                 if (userLoading) return;
                 setIsLoaded(true);
                 return;
             }
        }

        try {
            if (!isAuto) setIsSyncing(true);
            const { createClient } = await import("@/lib/supabase/client");
            const sb = createClient();
            
            setLoadingStep('სტუდიის იდენტიფიცირება...'); // Identifying Studio...
            const { data: studioRecord } = await sb.from('studios').select('*').eq('studio_slug', activeSlug).maybeSingle();
            
                let phase1Logo = null;
                if (studioRecord) {
                    phase1Logo = studioRecord.logo_url || (studioRecord.settings as any)?.logoDataUrl;
                    setSettings(prev => {
                        const next = {
                            ...prev,
                            orgId: studioRecord.org_id,
                            studioName: studioRecord.studio_name || prev.studioName,
                            logoDataUrl: phase1Logo || prev.logoDataUrl,
                            studioSlug: activeSlug
                        };
                        saveSettings(next, prev, activeSlug);
                        return next;
                    });
                }

                const targetOrgId = studioRecord?.org_id || profile?.org_id;
                
                if (targetOrgId) {
                    console.log('📡 [StudioContext] Phase 2: Starting Deep Sync for Org:', targetOrgId);
                    setLoadingStep('მონაცემების სინქრონიზაცია...'); 
                    const { fetchFullStudioState } = await import("@/lib/master-sync");
                    const state = await fetchFullStudioState(activeSlug || "default", targetOrgId);
                    
                    if (state) {
                        const cloudSettings = state.settingsRecord?.settings || {};
                        const updates = state.studio || {};
                        
                        // GREEDY LOGO RESOLUTION: Use the richest available source
                        const cloudLogo = updates.logo_url || cloudSettings.logoDataUrl;
                        const resolvedLogo = cloudLogo || phase1Logo || settings.logoDataUrl || prev.logoDataUrl;

                        console.log(`✅ [StudioContext] Identity Resolved: ${activeSlug} (Org: ${targetOrgId})`);
                        console.log(`🖼️ [StudioContext] Logo Source: ${cloudLogo ? 'CLOUD' : (phase1Logo ? 'DISCOVERY' : 'LOCAL')}`);

                        const unwrap = (arr: any) => Array.isArray(arr) ? arr.map(i => i.data || i) : null;
                    const allDeleted = new Set((state.trash || []).map((t: any) => t.entity_id || t.id));

                    // Helper for deep merging arrays - CRITICAL FOR RECOVERING LOST DATA
                    const resolveRicher = (db: any[], backup: any) => {
                        const dbArr = Array.isArray(db) ? db : [];
                        const backupArr = Array.isArray(backup) ? backup : Object.values(backup || {});
                        if (dbArr.length === 0) return backupArr;
                        const merged = dbArr.map(item => ({ ...item, ...(backupArr.find((b: any) => b.id === item.id) || {}) }));
                        backupArr.forEach(b => { if (!merged.find(m => m.id === b.id)) merged.push(b); });
                        return merged;
                    };

                    const finalStaff = resolveRicher(state.staff, cloudSettings.staff || prev.staff);
                    const finalHalls = resolveRicher(state.halls, cloudSettings.halls || cloudSettings.data?.halls);
                    const finalPlans = resolveRicher(state.subscription_plans, cloudSettings.subscription_plans || cloudSettings.plans);
                    const finalGroups = resolveRicher(state.groups, cloudSettings.groups || cloudSettings.data?.groups);
                    const finalEvents = resolveRicher(state.calendar_events, cloudSettings.calendar_events || cloudSettings.data?.events);
                    
                    setLoadingStep('ინტერფეისის მომზადება...');

                        setSettings(prev => {
                            const name = updates.studio_name || cloudSettings.studioName || prev.studioName;
                            
                            // GREEDY LOGO RESOLUTION: INSIDE updater to use Phase 1 / Local results
                            const cloudLogo = updates.logo_url || cloudSettings.logoDataUrl;
                            const finalLogo = cloudLogo || phase1Logo || prev.logoDataUrl;

                            console.log('🎨 [StudioContext] Final Hydration:', { 
                                name, 
                                logo: finalLogo ? (cloudLogo ? 'CLOUD' : 'RECOVERED') : 'MISSING' 
                            });

                            const next = {
                                ...prev,
                                ...cloudSettings,
                                orgId: targetOrgId,
                                studioName: name,
                                logoDataUrl: finalLogo,
                            staff: unwrap(finalStaff),
                            branches: (state.branches && state.branches.length > 0) ? state.branches : (cloudSettings.branches || prev.branches),
                            plan: state.studio?.plan || cloudSettings.plan || prev.plan,
                            subscription_plans: finalPlans,
                            pausePrices: cloudSettings.pausePrices || prev.pausePrices,
                            currency: cloudSettings.currency || prev.currency,
                            language: cloudSettings.language || prev.language,
                            studioSlug: activeSlug
                        };
                        saveSettings(next, prev, activeSlug);
                        return next;
                    });

                    const mapping: any = {
                        cc_teachers: unwrap(finalStaff),
                        cc_branches: state.branches,
                        cc_halls: unwrap(finalHalls),
                        cc_groups: unwrap(finalGroups),
                        cc_student_data: (unwrap(state.students) || []).reduce((acc: any, s: any) => ({ ...acc, [s.id]: s }), {}),
                        cc_student_subscriptions: (unwrap(state.subscriptions) || [])
                            .filter(sub => !allDeleted.has(sub.id))
                            .reduce((acc: any, sub: any) => {
                                const sId = sub.student_id;
                                if (sId) { if (!acc[sId]) acc[sId] = []; acc[sId].push(sub); }
                                return acc;
                            }, {}),
                        cc_calendar_events: unwrap(finalEvents),
                        cc_subscription_plans: unwrap(finalPlans),
                        cc_shop_products: unwrap(state.products),
                        cc_shop_sales: (unwrap(state.sales) || []).reduce((acc: any, sale: any) => {
                            const sId = sale.student_id;
                            if (sId) { if (!acc[sId]) acc[sId] = []; acc[sId].push(sale); }
                            return acc;
                        }, {}),
                        cc_expenses: unwrap(state.expenses),
                        cc_global_trash: unwrap(state.trash)
                    };

                    Object.entries(mapping).forEach(([key, data]) => {
                        if (data !== null && data !== undefined) {
                            if (Array.isArray(data) && data.length === 0) {
                                const localRaw = localStorage.getItem(getScopedKey(key, activeSlug));
                                if (localRaw && localRaw !== '[]' && localRaw !== '{}') {
                                    console.warn(`⚠️ [StudioContext] Keeping local data for ${key} (Cloud empty)`);
                                    return;
                                }
                            }
                            localStorage.setItem(getScopedKey(key, activeSlug), JSON.stringify(data));
                        }
                    });

                    const groupedAtt: Record<string, any[]> = {};
                    (unwrap(state.attendance) || []).forEach(a => {
                        if (!a.student_id) return;
                        if (!groupedAtt[a.student_id]) groupedAtt[a.student_id] = [];
                        groupedAtt[a.student_id].push(a);
                    });
                    localStorage.setItem(getScopedKey('cc_attendance_data', activeSlug), JSON.stringify(groupedAtt));

                    ['cc_groups_update', 'cc_halls_update', 'cc_student_update', 'cc_teacher_update', 
                     'cc_subscription_update', 'cc_checkin_update', 'cc_sales_update', 'cc_expense_update', 'cc_trash_update',
                     'cc_subscription_plans_update', 'cc_calendar_events_update', 'cc_attendance_update']
                        .forEach(e => window.dispatchEvent(new Event(e)));
                }
            } else {
                const { ensureStudioExists } = await import("@/lib/master-sync");
                await ensureStudioExists(activeSlug || "default", settings.studioName);
            }
        } catch (err) {
            console.error('❌ [StudioContext] Hydration failed:', err);
        } finally {
            setIsSyncing(false);
            setFirstSyncDone(true);
            setIsLoaded(true);
        }
    }, [profile?.org_id, profile?.studio_slug, firstSyncDone, settings.studioName, user, defaultSlug, userLoading]);

    useEffect(() => {
        hydrate();
        const interval = setInterval(() => hydrate(true), 300000);
        return () => clearInterval(interval);
    }, [hydrate]);

    const updateSettings = useCallback((updates: Partial<StudioSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...updates };
            import('@/lib/settings-store').then(mod => mod.saveSettings(updates, prev, prev.studioSlug));
            if (prev.studioSlug && prev.orgId) {
                const metadata = { ...next, settings: next };
                import('@/lib/master-sync').then(mod => {
                    mod.pushFullStudioMetadata(prev.studioSlug, updates.studioName || prev.studioName, metadata);
                });
            }
            return next;
        });
    }, []);

    // SETTERS FOR SETTINGS PAGE
    const setTheme = (key: any) => updateSettings({ themeKey: key });
    const setStudioName = (name: string) => updateSettings({ studioName: name });
    const setLogo = (url: string | null) => updateSettings({ logoDataUrl: url });
    const setNotification = (key: string, val: boolean) => updateSettings({ notifications: { ...settings.notifications, [key]: val } });
    const setSecurity = (key: string, val: any) => updateSettings({ security: { ...settings.security, [key]: val } });
    const setCurrency = (cur: string) => updateSettings({ currency: cur });
    const setLanguage = (lang: string) => updateSettings({ language: lang });
    const setTimezone = (tz: string) => updateSettings({ timezone: tz });
    const setGoogleCalendar = (id: string) => updateSettings({ googleCalendarId: id });
    const setPausePrice = (p: number) => updateSettings({ pausePrices: { ...settings.pausePrices, monthly: p } });
    const updateStaff = (id: string, data: any) => updateSettings({ staff: settings.staff?.map((s: any) => s.id === id ? { ...s, ...data } : s) });
    const removeStaff = (id: string) => updateSettings({ staff: settings.staff?.filter((s: any) => s.id !== id) });
    const addStaff = (member: any) => updateSettings({ staff: [...(settings.staff || []), member] });
    const removeBranch = (id: string) => updateSettings({ branches: settings.branches.filter(b => b.id !== id) });
    const updateBranch = (id: string, data: any) => updateSettings({ branches: settings.branches.map(b => b.id === id ? { ...b, ...data } : b) });
    const setCustomRoles = (roles: any) => updateSettings({ customRoles: roles });
    const setOwnerInfo = (info: any) => updateSettings({ owner_info: info });

    const setActiveBranch = useCallback((branchId: string) => {
        setSettings(prev => {
            const next = { ...prev, activeBranchId: branchId };
            setActiveBranchId(branchId);
            localStorage.setItem(`cc_active_branch_${prev.studioSlug}`, branchId);
            saveSettings({ activeBranchId: branchId }, prev, prev.studioSlug);
            window.dispatchEvent(new CustomEvent('cc_branch_change', { detail: { branchId } }));
            return next;
        });
    }, []);

    const addBranch = useCallback((name: string, address?: string) => {
        setSettings(prev => {
            const newBranch: Branch = { id: `br_${Date.now()}`, name, address, is_active: true };
            const next = { ...prev, branches: [...prev.branches, newBranch] };
            saveSettings({ branches: next.branches }, prev, prev.studioSlug);
            return next;
        });
    }, []);

    const refreshData = async () => {
        await hydrate();
    };

    return (
        <StudioContext.Provider value={{
            settings, updateSettings, isLoaded, loadingStep, firstSyncDone, isSyncing,
            activeBranchId, setActiveBranch, addBranch, refreshData,
            setTheme, setStudioName, setLogo, setNotification, setSecurity, setCurrency, setLanguage, setTimezone, setGoogleCalendar, setPausePrice, updateStaff, removeStaff, removeBranch, updateBranch, setCustomRoles, addStaff, setOwnerInfo, saveSettings
        }}>
            {children}
        </StudioContext.Provider>
    );
};

export const useStudio = () => {
    const context = useContext(StudioContext);
    if (context === undefined) throw new Error('useStudio must be used within a StudioProvider');
    return context;
};
