import { getScopedKey, getActiveSlug, markLocalUpdate, getEffectiveOrgId } from './utils';
import { pushStudioStateToCloud } from './sync-store';
import { syncRecordToCloud } from './master-sync';

export interface MonthlyExpenses {
    rent: number;
    electricity: number;
    gas: number;
    water: number;
    cleaner: number;
    accountant: number;
    manager: number;
    other: number;
}

const DEFAULT_EXPENSES: MonthlyExpenses = {
    rent: 0,
    electricity: 0,
    gas: 0,
    water: 0,
    cleaner: 0,
    accountant: 0,
    manager: 0,
    other: 0
};

export function getExpenses(month: string, branchId: string): MonthlyExpenses {
    if (typeof window === 'undefined') return DEFAULT_EXPENSES;
    const key = `cc_expenses_${branchId}_${month}`;
    const saved = localStorage.getItem(key);
    if (!saved) return DEFAULT_EXPENSES;
    try {
        return { ...DEFAULT_EXPENSES, ...JSON.parse(saved) };
    } catch {
        return DEFAULT_EXPENSES;
    }
}

export function saveExpenses(month: string, branchId: string, expenses: MonthlyExpenses) {
    if (typeof window === 'undefined') return;
    const key = `cc_expenses_${branchId}_${month}`;
    localStorage.setItem(key, JSON.stringify(expenses));
    markLocalUpdate();

    // Sync
    const activeSlug = getActiveSlug();
    if (activeSlug && activeSlug !== 'demo.classcore.ge') {
        // Best-effort mirror into the settings recovery blob (legacy path —
        // kept for backward compatibility with anything still reading
        // `cc_expenses_*` out of studio_settings).
        pushStudioStateToCloud(activeSlug, [], { [key]: expenses });

        // 🔥 REAL PERSISTENCE: previously this was the ONLY sync call, and
        // it never wrote to Supabase's `public.expenses` table at all — it
        // only reached the `studio_settings.settings` JSON blob, which is a
        // best-effort discovery/recovery cache, not the source of truth any
        // other device reads from. That meant expenses genuinely lived only
        // in the browser that entered them and were lost if that device's
        // storage was cleared or the studio was opened elsewhere.
        //
        // Write one upserted row per category into the real `expenses`
        // table instead, keyed deterministically so re-saving the same
        // month/branch/category updates the existing row rather than
        // duplicating it.
        const finalOrgId = getEffectiveOrgId(activeSlug);
        if (finalOrgId) {
            const date = `${month}-01`;
            (Object.keys(expenses) as (keyof MonthlyExpenses)[]).forEach(category => {
                syncRecordToCloud('expenses', {
                    id: `exp_${branchId}_${month}_${category}`,
                    org_id: finalOrgId,
                    category,
                    amount: expenses[category] || 0,
                    branch_id: branchId,
                    description: category,
                    date
                }, finalOrgId).catch(() => {});
            });
        }
    }

    // Trigger update
    window.dispatchEvent(new CustomEvent('cc_expenses_update'));
}
