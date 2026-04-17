import { getScopedKey, getActiveSlug, markLocalUpdate } from './utils';
import { pushStudioStateToCloud } from './sync-store';

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
        pushStudioStateToCloud(activeSlug, [], { [key]: expenses });
    }

    // Trigger update
    window.dispatchEvent(new CustomEvent('cc_expenses_update'));
}
