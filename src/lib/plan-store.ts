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
}

import { getScopedKey, markLocalUpdate } from './utils';

const BASE_PLANS_KEY = 'cc_subscription_plans';
function getPlansKey() { return getScopedKey(BASE_PLANS_KEY); }

const INITIAL_PLANS: Plan[] = [];

export function getPlans(): Plan[] {
    if (typeof window === 'undefined') return INITIAL_PLANS;
    try {
        const activeSlug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : 'demo.classcore.ge';
        const activeBranch = typeof window !== 'undefined' ? (localStorage.getItem(`cc_active_branch_${activeSlug}`) || 'main') : 'main';
        const isMainBranch = activeBranch === 'main';

        const key = getPlansKey();
        let saved = localStorage.getItem(key);

        // Migration: If new scoped key is empty, check old unscoped key
        if (!saved && isMainBranch) {
            const oldKey = `cc_subscription_plans_${activeSlug}`;
            saved = localStorage.getItem(oldKey);
            if (saved) {
                console.log('🚚 [PlanStore] Migrating legacy main branch data');
                localStorage.setItem(key, saved);
            }
        }

        if (!saved) {
            const data = isMainBranch ? INITIAL_PLANS : [];
            if (isMainBranch) localStorage.setItem(key, JSON.stringify(data));
            return data;
        }
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : INITIAL_PLANS;
    } catch {
        return INITIAL_PLANS;
    }
}

export async function savePlans(plans: Plan[]): Promise<void> {
    if (typeof window === 'undefined') return;
    const key = getPlansKey();
    localStorage.setItem(key, JSON.stringify(plans));
    markLocalUpdate();
    
    // Explicit signal for UI and StudioContext
    window.dispatchEvent(new Event('cc_subscription_plans_update'));

    // Trigger Cloud Sync
    try {
        const { getActiveSlug, syncStudioDataToCloud } = await import('./settings-store');
        const slug = getActiveSlug();
        if (slug && slug !== 'demo.classcore.ge') {
            await syncStudioDataToCloud(slug, { [key]: plans });
        }
    } catch (err) {
        console.error('Plan sync error:', err);
    }

}
