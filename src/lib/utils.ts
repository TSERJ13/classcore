
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

    return `${day} ${geoMonthsShort[monthIndex]} ${year}`;
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
    const cleaned = (phone || '').replace(/[^0-9]/g, '');
    if (cleaned.length === 0) return '';
    
    let formatted = cleaned;
    if (cleaned.length > 3) {
        formatted = `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    }
    if (cleaned.length > 5) {
        formatted = `${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)}-${cleaned.slice(5)}`;
    }
    if (cleaned.length > 7) {
        formatted = `${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)}-${cleaned.slice(5, 7)}-${cleaned.slice(7, 9)}`;
    }
    return formatted;
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
    const excluded = [
        'dashboard', 'auth', 'admin', 'login', 'superadmin', 'settings', 
        'billing', 'analytics', 'history', 'attendance', 'students', 
        'teachers', 'halls', 'groups', 'calendar', 'shop', 
        'sms-manager', 'subscriptions', 'trash', 'registration', 
        'success', 'error', 'api', 'static', 'favicon.ico'
    ];
    if (path && !excluded.includes(path)) {
        return path;
    }


    // 2. Fallback to localStorage
    const local = localStorage.getItem(ACTIVE_SLUG_KEY);
    if (local) return local;

    // 3. Last resort: Cookies
    try {
        const cookieSlug = document.cookie
            .split('; ')
            .find(row => row.startsWith('cc_active_slug='))
            ?.split('=')[1];
        if (cookieSlug) {
            localStorage.setItem(ACTIVE_SLUG_KEY, cookieSlug);
            return cookieSlug;
        }
    } catch (e) {
        // ignore
    }

    return null;
}

/** 
 * SCORCHED EARTH v3.2 Scope Resolution
 * Priority: Override > Settings(OrgId) > Slug
 * Note: Only branch-specific collections append the branch ID.
 */
export function getEffectiveOrgId(slug?: string): string | null {
    const finalSlug = slug || getActiveSlug();
    if (!finalSlug) return null;
    if (typeof window === 'undefined') return null;

    const override = localStorage.getItem(`cc_org_id_override_${finalSlug}`);
    if (override) return override;

    const raw = localStorage.getItem(`${STORAGE_KEY}_${finalSlug}`);
    if (raw) {
        try {
            const settings = JSON.parse(raw);
            if (settings?.orgId) return settings.orgId;
        } catch {}
    }
    return null;
}

export function getScopedKey(base: string, slug?: string, branchId?: string) {
    const finalSlug = slug || getActiveSlug();
    if (!finalSlug) return base;

    let scopeId = getEffectiveOrgId(finalSlug) || finalSlug;

    const bId = branchId || (typeof window !== 'undefined' ? (localStorage.getItem(`cc_active_branch_${finalSlug}`) || 'main') : 'main');

    // COLLECTIONS THAT ARE SHARED ACROSS BRANCHES (Global for Org)
    const GLOBAL_COLLECTIONS = [
        'cc_student_data', 
        'cc_teachers', 
        'cc_branches', 
        'cc_subscription_plans', 
        'cc_student_subscriptions', 
        'cc_studio_settings', 
        'cc_global_history', 
        'cc_global_trash',
        'cc_uid_registry'
    ];

    const isGlobal = GLOBAL_COLLECTIONS.some(c => base.startsWith(c));

    if (!isGlobal && bId && bId !== 'all') {
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
        
        // Map collection to action for Audit UI
        const actionMap: Record<string, string> = {
            'cc_student_data': 'student_deleted',
            'cc_student_subscriptions': 'subscription_deleted',
            'cc_teachers': 'staff_deleted',
            'cc_groups': 'group_deleted'
        };

        const entry = {
            id: `del_${Date.now()}_${id}`,
            entity_id: id,
            entity_type: collection,
            action: actionMap[collection] || 'delete',
            timestamp: new Date().toISOString(),
            details: data?.details || (data?.name || data?.full_name || id),
            performedBy: data?.performedBy || 'System',
            branchName: data?.branchName || 'Main',
            branchId: data?.branchId || 'main',
            studentName: data?.studentName || data?.full_name || data?.first_name || '',
            amount: data?.amount || data?.price || 0,
            data: data || { id }
        };

        const updated = [entry, ...history].slice(0, 1000);
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

/**
 * 🖼️ IMAGE COMPRESSION v1.1
 * Compresses base64 images to ~80-100KB for localStorage storage.
 */
async function compressBase64(base64: string, maxWidth = 600, quality = 0.5): Promise<string> {
    if (typeof window === 'undefined' || !base64.startsWith('data:image')) return base64;
    // Target ~80-100KB: If > 120KB, compress
    if (base64.length < 120000) return base64; 

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
}

// 🔒 CONCURRENCY LOCK: Prevent overlapping cleanups
let isCleaning = false;

/** 
 * SCORCHED EARTH v4.8: Safe Storage Layer
 * Handles QuotaExceededError by purging inactive studios from cache.
 */
export async function safeSetItem(key: string, value: string, activeSlug?: string) {
    if (typeof window === 'undefined') return;
    
    // 🚀 FAST-PATH: If the value is small, try sync write first
    if (value.length < 50000) { // < 50KB
        try {
            localStorage.setItem(key, value);
            return;
        } catch (e) {
            // If even small write fails, fall through to emergency cleanup
        }
    }

    try {
        localStorage.setItem(key, value);
    } catch (err: any) {
        if (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014) {
            if (isCleaning) {
                await new Promise(r => setTimeout(r, 500));
                try { localStorage.setItem(key, value); return; } catch { return; }
            }

            isCleaning = true;
            console.warn('⚠️ [Storage] Quota Exceeded! Starting emergency cleanup...');
            
            try {
                const currentSlug = activeSlug || getActiveSlug();
                const keys = Object.keys(localStorage);
                let clearedCount = 0;

                const activeOrgId = currentSlug ? (localStorage.getItem(`cc_org_id_override_${currentSlug}`) || null) : null;
                
                // 1. Target Inactive Data
                keys.forEach(k => {
                    // 🛡️ CRITICAL AUTH PROTECTION: Never touch these keys!
                    const isAuth = k.startsWith('sb-') || 
                                  k.includes('supabase') || 
                                  k.includes('auth-token') || 
                                  k.includes('cc_staff_session') || 
                                  k.includes('cc_active_slug') || 
                                  k.includes('cc_auth_token');
                                  
                    if (isAuth) return;

                    const isCurrent = currentSlug && (k.includes(currentSlug) || (activeOrgId && k.includes(activeOrgId)));
                    if (!isCurrent && k.startsWith('cc_')) {
                        localStorage.removeItem(k);
                        clearedCount++;
                    }
                });

                console.log(`🧹 [Storage] Emergency cleanup complete. Removed ${clearedCount} inactive keys.`);
                
                // 2. Intelligent Data Thinning (Compressing images instead of stripping)
                let thinnedValue = value;
                if (value.length > 150000) { // If > 150KB
                    try {
                        const parsed = JSON.parse(value);
                        const process = async (obj: any): Promise<any> => {
                            if (!obj || typeof obj !== 'object') return obj;
                            if (Array.isArray(obj)) return Promise.all(obj.map(process));
                            const next: any = {};
                            for (const k in obj) {
                                if ((k === 'photo_url' || k === 'logo_url' || k === 'logoDataUrl') && typeof obj[k] === 'string' && obj[k].startsWith('data:')) {
                                    next[k] = await compressBase64(obj[k]);
                                } else {
                                    next[k] = await process(obj[k]);
                                }
                            }
                            return next;
                        };
                        const thinnedObj = await process(parsed);
                        thinnedValue = JSON.stringify(thinnedObj);
                        console.log(`📉 [Storage] Data compressed: ${Math.round(value.length/1024)}KB -> ${Math.round(thinnedValue.length/1024)}KB`);
                    } catch (e) {
                        thinnedValue = value.replace(/"(photo_url|logo_url|logoDataUrl)":"data:image\/[^"]+"/g, '"$1":null');
                    }
                }

                try {
                    localStorage.setItem(key, thinnedValue);
                } catch (retryErr) {
                    console.warn('☢️ [Storage] Secondary Failure. Initiating SAFE NUCLEAR WIPE...');
                    
                    // 🛡️ SCORCHED EARTH v5.0: ONLY touch our own cache keys. 
                    // NEVER touch Supabase or other system keys.
                    keys.forEach(k => {
                        const isSafeToWipe = k.startsWith('cc_') && 
                                           !k.includes('cc_staff_session') && 
                                           !k.includes('cc_active_slug') && 
                                           !k.includes('cc_org_id_override') &&
                                           !k.includes('cc_auth');
                                           
                        if (isSafeToWipe) {
                            localStorage.removeItem(k);
                        }
                    });
                    
                    try {
                        localStorage.setItem(key, thinnedValue);
                    } catch (finalErr) {
                        console.error('💀 [Storage] UNRECOVERABLE STORAGE FAILURE.');
                    }
                }
            } finally {
                isCleaning = false;
            }
        }
    }
}
