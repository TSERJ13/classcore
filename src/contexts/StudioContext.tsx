
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
    // Specific setters for settings page
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
    
    // Initialize settings, preferring props for new devices
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
    const [trash, setTrash] = useState<any[]>(loadSettings().trash || []);
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
    useEffect(() => {
        async function bootstrap() {
            let activeSlug = getActiveSlug() || defaultSlug;
            
            // EMERGENCY RECOVERY FOR stdancestudio
            if (!activeSlug || activeSlug === "subscriptions" || activeSlug === "settings") {
                const userEmail = profile?.email || (user as any)?.email;
                if (userEmail === "stdancegroup@gmail.com") {
                    console.log("🚨 [Emergency] Redirecting corrupted slug to stdancestudio");
                    activeSlug = "stdancestudio";
                    localStorage.setItem("cc_active_studio_slug", "stdancestudio");
                }
            }

            if (!activeSlug || ["auth", "login", "superadmin"].includes(activeSlug)) {
                setIsLoaded(true);
                return;
            }

            console.log('🚀 [MasterSync] Bootstrapping for slug:', activeSlug);

            // AVOID RE-FETCHING IF THIS SLUG WAS JUST SYNCED 
            // This prevents the "flicker" where local updates are overwritten by stale cloud data during the sync bounce back
            if (lastSyncedSlugRef.current === activeSlug && firstSyncDone) {
                return;
            }

            try {
                const { fetchFullStudioState, ensureStudioExists, pushCollectionToCloud } = await import("@/lib/master-sync");
                const targetOrgId = await ensureStudioExists(activeSlug || "default", settings.studioName);
                const localHallsRaw = localStorage.getItem(getScopedKey('cc_halls', activeSlug));
                
                if (targetOrgId) {
                    // 🛡️ UNLOCK RLS: Ensure current user profile is linked to this studio's OrgID
                    // This MUST happen BEFORE fetchFullStudioState to avoid empty results due to RLS
                    const { createClient } = await import("@/lib/supabase/client");
                    const sb = createClient();
                    const { data: { user } } = await sb.auth.getUser();
                    if (user) {
                        console.log('🛡️ [StudioProvider] Anchoring Identity to Org:', targetOrgId);
                        await sb.from('profiles').update({ org_id: targetOrgId }).eq('id', user.id);
                    }

                    // 🔽 Now fetch the state with the unlocked identity
                    const state = await fetchFullStudioState(activeSlug || "default", targetOrgId);
                    
                    if (state) {
                        // 🚨 UNIVERSAL CLOUD RESCUE: Only run once per slug per session
                        const rescueFlag = `cc_rescue_done_${activeSlug}`;
                        const rescueDone = localStorage.getItem(rescueFlag);
                        if (!rescueDone) {
                            const collectionsToRescue = [
                                { table: 'students', local: (await import("@/lib/student-store")).getStudents(), cloud: state.students },
                                { table: 'staff', local: (await import("@/lib/teacher-store")).getTeachers(), cloud: state.staff },
                                { table: 'groups', local: (await import("@/lib/group-store")).getGroups(), cloud: state.groups },
                                { table: 'halls', local: (await import("@/lib/hall-store")).getHalls(), cloud: state.halls },
                                { table: 'subscriptions', local: Object.values((await import("@/lib/subscription-store")).getSubscriptions()).flat(), cloud: state.subscriptions },
                                { table: 'sales', local: Object.values((await import("@/lib/sales-store")).getStudentSales("all") || {}).flat(), cloud: state.sales },
                                { table: 'calendar_events', local: (await import("@/lib/event-store")).getEvents(), cloud: state.calendar_events },
                                { table: 'attendance', local: Object.values((await import("@/lib/checkin-store")).getStudentCheckins("all")).flat(), cloud: state.attendance },
                                { table: 'subscription_plans', local: (await import("@/lib/plan-store")).getPlans(), cloud: state.subscription_plans }
                            ];

                            for (const col of collectionsToRescue) {
                                if (col.local.length > (col.cloud?.length || 0) && col.local.length > 0) {
                                    console.log(`🔼 [MasterSync] Rescuing ${col.local.length} ${col.table} to Cloud...`);
                                    await pushCollectionToCloud(col.table, col.local, targetOrgId);
                                }
                            }
                            localStorage.setItem(rescueFlag, Date.now().toString());
                        }

                        console.log('📦 [MasterSync] Hydrating collections...');
                        lastSyncedSlugRef.current = activeSlug;
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
                        
                        // 🔑 CRITICAL: Save orgId to localStorage FIRST so getScopedKey resolves correctly
                        const settingsKey = `cc_studio_settings_${activeSlug}`;
                        const existingRaw = localStorage.getItem(settingsKey);
                        let existing: any = {};
                        try { existing = existingRaw ? JSON.parse(existingRaw) : {}; } catch {}
                        existing.orgId = targetOrgId;
                        existing.studioSlug = activeSlug;
                        localStorage.setItem(settingsKey, JSON.stringify({ ...existing, ...updates }));
                        // Also set the override key for immediate resolution
                        localStorage.setItem(`cc_org_id_override_${activeSlug}`, targetOrgId);
                        localStorage.setItem(`cc_org_id_${activeSlug}`, targetOrgId);
                        
                        setSettings(prev => {
                            const next = { ...prev, ...updates, studioSlug: activeSlug };
                            saveSettings(updates, prev, activeSlug);
                            return next;
                        });

                        // 🚨 HYBRID RECOVERY: Deep search across all possible storage paths
                        let finalStudentsRaw = state.students || [];
                        if (finalStudentsRaw.length === 0) {
                            const backup = (state as any).settingsRecord?.data?.students || 
                                           (state as any).settingsRecord?.settings?.students ||
                                           (state as any).settingsRecord?.metadata?.students ||
                                           (state as any).studio?.settings?.students;
                            if (backup) finalStudentsRaw = Array.isArray(backup) ? backup : Object.values(backup);
                        }

                        let finalPlansRaw = state.subscription_plans || [];
                        if (finalPlansRaw.length === 0) {
                            const backup = (state as any).settingsRecord?.data?.subscription_plans || 
                                           (state as any).settingsRecord?.settings?.subscription_plans ||
                                           (state as any).settingsRecord?.data?.plans ||
                                           (state as any).settingsRecord?.settings?.plans;
                            if (backup) finalPlansRaw = Array.isArray(backup) ? backup : Object.values(backup);
                        }
                        // Normalize plans: fill missing fields with defaults
                        finalPlansRaw = finalPlansRaw.map((p: any) => {
                            const plan = p.data && typeof p.data === 'object' ? { ...p.data, ...p, data: undefined } : p;
                            return {
                                ...plan,
                                type: plan.type || 'group',
                                period: plan.period || (plan.session_count ? 'sessions' : 'monthly'),
                                is_active: plan.is_active !== undefined ? plan.is_active : true,
                            };
                        });

                        let finalSubsRaw = state.subscriptions || [];
                        if (finalSubsRaw.length === 0) {
                            const backup = (state as any).settingsRecord?.data?.subscriptions || 
                                           (state as any).settingsRecord?.settings?.subscriptions;
                            if (backup) finalSubsRaw = Array.isArray(backup) ? backup : Object.values(backup);
                        }

                        let finalHallsRaw = state.halls || [];
                        if (finalHallsRaw.length === 0) {
                            const backup = (state as any).settingsRecord?.data?.halls || 
                                           (state as any).settingsRecord?.settings?.halls;
                            if (backup) finalHallsRaw = Array.isArray(backup) ? backup : Object.values(backup);
                        }

                        const mapping: any = {
                            cc_teachers: unwrappedStaff,
                            cc_branches: state.branches,
                            cc_halls: (finalHallsRaw.length > 0) ? finalHallsRaw : JSON.parse(localHallsRaw || '[]'),
                            cc_groups: unwrap(state.groups),
                            cc_student_data: Array.isArray(finalStudentsRaw) 
                                ? finalStudentsRaw.reduce((acc: any, s: any) => {
                                    const student = { ...(s.data || {}), ...s, data: undefined };
                                    return { ...acc, [student.id]: student };
                                }, {})
                                : finalStudentsRaw,
                            cc_student_subscriptions: Array.isArray(finalSubsRaw)
                                ? finalSubsRaw.reduce((acc: any, sub: any) => {
                                    const sId = sub.student_id || (sub.data as any)?.student_id;
                                    if (sId) {
                                        if (!acc[sId]) acc[sId] = [];
                                        acc[sId].push({ ...(sub.data || {}), ...sub, data: undefined });
                                    }
                                    return acc;
                                }, {})
                                : finalSubsRaw,
                            cc_calendar_events: unwrap(state.calendar_events),
                            cc_subscription_plans: finalPlansRaw,
                            cc_shop_sales: Array.isArray(state.sales)
                                ? state.sales.reduce((acc: any, sale: any) => {
                                    const sId = sale.student_id;
                                    if (sId) {
                                        if (!acc[sId]) acc[sId] = [];
                                        acc[sId].push({ ...(sale.data || {}), ...sale, data: undefined });
                                    }
                                    return acc;
                                }, {})
                                : state.sales,
                            cc_expenses: (state.expenses?.length > 0) ? unwrap(state.expenses) : [],
                            cc_global_trash: (state.trash?.length > 0) ? unwrap(state.trash) : []
                        };

                        // 🚨 ATTENDANCE RECONSTRUCTION: Cluster cloud logs by date
                        if (Array.isArray(state.attendance) && state.attendance.length > 0) {
                            const attendanceByDate: Record<string, any> = {};
                            state.attendance.forEach((record: any) => {
                                // Extract date from either ISO string or date field
                                const dateStr = record.date || (record.data as any)?.date || new Date().toISOString().split('T')[0];
                                if (!attendanceByDate[dateStr]) attendanceByDate[dateStr] = {};
                                attendanceByDate[dateStr][record.student_id] = record.status || (record.data as any)?.status || 'present';
                            });

                            Object.keys(attendanceByDate).forEach(date => {
                                localStorage.setItem(`cc_checkins_${date}_${activeSlug}`, JSON.stringify(attendanceByDate[date]));
                            });
                        }

                        Object.entries(mapping).forEach(([key, data]) => {
                            const targetKey = getScopedKey(key, activeSlug);
                            localStorage.setItem(targetKey, JSON.stringify(data || (key === 'cc_student_data' ? {} : [])));
                        });

                        // Special handling for legacy checkins: Group by date
                        const attendance = unwrap(state.attendance);
                        const groupedAtt: Record<string, any[]> = {};
                        attendance.forEach(rec => {
                            if (!rec.date) return;
                            if (!groupedAtt[rec.date]) groupedAtt[rec.date] = [];
                            groupedAtt[rec.date].push(rec);
                        });
                        Object.entries(groupedAtt).forEach(([date, list]) => {
                            const attKey = getScopedKey(`cc_checkins_${date}`, activeSlug);
                            localStorage.setItem(attKey, JSON.stringify(list));
                        });

                        localStorage.setItem(`cc_last_sync_${activeSlug}`, Date.now().toString());
                        localStorage.setItem('cc_active_studio_slug', activeSlug);

                        ['cc_groups_update', 'cc_halls_update', 'cc_student_update', 'cc_teacher_update', 
                         'cc_subscription_update', 'cc_checkin_update', 'cc_sales_update', 'cc_expense_update', 'cc_trash_update',
                         'cc_subscription_plans_update']
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
    }, [isLoaded, user, profile]);

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
            const list = (prev.staff || []).map(s => s.id === id ? { ...s, ...updates } : s);
            const next = { ...prev, staff: list };
            
            setTimeout(async () => {
                const modStore = await import('@/lib/settings-store');
                modStore.saveSettings({ staff: list }, prev, prev.studioSlug);
                
                if (prev.orgId) {
                    const modSync = await import('@/lib/master-sync');
                    const member = list.find(s => s.id === id);
                    if (member) {
                        modSync.syncRecordToCloud('staff', {
                            id: member.id,
                            org_id: prev.orgId,
                            full_name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.full_name,
                            phone: member.phone || '',
                            data: member
                        }, prev.orgId);
                    }
                }
            }, 0);
            
            return next;
        });
    }, []);

    const removeStaff = useCallback((id: string) => {
        setSettings(prev => {
            const list = (prev.staff || []).filter(s => s.id !== id);
            const next = { ...prev, staff: list };
            setTimeout(async () => {
                const modStore = await import('@/lib/settings-store');
                modStore.saveSettings({ staff: list }, prev, prev.studioSlug);
                if (prev.orgId) {
                    const modSync = await import('@/lib/master-sync');
                    modSync.deleteRecordFromCloud('staff', id, prev.orgId);
                }
            }, 0);
            return next;
        });
    }, []);

    const addStaff = useCallback((member: any) => {
        const newId = member.id || `staff_${Math.random().toString(36).substr(2, 9)}`;
        const newMember = { ...member, id: newId };
        setSettings(prev => {
            const list = [...(prev.staff || []), newMember];
            const next = { ...prev, staff: list };
            setTimeout(async () => {
                const modStore = await import('@/lib/settings-store');
                modStore.saveSettings({ staff: list }, prev, prev.studioSlug);
                if (prev.orgId) {
                    const modSync = await import('@/lib/master-sync');
                    modSync.syncRecordToCloud('staff', {
                        id: newId,
                        org_id: prev.orgId,
                        full_name: `${newMember.first_name || ''} ${newMember.last_name || ''}`.trim() || newMember.full_name,
                        phone: newMember.phone || '',
                        data: newMember
                    }, prev.orgId);
                }
            }, 0);
            return next;
        });
    }, []);

    const addBranch = useCallback((branch: any) => {
        setSettings(prev => {
            const list = [...(prev.branches || []), branch];
            const next = { ...prev, branches: list };
            setTimeout(async () => {
                const modStore = await import('@/lib/settings-store');
                modStore.saveSettings({ branches: list }, prev, prev.studioSlug);
            }, 0);
            return next;
        });
    }, []);

    const removeBranch = useCallback((id: string) => {
        setSettings(prev => {
            const list = (prev.branches || []).filter(b => b.id !== id);
            const next = { ...prev, branches: list };
            setTimeout(async () => {
                const modStore = await import('@/lib/settings-store');
                modStore.saveSettings({ branches: list }, prev, prev.studioSlug);
            }, 0);
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
                setTimeout(async () => {
                    const modStore = await import('@/lib/settings-store');
                    modStore.saveSettings({ branches: list }, prev, prev.studioSlug);
                }, 0);
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
