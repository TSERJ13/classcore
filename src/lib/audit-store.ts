/**
 * audit-store.ts
 * Centrally tracks important actions (payments, subscriptions) studio-wide.
 */
import { getScopedKey } from './settings-store';

export interface AuditEntry {
    id: string;
    action: 'payment' | 'subscription_issued' | 'subscription_extended' | 'subscription_deleted' | 'lesson_checkin';
    details: string;
    amount?: number;
    studentId?: string;
    studentName?: string;
    branchId: string;
    branchName: string;
    timestamp: string;
    performedBy: string;
}

const HISTORY_KEY = 'cc_global_history';

export function getHistory(): AuditEntry[] {
    if (typeof window === 'undefined') return [];
    try {
        const key = getScopedKey(HISTORY_KEY);
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
}

export function recordAuditAction(entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
    if (typeof window === 'undefined') return;
    try {
        const history = getHistory();
        const newEntry: AuditEntry = {
            ...entry,
            id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp: new Date().toISOString()
        };

        // Keep last 1000 entries for performance
        const updated = [newEntry, ...history].slice(0, 1000);
        localStorage.setItem(getScopedKey(HISTORY_KEY), JSON.stringify(updated));
        window.dispatchEvent(new Event('cc_history_update'));
    } catch (e) {
        console.error('Audit failed:', e);
    }
}
