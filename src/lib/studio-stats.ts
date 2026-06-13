/**
 * studio-stats.ts
 * ---------------------------------------------------------------------------
 * SINGLE SOURCE OF TRUTH for money + a REAL (correct, guarded) insights engine.
 *
 * Why this exists:
 *  - Revenue was computed inline in ~9 places as
 *      `sub.amount_paid || planPrices[sub.plan] || 0`
 *    and planPrices was keyed ONLY by plan *name*. If a subscription stored its
 *    plan as an *id* (or the name drifted), the lookup silently returned 0 — so
 *    the same data produced different totals in different cards.
 *  - The "AI Assistant" produced confetti ("Great result! 💰") and the insight
 *    modal divided by zero (NaN / Infinity / misleading 0%). This replaces that
 *    with correct, actionable insights derived from real signals.
 * ---------------------------------------------------------------------------
 */

export type Localize = (ka: string, ru: string, en: string) => string;

/** Build a price lookup keyed by BOTH plan name and plan id, so either reference resolves. */
export function buildPlanPrices(plans: any[]): Record<string, number> {
    const map: Record<string, number> = {};
    (plans || []).forEach(p => {
        if (!p) return;
        const price = Number(p.price) || 0;
        if (p.name != null) map[String(p.name)] = price;
        if (p.id != null) map[String(p.id)] = price;
    });
    return map;
}

/**
 * Canonical revenue for a single subscription.
 * Preserves the previous semantics (a positive amount_paid wins) but no longer
 * silently returns 0 when the plan is referenced by id instead of name.
 */
export function subRevenue(sub: any, planPrices: Record<string, number>): number {
    if (!sub) return 0;
    const paid = Number(sub.amount_paid);
    if (Number.isFinite(paid) && paid > 0) return paid;
    const byPlan = sub.plan != null ? planPrices[String(sub.plan)] : undefined;
    if (Number.isFinite(byPlan)) return byPlan as number;
    const byId = sub.plan_id != null ? planPrices[String(sub.plan_id)] : undefined;
    return Number.isFinite(byId) ? (byId as number) : 0;
}

/** Sum revenue across a list of subscriptions using the canonical per-sub rule. */
export function sumSubRevenue(subs: any[], planPrices: Record<string, number>): number {
    return (subs || []).reduce((sum, s) => sum + subRevenue(s, planPrices), 0);
}

/** Safe percentage change. Returns null when there is no meaningful baseline. */
export function pctChange(current: number, previous: number): number | null {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
    if (previous <= 0) return null; // avoid Infinity / NaN / misleading 0%
    return Math.round((current / previous - 1) * 100);
}

export interface InsightInputs {
    currentRevenue: number;
    prevRevenue: number;
    attendanceRate: number;        // 0..100
    prevAttendanceRate: number;    // 0..100
    activeSubs: number;
    totalStudents: number;
    /** Students who haven't attended recently: [{ name, daysSinceLast }] sorted desc. */
    churnRiskStudents: { name: string; daysSinceLast: number }[];
    /** Group occupancy: [{ name, rate, enrolled, capacity }] sorted by rate desc. */
    occupancyStats: { name: string; rate: number; enrolled: number; capacity: number }[];
    /** Count of subscriptions expiring / overdue for renewal. */
    expiringSoon: number;
    formatCurrency: (n: number) => string;
}

/**
 * REAL insights — correct math, no NaN/Infinity, only emitted when the
 * underlying signal actually exists. Returns an ordered list of short,
 * actionable strings (most important first).
 */
export function generateInsights(input: InsightInputs, l: Localize): string[] {
    const out: string[] = [];
    const {
        currentRevenue, prevRevenue, attendanceRate, prevAttendanceRate,
        activeSubs, totalStudents, churnRiskStudents, occupancyStats,
        expiringSoon, formatCurrency,
    } = input;

    // 1) Revenue trend (guarded)
    const rev = pctChange(currentRevenue, prevRevenue);
    if (rev != null && rev > 0) {
        out.push(l(
            `შემოსავალი ${rev}%-ით გაიზარდა წინა თვესთან შედარებით (${formatCurrency(currentRevenue)}).`,
            `Доход вырос на ${rev}% к прошлому месяцу (${formatCurrency(currentRevenue)}).`,
            `Revenue is up ${rev}% vs last month (${formatCurrency(currentRevenue)}).`,
        ));
    } else if (rev != null && rev < 0) {
        out.push(l(
            `შემოსავალი ${Math.abs(rev)}%-ით შემცირდა. გადახედე გასულ აბონემენტებსა და ახალ ჩაწერებს.`,
            `Доход снизился на ${Math.abs(rev)}%. Проверьте истёкшие абонементы и новые записи.`,
            `Revenue is down ${Math.abs(rev)}%. Review expired subscriptions and new sign-ups.`,
        ));
    } else if (prevRevenue <= 0 && currentRevenue > 0) {
        out.push(l(
            `პირველი შემოსავალი ამ პერიოდში: ${formatCurrency(currentRevenue)}.`,
            `Первый доход за период: ${formatCurrency(currentRevenue)}.`,
            `First revenue this period: ${formatCurrency(currentRevenue)}.`,
        ));
    }

    // 2) At-risk students (real retention signal)
    const atRisk = (churnRiskStudents || []).filter(s => s.daysSinceLast >= 14);
    if (atRisk.length > 0) {
        const top = atRisk[0];
        out.push(l(
            `${atRisk.length} სტუდენტი 2+ კვირაა არ მოსულა (მაგ. ${top.name}, ${top.daysSinceLast} დღე). დაურეკე/მისწერე.`,
            `${atRisk.length} студентов не были 2+ недели (напр. ${top.name}, ${top.daysSinceLast} дн.). Свяжитесь с ними.`,
            `${atRisk.length} students haven't come in 2+ weeks (e.g. ${top.name}, ${top.daysSinceLast}d). Reach out.`,
        ));
    }

    // 3) Renewals due
    if (expiringSoon > 0) {
        out.push(l(
            `${expiringSoon} აბონემენტი იწურება/ვადაგადაცილებულია — შეახსენე გასაგრძელებლად.`,
            `${expiringSoon} абонементов истекают/просрочены — напомните о продлении.`,
            `${expiringSoon} subscriptions are expiring or overdue — send renewal reminders.`,
        ));
    }

    // 4) Group occupancy — surface the most useful direction
    const groups = (occupancyStats || []).filter(g => g.capacity > 0);
    const full = groups.filter(g => g.rate >= 90).sort((a, b) => b.rate - a.rate)[0];
    const empty = groups.filter(g => g.rate < 50).sort((a, b) => a.rate - b.rate)[0];
    if (full) {
        out.push(l(
            `ჯგუფი "${full.name}" თითქმის სავსეა (${full.rate}%). დაამატე სესია ან ახალი ჯგუფი.`,
            `Группа "${full.name}" почти заполнена (${full.rate}%). Добавьте сессию или новую группу.`,
            `"${full.name}" is nearly full (${full.rate}%). Add a session or a new group.`,
        ));
    } else if (empty) {
        const free = Math.max(0, empty.capacity - empty.enrolled);
        out.push(l(
            `ჯგუფ "${empty.name}"-ში ${free} ადგილია თავისუფალი (${empty.rate}%). სცადე ღია გაკვეთილი მოსაზიდად.`,
            `В группе "${empty.name}" ${free} свободных мест (${empty.rate}%). Попробуйте открытый урок.`,
            `"${empty.name}" has ${free} open spots (${empty.rate}%). Try an open class to fill it.`,
        ));
    }

    // 5) Attendance trend (guarded)
    const att = pctChange(attendanceRate, prevAttendanceRate);
    if (att != null && att <= -10) {
        out.push(l(
            `დასწრება ${Math.abs(att)}%-ით დაეცა. შეამოწმე ცხრილი და მასწავლებლების დატვირთვა.`,
            `Посещаемость упала на ${Math.abs(att)}%. Проверьте расписание и нагрузку преподавателей.`,
            `Attendance dropped ${Math.abs(att)}%. Check the schedule and teacher load.`,
        ));
    }

    // 6) Inactive base (only if notable)
    const inactive = Math.max(0, totalStudents - activeSubs);
    if (totalStudents > 0 && inactive / totalStudents >= 0.3) {
        out.push(l(
            `${inactive} სტუდენტს აქტიური აბონემენტი არ აქვს. გასაგრძელებლად მიმართე მათ.`,
            `${inactive} студентов без активного абонемента. Предложите им продление.`,
            `${inactive} students have no active subscription. Invite them to renew.`,
        ));
    }

    // Fallback — never show a fake/celebratory message; be honest instead.
    if (out.length === 0) {
        out.push(l(
            'მაჩვენებლები სტაბილურია. ახალი მონაცემები გამოჩნდება დასწრებისა და გადახდების დაგროვებასთან ერთად.',
            'Показатели стабильны. Новые инсайты появятся по мере накопления данных.',
            'Metrics are steady. More insights will appear as attendance and payments accumulate.',
        ));
    }

    return out;
}
