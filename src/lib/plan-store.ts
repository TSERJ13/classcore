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

import { getScopedKey } from './settings-store';

const BASE_PLANS_KEY = 'cc_subscription_plans';
function getPlansKey() { return getScopedKey(BASE_PLANS_KEY); }

const INITIAL_PLANS: Plan[] = [
    { id: '1', name: '8 გაკვეთილი (ჯგუფური)', type: 'group', period: 'sessions', session_count: 8, validity_days: 45, price: 150, is_active: true, group_id: 'g1' },
    { id: '2', name: 'ინდ. ერთჯერადი', type: 'individual', period: 'sessions', session_count: 1, validity_days: 7, price: 50, coach: 'ნინო ბერიძე', is_active: true },
];

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
        return JSON.parse(saved);
    } catch {
        return INITIAL_PLANS;
    }
}

export function savePlans(plans: Plan[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getPlansKey(), JSON.stringify(plans));
}
