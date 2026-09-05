/**
 * subscription-store.ts
 * Persists student subscription data to localStorage for the demo.
 */

import { updateStudent, getStudents } from './student-store';

export interface SubscriptionInfo {
    id: string;
    student_id: string;
    plan: string;
    sessions_used: number;
    sessions_total: number | null;
    status: 'active' | 'expired' | 'paused';
    expires_at: string;
    purchased_at: string;
    teacher_comment?: string;
    type: 'sessions' | 'monthly';
    plan_type?: 'group' | 'individual' | 'rental';
    group_id?: string;
    category?: string; // e.g. 'Dance', 'Salsa', 'Yoga'
    is_default?: boolean;
    // Payment info
    payment_method?: 'cash' | 'card' | 'transfer';
    amount_paid?: number;
    teacher_id?: string;
    // Individual lesson schedule slots
    schedule?: Array<{ day: number; time: string; endTime: string; hallId?: string }>;
    color?: string;
}

type SubMap = Record<string, SubscriptionInfo[]>;

import { getStaffSession, loadSettings, saveSettings } from './settings-store';
import { recordAuditAction } from './audit-store';
import { getScopedKey, getActiveSlug, getLocalISODate, markLocalUpdate, recordGlobalDeletion, getEffectiveOrgId, makeEntityId } from './utils';
import { pushStudioStateToCloud } from './sync-store';
import { syncRecordToCloud, deleteRecordFromCloud, pushFullStudioMetadata } from './master-sync';

const BASE_SUBS_KEY = 'cc_student_subscriptions';
const BASE_DELETED_SUBS_KEY = 'cc_deleted_subscriptions';

function getSubsKey() { return getScopedKey(BASE_SUBS_KEY); }
function getDeletedSubsKey() { return getScopedKey(BASE_DELETED_SUBS_KEY); }

// Initial mock data
const INITIAL_SUBS: SubMap = {};

// 🚀 MEMORY CACHE: Fallback when localStorage is full
let _subsMemoryCache: SubMap | null = null;
let _subsMemoryCacheSlug: string | null = null;

export function setSubscriptionsMemoryCache(subs: SubMap, slug: string) {
    _subsMemoryCache = subs;
    _subsMemoryCacheSlug = slug;
    const count = Object.values(subs).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
    console.log(`💾 [SubscriptionStore] Memory cache set: ${count} subscriptions for ${Object.keys(subs).length} students`);
}

// --- Performance Caching ---
let cachedSubs: SubMap | null = null;
function clearCache() { cachedSubs = null; }

export function getSubscriptions(): SubMap {
    if (typeof window === 'undefined') return INITIAL_SUBS;
    if (cachedSubs) return cachedSubs;
    
    try {
        const activeSlug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : 'demo.classcore.ge';
        const activeBranch = typeof window !== 'undefined' ? (localStorage.getItem(`cc_active_branch_${activeSlug}`) || 'main') : 'main';
        const isMainBranch = activeBranch === 'main';

        const key = getSubsKey();
        let saved = localStorage.getItem(key);

        // 🚀 Fall back to memory cache if localStorage empty
        if (!saved && _subsMemoryCache && _subsMemoryCacheSlug === activeSlug) {
            console.log('💾 [SubscriptionStore] Using memory cache');
            cachedSubs = _subsMemoryCache;
            return _subsMemoryCache;
        }

        // Migration: If new scoped key is empty, check old unscoped key
        if (!saved && isMainBranch) {
            const oldKey = `cc_student_subscriptions_${activeSlug}`;
            saved = localStorage.getItem(oldKey);
            if (saved) {
                console.log('🚚 [SubscriptionStore] Migrating legacy main branch data');
                localStorage.setItem(key, saved);
            }
        }

        // Cleanup orphaned subscriptions for deleted students removed - too dangerous during hydration race conditions

        const deletedKey = getDeletedSubsKey();
        let deletedSubIds = new Set<string>();
        try {
            const rawDeleted = localStorage.getItem(deletedKey);
            if (rawDeleted) {
                const parsed = JSON.parse(rawDeleted);
                if (Array.isArray(parsed)) deletedSubIds = new Set(parsed);
            }
        } catch (e) {
            console.warn('⚠️ [SubscriptionStore] Failed to parse deleted IDs:', e);
        }

        let data: SubMap;
        if (!saved) {
            data = isMainBranch ? JSON.parse(JSON.stringify(INITIAL_SUBS)) : {};
        } else {
            const parsed = JSON.parse(saved);
            data = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
        }

        // Filter and Normalize data
        const allStudents = getStudents();
        const studentIdSet = new Set(allStudents.map(s => s.id));
        let dataChanged = false;

        Object.keys(data).forEach(studentId => {
            // Support multi-student comma-separated IDs (e.g. "MU7698233, EA8819242" for couple subscriptions)
            const sIds = studentId.split(',').map(x => x.trim()).filter(Boolean);
            const hasAnyStudent = sIds.some(id => studentIdSet.has(id));

            // Safety: Only delete from local if we have a robust list of students
            // and we are CERTAIN this student is missing (not just a sync delay)
            if (studentIdSet.size > 10 && !hasAnyStudent) {
                delete data[studentId];
                dataChanged = true;
                return;
            }
            if (Array.isArray(data[studentId])) {
                data[studentId] = data[studentId]
                    .filter(sub => !deletedSubIds.has(sub.id))
                    .map(sub => ({
                        ...sub,
                        // Ensure required fields for UI
                        plan_type: sub.plan_type || (sub.plan?.toLowerCase().includes('ინდ') || sub.plan?.toLowerCase().includes('indiv') ? 'individual' : 'group'),
                        type: sub.type || (sub.sessions_total === null ? 'monthly' : 'sessions')
                    }));
            } else {
                delete data[studentId];
                dataChanged = true;
            }
            if (data[studentId]?.length === 0) {
                delete data[studentId];
                dataChanged = true;
            }
        });

        if (dataChanged) {
            localStorage.setItem(key, JSON.stringify(data));
        }

        // Migration: Old format was Record<string, SubscriptionInfo>
        // and keys were '1', '2' instead of 'S-2051' etc.
        let needsMigration = false;
        const keys = Object.keys(data);
        if (keys.length > 0 && !Array.isArray(data[keys[0]])) {
            needsMigration = true;
        }

        if (needsMigration) {
            const migrated: SubMap = {};
            keys.forEach(k => {
                const sub = (data as any)[k];
                const studentId = sub.student_id;
                if (!studentId || studentId === 'undefined') return; // Skip invalid entries
                if (!migrated[studentId]) migrated[studentId] = [];
                migrated[studentId].push({
                    ...sub,
                    id: sub.id || `sub_${Date.now()}_${k}`,
                    purchased_at: sub.purchased_at ?? sub.expires_at // Fallback
                });
            });
            localStorage.setItem(getSubsKey(), JSON.stringify(migrated));
            return migrated;
        }

        // Migration: Ensure all subs have a 'type' and 'plan_type'
        let changed = false;
        Object.keys(data).forEach(studentId => {
            data[studentId].forEach((sub: SubscriptionInfo) => {
                if (!sub.type) {
                    sub.type = sub.sessions_total !== null ? 'sessions' : 'monthly';
                    changed = true;
                }
                if (!sub.plan_type || (sub.plan_type === 'group' && sub.plan && (sub.plan.includes('ინდ') || sub.plan.toLowerCase().includes('individual')))) {
                    // Older subs without plan_type default to group, unless name implies individual
                    if (sub.plan && (sub.plan.includes('ინდ') || sub.plan.toLowerCase().includes('individual'))) {
                        sub.plan_type = 'individual';
                    } else if (!sub.plan_type) {
                        sub.plan_type = 'group';
                    }
                    changed = true;
                }
            });
        });
        if (changed && typeof window !== 'undefined') {
            localStorage.setItem(getSubsKey(), JSON.stringify(data));
        }

        cachedSubs = data;
        return data;
    } catch {
        return INITIAL_SUBS;
    }
}

export function saveSubscription(studentId: string, info: SubscriptionInfo): void {
    if (!studentId || studentId === 'undefined') {
        console.error('saveSubscription: invalid studentId', studentId);
        return;
    }

    const studentIds = studentId.split(',').map(id => id.trim()).filter(Boolean);
    const data = getSubscriptions();
    clearCache();
    
    // Ensure ID exists
    if (!info.id) {
        (info as any).id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    }

    studentIds.forEach(id => {
        if (!data[id]) data[id] = [];
        const idx = data[id].findIndex(s => s.id === info.id);
        if (idx > -1) {
            data[id][idx] = { ...info, student_id: studentId }; // Keep original multi-id in field
        } else {
            data[id].push({ ...info, student_id: studentId });
        }
    });

    localStorage.setItem(getSubsKey(), JSON.stringify(data));
    markLocalUpdate();

    // 🚀 Update memory cache
    const slugForCache = getActiveSlug() || '';
    if (slugForCache) {
        _subsMemoryCache = data;
        _subsMemoryCacheSlug = slugForCache;
    }
    
    // 🔥 NEW ATOMIC SYNC: Push this specific subscription to the native table
    const activeSlug = getActiveSlug() || '';
    const orgId = getEffectiveOrgId(activeSlug);
    
    if (orgId && orgId !== 'demo') {
        const settings = loadSettings(activeSlug);
        const payload = {
            id: info.id || makeEntityId('SUB'),
            org_id: orgId,
            student_id: studentId,
            status: info.status || 'active',
            sessions_used: info.sessions_used || 0,
            sessions_total: info.sessions_total ?? null,
            expires_at: info.expires_at || null,
            data: info
        };
        
        syncRecordToCloud('subscriptions', payload, orgId).catch(() => {});

        // 🔥 FOOLPROOF SCHEMA-LESS FALLBACK: Also update the settings blob
        // This is shared across all devices and used for 'rescue' recovery
        const updatedSubs = Object.values(data).flat();
        const updatedSettings = { ...settings, subscriptions: updatedSubs };
        saveSettings({ subscriptions: updatedSubs } as any, settings, activeSlug || '');
        
        const studioName = (settings as any).studioName || 'Studio';
        pushFullStudioMetadata(activeSlug || '', studioName, updatedSettings);
    }

    if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_subscription_update'));
}

export function getStudentSubscriptions(studentId: string): SubscriptionInfo[] {
    const subs = getSubscriptions();
    
    // Find all subscriptions that belong to this student, including shared ones
    const allSubs: SubscriptionInfo[] = [];
    const lowerId = studentId.toLowerCase();

    Object.values(subs).forEach(subList => {
        subList.forEach(sub => {
            if (!sub.student_id) return;
            const ids = sub.student_id.split(',').map(id => id.trim().toLowerCase());
            if (ids.includes(lowerId)) {
                // Avoid duplicates if a student is listed multiple times
                if (!allSubs.find(s => s.id === sub.id)) {
                    allSubs.push(sub);
                }
            }
        });
    });
    
    return allSubs.filter(s => s.status === 'active' || s.status === 'expired' || s.status === 'paused');
}

/** 
 * Returns the currently active subscription for a student.
 * Can be filtered by groupId and planType (group/individual).
 */
export function getSubscription(
    studentId: string,
    groupId?: string,
    planType?: 'group' | 'individual' | 'rental',
    includeExpiredWithSessions: boolean = false
): SubscriptionInfo | null {
    if (!studentId || studentId === 'undefined') return null;
    const subs = getStudentSubscriptions(studentId);
    if (!Array.isArray(subs) || subs.length === 0) return null;

    const todayStr = getLocalISODate();

    // Priority 1: Filter by specific group/type if provided
    let candidateSubs = subs.filter(s => {
        if (s.status === 'active' && s.expires_at >= todayStr) return true;
        
        // New logic for portal: Include expired if they have sessions left
        if (includeExpiredWithSessions) {
            const used = s.sessions_used || 0;
            if (s.sessions_total === null) return true;
            return used < s.sessions_total;
        }
        return false;
    });
    
    // Filter by planType if specified (group/individual/rental)
    if (planType) {
        candidateSubs = candidateSubs.filter(s => {
            if (!s.plan_type) return planType === 'group'; // Default legacy to group
            return s.plan_type === planType;
        });
    }

    // Filter and sort for auto-continuation
    const valid = candidateSubs.filter(s => {
        if (groupId && s.group_id && s.group_id !== groupId) return false;

        const isSessionBased = s.type === 'sessions' || (s.sessions_total !== null && !s.type);
        if (isSessionBased) {
            if (s.sessions_total === null) return true;
            const used = s.sessions_used || 0;
            return used < s.sessions_total;
        }
        return true; // monthly
    });

    if (valid.length === 0) return null;

    // 1. Prioritize manual default
    const manualDefault = valid.find(s => s.is_default);
    if (manualDefault) return manualDefault;

    // 2. Prioritize oldest purchased (for auto-continuation)
    return [...valid].sort((a, b) => {
        const pA = a.purchased_at || a.expires_at || '';
        const pB = b.purchased_at || b.expires_at || '';
        return pA.localeCompare(pB);
    })[0];
}

export function setDefaultSubscription(studentId: string, subId: string): void {
    const all = getSubscriptions();
    if (all[studentId]) {
        all[studentId] = all[studentId].map(s => ({
            ...s,
            is_default: s.id === subId
        }));
        localStorage.setItem(getSubsKey(), JSON.stringify(all));
        markLocalUpdate();

        // Immediate Cloud Sync
        const activeSlug = getActiveSlug();
        if (activeSlug && activeSlug !== 'demo.classcore.ge') {
            pushStudioStateToCloud(activeSlug, [], { [getSubsKey()]: all });
        }


        if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_subscription_update'));
    }
}

export function deleteSubscription(studentId: string, subId: string): void {
    const data = getSubscriptions();
    clearCache();
    
    let subToDelete: SubscriptionInfo | null = null;
    let primaryKey = studentId;

    // Scan all keys to find the subscription
    for (const key of Object.keys(data)) {
        const found = data[key].find(s => s.id === subId);
        if (found) {
            subToDelete = found;
            primaryKey = key;
            data[key] = data[key].filter(s => s.id !== subId);
            if (data[key].length === 0) delete data[key];
            break;
        }
    }

    if (!subToDelete) return;

    const sub = subToDelete;
    const activeSlug = getActiveSlug();
    const session = typeof window !== 'undefined' ? getStaffSession() : null;
    const performedBy = session?.staff.full_name || 'System';
    const auditSettings = loadSettings(activeSlug || '');
    const branchName = auditSettings.branches.find(b => b.id === (auditSettings.activeBranchId || 'main'))?.name || 'Main';
    
    // Fetch student name for the log
    const student = getStudents().find(s => s.id === studentId);
    const studentName = student?.full_name || studentId;

    recordGlobalDeletion(activeSlug || '', 'cc_student_subscriptions', subId, {
        ...sub,
        details: sub.plan || sub.id,
        performedBy,
        branchName,
        branchId: auditSettings.activeBranchId || 'main',
        studentId,
        studentName,
        amount: sub.amount_paid
    });

    localStorage.setItem(getSubsKey(), JSON.stringify(data));
    markLocalUpdate();
    markLocalUpdate();

    // 🚀 Update memory cache after deletion
    const slugForCache = activeSlug || '';
    if (slugForCache) {
        _subsMemoryCache = data;
        _subsMemoryCacheSlug = slugForCache;
    }

    // 🔥 PREVENT RESURRECTION: Add to local deleted IDs list
    try {
        const deletedKey = getDeletedSubsKey();
        const raw = localStorage.getItem(deletedKey);
        const deletedList = raw ? JSON.parse(raw) : [];
        if (Array.isArray(deletedList) && !deletedList.includes(subId)) {
            deletedList.push(subId);
            localStorage.setItem(deletedKey, JSON.stringify(deletedList));
        }
    } catch (e) {
        console.error('Failed to update deleted IDs:', e);
    }

    // 🔥 ATOMIC DELETION
    const finalOrgId = getEffectiveOrgId(activeSlug || '');

    if (finalOrgId && finalOrgId !== 'demo') {
        const settings = loadSettings(activeSlug || '');
        // 1. Permanent Deletion from Table
        deleteRecordFromCloud('subscriptions', subId, finalOrgId).catch(() => {});

        // 2. Add to Cloud Trash (Prevent Resurrection)
        syncRecordToCloud('trash', {
            id: `del_${Date.now()}_${subId}`,
            entity_id: subId,
            entity_type: 'cc_student_subscriptions',
            org_id: finalOrgId,
            name: `${studentName || 'Student'} - ${sub.plan || 'Plan'}`,
            data: { ...sub, name: studentName, fullName: studentName } // Ensure UI can find a name
        }, finalOrgId).catch(() => {});

        // 3. Update recovery settings blob
        const updatedSubs = Object.values(data).flat();
        const updatedSettings = { ...settings, subscriptions: updatedSubs };
        
        saveSettings({ subscriptions: updatedSubs } as any, settings, activeSlug || '');
        const studioName = (settings as any).studioName || 'Studio';
        pushFullStudioMetadata(activeSlug || '', studioName, updatedSettings);
    }

    if (typeof window !== 'undefined') {
        const todayStr = new Date().toISOString().split('T')[0];

        // 1. Clear checkins logic for testing
        const cKey = getScopedKey(`cc_checkins_${todayStr}`);
        const cSaved = localStorage.getItem(cKey);
        if (cSaved) {
            try {
                const cData = JSON.parse(cSaved);
                const filtered = cData.filter((r: any) => r.studentId !== studentId);
                localStorage.setItem(cKey, JSON.stringify(filtered));
            } catch (e) { /* ignore */ }
        }

        // 2. Clear UI checkmarks
        const archiveKey = getScopedKey('cc_attendance_archive');
        const saved = localStorage.getItem(archiveKey);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data[todayStr]) {
                    Object.keys(data[todayStr]).forEach(classId => {
                        if (data[todayStr][classId][studentId]) {
                            delete data[todayStr][classId][studentId];
                        }
                    });
                    localStorage.setItem(archiveKey, JSON.stringify(data));
                }
            } catch (e) { /* ignore */ }
        }

        window.dispatchEvent(new Event('cc_subscription_update'));
        window.dispatchEvent(new Event('cc_attendance_update')); // Custom trigger if needed
    }
}

export function renewSubscription(studentId: string): SubscriptionInfo | null {
    const sub = getSubscription(studentId);
    if (!sub) return null;

    // Renew for another 30 days
    const date = new Date(sub.expires_at);
    date.setDate(date.getDate() + 30);

    const newSub: SubscriptionInfo = {
        ...sub,
        status: 'active',
        expires_at: date.toISOString().split('T')[0],
        sessions_used: 0, // Reset sessions if applicable
    };

    saveSubscription(studentId, newSub);
    return newSub;
}

export function pauseSubscription(studentId: string): SubscriptionInfo | null {
    const sub = getSubscription(studentId);
    if (!sub) return null;

    const newSub: SubscriptionInfo = {
        ...sub,
        status: sub.status === 'paused' ? 'active' : 'paused',
    };

    saveSubscription(studentId, newSub);
    return newSub;
}

export function pauseActiveSubscription(studentId: string, subId: string, days: number, price: number = 0): SubscriptionInfo | null {
    const subs = getSubscriptions()[studentId] || [];
    const subIndex = subs.findIndex(s => s.id === subId);
    if (subIndex === -1) return null;

    const sub = subs[subIndex];

    // Deduct price from balance if > 0
    if (price > 0) {
        const student = getStudents().find((s: any) => s.id === studentId);
        if (student) {
            const currentBalance = student.balance || 0;
            updateStudent(studentId, { balance: currentBalance - price });
        }
    }

    const date = new Date(sub.expires_at);
    date.setDate(date.getDate() + days);

    const newSub: SubscriptionInfo = {
        ...sub,
        status: 'paused', // change status to paused explicitly
        expires_at: date.toISOString().split('T')[0],
    };

    saveSubscription(studentId, newSub);
    return newSub;
}

export function incrementSessionsUsed(studentId: string, subId?: string, planType?: 'group' | 'individual' | 'rental'): SubscriptionInfo | null {
    if (!studentId || studentId === 'undefined') return null;

    let active: SubscriptionInfo | null = null;
    if (subId) {
        const subs = getStudentSubscriptions(studentId);
        active = subs.find(s => s.id === subId) || null;
    } else {
        active = getSubscription(studentId, undefined, planType);
    }

    if (!active) return null;

    const todayStr = getLocalISODate();
    if (active.expires_at < todayStr) {
        active.status = 'expired';
        saveSubscription(active.student_id || studentId, active);
        return active;
    }

    const isSessionBased = active.type === 'sessions' || (active.sessions_total !== null && !active.type);
    if (isSessionBased) {
        active.sessions_used++;
        if (active.sessions_total !== null && active.sessions_used >= active.sessions_total) {
            active.status = 'expired';
        }
    }

    saveSubscription(active.student_id || studentId, active);
    return active;
}

export function refundSessionsUsed(studentId: string): SubscriptionInfo | null {
    const subs = getStudentSubscriptions(studentId);
    if (subs.length === 0) return null;

    // Most recent purchased first
    const sorted = [...subs].sort((a, b) => (b.purchased_at || '').localeCompare(a.purchased_at || ''));
    const toRefund = sorted.find(s => s.sessions_used > 0);

    if (toRefund) {
        toRefund.sessions_used = Math.max(0, toRefund.sessions_used - 1);
        if (toRefund.status === 'expired' && (toRefund.sessions_total === null || toRefund.sessions_used < toRefund.sessions_total)) {
            // Check if still expired by date
            const expiry = new Date(toRefund.expires_at);
            if (expiry >= new Date()) {
                toRefund.status = 'active';
            }
        }
        saveSubscription(toRefund.student_id || studentId, toRefund);
        return toRefund;
    }
    return null;
}


export function getSubscriptionStats() {
    const all = getSubscriptions();
    const subs = Object.values(all).flat();
    const now = new Date();
    const currentMonth = now.toISOString().split('-').slice(0, 2).join('-'); // YYYY-MM

    return {
        total: subs.length,
        active: subs.filter(s => {
            const exp = new Date(s.expires_at);
            exp.setHours(23, 59, 59, 999);
            return s.status === 'active' && exp >= now;
        }).length,
        expired: subs.filter(s => {
            const exp = new Date(s.expires_at);
            exp.setHours(23, 59, 59, 999);
            return s.status === 'expired' || exp < now;
        }).length,
        newThisMonth: subs.filter(s => s.purchased_at && s.purchased_at.startsWith(currentMonth)).length,
    };
}
