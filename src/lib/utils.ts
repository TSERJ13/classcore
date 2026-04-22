import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function calculateAge(birthDate: string): number | null {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return null;
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const day = date.getDate();
    const monthIndex = date.getMonth();
    const year = date.getFullYear();

    const geoMonthsShort = [
        'იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ',
        'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'
    ];

    return `${day}. ${geoMonthsShort[monthIndex]}. ${year}`;
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
        .replace(/[^a-z0-9]/g, '');     // STRICT: Remove EVERYTHING except a-z and 0-9 (No dashes, no spaces)
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

// --- UNIVERSAL SYNC REGISTRY ---
// All operational data collections (current and future) follow this registry.
export const SYNC_COLLECTIONS = [
    'cc_student_data', 'cc_groups', 'cc_halls', 'cc_teachers',
    'cc_attendance_archive', 'cc_attendance_data', 'cc_checkins',
    'cc_subscription_plans', 'cc_student_subscriptions', 'cc_shop_products', 
    'cc_shop_sales', 'cc_audit_log', 'cc_security_log', 'cc_salary_update',
    'cc_notifications', 'cc_calendar_events', 'cc_global_history', 
    'cc_global_trash', 'cc_studio_settings', 'cc_deleted_'
];

// Keys that belong to the browser session, NOT a specific studio
export const PROTECTED_GLOBAL_KEYS = [
    STORAGE_KEY, REGISTRY_KEY, ACTIVE_SLUG_KEY, 
    'cc_last_version', 'cc_onboarding_in_progress', 'cc_staff_session',
    'cc_staff_auth'
];

/** Helper to get active studio slug from URL or localStorage */
export function getActiveSlug(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACTIVE_SLUG_KEY) || (typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : null);
}

/** 
 * NUCLEAR CONSOLIDATOR:
 * Merges different scoped silos (Slug vs UUID) into a single authoritative silo locally.
 * This prevents stale legacy data from 'poisoning' the sync payload during the pulse.
 */
export function consolidateStudioKeys(slug: string, activeOrgId?: string) {
    if (typeof window === 'undefined' || !slug) return;
    
    console.log('🛡️ [Unification] Starting LocalStorage Consolidation for:', slug);
    const keys = Object.keys(localStorage);
    const authoritativeScopeId = activeOrgId || slug;
    
    // 1. Identify all syncable keys belonging to this studio
    const studioKeys: Record<string, string[]> = {}; // Map base prefix to all found variants
    
    keys.forEach(k => {
        const isSyncablePrefix = SYNC_COLLECTIONS.some(p => k.startsWith(p));
        const belongsToStudio = k.includes(`_${slug}`) || (activeOrgId && k.includes(`_${activeOrgId}`));
        
        if (isSyncablePrefix && belongsToStudio) {
            const basePrefix = SYNC_COLLECTIONS.find(p => k.startsWith(p))!;
            if (!studioKeys[basePrefix]) studioKeys[basePrefix] = [];
            studioKeys[basePrefix].push(k);
        }
    });

    // 2. Merge and Purge
    Object.keys(studioKeys).forEach(base => {
        // 🚨 BRANCH PROTECTION: If the base collection is branch-scoped, skip unification
        // because we WANT multiple silos (one per branch).
        const globalCollections = [
            'cc_student_data', 'cc_studio_settings', 'cc_staff', 
            'cc_subscription_plans', 'cc_student_subscriptions'
        ];
        if (!globalCollections.includes(base)) return;

        const variants = studioKeys[base];
        const targetKey = `${base}_${authoritativeScopeId}`;
        
        if (variants.length <= 1 && variants[0] === targetKey) return;

        console.log(`🛡️ [Unification] Consolidating variants for ${base}:`, variants);
        
        let mergedData: any = null;
        
        // Merge strategy: Start with the most recent or most detailed (simplistic here: just accumulate)
        variants.forEach(v => {
            try {
                const val = localStorage.getItem(v);
                if (!val) return;
                const parsed = JSON.parse(val);
                
                if (!mergedData) {
                    mergedData = parsed;
                } else {
                    // Primitive merge (arrays = union, objects = shallow merge)
                    if (Array.isArray(mergedData) && Array.isArray(parsed)) {
                        const map = new Map<string, any>();
                        [...mergedData, ...parsed].forEach(item => { if (item.id) map.set(item.id, { ...(map.get(item.id) || {}), ...item }); });
                        mergedData = Array.from(map.values());
                    } else if (typeof mergedData === 'object' && typeof parsed === 'object') {
                        mergedData = { ...mergedData, ...parsed };
                    }
                }
            } catch (e) {
                console.error(`🛡️ [Unification] Failed to merge variant ${v}:`, e);
            }
        });

        if (mergedData) {
            // Write to authoritative key
            localStorage.setItem(targetKey, JSON.stringify(mergedData));
            
            // DELETE all other variants to prevent ghost restoration
            variants.forEach(v => {
                if (v !== targetKey) {
                    console.log(`🛡️ [Unification] Purging legacy silo: ${v}`);
                    localStorage.removeItem(v);
                }
            });
        }
    });
}

export function getScopedKey(base: string, slug?: string, branchId?: string) {
    const finalSlug = slug || getActiveSlug();
    if (!finalSlug) return base;

    // Stable scoping: If we have an orgId for this slug, use it for the key to survive slug changes
    // CRITICAL: Read raw from localStorage to avoid circular dependency with settings-store.ts
    let scopeId = finalSlug;
    if (typeof window !== 'undefined') {
        try {
            // Check for explicit orgId override (set during login or hydration)
            const override = localStorage.getItem(`cc_org_id_override_${finalSlug}`);
            if (override) {
                scopeId = override;
            } else {
                const raw = localStorage.getItem(`${STORAGE_KEY}_${finalSlug}`);
                if (raw) {
                    const settings = JSON.parse(raw);
                    // Ensure settings is a valid object before property access
                    if (settings && typeof settings === 'object' && settings.orgId) {
                        scopeId = settings.orgId;
                        // Cache it for faster lookups and to bridge gaps during sync
                        localStorage.setItem(`cc_org_id_override_${finalSlug}`, settings.orgId);
                    }
                }
            }
        } catch { }

    }

    // If branchId is explicitly provided or we should use the active one
    const bId = branchId || (typeof window !== 'undefined' ? (localStorage.getItem(`cc_active_branch_${finalSlug}`) || 'main') : 'main');

    // ─── Scoping Logic ───
    // Unified Scoping: Always use the authoritative scopeId (OrgId if available, else Slug)
    if (bId && bId !== 'all') {
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
