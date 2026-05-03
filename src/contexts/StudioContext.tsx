'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { loadSettings, saveSettings } from '@/lib/settings-store';
import { useUser } from '@/hooks/useUser';
import { getActiveSlug, getScopedKey, safeSetItem } from '@/lib/utils';
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
    const isHydratingRef = useRef(false);
    const hydrate = useCallback(async (isAuto = false) => {
        if (isHydratingRef.current && !isAuto) return;
        
        let activeSlug = getActiveSlug() || defaultSlug || profile?.studio_slug;
        
        // 🔒 AUTH CHECK: Wait for user if we don't have a slug yet
        if (userLoading && !activeSlug) return;

        // 🛡️ RECOVERY: If no slug found, try to recover from profile or identity
        if (!activeSlug || ["auth", "login", "superadmin", "subscriptions", "settings", "dashboard"].includes(activeSlug)) {
             if (profile && profile.studio_slug) {
                 activeSlug = profile.studio_slug;
             } else if (user && !userLoading) {
                 const identitySlug = (user as any).user_metadata?.studio_slug;
                 if (identitySlug) activeSlug = identitySlug;
             }
        }

        if (!activeSlug && !userLoading) {
            console.warn('⚠️ [StudioContext] No slug resolved.');
            setIsLoaded(true); 
            return;
        }

        try {
            if (!isAuto) {
                setIsSyncing(true);
                isHydratingRef.current = true;
            }
            const { createClient } = await import("@/lib/supabase/client");
            const sb = createClient();
            const { data: { session } } = await sb.auth.getSession();
            const token = session?.access_token;
            
            setLoadingStep('სერვერთან დაკავშირება...'); 
            const { fetchFullStudioState } = await import("@/lib/master-sync");

            // 🚀 NUCLEAR DISCOVERY: If orgId is missing, resolve it from the database first
            let currentOrgId = activeOrgId;
            if (!currentOrgId && activeSlug) {
                console.log(`🔍 [StudioContext] OrgID missing. Starting Nuclear Discovery for slug: ${activeSlug}`);
                const { data: studioData } = await sb.from('studios').select('org_id').eq('studio_slug', activeSlug).maybeSingle();
                if (studioData?.org_id) {
                    currentOrgId = studioData.org_id;
                    localStorage.setItem(`cc_org_id_override_${activeSlug}`, currentOrgId);
                    console.log(`✅ [StudioContext] OrgID Resolved via Discovery: ${currentOrgId}`);
                }
            }

            const state = await fetchFullStudioState(activeSlug || "default", currentOrgId, token);
                    
            if (state) {
                const resolvedOrgId = state.org_id || currentOrgId;
                console.log(`📊 [StudioContext] Hydration State Received. OrgID: ${resolvedOrgId}`);

                // 🔐 PERMANENT ORG-ID RESOLUTION (MUST HAPPEN FIRST)
                if (resolvedOrgId && activeSlug) {
                    const orgIdOverrideKey = `cc_org_id_override_${activeSlug}`;
                    localStorage.setItem(orgIdOverrideKey, resolvedOrgId);
                    
                    // Update Registry
                    const registryRaw = localStorage.getItem('cc_studios_list');
                    let registry = registryRaw ? JSON.parse(registryRaw) : [];
                    if (!registry.includes(activeSlug)) {
                        registry.push(activeSlug);
                        localStorage.setItem('cc_studios_list', JSON.stringify(registry));
                    }
                }

                setLoadingStep('მონაცემების სინქრონიზაცია...');
                const cloudSettings = state.settingsRecord?.staff_data || state.settingsRecord?.settings || {};
                const updates = state.studio || {};
                
                // 🚀 SCORCHED EARTH v1.1.16: Force correct name casing for identity
                const finalName = activeSlug === 'stdancestudio' ? 'S_T Dance Studio' : (updates.studio_name || cloudSettings.studioName || settings.studioName);

                // 💎 PLAN RESOLUTION: Admin plan from studios table MUST override everything
                const finalPlan = updates.plan || cloudSettings.plan || settings.plan;

                // 🖼️ LOGO RESOLUTION: 🛡️ PRESERVE LOCAL LOGO IF CLOUD IS EMPTY (Prevent ghosting)
                const localLogo = settings.logoDataUrl;
                const rawCloudLogo = cloudSettings.logoDataUrl || updates.logo_url;
                const cloudLogo = rawCloudLogo === 'BASE64_BLOB' ? null : rawCloudLogo;
                const finalLogo = cloudLogo || localLogo;

                if (cloudLogo) {
                    console.log(`🖼️ [StudioContext] Logo hydrated from Cloud: ${cloudLogo.startsWith('data:') ? 'BASE64' : 'URL'}`);
                } else if (localLogo) {
                    console.log(`🖼️ [StudioContext] Logo preserved from Local (Cloud was empty)`);
                    // 🚀 SCORCHED EARTH v4.5: Auto-heal cloud state if logo is missing but exists locally
                    const { pushFullStudioMetadata } = await import('@/lib/master-sync');
                    pushFullStudioMetadata(activeSlug, settings.studioName, { ...settings, logoDataUrl: localLogo });
                }

                console.log(`✅ [StudioContext] Identity Resolved: ${activeSlug} (Org: ${resolvedOrgId})`);
                console.log(`💎 [StudioContext] Plan: ${finalPlan} (Master: ${updates.plan}, Blob: ${cloudSettings.plan})`);

                const unwrap = (arr: any) => {
                    if (!Array.isArray(arr)) return [];
                    return arr.map(i => i?.data || i);
                };
                const allDeleted = new Set((state.trash || []).map((t: any) => t?.entity_id || t?.id).filter(Boolean));

                const resolveRicher = (db: any[], backup: any) => {
                    const dbArr = Array.isArray(db) ? db : [];
                    const backupArr = Array.isArray(backup) ? backup : Object.values(backup || {});
                    if (dbArr.length === 0) return backupArr;
                    const merged = dbArr.map(item => ({ ...item, ...(backupArr.find((b: any) => b.id === item.id) || {}) }));
                    backupArr.forEach(b => { if (!merged.find(m => m.id === b.id)) merged.push(b); });
                    return merged;
                };

                const finalStaff = resolveRicher(state.staff, cloudSettings.staff || settings.staff);
                const finalHalls = resolveRicher(state.halls, cloudSettings.halls || cloudSettings.data?.halls);
                const finalPlans = resolveRicher(state.subscription_plans, cloudSettings.subscription_plans || cloudSettings.plans);
                const finalGroups = resolveRicher(state.groups, cloudSettings.groups || cloudSettings.data?.groups);
                const finalEvents = resolveRicher(state.calendar_events, cloudSettings.calendar_events || cloudSettings.data?.events);
                
                setLoadingStep('ინტერფეისის მომზადება...');

                setSettings(prev => {
                    const name = updates.studio_name || cloudSettings.studioName || prev.studioName;
                    const next = {
                        ...prev, ...cloudSettings,
                        orgId: resolvedOrgId, studioName: finalName, logoDataUrl: finalLogo,
                        staff: unwrap(finalStaff),
                        branches: (state.branches && state.branches.length > 0) ? state.branches : (cloudSettings.branches || prev.branches),
                        plan: finalPlan,
                        subscription_plans: finalPlans,
                        pausePrices: cloudSettings.pausePrices || prev.pausePrices,
                        currency: cloudSettings.currency || prev.currency,
                        language: cloudSettings.language || prev.language,
                        studioSlug: activeSlug || prev.studioSlug
                    };
                    saveSettings(next, prev, activeSlug || prev.studioSlug);
                    return next;
                });

                // 🚀 SCORCHED EARTH v1.1.16: Unified Atomic Hydration
                const mapping: any = {
                    cc_teachers: unwrap(finalStaff),
                    cc_branches: state.branches || [],
                    cc_halls: unwrap(finalHalls),
                    cc_groups: unwrap(finalGroups),
                    cc_student_data: (unwrap(state.students) || []).reduce((acc: any, s: any) => ({ ...acc, [s.id]: s }), {}),
                    cc_student_subscriptions: (unwrap(state.subscriptions) || [])
                        .filter(sub => !allDeleted.has(sub.id) && !allDeleted.has(`sub_${sub.id}`))
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
                    cc_global_trash: unwrap(state.trash),
                    cc_sa_meta: { plan: finalPlan, manualBlock: !!updates.manual_block, suspended: !!updates.suspended }
                };

                if (typeof window !== 'undefined') {
                    localStorage.setItem('cc_active_studio_slug', activeSlug || 'default');

                    Object.entries(mapping).forEach(([key, data]) => {
                        if (data !== null && data !== undefined) {
                            safeSetItem(getScopedKey(key, activeSlug || 'default'), JSON.stringify(data), activeSlug || 'default');
                        }
                    });

                    // Attendance mapping
                    const groupedAtt: Record<string, any[]> = {};
                    (unwrap(state.attendance) || []).forEach(a => {
                        if (!a.student_id) return;
                        if (!groupedAtt[a.student_id]) groupedAtt[a.student_id] = [];
                        groupedAtt[a.student_id].push(a);
                    });
                    safeSetItem(getScopedKey('cc_attendance_data', activeSlug), JSON.stringify(groupedAtt), activeSlug);

                    window.dispatchEvent(new Event('cc_data_hydrated'));
                    window.dispatchEvent(new Event('cc_settings_update'));
                    window.dispatchEvent(new Event('cc_sa_meta_update'));
                    window.dispatchEvent(new Event('cc_calendar_events_update'));
                    window.dispatchEvent(new Event('cc_student_update'));
                    window.dispatchEvent(new Event('cc_teacher_update'));
                    window.dispatchEvent(new Event('cc_groups_update'));
                    window.dispatchEvent(new Event('cc_halls_update'));
                    
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
            isHydratingRef.current = false;
            setFirstSyncDone(true);
            setIsLoaded(true);
        }
    }, [defaultSlug, userLoading]);

    // 🚀 Targeted Hydration Trigger
    const lastUserRef = useRef<string | null>(null);
    const lastSlugRef = useRef<string | null>(null);

    useEffect(() => {
        const currentUserId = user?.id || null;
        const currentSlug = profile?.studio_slug || null;

        if (currentUserId !== lastUserRef.current || currentSlug !== lastSlugRef.current) {
            console.log('🚀 [ClassCore] System Initializing (v1.1.10)...');
            lastUserRef.current = currentUserId;
            lastSlugRef.current = currentSlug;
            hydrate();
        }
    }, [user?.id, profile?.studio_slug, hydrate]);

    useEffect(() => {
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
    
    const setLogo = async (url: string | null) => {
        if (url && url.startsWith('data:image/')) {
            // 🚀 SCORCHED EARTH v4.3: Compress high-res logos to prevent sync failure
            try {
                const img = new Image();
                img.src = url;
                await new Promise((res) => (img.onload = res));
                
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 300; // 🚀 Even smaller for guaranteed sync
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                
                // Compress to JPEG for smaller size
                const compressed = canvas.toDataURL('image/jpeg', 0.5);
                console.log(`🖼️ [StudioContext] Logo Compressed: ${Math.round(compressed.length/1024)}KB`);
                updateSettings({ logoDataUrl: compressed });
            } catch (e) {
                console.error('Logo compression failed:', e);
                updateSettings({ logoDataUrl: url });
            }
        } else {
            updateSettings({ logoDataUrl: url });
        }
    };
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
            safeSetItem(`cc_active_branch_${prev.studioSlug}`, branchId, prev.studioSlug);
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
