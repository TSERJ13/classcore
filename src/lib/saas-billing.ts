import { getScopedKey } from './utils';

export const SAAS_PRICE_GEL = 49;
export const TRIAL_DAYS = 30;
export const GRACE_DAYS = 2;

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
        const billingKey = getScopedKey('cc_saas_billing', slug);
        const raw = localStorage.getItem(billingKey);
        const data = raw ? JSON.parse(raw) : {};

        const metaKey = getScopedKey('cc_sa_meta', slug);
        const metaRaw = localStorage.getItem(metaKey);
        const meta = metaRaw ? JSON.parse(metaRaw) : {};
        const plan = meta.plan || data.plan || 'trial';
        const manualBlock = meta.manualBlock === true || meta.suspended === true;

        const trialStart = data.trialStartDate ? new Date(data.trialStartDate) : new Date();
        if (!data.trialStartDate) {
            // First time — set trial start
            saveBillingData(slug, { trialStartDate: trialStart.toISOString() });
        }

        const now = new Date();
        const trialEnd = new Date(trialStart);
        trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

        const lastPaid = data.lastPaidDate ? new Date(data.lastPaidDate) : null;

        // If paid, check if current month is covered
        if (lastPaid) {
            const nextDue = new Date(lastPaid);
            nextDue.setMonth(nextDue.getMonth() + 1);
            const daysOverdue = Math.floor((now.getTime() - nextDue.getTime()) / (1000 * 60 * 60 * 24));

            if (daysOverdue <= 0) {
                return { status: 'active', plan, trialStartDate: trialStart.toISOString(), lastPaidDate: lastPaid.toISOString(), daysLeftInTrial: 0, daysOverdue: 0, nextDueDate: nextDue.toISOString(), accountBalance: data.accountBalance || 0, manualBlock };
            } else if (daysOverdue <= GRACE_DAYS) {
                return { status: 'overdue', plan, trialStartDate: trialStart.toISOString(), lastPaidDate: lastPaid.toISOString(), daysLeftInTrial: 0, daysOverdue, nextDueDate: nextDue.toISOString(), accountBalance: data.accountBalance || 0, manualBlock };
            } else {
                return { status: 'suspended', plan, trialStartDate: trialStart.toISOString(), lastPaidDate: lastPaid.toISOString(), daysLeftInTrial: 0, daysOverdue, nextDueDate: nextDue.toISOString(), accountBalance: data.accountBalance || 0, manualBlock };
            }
        }

        // No payment — check trial
        const daysInTrial = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24));
        const daysLeftInTrial = Math.max(0, TRIAL_DAYS - daysInTrial);

        if (daysInTrial < TRIAL_DAYS) {
            return { status: 'trial', plan, trialStartDate: trialStart.toISOString(), lastPaidDate: null, daysLeftInTrial, daysOverdue: 0, nextDueDate: trialEnd.toISOString(), accountBalance: data.accountBalance || 0, manualBlock };
        }

        // Trial ended, no payment
        const daysOverdue = daysInTrial - TRIAL_DAYS;
        if (daysOverdue <= GRACE_DAYS) {
            return { status: 'overdue', plan, trialStartDate: trialStart.toISOString(), lastPaidDate: null, daysLeftInTrial: 0, daysOverdue, nextDueDate: trialEnd.toISOString(), accountBalance: data.accountBalance || 0, manualBlock };
        }
        return { status: 'suspended', plan, trialStartDate: trialStart.toISOString(), lastPaidDate: null, daysLeftInTrial: 0, daysOverdue, nextDueDate: trialEnd.toISOString(), accountBalance: data.accountBalance || 0, manualBlock };

    } catch {
        return { status: 'trial', plan: 'trial', trialStartDate: null, lastPaidDate: null, daysLeftInTrial: TRIAL_DAYS, daysOverdue: 0, nextDueDate: null, accountBalance: 0, manualBlock: false };
    }
}

export function saveBillingData(slug: string, patch: Record<string, unknown>) {
    if (typeof window === 'undefined') return;
    try {
        const key = getScopedKey('cc_saas_billing', slug);
        const existing = JSON.parse(localStorage.getItem(key) || '{}');
        localStorage.setItem(key, JSON.stringify({ ...existing, ...patch }));
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
        return JSON.parse(localStorage.getItem(key) || '[]'); 
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
