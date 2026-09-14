import { getScopedKey, getActiveSlug } from './utils';

export type ExpenseCategory = 'rent' | 'utilities' | 'salary' | 'equipment' | 'marketing' | 'other';

export interface Expense {
    id: string;
    category: ExpenseCategory;
    title: string;
    amount: number;
    date: string;
    notes?: string;
    created_at: string;
}

const BASE_KEY = 'cc_expenses';

function getKey(slug?: string) {
    const s = slug || getActiveSlug() || 'demo.classcore.ge';
    return getScopedKey(BASE_KEY, s);
}

function getInitialExpenses(): Expense[] {
    const now = new Date();
    const iso = now.toISOString();
    const d1 = new Date(now.getTime() - 3 * 86400000).toISOString().split('T')[0];
    const d2 = new Date(now.getTime() - 8 * 86400000).toISOString().split('T')[0];
    const d3 = new Date(now.getTime() - 14 * 86400000).toISOString().split('T')[0];

    return [
        { id: 'exp-1', category: 'rent', title: 'დარბაზის იჯარა (თვიური)', amount: 1200, date: d3, created_at: iso },
        { id: 'exp-2', category: 'utilities', title: 'კომუნალური გადასახადები', amount: 240, date: d2, created_at: iso },
        { id: 'exp-3', category: 'equipment', title: 'აკუსტიკური სისტემის კაბელები', amount: 85, date: d1, created_at: iso },
        { id: 'exp-4', category: 'marketing', title: 'Instagram / Facebook რეკლამა', amount: 150, date: d1, created_at: iso }
    ];
}

export function getExpenses(slug?: string): Expense[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(getKey(slug));
        if (!raw) {
            const initial = getInitialExpenses();
            saveExpenses(initial, slug);
            return initial;
        }
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export function saveExpenses(expenses: Expense[], slug?: string): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(getKey(slug), JSON.stringify(expenses));
        window.dispatchEvent(new CustomEvent('cc_expenses_update'));
    } catch (e) {
        console.error('Failed to save expenses:', e);
    }
}

export function createExpense(data: Omit<Expense, 'id' | 'created_at'>, slug?: string): Expense {
    const list = getExpenses(slug);
    const newExpense: Expense = {
        ...data,
        id: 'exp_' + Date.now(),
        created_at: new Date().toISOString(),
    };
    const next = [newExpense, ...list];
    saveExpenses(next, slug);
    return newExpense;
}

export function deleteExpense(id: string, slug?: string): void {
    const list = getExpenses(slug);
    const next = list.filter(e => e.id !== id);
    saveExpenses(next, slug);
}
