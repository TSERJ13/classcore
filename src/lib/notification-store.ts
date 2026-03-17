/**
 * notification-store.ts
 * Manages notifications with a 10-item limit for "active" view and a full history.
 * Persists to localStorage.
 */

export interface Notification {
    id: string;
    text: string;
    time: string;
    dot: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
    created_at: string;
}

import { getScopedKey } from './settings-store';

const BASE_NOTIFS_KEY = 'cc_notifications';
const BASE_HISTORY_KEY = 'cc_notifications_history';

function getNotifsKey() { return getScopedKey(BASE_NOTIFS_KEY); }
function getHistoryKey() { return getScopedKey(BASE_HISTORY_KEY); }

const INITIAL_NOTIFS: Notification[] = [
    { id: '1', text: 'ნინო ბერიძეს ივსება აბონიმენტი 3 დღეში', time: '5 წ. წ.', dot: 'bg-amber-400', read: false, created_at: new Date().toISOString() },
    { id: '2', text: 'ახალი ჯავშანი — დარბ. A, 14:00', time: '12 წ. წ.', dot: 'bg-indigo-400', read: false, created_at: new Date().toISOString() },
    { id: '3', text: 'გიორგი კვ. გამოტოვა 3 გაკვ.', time: '1 სთ. წ.', dot: 'bg-rose-400', read: false, created_at: new Date().toISOString() },
];

export function getNotifications(): Notification[] {
    if (typeof window === 'undefined') return INITIAL_NOTIFS;
    try {
        const key = getNotifsKey();
        let saved = localStorage.getItem(key);

        // Migration
        if (!saved && key !== BASE_NOTIFS_KEY) {
            saved = localStorage.getItem(BASE_NOTIFS_KEY);
        }

        const parsed = JSON.parse(saved || '[]');
        return Array.isArray(parsed) ? parsed : INITIAL_NOTIFS;
    } catch {
        return INITIAL_NOTIFS;
    }
}

export function saveNotifications(notifs: Notification[]): void {
    if (typeof window === 'undefined') return;

    // Sort by date descending
    const sorted = [...notifs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Keep only 10 most recent in active store
    const active = sorted.slice(0, 10);
    const archived = sorted.slice(10);

    localStorage.setItem(getNotifsKey(), JSON.stringify(active));

    if (archived.length > 0) {
        const history = getHistory();
        const updatedHistory = [...archived, ...history];
        localStorage.setItem(getHistoryKey(), JSON.stringify(updatedHistory));
    }
}

export function getHistory(): Notification[] {
    if (typeof window === 'undefined') return [];
    try {
        const key = getHistoryKey();
        let saved = localStorage.getItem(key);

        // Migration
        if (!saved && key !== BASE_HISTORY_KEY) {
            saved = localStorage.getItem(BASE_HISTORY_KEY);
        }

        const parsed = JSON.parse(saved || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function addNotification(input: string | { title: string; message: string; type?: string; time?: string }, dotColor: string = 'bg-indigo-400'): void {
    const notifs = getNotifications();
    let text = '';
    let time = 'ახლახანს';

    if (typeof input === 'string') {
        text = input;
    } else {
        text = input.title + ': ' + input.message;
        time = input.time || 'ახლახანს';
    }

    const newNotif: Notification = {
        id: Math.random().toString(36).substring(2, 9),
        text,
        time,
        dot: dotColor,
        read: false,
        created_at: new Date().toISOString(),
    };
    saveNotifications([newNotif, ...notifs]);
}

export function markAsRead(id: string): void {
    const notifs = getNotifications();
    const updated = notifs.map(n => n.id === id ? { ...n, read: true } : n);
    saveNotifications(updated);
}

export function clearAll(): void {
    const notifs = getNotifications();
    const history = getHistory();
    const updatedHistory = [...notifs, ...history];
    localStorage.setItem(getHistoryKey(), JSON.stringify(updatedHistory));
    localStorage.setItem(getNotifsKey(), JSON.stringify([]));
}
