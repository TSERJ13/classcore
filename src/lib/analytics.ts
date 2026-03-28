/**
 * analytics.ts
 * Simple logger for tracking user actions and behavior patterns.
 */

export type AnalyticsAction =
    | 'plan_click'
    | 'promo_code_attempt'
    | 'portal_visit'
    | 'checkout_proceed'
    | 'studio_impersonate';

import { getScopedKey, getActiveSlug } from './utils';

export interface ActionLog {
    id: string;
    timestamp: string;
    action: AnalyticsAction;
    slug: string;
    metadata: Record<string, any>;
}

const STORAGE_KEY = 'cc_analytics_logs';

export function logAction(action: AnalyticsAction, slug: string, metadata: Record<string, any> = {}) {
    if (typeof window === 'undefined') return;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const logs: ActionLog[] = raw ? JSON.parse(raw) : [];

        const newLog: ActionLog = {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            action,
            slug,
            metadata
        };

        logs.push(newLog);

        // Keep only last 1000 logs to prevent storage bloat
        const limited = logs.slice(-1000);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));

        // Trigger event for real-time dashboard updates if any
        window.dispatchEvent(new Event('cc_analytics_update'));
    } catch (e) {
        console.error('Failed to log action:', e);
    }
}

export function getActionLogs(): ActionLog[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}
