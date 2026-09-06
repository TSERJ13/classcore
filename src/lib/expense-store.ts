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

// 🛠️ FIX (both functions below): the local key used to be a bare
// `cc_expenses_${branchId}_${month}` with NO studio/org component at all —
// unlike every other store in this codebase. Two different studios open in
// the same browser (e.g. an owner who manages more than one, or switching
// between a demo and a live org) that both happen to use the default branch
// id "main" would silently read/write the exact same localStorage entry for
// a given month, corrupting each other's rent/utilities figures. Prefixing
// with the active slug fixes that; the unscoped key is still read as a
// one-time migration fallback so nothing already saved is lost.
function getExpensesKey(month: string, branchId: string): string {
    const slug = getActiveSlug() || 'default';
    return `cc_expenses_${slug}_${branchId}_${month}`;
}
function getLegacyExpensesKey(month: string, branchId: string): string {
    return `cc_expenses_${branchId}_${month}`;
}

export function getExpenses(month: string, branchId: string): MonthlyExpenses {
    if (typeof window === 'undefined') return DEFAULT_EXPENSES;
    const key = getExpensesKey(month, branchId);
    let saved = localStorage.getItem(key);
    if (!saved) {
        // Migrate the old unscoped key, if present, onto the new scoped one.
        const legacy = localStorage.getItem(getLegacyExpensesKey(month, branchId));
        if (legacy) {
            saved = legacy;
            try { localStorage.setItem(key, legacy); } catch {}
        }
    }
    // ⚠️ always a fresh copy — `local` gets mutated below when filling in
    // cloud-only categories, and must never alias the shared DEFAULT_EXPENSES
    // constant.
    let local: MonthlyExpenses = { ...DEFAULT_EXPENSES };
    if (saved) {
        try {
            local = { ...DEFAULT_EXPENSES, ...JSON.parse(saved) };
        } catch {
            local = { ...DEFAULT_EXPENSES };
        }
    }

    // 🛠️ FIX: StudioContext.tsx's cloud hydration writes the `expenses` table
    // (synced by saveExpenses() below, one row per category — see that
    // function) into `getScopedKey('cc_expenses')` as a flat `{[rowId]: row}`
    // map — a key/shape this function never used to read at all. That meant
    // expenses entered on one device reached Supabase fine, but a second
    // device hydrating that same data had nowhere local to actually surface
    // it: this reads that hydrated blob as a fallback source, filling in any
    // category the LOCAL copy doesn't already have a value for (local always
    // wins so in-flight edits on this device are never clobbered).
    try {
        const cloudRaw = localStorage.getItem(getScopedKey('cc_expenses'));
        if (cloudRaw) {
            const cloudMap = JSON.parse(cloudRaw);
            if (cloudMap && typeof cloudMap === 'object') {
                const hasLocalSave = !!saved;
                (Object.keys(DEFAULT_EXPENSES) as (keyof MonthlyExpenses)[]).forEach(category => {
                    const row = cloudMap[`exp_${branchId}_${month}_${category}`];
                    if (row && typeof row.amount === 'number' && (!hasLocalSave || local[category] === DEFAULT_EXPENSES[category])) {
                        local[category] = row.amount;
                    }
                });
            }
        }
    } catch { /* ignore — local value already resolved above */ }

    return local;
}

export function saveExpenses(month: string, branchId: string, expenses: MonthlyExpenses) {
    if (typeof window === 'undefined') return;
    const key = getExpensesKey(month, branchId);
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
