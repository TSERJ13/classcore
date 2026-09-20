'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Send, Loader2, Users, PartyPopper } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { addNotification } from '@/lib/notification-store';
import { listSmsCategoriesAction, listSmsTemplatesAction, checkTemplateFrequencyAction, type SmsTemplate } from '@/app/actions/sms-templates';
import { templateMatchesStudent, formatSmsTemplate, sendSms } from '@/lib/sms-service';

interface BroadcastStudent {
    id: string;
    phone?: string;
    full_name?: string;
    name?: string;
    preferred_language?: 'ka' | 'ru' | 'en';
    enrolled_group_ids?: string[];
    branch_id?: string;
    sms_reminders?: boolean;
}

interface BroadcastTabProps {
    students: BroadcastStudent[];
    studioName: string;
}

/**
 * Replaces the old Holiday tab's hardcoded 4-holiday `HOLIDAYS` array
 * (SMS PRD alignment, Phase 7). Any active, manual-trigger template in an
 * enabled category can be broadcast from here now — holidays are just
 * the 4 the lazy seed (sms-templates.ts) happens to start every org with;
 * an admin can add, edit, or delete any of them, or create a wholly new
 * one (e.g. a general announcement — PRD §6's own "all" scope example),
 * without needing a code change. Recipient resolution reuses
 * `templateMatchesStudent()` (the same PRD §6 scope filter the automated
 * signals use in sms-service.ts) rather than always meaning "everyone" —
 * a template scoped to a specific group/branch/person only reaches that
 * target here too.
 */
export function BroadcastTab({ students, studioName }: BroadcastTabProps) {
    const { lang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const { confirm } = useConfirm();

    const [templates, setTemplates] = useState<SmsTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingId, setSendingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [catsResult, tplResult] = await Promise.all([listSmsCategoriesAction(), listSmsTemplatesAction()]);
            const enabledIds = new Set((catsResult.data || []).filter(c => c.enabled).map(c => c.id));
            const eligible = (tplResult.data || []).filter(t => t.triggerType === 'manual' && t.status === 'active' && enabledIds.has(t.categoryId));
            setTemplates(eligible);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    function recipientsFor(template: SmsTemplate): BroadcastStudent[] {
        return students.filter(s => s.phone && s.sms_reminders !== false && templateMatchesStudent(template, s));
    }

    async function handleSend(template: SmsTemplate) {
        const recipients = recipientsFor(template);
        if (recipients.length === 0) {
            addNotification(l('ამ შაბლონისთვის მიმღები ვერ მოიძებნა', 'Получатели для этого шаблона не найдены', 'No recipients match this template'), 'bg-amber-500');
            return;
        }
        const proceed = await confirm({
            title: l('შეტყობინების გაგზავნა', 'Отправка сообщения', 'Send Message'),
            message: l(
                `"${template.name}" გაეგზავნება ${recipients.length} მიმღებს. დარწმუნებული ხართ?`,
                `"${template.name}" будет отправлено ${recipients.length} получателям. Вы уверены?`,
                `"${template.name}" will be sent to ${recipients.length} recipients. Are you sure?`
            ),
        });
        if (!proceed) return;

        setSendingId(template.id);
        let sent = 0;
        try {
            for (const student of recipients) {
                if (template.frequencyLimitCount && template.frequencyLimitDays) {
                    const elig = await checkTemplateFrequencyAction({
                        templateId: template.id, recipientStudentId: student.id,
                        limitCount: template.frequencyLimitCount, limitDays: template.frequencyLimitDays,
                    });
                    if (elig.error || !elig.data) continue;
                }
                const prefLang = student.preferred_language || 'ka';
                const raw = (prefLang === 'ru' ? template.textRu : prefLang === 'en' ? template.textEn : template.textKa) || template.textKa || template.textRu || template.textEn;
                if (!raw) continue;
                const text = formatSmsTemplate(raw, { student, studioName });
                const res = await sendSms({ to: student.phone!, text, studentName: student.full_name || student.name, templateId: template.id, recipientStudentId: student.id });
                if (res.success) sent++;
            }
            addNotification(`${sent} ${l('შეტყობინება წარმატებით გაიგზავნა', 'сообщений успешно отправлено', 'messages sent successfully')}`, 'bg-emerald-500');
        } finally {
            setSendingId(null);
        }
    }

    if (loading) {
        return <div className="py-16 flex items-center justify-center text-muted/40"><Loader2 className="w-5 h-5 animate-spin" /></div>;
    }

    return (
        <div className="space-y-4 animate-fade-up">
            {templates.length === 0 ? (
                <div className="bg-surface rounded-2xl border border-border-subtle p-8 text-center text-sm text-muted/40">
                    {l('არ არსებობს გასაგზავნი შაბლონი — შექმენი ერთი "კატეგორიები" ტაბიდან', 'Нет доступных шаблонов — создайте один во вкладке "Категории"', 'No sendable templates yet — create one from the Categories tab')}
                </div>
            ) : templates.map(tpl => {
                const count = recipientsFor(tpl).length;
                return (
                    <div key={tpl.id} className="bg-surface rounded-2xl border border-border-subtle p-5 flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                            <PartyPopper className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-primary truncate">{tpl.name}</p>
                            <p className="text-[11px] text-muted/50 flex items-center gap-1.5 mt-0.5">
                                <Users className="w-3 h-3" /> {count} {l('მიმღები', 'получателей', 'recipients')}
                            </p>
                        </div>
                        <button onClick={() => handleSend(tpl)} disabled={sendingId === tpl.id || count === 0}
                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl active:scale-95 transition-all disabled:opacity-40 shrink-0">
                            {sendingId === tpl.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {l('გაგზავნა', 'Отправить', 'Send')}
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
