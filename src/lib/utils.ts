
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

export function smartCapitalize(str: string): string {
    if (!str) return '';
    // If it's Georgian, don't touch it (Georgian has no upper case)
    if (/[\u10D0-\u10FF]/.test(str)) return str;
    
    // Capitalize each word (useful for Russian/English names)
    return str.split(' ').map(word => {
        if (!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
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

    return `${day} ${geoMonthsShort[monthIndex]}. ${year}`;
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

export function cleanPhone(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
}

export function formatPhoneDisplay(phone: string): string {
    const cleaned = cleanPhone(phone || '');
    if (cleaned.length === 9) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)}-${cleaned.slice(5, 7)}-${cleaned.slice(7, 9)}`;
    }
    return phone || '';
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
export const SYNC_COLLECTIONS = [
    'cc_student_data', 'cc_groups', 'cc_halls', 'cc_teachers',
    'cc_attendance_archive', 'cc_attendance_data', 'cc_checkins',
    'cc_subscription_plans', 'cc_student_subscriptions', 'cc_shop_products', 
    'cc_shop_sales', 'cc_audit_log', 'cc_security_log', 'cc_salary_update',
    'cc_notifications', 'cc_calendar_events', 'cc_global_history', 
    'cc_global_trash', 'cc_studio_settings', 'cc_deleted_'
];

/** Helper to get active studio slug from URL or localStorage */
export function getActiveSlug(): string | null {
    if (typeof window === 'undefined') return null;
    
    // 1. URL Path takes absolute priority
    const path = window.location.pathname.split('/')[1];
    const excluded = ['dashboard', 'auth', 'admin', 'login', 'superadmin', 'settings', 'billing', 'analytics', 'history', 'attendance', 'students', 'teachers', 'halls', 'groups', 'calendar', 'shop', 'sms-manager', 'subscriptions'];
    if (path && !excluded.includes(path)) {
        return path;
    }


    // 2. Fallback to localStorage
    return localStorage.getItem(ACTIVE_SLUG_KEY);
}

/** 
 * SCORCHED EARTH v3.0 Scope Resolution
 * Priority: Override > Settings(OrgId) > Slug
 */
export function getScopedKey(base: string, slug?: string, branchId?: string) {
    const finalSlug = slug || getActiveSlug();
    if (!finalSlug) return base;

    let scopeId = finalSlug;
    if (typeof window !== 'undefined') {
        const override = localStorage.getItem(`cc_org_id_override_${finalSlug}`);
        if (override) {
            scopeId = override;
        } else {
            const raw = localStorage.getItem(`${STORAGE_KEY}_${finalSlug}`);
            if (raw) {
                try {
                    const settings = JSON.parse(raw);
                    if (settings?.orgId) scopeId = settings.orgId;
                } catch {}
            }
        }
    }

    const bId = branchId || (typeof window !== 'undefined' ? (localStorage.getItem(`cc_active_branch_${finalSlug}`) || 'main') : 'main');

    if (bId && bId !== 'all') {
        return `${base}_${scopeId}_${bId}`;
    }

    return `${base}_${scopeId}`;
}

export function consolidateStudioKeys(slug: string, activeOrgId?: string) {
    // DEPRECATED DUE TO SABOTAGE: NOW A NO-OP
    // MasterSync handles all migration safely.
    return;
}

export function markLocalUpdate() {
    if (typeof window !== 'undefined') {
        localStorage.setItem('cc_last_local_update', Date.now().toString());
    }
}

/** 
 * SCORCHED EARTH v3.1: Global Deletion Tracking
 * Records a record of deletion for the history/trash system.
 */
export function recordGlobalDeletion(slug: string, collection: string, id: string, data?: any) {
    if (typeof window === 'undefined') return;
    try {
        const historyKey = getScopedKey('cc_global_history', slug);
        const historyRaw = localStorage.getItem(historyKey);
        const history = historyRaw ? JSON.parse(historyRaw) : [];
        
        const entry = {
            id: `del_${Date.now()}_${id}`,
            entity_id: id,
            entity_type: collection,
            action: 'delete',
            timestamp: new Date().toISOString(),
            data: data || { id }
        };

        const updated = [entry, ...history].slice(0, 200);
        localStorage.setItem(historyKey, JSON.stringify(updated));

        // Trigger Sync for history
        markLocalUpdate();

        // Bridge to trash-store (Dynamic import to avoid circular dependency)
        const typeMap: Record<string, string> = {
            'cc_student_data': 'student',
            'cc_teachers': 'teacher',
            'cc_student_subscriptions': 'subscription',
            'cc_groups': 'group'
        };
        
        const trashType = typeMap[collection];
        if (trashType) {
            import('./trash-store').then(mod => {
                const bId = localStorage.getItem(`cc_active_branch_${slug}`) || 'main';
                mod.moveToTrash(trashType as any, data || { id }, bId);
            });
        }
    } catch (e) {
        console.error('❌ [Utils] Failed to record deletion:', e);
    }
}

export function clearGlobalDeletion(slug: string, collection: string, id: string) {
    if (typeof window === 'undefined') return;
    try {
        const historyKey = getScopedKey('cc_global_history', slug);
        const historyRaw = localStorage.getItem(historyKey);
        if (!historyRaw) return;
        
        let history = JSON.parse(historyRaw);
        history = history.filter((item: any) => !(item.entity_id === id && item.entity_type === collection));
        
        localStorage.setItem(historyKey, JSON.stringify(history));
        markLocalUpdate();
    } catch (e) {
        console.error('❌ [Utils] Failed to clear deletion:', e);
    }
}
