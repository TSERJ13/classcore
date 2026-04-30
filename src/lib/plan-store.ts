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

import { getScopedKey, markLocalUpdate, getActiveSlug } from './utils';
import { loadSettings } from './settings-store';
import { triggerInstantSync } from './sync-store';
import { syncRecordToCloud } from './master-sync';

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
    
    // 🔥 ATOMIC SYNC: Push ALL plan fields to the cloud
    const activeSlug = getActiveSlug() || '';
    const settings = loadSettings(activeSlug);
    const orgId = settings.orgId || (typeof window !== 'undefined' ? localStorage.getItem(`cc_org_id_override_${activeSlug}`) || localStorage.getItem(`cc_org_id_${activeSlug}`) : null);
    if (orgId && orgId !== 'demo') {
        plans.forEach(plan => {
            syncRecordToCloud('subscription_plans', {
                id: plan.id,
                org_id: orgId,
                name: plan.name,
                type: plan.type,
                price: plan.price,
                period: plan.period,
                session_count: plan.session_count,
                validity_days: plan.validity_days,
                is_active: plan.is_active,
                coach_name: plan.coach, // Map local 'coach' to DB 'coach_name'
                group_id: plan.group_id,
                data: plan // Store the full object in JSONB just in case
            }, orgId).catch(() => {});
        });

        // 🔥 FOOLPROOF SCHEMA-LESS FALLBACK
        import('./settings-store').then(({ loadSettings, saveSettings }) => {
            const settings = loadSettings(activeSlug);
            (settings as any).subscription_plans = plans;
            saveSettings(settings, settings, activeSlug);
            
            import('./master-sync').then(({ pushFullStudioMetadata }) => {
                const studioName = (settings as any).studioName || 'Studio';
                pushFullStudioMetadata(activeSlug, studioName, settings);
            });
        });
    }

    // Explicit signal for UI and StudioContext
    window.dispatchEvent(new Event('cc_subscription_plans_update'));

    triggerInstantSync();
}

export async function deletePlan(id: string): Promise<void> {
    const plans = getPlans();
    const next = plans.filter(p => p.id !== id);
    const key = getPlansKey();
    localStorage.setItem(key, JSON.stringify(next));
    markLocalUpdate();

    const activeSlug = getActiveSlug() || '';
    const settings = loadSettings(activeSlug);
    const orgId = settings.orgId || (typeof window !== 'undefined' ? localStorage.getItem(`cc_org_id_override_${activeSlug}`) || localStorage.getItem(`cc_org_id_${activeSlug}`) : null);
    
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
