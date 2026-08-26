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
}

import { getScopedKey, markLocalUpdate, getActiveSlug, getEffectiveOrgId } from './utils';
import { loadSettings } from './settings-store';
import { triggerInstantSync } from './sync-store';
import { syncRecordToCloud } from './master-sync';

const BASE_PLANS_KEY = 'cc_subscription_plans';
function getPlansKey(slug?: string) {
    const s = slug || getActiveSlug() || 'demo.classcore.ge';
    return getScopedKey(BASE_PLANS_KEY, s);
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

        if (saved) {
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed) ? parsed : INITIAL_PLANS;
        }
        
        // 🚀 Fall back to memory cache
        if (_plansMemoryCache && _plansMemoryCacheSlug === activeSlug) {
            console.log('💾 [PlanStore] Using memory cache');
            return _plansMemoryCache;
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
    
    localStorage.setItem(key, JSON.stringify(plans));
    // 🛡️ Race-condition guard: prevents background hydration from overwriting
    // freshly-saved local plans with an older cloud snapshot (e.g. iPad 4→3 bug)
    localStorage.setItem(`cc_local_edit_guard_${key}`, String(Date.now()));
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
    const plans = getPlans();
    const next = plans.filter(p => p.id !== id);
    const activeSlug = getActiveSlug() || 'demo.classcore.ge';
    const key = getPlansKey(activeSlug);
    localStorage.setItem(key, JSON.stringify(next));
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
