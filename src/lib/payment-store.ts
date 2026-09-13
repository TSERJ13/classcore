import { getScopedKey, getActiveSlug } from './utils';

export interface PaymentRecord {
    id: string;
    student_id?: string;
    student_name: string;
    amount: number;
    payment_method: 'cash' | 'card' | 'transfer';
    item_type: 'subscription' | 'lesson' | 'rental' | 'shop' | 'other';
    description: string;
    date: string;
    status: 'completed' | 'refunded';
    processed_by?: string;
    created_at: string;
}

const BASE_KEY = 'cc_payments';

function getKey(slug?: string) {
    const s = slug || getActiveSlug() || 'demo.classcore.ge';
    return getScopedKey(BASE_KEY, s);
}

function getInitialPayments(): PaymentRecord[] {
    const now = new Date();
    const iso = now.toISOString();
    const d1 = new Date(now.getTime() - 1 * 86400000).toISOString().split('T')[0];
    const d2 = new Date(now.getTime() - 3 * 86400000).toISOString().split('T')[0];
    const d3 = new Date(now.getTime() - 5 * 86400000).toISOString().split('T')[0];

    return [
        {
            id: 'pay-1',
            student_name: 'ნიკოლოზ დავითაშვილი',
            amount: 160,
            payment_method: 'card',
            item_type: 'subscription',
            description: 'ლათინო — ყოველთვიური აბონემენტი',
            date: d1,
            status: 'completed',
            processed_by: 'ადმინი',
            created_at: iso
        },
        {
            id: 'pay-2',
            student_name: 'ელენე კაპანაძე',
            amount: 220,
            payment_method: 'transfer',
            item_type: 'lesson',
            description: 'ინდივიდუალური გაკვეთილი (4 სესია)',
            date: d2,
            status: 'completed',
            processed_by: 'ადმინი',
            created_at: iso
        },
        {
            id: 'pay-3',
            student_name: 'დავით მაისურაძე',
            amount: 80,
            payment_method: 'cash',
            item_type: 'rental',
            description: 'დიდი დარბაზის იჯარა (2 საათი)',
            date: d3,
            status: 'completed',
            processed_by: 'ადმინი',
            created_at: iso
        }
    ];
}

export function getPayments(slug?: string): PaymentRecord[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(getKey(slug));
        if (!raw) {
            const initial = getInitialPayments();
            savePayments(initial, slug);
            return initial;
        }
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export function savePayments(payments: PaymentRecord[], slug?: string): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(getKey(slug), JSON.stringify(payments));
        window.dispatchEvent(new CustomEvent('cc_payments_update'));
    } catch (e) {
        console.error('Failed to save payments:', e);
    }
}

export function createPayment(data: Omit<PaymentRecord, 'id' | 'created_at'>, slug?: string): PaymentRecord {
    const list = getPayments(slug);
    const newRecord: PaymentRecord = {
        ...data,
        id: 'pay_' + Date.now(),
        created_at: new Date().toISOString(),
    };
    const next = [newRecord, ...list];
    savePayments(next, slug);
    return newRecord;
}

export function refundPayment(id: string, slug?: string): void {
    const list = getPayments(slug);
    const next = list.map(p => p.id === id ? { ...p, status: 'refunded' as const } : p);
    savePayments(next, slug);
}
