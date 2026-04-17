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
        if (!cloudState || !activeSlug) return false;
        let changed = false;

        console.log('📡 [StudioContext] Converging state for:', activeSlug);

        // 1. Merge Staff List
        const local = loadSettings(activeSlug);
        if (cloudState.staff_data) {
            const cloudStaffStr = JSON.stringify(cloudState.staff_data);
            const localStaffStr = JSON.stringify(local.staff);
            if (cloudStaffStr !== localStaffStr) {
                const key = getScopedKey(STORAGE_KEY, activeSlug);
                const nextSettings = { ...local, staff: cloudState.staff_data };
                localStorage.setItem(key, JSON.stringify(nextSettings));
                setSettings(nextSettings);
                changed = true;
            }
        }

        // 2. Converge Operational Data
        if (cloudState.studio_data) {
            import('@/lib/sync-store').then(({ mergeStudioData }) => {
                const cloudStudioData = cloudState.studio_data; // Pre-scoped by the pull engine
                const localStudioData: Record<string, any> = {};
                
                import('@/lib/utils').then(({ SYNC_COLLECTIONS }) => {
                    // Gather only local data matching this studio's scope
                    Object.keys(localStorage).forEach(k => {
                        const isSyncablePrefix = SYNC_COLLECTIONS.some(p => k.startsWith(p));
                        const belongsToStudio = k.includes(`_${activeSlug}`) || (settings.orgId && k.includes(`_${settings.orgId}`));
                        if (isSyncablePrefix && belongsToStudio) {
                            try {
                                const val = localStorage.getItem(k);
                                if (val) localStudioData[k] = JSON.parse(val);
                            } catch {}
                        }
                    });

                    const converged = mergeStudioData(cloudStudioData, localStudioData);
                    let syncChanged = false;

                    Object.keys(converged).forEach(key => {
                        const nextValStr = JSON.stringify(converged[key]);
                        const curValRaw = localStorage.getItem(key);
                        if (nextValStr !== curValRaw) {
                            localStorage.setItem(key, nextValStr);
                            syncChanged = true;
                            changed = true;
                        }
                    });

                    if (syncChanged) {
                        import('@/lib/utils').then(({ consolidateStudioKeys }) => {
                            consolidateStudioKeys(activeSlug, settings.orgId);
                            performUniversalIntegrityCheck(activeSlug);
                            console.log('📡 [StudioContext] UI update triggered from atomic convergence');
                            ['cc_attendance_update', 'cc_groups_update', 'cc_calendar_events_update', 'cc_student_update', 'cc_teacher_update']
                                .forEach(e => window.dispatchEvent(new Event(e)));
                        });
                    }
                });
            });
        }

        return changed;
    }, [settings.staff]);
                    const next = loadSettings(activeSlug);
                    setSettings(next);
                    
                    const events = [
                        'cc_active_branch_change', 'cc_settings_update', 'cc_student_update', 
                        'cc_groups_update', 'cc_halls_update', 'cc_subscription_update', 
                        'cc_calendar_events_update', 'cc_checkins_update'
                    ];
                    events.forEach(e => window.dispatchEvent(new Event(e)));
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
            if (!activeSlug || activeSlug === 'demo.classcore.ge' || activeSlug === 'superadmin') {
                console.log('📡 [StudioContext] Skipping cloud pull for:', activeSlug);
                setFirstSyncDone(true);
                setIsLoaded(true);
                return;
            }

            console.log('📡 [StudioContext] Mounting & Pulling latest state for:', activeSlug);
            
            import('@/lib/sync-store').then(({ fetchStaffFromCloud, pullStudioStateFromCloud }) => {
                const targetScopeId = settings.orgId || activeSlug;
                Promise.all([
                    fetchStaffFromCloud(activeSlug),
                    pullStudioStateFromCloud(activeSlug, targetScopeId)
                ]).then(([cloudStaff, cloudState]) => {
                    hasSyncedRef.current = true;
                    
                    if (cloudStaff && cloudStaff.length > 0) {
                        setSettings(prev => saveSettings({ staff: cloudStaff }, prev, activeSlug));
                    }

                    if (cloudState) {
                        import('@/lib/utils').then(({ consolidateStudioKeys }) => {
                            consolidateStudioKeys(activeSlug, settings.orgId);
                            applyCloudState(activeSlug, cloudState);
                        });
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

    // Automatic Cloud Sync Pulse
    useEffect(() => {
        const timer = setTimeout(() => {
            // CRITICAL SEQUENCING: We must NEVER push local state until we have successfully PULLed from the cloud.
            // This prevents new devices (like phones) from "wiping" the cloud with their local empty state.
            if (!isLoaded || !firstSyncDone || !settings.studioSlug || settings.studioSlug === 'demo.classcore.ge' || settings.studioSlug === 'superadmin') return;

            import('@/lib/utils').then(({ SYNC_COLLECTIONS }) => {
                const studioData: Record<string, any> = {};
                const keys = Object.keys(localStorage);
                
                const authoritativeScopeId = settings.orgId || settings.studioSlug!;
                keys.forEach(k => {
                    const isSyncablePrefix = SYNC_COLLECTIONS.some(p => k.startsWith(p));
                    // STRICT SCOPING: Only pick up keys belonging to the CURRENT authoritative silo
                    const belongsToActiveSilo = k.endsWith(`_${authoritativeScopeId}`);
                    
                    if (isSyncablePrefix && belongsToActiveSilo) {
                        try {
                            const val = localStorage.getItem(k);
                            if (val) studioData[k] = JSON.parse(val);
                        } catch (e) {
                             console.error('⚠️ [SyncPulse] Failed to parse key:', k, e);
                        }
                    }
                });

                import('@/lib/sync-store').then(({ pushStudioStateToCloud }) => {
                    const isFresh = localStorage.getItem(`cc_is_fresh_${settings.studioSlug}`) === 'true';
                    // Use FRESH settings from loadSettings if available to avoid React state lag
                    const freshSettings = loadSettings(settings.studioSlug!);
                    
                    pushStudioStateToCloud(settings.studioSlug!, freshSettings.staff || [], studioData, 0, settings.orgId, isFresh).then(() => {
                        if (isFresh) localStorage.removeItem(`cc_is_fresh_${settings.studioSlug}`);
                    });
                });
            });
        }, 1500); // Increased to 1.5s to ensure local multi-key writes (like group + schedule) are finished

        return () => clearTimeout(timer);
    }, [isLoaded, firstSyncDone, settings, pushCounter]);

    // Realtime Pulse updates
    useEffect(() => {
        if (!isLoaded || !settings.studioSlug || settings.studioSlug === 'demo.classcore.ge' || settings.studioSlug === 'superadmin') return;

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
                    const targetScopeId = settings.orgId || settings.studioSlug!;
                    pullStudioStateFromCloud(settings.studioSlug!, targetScopeId).then(state => {
                        if (state) applyCloudState(settings.studioSlug!, state);
                    });
                });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [settings.studioSlug, isLoaded, applyCloudState]);

    useEffect(() => {
        const handleAutoMark = () => {
            // CRITICAL: Refresh the local React state from localStorage immediately
            // so that the SyncPulse effect uses the LATEST values in its next run.
            if (settings.studioSlug) {
                console.log('🔄 [StudioContext] Refreshing state for current studio:', settings.studioSlug);
                const fresh = loadSettings(settings.studioSlug);
                setSettings(fresh);
            }
            
            markLocalUpdate();
            triggerPush();
        };

        const events = [
            'cc_groups_update', 'cc_halls_update', 'cc_student_update', 'cc_teacher_update',
            'cc_subscription_update', 'cc_subscription_plans_update', 'cc_calendar_events_update', 
            'cc_checkins_update', 'cc_attendance_update', 'cc_shop_update', 'cc_settings_update',
            'cc_salary_update', 'cc_active_branch_change'
        ];

        events.forEach(e => window.addEventListener(e, handleAutoMark));
        return () => events.forEach(e => window.removeEventListener(e, handleAutoMark));
    }, [markLocalUpdate, triggerPush, settings.studioSlug]);

    // Auto-sync from profile and First-Time Sync Protection
    useEffect(() => {
        if (!isLoaded || !profile) return;
        
        // Check if this is a brand new session/registration that needs cloud protection
        const isNewReg = localStorage.getItem('cc_onboarding_in_progress') === 'true' || 
                         localStorage.getItem(`cc_is_fresh_${profile.studio_slug}`) === 'true';

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
            
            // Mark as fresh to trigger a force-overwrite on the next sync pulse
            localStorage.setItem(`cc_is_fresh_${profile.studio_slug}`, 'true');
            cleanupRegistry(); // Wipe all local data to be safe
            return;
        }

        if (isDefaultName && profile.studio_name && profile.studio_name !== settings.studioName) {
            setStudioName(profile.studio_name || '');
        }

        if (profile.first_name || profile.phone) {
            const hasMissingMetadata = !settings.owner_info?.first_name || !settings.owner_info?.phone;
            if (hasMissingMetadata) {
                console.log('📡 [StudioContext] Syncing missing owner metadata from profile');
                setOwnerInfo({
                    first_name: profile.first_name || settings.owner_info?.first_name || '',
                    last_name: profile.last_name || settings.owner_info?.last_name || '',
                    email: user?.email || profile.email || settings.owner_info?.email || '',
                    phone: profile.phone || settings.owner_info?.phone || ''
                });
            }
        }

        if (profile.org_id && profile.org_id !== settings.orgId && !isDefaultName) {
            // 🚨 NUCLEAR STORAGE ISOLATION GUARD
            // This sweep ensures that NO data from any other studio remains in active memory
            // when switching to a new account, effectively preventing cross-account pollution universally.
            console.warn('🚨 [StudioContext] OrgId mismatch detected. Enforcing nuclear storage isolation.');
            
            const currentSlug = profile.studio_slug;
            const currentOrgId = profile.org_id;

            import('@/lib/utils').then(({ PROTECTED_GLOBAL_KEYS }) => {
                const keys = Object.keys(localStorage);
                keys.forEach(k => {
                    // We target all our internal keys (cc_)
                    if (k.startsWith('cc_')) {
                        // EXCEPTION: Protected global keys (like study registry, auth etc.)
                        if (PROTECTED_GLOBAL_KEYS.some(pk => k.startsWith(pk))) return;

                        // EXCEPTION: Keys that already belong to the CURRENT studio session
                        const belongsToCurrent = k.includes(`_${currentSlug}`) || k.includes(`_${currentOrgId}`);
                        if (belongsToCurrent) return;

                        // NUCLEAR PURGE: This key belongs to a different studio session.
                        console.log('🧹 [NuclearIsolation] Purging orphaned data key:', k);
                        localStorage.removeItem(k);
                    }
                });
            });

            setSettings(prev => saveSettings({ orgId: profile.org_id }, prev, prev.studioSlug));
        }
    }, [user?.email, profile, settings, setStudioName, setStudioSlug, isLoaded, setOwnerInfo]);

    useEffect(() => { applyTheme(settings.themeKey); }, [settings.themeKey]);

    useEffect(() => {
        if (isLoaded && settings.studioSlug) {
            performUniversalIntegrityCheck(settings.studioSlug);
        }
    }, [isLoaded, settings.studioSlug]);

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

/**
 * Nuclear Platform Integrity Guard:
 * Automatically purges orphans and "ghost" records across all collections
 * when our sync engine detects deletions (via tombstones).
 */
function performUniversalIntegrityCheck(slug: string) {
    if (typeof window === 'undefined' || !slug) return;
    
    console.log('🛡️ [IntegrityCheck] Running global self-healing sweep...');

    // 1. Gather Deletion Tombstones
    const getTombstone = (base: string) => {
        const raw = localStorage.getItem(`${base}_${slug}`);
        try { return new Set(raw ? JSON.parse(raw) : []); } catch { return new Set(); }
    };

    const deletedGroups = getTombstone('cc_deleted_groups');
    const deletedStudents = getTombstone('cc_deleted_students');

    if (deletedGroups.size === 0 && deletedStudents.size === 0) return;

    // 2. Scan & Purge: Calendar Events
    const eventsKey = `cc_calendar_events_${slug}`;
    const rawEvents = localStorage.getItem(eventsKey);
    if (rawEvents) {
        try {
            const events = JSON.parse(rawEvents);
            if (Array.isArray(events)) {
                const healthy = events.filter((e: any) => 
                    (!e.group_id || !deletedGroups.has(e.group_id)) &&
                    (!e.student_id || !deletedStudents.has(e.student_id))
                );
                if (healthy.length < events.length) {
                    console.log(`🧹 [IntegrityCheck] Purged ${events.length - healthy.length} orphaned events`);
                    localStorage.setItem(eventsKey, JSON.stringify(healthy));
                }
            }
        } catch {}
    }

    // 3. Scan & Purge: Attendance Archive
    const archiveKey = `cc_attendance_archive_${slug}`;
    const rawArchive = localStorage.getItem(archiveKey);
    if (rawArchive) {
        try {
            const archive = JSON.parse(rawArchive);
            let archiveChanged = false;
            
            // Format: { "2024-04-15": { "event_id": { "student_id": "present" } } }
            Object.keys(archive).forEach(date => {
                Object.keys(archive[date]).forEach(eventId => {
                    // Check if eventId belongs to a deleted group (Events IDs usually start with grp_[groupId])
                    const isGroupEvent = eventId.startsWith('grp_');
                    const groupId = isGroupEvent ? eventId.split('_')[1] : null;
                    
                    if (groupId && deletedGroups.has(groupId)) {
                        delete archive[date][eventId];
                        archiveChanged = true;
                    } else {
                        // Also filter internal student records
                        const studentRecords = archive[date][eventId] || {};
                        let recordPurged = false;
                        Object.keys(studentRecords).forEach(studentId => {
                            if (deletedStudents.has(studentId)) {
                                delete archive[date][eventId][studentId];
                                archiveChanged = true;
                                recordPurged = true;
                            }
                        });

                        // If class is empty after purging students, purge class
                        if (Object.keys(archive[date][eventId] || {}).length === 0) {
                            delete archive[date][eventId];
                            archiveChanged = true;
                        }
                    }
                });
                
                // If day is empty, purge it
                if (Object.keys(archive[date] || {}).length === 0) {
                    delete archive[date];
                    archiveChanged = true;
                }
            });

            if (archiveChanged) {
                console.log('🧹 [IntegrityCheck] Purged orphaned records from Attendance Archive');
                localStorage.setItem(archiveKey, JSON.stringify(archive));
            }
        } catch {}
    }
}
