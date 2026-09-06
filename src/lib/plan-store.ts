/**
 * plan-store.ts
 * Persists available subscription plans to localStorage.
 */

export type PlanType = 'group' | 'individual' | 'rental';
export type Period = 'sessions' | 'monthly' | 'unlimited';

export interface Plan {
    id: string;
    name: string;
    type: PlanType;
    period: Period;
    session_count?: number;
    validity_days?: number;
    price: number;
    coach?: string;
    group_id?: string;
    is_active: boolean;
    is_default?: boolean;
    data?: any;
}

import { getScopedKey, markLocalUpdate, getActiveSlug, getEffectiveOrgId, getLocallyDeletedIds, addLocallyDeletedId } from './utils';
import { loadSettings } from './settings-store';
import { triggerInstantSync } from './sync-store';
import { syncRecordToCloud } from './master-sync';

const BASE_PLANS_KEY = 'cc_subscription_plans';
function getPlansKey(slug?: string) {
    const s = slug || getActiveSlug() || 'demo.classcore.ge';
    return getScopedKey(BASE_PLANS_KEY, s);
}

const BASE_DELETED_PLANS_KEY = 'cc_deleted_subscription_plans';
function getDeletedPlansKey() {
    return getScopedKey(BASE_DELETED_PLANS_KEY);
}

const INITIAL_PLANS: Plan[] = [];

// 🚀 MEMORY CACHE: Fallback when localStorage is full
let _plansMemoryCache: Plan[] | null = null;
let _plansMemoryCacheSlug: string | null = null;

export function setPlansMemoryCache(plans: Plan[], slug: string) {
    _plansMemoryCache = plans;
    _plansMemoryCacheSlug = slug;
    console.log(`💾 [PlanStore] Memory cache set: ${plans.length} plans`);
}

export function getPlans(): Plan[] {
    if (typeof window === 'undefined') return INITIAL_PLANS;
    try {
        const activeSlug = getActiveSlug() || 'demo.classcore.ge';
        const key = getPlansKey(activeSlug);
        let saved = localStorage.getItem(key);

        const deletedIds = getLocallyDeletedIds(getDeletedPlansKey());

        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                const normalized = parsed
                    .map(item => {
                        if (!item || typeof item !== 'object') return item;
                        const data = (item.data && typeof item.data === 'object') ? item.data : {};
                        const merged = { ...data, ...item };
                        return {
                            ...merged,
                            is_active: item.is_active !== undefined ? (item.is_active !== false && item.is_active !== 'false') : (data.is_active !== undefined ? (data.is_active !== false && data.is_active !== 'false') : true),
                            is_default: item.is_default !== undefined ? !!item.is_default : !!data.is_default
                        };
                    })
                    .filter((p: any) => !p || !p.id || !deletedIds.has(p.id));
                _plansMemoryCache = normalized;
                _plansMemoryCacheSlug = activeSlug;
                return normalized;
            }
            return INITIAL_PLANS;
        }

        // 🚀 Fall back to memory cache
        if (_plansMemoryCache && _plansMemoryCacheSlug === activeSlug) {
            console.log('💾 [PlanStore] Using memory cache');
            return _plansMemoryCache.filter((p: any) => !p || !p.id || !deletedIds.has(p.id));
        }

        return INITIAL_PLANS;
    } catch {
        return INITIAL_PLANS;
    }
}

export async function savePlans(plans: Plan[]): Promise<void> {
    if (typeof window === 'undefined') return;
    const activeSlug = getActiveSlug() || 'demo.classcore.ge';
    const key = getPlansKey(activeSlug);
    
    _plansMemoryCache = plans;
    _plansMemoryCacheSlug = activeSlug;
    try {
        localStorage.setItem(key, JSON.stringify(plans));
        // 🛡️ Race-condition guard: prevents background hydration from overwriting
        // freshly-saved local plans with an older cloud snapshot (e.g. iPad 4→3 bug)
        localStorage.setItem(`cc_local_edit_guard_${key}`, String(Date.now()));
    } catch (e) {
        console.error('❌ [PlanStore] localStorage write failed (falling back to memory cache):', e);
    }
    markLocalUpdate();
    
    // 🔥 ATOMIC SYNC: Push ALL plan fields to the cloud
    const settings = loadSettings(activeSlug);
    const orgId = getEffectiveOrgId(activeSlug);
    
    if (orgId && orgId !== 'demo') {
        // 1. Individual record sync (for reporting/analytics)
        for (const plan of plans) {
            try {
                await syncRecordToCloud('subscription_plans', {
                    id: plan.id,
                    org_id: orgId,
                    name: plan.name,
                    type: plan.type,
                    price: plan.price,
                    period: plan.period,
                    session_count: plan.session_count,
                    validity_days: plan.validity_days,
                    is_active: plan.is_active,
                    coach_name: plan.coach,
                    group_id: plan.group_id,
                    data: plan
                }, orgId);
            } catch (err) {
                console.warn('⚠️ [PlanStore] Individual plan sync failed:', err);
            }
        }

        // 2. 🔥 FOOLPROOF SCHEMA-LESS FALLBACK: Save full list into settings blob
        const nextSettings = { ...settings, subscription_plans: plans };
        const { saveSettings } = await import('./settings-store');
        saveSettings(nextSettings, settings, activeSlug);
        
        const { pushFullStudioMetadata } = await import('./master-sync');
        const studioName = settings.studioName || 'Studio';
        await pushFullStudioMetadata(activeSlug, studioName, nextSettings);
    }

    // Explicit signal for UI and StudioContext
    window.dispatchEvent(new Event('cc_subscription_plans_update'));
    triggerInstantSync();
}

export async function deletePlan(id: string): Promise<void> {
    addLocallyDeletedId(getDeletedPlansKey(), id);
    const plans = getPlans();
    const next = plans.filter(p => p.id !== id);
    const activeSlug = getActiveSlug() || 'demo.classcore.ge';
    const key = getPlansKey(activeSlug);
    _plansMemoryCache = next;
    _plansMemoryCacheSlug = activeSlug;
    try {
        localStorage.setItem(key, JSON.stringify(next));
    } catch (e) {
        console.error('❌ [PlanStore] localStorage write failed on delete (falling back to memory cache):', e);
    }
    markLocalUpdate();

    const settings = loadSettings(activeSlug);
    const orgId = getEffectiveOrgId(activeSlug);
    
    if (orgId && orgId !== 'demo') {
        import('./master-sync').then(({ deleteRecordFromCloud }) => {
            deleteRecordFromCloud('subscription_plans', id, orgId);
        });

        // Update fallback blob
        import('./settings-store').then(({ loadSettings, saveSettings }) => {
            const settings = loadSettings(activeSlug);
            (settings as any).subscription_plans = next;
            saveSettings(settings, settings, activeSlug);
            
            import('./master-sync').then(({ pushFullStudioMetadata }) => {
                const studioName = (settings as any).studioName || 'Studio';
                pushFullStudioMetadata(activeSlug, studioName, settings);
            });
        });
    }

    window.dispatchEvent(new Event('cc_subscription_plans_update'));
    triggerInstantSync();
}
