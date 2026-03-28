'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { loadSettings, saveSettings, getStaffSession, patchNotifications, patchSecurity, applyTheme, applyBg, cleanupRegistry, DEFAULT_SETTINGS } from '@/lib/settings-store';
import { getScopedKey, STORAGE_KEY, ACTIVE_SLUG_KEY } from '@/lib/utils';
import { type StudioSettings, type ThemeKey, type BgKey, type Branch, type StaffMember, type TrashItem, type SubscriptionLog } from '@/types';
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
    markLocalUpdate: () => void;
    addToTrash: (item: Omit<TrashItem, 'deletedAt' | 'deletedBy'>) => void;
    restoreFromTrash: (id: string) => void;
    clearOldTrash: () => void;
    logSubscription: (log: Omit<SubscriptionLog, 'id' | 'date'>) => void;
    setCustomRoles: (roles: string[]) => void;
    setSettings: (s: StudioSettings) => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children, defaultSlug, defaultStudioName }: { children: React.ReactNode; defaultSlug?: string | null; defaultStudioName?: string }) {
    const { user, profile, loading: authLoading } = useUser();
    const [settings, setSettings] = useState<StudioSettings>(() => {
        if (defaultSlug) {
            return { ...DEFAULT_SETTINGS, studioSlug: defaultSlug, studioName: defaultStudioName || DEFAULT_SETTINGS.studioName };
        }
        return DEFAULT_SETTINGS;
    });
    const [activeBranchId, setActiveBranchIdState] = useState<string>(() => {
        if (typeof window !== 'undefined' && defaultSlug) {
            return localStorage.getItem(`cc_active_branch_${defaultSlug}`) || 'main';
        }
        return 'main';
    });
    const [isLoaded, setIsLoaded] = useState(false);
    const [pushCounter, setPushCounter] = useState(0);
    const triggerPush = useCallback(() => setPushCounter(prev => prev + 1), []);
    const hasSyncedRef = useRef(false);
    const lastLocalUpdateRef = useRef<number>(0);

    const markLocalUpdate = useCallback(() => {
        const now = Date.now();
        lastLocalUpdateRef.current = now;
        if (typeof window !== 'undefined') {
            localStorage.setItem('cc_last_local_update', now.toString());
        }
    }, []);

    const setStudioName = useCallback((n: string) => {
        setSettings(prev => saveSettings({ studioName: n }, prev, prev.studioSlug));
        // Sync to cookie for SSR
        document.cookie = `cc_studio_name=${encodeURIComponent(n)}; path=/; max-age=31536000; SameSite=Lax`;
    }, []);

    const setStudioSlug = useCallback((s: string) => {
        setSettings(prev => saveSettings({ studioSlug: s }, prev, s));
        // Sync to cookie for SSR consistency
        document.cookie = `cc_active_slug=${s}; path=/; max-age=31536000; SameSite=Lax`;
    }, []);

    const setTheme = useCallback((k: ThemeKey) => {
        setSettings(saveSettings({ themeKey: k }));
        applyTheme(k);
        // Sync to cookie for SSR
        document.cookie = `cc_theme=${k}; path=/; max-age=31536000; SameSite=Lax`;
    }, []);

    const setBg = useCallback((k: BgKey) => {
        setSettings(saveSettings({ bgKey: k }));
        applyBg(k);
        // Sync to cookie for SSR
        document.cookie = `cc_bg=${k}; path=/; max-age=31536000; SameSite=Lax`;
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

    const syncTeacherGroups = useCallback((teacherId: string, fullName: string, assignedGroupIds: string[]) => {
        import('@/lib/group-store').then(({ updateTeacherGroups }) => {
            updateTeacherGroups(teacherId, fullName, assignedGroupIds);
        });
    }, []);

    const addStaff = useCallback((member: Omit<StaffMember, 'id' | 'created_at'>) => {
        markLocalUpdate();
        setSettings(prev => {
            const newMember: StaffMember = {
                ...member,
                id: Math.random().toString(36).substring(2, 9),
                created_at: new Date().toISOString()
            };
            const nextStaff = [...(prev.staff || []), newMember];
            
            // Cross-sync: Ensure groups assigned to this teacher know about them
            syncTeacherGroups(newMember.id, `${newMember.first_name || ''} ${newMember.last_name || ''}`.trim() || newMember.full_name, newMember.assigned_group_ids || []);
            
            return saveSettings({ staff: nextStaff }, prev, prev.studioSlug);
        });
    }, [markLocalUpdate, syncTeacherGroups]);

    const removeStaff = useCallback((id: string) => {
        markLocalUpdate();
        setSettings(prev => {
            const member = (prev.staff || []).find(s => s.id === id);
            if (member) {
                // recordToGlobalTrash is renamed moveToTrash from lib
                recordToGlobalTrash('teacher' as any, member, activeBranchId);
                
                // Cross-sync: Remove teacher from all their groups
                syncTeacherGroups(id, '', []);
            }
            const staff = (prev.staff || []).filter(s => s.id !== id);
            return saveSettings({ staff }, prev, prev.studioSlug);
        });
    }, [activeBranchId, markLocalUpdate, syncTeacherGroups]);

    const updateStaff = useCallback((id: string, patch: Partial<StaffMember>) => {
        markLocalUpdate();
        setSettings(prev => {
            const staff = (prev.staff || []).map(s => {
                if (s.id === id) {
                    const next = { ...s, ...patch };
                    // Cross-sync: If assignment or name changed, update groups
                    if (patch.assigned_group_ids || patch.first_name || patch.last_name || patch.full_name) {
                        syncTeacherGroups(id, `${next.first_name || ''} ${next.last_name || ''}`.trim() || next.full_name, next.assigned_group_ids || []);
                    }
                    return next;
                }
                return s;
            });
            return saveSettings({ staff }, prev, prev.studioSlug);
        });
    }, [markLocalUpdate, syncTeacherGroups]);

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
                markLocalUpdate();
                const staff = [...(prev.staff || []), item.data];
                const member = item.data as StaffMember;
                syncTeacherGroups(member.id, `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.full_name, member.assigned_group_ids || []);
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
    }, [syncTeacherGroups, markLocalUpdate]);

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

    useEffect(() => {
        // Hydrate from localStorage after mount
        const local = loadSettings(defaultSlug || undefined);
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
                    const lastLocal = parseInt(localStorage.getItem('cc_last_local_update') || '0');
                    if (Date.now() - lastLocal < 5000) {
                        console.log('📡 [StudioContext] Staff sync from cloud skipped: Local update too recent');
                        return;
                    }

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
                        // RACE CONDITION GUARD: Skip initial merge if we recently updated locally (e.g. just before refresh)
                        const lastLocal = parseInt(localStorage.getItem('cc_last_local_update') || '0');
                        const timeSinceUpdate = Date.now() - lastLocal;
                        if (timeSinceUpdate < 12000) {
                            console.log('📡 [StudioContext] Initial cloud merge skipped: Local update too recent (' + timeSinceUpdate + 'ms)');
                            return;
                        }

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
        
        const activeOrgId = session?.staff?.org_id || profile?.org_id || settings.orgId || (typeof window !== 'undefined' ? (localStorage.getItem('cc_sa_impersonate') === activeSlug ? localStorage.getItem('cc_sa_impersonate_org_id') : undefined) : undefined) || undefined;

        if (!isLoaded || !activeSlug || activeSlug === 'demo.classcore.ge') return;

        const syncData = () => {
            console.log('📡 [StudioContext] Auto-syncing studio data to cloud:', activeSlug);
            const allKeys = Object.keys(localStorage);
            const studioData: Record<string, any> = {};
            const prefixes = [
                'cc_student_data', 'cc_student_subscriptions', 'cc_groups', 'cc_halls',
                'cc_calendar_events', 'cc_subscription_plans', 'cc_shop_sales',
                'cc_checkins', 'cc_studio_settings', 'cc_teachers', 'cc_notifications',
                'cc_deleted_students', 'cc_deleted_subscriptions', 'cc_hall_rental',
                'cc_uid_registry', 'cc_attendance_archive', 'cc_expenses',
                'cc_audit_logs', 'cc_salary_status', 'cc_trash_bin'
            ];

            const adminRoles = ['admin', 'owner', 'manager'];
            const userRole = profile?.role || 'teacher';
            const isAuthorizedToSyncSettings = adminRoles.includes(userRole);

            allKeys.forEach(k => {
                const isPrefixMatched = prefixes.some(p => k.startsWith(p));
                const isScopedToStudio = k.includes(`_${activeSlug}`) || (activeOrgId && k.includes(`_${activeOrgId}`));

                if (isPrefixMatched && isScopedToStudio) {
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
                pushStudioStateToCloud(activeSlug, settings.staff, studioData, 0, activeOrgId);
            });
        };

        const timer = setTimeout(syncData, 2000); // Debounce sync

        // Also setup periodic cloud pull to keep tabs on branch/staff changes from other users
        const pullInterval = setInterval(() => {
            import('@/lib/sync-store').then(({ pullStudioStateFromCloud }) => {
                pullStudioStateFromCloud(activeSlug, activeOrgId).then(cloudState => {
                    if (!cloudState) {
                        console.warn('📡 [StudioContext] Cloud pull returned no data for:', activeSlug);
                        return;
                    }

                    // RACE CONDITION GUARD: If we recently updated locally, skip pulling cloud state for a bit
                    // to avoid overwriting fresh local data that hasn't finished pushing yet.
                    const lastLocal = parseInt(localStorage.getItem('cc_last_local_update') || '0');
                    const lastMem = lastLocalUpdateRef.current;
                    const lastUpdate = Math.max(lastLocal, lastMem);
                    const timeSinceUpdate = Date.now() - lastUpdate;
                    
                    if (timeSinceUpdate < 12000) {
                        console.log('📡 [StudioContext] Cloud pull skipped: Local update too recent (' + timeSinceUpdate + 'ms)');
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
    }, [isLoaded, settings.staff, settings.branches, settings.studioName, settings.studioSlug, profile?.role, getStaffSession()?.slug, pushCounter]);

    // Auto-mark local update when store events fire
    useEffect(() => {
        const handleAutoMark = () => {
            console.log('🔄 [StudioContext] Auto-marking local update from event');
            markLocalUpdate();
            triggerPush();
        };

        const events = [
            'cc_groups_update', 'cc_student_update', 'cc_teacher_update',
            'cc_subscription_update', 'cc_calendar_events_update', 
            'cc_checkins_update', 'cc_attendance_update', 'cc_shop_update'
        ];

        events.forEach(e => window.addEventListener(e, handleAutoMark));
        return () => events.forEach(e => window.removeEventListener(e, handleAutoMark));
    }, [markLocalUpdate, triggerPush]);

    // 1. Auto-sync studio name, slug & org_id from profile once if it's currently a default/demo name
    useEffect(() => {
        if (!isLoaded || !profile || hasSyncedRef.current) return;

        const isDefaultSlug = settings.studioSlug === 'demo.classcore.ge';
        const isDefaultName = settings.studioName.toLowerCase().includes('demo') ||
            settings.studioName === 'ჩემი სტუდია' || settings.studioName === '';

        // If we have a profile with a real slug/name, and we are currently on demo
        if (isDefaultSlug && profile.studio_slug && profile.studio_slug !== 'demo.classcore.ge') {
            console.log('📡 [StudioContext] Auto-syncing real studio from profile:', profile.studio_slug);
            
            // ONE-TIME PURGE logic intact...
            const hasCleansed = localStorage.getItem(`cc_cleansed_${profile.studio_slug}`);
            if (!hasCleansed) {
                console.log('🧹 [StudioContext] First-time initialization: Purging stale mock keys');
                const keys = Object.keys(localStorage);
                keys.forEach(k => {
                    if (k.includes(profile.studio_slug!) || k.includes('demo.classcore.ge')) {
                        const dataPrefixes = [
                            'cc_checkins', 'cc_shop_sales', 'cc_notifications', 
                            'cc_calendar_events', 'cc_student_data', 'cc_student_subscriptions',
                            'cc_group_data', 'cc_attendance_data', 'cc_subscription_plans',
                            'cc_shop_products', 'cc_teachers', 'cc_sales'
                        ];
                        if (dataPrefixes.some(p => k.includes(p))) {
                            localStorage.removeItem(k);
                        }
                    }
                });
                localStorage.setItem(`cc_cleansed_${profile.studio_slug}`, 'true');
            }

            setStudioSlug(profile.studio_slug);
            if (profile.studio_name) setStudioName(profile.studio_name);
            hasSyncedRef.current = true;
            return;
        }

        if (isDefaultName && profile.studio_name && profile.studio_name !== settings.studioName) {
            console.log('📡 [StudioContext] Auto-syncing studio name from profile:', profile.studio_name);
            setStudioName(profile.studio_name);
            hasSyncedRef.current = true;
        }

        // Also sync org_id if it's missing locally but exists in profile
        if (profile.org_id && profile.org_id !== settings.orgId && !isDefaultName) {
            console.log('📡 [StudioContext] Auto-syncing org_id from profile:', profile.org_id);
            setSettings(prev => saveSettings({ orgId: profile.org_id }, prev, prev.studioSlug));
        }

        // RECLAIM REGISTRY: Ensure all user's studios are in the local list
        if (user?.email) {
            import('@/lib/settings-store').then(({ reclaimStudioRegistry }) => {
                reclaimStudioRegistry(user.email!);
            });
        }
    }, [user?.email, profile?.studio_name, profile?.studio_slug, profile?.org_id, settings.studioName, settings.studioSlug, setStudioName, setStudioSlug, isLoaded, settings.orgId]);

    // Apply theme on mount + whenever theme/bg changes
    useEffect(() => { applyTheme(settings.themeKey); }, [settings.themeKey]);
    useEffect(() => { applyBg(settings.bgKey); }, [settings.bgKey]);

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
            markLocalUpdate,
            addToTrash,
            restoreFromTrash,
            clearOldTrash,
            logSubscription,
            setCustomRoles,
            setSettings: (s: StudioSettings) => setSettings(s)
        }}>
            {(!isLoaded || authLoading) ? (
                <div className="fixed inset-0 bg-white dark:bg-zinc-950 z-[9999] flex flex-col items-center justify-center p-4">
                    <div className="relative">
                        <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                    </div>
                    <div className="mt-4 text-zinc-500 font-medium animate-pulse">
                        ClassCore Loading...
                    </div>
                </div>
            ) : children}
        </StudioContext.Provider>
    );
}

export function useStudio() {
    const ctx = useContext(StudioContext);
    if (!ctx) throw new Error('useStudio must be used inside StudioProvider');
    return ctx;
}

