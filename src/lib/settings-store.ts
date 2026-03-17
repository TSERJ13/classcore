import { compactSlugify } from './utils';
import { syncStaffToCloud, fetchStaffFromCloud } from './sync-store';

export type ThemeKey = 'indigo' | 'violet' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'fuchsia';
export type BgKey = 'charcoal' | 'midnight' | 'abyss' | 'forest' | 'white' | 'ivory' | 'cocoa';

export type UserRole = 'owner' | 'manager' | 'teacher';

export interface StaffPermissions {
    canViewAttendance: boolean;
    canViewSubscriptions: boolean;
    canViewStudents: boolean;
    canViewCalendar: boolean;
    canEditCalendar: boolean;
    canViewGroups: boolean;
    canViewTeachers: boolean;
    canViewHalls: boolean;
    canViewShop: boolean;
    canViewAnalytics: boolean;
    canViewSMS: boolean;
    // Legacy / Admin
    canAddStudents?: boolean;
    canDeleteRecords?: boolean;
    manageBilling?: boolean;
    viewFinancials?: boolean;
    manageInventory?: boolean;
}

export interface TrashItem {
    id: string;
    type: 'student' | 'subscription' | 'sale' | 'staff' | 'hall';
    data: any;
    branchId: string;
    deletedAt: string;
    deletedBy: string;
}

export interface SubscriptionLog {
    id: string;
    studentId: string;
    studentName: string;
    planName: string;
    amount: number;
    date: string;
    issuedBy: string;
    issuedByName?: string;
    branchId: string;
    branchName?: string;
    groupName?: string;
}

export interface StaffMember {
    id: string;
    org_id: string;
    full_name: string;
    first_name?: string;
    last_name?: string;
    phone: string;
    email?: string;
    password?: string;
    role: UserRole | string;
    permissions: StaffPermissions;
    photo_url?: string;
    allowedBranchIds?: string[];
    // Teacher specific
    specialty?: string[];
    bio?: string;
    rate_per_hour?: number;
    rate_per_month?: number;
    salary_percentage?: number;
    assigned_group_ids?: string[];
    assigned_individual?: boolean;
    status: 'active' | 'on_leave' | 'inactive';
    created_at: string;
}

export interface Branch {
    id: string;
    name: string;
    address?: string;
    is_active: boolean;
    created_at?: string;
}

export interface StudioSettings {
    studioName: string;
    studioSlug: string;
    logoDataUrl: string | null;   // base64 image or null
    currency: 'GEL' | 'USD' | 'EUR';
    language: 'ka' | 'ru' | 'en';
    timezone: string;
    googleCalendarEnabled: boolean;
    themeKey: ThemeKey;
    bgKey: BgKey;
    accentColor: string;          // CSS HSL value
    notifications: {
        newStudent: boolean;
        lowSessions: boolean;
        dailyReport: boolean;
        telegramBot: boolean;
        autoSms: boolean;
    };
    security: {
        twoFactor: boolean;
        sessionTimeout: number; // minutes
    };
    pausePrices: {
        '7': number;
        '14': number;
        '30': number;
        '60': number;
    };
    landingContent: {
        heroTitle: string;
        heroSubtitle: string;
        features: Array<{ title: string; desc: string; icon: string }>;
    };
    sms_templates: {
        ka: {
            expiration_day_0: string;
            birthday: string;
            new_year: string;
            easter: string;
            march_8: string;
            sept_1: string;
        };
        ru: {
            expiration_day_0: string;
            birthday: string;
            new_year: string;
            easter: string;
            march_8: string;
            sept_1: string;
        };
        en: {
            expiration_day_0: string;
            birthday: string;
            new_year: string;
            easter: string;
            march_8: string;
            sept_1: string;
        };
    };
    cabinetCode?: string;
    customRoles?: string[];
    branches: Branch[];
    staff: StaffMember[];
    trash?: TrashItem[];
    subscriptionLogs?: SubscriptionLog[];
    // Non-synced / Local only
    activeBranchId: string;
}

export const THEMES: Record<ThemeKey, { label: string; accent: string; accentHex: string; bg: string; text: string; border: string; from: string; to: string }> = {
    indigo: { label: 'Indigo', accent: '239 84% 67%', accentHex: '#6366f1', bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30', from: 'from-indigo-500', to: 'to-violet-600' },
    violet: { label: 'Violet', accent: '262 83% 68%', accentHex: '#8b5cf6', bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', from: 'from-violet-500', to: 'to-purple-600' },
    emerald: { label: 'Emerald', accent: '158 64% 52%', accentHex: '#10b981', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', from: 'from-emerald-500', to: 'to-teal-600' },
    rose: { label: 'Rose', accent: '347 77% 61%', accentHex: '#f43f5e', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', from: 'from-rose-500', to: 'to-pink-600' },
    amber: { label: 'Amber', accent: '38 92% 50%', accentHex: '#f59e0b', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', from: 'from-amber-500', to: 'to-orange-600' },
    cyan: { label: 'Cyan', accent: '189 94% 43%', accentHex: '#06b6d4', bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30', from: 'from-cyan-500', to: 'to-blue-600' },
    fuchsia: { label: 'Fuchsia', accent: '292 91% 63%', accentHex: '#e879f9', bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30', from: 'from-fuchsia-500', to: 'to-purple-600' },
};

export type BgTheme = { label: string; base: string; surface: string; card: string; preview: string };
export const BG_THEMES: Record<BgKey, BgTheme> = {
    charcoal: { label: 'Charcoal', base: '#0e0e12', surface: '#111116', card: '#161620', preview: 'bg-[#0e0e12]' },
    midnight: { label: 'Midnight', base: '#080c14', surface: '#0d1424', card: '#121c30', preview: 'bg-[#080c14]' },
    abyss: { label: 'Abyss', base: '#050508', surface: '#0a0a0f', card: '#0f0f16', preview: 'bg-[#050508]' },
    forest: { label: 'Forest', base: '#071310', surface: '#0c1c18', card: '#112420', preview: 'bg-[#071310]' },
    white: { label: 'White', base: '#ffffff', surface: '#f8f9fa', card: '#ffffff', preview: 'bg-[#ffffff]' },
    ivory: { label: 'Ivory', base: '#fefcf8', surface: '#faf8f3', card: '#ffffff', preview: 'bg-[#fefcf8]' },
    cocoa: { label: 'Cocoa', base: '#faf5ed', surface: '#f3ede4', card: '#ffffff', preview: 'bg-[#faf5ed]' },
};

export const STORAGE_KEY = 'cc_studio_settings';
export const REGISTRY_KEY = 'cc_studios_list';
export const ACTIVE_SLUG_KEY = 'cc_active_studio_slug';

/** Get the currently active studio slug for the dashboard */
export function getActiveSlug(): string {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS.studioSlug;
    return localStorage.getItem(ACTIVE_SLUG_KEY) || DEFAULT_SETTINGS.studioSlug;
}

/** Set the currently active studio slug */
export function setActiveSlug(slug: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACTIVE_SLUG_KEY, slug);
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

/** 
 * Validates staff credentials across all registered studios.
 * Returns the staff member and their studio slug if found, or an error object if cloud login fails.
 */
export async function validateStaffLogin(email: string, password: string): Promise<{ staff: StaffMember, slug: string } | { error: string } | null> {
    if (typeof window === 'undefined') return null;

    const cleanEmail = email.trim().toLowerCase();
    const tryLogin = (settings: StudioSettings, slug: string) => {
        const staff = settings.staff?.find(s =>
            s.email?.toLowerCase().trim() === cleanEmail &&
            s.password === password
        );
        return staff ? { staff, slug } : null;
    };

    // 1. Try current active slug first (fastest)
    const activeResult = tryLogin(loadSettings(getActiveSlug()), getActiveSlug());
    if (activeResult) return activeResult;

    // 2. Try registry list
    const list = getStudioRegistry();
    for (const slug of list) {
        if (slug === getActiveSlug()) continue;
        const result = tryLogin(loadSettings(slug), slug);
        if (result) return result;
    }

    // 3. One last try with demo slug
    if (!list.includes(DEFAULT_SETTINGS.studioSlug)) {
        const demoResult = tryLogin(loadSettings(DEFAULT_SETTINGS.studioSlug), DEFAULT_SETTINGS.studioSlug);
        if (demoResult) return demoResult;
    }

    // 4. CLOUD FALLBACK: If local check fails, we might be on a new machine.
    console.log('🔍 Staff not found locally. Starting Cloud Fallback for:', cleanEmail);

    // Search the global database for a studio containing this staff email.
    try {
        const { findStudioByStaffEmail, fetchStaffFromCloud } = await import('./sync-store');
        const cloudResult = await findStudioByStaffEmail(cleanEmail);

        if (cloudResult) {
            console.log('📡 Cloud Found! Studio Slug:', cloudResult.slug);
            // IMPORTANT: Verify password before allowing access!
            if (cloudResult.staff.password !== password) {
                console.warn('❌ Password mismatch for cloud staff.');
                return { error: 'არასწორი პაროლი' }; // Password mismatch
            }

            console.log('✅ Password verified. Hydrating local store...');
            // Hydrate local store with cloud data for faster future logins
            const cloudStaff = await fetchStaffFromCloud(cloudResult.slug);
            if (cloudStaff) {
                saveSettings({ staff: cloudStaff }, undefined, cloudResult.slug);
            }
            return cloudResult;
        } else {
            console.warn('❌ Staff not found in cloud registry for:', cleanEmail);
            // Check if we are searching for something that might be stuck on a demo slug
            return { error: 'მომხმარებელი ვერ მოიძებნა. თუ ახალ კომპიუტერზე ხართ, დარწმუნდით რომ ძველ კომპიუტერზე "პარამეტრებში" დაყენებული გაქვთ საკუთარი (უნიკალური) სტუდიის მისამართი (Slug).' };
        }
    } catch (err: any) {
        console.error('❌ Cloud Fallback Critical Error:', err);
        return { error: 'სისტემური შეცდომა სინქრონიზაციისას.' };
    }

    return null;
}

/** Persists a staff session locally and synchronizes with a cookie for middleware awareness */
export function setStaffSession(session: { staff: StaffMember, slug: string } | null) {
    if (typeof window === 'undefined') return;
    if (session) {
        localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
        setCookie(STAFF_COOKIE_NAME, 'true', 7); // Set auth cookie for middleware
        setActiveSlug(session.slug);
    } else {
        localStorage.removeItem(STAFF_SESSION_KEY);
        deleteCookie(STAFF_COOKIE_NAME); // Clear auth cookie
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

export function getScopedKey(base: string, slug?: string, branchId?: string) {
    const finalSlug = slug || getActiveSlug();
    if (!finalSlug) return base;

    // Use raw session for scoping to avoid infinite recursion
    const session = getStaffSessionRaw();

    // If branchId is explicitly provided or we should use the active one
    const bId = branchId || (typeof window !== 'undefined' ? localStorage.getItem(`cc_active_branch_${finalSlug}`) : 'main');

    // Certain keys should always be studio-level (not branch-scoped)
    const sharedKeys = [STORAGE_KEY, 'cc_studios_list', 'cc_active_studio_slug', 'cc_global_history', 'cc_global_trash'];
    if (sharedKeys.includes(base)) {
        return `${base}_${finalSlug}`;
    }

    // ALWAYS scope by branch ID if available, including 'main'
    if (bId) {
        return `${base}_${finalSlug}_${bId}`;
    }

    return `${base}_${finalSlug}`;
}

/**
 * Studio Registry to track all unique studios on this machine.
 * Stores a list of slugs.
 */
export function getStudioRegistry(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(REGISTRY_KEY);
        return raw ? JSON.parse(raw) : [];
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

/** Generates a deterministic 6-digit numeric Cabinet Code from a studio's slug */
export function generateCabinetCode(slug: string): string {
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
    studioName: '',
    studioSlug: 'demo.classcore.ge',
    logoDataUrl: null,
    currency: 'GEL',
    language: 'ka',
    timezone: 'Asia/Tbilisi',
    googleCalendarEnabled: false,
    themeKey: 'indigo',
    bgKey: 'white',
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
            birthday: 'გამარჯობა {name}, გილოცავთ დაბადების დღეს! საუკეთესო სურვილებით, {studio}.',
            new_year: 'გილოცავთ ახალ წელს! გისურვებთ წარმატებულ და ბედნიერ წელს {studio}-სთან ერთად.',
            easter: 'გილოცავთ აღდგომის ბრწყინვალე დღესასწაულს! საუკეთესო სურვილებით, {studio}.',
            march_8: 'გილოცავთ 8 მარტს! გისურვებთ სილამაზეს და ბედნიერებას. პატივისცემით, {studio}.',
            sept_1: 'გილოცავთ სწავლის დაწყებას! გელით მეცადინეობებზე {studio}-ში.'
        },
        ru: {
            expiration_day_0: 'Здравствуйте {name}, соскучились по тренировкам? Ваш абонемент ({plan}) истекает сегодня. Пожалуйста, обновите его.',
            birthday: 'Здравствуйте {name}, с днем рождения! С наилучшими пожеланиями, {studio}.',
            new_year: 'С Новым Годом! Желаем успешного и счастливого года вместе с {studio}.',
            easter: 'Поздравляем со светлым праздником Пасхи! С наилучшими пожеланиями, {studio}.',
            march_8: 'Поздравляем с 8 Марта! Желаем красоты и счастья. С уважением, {studio}.',
            sept_1: 'Поздравляем с началом учебного года! Ждем вас на занятиях в {studio}.'
        },
        en: {
            expiration_day_0: 'Hello {name}, miss training? Your plan ({plan}) expires today. Please renew it.',
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
    customRoles: ['manager', 'teacher', 'receptionist', 'accountant'],
    activeBranchId: 'main',
    staff: [],
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
            }))
        };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function saveSettings(s: Partial<StudioSettings>, current?: StudioSettings, slug?: string): StudioSettings {
    const base = current || loadSettings(slug);
    const next = { ...base, ...s };
    if (typeof window !== 'undefined') {
        try {
            const finalSlug = slug || next.studioSlug || getActiveSlug();
            const scopedKey = getScopedKey(STORAGE_KEY, finalSlug);
            localStorage.setItem(scopedKey, JSON.stringify(next));

            // Update active slug if it changed
            if (next.studioSlug) {
                setActiveSlug(next.studioSlug);
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

/** Apply background CSS variables to :root */
export function applyBg(bgKey: BgKey) {
    const bg = BG_THEMES[bgKey];
    if (typeof document !== 'undefined') {
        // Set CSS variables
        document.documentElement.style.setProperty('--bg-base', bg.base);
        document.documentElement.style.setProperty('--bg-surface', bg.surface);
        document.documentElement.style.setProperty('--bg-card', bg.card);

        // Apply to body directly
        document.body.style.background = bg.base;
        document.body.style.transition = 'background-color 0.3s ease';

        // Apply to html element as well
        document.documentElement.style.background = bg.base;

        // For light themes, adjust text colors
        const isLight = ['white', 'ivory', 'cocoa'].includes(bgKey);
        if (isLight) {
            document.documentElement.classList.add('light-theme');
            document.documentElement.style.setProperty('--text-primary', '#111827');
            document.documentElement.style.setProperty('--text-muted', '#6b7280');
            document.documentElement.style.setProperty('--border-subtle', 'rgba(0,0,0,0.06)');
        } else {
            document.documentElement.classList.remove('light-theme');
            document.documentElement.style.setProperty('--text-primary', '#ffffff');
            document.documentElement.style.setProperty('--text-muted', 'rgba(255,255,255,0.6)');
            document.documentElement.style.setProperty('--border-subtle', 'rgba(255,255,255,0.1)');
        }

        // Force reflow to ensure styles are applied
        void document.body.offsetHeight;
    }
}
