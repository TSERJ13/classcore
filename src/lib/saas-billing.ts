import { getScopedKey } from './utils';

export const SAAS_PRICE_GEL = 49;
export const TRIAL_DAYS = 30;
export const GRACE_DAYS = 2;

// Canonical platform pricing — the SINGLE source of truth for what each studio
// plan costs per month. Keyed by the real plan names; 'basic'/'enterprise' are
// legacy aliases. Use platformPrice() everywhere instead of inline literals.
export const PLATFORM_PLAN_PRICES: Record<string, number> = {
    trial: 0, pro: SAAS_PRICE_GEL, custom: 0, special: 0, basic: SAAS_PRICE_GEL, enterprise: 0,
};
export function platformPrice(plan?: string | null): number {
    return PLATFORM_PLAN_PRICES[plan || 'trial'] ?? 0;
}

export type BillingStatus = 'trial' | 'active' | 'overdue' | 'suspended';

export interface BillingState {
    status: BillingStatus;
    plan: string;
    trialStartDate: string | null;
    lastPaidDate: string | null;
    daysLeftInTrial: number;
    daysOverdue: number;
    nextDueDate: string | null;
    accountBalance: number;
    manualBlock: boolean;
}

export function getBillingState(slug: string): BillingState {
    if (typeof window === 'undefined') return { status: 'trial', plan: 'trial', trialStartDate: null, lastPaidDate: null, daysLeftInTrial: TRIAL_DAYS, daysOverdue: 0, nextDueDate: null, accountBalance: 0, manualBlock: false };
    try {
        let settings: any = { plan: 'trial', trialStartDate: null, lastPaidDate: null, accountBalance: 0 };
        try {
            const { loadSettings } = require('./settings-store');
            settings = { ...settings, ...loadSettings() };
        } catch {
            const raw = localStorage.getItem(getScopedKey('cc_studio_settings', slug));
            if (raw) settings = { ...settings, ...JSON.parse(raw) };
        }

        const metaKey = getScopedKey('cc_sa_meta', slug);
        const metaRaw = localStorage.getItem(metaKey);
        let meta = { plan: 'trial', manualBlock: false, suspended: false };
        try { if (metaRaw) { const p = JSON.parse(metaRaw); if (p && typeof p === 'object') meta = { ...meta, ...p }; } } catch {}
        
        const plan = meta.plan || settings.plan || 'trial';
        const manualBlock = meta.manualBlock === true || meta.suspended === true;

        // If SuperAdmin assigned a non-trial plan (pro, custom, special, basic, enterprise)
        if (plan && plan !== 'trial') {
            return {
                status: 'active',
                plan,
                trialStartDate: settings.trialStartDate || new Date().toISOString(),
                lastPaidDate: settings.lastPaidDate || new Date().toISOString(),
                daysLeftInTrial: 0,
                daysOverdue: 0,
                nextDueDate: null,
                accountBalance: settings.accountBalance || 0,
                manualBlock
            };
        }

        const trialStart = settings.trialStartDate ? new Date(settings.trialStartDate) : new Date();
        if (!settings.trialStartDate) {
            // First time — set trial start
            saveBillingData(slug, { trialStartDate: trialStart.toISOString() });
        }

        const now = new Date();
        const trialEnd = new Date(trialStart);
        trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

        const lastPaid = settings.lastPaidDate ? new Date(settings.lastPaidDate) : null;

        // If paid, check if current month is covered
        if (lastPaid) {
            const nextDue = new Date(lastPaid);
            nextDue.setMonth(nextDue.getMonth() + 1);
            const daysOverdue = Math.floor((now.getTime() - nextDue.getTime()) / (1000 * 60 * 60 * 24));

            if (daysOverdue <= 0) {
                return { status: 'active', plan, trialStartDate: trialStart.toISOString(), lastPaidDate: lastPaid.toISOString(), daysLeftInTrial: 0, daysOverdue: 0, nextDueDate: nextDue.toISOString(), accountBalance: settings.accountBalance || 0, manualBlock };
            } else if (daysOverdue <= GRACE_DAYS) {
                return { status: 'overdue', plan, trialStartDate: trialStart.toISOString(), lastPaidDate: lastPaid.toISOString(), daysLeftInTrial: 0, daysOverdue, nextDueDate: nextDue.toISOString(), accountBalance: settings.accountBalance || 0, manualBlock };
            } else {
                return { status: 'suspended', plan, trialStartDate: trialStart.toISOString(), lastPaidDate: lastPaid.toISOString(), daysLeftInTrial: 0, daysOverdue, nextDueDate: nextDue.toISOString(), accountBalance: settings.accountBalance || 0, manualBlock };
            }
        }

        // No payment — check trial
        const daysInTrial = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24));
        const daysLeftInTrial = Math.max(0, TRIAL_DAYS - daysInTrial);

        if (daysInTrial < TRIAL_DAYS) {
            return { status: 'trial', plan, trialStartDate: trialStart.toISOString(), lastPaidDate: null, daysLeftInTrial, daysOverdue: 0, nextDueDate: trialEnd.toISOString(), accountBalance: settings.accountBalance || 0, manualBlock };
        }

        // Trial ended, no payment
        const daysOverdue = daysInTrial - TRIAL_DAYS;
        if (daysOverdue <= GRACE_DAYS) {
            return { status: 'overdue', plan, trialStartDate: trialStart.toISOString(), lastPaidDate: null, daysLeftInTrial: 0, daysOverdue, nextDueDate: trialEnd.toISOString(), accountBalance: settings.accountBalance || 0, manualBlock };
        }
        return { status: 'suspended', plan, trialStartDate: trialStart.toISOString(), lastPaidDate: null, daysLeftInTrial: 0, daysOverdue, nextDueDate: trialEnd.toISOString(), accountBalance: settings.accountBalance || 0, manualBlock };

    } catch {
        return { status: 'trial', plan: 'trial', trialStartDate: null, lastPaidDate: null, daysLeftInTrial: TRIAL_DAYS, daysOverdue: 0, nextDueDate: null, accountBalance: 0, manualBlock: false };
    }
}

export function saveBillingData(slug: string, patch: Record<string, unknown>) {
    if (typeof window === 'undefined') return;
    try {
        // Also update legacy cc_saas_billing for backwards compatibility during migration
        const key = getScopedKey('cc_saas_billing', slug);
        const existing = JSON.parse(localStorage.getItem(key) || '{}');
        localStorage.setItem(key, JSON.stringify({ ...existing, ...patch }));

        // Now save to real DB-backed settings
        const { loadSettings, saveSettings } = require('./settings-store');
        const currentSettings = loadSettings();
        
        saveSettings(patch, currentSettings, slug);
        
        // Let StudioContext upload it to cloud via the pushFullStudioMetadata flow
        // Actually, saveSettings DOES NOT automatically pushFullStudioMetadata, 
        // StudioContext does it. But we can import and call it directly here.
        import('@/lib/master-sync').then(mod => {
            mod.pushFullStudioMetadata(slug, currentSettings.studioName, { ...currentSettings, ...patch, settings: { ...currentSettings, ...patch } });
        });
        
    } catch { }
}

export function updateBillingState(slug: string, patch: Partial<BillingState>) {
    saveBillingData(slug, patch);
}

export type PaymentMethod = 'cash' | 'card' | 'transfer';

export function recordPayment(slug: string, method: PaymentMethod, amount: number = SAAS_PRICE_GEL, monthsToYield: number = 1) {
    if (typeof window === 'undefined') return;
    const billingKey = getScopedKey('cc_saas_billing', slug);
    const rawData = localStorage.getItem(billingKey);
    const data = rawData ? JSON.parse(rawData) : {};
    const now = new Date();

    // Determine the base date to add months to
    let startingDate = now;
    if (data.lastPaidDate) {
        const prevLastPaid = new Date(data.lastPaidDate);
        if (prevLastPaid > now) {
            // Already paid securely into the future
            startingDate = prevLastPaid;
        }
    }

    startingDate.setMonth(startingDate.getMonth() + monthsToYield);
    saveBillingData(slug, { lastPaidDate: startingDate.toISOString() });

    // Log payment
    try {
        const key = getScopedKey('cc_saas_payments', slug);
        const logs = JSON.parse(localStorage.getItem(key) || '[]');
        logs.push({ date: now.toISOString(), method, amount, months: monthsToYield, slug });
        localStorage.setItem(key, JSON.stringify(logs));
    } catch { }
}

export function extendSubscriptionByDays(slug: string, days: number) {
    if (typeof window === 'undefined') return;
    const billingKey = getScopedKey('cc_saas_billing', slug);
    const rawData = localStorage.getItem(billingKey);
    const data = rawData ? JSON.parse(rawData) : {};
    const now = new Date();

    // Determine the base date to add days to
    let startingDate = now;
    if (data.lastPaidDate) {
        const prevLastPaid = new Date(data.lastPaidDate);
        if (prevLastPaid > now) {
            startingDate = prevLastPaid;
        }
    }

    startingDate.setDate(startingDate.getDate() + days);
    saveBillingData(slug, { lastPaidDate: startingDate.toISOString() });

    // Log as a manual adjustment
    try {
        const key = getScopedKey('cc_saas_payments', slug);
        const logs = JSON.parse(localStorage.getItem(key) || '[]');
        logs.push({ date: now.toISOString(), method: 'transfer', amount: 0, days, slug, note: 'Manual Day Adjustment' });
        localStorage.setItem(key, JSON.stringify(logs));
    } catch { }
}

export function getPaymentLogs(slug: string): Array<{ date: string; method: PaymentMethod; amount: number }> {
    if (typeof window === 'undefined') return [];
    try { 
        const key = getScopedKey('cc_saas_payments', slug);
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : []; 
    } catch { return []; }
}

/** Trilingual SaaS billing reminder SMS */
export function getSaasReminderSms(lang: 'ka' | 'ru' | 'en', daysLeft: number): string {
    const d = daysLeft;
    return {
        ka: `ClassCore-ის გამოწერის ვადა იწურება ${d} დღეში. მომსახურების გასაგრძელებლად დაფარეთ საფასური (${SAAS_PRICE_GEL}₾).`,
        ru: `Срок подписки ClassCore истекает через ${d} дней. Для продолжения работы оплатите подписку (${SAAS_PRICE_GEL}₾).`,
        en: `Your ClassCore subscription expires in ${d} days. To continue using the service, please complete the payment (${SAAS_PRICE_GEL}₾).`,
    }[lang];
}
