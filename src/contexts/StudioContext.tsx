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
            const metadataPromise = sb.from('studios').select('*').eq('studio_slug', activeSlug).maybeSingle();

            const { data: studioRecord } = await metadataPromise;
            
            if (studioRecord) {
                setSettings(prev => {
                    const next = {
                        ...prev,
                        orgId: studioRecord.org_id,
                        studioName: studioRecord.studio_name || prev.studioName,
                        logoDataUrl: studioRecord.logo_url || (studioRecord.settings as any)?.logoDataUrl || prev.logoDataUrl,
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
                    console.log('📊 [StudioContext] Cloud State Received:', { 
                        events: state.calendar_events?.length, 
                        students: state.students?.length,
                        orgId: targetOrgId
                    });

                    const cloudSettings = state.settingsRecord?.settings || {};
                    const unwrap = (arr: any) => Array.isArray(arr) ? arr.map(i => i.data || i) : null;
                    const allDeleted = new Set((state.trash || []).map((t: any) => t.entity_id || t.id));

                    const resolveRicher = (db: any[], backup: any) => {
                        const dbArr = Array.isArray(db) ? db : [];
                        const backupArr = Array.isArray(backup) ? backup : Object.values(backup || {});
                        if (dbArr.length === 0) return backupArr;
                        const merged = dbArr.map(item => ({ ...item, ...(backupArr.find((b: any) => b.id === item.id) || {}) }));
                        backupArr.forEach(b => { if (!merged.find(m => m.id === b.id)) merged.push(b); });
                        return merged;
                    };

                    const finalHalls = resolveRicher(state.halls, cloudSettings.halls || cloudSettings.data?.halls);
                    const finalPlans = resolveRicher(state.subscription_plans, cloudSettings.subscription_plans || cloudSettings.plans);
                    
                    setLoadingStep('ინტერფეისის მომზადება...');

                    setSettings(prev => {
                        const updates = state.studio || {};
                        const logo = updates.logo_url || cloudSettings.logoDataUrl || prev.logoDataUrl;
                        const name = updates.studio_name || cloudSettings.studioName || prev.studioName;

                        console.log('🎨 [StudioContext] Updating Metadata:', { name, logo: logo ? 'EXISTS' : 'EMPTY' });

                        const next = {
                            ...prev,
                            ...cloudSettings,
                            orgId: targetOrgId,
                            studioName: name,
                            logoDataUrl: logo,
                            staff: (state.staff && state.staff.length > 0) ? unwrap(state.staff) : (cloudSettings.staff || prev.staff),
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
                        cc_teachers: unwrap(state.staff),
                        cc_branches: state.branches,
                        cc_halls: finalHalls,
                        cc_groups: unwrap(state.groups),
                        cc_student_data: (unwrap(state.students) || []).reduce((acc: any, s: any) => ({ ...acc, [s.id]: s }), {}),
                        cc_student_subscriptions: (unwrap(state.subscriptions) || [])
                            .filter(sub => !allDeleted.has(sub.id))
                            .reduce((acc: any, sub: any) => {
                                const sId = sub.student_id;
                                if (sId) { if (!acc[sId]) acc[sId] = []; acc[sId].push(sub); }
                                return acc;
                            }, {}),
                        cc_calendar_events: unwrap(state.calendar_events),
                        cc_subscription_plans: finalPlans,
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
                                    console.warn(`⚠️ [StudioContext] Preservation: Keeping local data for ${key} (Cloud empty)`);
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
            activeBranchId, setActiveBranch, addBranch, refreshData
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
