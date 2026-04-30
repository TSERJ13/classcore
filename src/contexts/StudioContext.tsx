
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
    
    const [settings, setSettings] = useState<StudioSettings>(() => {
        const base = loadSettings(defaultSlug || undefined);
        if (defaultStudioName && !base.studioName) base.studioName = defaultStudioName;
        if (defaultSlug && !base.studioSlug) base.studioSlug = defaultSlug;
        return base;
    });
    const [trash, setTrash] = useState<any[]>(loadSettings().trash || []);
    // ⚡️ INSTANT LOAD: Set isLoaded to true if we have local data/slug, don't wait for cloud
    const [isLoaded, setIsLoaded] = useState(() => {
        if (typeof window === 'undefined') return false;
        return !!getActiveSlug() || !!defaultSlug;
    });
    const [firstSyncDone, setFirstSyncDone] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [activeBranchId, setActiveBranchId] = useState('main');

    const lastSyncedSlugRef = useRef<string | null>(null);

    const hydrate = useCallback(async (isAuto = false) => {
        let activeSlug = getActiveSlug() || defaultSlug;
        
        // Skip hydration on system routes
        if (!activeSlug || ["auth", "login", "superadmin", "subscriptions", "settings"].includes(activeSlug)) {
            if (user && profile?.org_id) {
                const { createClient } = await import("@/lib/supabase/client");
                const sb = createClient();
                const { data: studioRow } = await sb.from('studios').select('studio_slug').eq('org_id', profile.org_id).maybeSingle();
                if (studioRow?.studio_slug) {
                    activeSlug = studioRow.studio_slug;
                    localStorage.setItem('cc_active_studio_slug', activeSlug);
                } else {
                    setIsLoaded(true);
                    return;
                }
            } else {
                setIsLoaded(true);
                return;
            }
        }

        // Throttle background syncs
        if (lastSyncedSlugRef.current === activeSlug && firstSyncDone && !isAuto) return;

        // ⚡️ SILENT HYDRATION: Don't show loaders for auto-syncs
        if (!isAuto && !isLoaded) setIsSyncing(true);
        console.log('🚀 [MasterSync] Hydrating Studio State (Speed Optimized)...', { slug: activeSlug });

        try {
            const { fetchFullStudioState, ensureStudioExists } = await import("@/lib/master-sync");
            
            // 🔑 PRIORITY 1: Resolve OrgID from slug (The most authoritative way)
            const { createClient } = await import("@/lib/supabase/client");
            const sb = createClient();
            const { data: studioRecord } = await sb.from('studios').select('org_id').eq('studio_slug', activeSlug).maybeSingle();
            
            const targetOrgId = studioRecord?.org_id || profile?.org_id || await ensureStudioExists(activeSlug || "default", settings.studioName);
            
            if (targetOrgId) {
                // Ensure profile is anchored to the correct OrgID for RLS
                const { data: { user: authUser } } = await sb.auth.getUser();
                if (authUser && profile?.org_id !== targetOrgId) {
                    console.log('🛡️ [MasterSync] Anchoring Profile to Org:', targetOrgId);
                    await sb.from('profiles').update({ org_id: targetOrgId }).eq('id', authUser.id);
                }

                const state = await fetchFullStudioState(activeSlug || "default", targetOrgId);
                if (state) {
                    lastSyncedSlugRef.current = activeSlug;
                    const unwrap = (arr: any[]) => (arr || []).map(item => ({ ...item, ...(item.data || {}), data: undefined }));
                    
                    const cloudSettings = state.studio?.settings || state.settingsRecord?.settings || {};
                    
                    // Faster merge for Plans & Halls
                    const resolveRicher = (db: any[], backup: any) => {
                        const backupArr = Array.isArray(backup) ? backup : Object.values(backup || {});
                        if (db.length === 0) return backupArr;
                        const merged = db.map(item => ({ ...item, ...(backupArr.find((b: any) => b.id === item.id) || {}) }));
                        backupArr.forEach(b => { if (!merged.find(m => m.id === b.id)) merged.push(b); });
                        return merged;
                    };

                    const finalHalls = resolveRicher(state.halls || [], cloudSettings.halls || cloudSettings.data?.halls);
                    const finalPlans = resolveRicher(state.subscription_plans || [], cloudSettings.subscription_plans || cloudSettings.plans);

                    const updates = {
                        orgId: targetOrgId,
                        studioName: state.studio?.studio_name || cloudSettings.studioName || settings.studioName,
                        logoDataUrl: cloudSettings.logoDataUrl || state.studio?.logo_url || settings.logoDataUrl,
                        staff: state.staff?.length > 0 ? unwrap(state.staff) : (cloudSettings.staff || settings.staff),
                        branches: state.branches?.length > 0 ? state.branches : (cloudSettings.branches || settings.branches),
                        plan: state.studio?.plan || cloudSettings.plan || settings.plan,
                        subscription_plans: finalPlans,
                        pausePrices: cloudSettings.pausePrices || settings.pausePrices,
                        currency: cloudSettings.currency || settings.currency,
                        language: cloudSettings.language || settings.language,
                        sms_templates: cloudSettings.sms_templates || settings.sms_templates,
                    };

                    const settingsKey = `cc_studio_settings_${activeSlug}`;
                    const mergedSettings = { ...loadSettings(activeSlug), ...cloudSettings, ...updates };
                    
                    // ⚡️ BATCHED UPDATES: Minimize renders
                    localStorage.setItem(settingsKey, JSON.stringify(mergedSettings));
                    localStorage.setItem(`cc_org_id_${activeSlug}`, targetOrgId);

                    setSettings(prev => {
                        const next = { ...prev, ...mergedSettings, studioSlug: activeSlug };
                        saveSettings(mergedSettings, prev, activeSlug);
                        return next;
                    });

                    // Update Collections
                    const mapping: any = {
                        cc_teachers: unwrap(state.staff),
                        cc_branches: state.branches,
                        cc_halls: finalHalls,
                        cc_groups: unwrap(state.groups),
                        cc_student_data: (unwrap(state.students)).reduce((acc: any, s: any) => ({ ...acc, [s.id]: s }), {}),
                        cc_student_subscriptions: (unwrap(state.subscriptions)).reduce((acc: any, sub: any) => {
                            const sId = sub.student_id;
                            if (sId) { if (!acc[sId]) acc[sId] = []; acc[sId].push(sub); }
                            return acc;
                        }, {}),
                        cc_calendar_events: unwrap(state.calendar_events),
                        cc_subscription_plans: finalPlans,
                        cc_shop_sales: (unwrap(state.sales)).reduce((acc: any, sale: any) => {
                            const sId = sale.student_id;
                            if (sId) { if (!acc[sId]) acc[sId] = []; acc[sId].push(sale); }
                            return acc;
                        }, {}),
                        cc_expenses: unwrap(state.expenses),
                        cc_global_trash: unwrap(state.trash)
                    };

                    Object.entries(mapping).forEach(([key, data]) => {
                        localStorage.setItem(getScopedKey(key, activeSlug), JSON.stringify(data));
                    });

                    // Attendance
                    const groupedAtt: Record<string, any[]> = {};
                    (unwrap(state.attendance)).forEach(rec => {
                        const dateStr = rec.date || new Date().toISOString().split('T')[0];
                        if (!groupedAtt[dateStr]) groupedAtt[dateStr] = [];
                        groupedAtt[dateStr].push(rec);
                    });
                    Object.entries(groupedAtt).forEach(([date, list]) => {
                        localStorage.setItem(getScopedKey(`cc_checkins_${date}`, activeSlug), JSON.stringify(list));
                    });

                    // 🔥 DISPATCH ALL EVENTS MIGHTILY
                    ['cc_groups_update', 'cc_halls_update', 'cc_student_update', 'cc_teacher_update', 
                     'cc_subscription_update', 'cc_checkin_update', 'cc_sales_update', 'cc_expense_update', 'cc_trash_update',
                     'cc_subscription_plans_update', 'cc_calendar_events_update', 'cc_attendance_update']
                        .forEach(e => window.dispatchEvent(new CustomEvent(e, { detail: { isRemote: true } })));
                }
            }
        } catch (err) {
            console.error('❌ [MasterSync] Hydration failed:', err);
        } finally {
            setIsSyncing(false);
            setFirstSyncDone(true);
            setIsLoaded(true);
        }
    }, [profile?.org_id, firstSyncDone, settings.studioName, user, defaultSlug, isLoaded]);

    useEffect(() => {
        hydrate();
        const bc = typeof window !== 'undefined' ? new BroadcastChannel('cc_studio_sync') : null;
        if (bc) {
            bc.onmessage = (msg) => {
                if (msg.data?.type === 'RELOAD' && msg.data?.slug === getActiveSlug()) hydrate(true);
            };
        }
        const handleFocus = () => {
            const activeSlug = getActiveSlug();
            const lastSync = parseInt(localStorage.getItem(`cc_last_focus_sync_${activeSlug}`) || '0');
            // Auto-sync every 30 seconds on focus
            if (Date.now() - lastSync > 30000) {
                localStorage.setItem(`cc_last_focus_sync_${activeSlug}`, Date.now().toString());
                hydrate(true);
            }
        };
        window.addEventListener('focus', handleFocus);
        return () => { if (bc) bc.close(); window.removeEventListener('focus', handleFocus); };
    }, [hydrate]);

    // Secondary load to ensure local state is synced if slug changed
    useEffect(() => {
        const currentSlug = getActiveSlug();
        if (currentSlug && currentSlug !== settings.studioSlug) {
            const local = loadSettings(currentSlug);
            setSettings(local);
            setTrash(local.trash || []);
            setIsLoaded(true);
        }
    }, [settings.studioSlug]);

    const updateSettings = useCallback((updates: Partial<StudioSettings>) => {
        if ('studioSlug' in updates) delete updates.studioSlug;
        if (Object.keys(updates).length === 0) return;

        setSettings(prev => {
            const next = { ...prev, ...updates };
            import('@/lib/settings-store').then(mod => mod.saveSettings(updates, prev, prev.studioSlug));
            
            if (prev.studioSlug && prev.orgId) {
                const name = updates.studioName || prev.studioName;
                const metadata = { ...next, settings: next };
                import('@/lib/master-sync').then(mod => {
                    mod.pushFullStudioMetadata(prev.studioSlug, name, metadata);
                    if (typeof window !== 'undefined') {
                        const bc = new BroadcastChannel('cc_studio_sync');
                        bc.postMessage({ type: 'RELOAD', slug: prev.studioSlug });
                        bc.close();
                    }
                });
            }
            return next;
        });
    }, []);

    // Specific Setters
    const setLogo = (url: string | null) => updateSettings({ logoDataUrl: url });
    const setTheme = (key: ThemeKey) => updateSettings({ themeKey: key });
    const setStudioName = (name: string) => updateSettings({ studioName: name });
    const setNotification = (key: keyof StudioSettings['notifications'], val: boolean) => updateSettings({ notifications: { ...settings.notifications, [key]: val } });
    const setSecurity = (key: keyof StudioSettings['security'], val: any) => updateSettings({ security: { ...settings.security, [key]: val } });
    const setCurrency = (c: 'GEL' | 'USD' | 'EUR') => updateSettings({ currency: c });
    const setLanguage = (l: 'ka' | 'ru' | 'en') => updateSettings({ language: l });
    const setTimezone = (tz: string) => updateSettings({ timezone: tz });
    const setGoogleCalendar = (enabled: boolean) => updateSettings({ googleCalendarEnabled: enabled });
    const setPausePrice = (days: string, price: number) => updateSettings({ pausePrices: { ...settings.pausePrices, [days]: price } });
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
                    if (member) modSync.syncRecordToCloud('staff', { id: member.id, org_id: prev.orgId, full_name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.full_name, phone: member.phone || '', data: member }, prev.orgId);
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
                    modSync.syncRecordToCloud('staff', { id: newId, org_id: prev.orgId, full_name: `${newMember.first_name || ''} ${newMember.last_name || ''}`.trim() || newMember.full_name, phone: newMember.phone || '', data: newMember }, prev.orgId);
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
            subscriptionLogs.unshift({ ...log, id: crypto.randomUUID(), date: new Date().toISOString(), studentName: log.studentName, branchId: (log.branchId || activeBranchId || 'main') as string, branchName: (log.branchName || prev.branches.find(b => b.id === (log.branchId || activeBranchId))?.name || 'Main') as string, performedBy: log.issuedByName || 'Admin' });
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
            settings, isLoaded, firstSyncDone, isSyncing, activeBranchId, setActiveBranchId, updateSettings,
            setLogo, setTheme, setStudioName, setNotification, setSecurity, setCurrency, setLanguage, setTimezone, setGoogleCalendar, setPausePrice, setOwnerInfo,
            saveSettings: (s, c, sl) => {
                const result = loadSettings(sl);
                import('@/lib/settings-store').then(mod => mod.saveSettings(s, c || settings, sl || settings.studioSlug));
                return result;
            },
            updateStaff, removeStaff, addStaff, addBranch, removeBranch, updateBranch, addSubscriptionLog, setCustomRoles, addToTrash
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
