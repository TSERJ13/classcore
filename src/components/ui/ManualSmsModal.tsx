'use client';

import { useState, useMemo, useEffect } from 'react';
import { X, Send, MessageSquare, AlertCircle, CreditCard, Clock, Sparkles, Cake, Globe } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useStudio } from '@/contexts/StudioContext';
import { cn } from '@/lib/utils';
import MainPortal from '@/components/ui/MainPortal';
import { resolveSmsRecipientName, calculateStudentAge, formatSmsTemplate, sendSms } from '@/lib/sms-service';
import { getSubscription } from '@/lib/subscription-store';
import { getStudents } from '@/lib/student-store';
import { getGroups } from '@/lib/group-store';
import { DEFAULT_SETTINGS } from '@/lib/settings-store';

interface ManualSmsModalProps {
    open: boolean;
    onClose: () => void;
    student?: any;
    studentName?: string;
    studentPhone?: string;
}

export function ManualSmsModal({ open, onClose, student, studentName, studentPhone }: ManualSmsModalProps) {
    const { t, lang: uiLang } = useT();
    const { settings } = useStudio();
    const l = (ka: string, ru: string, en: string) => uiLang === 'ka' ? ka : uiLang === 'ru' ? ru : en;

    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [statusMsg, setStatusMsg] = useState('');

    // 1. Resolve full student entity from store if partial or missing
    const effectiveStudent = useMemo(() => {
        const base = student || {};
        let found: any = null;
        try {
            const all = getStudents();
            found = all.find(s => 
                (base.id && s.id === base.id) ||
                (base.phone && s.phone && s.phone.replace(/[^0-9]/g, '') === base.phone.replace(/[^0-9]/g, '')) ||
                (studentPhone && s.phone && s.phone.replace(/[^0-9]/g, '') === studentPhone.replace(/[^0-9]/g, '')) ||
                (studentName && s.full_name?.trim().toLowerCase() === studentName.trim().toLowerCase())
            );
        } catch {}

        const merged = {
            ...(found || {}),
            ...base,
            birth_date: base.birth_date || base.data?.birth_date || found?.birth_date || found?.data?.birth_date,
            parent_name: base.parent_name || base.data?.parent_name || found?.parent_name || found?.data?.parent_name,
            preferred_language: base.preferred_language || base.data?.preferred_language || found?.preferred_language || found?.data?.preferred_language,
            contact_person: base.contact_person || base.data?.contact_person || found?.contact_person || found?.data?.contact_person,
            full_name: base.full_name || found?.full_name || studentName || '',
            phone: base.phone || found?.phone || studentPhone || '',
            id: base.id || found?.id,
            enrolled_group_ids: base.enrolled_group_ids || found?.enrolled_group_ids || []
        };
        return merged;
    }, [student, studentName, studentPhone]);

    // 2. Resolve Student's Preferred Language (defaults to student's language, e.g. 'ru' for Lilia)
    const studentPrefLang = useMemo(() => {
        const pref = effectiveStudent?.preferred_language;
        if (pref === 'ru' || pref === 'en' || pref === 'ka') return pref;
        return (settings?.language || 'ka') as 'ka' | 'ru' | 'en';
    }, [effectiveStudent?.preferred_language, settings?.language]);

    const [templateLang, setTemplateLang] = useState<'ka' | 'ru' | 'en'>(studentPrefLang);

    // Auto-select student's preferred language when opening
    useEffect(() => {
        if (open) {
            setTemplateLang(studentPrefLang);
        }
    }, [open, studentPrefLang]);

    const recipientName = useMemo(() => resolveSmsRecipientName(effectiveStudent), [effectiveStudent]);
    const age = useMemo(() => calculateStudentAge(effectiveStudent.birth_date), [effectiveStudent.birth_date]);
    const isMinorWithParent = age !== null && age < 18 && Boolean(effectiveStudent.parent_name || effectiveStudent.contact_person);
    const phone = effectiveStudent.phone || studentPhone || '';

    // 3. Subscription or group plan name
    const activeSub = useMemo(() => {
        if (!effectiveStudent?.id) return null;
        return getSubscription(effectiveStudent.id);
    }, [effectiveStudent?.id]);

    const planName = useMemo(() => {
        if (activeSub?.plan) return activeSub.plan;
        if ((activeSub as any)?.plan_name) return (activeSub as any).plan_name;
        // Fallback to group name if student has enrolled groups
        if (effectiveStudent?.enrolled_group_ids?.length) {
            try {
                const groups = getGroups();
                const g = groups.find(grp => effectiveStudent.enrolled_group_ids.includes(grp.id));
                if (g) return g.name;
            } catch {}
        }
        return '';
    }, [activeSub, effectiveStudent]);

    const studioName = settings?.studioName || 'Studio';

    // Payment amount for the {amount} placeholder in the "payment" template —
    // prefer what the student actually paid/owes on their active subscription,
    // falling back to the plan's list price when that isn't set.
    const paymentAmount = useMemo(() => {
        const paid = (activeSub as any)?.amount_paid;
        if (typeof paid === 'number' && paid > 0) return paid;
        const planPrice = (activeSub as any)?.plan?.price ?? (activeSub as any)?.price;
        return typeof planPrice === 'number' ? planPrice : null;
    }, [activeSub]);

    // 4. Available Templates in Selected/Student Language
    const templates = useMemo(() => {
        const customTpls = (settings?.sms_templates as any)?.[templateLang] || {};
        const defTpls = (DEFAULT_SETTINGS.sms_templates as any)[templateLang] || DEFAULT_SETTINGS.sms_templates.ka;

        const defaultPayment = templateLang === 'ru'
            ? 'Здравствуйте {name}, напоминаем об оплате абонемента {plan}. Пожалуйста, внесите оплату. С уважением, {studio}.'
            : templateLang === 'en'
            ? 'Hello {name}, this is a reminder regarding the payment for your {plan} plan. Best regards, {studio}.'
            : 'გამარჯობა {name}, შეგახსენებთ, რომ გაქვთ გადასახდელი {plan}-ის საფასური. გთხოვთ დაფაროთ. პატივისცემით, {studio}.';

        const defaultExpiration = templateLang === 'ru'
            ? 'Здравствуйте {name}, соскучились по тренировкам? Ваш абонемент ({plan}) истекает сегодня. Пожалуйста, обновите его.'
            : templateLang === 'en'
            ? 'Hello {name}, miss training? Your plan ({plan}) expires today. Please renew it.'
            : 'გამარჯობა {name}, გენატრებათ ვარჯიში? თქვენი აბონემენტი ({plan}) იწურება დღეს. გთხოვთ განაახლოთ.';

        const defaultLowVisits = templateLang === 'ru'
            ? 'Здравствуйте {name}, у вас закончились визиты в студии: {studio}. Пожалуйста, обновите абонемент.'
            : templateLang === 'en'
            ? 'Hello {name}, you have run out of visits at {studio}. Please renew your subscription.'
            : 'გამარჯობა {name}, თქვენ დაგიმთავრდათ ვიზიტები სტუდიაში: {studio}. გთხოვთ განაახლოთ აბონემენტი.';

        const defaultBirthday = templateLang === 'ru'
            ? 'Здравствуйте {name}, с днем рождения! С наилучшими пожеланиями, {studio}.'
            : templateLang === 'en'
            ? 'Happy Birthday {name}! Best wishes, {studio}.'
            : 'გამარჯობა {name}, გილოცავთ დაბადების დღეს! საუკეთესო სურვილებით, {studio}.';

        return {
            payment: customTpls.payment || defTpls.payment || defaultPayment,
            expiration: customTpls.expiration_day_0 || defTpls.expiration_day_0 || defaultExpiration,
            low_visits: customTpls.low_visits || defTpls.low_visits || defaultLowVisits,
            birthday: customTpls.birthday || defTpls.birthday || defaultBirthday,
        };
    }, [settings?.sms_templates, templateLang]);

    if (!open) return null;

    const applyTemplate = (tplKey: keyof typeof templates) => {
        const rawTpl = templates[tplKey];
        const formatted = formatSmsTemplate(rawTpl, {
            student: effectiveStudent,
            planName,
            studioName,
            // Only the payment template uses {amount}, but passing it
            // unconditionally is harmless — formatSmsTemplate strips the
            // placeholder from any template that doesn't resolve it.
            amount: tplKey === 'payment' ? paymentAmount : null,
            currency: settings?.currency
        });
        setMessage(formatted);
    };

    const handleSend = async () => {
        if (!message.trim()) return;
        setIsSending(true);
        setStatus('idle');
        setStatusMsg('');

        try {
            const res = await sendSms({
                to: phone,
                text: message.trim(),
                studentName: recipientName
            });

            if (res.success) {
                setStatus('success');
                setTimeout(() => {
                    onClose();
                    setMessage('');
                    setStatus('idle');
                }, 2000);
            } else {
                throw new Error(res.error || 'Failed to send SMS');
            }
        } catch (error: any) {
            console.error(error);
            setStatus('error');
            setStatusMsg(error?.message || t.smsError);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <MainPortal>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
                onClick={onClose} 
            />

            {/* Modal Drawer */}
            <div className={cn(
                "fixed z-[10000] flex flex-col bg-card transition-all duration-300 overflow-hidden shadow-2xl border-l border-border-subtle",
                "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[2rem]",
                "sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[520px] sm:max-h-none sm:h-[100dvh] sm:rounded-none",
                "animate-in slide-in-from-bottom-6 sm:slide-in-from-right duration-300",
                "overflow-x-hidden"
            )}>
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-border-subtle bg-card/95 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 flex-shrink-0">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-black text-primary tracking-tight truncate">{t.sendSms}</h2>
                            <p className="text-[11px] font-bold text-muted truncate">
                                {l('ადრესატი', 'Получатель', 'Recipient')}: <span className="text-primary font-black">{recipientName}</span>
                                {isMinorWithParent && (
                                    <span className="text-[10px] text-muted/80 ml-1 font-medium">({effectiveStudent.full_name}-ის მშობელი{age !== null ? `, ${age} წ.` : ''})</span>
                                )}
                                <span className="text-muted/70 ml-1">· {phone}</span>
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-xl hover:bg-surface text-muted hover:text-primary transition-colors flex-shrink-0 cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain no-scrollbar">
                    {/* Quick Template Chips Header + Language Toggle */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-black text-muted tracking-widest uppercase flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-sky-500" />
                                {l('სწრაფი შაბლონები', 'Быстрые шаблоны', 'Quick Templates')}
                            </label>

                            {/* Language Switcher Badge */}
                            <div className="flex items-center gap-1 bg-surface border border-border-subtle rounded-lg p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setTemplateLang('ka')}
                                    className={cn(
                                        "px-2 py-0.5 text-[9px] font-black rounded transition-all cursor-pointer",
                                        templateLang === 'ka' ? "bg-sky-500 text-white shadow-sm" : "text-muted hover:text-primary"
                                    )}
                                >
                                    GE
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTemplateLang('ru')}
                                    className={cn(
                                        "px-2 py-0.5 text-[9px] font-black rounded transition-all cursor-pointer",
                                        templateLang === 'ru' ? "bg-sky-500 text-white shadow-sm" : "text-muted hover:text-primary"
                                    )}
                                >
                                    RU
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTemplateLang('en')}
                                    className={cn(
                                        "px-2 py-0.5 text-[9px] font-black rounded transition-all cursor-pointer",
                                        templateLang === 'en' ? "bg-sky-500 text-white shadow-sm" : "text-muted hover:text-primary"
                                    )}
                                >
                                    EN
                                </button>
                            </div>
                        </div>

                        {/* Template Buttons */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => applyTemplate('payment')}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>{templateLang === 'ru' ? 'Оплата' : templateLang === 'en' ? 'Payment' : 'გადახდა'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => applyTemplate('expiration')}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            >
                                <Clock className="w-3.5 h-3.5" />
                                <span>{templateLang === 'ru' ? 'Истечение' : templateLang === 'en' ? 'Expiration' : 'ვადის გასვლა'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => applyTemplate('low_visits')}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            >
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{templateLang === 'ru' ? 'Визиты' : templateLang === 'en' ? 'Visits' : 'ვიზიტები'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => applyTemplate('birthday')}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 border border-purple-500/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            >
                                <Cake className="w-3.5 h-3.5" />
                                <span>{templateLang === 'ru' ? 'День рождения' : templateLang === 'en' ? 'Birthday' : 'დაბადების დღე'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Textarea */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted tracking-widest px-1 uppercase">{t.messageText}</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={t.messagePlaceholder}
                            className="w-full h-36 bg-surface/50 border border-border-subtle rounded-2xl p-4 text-xs sm:text-sm font-bold text-primary placeholder:text-muted/40 outline-none focus:border-sky-500/50 focus:bg-surface transition-all resize-none shadow-sm"
                        />
                        <div className="flex justify-between items-center px-1">
                            <p className="text-[10px] font-bold text-muted">
                                {message.length} {t.characters}
                            </p>
                            {message.length > 160 && (
                                <p className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {t.smsMultiPart}
                                </p>
                            )}
                        </div>
                    </div>

                    {status === 'success' && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-xs font-bold text-center animate-in fade-in">
                            ✓ {t.smsSuccess}
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{statusMsg || t.smsError}</span>
                        </div>
                    )}
                </div>

                {/* Footer - Safe from mobile overlays */}
                <div 
                    className="p-4 sm:p-6 border-t border-border-subtle bg-card/95 backdrop-blur-md sticky bottom-0 z-20 flex gap-3"
                    style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 16px))' }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3.5 bg-surface border border-border-subtle hover:border-border text-muted hover:text-primary text-xs font-bold rounded-2xl transition-all active:scale-95 cursor-pointer"
                    >
                        {t.cancel}
                    </button>
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={!message.trim() || isSending}
                        className="flex-1 py-3.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:hover:bg-sky-500 text-white text-xs font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-sky-500/20 active:scale-95 cursor-pointer"
                    >
                        {isSending ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <><Send className="w-4 h-4" /> {t.send}</>
                        )}
                    </button>
                </div>
            </div>
        </MainPortal>
    );
}
