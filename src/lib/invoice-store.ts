import { getScopedKey, getActiveSlug } from './utils';

export interface InvoiceItem {
    description: string;
    quantity: number;
    price: number;
}

export interface Invoice {
    id: string;
    invoice_number: string;
    student_id?: string;
    student_name: string;
    amount: number;
    currency: string;
    status: 'paid' | 'pending' | 'overdue' | 'cancelled';
    issue_date: string;
    due_date: string;
    items: InvoiceItem[];
    payment_method?: 'cash' | 'card' | 'transfer';
    notes?: string;
    created_at: string;
}

const BASE_KEY = 'cc_invoices';

function getKey(slug?: string) {
    const s = slug || getActiveSlug() || 'demo.classcore.ge';
    return getScopedKey(BASE_KEY, s);
}

function getInitialInvoices(): Invoice[] {
    const now = new Date();
    const iso = now.toISOString();
    const d1 = new Date(now.getTime() - 2 * 86400000).toISOString().split('T')[0];
    const d2 = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
    const due1 = new Date(now.getTime() + 10 * 86400000).toISOString().split('T')[0];
    const dueOverdue = new Date(now.getTime() - 1 * 86400000).toISOString().split('T')[0];

    return [
        {
            id: 'inv-1',
            invoice_number: 'INV-2026-001',
            student_name: 'ნიკოლოზ დავითაშვილი',
            amount: 160,
            currency: 'GEL',
            status: 'paid',
            issue_date: d2,
            due_date: d1,
            items: [{ description: 'ყოველთვიური აბონემენტი (ლათინო)', quantity: 1, price: 160 }],
            payment_method: 'card',
            created_at: iso
        },
        {
            id: 'inv-2',
            invoice_number: 'INV-2026-002',
            student_name: 'ანა მეგრელიძე',
            amount: 220,
            currency: 'GEL',
            status: 'pending',
            issue_date: d1,
            due_date: due1,
            items: [{ description: 'ინდივიდუალური გაკვეთილების პაკეტი (4 ვიზიტი)', quantity: 1, price: 220 }],
            created_at: iso
        },
        {
            id: 'inv-3',
            invoice_number: 'INV-2026-003',
            student_name: 'გიორგი ბერიძე',
            amount: 140,
            currency: 'GEL',
            status: 'overdue',
            issue_date: d2,
            due_date: dueOverdue,
            items: [{ description: 'ჯგუფური აბონემენტი (სტანდარტი)', quantity: 1, price: 140 }],
            created_at: iso
        }
    ];
}

export function getInvoices(slug?: string): Invoice[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(getKey(slug));
        if (!raw) {
            const initial = getInitialInvoices();
            saveInvoices(initial, slug);
            return initial;
        }
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export function saveInvoices(invoices: Invoice[], slug?: string): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(getKey(slug), JSON.stringify(invoices));
        window.dispatchEvent(new CustomEvent('cc_invoices_update'));
    } catch (e) {
        console.error('Failed to save invoices:', e);
    }
}

export function createInvoice(data: Omit<Invoice, 'id' | 'created_at'>, slug?: string): Invoice {
    const list = getInvoices(slug);
    const newInvoice: Invoice = {
        ...data,
        id: 'inv_' + Date.now(),
        created_at: new Date().toISOString(),
    };
    const next = [newInvoice, ...list];
    saveInvoices(next, slug);
    return newInvoice;
}

export function updateInvoice(id: string, patch: Partial<Invoice>, slug?: string): void {
    const list = getInvoices(slug);
    const next = list.map(inv => inv.id === id ? { ...inv, ...patch } : inv);
    saveInvoices(next, slug);
}

export function deleteInvoice(id: string, slug?: string): void {
    const list = getInvoices(slug);
    const next = list.filter(inv => inv.id !== id);
    saveInvoices(next, slug);
}
