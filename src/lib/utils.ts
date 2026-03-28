import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ka-GE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export function getCurrencySymbol(currency: string = 'GEL'): string {
    const symbols: Record<string, string> = {
        'GEL': '₾',
        'USD': '$',
        'EUR': '€'
    };
    return symbols[currency] || currency;
}

export function formatCurrency(amount: number, currency: string = 'GEL'): string {
    const symbol = getCurrencySymbol(currency);
    const formatted = amount.toLocaleString('ka-GE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    return currency === 'GEL' ? `${formatted}${symbol}` : `${symbol}${formatted}`;
}

export function getInitials(name: string): string {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

export function getDaysUntilExpiry(expiresAt: string): number {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isExpiringSoon(expiresAt: string, days = 7): boolean {
    return getDaysUntilExpiry(expiresAt) <= days;
}

export function slugify(text: string): string {
    const geoToLat: Record<string, string> = {
        'ა': 'a', 'ბ': 'b', 'გ': 'g', 'დ': 'd', 'ე': 'e', 'ვ': 'v', 'ზ': 'z', 'თ': 't', 'ი': 'i', 'კ': 'k', 'ლ': 'l', 'მ': 'm', 'ნ': 'n', 'ო': 'o', 'პ': 'p', 'ჟ': 'zh', 'რ': 'r', 'ს': 's', 'ტ': 't', 'უ': 'u', 'ფ': 'f', 'ქ': 'k', 'ღ': 'gh', 'ყ': 'q', 'შ': 'sh', 'ჩ': 'ch', 'ც': 'c', 'ძ': 'dz', 'წ': 'ts', 'ჭ': 'ch', 'ხ': 'kh', 'ჯ': 'j', 'ჰ': 'h'
    };

    return text
        .toLowerCase()
        .split('')
        .map(char => geoToLat[char] || char)
        .join('')
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^a-z0-9-]/g, '')     // Remove all non-word chars
        .replace(/-+/g, '-')            // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start
        .replace(/-+$/, '');            // Trim - from end
}

/**
 * Compact version: no spaces, no dashes, just letters and numbers.
 */
export function compactSlugify(text: string): string {
    const geoToLat: Record<string, string> = {
        'ა': 'a', 'ბ': 'b', 'გ': 'g', 'დ': 'd', 'ე': 'e', 'ვ': 'v', 'ზ': 'z', 'თ': 't', 'ი': 'i', 'კ': 'k', 'ლ': 'l', 'მ': 'm', 'ნ': 'n', 'ო': 'o', 'პ': 'p', 'ჟ': 'zh', 'რ': 'r', 'ს': 's', 'ტ': 't', 'უ': 'u', 'ფ': 'f', 'ქ': 'k', 'ღ': 'gh', 'ყ': 'q', 'შ': 'sh', 'ჩ': 'ch', 'ც': 'c', 'ძ': 'dz', 'წ': 'ts', 'ჭ': 'ch', 'ხ': 'kh', 'ჯ': 'j', 'ჰ': 'h'
    };

    return text
        .toLowerCase()
        .split('')
        .map(char => geoToLat[char] || char)
        .join('')
        .replace(/[^a-z0-9]/g, '');     // Remove EVERYTHING except a-z and 0-9
}

export function getLocalISODate(d?: Date): string {
    const date = d || new Date();
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().split('T')[0];
}

// Storage Constants
export const STORAGE_KEY = 'cc_studio_settings';
export const ACTIVE_SLUG_KEY = 'cc_active_studio_slug';
export const REGISTRY_KEY = 'cc_studios_list';

/** Helper to get active studio slug from URL or localStorage */
export function getActiveSlug(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACTIVE_SLUG_KEY) || (typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : null);
}

/** 
 * Centralized key generator for all studio-scoped data.
 * Supports legacy slug-based and new orgId-based scoping.
 */
export function getScopedKey(base: string, slug?: string, branchId?: string) {
    const finalSlug = slug || getActiveSlug();
    if (!finalSlug) return base;

    // Stable scoping: If we have an orgId for this slug, use it for the key to survive slug changes
    // CRITICAL: Read raw from localStorage to avoid circular dependency with settings-store.ts
    let scopeId = finalSlug;
    if (typeof window !== 'undefined') {
        try {
            const raw = localStorage.getItem(`${STORAGE_KEY}_${finalSlug}`);
            if (raw) {
                const settings = JSON.parse(raw);
                if (settings.orgId) scopeId = settings.orgId;
            }
        } catch { }
    }

    // If branchId is explicitly provided or we should use the active one
    const bId = branchId || (typeof window !== 'undefined' ? localStorage.getItem(`cc_active_branch_${finalSlug}`) : 'main');

    // Certain keys should always be studio-level (not branch-scoped)
    const sharedKeys = [STORAGE_KEY, REGISTRY_KEY, ACTIVE_SLUG_KEY, 'cc_global_history', 'cc_global_trash'];
    if (sharedKeys.includes(base)) {
        return `${base}_${finalSlug}`; // Settings itself and registration list must stay slug-based for discovery
    }

    // ALWAYS scope by branch ID if available, including 'main'
    if (bId) {
        return `${base}_${scopeId}_${bId}`;
    }

    return `${base}_${scopeId}`;
}
/** 
 * Signals that a local update has occurred.
 * Used by StudioContext to skip cloud-to-local merges for a short window.
 */
export function markLocalUpdate() {
    if (typeof window !== 'undefined') {
        localStorage.setItem('cc_last_local_update', Date.now().toString());
    }
}
