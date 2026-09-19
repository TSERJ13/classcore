'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import MainPortal from '@/components/ui/MainPortal';
import { useT } from '@/contexts/LanguageContext';
import { SearchSelect, SearchSelectOption } from '@/components/ui/SearchSelect';
import { addNotification } from '@/lib/notification-store';
import { createSmsTemplateAction, updateSmsTemplateAction, type SmsTemplate } from '@/app/actions/sms-templates';

interface TemplateModalProps {
    open: boolean;
    onClose: () => void;
    categoryId: string;
    template?: SmsTemplate | null;
    groups: SearchSelectOption[];
    branches: SearchSelectOption[];
    students: SearchSelectOption[];
    onSaved: () => void;
}

/**
 * Create/edit form for one sms_templates row (SMS PRD §4). An
 * event-triggered template (trigger_type = 'event' — payment_due /
 * subscription_expiring / birthday) keeps its signal read-only here — the
 * signal is tied to real code paths (sms-service.ts), not something this
 * form can rewire — but everything else (text, recipient, frequency
 * limit) is fully editable, per the PRD's "auto means a starting point,
 * not locked content" (§5). A brand-new template is always trigger_type
 * 'manual' — there's no UI yet for attaching a NEW template to a system
 * event (that would need a real event picker wired to actual signals,
 * which doesn't exist beyond the 3 already hardcoded ones).
 */
export function TemplateModal({ open, onClose, categoryId, template, groups, branches, students, onSaved }: TemplateModalProps) {
    const { lang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    const [name, setName] = useState('');
    const [textKa, setTextKa] = useState('');
    const [textRu, setTextRu] = useState('');
    const [textEn, setTextEn] = useState('');
    const [langTab, setLangTab] = useState<'ka' | 'ru' | 'en'>('ka');
    const [recipientScope, setRecipientScope] = useState<'all' | 'group' | 'branch' | 'person'>('all');
    const [recipientTargetId, setRecipientTargetId] = useState('');
    const [freqCount, setFreqCount] = useState<string>('');
    const [freqDays, setFreqDays] = useState<string>('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(template?.name || '');
        setTextKa(template?.textKa || '');
        setTextRu(template?.textRu || '');
        setTextEn(template?.textEn || '');
        setLangTab('ka');
        setRecipientScope(template?.recipientScope || 'all');
        setRecipientTargetId(template?.recipientTargetId || '');
        setFreqCount(template?.frequencyLimitCount != null ? String(template.frequencyLimitCount) : '');
        setFreqDays(template?.frequencyLimitDays != null ? String(template.frequencyLimitDays) : '');
    }, [open, template]);

    if (!open) return null;

    const targetOptions = recipientScope === 'group' ? groups : recipientScope === 'branch' ? branches : recipientScope === 'person' ? students : [];

    async function handleSave() {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const payload = {
                categoryId,
                name: name.trim(),
                textKa, textRu, textEn,
                triggerType: template?.triggerType || 'manual' as const,
                eventKey: template?.eventKey ?? null,
                recipientScope,
                recipientTargetId: recipientScope === 'all' ? null : (recipientTargetId || null),
                frequencyLimitCount: freqCount ? parseInt(freqCount, 10) : null,
                frequencyLimitDays: freqDays ? parseInt(freqDays, 10) : null,
            };
            const result = template
                ? await updateSmsTemplateAction({ ...payload, id: template.id })
                : await createSmsTemplateAction(payload);
            if (result.error) {
                addNotification(result.error.message, 'bg-rose-500');
                return;
            }
            addNotification(l('შაბლონი შენახულია', 'Шаблон сохранён', 'Template saved'), 'bg-emerald-500');
            onSaved();
            onClose();
        } finally {
            setSaving(false);
        }
    }

    return (
        <MainPortal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
                <div className="bg-card border border-border-subtle w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="px-6 py-5 border-b border-border-subtle flex items-center justify-between shrink-0">
                        <h2 className="text-sm font-black text-primary">
                            {template ? l('შაბლონის რედაქტირება', 'Редактировать шаблон', 'Edit Template') : l('ახალი შაბლონი', 'Новый шаблон', 'New Template')}
                        </h2>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface text-muted">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-6 space-y-5 overflow-y-auto">
                        {template?.triggerType === 'event' && (
                            <div className="text-[11px] px-3 py-2 rounded-xl bg-indigo-500/10 text-indigo-600 font-bold">
                                {l('ავტომატური სიგნალი', 'Автоматический сигнал', 'Automatic signal')}: {template.eventKey}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted tracking-widest ml-1 uppercase">{l('სახელი', 'Название', 'Name')}</label>
                            <input value={name} onChange={e => setName(e.target.value)}
                                className="w-full bg-surface border border-border-subtle rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500/50" />
                        </div>

                        <div className="space-y-2">
                            <div className="flex bg-surface border border-border-subtle rounded-lg p-1 w-fit">
                                {(['ka', 'ru', 'en'] as const).map(lg => (
                                    <button key={lg} onClick={() => setLangTab(lg)}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${langTab === lg ? 'bg-indigo-500 text-white shadow-sm' : 'text-muted hover:text-primary'}`}>
                                        {lg.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                value={langTab === 'ka' ? textKa : langTab === 'ru' ? textRu : textEn}
                                onChange={e => (langTab === 'ka' ? setTextKa : langTab === 'ru' ? setTextRu : setTextEn)(e.target.value)}
                                className="w-full h-28 bg-white border border-border-subtle focus:border-indigo-500/40 rounded-xl px-4 py-3 text-sm text-zinc-900 focus:outline-none resize-none transition-colors shadow-inner"
                                placeholder={l('ტექსტი...', 'Текст...', 'Text...')}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted tracking-widest ml-1 uppercase">{l('მიმღები', 'Получатель', 'Recipient')}</label>
                            <SearchSelect
                                options={[
                                    { value: 'all', label: l('ყველა', 'Все', 'All') },
                                    { value: 'group', label: l('კონკრეტული ჯგუფი', 'Конкретная группа', 'Specific group') },
                                    { value: 'branch', label: l('კონკრეტული ფილიალი', 'Конкретный филиал', 'Specific branch') },
                                    { value: 'person', label: l('კონკრეტული ადამიანი', 'Конкретный человек', 'Specific person') },
                                ]}
                                value={recipientScope}
                                onChange={(v) => { setRecipientScope(v as typeof recipientScope); setRecipientTargetId(''); }}
                            />
                            {recipientScope !== 'all' && (
                                <SearchSelect
                                    options={targetOptions}
                                    value={recipientTargetId}
                                    onChange={setRecipientTargetId}
                                    placeholder={l('— აირჩიეთ —', '— Выберите —', '— Select —')}
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted tracking-widest ml-1 uppercase">{l('სიხშირის ლიმიტი (რაოდენობა)', 'Лимит частоты (кол-во)', 'Frequency limit (count)')}</label>
                                <input type="number" min={1} value={freqCount} onChange={e => setFreqCount(e.target.value)}
                                    placeholder={l('— უსაზღვრო —', '— без лимита —', '— unlimited —')}
                                    className="w-full bg-surface border border-border-subtle rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500/50" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted tracking-widest ml-1 uppercase">{l('პერიოდი (დღე)', 'Период (дней)', 'Period (days)')}</label>
                                <input type="number" min={1} value={freqDays} onChange={e => setFreqDays(e.target.value)}
                                    className="w-full bg-surface border border-border-subtle rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500/50" />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 border-t border-border-subtle flex gap-3 shrink-0">
                        <button onClick={onClose} className="flex-1 py-3 text-xs font-black text-muted hover:bg-surface rounded-2xl transition-all">
                            {l('გაუქმება', 'Отмена', 'Cancel')}
                        </button>
                        <button onClick={handleSave} disabled={saving || !name.trim()}
                            className="flex-[2] py-3 bg-indigo-600 text-white text-xs font-black rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 uppercase disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {l('შენახვა', 'Сохранить', 'Save')}
                        </button>
                    </div>
                </div>
            </div>
        </MainPortal>
    );
}
