'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, Loader2, RefreshCw, CheckCircle2, XCircle, Tag, History, MessageSquare } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { addNotification } from '@/lib/notification-store';
import { sendSms } from '@/lib/sms-service';
import { listSmsTemplatesAction, listSmsAuditLogAction, type SmsAuditLogEntry } from '@/app/actions/sms-templates';

type SmsLogRow = {
    id: string;
    timestamp: string;
    student_name: string | null;
    to_number: string | null;
    text: string | null;
    status: string | null;
    error: string | null;
    template_id: string | null;
    recipient_student_id: string | null;
    delivery_status: 'delivered' | 'failed' | null;
};

/**
 * Logs tab rebuild (SMS PRD §9): groups sends by template ("დაჯგუფება
 * პერ-შაბლონ") with a drill-down per group and a Retry button on failed
 * sends. Logs with no `template_id` (Personal/Holiday tabs, or automated
 * sends that fell back to the old blob — Phase 3's notes) land in an
 * "სხვა" bucket rather than being hidden.
 */
export function LogsTab() {
    const { lang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const [subTab, setSubTab] = useState<'messages' | 'audit'>('messages');

    const [logs, setLogs] = useState<SmsLogRow[]>([]);
    const [templateNames, setTemplateNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [retrying, setRetrying] = useState<Record<string, boolean>>({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [logsRes, templatesRes] = await Promise.all([
                fetch('/api/sms/logs').then(r => r.json()).catch(() => ({ success: false, logs: [] })),
                listSmsTemplatesAction(),
            ]);
            setLogs(logsRes.success ? logsRes.logs : []);
            const names: Record<string, string> = {};
            (templatesRes.data || []).forEach(t => { names[t.id] = t.name; });
            setTemplateNames(names);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const groups = useMemo(() => {
        const byTemplate: Record<string, SmsLogRow[]> = {};
        for (const row of logs) {
            const key = row.template_id || '__other__';
            (byTemplate[key] ??= []).push(row);
        }
        return Object.entries(byTemplate).sort((a, b) => b[1].length - a[1].length);
    }, [logs]);

    async function handleRetry(row: SmsLogRow) {
        setRetrying(p => ({ ...p, [row.id]: true }));
        try {
            const res = await sendSms({
                to: row.to_number || '',
                text: row.text || '',
                studentName: row.student_name || undefined,
                templateId: row.template_id || undefined,
                recipientStudentId: row.recipient_student_id || undefined,
            });
            addNotification(res.success ? l('გამეორება წარმატებულია', 'Повтор успешен', 'Retry succeeded') : (res.error || l('შეცდომა', 'Ошибка', 'Error')), res.success ? 'bg-emerald-500' : 'bg-rose-500');
            await load();
        } finally {
            setRetrying(p => ({ ...p, [row.id]: false }));
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex bg-surface border border-border-subtle rounded-lg p-1 w-fit">
                <button onClick={() => setSubTab('messages')}
                    className={cn('flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black rounded-md transition-all', subTab === 'messages' ? 'bg-indigo-500 text-white shadow-sm' : 'text-muted hover:text-primary')}>
                    <MessageSquare className="w-3.5 h-3.5" /> {l('შეტყობინებები', 'Сообщения', 'Messages')}
                </button>
                <button onClick={() => setSubTab('audit')}
                    className={cn('flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black rounded-md transition-all', subTab === 'audit' ? 'bg-indigo-500 text-white shadow-sm' : 'text-muted hover:text-primary')}>
                    <History className="w-3.5 h-3.5" /> {l('აუდიტი', 'Аудит', 'Audit')}
                </button>
            </div>

            {subTab === 'audit' ? <AuditLogPanel /> : loading ? (
                <div className="py-16 flex items-center justify-center text-muted/40"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : groups.length === 0 ? (
                <div className="bg-surface rounded-2xl border border-border-subtle p-8 text-center text-sm text-muted/40">
                    {l('ლოგები არ არსებობს', 'Логов нет', 'No logs yet')}
                </div>
            ) : groups.map(([key, rows]) => {
                const isOpen = expanded[key];
                const name = key === '__other__' ? l('სხვა', 'Другое', 'Other') : (templateNames[key] || l('წაშლილი შაბლონი', 'Удалённый шаблон', 'Deleted template'));
                const failedCount = rows.filter(r => r.status === 'error').length;
                return (
                    <div key={key} className="bg-surface rounded-2xl border border-border-subtle overflow-hidden">
                        <button onClick={() => setExpanded(p => ({ ...p, [key]: !p[key] }))} className="w-full p-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                                {isOpen ? <ChevronDown className="w-4 h-4 text-muted shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted shrink-0" />}
                                <Tag className="w-4 h-4 text-indigo-400 shrink-0" />
                                <span className="text-sm font-black text-primary truncate">{name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {failedCount > 0 && (
                                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500">{failedCount} {l('შეცდომა', 'ошибок', 'failed')}</span>
                                )}
                                <span className="text-[10px] font-bold text-muted/50">{rows.length}</span>
                            </div>
                        </button>

                        {isOpen && (
                            <div className="border-t border-border-subtle divide-y divide-border-subtle/60 max-h-96 overflow-y-auto">
                                {rows.map(row => (
                                    <div key={row.id} className="p-3 flex items-center gap-3">
                                        <div className="shrink-0">
                                            {row.status === 'success'
                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                : <XCircle className="w-4 h-4 text-rose-500" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-primary truncate">{row.student_name || '—'}</span>
                                                <span className="text-[10px] font-mono text-muted/50">{row.to_number}</span>
                                                {row.delivery_status && (
                                                    <span className={cn('text-[8px] font-black uppercase px-1 rounded', row.delivery_status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500')}>
                                                        {row.delivery_status}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-muted/50 truncate">{new Date(row.timestamp).toLocaleString('ka-GE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {row.error || row.text}</p>
                                        </div>
                                        {row.status === 'error' && (
                                            <button onClick={() => handleRetry(row)} disabled={retrying[row.id]}
                                                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black text-indigo-500 hover:bg-indigo-500/10 transition-colors disabled:opacity-50">
                                                {retrying[row.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                                {l('გამეორება', 'Повтор', 'Retry')}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

const ACTION_LABELS: Record<string, [string, string, string]> = {
    category_created: ['კატეგორია შეიქმნა', 'Категория создана', 'Category created'],
    category_enabled: ['კატეგორია ჩაირთო', 'Категория включена', 'Category enabled'],
    category_disabled: ['კატეგორია გამოირთო', 'Категория отключена', 'Category disabled'],
    category_deleted: ['კატეგორია წაიშალა', 'Категория удалена', 'Category deleted'],
    template_created: ['შაბლონი შეიქმნა', 'Шаблон создан', 'Template created'],
    template_edited: ['შაბლონი შესწორდა', 'Шаблон изменён', 'Template edited'],
    template_deleted: ['შაბლონი წაიშალა', 'Шаблон удалён', 'Template deleted'],
    template_duplicated: ['შაბლონი დუბლირდა', 'Шаблон дублирован', 'Template duplicated'],
};

/**
 * Read side of the audit journal (PRD §9) — mutations in
 * sms-templates.ts have written to sms_audit_log since Phase 1; this is
 * the first UI to show it back.
 */
function AuditLogPanel() {
    const { lang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const [entries, setEntries] = useState<SmsAuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        listSmsAuditLogAction().then(result => {
            if (!result.error) setEntries(result.data);
            setLoading(false);
        });
    }, []);

    if (loading) {
        return <div className="py-16 flex items-center justify-center text-muted/40"><Loader2 className="w-5 h-5 animate-spin" /></div>;
    }

    if (entries.length === 0) {
        return (
            <div className="bg-surface rounded-2xl border border-border-subtle p-8 text-center text-sm text-muted/40">
                {l('აუდიტის ჩანაწერი არ არსებობს', 'Записей аудита нет', 'No audit entries yet')}
            </div>
        );
    }

    return (
        <div className="bg-surface rounded-2xl border border-border-subtle divide-y divide-border-subtle/60 max-h-[32rem] overflow-y-auto">
            {entries.map(entry => {
                const label = ACTION_LABELS[entry.action];
                const name = (entry.details?.name as string | undefined) || (entry.details?.fromId ? `→ ${entry.details.fromId}` : undefined);
                return (
                    <div key={entry.id} className="p-3 flex items-center gap-3">
                        <History className="w-4 h-4 text-indigo-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-primary">
                                {label ? l(label[0], label[1], label[2]) : entry.action}
                                {name && <span className="text-muted/50 font-normal"> — {name}</span>}
                            </p>
                            <p className="text-[10px] text-muted/50">
                                {entry.actorName || l('უცნობი', 'Неизвестно', 'Unknown')} · {new Date(entry.createdAt).toLocaleString('ka-GE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
