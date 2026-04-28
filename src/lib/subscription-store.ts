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
}

type SubMap = Record<string, SubscriptionInfo[]>;

import { getStaffSession, loadSettings } from './settings-store';
import { recordAuditAction } from './audit-store';
import { getScopedKey, getActiveSlug, getLocalISODate, markLocalUpdate, recordGlobalDeletion } from './utils';
import { pushStudioStateToCloud } from './sync-store';
import { syncRecordToCloud } from './master-sync';

const BASE_SUBS_KEY = 'cc_student_subscriptions';
const BASE_DELETED_SUBS_KEY = 'cc_deleted_subscriptions';

function getSubsKey() { return getScopedKey(BASE_SUBS_KEY); }
function getDeletedSubsKey() { return getScopedKey(BASE_DELETED_SUBS_KEY); }

// Initial mock data
const INITIAL_SUBS: SubMap = {};

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

        // Migration: If new scoped key is empty, check old unscoped key
        if (!saved && isMainBranch) {
            const oldKey = `cc_student_subscriptions_${activeSlug}`;
            saved = localStorage.getItem(oldKey);
            if (saved) {
                console.log('🚚 [SubscriptionStore] Migrating legacy main branch data');
                localStorage.setItem(key, saved);
            }
        }

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

        // Filter out deleted IDs and Normalize data
        Object.keys(data).forEach(studentId => {
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
            }
            if (data[studentId]?.length === 0) {
                delete data[studentId];
            }
        });

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
    const data = getSubscriptions();
    clearCache();
    if (!data[studentId]) data[studentId] = [];
    
    // Ensure ID exists (AID + 10 digits)
    if (!info.id) {
        (info as any).id = `AID${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    }

    const idx = data[studentId].findIndex(s => s.id === info.id);
    if (idx > -1) {
        data[studentId][idx] = info;
    } else {
        data[studentId].push(info);
    }
    localStorage.setItem(getSubsKey(), JSON.stringify(data));
    markLocalUpdate();
    
    // 🔥 NEW ATOMIC SYNC: Push this specific subscription to the native table
    const activeSlug = getActiveSlug();
    const settings = loadSettings(activeSlug || '');
    const orgId = settings.orgId || localStorage.getItem(`cc_org_id_${activeSlug}`);
    if (orgId && orgId !== 'demo') {
        syncRecordToCloud('subscriptions', {
            id: info.id || `sub_${Date.now()}`,
            org_id: orgId,
            student_id: studentId
        }, orgId).catch(() => {});

        // 🔥 FOOLPROOF SCHEMA-LESS FALLBACK
        import('./settings-store').then(({ loadSettings, saveSettings }) => {
            const settings = loadSettings(activeSlug);
            (settings as any).subscriptions = Object.values(updatedSubs).flat();
            saveSettings(settings, settings, activeSlug);
        });
    }

    // Legacy sync trigger (keep for transition if needed, though native takes priority)
    if (activeSlug && activeSlug !== 'demo.classcore.ge') {
        pushStudioStateToCloud(activeSlug, [], { [getSubsKey()]: data });
    }

    if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_subscription_update'));
}

export function getStudentSubscriptions(studentId: string): SubscriptionInfo[] {
    return getSubscriptions()[studentId] ?? [];
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
    if (!data[studentId]) return;

    const sub = data[studentId].find(s => s.id === subId);
    if (!sub) return;

    data[studentId] = data[studentId].filter(s => s.id !== subId);
    if (data[studentId].length === 0) delete data[studentId]; // Remove student entry if no subscriptions left
    
    const slug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : null;
    if (slug) {
        recordGlobalDeletion(slug, 'cc_student_subscriptions', subId);
    }

    localStorage.setItem(getSubsKey(), JSON.stringify(data));
    markLocalUpdate();

    // Immediate Cloud Sync
    const activeSlug = getActiveSlug();
    if (activeSlug && activeSlug !== 'demo.classcore.ge') {
        pushStudioStateToCloud(activeSlug, [], { 
            [getSubsKey()]: data,
            [getDeletedSubsKey()]: deletedIds
        });
    }


    // GLOBAL AUDIT LOG
    const session = typeof window !== 'undefined' ? getStaffSession() : null;
    const currentSlug = typeof window !== 'undefined' ? getActiveSlug() : '';
    if (currentSlug && sub) {
        const settings = loadSettings(currentSlug);
        const branchName = settings.branches.find(b => b.id === (settings.activeBranchId || 'main'))?.name || 'Main';

        recordAuditAction({
            action: 'subscription_deleted',
            details: `Subscription Deleted: ${sub.plan} (${sub.id})`, // Changed plan_name to plan
            studentId,
            branchId: settings.activeBranchId || 'main',
            branchName,
            performedBy: session?.staff.full_name || 'System'
        });
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

export function incrementSessionsUsed(studentId: string, subId?: string): SubscriptionInfo | null {
    if (!studentId || studentId === 'undefined') return null;

    let active: SubscriptionInfo | null = null;
    if (subId) {
        const subs = getStudentSubscriptions(studentId);
        active = subs.find(s => s.id === subId) || null;
    } else {
        active = getSubscription(studentId);
    }

    if (!active) return null;

    const todayStr = getLocalISODate();
    if (active.expires_at < todayStr) {
        active.status = 'expired';
        saveSubscription(studentId, active);
        return active;
    }

    const isSessionBased = active.type === 'sessions' || (active.sessions_total !== null && !active.type);
    if (isSessionBased) {
        active.sessions_used++;
        if (active.sessions_total !== null && active.sessions_used >= active.sessions_total) {
            active.status = 'expired';
        }
    }

    saveSubscription(studentId, active);
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
        saveSubscription(studentId, toRefund);
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
