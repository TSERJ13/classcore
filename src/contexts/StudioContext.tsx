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
    setWizardCompleted: (completed: boolean) => void;
    setOwnerInfo: (info: Partial<StudioSettings['owner_info']>) => void;
    claimStudio: (newSlug: string, ownerEmail: string) => Promise<void>;
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
    const [firstSyncDone, setFirstSyncDone] = useState(false);
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
        markLocalUpdate();
        setSettings(prev => saveSettings({ logoDataUrl: dataUrl }, prev, prev.studioSlug));
        triggerPush();
    }, [markLocalUpdate, triggerPush]);

    const setNotification = useCallback((key: keyof StudioSettings['notifications'], val: boolean) => {
        markLocalUpdate();
        setSettings(prev => patchNotifications({ [key]: val }, prev, prev.studioSlug));
        triggerPush();
    }, [markLocalUpdate, triggerPush]);

    const setSecurity = useCallback((key: keyof StudioSettings['security'], val: number | boolean) => {
        markLocalUpdate();
        setSettings(prev => patchSecurity({ [key]: val }, prev, prev.studioSlug));
        triggerPush();
    }, [markLocalUpdate, triggerPush]);

    const setLandingContent = useCallback((content: Partial<StudioSettings['landingContent']>) => {
        markLocalUpdate();
        setSettings(prev => saveSettings({ landingContent: { ...prev.landingContent, ...content } }, prev, prev.studioSlug));
        triggerPush();
    }, [markLocalUpdate, triggerPush]);

    const setSmsTemplates = useCallback((templates: StudioSettings['sms_templates']) => {
        markLocalUpdate();
        setSettings(prev => saveSettings({ sms_templates: templates }, prev, prev.studioSlug));
        triggerPush();
    }, [markLocalUpdate, triggerPush]);

    const setCurrency = useCallback((c: 'GEL' | 'USD' | 'EUR') => {
        markLocalUpdate();
        setSettings(prev => saveSettings({ currency: c }, prev, prev.studioSlug));
        triggerPush();
    }, [markLocalUpdate, triggerPush]);

    const setLanguage = useCallback((l: 'ka' | 'ru' | 'en') => {
        markLocalUpdate();
        setSettings(prev => saveSettings({ language: l }, prev, prev.studioSlug));
        triggerPush();
    }, [markLocalUpdate, triggerPush]);

    const setTimezone = useCallback((t: string) => {
        markLocalUpdate();
        setSettings(prev => saveSettings({ timezone: t }, prev, prev.studioSlug));
        triggerPush();
    }, [markLocalUpdate, triggerPush]);

    const setGoogleCalendar = useCallback((v: boolean) => {
        markLocalUpdate();
        setSettings(prev => saveSettings({ googleCalendarEnabled: v }, prev, prev.studioSlug));
        triggerPush();
    }, [markLocalUpdate, triggerPush]);

    const setPausePrice = useCallback((days: '7' | '14' | '30' | '60', price: number) => {
        markLocalUpdate();
        setSettings(prev => saveSettings({
            pausePrices: { ...prev.pausePrices, [days]: price }
        }, prev, prev.studioSlug));
        triggerPush();
    }, [markLocalUpdate, triggerPush]);
    
    const setWizardCompleted = useCallback((completed: boolean) => {
        markLocalUpdate();
        setSettings(prev => saveSettings({ isWizardCompleted: completed }, prev, prev.studioSlug));
        triggerPush();
        if (completed && typeof window !== 'undefined') {
            localStorage.setItem('cc_onboarding_done', 'true');
        }
    }, [markLocalUpdate, triggerPush]);

    const setOwnerInfo = useCallback((info: Partial<StudioSettings['owner_info']>) => {
        markLocalUpdate();
        setSettings(prev => saveSettings({ 
            owner_info: { ...prev.owner_info, ...info } 
        }, prev, prev.studioSlug));
        triggerPush();
    }, [markLocalUpdate, triggerPush]);

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

        const timer = setTimeout(() => {
            const activeSlug = local.studioSlug;
            // Immediate release for demo or empty slugs
            if (!activeSlug || activeSlug === 'demo.classcore.ge') {
                setFirstSyncDone(true);
                setIsLoaded(true);
                return;
            }

            console.log('📡 [StudioContext] Mounting & Pulling latest state for:', activeSlug);
            
            import('@/lib/sync-store').then(({ fetchStaffFromCloud, fetchStudioDataFromCloud }) => {
                Promise.all([
                    fetchStaffFromCloud(activeSlug),
                    fetchStudioDataFromCloud(activeSlug)
                ]).then(([cloudStaff, cloudData]) => {
                    // 1. Staff Sync
                    if (cloudStaff && cloudStaff.length > 0) {
                        setSettings(prev => saveSettings({ staff: cloudStaff }, prev, activeSlug));
                    }

                    // 2. Collection Sync
                    if (cloudData) {
                        const lastLocal = parseInt(localStorage.getItem('cc_last_local_update') || '0');
                        const timeSinceUpdate = Date.now() - lastLocal;
                        const forceSync = localStorage.getItem('cc_force_initial_sync') === 'true';
                        
                        // Only merge if not recently updated locally to avoid overwriting newer local state
                        // UNLESS forceSync is active (set after registration)
                        if (timeSinceUpdate > 12000 || forceSync) {
                            if (forceSync) {
                                console.log('🚀 [StudioContext] Force Initial Sync: Bypassing 12s lock');
                                localStorage.removeItem('cc_force_initial_sync');
                            }
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
                                const updatedLocal = loadSettings(activeSlug);
                                setSettings(updatedLocal);
                                // Trigger global refreshes
                                window.dispatchEvent(new Event('cc_settings_update'));
                                window.dispatchEvent(new Event('cc_staff_update'));
                                window.dispatchEvent(new Event('cc_active_branch_change'));
                            }
                        }
                    }

                    // Hydration complete: Release the loading guard
                    setFirstSyncDone(true);
                }).catch(err => {
                    console.error('📡 [StudioContext] Initial Cloud Sync Failed:', err);
                    setFirstSyncDone(true);
                });
            });
        }, 800);

        // Immediate release for UI but keep small buffer for settings apply
        setTimeout(() => setIsLoaded(true), 0);

        cleanupRegistry();

        return () => clearTimeout(timer);
    }, []);


    // Automatic Cloud Sync Effect for Studio Data
    useEffect(() => {
        // Resolve target slug: prioritization: Session Slug > Local Settings Slug
        const session = getStaffSession();
        const sessionSlug = session?.slug;
        const activeSlug = (sessionSlug && sessionSlug !== 'demo.classcore.ge')
            ? sessionSlug
            : settings.studioSlug;
        
        const displayStudioName = (settings.studioName && settings.studioName.toLowerCase() !== 'studio') 
            ? settings.studioName 
            : (profile?.studio_name && profile.studio_name.toLowerCase() !== 'studio')
                ? profile.studio_name
                : (typeof window !== 'undefined' ? localStorage.getItem('cc_studio_name') : null) || 'Studio';
        
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
    }, [isLoaded, settings, profile?.role, getStaffSession()?.slug, pushCounter]);

    // Auto-mark local update when store events fire
    useEffect(() => {
        const handleAutoMark = () => {
            console.log('🔄 [StudioContext] Auto-marking local update from event');
            markLocalUpdate();
            triggerPush();
        };

        const events = [
            'cc_groups_update', 'cc_halls_update', 'cc_student_update', 'cc_teacher_update',
            'cc_subscription_update', 'cc_calendar_events_update', 
            'cc_checkins_update', 'cc_attendance_update', 'cc_shop_update', 'cc_settings_update'
        ];

        events.forEach(e => window.addEventListener(e, handleAutoMark));
        return () => events.forEach(e => window.removeEventListener(e, handleAutoMark));
    }, [markLocalUpdate, triggerPush]);

    // 1. Auto-sync studio name, slug & org_id from profile once if it's currently a default/demo name
    useEffect(() => {
        if (!isLoaded || !profile || hasSyncedRef.current) return;

        const isDefaultSlug = settings.studioSlug === 'demo.classcore.ge';
        const isDefaultName = settings.studioName.toLowerCase().includes('demo') ||
            settings.studioName === 'ჩემი სტუდია' || settings.studioName === '' || settings.studioName === 'Studio';

        // If we have a profile with a real slug/name, and we are currently on demo
        if (isDefaultSlug && profile.studio_slug && profile.studio_slug !== 'demo.classcore.ge') {
            console.log('📡 [StudioContext] Auto-syncing real studio from profile:', profile.studio_slug);
            
            // ONE-TIME PURGE logic: protects against mock data contamination
            // BUT: if we just registered, the wizard already set this to 'true' to PROTECT our new data.
            const hasCleansed = localStorage.getItem(`cc_cleansed_${profile.studio_slug}`);
            if (!hasCleansed) {
                console.log('🧹 [StudioContext] First-time initialization: Purging stale mock keys');
                const keys = Object.keys(localStorage);
                keys.forEach(k => {
                    // Only purge keys related to this studio or demo
                    if (k.includes(profile.studio_slug!) || k.includes('demo.classcore.ge')) {
                        const dataPrefixes = [
                            'cc_checkins', 'cc_shop_sales', 'cc_notifications', 
                            'cc_calendar_events', 'cc_student_data', 'cc_student_subscriptions',
                            'cc_groups', 'cc_halls', 'cc_attendance_data', 'cc_subscription_plans',
                            'cc_shop_products', 'cc_teachers', 'cc_sales', 'cc_uid_registry'
                        ];
                        if (dataPrefixes.some(p => k.includes(p))) {
                            localStorage.removeItem(k);
                        }
                    }
                });
                localStorage.setItem(`cc_cleansed_${profile.studio_slug}`, 'true');
            } else {
                console.log('🛡️ [StudioContext] Studio already cleansed or marked as safe. Skipping purge.');
            }

            setStudioSlug(profile.studio_slug);
            if (profile.studio_name && (isDefaultName || !settings.studioName)) {
                setStudioName(profile.studio_name);
            }
            hasSyncedRef.current = true;
            return;
        }

        const shouldSyncName = isDefaultName && profile.studio_name && profile.studio_name !== settings.studioName;
        if (shouldSyncName) {
            console.log('📡 [StudioContext] Auto-syncing studio name from profile:', profile.studio_name);
            setStudioName(profile.studio_name || '');
        }

        // Also sync owner_info if it's missing locally but exists in profile
        const needsNameSync = profile.first_name && !settings.owner_info?.first_name;
        const needsPhoneSync = profile.phone && !settings.owner_info?.phone;

        if (needsNameSync || needsPhoneSync) {
            console.log('📡 [StudioContext] Auto-syncing owner_info from profile metadata');
            setOwnerInfo({
                first_name: profile.first_name || settings.owner_info?.first_name || '',
                last_name: profile.last_name || settings.owner_info?.last_name || '',
                email: user?.email || settings.owner_info?.email || '',
                phone: profile.phone || settings.owner_info?.phone || ''
            });
        }

        // Also sync org_id if it's missing locally but exists in profile
        if (profile.org_id && profile.org_id !== settings.orgId && !isDefaultName) {
            console.log('📡 [StudioContext] Auto-syncing org_id from profile:', profile.org_id);
            setSettings(prev => saveSettings({ orgId: profile.org_id }, prev, prev.studioSlug));
        }
    }, [user?.email, profile?.first_name, profile?.last_name, profile?.phone, profile?.studio_name, profile?.studio_slug, profile?.org_id, settings, setStudioName, setStudioSlug, isLoaded, setOwnerInfo]);

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
            setSettings: (s: StudioSettings) => setSettings(s),
            setWizardCompleted,
            setOwnerInfo,
            claimStudio: async (newSlug: string, ownerEmail: string) => {
                if (typeof window === 'undefined') return;
                console.log('🚀 [StudioContext] Starting Studio Claim (Migration) for:', newSlug);
                
                const oldSlug = 'demo.classcore.ge';
                const allKeys = Object.keys(localStorage);
                const prefixes = [
                    'cc_student_data', 'cc_student_subscriptions', 'cc_groups', 'cc_halls',
                    'cc_calendar_events', 'cc_subscription_plans', 'cc_shop_sales',
                    'cc_checkins', 'cc_studio_settings', 'cc_teachers', 'cc_notifications',
                    'cc_attendance_archive', 'cc_expenses', 'cc_audit_logs'
                ];

                // 1. Copy Data
                const migratedData: Record<string, any> = {};
                prefixes.forEach(prefix => {
                    const oldKey = `${prefix}_${oldSlug}`;
                    const val = localStorage.getItem(oldKey);
                    if (val) {
                        const newKey = `${prefix}_${newSlug}`;
                        localStorage.setItem(newKey, val);
                        migratedData[newKey] = JSON.parse(val);
                    }
                });

                // 2. Prep New Settings
                const newSettingsKey = `${STORAGE_KEY}_${newSlug}`;
                const rawSettings = localStorage.getItem(newSettingsKey);
                let newSettings = rawSettings ? JSON.parse(rawSettings) : { ...settings, studioSlug: newSlug };
                
                // Ensure owner is set
                const currentStaff = newSettings.staff || [];
                if (!currentStaff.find((s: any) => s.role === 'owner')) {
                    const owner: StaffMember = {
                        id: Math.random().toString(36).substring(2, 9),
                        org_id: newSettings.orgId || Math.random().toString(36).substring(2, 12),
                        first_name: profile?.first_name || 'Owner',
                        last_name: profile?.last_name || 'Studio',
                        full_name: `${profile?.first_name || 'Owner'} ${profile?.last_name || 'Studio'}`.trim(),
                        email: ownerEmail,
                        phone: profile?.phone || '',
                        status: 'active',
                        role: 'owner',
                        permissions: {
                            canViewAttendance: true, canViewSubscriptions: true, canViewStudents: true,
                            canViewCalendar: true, canEditCalendar: true, canViewGroups: true,
                            canViewTeachers: true, canViewHalls: true, canViewShop: true,
                            canViewAnalytics: true, canViewSMS: true
                        },
                        created_at: new Date().toISOString()
                    };
                    newSettings.staff = [owner, ...currentStaff.filter((s: any) => s.role !== 'owner')];
                }
                
                localStorage.setItem(newSettingsKey, JSON.stringify(newSettings));
                localStorage.setItem(ACTIVE_SLUG_KEY, newSlug);

                // 3. Push to Cloud immediately
                const { pushStudioStateToCloud } = await import('@/lib/sync-store');
                await pushStudioStateToCloud(newSlug, newSettings.staff, migratedData, 0, newSettings.orgId);

                // 4. Finalize
                console.log('✅ [StudioContext] Migration complete. Redirecting...');
                window.location.href = `/${newSlug}/settings`;
            }
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

