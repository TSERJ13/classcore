/**
 * sms-service.ts
 * Centralized service for SMS template interpolation, recipient resolution,
 * and automated SMS notifications (expirations, birthdays).
 */

import { getLocalISODate, formatCurrency, formatDate } from './utils';
import { loadSettings, isStudioOnVacation } from './settings-store';
import { getStudents } from './student-store';
import { getSubscriptions } from './subscription-store';
import { getEventTemplatesAction, checkTemplateFrequencyAction, type SmsTemplate } from '@/app/actions/sms-templates';

/**
 * Whether `template`'s recipient scope (PRD §6) includes this student.
 * 'all' always matches; 'group'/'branch' match the student's own
 * enrolled_group_ids/branch_id against the template's target; 'person'
 * matches only that exact student. A template scoped to a group/branch/
 * person the student isn't part of is a deliberate no-send, per the
 * PRD's "this filter is final — the admin's own decision" (§6).
 */
type SmsEventStudent = {
    id: string;
    phone?: string;
    full_name?: string;
    preferred_language?: 'ka' | 'ru' | 'en';
    enrolled_group_ids?: string[];
    branch_id?: string;
    sms_reminders?: boolean;
};

function templateMatchesStudent(template: SmsTemplate, student: SmsEventStudent): boolean {
    if (template.recipientScope === 'all') return true;
    if (!template.recipientTargetId) return true;
    if (template.recipientScope === 'group') return !!student.enrolled_group_ids?.includes(template.recipientTargetId);
    if (template.recipientScope === 'branch') return student.branch_id === template.recipientTargetId;
    if (template.recipientScope === 'person') return student.id === template.recipientTargetId;
    return true;
}

/**
 * Accurately calculate age from birth_date (YYYY-MM-DD).
 */
export function calculateStudentAge(birthDate?: string | null): number | null {
    if (!birthDate) return null;
    const clean = birthDate.trim().split('T')[0];
    const parts = clean.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
        const d = new Date(birthDate);
        if (isNaN(d.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - d.getFullYear();
        const m = today.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
        return age;
    }
    const [y, m, d] = parts;
    const today = new Date();
    let age = today.getFullYear() - y;
    const monthDiff = (today.getMonth() + 1) - m;
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age--;
    return age;
}

/**
 * Determine the SMS recipient name based on age:
 * - If student is under 18 AND parent_name is provided -> Parent's name
 * - If student is 18 or older, or no parent_name -> Student's name
 */
export function resolveSmsRecipientName(student: {
    birth_date?: string | null;
    parent_name?: string | null;
    contact_person?: string | null;
    full_name?: string | null;
    first_name?: string | null;
    name?: string | null;
    data?: any;
}): string {
    const rawBirthDate = student.birth_date || student.data?.birth_date;
    const age = calculateStudentAge(rawBirthDate);
    const parentName = (student.parent_name || student.data?.parent_name || student.contact_person || student.data?.contact_person || '').trim();
    const studentName = (student.full_name || student.first_name || student.data?.first_name || student.name || '').trim();

    // Under 18 with a parent name available -> use parent's name
    if (age !== null && age < 18 && parentName) {
        return parentName;
    }

    // 18 or older, or no parent name provided -> use student's name
    return studentName || parentName || 'სტუდენტი';
}

/**
 * Formats an SMS template by replacing:
 * - {name} with resolved recipient name (parent if <18, student if >=18)
 * - {plan} with subscription plan name
 * - {studio} with current studio name
 * - {amount} with the payment amount (for the payment reminder template)
 */
export function formatSmsTemplate(
    template: string,
    options: {
        student: any;
        planName?: string | null;
        studioName?: string | null;
        amount?: number | string | null;
        currency?: string | null;
    }
): string {
    if (!template) return '';
    const { student, planName, studioName, amount, currency } = options;

    const resolvedName = resolveSmsRecipientName(student);
    const resolvedStudio = studioName || 'Studio';
    const resolvedPlan = (planName || '').trim();
    const resolvedAmount = (() => {
        if (amount === null || amount === undefined || amount === '') return '';
        if (typeof amount === 'number') return formatCurrency(amount, currency || 'GEL');
        return String(amount);
    })();

    let out = template
        .replace(/{name}/g, resolvedName)
        .replace(/{studio}/g, resolvedStudio);

    if (resolvedPlan) {
        out = out.replace(/{plan}/g, resolvedPlan);
    } else {
        out = out
            .replace(/{plan}-ის/g, 'აბონემენტის')
            .replace(/\({plan}\)/g, '')
            .replace(/{plan}/g, '')
            .replace(/\s+/g, ' ');
    }

    if (resolvedAmount) {
        out = out.replace(/{amount}/g, resolvedAmount);
    } else {
        // No amount available (e.g. previewing a template outside a payment
        // context) — drop the placeholder rather than sending a literal
        // "{amount}" to the recipient.
        out = out
            .replace(/\({amount}\)/g, '')
            .replace(/{amount}/g, '')
            .replace(/\s+/g, ' ');
    }

    return out.trim();
}

/**
 * Send an SMS via API
 */
export async function sendSms(params: {
    to: string;
    text: string;
    studentName?: string;
    /** Set when this send came from a src/app/actions/sms-templates.ts template (Phase 3) — lets
     * /api/sms/send group the sms_logs row by template for the frequency-limit check and future
     * per-template log drill-down (PRD §9). Omit for the still-unmigrated Personal/Holiday sends. */
    templateId?: string;
    recipientStudentId?: string;
}): Promise<{ success: boolean; error?: string }> {
    let phone = (params.to || '').replace(/[^0-9]/g, '');
    if (phone.length === 9) phone = '995' + phone;
    if (!phone) return { success: false, error: 'Invalid phone number' };

    try {
        const res = await fetch('/api/sms/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: phone,
                text: params.text,
                studentName: params.studentName,
                templateId: params.templateId,
                recipientStudentId: params.recipientStudentId,
            })
        });
        const data = await res.json();
        return {
            success: Boolean(data.success || (Array.isArray(data) && data[0]?.success)),
            error: data.error
        };
    } catch (err: any) {
        return { success: false, error: err?.message || 'Network error' };
    }
}

/**
 * Notifies a teacher by SMS that a student/admin booked an individual lesson
 * against their credit and it's waiting for confirmation (createIndividualBooking()'s
 * 'pending' branch — PRD Subscriptions §7B). Suppressed during studio vacation
 * mode, same as the other subscription-related automated SMS.
 */
export async function sendIndividualBookingConfirmationSms(params: {
    teacherPhone: string;
    teacherName: string;
    studentName: string;
    date: string;
    time: string;
}): Promise<{ success: boolean; error?: string }> {
    if (typeof window === 'undefined') return { success: false, error: 'No window' };
    const settings = loadSettings();
    if (isStudioOnVacation(settings)) return { success: false, error: 'Studio on vacation' };
    if (!params.teacherPhone) return { success: false, error: 'No teacher phone' };

    const lang = (settings.language || 'ka') as 'ka' | 'ru' | 'en';
    const templates = settings.sms_templates || {};
    const tpl = (templates as any)?.[lang]?.individual_booking_pending
        || (templates as any)?.ka?.individual_booking_pending
        || 'Hello {teacher}, {student} booked an individual lesson for {date} at {time}. Please confirm it in the {studio} app.';

    const text = tpl
        .replace(/{teacher}/g, params.teacherName)
        .replace(/{student}/g, params.studentName)
        .replace(/{date}/g, formatDate(params.date))
        .replace(/{time}/g, params.time)
        .replace(/{studio}/g, settings.studioName || 'Studio');

    return sendSms({ to: params.teacherPhone, text, studentName: params.teacherName });
}

/**
 * Sends the given event's active, matching, frequency-eligible template(s)
 * (Phase 3's category/template model) to one student, falling back to the
 * old hardcoded/settings-blob text when the org has zero matching
 * templates — e.g. it never opened /sms-manager, so Phase 1's lazy seed
 * never ran, or every existing template for this event has been deleted.
 * This keeps behavior identical to before Phase 3 for any org that
 * hasn't touched the new system.
 */
async function sendForEvent(params: {
    eventKey: string;
    student: SmsEventStudent;
    studioName: string;
    planName?: string;
    fallbackTemplate: string;
}): Promise<void> {
    const phone = (params.student.phone || '').replace(/[^0-9]/g, '');
    if (!phone) return;
    // Respects the student portal's own "SMS reminders" opt-out toggle
    // (students/[studentId]/page.tsx) — previously stored but never read
    // by this automated sweep.
    if (params.student.sms_reminders === false) return;

    const result = await getEventTemplatesAction({ eventKey: params.eventKey });
    const matching = (result.data || []).filter(t => templateMatchesStudent(t, params.student));

    if (matching.length === 0) {
        const text = formatSmsTemplate(params.fallbackTemplate, { student: params.student, planName: params.planName, studioName: params.studioName });
        await sendSms({ to: phone, text, studentName: params.student.full_name });
        return;
    }

    const prefLang = (params.student.preferred_language || 'ka') as 'ka' | 'ru' | 'en';
    for (const tpl of matching) {
        if (tpl.frequencyLimitCount && tpl.frequencyLimitDays) {
            const elig = await checkTemplateFrequencyAction({
                templateId: tpl.id, recipientStudentId: params.student.id,
                limitCount: tpl.frequencyLimitCount, limitDays: tpl.frequencyLimitDays,
            });
            if (elig.error || !elig.data) continue;
        }
        const raw = (prefLang === 'ru' ? tpl.textRu : prefLang === 'en' ? tpl.textEn : tpl.textKa) || tpl.textKa || tpl.textRu || tpl.textEn;
        if (!raw) continue;
        const text = formatSmsTemplate(raw, { student: params.student, planName: params.planName, studioName: params.studioName });
        await sendSms({ to: phone, text, studentName: params.student.full_name, templateId: tpl.id, recipientStudentId: params.student.id });
    }
}

/**
 * Runs automated SMS checks:
 * 1. Subscriptions expiring today (expiration_day_0)
 * 2. Students having birthdays today (birthday)
 * Respects quiet hours (23:00 - 10:00) and settings.notifications.autoSms.
 */
export async function runAutomatedSmsCheck(options?: { force?: boolean }): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
        const settings = loadSettings();
        const autoSms = settings?.notifications?.autoSms !== false;
        if (!autoSms && !options?.force) return;

        // Quiet hours: 23:00 - 10:00
        const currentHour = new Date().getHours();
        const isQuietHours = currentHour >= 23 || currentHour < 10;
        if (isQuietHours && !options?.force) return;

        const todayStr = getLocalISODate(); // YYYY-MM-DD
        const [todayYear, todayMonth, todayDay] = todayStr.split('-');
        const todayMonthDay = `${todayMonth}-${todayDay}`;

        const studioName = settings.studioName || 'Studio';
        const templates = settings.sms_templates || {};
        const students = getStudents();
        const subsMap = getSubscriptions();

        // ── 1. Check Subscriptions Expiring Today (expiration_day_0) ──
        // Suppressed during studio vacation mode (PRD §13) — subscription
        // notifications shouldn't go out while the studio itself is closed.
        // Birthday messages (below) are unrelated to subscriptions and still send.
        if (!isStudioOnVacation(settings)) for (const student of students) {
            const phone = (student.phone || '').replace(/[^0-9]/g, '');
            if (!phone) continue;

            const studentSubs = subsMap[student.id] || [];
            const expiringSub = studentSubs.find(s => 
                s.status === 'active' && 
                s.expires_at === todayStr
            );

            if (expiringSub) {
                const smsKey = `sms_sent_exp_${expiringSub.id}_${todayStr}`;
                if (!localStorage.getItem(smsKey)) {
                    localStorage.setItem(smsKey, 'pending');

                    const fallbackTpl = (templates as any)?.[(student.preferred_language || 'ka')]?.expiration_day_0 ||
                        (templates as any)?.ka?.expiration_day_0 ||
                        'გამარჯობა {name}, გენატრებათ ვარჯიში? თქვენი აბონემენტი ({plan}) იწურება დღეს. გთხოვთ განაახლოთ.';
                    const planName = expiringSub.plan || (expiringSub as any).plan_name || '';

                    sendForEvent({ eventKey: 'subscription_expiring', student, studioName, planName, fallbackTemplate: fallbackTpl })
                        .then(() => localStorage.setItem(smsKey, 'true'))
                        .catch(() => localStorage.setItem(smsKey, 'failed'));
                }
            }
        }

        // ── 2. Check Birthdays Today (birthday) ──
        for (const student of students) {
            const phone = (student.phone || '').replace(/[^0-9]/g, '');
            if (!phone || !student.birth_date) continue;

            const cleanBday = student.birth_date.split('T')[0];
            const parts = cleanBday.split('-');
            if (parts.length === 3) {
                const bdayMonthDay = `${parts[1]}-${parts[2]}`;
                if (bdayMonthDay === todayMonthDay) {
                    const smsKey = `sms_sent_bday_${student.id}_${todayYear}`;
                    if (!localStorage.getItem(smsKey)) {
                        localStorage.setItem(smsKey, 'pending');

                        const fallbackTpl = (templates as any)?.[(student.preferred_language || 'ka')]?.birthday ||
                            (templates as any)?.ka?.birthday ||
                            'გამარჯობა {name}, გილოცავთ დაბადების დღეს! საუკეთესო სურვილებით, {studio}.';

                        sendForEvent({ eventKey: 'birthday', student, studioName, fallbackTemplate: fallbackTpl })
                            .then(() => localStorage.setItem(smsKey, 'true'))
                            .catch(() => localStorage.setItem(smsKey, 'failed'));
                    }
                }
            }
        }
    } catch (e) {
        console.error('runAutomatedSmsCheck error:', e);
    }
}
