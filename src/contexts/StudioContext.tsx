'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { loadSettings, saveSettings } from '@/lib/settings-store';
import { setMemoryStudentsCache } from '@/lib/student-store';
import { useUser } from '@/hooks/useUser';
import { getActiveSlug, getScopedKey, safeSetItem, getLocallyDeletedIds } from '@/lib/utils';
import type { StudioSettings, Branch, SubscriptionLog } from '@/types';

interface StudioContextType {
    settings: StudioSettings;
    updateSettings: (updates: Partial<StudioSettings>) => void;
    isLoaded: boolean;
    loadingStep: string;
    firstSyncDone: boolean;
    isSyncing: boolean;
    activeBranchId: string;
    setActiveBranch: (id: string) => void;
    addBranch: (name: string, address?: string) => void;
    refreshData: () => Promise<void>;
    
    // Setters required by SettingsPage
    setTheme: (key: any) => void;
    setStudioName: (name: string) => void;
    setLogo: (url: string | null) => void;
    setNotification: (key: string, val: boolean) => void;
    setSecurity: (key: string, val: any) => void;
    setCurrency: (cur: 'GEL' | 'USD' | 'EUR') => void;
    setLanguage: (lang: 'ka' | 'ru' | 'en') => void;
    setTimezone: (tz: string) => void;
    updateStaff: (id: string, data: any) => void;
    removeStaff: (id: string) => void;
    removeBranch: (id: string) => void;
    updateBranch: (id: string, data: any) => void;
    setCustomRoles: (roles: any) => void;
    addStaff: (member: any) => void;
    setOwnerInfo: (info: any) => void;
    setSmsTemplates: (templates: any) => void;
    setWizardCompleted: (val: boolean) => void;
    logSubscription: (entry: Omit<SubscriptionLog, 'id' | 'date'>) => void;
    saveSettings: (updates: any, prev?: any, slug?: string) => void;
}

const StudioContext = createContext<StudioContextType | undefined>(undefined);

export const StudioProvider: React.FC<{ children: React.ReactNode; defaultSlug?: string | null; defaultStudioName?: string | null }> = ({ children, defaultSlug, defaultStudioName }) => {
    const { user, profile, loading: userLoading } = useUser();
    
    const [settings, setSettings] = useState<StudioSettings>(() => {
        // 🚀 FAST-PATH: Load identity as early as possible
        const activeSlug = typeof window !== 'undefined' ? (localStorage.getItem('cc_active_studio_slug') || defaultSlug || undefined) : (defaultSlug || undefined);
        const base = loadSettings(activeSlug);
        if (defaultStudioName && !base.studioName) base.studioName = defaultStudioName;
        if (activeSlug && !base.studioSlug) base.studioSlug = activeSlug;
        return base;
    });
    const [isLoaded, setIsLoaded] = useState(false);
    const [loadingStep, setLoadingStep] = useState<string>('');
    const [firstSyncDone, setFirstSyncDone] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [activeBranchId, setActiveBranchId] = useState('main');

    const lastSyncedSlugRef = useRef<string | null>(null);
    const isHydratingRef = useRef(false);
    const hydrate = useCallback(async (isAuto = false) => {
        if (isHydratingRef.current && !isAuto) return;

        // 🛡️ Public marketing/legal/auth pages never need studio data, but
        // this provider wraps the ENTIRE app (see RootLayoutClient), so it
        // used to try to hydrate on every single page load regardless —
        // including for anonymous visitors on "/", "/privacy", "/terms",
        // "/checkin", etc. Skip entirely when there's no logged-in user.
        if (typeof window !== 'undefined' && !user) {
            const noSyncPaths = ['/', '/login', '/registration', '/forgot-password', '/reset-password', '/sa-login', '/privacy', '/terms', '/terms-and-conditions', '/checkin', '/nfc-checkin'];
            if (noSyncPaths.includes(window.location.pathname)) {
                setIsLoaded(true);
                return;
            }
        }

        let activeSlug = getActiveSlug() || defaultSlug || profile?.studio_slug || settings.studioSlug;
        
        // 🔒 AUTH CHECK: Wait for user if we don't have a slug yet
        if (userLoading && !activeSlug) return;

        // 🛡️ RECOVERY: If no slug found, try to recover from profile or identity
        if (!activeSlug || ["auth", "login", "superadmin", "subscriptions", "settings", "dashboard"].includes(activeSlug)) {
             if (profile && profile.studio_slug) {
                 activeSlug = profile.studio_slug;
             } else if (user && !userLoading) {
                 const identitySlug = (user as any).user_metadata?.studio_slug;
                 if (identitySlug) activeSlug = identitySlug;
             }
        }

        if (!activeSlug && !userLoading) {
            console.warn('⚠️ [StudioContext] No slug resolved.');
            setIsLoaded(true); 
            return;
        }

        try {
            if (!isAuto) {
                setIsSyncing(true);
                isHydratingRef.current = true;
            }
            const { createClient } = await import("@/lib/supabase/client");
            const sb = createClient();
            const { data: { session } } = await sb.auth.getSession();
            const token = session?.access_token;
            
            setLoadingStep('სერვერთან დაკავშირება...'); 
            const { fetchFullStudioState } = await import("@/lib/master-sync");

            // 🚀 NUCLEAR DISCOVERY: If orgId is missing, resolve it from the database first
            let currentOrgId = typeof window !== 'undefined' ? (localStorage.getItem(`cc_org_id_override_${activeSlug}`) || undefined) : undefined;
            if (!currentOrgId && activeSlug) {
                console.log(`🔍 [StudioContext] OrgID missing. Starting Nuclear Discovery for slug: ${activeSlug}`);
                const { data: studioData } = await sb.from('studios').select('org_id').eq('studio_slug', activeSlug).maybeSingle();
                if (studioData?.org_id) {
                    currentOrgId = studioData.org_id;
                    await safeSetItem(`cc_org_id_override_${activeSlug}`, currentOrgId!, activeSlug);
                    console.log(`✅ [StudioContext] OrgID Resolved via Discovery: ${currentOrgId}`);
                }
            }

            const state = await fetchFullStudioState(activeSlug || "default", currentOrgId, token, false, undefined, 'core');
                    
            if (state) {
                const resolvedOrgId = state.org_id || currentOrgId || state.studio?.org_id;
                console.log(`📊 [StudioContext] Hydration State Received. OrgID: ${resolvedOrgId}`);

                // 🔐 PERMANENT ORG-ID RESOLUTION (MUST HAPPEN FIRST)
                if (resolvedOrgId && activeSlug) {
                    const orgIdOverrideKey = `cc_org_id_override_${activeSlug}`;
                    // 🚀 SYNC SAVE for critical identity
                    localStorage.setItem(orgIdOverrideKey, resolvedOrgId);
                    localStorage.setItem('cc_active_studio_slug', activeSlug); 
                    
                    // Update Registry
                    const registryRaw = localStorage.getItem('cc_studios_list');
                    let registry = registryRaw ? JSON.parse(registryRaw) : [];
                    if (!registry.includes(activeSlug)) {
                        registry.push(activeSlug);
                        await safeSetItem('cc_studios_list', JSON.stringify(registry), activeSlug);
                    }
                }

                setLoadingStep('მონაცემების სინქრონიზაცია...');
                const settingsObj = (state.settingsRecord?.settings && typeof state.settingsRecord.settings === 'object') ? state.settingsRecord.settings : {};
                const staffDataObj = (state.settingsRecord?.staff_data && typeof state.settingsRecord.staff_data === 'object') ? state.settingsRecord.staff_data : {};
                const cloudSettings = { ...staffDataObj, ...settingsObj };
                const updates = state.studio || {};
                
                // 🚀 SCORCHED EARTH v1.1.16: Force correct name casing for identity
                const rawName = updates.studio_name || cloudSettings.studioName || settings.studioName;
                const finalName = activeSlug === 'stdancestudio' ? 'S_T Dance Studio' : ((rawName && !/^[0-9a-f-]{20,}$/i.test(rawName)) ? rawName : 'S_T Dance Studio');

                // 💎 PLAN RESOLUTION: Admin plan from studios table MUST override everything
                const finalPlan = updates.plan || cloudSettings.plan || settings.plan;

                // 🖼️ LOGO RESOLUTION: 🛡️ PRESERVE LOCAL LOGO IF CLOUD IS EMPTY (Prevent ghosting)
                const localLogo = settings.logoDataUrl;
                const rawCloudLogo = cloudSettings.logoDataUrl || staffDataObj.logoDataUrl || settingsObj.logoDataUrl || updates.logo_url;
                const cloudLogo = (rawCloudLogo && rawCloudLogo !== 'BASE64_BLOB') ? rawCloudLogo : null;
                const finalLogo = cloudLogo || localLogo;

                if (cloudLogo) {
                    console.log(`🖼️ [StudioContext] Logo hydrated from Cloud: ${cloudLogo.startsWith('data:') ? 'BASE64' : 'URL'}`);
                } else if (localLogo) {
                    console.log(`🖼️ [StudioContext] Logo preserved from Local (Cloud was empty)`);
                    // 🚀 SCORCHED EARTH v4.5: Auto-heal cloud state if logo is missing but exists locally
                    const { pushFullStudioMetadata } = await import('@/lib/master-sync');
                    pushFullStudioMetadata(activeSlug, settings.studioName, { ...settings, logoDataUrl: localLogo }, token);
                }

                console.log(`✅ [StudioContext] Identity Resolved: ${activeSlug} (Org: ${resolvedOrgId})`);
                console.log(`💎 [StudioContext] Plan: ${finalPlan} (Master: ${updates.plan}, Blob: ${cloudSettings.plan})`);

                const unwrap = (arr: any) => {
                    if (!Array.isArray(arr)) return [];
                    return arr.map(i => {
                        if (!i) return i;
                        // 🚀 UNIVERSAL MERGE: Combine top-level columns with nested data blob, removing redundant .data
                        if (i.data && typeof i.data === 'object') {
                            const { data, ...rest } = i;
                            return { ...rest, ...data };
                        }
                        return i;
                    });
                };
                const allDeleted = new Set((state.trash || []).map((t: any) => t?.entity_id || t?.id).filter(Boolean));
                // Events the user deleted on THIS device: guards against a
                // hydration response merging back in a slightly-stale
                // cloud/backup snapshot that raced the delete (mirrors the
                // same local-tombstone check event-store.ts's getEvents()
                // already applies, and the `allDeleted`/cloud-trash check
                // subscriptions get below).
                const deletedEventIds = getLocallyDeletedIds(getScopedKey('cc_deleted_calendar_events', activeSlug || 'default'));
                // Halls deleted on THIS device: same tombstone hall-store.ts's
                // deleteHall() now writes and getHalls() itself filters by —
                // without this, a hydration racing a still-in-flight (or
                // silently failed, see deleteHall()'s `.catch(() => {})`)
                // cloud DELETE would resolveRicher() the hall right back in
                // from the cloud/settings-blob snapshot before it propagated.
                const deletedHallIds = getLocallyDeletedIds(getScopedKey('cc_deleted_halls'));

                const resolveRicher = (db: any[], backup: any) => {
                    const dbArr = Array.isArray(db) ? db : [];
                    const backupArr = Array.isArray(backup) ? backup : Object.values(backup || {});
                    if (dbArr.length === 0) return backupArr;
                    const merged = dbArr.map(item => ({ ...item, ...(backupArr.find((b: any) => b.id === item.id) || {}) }));
                    backupArr.forEach(b => { if (!merged.find(m => m.id === b.id)) merged.push(b); });
                    return merged;
                };

                const finalStaff = resolveRicher(state.staff, cloudSettings.staff || settings.staff);
                const finalHalls = resolveRicher(state.halls, cloudSettings.halls || cloudSettings.data?.halls)
                    .filter((h: any) => !deletedHallIds.has(h.id));
                const finalPlans = resolveRicher(state.subscription_plans, cloudSettings.subscription_plans || cloudSettings.plans);
                const finalGroups = resolveRicher(state.groups, cloudSettings.groups || cloudSettings.data?.groups);
                const finalEvents = resolveRicher(state.calendar_events, cloudSettings.calendar_events || cloudSettings.data?.events)
                    .filter((e: any) => !deletedEventIds.has(e.id));
                
                setLoadingStep('ინტერფეისის მომზადება...');

                setSettings(prev => {
                    const name = updates.studio_name || cloudSettings.studioName || prev.studioName;
                    const next = {
                        ...prev, ...cloudSettings,
                        orgId: resolvedOrgId, studioName: finalName, logoDataUrl: finalLogo,
                        staff: unwrap(finalStaff),
                        branches: (state.branches && state.branches.length > 0) ? state.branches : (cloudSettings.branches || prev.branches),
                        plan: finalPlan,
                        subscription_plans: finalPlans,
                        pausePrices: cloudSettings.pausePrices || prev.pausePrices,
                        currency: cloudSettings.currency || prev.currency,
                        language: cloudSettings.language || prev.language,
                        studioSlug: activeSlug || prev.studioSlug
                    };
                    saveSettings(next, prev, activeSlug || prev.studioSlug);
                    return next;
                });

                // 🩺 SELF-HEALING MERGE for students: this used to rebuild
                // cc_student_data from whatever the cloud returned, full stop.
                // If a student never actually made it to Supabase (a schema
                // mismatch on the upsert, a request still in flight, a
                // transient network error) it would vanish from the UI the
                // moment this hydration ran — even though nothing deleted it.
                // Now: start from the cloud list, then bring back any
                // LOCALLY-known student the cloud didn't return, as long as
                // it isn't in the local deleted-tombstone set — and re-push
                // it to the cloud so it gets another chance to persist for
                // real instead of silently disappearing again next hydration.
                // Preserve and accumulate photos so they are never lost across hydrations
                let existingPhotosCore: Record<string, string> = {};
                if (typeof window !== 'undefined') {
                    try {
                        const raw = localStorage.getItem(`cc_student_photos_${activeSlug || 'default'}`);
                        if (raw) existingPhotosCore = JSON.parse(raw);
                    } catch {}
                }

                const cloudStudentsRaw = unwrap(state.students) || [];
                const cloudStudentMap: Record<string, any> = cloudStudentsRaw.reduce((acc: any, s: any) => {
                    if (s && s.photo_url) {
                        existingPhotosCore[s.id] = s.photo_url;
                    } else if (existingPhotosCore[s.id]) {
                        s.photo_url = existingPhotosCore[s.id];
                    }
                    const lite = (s && typeof s.photo_url === 'string' && s.photo_url.startsWith('data:'))
                        ? { ...s, photo_url: undefined }
                        : s;
                    acc[s.id] = lite;
                    return acc;
                }, {});

                if (typeof window !== 'undefined' && cloudStudentsRaw.length > 0) {
                    try {
                        const studentDataKey = getScopedKey('cc_student_data', activeSlug || 'default');
                        const rawLocalStudents = localStorage.getItem(studentDataKey);
                        const localStudentMap = rawLocalStudents ? JSON.parse(rawLocalStudents) : null;

                        const deletedKey = getScopedKey('cc_deleted_students', activeSlug || 'default');
                        const rawDeleted = localStorage.getItem(deletedKey);
                        const deletedStudentIds = new Set<string>(
                            (() => { try { const p = rawDeleted ? JSON.parse(rawDeleted) : []; return Array.isArray(p) ? p : []; } catch { return []; } })()
                        );

                        if (localStudentMap && typeof localStudentMap === 'object' && !Array.isArray(localStudentMap)) {
                            const missingLocalStudents: any[] = [];
                            Object.entries(localStudentMap).forEach(([id, s]) => {
                                if (!cloudStudentMap[id] && !deletedStudentIds.has(id)) {
                                    cloudStudentMap[id] = s;
                                    missingLocalStudents.push(s);
                                }
                            });

                            if (missingLocalStudents.length > 0 && resolvedOrgId) {
                                console.warn(`🩺 [Hydration] ${missingLocalStudents.length} local student(s) missing from cloud — restoring locally and re-pushing:`, missingLocalStudents.map((s: any) => s.id));
                                import('@/lib/master-sync').then(({ syncRecordToCloud }) => {
                                    missingLocalStudents.forEach((s: any) => {
                                        const photo = existingPhotosCore[s.id];
                                        syncRecordToCloud('students', {
                                            id: s.id,
                                            org_id: resolvedOrgId,
                                            first_name: s.first_name || '',
                                            last_name: s.last_name || '',
                                            full_name: s.full_name || '',
                                            phone: s.phone || '',
                                            email: s.email || '',
                                            data: photo ? { ...s, photo_url: photo } : s
                                        }, resolvedOrgId).catch(() => {});
                                    });
                                });
                            }
                        }
                    } catch (e) {
                        console.warn('⚠️ [Hydration] Student merge-and-heal check failed:', e);
                    }
                }

                // 🚀 SCORCHED EARTH v1.1.16: Unified Atomic Hydration
                const mapping: any = {
                    cc_teachers: unwrap(finalStaff),
                    cc_branches: state.branches || [],
                    cc_halls: unwrap(finalHalls),
                    cc_groups: unwrap(finalGroups),
                    cc_student_data: cloudStudentMap,
                    cc_student_subscriptions: (unwrap(state.subscriptions) || [])
                        .filter(sub => !allDeleted.has(sub.id) && !allDeleted.has(`sub_${sub.id}`))
                        .reduce((acc: any, sub: any) => {
                            const sId = sub.student_id;
                            if (sId) {
                                const ids = sId.split(',').map((id: string) => id.trim()).filter(Boolean);
                                ids.forEach((singleId: string) => {
                                    if (!acc[singleId]) acc[singleId] = [];
                                    if (!acc[singleId].some((x: any) => x.id === sub.id)) acc[singleId].push(sub);
                                });
                                if (ids.length > 1) {
                                    if (!acc[sId]) acc[sId] = [];
                                    if (!acc[sId].some((x: any) => x.id === sub.id)) acc[sId].push(sub);
                                }
                            }
                            return acc;
                        }, {}),
                    cc_calendar_events: unwrap(finalEvents),
                    cc_subscription_plans: unwrap(finalPlans),
                    cc_shop_products: unwrap(state.products),
                    cc_shop_sales: (unwrap(state.sales) || []).reduce((acc: any, sale: any) => {
                        const sId = sale.student_id;
                        if (sId) { if (!acc[sId]) acc[sId] = []; acc[sId].push(sale); }
                        return acc;
                    }, {}),
                    cc_expenses: unwrap(state.expenses),
                    cc_global_trash: unwrap(state.trash),
                    cc_sa_meta: { plan: finalPlan, manualBlock: !!updates.manual_block, suspended: !!updates.suspended }
                };

                if (typeof window !== 'undefined') {
                    // 🧠 ALWAYS cache the cloud students in memory FIRST. localStorage
                    // can be over its 5MB quota (base64 photos/logo), in which case the
                    // writes below are silently skipped — and getStudents() then reads
                    // an empty localStorage. The in-memory cache is the reliable source
                    // getStudents() falls back to, so the roster shows regardless.
                    try {
                        const mergedStudents = Object.values(cloudStudentMap).map((s: any) => ({
                            ...s,
                            photo_url: existingPhotosCore[s.id] || s.photo_url
                        }));
                        if (mergedStudents.length > 0) {
                            setMemoryStudentsCache(mergedStudents as any, activeSlug || 'default');
                        }
                        if (Object.keys(existingPhotosCore).length > 0) {
                            try {
                                localStorage.setItem(`cc_student_photos_${activeSlug || 'default'}`, JSON.stringify(existingPhotosCore));
                            } catch {}
                        }
                    } catch (e) { console.warn('memory cache set failed', e); }

                    // Root cause of "data disappears then reappears": a transient
                    // empty cloud response (slow query / error / org mismatch) was
                    // written straight over good local data, blanking the screen
                    // until the next sync. We now refuse to overwrite a non-empty
                    // local collection with an empty cloud result.
                    const isEmpty = (v: any) => {
                        if (v == null) return true;
                        if (Array.isArray(v)) return v.length === 0;
                        if (typeof v === 'object') return Object.keys(v).length === 0;
                        return false;
                    };
                    const localHasData = (scopedKey: string) => {
                        try {
                            const raw = localStorage.getItem(scopedKey);
                            if (!raw) return false;
                            return !isEmpty(JSON.parse(raw));
                        } catch { return false; }
                    };
                    const guardedWrite = async (key: string, data: any) => {
                        if (data === null || data === undefined) return;
                        const scoped = getScopedKey(key, activeSlug || 'default');
                        if (isEmpty(data) && localHasData(scoped)) {
                            console.warn(`🛡️ [Hydration] Empty cloud result for ${key} — preserving local data.`);
                            return;
                        }
                        // 🛡️ Race-condition guard: don't overwrite local array with shorter cloud
                        // array if the local data was edited within the last 2 minutes.
                        // This prevents the "iPad 4→3 plans" bug where a background hydration
                        // fetches a stale cloud snapshot before the new item finishes syncing.
                        if (Array.isArray(data)) {
                            try {
                                const raw = localStorage.getItem(scoped);
                                if (raw) {
                                    const local = JSON.parse(raw);
                                    if (Array.isArray(local) && local.length > data.length) {
                                        const guardKey = `cc_local_edit_guard_${scoped}`;
                                        const editedAt = localStorage.getItem(guardKey);
                                        if (editedAt && Date.now() - parseInt(editedAt) < 120_000) {
                                            console.warn(`🛡️ [Hydration] Local ${key} is newer (${local.length} > ${data.length}), edit < 2min — preserving local.`);
                                            return;
                                        }
                                    }
                                }
                            } catch { /* ignore */ }
                        }
                        await safeSetItem(scoped, JSON.stringify(data), activeSlug || 'default');
                    };

                    // 🚀 SEQUENTIAL SAVING for mobile stability
                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

                    if (isMobile) {
                        for (const [key, data] of Object.entries(mapping)) {
                            await guardedWrite(key, data);
                        }
                    } else {
                        await Promise.all(Object.entries(mapping).map(([key, data]) => guardedWrite(key, data)));
                    }

                    // Attendance mapping
                    // (1) grouped-by-student store (all-time history)
                    // (2) 🔧 per-day cc_checkins_{date} store — this is what the
                    //     attendance page + "+" button actually READ. Previously it
                    //     was never populated from the cloud, so a reload on a second
                    //     device would NOT show today's check-ins from the first.
                    const groupedAtt: Record<string, any[]> = {};
                    const perDay: Record<string, any[]> = {};
                    (unwrap(state.attendance) || []).forEach(a => {
                        if (!a.student_id) return;
                        if (!groupedAtt[a.student_id]) groupedAtt[a.student_id] = [];
                        groupedAtt[a.student_id].push(a);

                        // Rebuild the per-day check-in record the UI expects
                        const blob = (a.data && typeof a.data === 'object') ? a.data : {};
                        const date = a.date || blob.date;
                        if (!date) return;
                        const rec = {
                            id: a.id || blob.id,
                            studentId: a.student_id,
                            studentName: blob.studentName || '',
                            date,
                            time: blob.time || '',
                            via: blob.via || 'manual',
                            sessionsRemaining: typeof blob.sessionsRemaining === 'number' ? blob.sessionsRemaining : -1,
                            classId: blob.classId || a.class_id,
                            groupId: blob.groupId || a.group_id,
                        };
                        if (!rec.id) return;
                        if (!perDay[date]) perDay[date] = [];
                        if (!perDay[date].some(r => r.id === rec.id)) perDay[date].push(rec);
                    });
                    if (!isEmpty(groupedAtt) || !localHasData(getScopedKey('cc_attendance_data', activeSlug))) {
                        await safeSetItem(getScopedKey('cc_attendance_data', activeSlug), JSON.stringify(groupedAtt), activeSlug);
                    }
                    // 🔀 MERGE (union by id) per day rather than overwrite, so a
                    // just-added local check-in that hasn't reached the cloud yet
                    // is never dropped during a background re-sync.
                    for (const [date, recs] of Object.entries(perDay)) {
                        const dayKey = getScopedKey(`cc_checkins_${date}`, activeSlug);
                        let merged = recs;
                        try {
                            const existingRaw = localStorage.getItem(dayKey);
                            if (existingRaw) {
                                const existing = JSON.parse(existingRaw);
                                if (Array.isArray(existing)) {
                                    const seen = new Set(recs.map(r => r.id));
                                    merged = [...recs, ...existing.filter((e: any) => !seen.has(e.id))];
                                }
                            }
                        } catch { /* use cloud recs */ }
                        await safeSetItem(dayKey, JSON.stringify(merged), activeSlug);
                    }

                    window.dispatchEvent(new Event('cc_data_hydrated'));
                    window.dispatchEvent(new Event('cc_settings_update'));
                    window.dispatchEvent(new Event('cc_sa_meta_update'));
                    window.dispatchEvent(new Event('cc_calendar_events_update'));
                    window.dispatchEvent(new Event('cc_student_update'));
                    window.dispatchEvent(new Event('cc_teacher_update'));
                    window.dispatchEvent(new Event('cc_groups_update'));
                    window.dispatchEvent(new Event('cc_halls_update'));
                    
                    ['cc_groups_update', 'cc_halls_update', 'cc_student_update', 'cc_teacher_update', 
                     'cc_subscription_update', 'cc_checkin_update', 'cc_sales_update', 'cc_expense_update', 'cc_trash_update',
                     'cc_subscription_plans_update', 'cc_calendar_events_update', 'cc_attendance_update']
                        .forEach(e => window.dispatchEvent(new Event(e)));

                    // 📡 GO LIVE: subscribe to realtime changes for this org so a
                    // check-in (or roster/subscription edit) on another device shows
                    // up here instantly — no reload required.
                    if (resolvedOrgId) {
                        const { startRealtimeSync } = await import('@/lib/realtime-sync');
                        startRealtimeSync(resolvedOrgId, activeSlug || undefined);
                    }

                    // 🚀 TRIGGER HEAVY BACKGROUND SYNC (Lazy Hydration)
                    setTimeout(async () => {
                        try {
                            const { fetchHeavyStudioState } = await import("@/lib/master-sync");
                            console.log('⏳ [StudioContext] Starting Heavy Background Sync...');
                            const heavyState = await fetchHeavyStudioState(activeSlug || "default", resolvedOrgId, token);
                            
                            if (heavyState) {
                                const { safeSetItem } = await import("@/lib/utils");
                                const { getScopedKey } = await import("@/lib/utils");
                                
                                const unwrap = (arr: any) => {
                                    if (!Array.isArray(arr)) return [];
                                    return arr.map(i => {
                                        if (!i) return i;
                                        if (i.data && typeof i.data === 'object') {
                                            const { data, ...rest } = i;
                                            return { ...rest, ...data };
                                        }
                                        return i;
                                    });
                                };

                                // Save Heavy Blobs
                                // 🛡️ `studentsQueryFailed` (see /api/sync/state) means the
                                // server's students query itself errored and got silently
                                // coerced to `[]` — NOT that the org genuinely has zero
                                // students. Without this check, the self-healing merge
                                // below would read that `[]` as "every local student is
                                // missing from the cloud" and mass re-push stale local
                                // snapshots (clobbering real cloud edits) — the exact
                                // false-positive this block was built to prevent, just
                                // triggered by a failed fetch instead of Core's chunking.
                                if (heavyState.students && !heavyState.studentsQueryFailed) {
                                    const cloudStudents = unwrap(heavyState.students);
                                    const map: any = {};
                                    let existingPhotosHeavy: Record<string, string> = {};
                                    try {
                                        const raw = localStorage.getItem(`cc_student_photos_${activeSlug || 'default'}`);
                                        if (raw) existingPhotosHeavy = JSON.parse(raw);
                                    } catch {}

                                    const photoMap: any = { ...existingPhotosHeavy };
                                    cloudStudents.forEach((s: any) => {
                                        if (s && s.photo_url) {
                                            photoMap[s.id] = s.photo_url;
                                        } else if (photoMap[s.id]) {
                                            s.photo_url = photoMap[s.id];
                                        }
                                        const lite = (s && typeof s.photo_url === 'string' && s.photo_url.startsWith('data:'))
                                            ? { ...s, photo_url: undefined }
                                            : s;
                                        map[s.id] = lite;
                                    });

                                    // 🩺 Same self-healing merge as the core hydration path above:
                                    // this background "heavy" sync used to overwrite cc_student_data
                                    // unconditionally (via safeSetItem, no isEmpty/guard at all), so a
                                    // student that hadn't actually made it to Supabase yet would be
                                    // wiped out by this pass even faster than by the core one. Bring
                                    // back any locally-known, non-deleted student the cloud is
                                    // missing, and give it another chance to sync for real.
                                    const studentDataKey = getScopedKey('cc_student_data', activeSlug || 'default');
                                    try {
                                        const rawLocalStudents = localStorage.getItem(studentDataKey);
                                        const localStudentMap = rawLocalStudents ? JSON.parse(rawLocalStudents) : null;
                                        const rawDeleted = localStorage.getItem(getScopedKey('cc_deleted_students', activeSlug || 'default'));
                                        const deletedStudentIds = new Set<string>(
                                            (() => { try { const p = rawDeleted ? JSON.parse(rawDeleted) : []; return Array.isArray(p) ? p : []; } catch { return []; } })()
                                        );
                                        if (localStudentMap && typeof localStudentMap === 'object' && !Array.isArray(localStudentMap)) {
                                            const missingLocalStudents: any[] = [];
                                            Object.entries(localStudentMap).forEach(([id, s]) => {
                                                if (!map[id] && !deletedStudentIds.has(id)) {
                                                    map[id] = s;
                                                    missingLocalStudents.push(s);
                                                }
                                            });
                                            if (missingLocalStudents.length > 0 && resolvedOrgId) {
                                                console.warn(`🩺 [Hydration/Heavy] ${missingLocalStudents.length} local student(s) missing from cloud — restoring locally and re-pushing:`, missingLocalStudents.map((s: any) => s.id));
                                                import('@/lib/master-sync').then(({ syncRecordToCloud }) => {
                                                    missingLocalStudents.forEach((s: any) => {
                                                        const photo = photoMap[s.id] || existingPhotosHeavy[s.id];
                                                        syncRecordToCloud('students', {
                                                            id: s.id,
                                                            org_id: resolvedOrgId,
                                                            first_name: s.first_name || '',
                                                            last_name: s.last_name || '',
                                                            full_name: s.full_name || '',
                                                            phone: s.phone || '',
                                                            email: s.email || '',
                                                            data: photo ? { ...s, photo_url: photo } : s
                                                        }, resolvedOrgId).catch(() => {});
                                                    });
                                                });
                                            }
                                        }
                                    } catch (e) {
                                        console.warn('⚠️ [Hydration/Heavy] Student merge-and-heal check failed:', e);
                                    }

                                    const { setMemoryStudentsCache } = await import('@/lib/student-store');
                                    const mergedStudentsWithPhotos = Object.values(map).map((s: any) => ({
                                        ...s,
                                        photo_url: photoMap[s.id] || s.photo_url
                                    }));
                                    if (mergedStudentsWithPhotos.length > 0) {
                                        setMemoryStudentsCache(mergedStudentsWithPhotos as any, activeSlug || 'default');
                                    }

                                    await safeSetItem(studentDataKey, JSON.stringify(map), activeSlug || 'default');
                                    if (Object.keys(photoMap).length > 0) {
                                        await safeSetItem(`cc_student_photos_${activeSlug || 'default'}`, JSON.stringify(photoMap), activeSlug || 'default');
                                    }
                                    window.dispatchEvent(new Event('cc_student_update'));
                                } else if (heavyState.studentsQueryFailed) {
                                    console.warn('⚠️ [Hydration/Heavy] Students query failed server-side this cycle — leaving cc_student_data/cc_student_photos untouched (will retry on next hydration).');
                                }
                                if (heavyState.attendance) {
                                    // 🔧 Attendance logic needs to populate cc_attendance_data AND cc_checkins_...
                                    const groupedAtt: Record<string, any[]> = {};
                                    const perDay: Record<string, any[]> = {};
                                    unwrap(heavyState.attendance).forEach((a: any) => {
                                        if (!a.student_id) return;
                                        if (!groupedAtt[a.student_id]) groupedAtt[a.student_id] = [];
                                        groupedAtt[a.student_id].push(a);

                                        const blob = (a.data && typeof a.data === 'object') ? a.data : {};
                                        const date = a.date || blob.date;
                                        if (!date) return;
                                        const rec = {
                                            id: a.id || blob.id,
                                            studentId: a.student_id,
                                            studentName: blob.studentName || '',
                                            date,
                                            time: blob.time || '',
                                            via: blob.via || 'manual',
                                            sessionsRemaining: typeof blob.sessionsRemaining === 'number' ? blob.sessionsRemaining : -1,
                                            classId: blob.classId || a.class_id,
                                            groupId: blob.groupId || a.group_id,
                                        };
                                        if (!rec.id) return;
                                        if (!perDay[date]) perDay[date] = [];
                                        if (!perDay[date].some(r => r.id === rec.id)) perDay[date].push(rec);
                                    });
                                    await safeSetItem(getScopedKey('cc_attendance_data', activeSlug || 'default'), JSON.stringify(groupedAtt), activeSlug || 'default');
                                    for (const [date, recs] of Object.entries(perDay)) {
                                        const dayKey = getScopedKey(`cc_checkins_${date}`, activeSlug || 'default');
                                        let merged = recs;
                                        try {
                                            const existingRaw = localStorage.getItem(dayKey);
                                            if (existingRaw) {
                                                const existing = JSON.parse(existingRaw);
                                                if (Array.isArray(existing)) {
                                                    const seen = new Set(recs.map(r => r.id));
                                                    merged = [...recs, ...existing.filter((e: any) => !seen.has(e.id))];
                                                }
                                            }
                                        } catch { /* use cloud recs */ }
                                        await safeSetItem(dayKey, JSON.stringify(merged), activeSlug || 'default');
                                    }
                                }
                                if (heavyState.sales) {
                                    const map: any = {};
                                    unwrap(heavyState.sales).forEach((s: any) => {
                                        const sId = s.student_id;
                                        if (sId) { if (!map[sId]) map[sId] = []; map[sId].push(s); }
                                    });
                                    await safeSetItem(getScopedKey('cc_shop_sales', activeSlug || 'default'), JSON.stringify(map), activeSlug || 'default');
                                }
                                if (heavyState.expenses) {
                                    const map: any = {};
                                    unwrap(heavyState.expenses).forEach((e: any) => map[e.id] = e);
                                    await safeSetItem(getScopedKey('cc_expenses', activeSlug || 'default'), JSON.stringify(map), activeSlug || 'default');
                                }
                                if (heavyState.calendar_events) {
                                    // event-store.ts's getEvents() requires this key to hold a plain
                                    // ARRAY (`Array.isArray(events)`, else it discards whatever was
                                    // stored and falls back to the seed/empty list). This used to
                                    // build an `{id: event}` map instead — the same shape used for
                                    // collections that genuinely are id-keyed (e.g. students) — which
                                    // meant every background heavy-sync silently wiped out calendar
                                    // events shortly after they were hydrated.
                                    const list = unwrap(heavyState.calendar_events)
                                        .filter((e: any) => !deletedEventIds.has(e.id));
                                    await safeSetItem(getScopedKey('cc_calendar_events', activeSlug || 'default'), JSON.stringify(list), activeSlug || 'default');
                                }
                                if (heavyState.trash) {
                                    const map: any = {};
                                    unwrap(heavyState.trash).forEach((t: any) => map[t.id || t.entity_id] = t);
                                    await safeSetItem(getScopedKey('cc_global_trash', activeSlug || 'default'), JSON.stringify(map), activeSlug || 'default');
                                }
                                if (heavyState.subscriptions) {
                                    const map: any = {};
                                    const allDeleted = new Set((heavyState.trash || []).map((t: any) => t?.entity_id || t?.id).filter(Boolean));
                                    unwrap(heavyState.subscriptions)
                                        .filter((sub: any) => !allDeleted.has(sub.id) && !allDeleted.has(`sub_${sub.id}`))
                                        .forEach((s: any) => {
                                            const sId = s.student_id;
                                            if (sId) {
                                                const ids = sId.split(',').map((id: string) => id.trim()).filter(Boolean);
                                                ids.forEach((singleId: string) => {
                                                    if (!map[singleId]) map[singleId] = [];
                                                    if (!map[singleId].some((x: any) => x.id === s.id)) map[singleId].push(s);
                                                });
                                                if (ids.length > 1) {
                                                    if (!map[sId]) map[sId] = [];
                                                    if (!map[sId].some((x: any) => x.id === s.id)) map[sId].push(s);
                                                }
                                            }
                                        });
                                    await safeSetItem(getScopedKey('cc_student_subscriptions', activeSlug || 'default'), JSON.stringify(map), activeSlug || 'default');
                                }
                                
                                if (heavyState.products) {
                                    // Same array-vs-map mismatch as calendar_events above:
                                    // product-store.ts requires `cc_shop_products` to be an array
                                    // (`Array.isArray(parsed) ? parsed : INITIAL_PRODUCTS`), so writing
                                    // an `{id: product}` map here got silently discarded on next read.
                                    const list = unwrap(heavyState.products);
                                    await safeSetItem(getScopedKey('cc_shop_products', activeSlug || 'default'), JSON.stringify(list), activeSlug || 'default');
                                }

                                if (heavyState.subscription_plans) {
                                    const plansList = unwrap(heavyState.subscription_plans);
                                    if (plansList.length > 0) {
                                        await safeSetItem(getScopedKey('cc_subscription_plans', activeSlug || 'default'), JSON.stringify(plansList), activeSlug || 'default');
                                    }
                                }

                                // Merge into settings context for products/plans
                                setSettings(prev => ({
                                    ...prev,
                                    subscription_plans: heavyState.subscription_plans?.length ? unwrap(heavyState.subscription_plans) : prev.subscription_plans
                                }));

                                console.log('✅ [StudioContext] Heavy Background Sync Complete!');
                                window.dispatchEvent(new Event('cc_heavy_data_ready'));
                                
                                ['cc_groups_update', 'cc_halls_update', 'cc_student_update', 'cc_teacher_update', 
                                 'cc_subscription_update', 'cc_checkin_update', 'cc_sales_update', 'cc_expense_update', 'cc_trash_update',
                                 'cc_subscription_plans_update', 'cc_calendar_events_update', 'cc_attendance_update']
                                    .forEach(e => window.dispatchEvent(new Event(e)));
                            }
                        } catch (err) {
                            console.error('❌ [StudioContext] Heavy Background Sync Failed:', err);
                        }
                    }, 500);
                }

            } else {
                const { ensureStudioExists } = await import("@/lib/master-sync");
                await ensureStudioExists(activeSlug || "default", settings.studioName);
            }
        } catch (err) {
            console.error('❌ [StudioContext] Hydration failed:', err);
        } finally {
            setIsSyncing(false);
            isHydratingRef.current = false;
            setFirstSyncDone(true);
            setIsLoaded(true);
        }
    }, [defaultSlug, userLoading]);

    // 🚀 Targeted Hydration Trigger
    const lastUserRef = useRef<string | null>(null);
    const lastSlugRef = useRef<string | null>(null);

    useEffect(() => {
        const currentUserId = user?.id || null;
        const currentSlug = profile?.studio_slug || null;

        if (currentUserId !== lastUserRef.current || currentSlug !== lastSlugRef.current) {
            console.log('🚀 [ClassCore] System Initializing (v1.1.10)...');
            lastUserRef.current = currentUserId;
            lastSlugRef.current = currentSlug;
            hydrate();
        }
    }, [user?.id, profile?.studio_slug, hydrate]);

    // 🛡️ SAFETY FALLBACK: Ensure isLoaded becomes true within 3s no matter what
    useEffect(() => {
        if (isLoaded) return;
        const timer = setTimeout(() => {
            console.warn('⚠️ [StudioContext] Safety hydration timeout reached (3s) — setting isLoaded to true.');
            setIsLoaded(true);
        }, 3000);
        return () => clearTimeout(timer);
    }, [isLoaded]);

    useEffect(() => {
        const interval = setInterval(() => hydrate(true), 300000);
        return () => clearInterval(interval);
    }, [hydrate]);

    // 📡 Tear down the realtime channel when the provider unmounts (logout / app close).
    useEffect(() => {
        return () => {
            import('@/lib/realtime-sync').then(({ stopRealtimeSync }) => stopRealtimeSync());
        };
    }, []);

    const updateSettings = useCallback((updates: Partial<StudioSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...updates };
            import('@/lib/settings-store').then(mod => mod.saveSettings(updates, prev, prev.studioSlug));
            if (prev.studioSlug && prev.orgId) {
                const metadata = { ...next, settings: next };
                import('@/lib/master-sync').then(mod => {
                    mod.pushFullStudioMetadata(prev.studioSlug, updates.studioName || prev.studioName, metadata);
                });
            }
            return next;
        });
    }, []);

    // SETTERS FOR SETTINGS PAGE
    const setTheme = (key: any) => updateSettings({ themeKey: key });
    const setStudioName = (name: string) => updateSettings({ studioName: name });
    
    const setLogo = async (url: string | null) => {
        if (url && url.startsWith('data:image/')) {
            // 🚀 SCORCHED EARTH v4.3: Compress high-res logos to prevent sync failure
            try {
                const img = new Image();
                img.src = url;
                await new Promise((res) => (img.onload = res));
                
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 300; // 🚀 Even smaller for guaranteed sync
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                
                // Compress to JPEG for smaller size
                const compressed = canvas.toDataURL('image/jpeg', 0.5);
                console.log(`🖼️ [StudioContext] Logo Compressed: ${Math.round(compressed.length/1024)}KB`);
                updateSettings({ logoDataUrl: compressed });
            } catch (e) {
                console.error('Logo compression failed:', e);
                updateSettings({ logoDataUrl: url });
            }
        } else {
            updateSettings({ logoDataUrl: url });
        }
    };
    const setNotification = (key: string, val: boolean) => updateSettings({ notifications: { ...settings.notifications, [key]: val } });
    const setSecurity = (key: string, val: any) => updateSettings({ security: { ...settings.security, [key]: val } });
    const setCurrency = (cur: 'GEL' | 'USD' | 'EUR') => updateSettings({ currency: cur });
    const setLanguage = (lang: 'ka' | 'ru' | 'en') => updateSettings({ language: lang });
    const setTimezone = (tz: string) => updateSettings({ timezone: tz });
    // These three used to only call updateSettings() and stop there — no
    // `cc_teacher_update` event ever fired for an edit made from the
    // Teachers page (unlike teacher-store.ts's own updateTeacher(), which
    // does dispatch it). Pages that only refresh on that event — like
    // Analytics's salary/revenue numbers — never found out a teacher's
    // rate or percentage had changed, and kept showing stale numbers until
    // a full reload. Dispatch it here too, and keep teacher-store.ts's
    // memory cache (used as a localStorage-full fallback) from ever
    // shadowing a fresher edit made through this path.
    const notifyStaffChanged = (nextStaff: any[]) => {
        if (typeof window === 'undefined') return;
        import('@/lib/teacher-store').then(({ setTeachersMemoryCache }) => {
            setTeachersMemoryCache(nextStaff as any, getActiveSlug() || settings.studioSlug || 'default');
        });
        window.dispatchEvent(new Event('cc_teacher_update'));
    };
    const updateStaff = (id: string, data: any) => {
        const next = settings.staff?.map((s: any) => s.id === id ? { ...s, ...data } : s) || [];
        updateSettings({ staff: next });
        notifyStaffChanged(next);
    };
    const removeStaff = (id: string) => {
        const next = settings.staff?.filter((s: any) => s.id !== id) || [];
        updateSettings({ staff: next });
        notifyStaffChanged(next);
    };
    const addStaff = (member: any) => {
        const next = [...(settings.staff || []), member];
        updateSettings({ staff: next });
        notifyStaffChanged(next);
    };
    const removeBranch = (id: string) => updateSettings({ branches: settings.branches.filter(b => b.id !== id) });
    const updateBranch = (id: string, data: any) => updateSettings({ branches: settings.branches.map(b => b.id === id ? { ...b, ...data } : b) });
    const setCustomRoles = (roles: any) => updateSettings({ customRoles: roles });
    const setOwnerInfo = (info: any) => updateSettings({ owner_info: info });
    const setSmsTemplates = (templates: any) => updateSettings({ sms_templates: templates });
    const setWizardCompleted = (val: boolean) => updateSettings({ isWizardCompleted: val });
    const logSubscription = (entry: Omit<SubscriptionLog, 'id' | 'date'>) => {
        const newLog: SubscriptionLog = {
            ...entry,
            id: `sublog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            date: new Date().toISOString(),
        };
        updateSettings({ subscriptionLogs: [newLog, ...(settings.subscriptionLogs || [])] });
    };

    const setActiveBranch = useCallback((branchId: string) => {
        setSettings(prev => {
            const next = { ...prev, activeBranchId: branchId };
            setActiveBranchId(branchId);
            safeSetItem(`cc_active_branch_${prev.studioSlug}`, branchId, prev.studioSlug);
            saveSettings({ activeBranchId: branchId }, prev, prev.studioSlug);
            window.dispatchEvent(new CustomEvent('cc_branch_change', { detail: { branchId } }));
            return next;
        });
    }, []);

    const addBranch = useCallback((name: string, address?: string) => {
        setSettings(prev => {
            const newBranch: Branch = { id: `br_${Date.now()}`, name, address, is_active: true };
            const next = { ...prev, branches: [...prev.branches, newBranch] };
            saveSettings({ branches: next.branches }, prev, prev.studioSlug);
            return next;
        });
    }, []);

    const refreshData = async () => {
        await hydrate();
    };

    return (
        <StudioContext.Provider value={{
            settings, updateSettings, isLoaded, loadingStep, firstSyncDone, isSyncing,
            activeBranchId, setActiveBranch, addBranch, refreshData,
            setTheme, setStudioName, setLogo, setNotification, setSecurity, setCurrency, setLanguage, setTimezone, updateStaff, removeStaff, removeBranch, updateBranch, setCustomRoles, addStaff, setOwnerInfo, setSmsTemplates, setWizardCompleted, logSubscription, saveSettings
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
