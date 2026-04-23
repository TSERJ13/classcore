
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { loadSettings, saveSettings } from '@/lib/settings-store';
import { StudioSettings, SubscriptionLog } from '@/types/studio';
import { getActiveSlug, STORAGE_KEY, getScopedKey, markLocalUpdate } from '@/lib/utils';
import { ensureStudioExists, fetchFullStudioState, syncRecordToCloud } from '@/lib/master-sync';
import { createClient } from '@/lib/supabase/client';

interface StudioContextType {
    settings: StudioSettings;
    isLoaded: boolean;
    firstSyncDone: boolean;
    isSyncing: boolean;
    activeBranchId: string;
    setActiveBranchId: (id: string) => void;
    updateSettings: (updates: Partial<StudioSettings>) => void;
    addSubscriptionLog: (log: Omit<SubscriptionLog, 'id' | 'date'>) => void;
    setCustomRoles: (roles: string[]) => void;
    addToTrash: (item: any) => void;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<StudioSettings>(() => loadSettings());
    const [trash, setTrash] = useState<any[]>(loadSettings().trash || []);
    const [isLoaded, setIsLoaded] = useState(false);
    const [firstSyncDone, setFirstSyncDone] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [activeBranchId, setActiveBranchId] = useState('main');

    useEffect(() => {
        // We MUST run this even if settings.studioSlug is empty IF we are logged in
        async function bootstrap() {
            if (!isLoaded) return;
            
            const { data: { user } } = await createClient().auth.getUser();
            const activeSlug = settings.studioSlug || getActiveSlug();
            
            if (!activeSlug || ['superadmin'].includes(activeSlug)) {
                setFirstSyncDone(true);
                return;
            }

            setIsSyncing(true);
            try {
                let targetOrgId = await ensureStudioExists(activeSlug, settings.studioName);

                // 🦾 FORCE OVERRIDE for stdancegroup@gmail.com
                if (user?.email === 'stdancegroup@gmail.com' || (user as any)?.email_address === 'stdancegroup@gmail.com') {
                    console.log('🦾 [MasterSync] Enforcing Authoritative OrgID for stdancegroup: db04');
                    targetOrgId = '04fcd615-255c-4f6d-9444-50308118db04';
                }

                if (targetOrgId) {
                    localStorage.setItem(`cc_org_id_override_${activeSlug}`, targetOrgId);
                    
                    const state = await fetchFullStudioState(activeSlug, targetOrgId);
                    if (state) {
                        console.log('✅ [MasterSync] Hydrated state for Org:', state.org_id);
                        
                        const updates = {
                            orgId: targetOrgId,
                            studioName: state.studio?.studio_name || settings.studioName,
                            logo_url: (state as any).settingsRecord?.logo_url || state.studio?.settings?.logo_url || settings.logo_url,
                            staff: state.staff?.length > 0 ? state.staff : settings.staff,
                            branches: state.branches?.length > 0 ? state.branches : settings.branches
                        };
                        
                        setSettings(prev => {
                            const next = { ...prev, ...updates, studioSlug: activeSlug };
                            saveSettings(updates, prev, activeSlug);
                            return next;
                        });

                        const mapping: any = {
                            cc_teachers: state.staff,
                            cc_branches: state.branches,
                            cc_halls: state.halls,
                            cc_groups: state.groups,
                            cc_student_data: Array.isArray(state.students) 
                                ? state.students.reduce((acc: any, s: any) => ({ ...acc, [s.id]: s }), {})
                                : state.students,
                            cc_subscriptions: state.subscriptions,
                            cc_checkins: state.attendance,
                            cc_sales: state.sales,
                            cc_expenses: state.expenses,
                            cc_trash: state.trash
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
    }, [isLoaded, settings.studioSlug]);

    useEffect(() => {
        const defaultSlug = getActiveSlug();
        const local = loadSettings(defaultSlug || undefined);
        setSettings(local);
        setTrash(local.trash || []);
        setIsLoaded(true);
    }, []);

    const updateSettings = useCallback((updates: Partial<StudioSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...updates };
            const saved = saveSettings(updates, prev, prev.studioSlug);
            
            if (prev.studioSlug && prev.orgId) {
                const name = updates.studioName || prev.studioName;
                const metadata = { 
                    logo_url: next.logo_url,
                    theme: (next as any).theme,
                    group_colors: (next as any).group_colors 
                };
                import('@/lib/master-sync').then(mod => {
                    mod.pushFullStudioMetadata(prev.studioSlug, name, metadata);
                    if (updates.logo_url || updates.group_colors) {
                        mod.syncRecordToCloud('studio_settings', { 
                            org_id: prev.orgId, 
                            logo_url: next.logo_url,
                            group_colors: (next as any).group_colors
                        }, prev.orgId);
                    }
                });
            }
            return saved;
        });
    }, []);

    const addToTrash = useCallback((item: any) => {
        setTrash(prev => {
            const next = [item, ...prev].slice(0, 50);
            saveSettings({ trash: next } as any, settings, settings.studioSlug);
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
            return saveSettings({ subscriptionLogs }, prev, prev.studioSlug);
        });
    }, [activeBranchId]);

    const setCustomRoles = useCallback((roles: string[]) => {
        setSettings(prev => saveSettings({ customRoles: roles }, prev, prev.studioSlug));
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
