
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { loadSettings, saveSettings } from '@/lib/settings-store';
import { StudioSettings, SubscriptionLog } from '@/types/studio';
import { getActiveSlug, STORAGE_KEY, getScopedKey, markLocalUpdate } from '@/lib/utils';
import { ensureStudioExists, fetchFullStudioState, syncRecordToCloud } from '@/lib/master-sync';

interface StudioContextType {
    settings: StudioSettings;
    isLoaded: boolean;
    firstSyncDone: boolean;
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
    const [activeBranchId, setActiveBranchId] = useState('main');

    // 🚀 MASTER SYNC: Guaranteed Bootstrap & Hydration
    useEffect(() => {
        if (!isLoaded || !settings.studioSlug || ['demo.classcore.ge', 'superadmin'].includes(settings.studioSlug)) {
            setFirstSyncDone(true);
            return;
        }

        const activeSlug = settings.studioSlug;
        
        async function bootstrap() {
            try {
                const orgId = await ensureStudioExists(activeSlug, settings.studioName);
                if (orgId) {
                    console.log('🛰️ [MasterSync] Cloud Anchor Established:', orgId);
                    localStorage.setItem(`cc_org_id_override_${activeSlug}`, orgId);
                    
                    const state = await fetchFullStudioState(activeSlug, orgId);
                    if (state) {
                        console.log('✅ [MasterSync] Cloud state hydrated.');
                        
                        const updates = {
                            orgId,
                            studioName: state.studio?.studio_name || settings.studioName,
                            logo_url: state.studio?.settings?.logo_url || state.settingsRecord?.logo_url || settings.logo_url,
                            staff: state.staff?.length > 0 ? state.staff : settings.staff,
                            branches: state.branches?.length > 0 ? state.branches : settings.branches
                        };
                        
                        setSettings(prev => {
                            const next = { ...prev, ...updates };
                            saveSettings(updates, prev, activeSlug);
                            return next;
                        });

                        // Force persist scoped collections (ABSOLUTELY EVERYTHING)
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
                            if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
                                localStorage.setItem(getScopedKey(key, activeSlug), JSON.stringify(data));
                            }
                        });

                        // Notify UI
                        ['cc_groups_update', 'cc_halls_update', 'cc_student_update', 'cc_teacher_update', 
                         'cc_subscription_update', 'cc_checkin_update', 'cc_sales_update', 'cc_expense_update', 'cc_trash_update']
                            .forEach(e => window.dispatchEvent(new CustomEvent(e, { detail: { isRemote: true } })));
                    }
                }
            } catch (err) {
                console.error('❌ [MasterSync] Bootstrap failed:', err);
            } finally {
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
            
            // 🔥 CLOUD SYNC: Broadcast branding changes
            if (prev.studioSlug && prev.orgId) {
                const name = updates.studioName || prev.studioName;
                const metadata = { 
                    logo_url: next.logo_url,
                    theme: (next as any).theme,
                    group_colors: (next as any).group_colors 
                };
                import('@/lib/master-sync').then(mod => {
                    mod.pushFullStudioMetadata(prev.studioSlug, name, metadata);
                    // Also update studio_settings table for logo
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
