/**
 * sms-service.ts
 * Centralized service for SMS template interpolation, recipient resolution,
 * and automated SMS notifications (expirations, birthdays).
 */

import { getLocalISODate, formatCurrency } from './utils';
import { loadSettings } from './settings-store';
import { getStudents } from './student-store';
import { getSubscriptions } from './subscription-store';

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
                studentName: params.studentName
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
        for (const student of students) {
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

                    const prefLang = (student.preferred_language || 'ka') as 'ka' | 'ru' | 'en';
                    const tpl = (templates as any)?.[prefLang]?.expiration_day_0 || 
                                (templates as any)?.ka?.expiration_day_0 ||
                                'გამარჯობა {name}, გენატრებათ ვარჯიში? თქვენი აბონემენტი ({plan}) იწურება დღეს. გთხოვთ განაახლოთ.';

                    const planName = expiringSub.plan || (expiringSub as any).plan_name || '';
                    const text = formatSmsTemplate(tpl, { student, planName, studioName });

                    sendSms({ to: phone, text, studentName: student.full_name }).then(res => {
                        if (res.success) {
                            localStorage.setItem(smsKey, 'true');
                        } else {
                            localStorage.setItem(smsKey, 'failed');
                        }
                    }).catch(() => localStorage.setItem(smsKey, 'failed'));
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

                        const prefLang = (student.preferred_language || 'ka') as 'ka' | 'ru' | 'en';
                        const tpl = (templates as any)?.[prefLang]?.birthday || 
                                    (templates as any)?.ka?.birthday ||
                                    'გამარჯობა {name}, გილოცავთ დაბადების დღეს! საუკეთესო სურვილებით, {studio}.';

                        const text = formatSmsTemplate(tpl, { student, studioName });

                        sendSms({ to: phone, text, studentName: student.full_name }).then(res => {
                            if (res.success) {
                                localStorage.setItem(smsKey, 'true');
                            } else {
                                localStorage.setItem(smsKey, 'failed');
                            }
                        }).catch(() => localStorage.setItem(smsKey, 'failed'));
                    }
                }
            }
        }
    } catch (e) {
        console.error('runAutomatedSmsCheck error:', e);
    }
}
