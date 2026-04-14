'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { loadSettings, saveSettings, getStaffSession, patchNotifications, patchSecurity, applyTheme, cleanupRegistry, DEFAULT_SETTINGS } from '@/lib/settings-store';
import { getScopedKey, STORAGE_KEY, ACTIVE_SLUG_KEY } from '@/lib/utils';
import { type StudioSettings, type ThemeKey, type Branch, type StaffMember, type TrashItem, type SubscriptionLog } from '@/types';
import { useUser } from '@/hooks/useUser';
import { recordAuditAction } from '@/lib/audit-store';
import { moveToTrash as recordToGlobalTrash } from '@/lib/trash-store';
import { createClient } from '@/lib/supabase/client';

interface StudioContextValue {
    settings: StudioSettings;
    activeBranchId: string;
    isLoaded: boolean;
    setTheme: (k: ThemeKey) => void;
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
    const [isLoaded, setIsLoaded] = useState(false); // Default to false until first sync/hydration
    const [firstSyncDone, setFirstSyncDone] = useState(false);
    const [pushCounter, setPushCounter] = useState(0);
    const triggerPush = useCallback(() => setPushCounter(prev => prev + 1), []);
    const hasSyncedRef = useRef(false);
    const lastLocalUpdateRef = useRef<number>(0);

    /**
     * Consolidates cloud state application logic with strict tombstone enforcement.
     */
    const applyCloudState = useCallback((activeSlug: string, cloudState: { staff_data?: StaffMember[], studio_data?: any }) => {
        if (!cloudState) return false;
        let changed = false;

        const TOMBSTONE_MAP: Record<string, string> = {
            'cc_student_data': 'cc_deleted_students',
            'cc_groups': 'cc_deleted_groups',
            'cc_halls': 'cc_deleted_halls',
            'cc_student_subscriptions': 'cc_deleted_subscriptions'
        };

        // 1. Sync Staff List
        if (cloudState.staff_data && JSON.stringify(cloudState.staff_data) !== JSON.stringify(settings.staff)) {
            console.log('📡 [StudioContext] Staff data update detected from cloud');
            const key = getScopedKey(STORAGE_KEY, activeSlug);
            const local = loadSettings(activeSlug);
            const nextSettings = { ...local, staff: cloudState.staff_data };
            localStorage.setItem(key, JSON.stringify(nextSettings));
            setSettings(nextSettings);
            changed = true;
        }

        // 2. Sync Studio Data WITH Tombstone Enforcement
        if (cloudState.studio_data) {
            Object.entries(cloudState.studio_data).forEach(([key, val]) => {
                const localVal = localStorage.getItem(key);
                const cloudValStr = JSON.stringify(val);
                
                let tombstoneType: string | undefined;
                let tKey: string | undefined;

                for (const [prefix, tPrefix] of Object.entries(TOMBSTONE_MAP)) {
                    if (key.startsWith(prefix)) {
                        const suffix = key.replace(prefix, '');
                        tombstoneType = tPrefix;
                        tKey = tPrefix + suffix;
                        break;
                    }
                }
                
                if (tombstoneType && tKey) {
                    try {
                        const localDeletedIdsRaw = localStorage.getItem(tKey);
                        const localDeletedIds = localDeletedIdsRaw ? JSON.parse(localDeletedIdsRaw) : [];
                        const cloudDeletedIds = (cloudState.studio_data[tKey] || []) as string[];
                        const mergedDeleted = Array.from(new Set([...(Array.isArray(localDeletedIds) ? localDeletedIds : []), ...cloudDeletedIds]));
                        const deletedSet = new Set(mergedDeleted);

                        if (mergedDeleted.length > (Array.isArray(localDeletedIds) ? localDeletedIds.length : 0)) {
                            localStorage.setItem(tKey, JSON.stringify(mergedDeleted));
                            changed = true;
                        }

                        if (deletedSet.size > 0) {
                            if (key.includes('cc_student_data') && typeof val === 'object' && val !== null) {
                                const filtered = { ...(val as any) };
                                Object.keys(filtered).forEach(id => { if (deletedSet.has(id)) delete filtered[id]; });
                                const filteredStr = JSON.stringify(filtered);
                                if (localVal !== filteredStr) {
                                    localStorage.setItem(key, filteredStr);
                                    changed = true;
                                    return;
                                }
                            } else if (Array.isArray(val)) {
                                const filtered = val.filter((item: any) => !item?.id || !deletedSet.has(item.id));
                                const filteredStr = JSON.stringify(filtered);
                                if (localVal !== filteredStr) {
                                    localStorage.setItem(key, filteredStr);
                                    changed = true;
                                    return;
                                }
                            }
                        }
                    } catch (e) {
                        console.error('⚠️ [applyCloudState] Tombstone error for key:', key, e);
                    }
                }

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
            
            const events = [
                'cc_active_branch_change', 'cc_settings_update', 'cc_student_update', 
                'cc_groups_update', 'cc_halls_update', 'cc_subscription_update', 
                'cc_calendar_events_update', 'cc_checkins_update'
            ];
            events.forEach(e => window.dispatchEvent(new Event(e)));
        }

        return changed;
    }, [settings.staff]);

    const markLocalUpdate = useCallback(() => {
        const now = Date.now();
        lastLocalUpdateRef.current = now;
        if (typeof window !== 'undefined') {
            localStorage.setItem('cc_last_local_update', now.toString());
        }
    }, []);

    const setStudioName = useCallback((n: string) => {
        setSettings(prev => saveSettings({ studioName: n }, prev, prev.studioSlug));
        document.cookie = `cc_studio_name=${encodeURIComponent(n)}; path=/; max-age=31536000; SameSite=Lax`;
    }, []);

    const setStudioSlug = useCallback((s: string) => {
        setSettings(prev => saveSettings({ studioSlug: s }, prev, s));
        document.cookie = `cc_active_slug=${s}; path=/; max-age=31536000; SameSite=Lax`;
    }, []);

    const setTheme = useCallback((k: ThemeKey) => {
        setSettings(saveSettings({ themeKey: k }));
        applyTheme(k);
        document.cookie = `cc_theme=${k}; path=/; max-age=31536000; SameSite=Lax`;
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

    const setOwnerInfo = useCallback((info: any) => {
        markLocalUpdate();
        setSettings(prev => saveSettings({ 
            owner_info: {
                first_name: prev.owner_info?.first_name || '',
                last_name: prev.owner_info?.last_name || '',
                email: prev.owner_info?.email || '',
                phone: prev.owner_info?.phone || '',
                client_id: prev.owner_info?.client_id || '',
                ...info
            }
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
            syncTeacherGroups(newMember.id, `${newMember.first_name || ''} ${newMember.last_name || ''}`.trim() || newMember.full_name, newMember.assigned_group_ids || []);
            return saveSettings({ staff: nextStaff }, prev, prev.studioSlug);
        });
    }, [markLocalUpdate, syncTeacherGroups]);

    const removeStaff = useCallback((id: string) => {
        markLocalUpdate();
        setSettings(prev => {
            const member = (prev.staff || []).find(s => s.id === id);
            if (member) {
                recordToGlobalTrash('teacher' as any, member, activeBranchId);
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
            const trash = [newItem, ...(prev.trash || [])].slice(0, 100);
            recordToGlobalTrash(item.type as any, item.data, activeBranchId);
            return saveSettings({ trash }, prev, prev.studioSlug);
        });
    }, [user?.email, activeBranchId]);

    const restoreFromTrash = useCallback((id: string) => {
        setSettings(prev => {
            const item = (prev.trash || []).find(t => t.id === id);
            if (!item) return prev;
            const trash = (prev.trash || []).filter(t => t.id !== id);

            if (item.type === 'staff') {
                markLocalUpdate();
                const staff = [...(prev.staff || []), item.data];
                const member = item.data as StaffMember;
                syncTeacherGroups(member.id, `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.full_name, member.assigned_group_ids || []);
                return saveSettings({ trash, staff }, prev, prev.studioSlug);
            }

            if (item.type === 'student' || item.type === 'subscription') {
                if (typeof window !== 'undefined') {
                    const prefix = item.type === 'student' ? 'cc_deleted_students' : 'cc_deleted_subscriptions';
                    const key = getScopedKey(prefix, prev.studioSlug);
                    const deletedIds = JSON.parse(localStorage.getItem(key) || '[]');
                    const nextIds = deletedIds.filter((d: string) => d !== (item.data.id || item.id));
                    localStorage.setItem(key, JSON.stringify(nextIds));
                    window.dispatchEvent(new Event(item.type === 'student' ? 'cc_student_update' : 'cc_subscription_update'));
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

    // Initial Hydration & Cloud Pull
    useEffect(() => {
        const local = loadSettings(defaultSlug || undefined);
        setSettings(local);

        if (typeof window !== 'undefined' && local.studioSlug) {
            const savedBranch = localStorage.getItem(`cc_active_branch_${local.studioSlug}`);
            if (savedBranch) setActiveBranchIdState(savedBranch);
            else if (local.activeBranchId) setActiveBranchIdState(local.activeBranchId);
        }

        const safetyTimer = setTimeout(() => {
            if (!hasSyncedRef.current) {
                console.warn('📡 [StudioContext] Sync safety release triggered');
                setFirstSyncDone(true);
                setIsLoaded(true);
            }
        }, 8000);

        const timer = setTimeout(() => {
            const activeSlug = local.studioSlug;
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
                    hasSyncedRef.current = true;
                    
                    if (cloudStaff && cloudStaff.length > 0) {
                        setSettings(prev => saveSettings({ staff: cloudStaff }, prev, activeSlug));
                    }

                    if (cloudData) {
                        applyCloudState(activeSlug, { staff_data: cloudStaff || [], studio_data: cloudData });
                    }

                    setFirstSyncDone(true);
                    setIsLoaded(true);
                }).catch(err => {
                    console.error('📡 [StudioContext] Initial Cloud Sync Failed:', err);
                    setFirstSyncDone(true);
                    setIsLoaded(true);
                });
            }).catch(() => {
                setIsLoaded(true);
            });
        }, 50);

        cleanupRegistry();
        return () => {
            clearTimeout(timer);
            clearTimeout(safetyTimer);
        };
    }, [defaultSlug]);

    // Automatic Cloud Sync
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isLoaded || !settings.studioSlug || settings.studioSlug === 'demo.classcore.ge') return;

            const studioData: Record<string, any> = {};
            const keys = Object.keys(localStorage);
            keys.forEach(k => {
                if (k.includes(`_${settings.studioSlug}`) || (settings.orgId && k.includes(`_${settings.orgId}`))) {
                    try {
                        const val = localStorage.getItem(k);
                        if (val) studioData[k] = JSON.parse(val);
                    } catch {}
                }
            });

            import('@/lib/sync-store').then(({ pushStudioStateToCloud }) => {
                pushStudioStateToCloud(settings.studioSlug, settings.staff, studioData, 0, settings.orgId);
            });
        }, 1000); // 1s debounce to feel more like a direct database connection

        return () => clearTimeout(timer);
    }, [isLoaded, settings, pushCounter]);

    // Realtime Pulse updates
    useEffect(() => {
        if (!isLoaded || !settings.studioSlug || settings.studioSlug === 'demo.classcore.ge') return;

        const supabase = createClient();
        const channel = supabase
            .channel(`studio_pulse_${settings.studioSlug}`)
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'studio_settings',
                filter: `studio_slug=eq.${settings.studioSlug}`
            }, () => {
                console.log('📡 [StudioContext] Realtime Update Pulse received');
                import('@/lib/sync-store').then(({ pullStudioStateFromCloud }) => {
                    pullStudioStateFromCloud(settings.studioSlug!).then(state => {
                        if (state) applyCloudState(settings.studioSlug!, state);
                    });
                });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [settings.studioSlug, isLoaded, applyCloudState]);

    useEffect(() => {
        const handleAutoMark = () => {
            markLocalUpdate();
            triggerPush();
        };

        const events = [
            'cc_groups_update', 'cc_halls_update', 'cc_student_update', 'cc_teacher_update',
            'cc_subscription_update', 'cc_subscription_plans_update', 'cc_calendar_events_update', 
            'cc_checkins_update', 'cc_attendance_update', 'cc_shop_update', 'cc_settings_update',
            'cc_salary_update'
        ];

        events.forEach(e => window.addEventListener(e, handleAutoMark));
        return () => events.forEach(e => window.removeEventListener(e, handleAutoMark));
    }, [markLocalUpdate, triggerPush]);

    // Auto-sync from profile
    useEffect(() => {
        if (!isLoaded || !profile || hasSyncedRef.current) return;

        const isDefaultSlug = settings.studioSlug === 'demo.classcore.ge';
        const isDefaultName = settings.studioName.toLowerCase().includes('demo') ||
            settings.studioName === 'ჩემი სტუდია' || settings.studioName === '' || settings.studioName === 'Studio';

        if (isDefaultSlug && profile.studio_slug && profile.studio_slug !== 'demo.classcore.ge') {
            const hasCleansed = localStorage.getItem(`cc_cleansed_${profile.studio_slug}`);
            if (!hasCleansed) {
                const keys = Object.keys(localStorage);
                keys.forEach(k => {
                    if (k.includes(profile.studio_slug!) || k.includes('demo.classcore.ge')) {
                        const dataPrefixes = [
                            'cc_checkins', 'cc_shop_sales', 'cc_notifications', 
                            'cc_calendar_events', 'cc_student_data', 'cc_student_subscriptions',
                            'cc_groups', 'cc_halls', 'cc_attendance_data', 'cc_subscription_plans',
                            'cc_shop_products', 'cc_teachers', 'cc_sales'
                        ];
                        if (dataPrefixes.some(p => k.includes(p))) localStorage.removeItem(k);
                    }
                });
                localStorage.setItem(`cc_cleansed_${profile.studio_slug}`, 'true');
            }

            setStudioSlug(profile.studio_slug);
            if (profile.studio_name && (isDefaultName || !settings.studioName)) {
                setStudioName(profile.studio_name);
            }
            hasSyncedRef.current = true;
            return;
        }

        if (isDefaultName && profile.studio_name && profile.studio_name !== settings.studioName) {
            setStudioName(profile.studio_name || '');
        }

        if (profile.first_name && !settings.owner_info?.first_name) {
            setOwnerInfo({
                first_name: profile.first_name || '',
                last_name: profile.last_name || '',
                email: user?.email || '',
                phone: profile.phone || ''
            });
        }

        if (profile.org_id && profile.org_id !== settings.orgId && !isDefaultName) {
            setSettings(prev => saveSettings({ orgId: profile.org_id }, prev, prev.studioSlug));
        }
    }, [user?.email, profile, settings, setStudioName, setStudioSlug, isLoaded, setOwnerInfo]);

    useEffect(() => { applyTheme(settings.themeKey); }, [settings.themeKey]);

    return (
        <StudioContext.Provider value={{
            settings, activeBranchId, isLoaded, setTheme, setStudioName, setStudioSlug,
            setLogo, setNotification, setSecurity, setLandingContent, setSmsTemplates,
            setCurrency, setLanguage, setTimezone, setGoogleCalendar, setPausePrice,
            addBranch, removeBranch, updateBranch, setActiveBranch, addStaff, removeStaff,
            updateStaff, markLocalUpdate, addToTrash, restoreFromTrash, clearOldTrash,
            logSubscription, setCustomRoles, setSettings: (s: StudioSettings) => setSettings(s),
            setWizardCompleted, setOwnerInfo,
            claimStudio: async (newSlug: string, ownerEmail: string) => {
                if (typeof window === 'undefined') return;
                const oldSlug = 'demo.classcore.ge';
                const prefixes = [
                    'cc_student_data', 'cc_student_subscriptions', 'cc_groups', 'cc_halls',
                    'cc_calendar_events', 'cc_subscription_plans', 'cc_shop_sales',
                    'cc_checkins', 'cc_studio_settings', 'cc_teachers', 'cc_notifications'
                ];
                const migratedData: Record<string, any> = {};
                prefixes.forEach(prefix => {
                    const val = localStorage.getItem(`${prefix}_${oldSlug}`);
                    if (val) {
                        localStorage.setItem(`${prefix}_${newSlug}`, val);
                        migratedData[`${prefix}_${newSlug}`] = JSON.parse(val);
                    }
                });
                const newSettingsKey = `${STORAGE_KEY}_${newSlug}`;
                const rawSettings = localStorage.getItem(newSettingsKey);
                let newSettings = rawSettings ? JSON.parse(rawSettings) : { ...settings, studioSlug: newSlug };
                if (!newSettings.staff?.find((s: any) => s.role === 'owner')) {
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
                    newSettings.staff = [owner, ...(newSettings.staff || [])];
                }
                localStorage.setItem(newSettingsKey, JSON.stringify(newSettings));
                localStorage.setItem(ACTIVE_SLUG_KEY, newSlug);
                const { pushStudioStateToCloud } = await import('@/lib/sync-store');
                await pushStudioStateToCloud(newSlug, newSettings.staff, migratedData, 0, newSettings.orgId);
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
