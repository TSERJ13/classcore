
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
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<StudioSettings>(() => loadSettings());
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
                // 1. Establish Cloud Anchor
                const orgId = await ensureStudioExists(activeSlug, settings.studioName);
                if (orgId) {
                    console.log('🛰️ [MasterSync] Cloud Anchor Established:', orgId);
                    localStorage.setItem(`cc_org_id_override_${activeSlug}`, orgId);
                    
                    // 2. Fetch Latest Cloud State
                    const state = await fetchFullStudioState(activeSlug, orgId);
                    if (state) {
                        console.log('✅ [MasterSync] Cloud state hydrated.');
                        
                        // Update local settings atom
                        setSettings(prev => ({
                            ...prev,
                            orgId,
                            staff: state.staff?.length > 0 ? state.staff : prev.staff,
                            branches: state.branches?.length > 0 ? state.branches : prev.branches
                        }));

                        // Force persist scoped collections
                        const mapping: any = {
                            cc_teachers: state.staff,
                            cc_branches: state.branches,
                            cc_halls: state.halls,
                            cc_groups: state.groups,
                            cc_student_data: state.students
                        };

                        Object.entries(mapping).forEach(([key, data]) => {
                            if (Array.isArray(data) && data.length > 0) {
                                localStorage.setItem(getScopedKey(key, activeSlug), JSON.stringify(data));
                            }
                        });

                        // Notify UI
                        ['cc_groups_update', 'cc_halls_update', 'cc_student_update', 'cc_teacher_update']
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

    // Initial hydration from local storage
    useEffect(() => {
        const defaultSlug = getActiveSlug();
        const local = loadSettings(defaultSlug || undefined);
        setSettings(local);
        setIsLoaded(true);
    }, []);

    const updateSettings = useCallback((updates: Partial<StudioSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...updates };
            return saveSettings(updates, prev, prev.studioSlug);
        });
    }, []);

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
            setCustomRoles
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
