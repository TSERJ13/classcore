import { compactSlugify, STORAGE_KEY, ACTIVE_SLUG_KEY, REGISTRY_KEY, getActiveSlug as getActiveSlugLowLevel, getScopedKey, markLocalUpdate, getEffectiveOrgId, safeSetItem } from './utils';
export { STORAGE_KEY, ACTIVE_SLUG_KEY, REGISTRY_KEY, getScopedKey };
import { triggerInstantSync } from './sync-store';

import { 
    type ThemeKey, 
    type StaffRole as UserRole, 
    type StaffPermissions, 
    type TrashItem, 
    type SubscriptionLog, 
    type StaffMember, 
    type Branch, 
    type StudioSettings 
} from '@/types';

export type { ThemeKey, UserRole, StaffPermissions, TrashItem, SubscriptionLog, StaffMember, Branch, StudioSettings };

export const THEMES: Record<ThemeKey, { label: string; accent: string; accentHex: string; bg: string; text: string; border: string; from: string; to: string }> = {
    indigo: { label: 'Indigo', accent: '239 84% 67%', accentHex: '#6366f1', bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30', from: 'from-indigo-500', to: 'to-violet-600' },
    violet: { label: 'Violet', accent: '262 83% 68%', accentHex: '#8b5cf6', bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', from: 'from-violet-500', to: 'to-purple-600' },
    emerald: { label: 'Emerald', accent: '158 64% 52%', accentHex: '#10b981', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', from: 'from-emerald-500', to: 'to-teal-600' },
    rose: { label: 'Rose', accent: '347 77% 61%', accentHex: '#f43f5e', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', from: 'from-rose-500', to: 'to-pink-600' },
    amber: { label: 'Amber', accent: '38 92% 50%', accentHex: '#f59e0b', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', from: 'from-amber-500', to: 'to-orange-600' },
    cyan: { label: 'Cyan', accent: '189 94% 43%', accentHex: '#06b6d4', bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30', from: 'from-cyan-500', to: 'to-blue-600' },
    fuchsia: { label: 'Fuchsia', accent: '292 91% 63%', accentHex: '#e879f9', bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30', from: 'from-fuchsia-500', to: 'to-purple-600' },
};


/** Get the currently active studio slug for the dashboard */
export function getActiveSlug(): string {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS.studioSlug;
    return getActiveSlugLowLevel() || DEFAULT_SETTINGS.studioSlug;
}

/** Set the currently active studio slug */
export function setActiveSlug(slug: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACTIVE_SLUG_KEY, slug);
    setCookie('cc_active_slug', slug, 365);
}

const STAFF_SESSION_KEY = 'cc_staff_session';
const STAFF_COOKIE_NAME = 'cc_staff_auth';

function setCookie(name: string, value: string, days = 7) {
    if (typeof document === 'undefined') return;
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict`;
}

function deleteCookie(name: string) {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`;
}

export type LoginResult = 
    | { type: 'single', staff: StaffMember, slug: string }
    | { type: 'multiple', studios: { staff: StaffMember, slug: string, name: string, logoUrl: string | null, _token?: string }[] }
    | { error: string };

/**
 * Validates staff credentials and establishes a signed, server-verified
 * staff session (see /api/auth/staff-login and src/lib/staff-token.ts).
 *
 * This used to run entirely client-side: it fetched every staff member's
 * PLAINTEXT password for a studio down to the browser (via
 * fetchStaffFromCloud's `.select('*')`) and compared them in JS, and the
 * resulting "you're logged in" signal was just an unsigned cookie anyone
 * could set themselves without knowing any password. The password check
 * now happens on the server, and a match returns a cryptographically
 * signed token instead of a forgeable flag. See staff-login/route.ts for
 * the full writeup.
 */
export async function validateStaffLogin(email: string, password: string): Promise<LoginResult | null> {
    if (typeof window === 'undefined') return null;

    try {
        const res = await fetch('/api/auth/staff-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (!data.ok) {
            if (data.error === 'invalid') return { error: 'მომხმარებელი ან პაროლი არასწორია.' };
            return { error: data.error || 'სისტემური შეცდომა.' };
        }

        if (data.type === 'single') {
            return { type: 'single', staff: data.staff as StaffMember, slug: data.slug };
        }

        return {
            type: 'multiple',
            studios: (data.studios as any[]).map(s => ({
                staff: s.staff as StaffMember,
                slug: s.slug,
                name: s.name,
                logoUrl: s.staff?.photo_url || null,
                // Carried through so setStaffSession -> /api/auth/staff-select
                // can activate this studio's session without asking for the
                // password again.
                _token: s.token,
            })) as any,
        };
    } catch (err: any) {
        console.error('❌ [Auth] staff-login request failed:', err);
        return { error: `სისტემური შეცდომა სინქრონიზაციისას (${err.message}).` };
    }
}

/**
 * Persists a staff session locally (for UI display — which staff member,
 * which studio) and keeps the active-slug cookie/localStorage in sync.
 *
 * This no longer sets a `cc_staff_auth` cookie: that was the forgeable
 * "true" flag middleware/session-check used to trust. The real,
 * server-verified session cookie (`cc_staff_token`, httpOnly, signed) is
 * set by the server in /api/auth/staff-login or /api/auth/staff-select —
 * see activateStaffSession() below, which must be called (and awaited)
 * for a 'multiple studios' login result before calling this function.
 */
export function setStaffSession(session: { staff: StaffMember, slug: string } | null) {
    if (typeof window === 'undefined') return;
    if (session) {
        localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
        setCookie('cc_studio_name', encodeURIComponent(session.staff.org_id || ''), 7); // org_id often used as fallback name
        setActiveSlug(session.slug);
    } else {
        localStorage.removeItem(STAFF_SESSION_KEY);
        deleteCookie(STAFF_COOKIE_NAME); // legacy cookie cleanup, harmless if already absent
        deleteCookie('cc_active_slug');
        deleteCookie('cc_studio_name');
    }
}

/**
 * Activates the real, signed staff session cookie for one of the studios
 * returned by a 'multiple' validateStaffLogin() result. Must be called
 * (and awaited) BEFORE setStaffSession() for that studio's choice — it's
 * what actually authenticates the browser; setStaffSession() only updates
 * local UI state. Returns false if the token was invalid/expired, in
 * which case the caller should treat this as a failed login, not silently
 * proceed.
 */
export async function activateStaffSession(studio: { _token?: string }): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!studio._token) return false; // 'single' logins already set the cookie server-side
    try {
        const res = await fetch('/api/auth/staff-select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: studio._token }),
        });
        const data = await res.json();
        return !!data.ok;
    } catch (err) {
        console.error('❌ [Auth] staff-select request failed:', err);
        return false;
    }
}

/** Retrieves the current staff session raw data (no recursion) */
export function getStaffSessionRaw(): { staff: StaffMember, slug: string } | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(STAFF_SESSION_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
}

/** Retrieves the current staff session if it exists */
export function getStaffSession(): { staff: StaffMember, slug: string } | null {
    return getStaffSessionRaw();
}

/** Centralized key generator - Moved to utils */

/**
 * Studio Registry to track all unique studios on this machine.
 * Stores a list of slugs.
 */
export function getStudioRegistry(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(REGISTRY_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

export function addToRegistry(slug: string) {
    if (typeof window === 'undefined') return;
    const list = getStudioRegistry();
    if (!list.includes(slug)) {
        list.push(slug);
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(list));
    }
}

/** Removes a specific slug from the local registry */
export function removeFromRegistry(slug: string) {
    if (typeof window === 'undefined') return;
    const list = getStudioRegistry();
    const next = list.filter(s => s !== slug);
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(next));
}

/** Removes slugs from global list if their settings don't exist in localStorage */
export function cleanupRegistry() {
    if (typeof window === 'undefined') return;
    const list = getStudioRegistry();
    if (!Array.isArray(list)) return;
    
    const next = list.filter(slug => {
        if (slug === DEFAULT_SETTINGS.studioSlug) return true;
        const key = getScopedKey(STORAGE_KEY, slug);
        return !!localStorage.getItem(key);
    });
    if (next.length !== list.length) {
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(next));
        console.log('🧹 [SettingsStore] Registry cleaned. Removed orphans:', list.length - next.length);
    }
}

/** 
 * Reclaims the entire studio registry for a given email from the cloud.
 * Useful for syncing across multiple devices.
 */
export async function reclaimStudioRegistry(email: string) {
    if (typeof window === 'undefined') return;
    const cleanEmail = email.trim().toLowerCase();
    
    try {
        const { findAllStudiosByStaffEmail } = await import('./sync-store');
        const results = await findAllStudiosByStaffEmail(cleanEmail);
        
        if (results.length > 0) {
            const currentList = getStudioRegistry();
            const newSlugs = results.filter(r => !currentList.includes(r.slug));
            
            if (newSlugs.length > 0) {
                console.log(`📡 [SettingsStore] Reclaiming ${newSlugs.length} new studios from cloud for ${cleanEmail}`);
                newSlugs.forEach(r => addToRegistry(r.slug));
                // ONLY trigger event if we actually added something new
                window.dispatchEvent(new Event('cc_settings_update'));
            }
        }
    } catch (err) {
        console.error('❌ [SettingsStore] Failed to reclaim registry:', err);
    }
}

/**
 * Ensures studio name is unique globally for this machine.
 * If name exists under a different slug, adds a digit.
 */
export function ensureUniqueName(name: string, currentSlug?: string): string {
    const list = getStudioRegistry();
    let uniqueName = name;
    let counter = 2;

    const isNameTaken = (n: string) => {
        return list.some(slug => {
            if (slug === currentSlug) return false;
            const settings = loadSettings(slug);
            return settings.studioName.trim().toLowerCase() === n.trim().toLowerCase();
        });
    };

    while (isNameTaken(uniqueName)) {
        uniqueName = `${name} ${counter}`;
        counter++;
    }

    return uniqueName;
}

/**
 * Ensures studio slug is unique globally for this machine.
 * Joins words, removes special chars, and appends a number if taken.
 */
export function ensureUniqueSlug(name: string, currentSlug?: string): string {
    // Proactively cleanup before checking to avoid blocking by orphans
    cleanupRegistry();

    const list = getStudioRegistry();
    const baseSlug = compactSlugify(name);
    let uniqueSlug = baseSlug;
    let counter = 2;

    const isSlugTaken = (s: string) => {
        if (s === currentSlug) return false;
        return list.includes(s);
    };

    while (isSlugTaken(uniqueSlug)) {
        uniqueSlug = `${baseSlug}${counter}`;
        counter++;
    }

    return uniqueSlug;
}

/**
 * Migrates ALL studio-scoped data from oldSlug to newSlug in localStorage.
 * This is CRITICAL to prevent data loss when changing studio slugs.
 */
export function migrateSlugData(oldSlug: string, newSlug: string) {
    if (typeof window === 'undefined' || !oldSlug || !newSlug || oldSlug === newSlug) return;

    console.log(`🚀 [SettingsStore] Migrating data: ${oldSlug} -> ${newSlug}`);

    const keys = Object.keys(localStorage);
    const affectedKeys: string[] = [];

    // 1. Re-map the settings and all scoped data keys
    keys.forEach(k => {
        // Match various patterns: _slug, :slug, etc.
        const matches = k.endsWith(`_${oldSlug}`) || k.includes(`_${oldSlug}_`) || k.includes(`:${oldSlug}`);
        
        if (matches) {
            const newVal = localStorage.getItem(k);
            if (newVal) {
                // Use a safe replace to switch the slug while preserving surrounding delimiters
                const newKey = k.replace(oldSlug, newSlug);
                localStorage.setItem(newKey, newVal);
                localStorage.removeItem(k);
                affectedKeys.push(`${k} -> ${newKey}`);
            }
        }
    });

    // 2. Update the Registry
    const list = getStudioRegistry();
    const nextList = list.map(s => s === oldSlug ? newSlug : s);
    localStorage.setItem(REGISTRY_KEY, JSON.stringify([...new Set(nextList)]));

    // 3. Update the Staff Session if active
    const session = getStaffSessionRaw();
    if (session && session.slug === oldSlug) {
        localStorage.setItem('cc_staff_session', JSON.stringify({ ...session, slug: newSlug }));
    }

    // 4. Update the Active Slug
    const active = localStorage.getItem(ACTIVE_SLUG_KEY);
    if (active === oldSlug) {
        localStorage.setItem(ACTIVE_SLUG_KEY, newSlug);
    }

    console.log(`✅ [SettingsStore] Migration complete. Moved ${affectedKeys.length} keys.`);
    
    // Broadcast for UI sync
    window.dispatchEvent(new Event('cc_settings_update'));
}

/** Generates a deterministic 6-digit numeric Cabinet Code from a studio's slug */
export function generateCabinetCode(slug: string): string {
    if (!slug) return '000000';
    let hash = 0;
    const s = slug.toLowerCase().trim();
    for (let i = 0; i < s.length; i++) {
        const char = s.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit int
    }
    // Make it positive and exactly 6 digits (pad with 0s if necessary)
    const positiveHash = Math.abs(hash);
    const code = (positiveHash % 900000) + 100000; // ensures 100000-999999 range
    return code.toString();
}

export const DEFAULT_SETTINGS: StudioSettings = {
    orgId: '',
    studioName: '',
    studioSlug: '',
    isWizardCompleted: false,
    logoDataUrl: null,
    plan: 'trial',
    currency: 'GEL',
    language: 'ka',
    timezone: 'Asia/Tbilisi',
    googleCalendarEnabled: false,
    themeKey: 'indigo',
    accentColor: '239 84% 67%',
    notifications: {
        newStudent: true,
        lowSessions: true,
        dailyReport: false,
        telegramBot: true,
        autoSms: true,
    },
    security: {
        twoFactor: false,
        sessionTimeout: 60,
    },
    pausePrices: {
        '7': 5,
        '14': 10,
        '30': 20,
        '60': 35,
    },
    landingContent: {
        heroTitle: '',
        heroSubtitle: '',
        features: [],
    },
    sms_templates: {
        ka: {
            expiration_day_0: 'გამარჯობა {name}, გენატრებათ ვარჯიში? თქვენი აბონემენტი ({plan}) იწურება დღეს. გთხოვთ განაახლოთ.',
            low_visits: 'გამარჯობა {name}, თქვენ დაგიმთავრდათ ვიზიტები სტუდიაში: {studio}. გთხოვთ განაახლოთ აბონემენტი.',
            birthday: 'გამარჯობა {name}, გილოცავთ დაბადების დღეს! საუკეთესო სურვილებით, {studio}.',
            new_year: 'გილოცავთ ახალ წელს! გისურვებთ წარმატებულ და ბედნიერ წელს {studio}-სთან ერთად.',
            easter: 'გილოცავთ აღდგომის ბრწყინვალე დღესასწაულს! საუკეთესო სურვილებით, {studio}.',
            march_8: 'გილოცავთ 8 მარტს! გისურვებთ სილამაზეს და ბედნიერებას. პატივისცემით, {studio}.',
            sept_1: 'გილოცავთ სწავლის დაწყებას! გელით მეცადინეობებზე {studio}-ში.'
        },
        ru: {
            expiration_day_0: 'Здравствуйте {name}, соскучились по тренировкам? Ваш абонемент ({plan}) истекает сегодня. Пожалуйста, обновите его.',
            low_visits: 'Здравствуйте {name}, у вас закончились визиты в студии: {studio}. Пожалуйста, обновите абонемент.',
            birthday: 'Здравствуйте {name}, с днем рождения! С наилучшими пожеланиями, {studio}.',
            new_year: 'С Новым Годом! Желаем успешного и счастливого года вместе с {studio}.',
            easter: 'Поздравляем со светлым праздником Пасхи! С наилучшими пожеланиями, {studio}.',
            march_8: 'Поздравляем с 8 Марта! Желаем красоты и счастья. С уважением, {studio}.',
            sept_1: 'Поздравляем с началом учебного года! Ждем вас на занятиях в {studio}.'
        },
        en: {
            expiration_day_0: 'Hello {name}, miss training? Your plan ({plan}) expires today. Please renew it.',
            low_visits: 'Hello {name}, you have run out of visits at {studio}. Please renew your subscription.',
            birthday: 'Happy Birthday {name}! Best wishes, {studio}.',
            new_year: 'Happy New Year! Wishing you a successful and happy year with {studio}.',
            easter: 'Happy Easter! Best wishes from {studio}.',
            march_8: 'Happy March 8! Wishing you beauty and happiness. Sincerely, {studio}.',
            sept_1: 'Happy First Day of School! Looking forward to seeing you at {studio}.'
        }
    },
    branches: [
        { id: 'main', name: 'მთავარი ფილიალი', is_active: true }
    ],
    owner_info: {
        first_name: '',
        last_name: '',
        email: '',
        phone: ''
    },
    customRoles: ['manager', 'teacher', 'receptionist', 'accountant'],
    activeBranchId: 'main',
    sms_enabled: true,
    primary_lang: 'ka',
    staff: [],
    subscription_plans: [],
    halls: [],
};

export function loadSettings(slug?: string): StudioSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
    try {
        const finalSlug = slug || getActiveSlug();
        const scopedKey = getScopedKey(STORAGE_KEY, finalSlug);
        let raw = localStorage.getItem(scopedKey);

        if (!raw) {
            const defaults = { ...DEFAULT_SETTINGS };
            defaults.cabinetCode = generateCabinetCode(finalSlug);
            return defaults;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
             return { ...DEFAULT_SETTINGS, cabinetCode: generateCabinetCode(finalSlug) };
        }

        let cabinetCode = parsed.cabinetCode;
        if (!cabinetCode) {
            cabinetCode = generateCabinetCode(finalSlug);
        }

        return {
            ...DEFAULT_SETTINGS,
            ...parsed,
            cabinetCode,
            notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications || {}) },
            security: { ...DEFAULT_SETTINGS.security, ...(parsed.security || {}) },
            landingContent: { ...DEFAULT_SETTINGS.landingContent, ...(parsed.landingContent || {}) },
            owner_info: { ...DEFAULT_SETTINGS.owner_info, ...(parsed.owner_info || {}) },
            isWizardCompleted: !!parsed.isWizardCompleted,
            sms_templates: {
                ka: { ...DEFAULT_SETTINGS.sms_templates.ka, ...(parsed.sms_templates?.ka || {}) },
                ru: { ...DEFAULT_SETTINGS.sms_templates.ru, ...(parsed.sms_templates?.ru || {}) },
                en: { ...DEFAULT_SETTINGS.sms_templates.en, ...(parsed.sms_templates?.en || {}) },
            },
            staff: (parsed.staff || []).map((s: any) => ({
                ...s,
                specialty: Array.isArray(s.specialty) ? s.specialty : [],
                assigned_group_ids: Array.isArray(s.assigned_group_ids) ? s.assigned_group_ids : [],
                allowedBranchIds: Array.isArray(s.allowedBranchIds) ? s.allowedBranchIds : [],
            })),
            subscription_plans: Array.isArray(parsed.subscription_plans) ? parsed.subscription_plans : [],
            halls: Array.isArray(parsed.halls) ? parsed.halls : [],
        };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function saveSettings(s: Partial<StudioSettings>, current?: StudioSettings, slug?: string): StudioSettings {
    const base = current || loadSettings(slug);
    const next = { ...base, ...s };
    
    // Safety: Auto-generate slug if missing but name exists
    if (!next.studioSlug && next.studioName && next.studioName.toLowerCase() !== 'studio') {
        next.studioSlug = compactSlugify(next.studioName);
    }
    if (typeof window !== 'undefined') {
        try {
            const finalSlug = slug || next.studioSlug || getActiveSlug();
            const finalOrgId = getEffectiveOrgId(finalSlug);
            const scopedKey = getScopedKey(STORAGE_KEY, finalSlug);
            safeSetItem(scopedKey, JSON.stringify(next), finalSlug);
            markLocalUpdate();

            // Update active slug if it changed
            if (next.studioSlug) {
                setActiveSlug(next.studioSlug);
            }
            
            if (finalSlug && finalSlug !== 'demo.classcore.ge') {
                const isVitalUpdate = s.staff || s.security || s.branches || s.studioName || s.logoDataUrl;
                triggerInstantSync();
                
                // 🚀 ATOMIC CLOUD SYNC: If we have an orgId, push the full state to ensure persistence
                if (finalOrgId && finalOrgId !== 'demo') {
                    if (s.staff && Array.isArray(s.staff)) {
                        import('./master-sync').then(({ syncRecordToCloud }) => {
                            s.staff!.forEach((member: any) => {
                                syncRecordToCloud('staff', {
                                    id: member.id,
                                    org_id: finalOrgId,
                                    full_name: member.full_name || `${member.first_name || ''} ${member.last_name || ''}`.trim(),
                                    first_name: member.first_name,
                                    last_name: member.last_name,
                                    email: member.email,
                                    phone: member.phone,
                                    role: member.role || 'teacher',
                                    salary_percentage: member.salary_percentage,
                                    rate_per_hour: member.rate_per_hour,
                                    rate_per_month: member.rate_per_month,
                                    data: member
                                }, finalOrgId).catch(() => {});
                            });
                        });
                    }

                    import('./master-sync').then(({ pushFullStudioMetadata }) => {
                        pushFullStudioMetadata(finalSlug, next.studioName || 'Studio', next);
                    });
                }
            }

            if (next.studioName) {
                setCookie('cc_studio_name', encodeURIComponent(next.studioName), 365);
            }
            if (next.language) {
                setCookie('cc_lang', next.language, 365);
            }

            // Also register the slug
            if (finalSlug) addToRegistry(finalSlug);

            // Notify UI that settings might have changed locally
            window.dispatchEvent(new Event('cc_settings_update'));
        } catch { /* quota */ }
    }
    return next;
}

/**
 * Converts all stored financial data based on exchange rates.
 */
export function convertFinancialData(from: string, to: string) {
    if (typeof window === 'undefined') return;

    const rates: Record<string, number> = {
        'GEL_USD': 1 / 2.7,
        'GEL_EUR': 1 / 2.9,
        'USD_GEL': 2.7,
        'USD_EUR': 2.7 / 2.9,
        'EUR_GEL': 2.9,
        'EUR_USD': 2.9 / 2.7,
    };

    const key = `${from}_${to}`;
    const rate = rates[key] || 1;

    if (rate === 1) return;

    const slug = getActiveSlug();

    // 1. Convert Plans
    const plansKey = getScopedKey('cc_subscription_plans', slug);
    const plansRaw = localStorage.getItem(plansKey);
    if (plansRaw) {
        try {
            const plans = JSON.parse(plansRaw);
            const updated = plans.map((p: any) => ({ ...p, price: Math.round(p.price * rate) }));
            localStorage.setItem(plansKey, JSON.stringify(updated));
        } catch (e) { }
    }

    // 2. Convert Sales
    const salesKey = getScopedKey('cc_shop_sales', slug);
    const salesRaw = localStorage.getItem(salesKey);
    if (salesRaw) {
        try {
            const sales = JSON.parse(salesRaw);
            const updated = sales.map((s: any) => ({ ...s, price: Math.round(s.price * rate) }));
            localStorage.setItem(salesKey, JSON.stringify(updated));
        } catch (e) { }
    }

    // 3. Convert Active Subscriptions
    const subsKey = getScopedKey('cc_student_subscriptions', slug);
    const subsRaw = localStorage.getItem(subsKey);
    if (subsRaw) {
        try {
            const subs = JSON.parse(subsRaw);
            Object.keys(subs).forEach(studentId => {
                subs[studentId] = subs[studentId].map((sub: any) => ({
                    ...sub,
                    amount_paid: sub.amount_paid ? Math.round(sub.amount_paid * rate) : sub.amount_paid
                }));
            });
            localStorage.setItem(subsKey, JSON.stringify(subs));
        } catch (e) { }
    }

    // 4. Convert Teachers (Rates)
    const teachersKey = getScopedKey('cc_teachers', slug);
    const teachersRaw = localStorage.getItem(teachersKey);
    if (teachersRaw) {
        try {
            const teachers = JSON.parse(teachersRaw);
            const updated = teachers.map((t: any) => ({
                ...t,
                rate_per_hour: t.rate_per_hour ? Math.round(t.rate_per_hour * rate) : t.rate_per_hour,
                rate_per_month: t.rate_per_month ? Math.round(t.rate_per_month * rate) : t.rate_per_month,
            }));
            localStorage.setItem(teachersKey, JSON.stringify(updated));
        } catch (e) { }
    }

    // 5. Convert Student Balance (if any)
    const studentDataKey = getScopedKey('cc_student_data', slug);
    const studentsRaw = localStorage.getItem(studentDataKey);
    if (studentsRaw) {
        try {
            const students = JSON.parse(studentsRaw);
            Object.keys(students).forEach(id => {
                if (students[id].balance !== undefined) {
                    students[id].balance = Math.round(students[id].balance * rate);
                }
            });
            localStorage.setItem(studentDataKey, JSON.stringify(students));
        } catch (e) { }
    }

    // 6. Convert Shop Products
    const productsKey = getScopedKey('cc_shop_products', slug);
    const productsRaw = localStorage.getItem(productsKey);
    if (productsRaw) {
        try {
            const products = JSON.parse(productsRaw);
            const updated = products.map((p: any) => ({ ...p, price: Math.round(p.price * rate) }));
            localStorage.setItem(productsKey, JSON.stringify(updated));
        } catch (e) { }
    }

    // Trigger updates
    window.dispatchEvent(new Event('cc_subscription_update'));
    window.dispatchEvent(new Event('cc_sale_update'));
    window.dispatchEvent(new Event('cc_teacher_update'));
    window.dispatchEvent(new Event('cc_student_update'));
    window.dispatchEvent(new Event('cc_product_update'));
}

export function patchNotifications(patch: Partial<StudioSettings['notifications']>, current?: StudioSettings, slug?: string): StudioSettings {
    const base = current || loadSettings(slug);
    return saveSettings({ notifications: { ...base.notifications, ...patch } }, base, slug);
}

export function patchSecurity(patch: Partial<StudioSettings['security']>, current?: StudioSettings, slug?: string): StudioSettings {
    const base = current || loadSettings(slug);
    return saveSettings({ security: { ...base.security, ...patch } }, base, slug);
}

/** Apply accent CSS variable to :root */
export function applyTheme(themeKey: ThemeKey) {
    const theme = THEMES[themeKey];
    if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--accent', theme.accent);
        document.documentElement.style.setProperty('--accent-hex', theme.accentHex);
    }
}

/** 
 * Gets the total count of unread support messages across all studios.
 * Support message is unread if its 'read' property is false AND sender is NOT 'student' (support).
 */
export function getUnreadSupportCount(): number {
    if (typeof window === 'undefined') return 0;
    const slugs = getStudioRegistry();
    if (!Array.isArray(slugs)) return 0;
    
    let total = 0;
    slugs.forEach(slug => {
        try {
            const key = `chat_${slug}_classcore_support`;
            const raw = localStorage.getItem(key);
            if (raw) {
                const msgs = JSON.parse(raw);
                if (Array.isArray(msgs)) {
                    const unread = msgs.filter((m: any) => m && m.read === false && m.sender !== 'student');
                    total += unread.length;
                }
            }
        } catch { }
    });
    return total;
}
/**
 * Wipes all local data associated with the current studio slug.
 * This includes students, check-ins, sales, and settings stored in localStorage.
 */
export function clearAllStudioData(slug: string) {
    if (typeof window === 'undefined') return;
    
    // 1. Get OrgId if possible for deeper cleanup
    const settings = loadSettings(slug);
    const orgId = settings.orgId;

    // 2. Also clear meta and billing data
    localStorage.removeItem(`cc_sa_meta_${slug}`);
    localStorage.removeItem(`cc_sa_meta_billing_${slug}`); // Ensure billing meta is also gone
    
    const keys = Object.keys(localStorage);
    let count = 0;
    
    keys.forEach(k => {
        // Scoped keys: cc_student_data_slug, cc_checkins_slug_2023-01-01, cc:slug:data
        // OR OrgId scoped: cc_student_data_UUID
        const isTargetSlug = k.includes(`_${slug}`) || k.includes(`${slug}_`) || k.includes(`:${slug}`);
        const isOrgScoped = orgId && (k.includes(`_${orgId}`) || k.includes(`${orgId}_`) || k.includes(`:${orgId}`));
        const isDemoSlug = k.includes('demo.classcore.ge') && slug === 'demo.classcore.ge';
        
        if (isTargetSlug || isOrgScoped || isDemoSlug) {
            localStorage.removeItem(k);
            count++;
        }
    });

    console.log(`🧹 [SettingsStore] Master Clear: Removed ${count} keys for studio ${slug} (OrgID: ${orgId})`);

    // 3. Force remove from registry
    removeFromRegistry(slug);
    
    // 4. Also clear ANY keys related to active slugs/branches to force clean discovery
    localStorage.removeItem(ACTIVE_SLUG_KEY);
    localStorage.removeItem(`cc_active_branch_${slug}`);
    
    // Reload if current slug matches to refresh state
    const currentSlug = localStorage.getItem('cc_active_studio_slug');
    if (currentSlug === slug) {
        window.location.reload();
    }
}

export type ResetCategories = {
    plans?: boolean;
    students?: boolean;
    groups?: boolean;
    calendar?: boolean;
    halls?: boolean;
    teachers?: boolean;
    shop?: boolean;
    analytics?: boolean;
    notifications?: boolean;
};

/**
 * SELECTIVE RESET: Clears all student, group, sales, and calendar data 
 * but PRESERVES studio identity (name, logo, slug, branches).
 */
export async function resetStudioData(slug: string, options?: ResetCategories) {
    if (typeof window === 'undefined') return;

    // Default to everything if no options provided
    const cats = options || {
        plans: true, students: true, groups: true, calendar: true, halls: true,
        teachers: true, shop: true, analytics: true, notifications: true
    };

    // 1. CLEAR CLOUD FIRST (Nuclear Strike)
    try {
        const { masterStudioPurge } = await import('./sync-store');
        // If it's a full reset, we use the nuclear masterStudioPurge
        if (!options || Object.values(options).every(v => v === true)) {
            await masterStudioPurge(slug);
        } else {
            // TODO: Implement selective cloud purge if needed
            // For now, even a selective reset should probably trigger a sync pulse
        }
    } catch (err) {
        console.error('❌ [SettingsStore] Cloud reset failed:', err);
    }

    const prefixMap: Record<string, string[]> = {
        plans: ['cc_subscription_plans'],
        students: ['cc_student_data', 'cc_student_subscriptions', 'cc_deleted_students', 'cc_deleted_subscriptions', 'cc_student_plans', 'cc_student_groups', 'cc_student_balance', 'cc_bonus_points'],
        groups: ['cc_groups', 'cc_group_data', 'cc_attendance', 'cc_attendance_archive', 'cc_checkins_', 'cc_attendance_data'],
        calendar: ['cc_calendar_events', 'cc_events'],
        halls: ['cc_halls', 'cc_hall_rental', 'cc_hall_rentals', 'cc_halls_data'],
        teachers: ['cc_teachers', 'cc_staff', 'cc_salary_config', 'cc_salary_history', 'cc_salary_status', 'cc_salary_payouts'],
        shop: ['cc_shop_sales', 'cc_shop_products', 'cc_shop_inventory', 'cc_inventory', 'cc_sales', 'cc_shop_categories', 'cc_product_categories'],
        analytics: ['cc_expenses', 'cc_audit_logs', 'cc_uid_registry', 'cc_trash_bin', 'cc_attendance_data', 'cc_checkins_'],
        notifications: ['cc_notifications']
    };

    const settings = loadSettings(slug);
    const orgId = settings.orgId;

    const keys = Object.keys(localStorage);
    let count = 0;

    keys.forEach(k => {
        // Key is for this studio if it contains slug OR orgId (standard scoping)
        const isTargetStudio = k.includes(`_${slug}`) || (orgId && k.includes(`_${orgId}`));
        if (!isTargetStudio) return;

        // Check each enabled category
        Object.entries(cats).forEach(([cat, enabled]) => {
            if (enabled && prefixMap[cat]?.some(p => k.startsWith(p))) {
                // Wildcard cleanup for date-based keys (like cc_checkins_YYYY-MM-DD)
                if (k.startsWith('cc_checkins_')) {
                    localStorage.removeItem(k);
                    count++;
                    return;
                }

                // To suppress mock data, we set to empty instead of removing
                // ONLY specific structured records are Maps ({}), everything else is an Array ([])
                const mapPrefixes = ['cc_student_data', 'cc_student_subscriptions', 'cc_attendance_archive', 'cc_uid_registry'];
                const isMap = mapPrefixes.some(p => k.startsWith(p));
                
                localStorage.setItem(k, isMap ? '{}' : '[]');
                count++;
            }
        });
    });

    // Handle settings cleanup
    const updates: Partial<StudioSettings> = {};
    
    if (cats.teachers) {
        updates.staff = (settings.staff || []).map(s => s.role === 'owner' ? s : null).filter(Boolean) as StaffMember[];
    }
    if (cats.analytics) {
        (updates as any).trash = [];
    }

    if (Object.keys(updates).length > 0) {
        saveSettings(updates, settings, slug);
    }

    console.log(`🧹 [SettingsStore] Selective Reset complete for studio ${slug}. Options:`, cats);

    // Reload page to re-initialize stores
    window.location.reload();
}
/** 
 * Higher-level sync wrapper that automatically includes the latest staff list.
 * This is the preferred way to sync studio-level data (groups, students, etc.)
 */
export async function syncStudioDataToCloud(slug: string, data: any, orgId?: string) {
    if (typeof window === 'undefined') return;
    if (!slug || slug === 'demo.classcore.ge') return;
    
    // We already have the latest staff list in settings-store
    const settings = loadSettings(slug);
    
    try {
        const { pushStudioStateToCloud } = await import('./sync-store');
        return pushStudioStateToCloud(slug, settings.staff, data, 0, orgId || settings.orgId);
    } catch (err) {
        console.error('❌ [SyncHelper] Failed to push data for:', slug, err);
    }
}
