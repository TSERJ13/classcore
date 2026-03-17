'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { loadSettings, saveSettings, getScopedKey, getStaffSession, STORAGE_KEY, ACTIVE_SLUG_KEY, patchNotifications, patchSecurity, applyTheme, applyBg, cleanupRegistry, type StudioSettings, type ThemeKey, type BgKey, DEFAULT_SETTINGS, type Branch, type StaffMember, type TrashItem, type SubscriptionLog } from '@/lib/settings-store';
import { useUser } from '@/hooks/useUser';
import { recordAuditAction } from '@/lib/audit-store';
import { moveToTrash as recordToGlobalTrash } from '@/lib/trash-store';

interface StudioContextValue {
    settings: StudioSettings;
    activeBranchId: string;
    isLoaded: boolean;
    setTheme: (k: ThemeKey) => void;
    setBg: (k: BgKey) => void;
    setStudioName: (n: string) => void;
    setStudioSlug: (s: string) => void;
    setLogo: (dataUrl: string | null) => void;
    setNotification: (key: keyof StudioSettings['notifications'], val: boolean) => void;
    setSecurity: (key: keyof StudioSettings['security'], val: number | boolean) => void;
    setLandingContent: (content: Partial<StudioSettings['landingContent']>) => void;
    setSmsTemplates: (t: StudioSettings['sms_templates']) => void;
    setCurrency: (c: 'GEL' | 'USD' | 'EUR') => void;
    setLanguage: (l: 'ka' | 'ru' | 'en') => void;
    setTimezone: (t: string) => void;
    setGoogleCalendar: (v: boolean) => void;
    setPausePrice: (days: '7' | '14' | '30' | '60', price: number) => void;
    addBranch: (name: string, address?: string) => void;
    removeBranch: (id: string) => void;
    updateBranch: (id: string, patch: Partial<Branch>) => void;
    setActiveBranch: (id: string) => void;
    addStaff: (member: Omit<StaffMember, 'id' | 'created_at'>) => void;
    removeStaff: (id: string) => void;
    updateStaff: (id: string, patch: Partial<StaffMember>) => void;
    addToTrash: (item: Omit<TrashItem, 'deletedAt' | 'deletedBy'>) => void;
    restoreFromTrash: (id: string) => void;
    clearOldTrash: () => void;
    logSubscription: (log: Omit<SubscriptionLog, 'id' | 'date'>) => void;
    setCustomRoles: (roles: string[]) => void;
    setSettings: (s: StudioSettings) => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: React.ReactNode }) {
    const { user, profile } = useUser();
    const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
    const [activeBranchId, setActiveBranchIdState] = useState<string>('main');
    const [isLoaded, setIsLoaded] = useState(false);
    const hasSyncedRef = useRef(false);



    useEffect(() => {
        // Hydrate from localStorage after mount
        const local = loadSettings();
        setSettings(local);

        // Load active branch from separate key
        if (typeof window !== 'undefined' && local.studioSlug) {
            const savedBranch = localStorage.getItem(`cc_active_branch_${local.studioSlug}`);
            if (savedBranch) setActiveBranchIdState(savedBranch);
            else if (local.activeBranchId) setActiveBranchIdState(local.activeBranchId);
        }

        setIsLoaded(true);
        cleanupRegistry();

        // Fetch remaining studio data from cloud if available
        if (local.studioSlug && local.studioSlug !== 'demo.classcore.ge') {
            import('@/lib/sync-store').then(({ fetchStudioDataFromCloud, fetchStaffFromCloud }) => {
                // Sync staff list (permissions, etc)
                fetchStaffFromCloud(local.studioSlug).then(cloudStaff => {
                    if (cloudStaff && JSON.stringify(cloudStaff) !== JSON.stringify(local.staff)) {
                        console.log('📡 [StudioContext] Syncing staff data from cloud');
                        setSettings(prev => {
                            const next = saveSettings({ staff: cloudStaff }, prev, local.studioSlug);
                            // Notify session/hooks that staff data (permissions/branches) changed
                            window.dispatchEvent(new Event('cc_staff_update'));
                            return next;
                        });
                    }
                });

                // Sync other collection data
                fetchStudioDataFromCloud(local.studioSlug).then(cloudData => {
                    if (cloudData) {
                        console.log('📡 [StudioContext] Merging cloud data into local storage');
                        let anyChanged = false;
                        Object.entries(cloudData).forEach(([key, val]) => {
                            const localVal = localStorage.getItem(key);
                            const cloudValStr = JSON.stringify(val);
                            if (localVal !== cloudValStr) {
                                localStorage.setItem(key, cloudValStr);
                                anyChanged = true;
                            }
                        });

                        if (anyChanged) {
                            // Reload settings and notify app
                            const updatedLocal = loadSettings(local.studioSlug);
                            setSettings(updatedLocal);
                            window.dispatchEvent(new Event('cc_student_update'));
                            window.dispatchEvent(new Event('cc_groups_update'));
                            window.dispatchEvent(new Event('cc_subscription_update'));
                            window.dispatchEvent(new Event('cc_teacher_update'));
                            window.dispatchEvent(new Event('cc_staff_update'));
                            window.dispatchEvent(new Event('cc_active_branch_change'));
                        }
                    }
                });
            });
        }
    }, []);


    // Automatic Cloud Sync Effect for Studio Data
    useEffect(() => {
        // Resolve target slug: prioritization: Session Slug > Local Settings Slug
        const session = getStaffSession();
        const sessionSlug = session?.slug;
        const activeSlug = (sessionSlug && sessionSlug !== 'demo.classcore.ge')
            ? sessionSlug
            : settings.studioSlug;

        if (!isLoaded || !activeSlug || activeSlug === 'demo.classcore.ge') return;

        const syncData = () => {
            console.log('📡 [StudioContext] Auto-syncing studio data to cloud:', activeSlug);
            const allKeys = Object.keys(localStorage);
            const studioData: Record<string, any> = {};
            const prefixes = [
                'cc_students', 'cc_groups', 'cc_halls', 'cc_student_subscriptions',
                'cc_calendar_events', 'cc_subscription_plans', 'cc_shop_sales',
                'cc_checkins', 'cc_studio_settings', 'cc_teachers', 'cc_notifications',
                'cc_deleted_students', 'cc_deleted_subscriptions', 'cc_hall_rental'
            ];

            const adminRoles = ['admin', 'owner', 'manager'];
            const userRole = profile?.role || 'teacher';
            const isAuthorizedToSyncSettings = adminRoles.includes(userRole);

            allKeys.forEach(k => {
                if (prefixes.some(p => k.startsWith(p))) {
                    try {
                        // SECURITY: Only authorized roles can sync 'cc_studio_settings'
                        if (k.startsWith('cc_studio_settings') && !isAuthorizedToSyncSettings) {
                            return;
                        }
                        studioData[k] = JSON.parse(localStorage.getItem(k) || 'null');
                    } catch { }
                }
            });

            import('@/lib/sync-store').then(({ pushStudioStateToCloud }) => {
                // SECURITY: consolidated push handles role-based setting sync internally in sync-store
                pushStudioStateToCloud(activeSlug, settings.staff, studioData);
            });
        };

        const timer = setTimeout(syncData, 2000); // Debounce sync

        // Also setup periodic cloud pull to keep tabs on branch/staff changes from other users
        const pullInterval = setInterval(() => {
            import('@/lib/sync-store').then(({ pullStudioStateFromCloud }) => {
                pullStudioStateFromCloud(activeSlug).then(cloudState => {
                    if (!cloudState) {
                        console.warn('📡 [StudioContext] Cloud pull returned no data for:', activeSlug);
                        return;
                    }
                    let changed = false;

                    // 0. CHECK: If we are on demo slug but pulled real data, force local slug update
                    if (settings.studioSlug === 'demo.classcore.ge' && activeSlug !== 'demo.classcore.ge') {
                        console.log('📡 [StudioContext] Force-updating local slug from demo to:', activeSlug);
                        const key = getScopedKey(STORAGE_KEY, activeSlug);
                        localStorage.setItem(ACTIVE_SLUG_KEY, activeSlug);
                        // Save a basic shell to local storage so loadSettings picks it up
                        const shell = { ...DEFAULT_SETTINGS, studioSlug: activeSlug, studioName: cloudState.studio_data?.[getScopedKey(STORAGE_KEY, activeSlug)]?.studioName || 'Loading...' };
                        localStorage.setItem(key, JSON.stringify(shell));
                        changed = true;
                    }

                    // 1. Sync Staff List (Permissions, branches)
                    if (cloudState.staff_data && JSON.stringify(cloudState.staff_data) !== JSON.stringify(settings.staff)) {
                        console.log('📡 [StudioContext] Staff data update detected from cloud');
                        const key = getScopedKey(STORAGE_KEY, activeSlug);
                        const local = loadSettings(activeSlug);
                        const nextSettings = { ...local, staff: cloudState.staff_data };
                        localStorage.setItem(key, JSON.stringify(nextSettings));
                        changed = true;
                    }

                    // 2. Sync Studio Data (Branches, name, logo, etc)
                    if (cloudState.studio_data) {
                        Object.entries(cloudState.studio_data).forEach(([key, val]) => {
                            const localVal = localStorage.getItem(key);
                            const cloudValStr = JSON.stringify(val);
                            if (localVal !== cloudValStr) {
                                localStorage.setItem(key, cloudValStr);
                                changed = true;
                            }
                        });
                    }

                    if (changed) {
                        console.log('📡 [StudioContext] UI update triggered from cloud pulse for:', activeSlug);
                        const next = loadSettings(activeSlug);
                        setSettings(next);
                        // Notify app components to refresh
                        window.dispatchEvent(new Event('cc_staff_update'));
                        window.dispatchEvent(new Event('cc_active_branch_change'));
                        window.dispatchEvent(new Event('cc_teacher_update'));
                        window.dispatchEvent(new Event('cc_settings_update'));
                    }
                });
            });
        }, 12000); // Pulse every 12s

        return () => {
            clearTimeout(timer);
            clearInterval(pullInterval);
        };
    }, [isLoaded, settings.staff, settings.branches, settings.studioName, settings.studioSlug, profile?.role, getStaffSession()?.slug]);

    // Apply theme on mount + whenever theme/bg changes
    useEffect(() => { applyTheme(settings.themeKey); }, [settings.themeKey]);
    useEffect(() => { applyBg(settings.bgKey); }, [settings.bgKey]);

    const setTheme = useCallback((k: ThemeKey) => {
        setSettings(saveSettings({ themeKey: k }));
        applyTheme(k);
    }, []);

    const setBg = useCallback((k: BgKey) => {
        setSettings(saveSettings({ bgKey: k }));
        applyBg(k);
    }, []);

    const setStudioName = useCallback((n: string) => {
        setSettings(prev => saveSettings({ studioName: n }, prev, prev.studioSlug));
    }, []);

    // Auto-sync studio name from profile once if it's currently a default/demo name
    useEffect(() => {
        if (!isLoaded || !profile?.studio_name || hasSyncedRef.current) return;

        const isDefault = settings.studioName.toLowerCase().includes('demo') ||
            settings.studioName === 'ჩემი სტუდია';

        if (isDefault && profile.studio_name !== settings.studioName) {
            console.log('📡 [StudioContext] Auto-syncing studio name from profile:', profile.studio_name);
            setStudioName(profile.studio_name);
            hasSyncedRef.current = true;
        }
    }, [profile?.studio_name, settings.studioName, setStudioName, isLoaded]);

    const setStudioSlug = useCallback((s: string) => {
        setSettings(prev => saveSettings({ studioSlug: s }, prev, s));
    }, []);

    const setLogo = useCallback((dataUrl: string | null) => {
        setSettings(prev => saveSettings({ logoDataUrl: dataUrl }, prev, prev.studioSlug));
    }, []);

    const setNotification = useCallback((key: keyof StudioSettings['notifications'], val: boolean) => {
        setSettings(prev => patchNotifications({ [key]: val }, prev, prev.studioSlug));
    }, []);

    const setSecurity = useCallback((key: keyof StudioSettings['security'], val: number | boolean) => {
        setSettings(prev => patchSecurity({ [key]: val }, prev, prev.studioSlug));
    }, []);

    const setLandingContent = useCallback((content: Partial<StudioSettings['landingContent']>) => {
        setSettings(prev => saveSettings({ landingContent: { ...prev.landingContent, ...content } }, prev, prev.studioSlug));
    }, []);

    const setSmsTemplates = useCallback((templates: StudioSettings['sms_templates']) => {
        setSettings(prev => saveSettings({ sms_templates: templates }, prev, prev.studioSlug));
    }, []);

    const setCurrency = useCallback((c: 'GEL' | 'USD' | 'EUR') => {
        setSettings(prev => saveSettings({ currency: c }, prev, prev.studioSlug));
    }, []);

    const setLanguage = useCallback((l: 'ka' | 'ru' | 'en') => {
        setSettings(prev => saveSettings({ language: l }, prev, prev.studioSlug));
    }, []);

    const setTimezone = useCallback((t: string) => {
        setSettings(prev => saveSettings({ timezone: t }, prev, prev.studioSlug));
    }, []);

    const setGoogleCalendar = useCallback((v: boolean) => {
        setSettings(prev => saveSettings({ googleCalendarEnabled: v }, prev, prev.studioSlug));
    }, []);

    const setPausePrice = useCallback((days: '7' | '14' | '30' | '60', price: number) => {
        setSettings(prev => saveSettings({
            pausePrices: { ...prev.pausePrices, [days]: price }
        }, prev, prev.studioSlug));
    }, []);

    const addBranch = useCallback((name: string, address?: string) => {
        setSettings(prev => {
            const newBranch: Branch = {
                id: Math.random().toString(36).substring(2, 9),
                name,
                address,
                is_active: true,
                created_at: new Date().toISOString()
            };
            return saveSettings({ branches: [...prev.branches, newBranch] }, prev, prev.studioSlug);
        });
    }, []);

    const removeBranch = useCallback((id: string) => {
        if (id === 'main') return;
        setSettings(prev => {
            const branches = prev.branches.filter(b => b.id !== id);
            const activeBranchId = prev.activeBranchId === id ? 'main' : prev.activeBranchId;
            return saveSettings({ branches, activeBranchId }, prev, prev.studioSlug);
        });
    }, []);

    const updateBranch = useCallback((id: string, patch: Partial<Branch>) => {
        setSettings(prev => {
            const branches = prev.branches.map(b => b.id === id ? { ...b, ...patch } : b);
            return saveSettings({ branches }, prev, prev.studioSlug);
        });
    }, []);

    const setActiveBranch = useCallback((id: string) => {
        if (typeof window !== 'undefined' && settings.studioSlug) {
            localStorage.setItem(`cc_active_branch_${settings.studioSlug}`, id);
            setActiveBranchIdState(id);
            window.dispatchEvent(new Event('cc_active_branch_change'));
        }
    }, [settings.studioSlug]);

    // Branch Guard: If user has restrictions, ensure they are in an allowed branch
    useEffect(() => {
        if (!isLoaded || !profile?.allowedBranchIds) return;

        const powerfulRoles = ['admin', 'owner', 'manager'];
        if (powerfulRoles.includes(profile.role || '')) return;

        const isRestricted = profile.allowedBranchIds.length > 0;
        if (!isRestricted) return; // All branches allowed

        const currentBranchIsAllowed = profile.allowedBranchIds.includes(activeBranchId);
        if (!currentBranchIsAllowed) {
            console.log('🛡️ [StudioContext] Branch Guard: Forcing switch to allowed branch:', profile.allowedBranchIds[0]);
            setActiveBranch(profile.allowedBranchIds[0]);
        }
    }, [isLoaded, profile?.allowedBranchIds, profile?.role, activeBranchId, setActiveBranch]);

    const addStaff = useCallback((member: Omit<StaffMember, 'id' | 'created_at'>) => {
        setSettings(prev => {
            const newMember: StaffMember = {
                ...member,
                id: Math.random().toString(36).substring(2, 9),
                created_at: new Date().toISOString()
            };
            return saveSettings({ staff: [...(prev.staff || []), newMember] }, prev, prev.studioSlug);
        });
    }, []);

    const removeStaff = useCallback((id: string) => {
        setSettings(prev => {
            const member = (prev.staff || []).find(s => s.id === id);
            if (member) {
                // recordToGlobalTrash is renamed moveToTrash from lib
                recordToGlobalTrash('teacher' as any, member, activeBranchId);
            }
            const staff = (prev.staff || []).filter(s => s.id !== id);
            return saveSettings({ staff }, prev, prev.studioSlug);
        });
    }, [activeBranchId]);

    const updateStaff = useCallback((id: string, patch: Partial<StaffMember>) => {
        setSettings(prev => {
            const staff = (prev.staff || []).map(s => s.id === id ? { ...s, ...patch } : s);
            return saveSettings({ staff }, prev, prev.studioSlug);
        });
    }, []);

    const addToTrash = useCallback((item: Omit<TrashItem, 'deletedAt' | 'deletedBy'>) => {
        setSettings(prev => {
            const newItem: TrashItem = {
                ...item,
                deletedAt: new Date().toISOString(),
                deletedBy: user?.email || 'System'
            };
            const trash = [newItem, ...(prev.trash || [])].slice(0, 100); // Keep last 100

            // Log to global trash store for cross-branch retention/oversight
            recordToGlobalTrash(item.type as any, item.data, activeBranchId);

            return saveSettings({ trash }, prev, prev.studioSlug);
        });
    }, [user?.email, activeBranchId]);

    const restoreFromTrash = useCallback((id: string) => {
        setSettings(prev => {
            const item = (prev.trash || []).find(t => t.id === id);
            if (!item) return prev;

            const trash = (prev.trash || []).filter(t => t.id !== id);

            // Restore logic
            if (item.type === 'staff') {
                const staff = [...(prev.staff || []), item.data];
                return saveSettings({ trash, staff }, prev, prev.studioSlug);
            }

            if (item.type === 'student') {
                if (typeof window !== 'undefined') {
                    const key = getScopedKey('cc_deleted_students', prev.studioSlug);
                    const deletedIds = JSON.parse(localStorage.getItem(key) || '[]');
                    const nextIds = deletedIds.filter((d: string) => d !== (item.data.id || item.id));
                    localStorage.setItem(key, JSON.stringify(nextIds));
                    window.dispatchEvent(new Event('cc_student_update'));
                }
            }

            if (item.type === 'subscription') {
                if (typeof window !== 'undefined') {
                    const key = getScopedKey('cc_deleted_subscriptions', prev.studioSlug);
                    const deletedIds = JSON.parse(localStorage.getItem(key) || '[]');
                    const nextIds = deletedIds.filter((d: string) => d !== (item.data.id || item.id));
                    localStorage.setItem(key, JSON.stringify(nextIds));
                    window.dispatchEvent(new Event('cc_subscription_update'));
                }
            }

            return saveSettings({ trash }, prev, prev.studioSlug);
        });
    }, []);

    const clearOldTrash = useCallback(() => {
        setSettings(prev => {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const trash = (prev.trash || []).filter(t => new Date(t.deletedAt) > thirtyDaysAgo);
            return saveSettings({ trash }, prev, prev.studioSlug);
        });
    }, []);

    const logSubscription = useCallback((log: Omit<SubscriptionLog, 'id' | 'date'>) => {
        setSettings(prev => {
            const newLog: SubscriptionLog = {
                ...log,
                id: Math.random().toString(36).substring(2, 9),
                date: new Date().toISOString()
            };
            const subscriptionLogs = [newLog, ...(prev.subscriptionLogs || [])].slice(0, 500);

            // Record in global history
            recordAuditAction({
                action: 'subscription_issued',
                details: `Plan: ${log.planName}${log.groupName ? ` (Group: ${log.groupName})` : ''}`,
                amount: log.amount,
                studentId: log.studentId,
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
            activeBranchId,
            isLoaded,
            setTheme,
            setBg,
            setStudioName,
            setStudioSlug,
            setLogo,
            setNotification,
            setSecurity,
            setLandingContent,
            setSmsTemplates,
            setCurrency,
            setLanguage,
            setTimezone,
            setGoogleCalendar,
            setPausePrice,
            addBranch,
            removeBranch,
            updateBranch,
            setActiveBranch,
            addStaff,
            removeStaff,
            updateStaff,
            addToTrash,
            restoreFromTrash,
            clearOldTrash,
            logSubscription,
            setCustomRoles,
            setSettings: (s: StudioSettings) => setSettings(s)
        }}>
            {children}
        </StudioContext.Provider>
    );
}

export function useStudio() {
    const ctx = useContext(StudioContext);
    if (!ctx) throw new Error('useStudio must be used inside StudioProvider');
    return ctx;
}
