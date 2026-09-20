'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { useStudio } from '@/contexts/StudioContext';
import { THEMES } from '@/lib/settings-store';
import { MessageSquare, Settings2, BarChart3, AlertCircle, RefreshCw, Send, PartyPopper, User, Shield, Moon, Power, Wallet, Trash2 } from 'lucide-react';
import { addNotification } from '@/lib/notification-store';
import { cn } from '@/lib/utils';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { formatSmsTemplate, resolveSmsRecipientName, sendSms } from '@/lib/sms-service';
import { getSubscription } from '@/lib/subscription-store';
import { isSmsKillSwitchActive } from '@/lib/settings-store';
import { CategoryTemplatesTab } from '@/components/sms/CategoryTemplatesTab';
import { LogsTab } from '@/components/sms/LogsTab';
import { BroadcastTab } from '@/components/sms/BroadcastTab';
import { getSmsBalanceAction } from '@/app/actions/sms-balance';

export default function SmsManagerPage() {
    const { t, lang } = useT();
    const { settings, setNotification, updateSettings, isLoaded } = useStudio();
    const theme = THEMES[settings.themeKey];
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    const [tab, setTab] = useState<'text' | 'personal' | 'holiday' | 'stats' | 'settings'>('text');

    // Global SMS settings (PRD §10): quiet hours draft + Master Kill-Switch (instant-apply, like the
    // enabledFeatures toggles elsewhere in this app — an emergency stop shouldn't need a Save click).
    const [quietStart, setQuietStart] = useState(settings.smsManager?.quietHours?.startHour ?? 23);
    const [quietEnd, setQuietEnd] = useState(settings.smsManager?.quietHours?.endHour ?? 10);
    const killSwitchActive = isSmsKillSwitchActive(settings);

    // Students State (for picker)
    const [students, setStudents] = useState<any[]>([]);

    // Persistent balance indicator (SMS PRD §2/§11) — visible across every
    // tab, since it's one page. `null` = not yet loaded/not configured;
    // never shown as a fabricated number. `connectionStatus` doubles as
    // PRD §10's "provider connection status" — a stateless REST API has no
    // real persistent connection, so this reads it as "did the last
    // balance check succeed" and "reconnect" just re-runs that check.
    const [smsBalance, setSmsBalance] = useState<number | null>(null);
    const [balanceError, setBalanceError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'not_configured'>('checking');
    const [lowBalanceThreshold, setLowBalanceThreshold] = useState<string>(settings.smsManager?.lowBalanceThreshold != null ? String(settings.smsManager.lowBalanceThreshold) : '');
    const [logRetentionDays, setLogRetentionDays] = useState<string>(settings.smsManager?.logRetentionDays != null ? String(settings.smsManager.logRetentionDays) : '');
    const warnedLowBalance = useRef(false);

    const checkBalance = useCallback(() => {
        setConnectionStatus('checking');
        getSmsBalanceAction().then(result => {
            if (result.error) {
                setBalanceError(result.error.message);
                setSmsBalance(null);
                setConnectionStatus(result.error.code === 'not_configured' ? 'not_configured' : 'disconnected');
                return;
            }
            setSmsBalance(result.data.balance);
            setConnectionStatus('connected');
            const threshold = settings.smsManager?.lowBalanceThreshold;
            if (threshold != null && result.data.balance < threshold && !warnedLowBalance.current) {
                warnedLowBalance.current = true;
                const label = lang === 'ka' ? 'დაბალი SMS ბალანსი' : lang === 'ru' ? 'Низкий баланс SMS' : 'Low SMS balance';
                addNotification(`${label}: ${result.data.balance}`, 'bg-amber-500');
            }
        });
    }, [settings.smsManager?.lowBalanceThreshold, lang]);

    useEffect(() => { checkBalance(); }, [checkBalance]);

    function handleSaveLowBalanceThreshold() {
        const parsed = lowBalanceThreshold ? parseInt(lowBalanceThreshold, 10) : undefined;
        updateSettings({ smsManager: { ...settings.smsManager, lowBalanceThreshold: Number.isFinite(parsed) ? parsed : undefined } });
        addNotification(l('შენახულია', 'Сохранено', 'Saved'), 'bg-emerald-500');
    }

    function handleSaveLogRetention() {
        const parsed = logRetentionDays ? parseInt(logRetentionDays, 10) : undefined;
        const clamped = Number.isFinite(parsed) && parsed! > 0 ? Math.min(parsed!, 3650) : undefined;
        updateSettings({ smsManager: { ...settings.smsManager, logRetentionDays: clamped } });
        addNotification(l('შენახულია', 'Сохранено', 'Saved'), 'bg-emerald-500');
    }

    async function handleExportLogsCsv() {
        try {
            const res = await fetch('/api/sms/logs');
            const data = await res.json();
            const rows: Record<string, unknown>[] = data.success ? data.logs : [];
            const header = ['timestamp', 'student_name', 'to_number', 'status', 'delivery_status', 'text', 'error'];
            const csv = [header.join(',')].concat(
                rows.map(r => header.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))
            ).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sms-logs-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            addNotification(l('ექსპორტი ვერ მოხერხდა', 'Не удалось экспортировать', 'Export failed'), 'bg-rose-500');
        }
    }

    // Personal SMS State
    const [selectedStudent, setSelectedStudent] = useState<string>('');
    const [personalMsg, setPersonalMsg] = useState('');
    const [isSendingPersonal, setIsSendingPersonal] = useState(false);

    // Load students on mount
    useEffect(() => {
        const raw = localStorage.getItem(`cc_student_data_${settings.studioSlug}`) || localStorage.getItem('cc_student_data');
        if (raw) {
            try {
                const data = JSON.parse(raw);
                setStudents(Object.entries(data).map(([id, s]: [string, any]) => ({ id, ...s })));
            } catch { }
        }
    }, [settings.studioSlug, isLoaded]);

    // Sync state when settings load
    useEffect(() => {
        if (isLoaded) {
            setQuietStart(settings.smsManager?.quietHours?.startHour ?? 23);
            setQuietEnd(settings.smsManager?.quietHours?.endHour ?? 10);
            setLowBalanceThreshold(settings.smsManager?.lowBalanceThreshold != null ? String(settings.smsManager.lowBalanceThreshold) : '');
            setLogRetentionDays(settings.smsManager?.logRetentionDays != null ? String(settings.smsManager.logRetentionDays) : '');
        }
    }, [isLoaded, settings.smsManager]);

    function handleSaveQuietHours() {
        updateSettings({ smsManager: { ...settings.smsManager, quietHours: { startHour: quietStart, endHour: quietEnd } } });
        addNotification(l('შენახულია', 'Сохранено', 'Saved'), 'bg-emerald-500');
    }

    function handleToggleKillSwitch() {
        updateSettings({ smsManager: { ...settings.smsManager, killSwitchActive: !killSwitchActive } });
    }

    const handleSendPersonal = () => {
        if (!selectedStudent || !personalMsg) return;
        setIsSendingPersonal(true);
        const student = students.find(s => s.id === selectedStudent);
        if (!student) {
            setIsSendingPersonal(false);
            return;
        }

        const sub = getSubscription(student.id);
        const planName = sub?.plan || (sub as any)?.plan_name || '';
        const studioName = settings.studioName || 'Studio';
        const formattedText = formatSmsTemplate(personalMsg, {
            student,
            planName,
            studioName
        });
        const recipientName = resolveSmsRecipientName(student);

        sendSms({
            to: student.phone,
            text: formattedText,
            studentName: student.full_name || student.name || recipientName
        }).then(data => {
            if (data.success) {
                addNotification({ title: t.sentStatus, message: t.sentStatus, type: 'success', time: t.now });
                setPersonalMsg('');
                setSelectedStudent('');
            } else {
                addNotification({ title: t.errorStatus, message: data.error || t.smsError, type: 'error', time: t.now });
            }
        }).catch(() => addNotification({ title: t.errorStatus, message: t.smsError, type: 'error', time: t.now }))
          .finally(() => setIsSendingPersonal(false));
    };

    if (!isLoaded) {
        return (
            <div className="flex-1 p-4 lg:p-8 space-y-8 max-w-7xl mx-auto w-full animate-pulse">
                <div className="h-8 w-64 bg-white/10 rounded-lg"></div>
                <div className="h-64 bg-white/5 rounded-2xl border border-white/10"></div>
            </div>
        );
    }

    return (
        <PermissionGuard permKey="canViewSMS">
            <div className="flex-1 space-y-8 max-w-6xl mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-primary flex items-center gap-3">
                        <MessageSquare className={`w-6 h-6 ${theme.text}`} />
                        {t.smsManager}
                    </h1>
                    <p className="text-sm text-muted/60 mt-1">
                        {t.smsManagerDesc}
                    </p>
                </div>
                {smsBalance !== null ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border-subtle rounded-xl shrink-0">
                        <Wallet className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm font-black text-primary">{smsBalance.toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-muted/50 uppercase tracking-wider">SMS</span>
                    </div>
                ) : balanceError ? (
                    <p className="text-[11px] text-muted/40 max-w-[220px] text-right shrink-0" title={balanceError}>
                        {l('ბალანსი მიუწვდომელია', 'Баланс недоступен', 'Balance unavailable')}
                    </p>
                ) : null}
            </div>

            {/* Tabs */}
            <div className="flex flex-col sm:flex-row w-full bg-surface border border-border-subtle rounded-[1.25rem] p-1 sm:h-12 gap-1 sm:gap-0">
                <button
                    onClick={() => setTab('text')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 h-10 sm:h-full rounded-xl text-[10px] font-black tracking-widest transition-all',
                        tab === 'text' ? `${theme.bg} ${theme.text} shadow-sm` : 'text-muted hover:bg-black/5 dark:hover:bg-white/5'
                    )}
                >
                    <Settings2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="whitespace-nowrap">{t.manageTexts}</span>
                </button>
                <button
                    onClick={() => setTab('personal')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 h-10 sm:h-full rounded-xl text-[10px] font-black tracking-widest transition-all',
                        tab === 'personal' ? `${theme.bg} ${theme.text} shadow-sm` : 'text-muted hover:bg-black/5 dark:hover:bg-white/5'
                    )}
                >
                    <User className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="whitespace-nowrap">{l('პერსონალური', 'Личное', 'Personal')}</span>
                </button>
                <button
                    onClick={() => setTab('holiday')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 h-10 sm:h-full rounded-xl text-[10px] font-black tracking-widest transition-all',
                        tab === 'holiday' ? `${theme.bg} ${theme.text} shadow-sm` : 'text-muted hover:bg-black/5 dark:hover:bg-white/5'
                    )}
                >
                    <PartyPopper className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="whitespace-nowrap">{l('მასობრივი გაგზავნა', 'Массовая отправка', 'Broadcast')}</span>
                </button>
                <button
                    onClick={() => setTab('stats')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 h-10 sm:h-full rounded-xl text-[10px] font-black tracking-widest transition-all',
                        tab === 'stats' ? `${theme.bg} ${theme.text} shadow-sm` : 'text-muted hover:bg-black/5 dark:hover:bg-white/5'
                    )}
                >
                    <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="whitespace-nowrap">{t.logsStats}</span>
                </button>
                <button
                    onClick={() => setTab('settings')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 h-10 sm:h-full rounded-xl text-[10px] font-black tracking-widest transition-all',
                        tab === 'settings' ? `${theme.bg} ${theme.text} shadow-sm` : 'text-muted hover:bg-black/5 dark:hover:bg-white/5'
                    )}
                >
                    <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="whitespace-nowrap">{l('პარამეტრები', 'Настройки', 'Settings')}</span>
                </button>
            </div>

            {/* Content Tab: Global Settings (SMS PRD §10) */}
            {tab === 'settings' && (
                <div className="space-y-6 animate-fade-up">
                    <div className="bg-surface rounded-2xl border border-border-subtle p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <Moon className="w-4 h-4 text-indigo-400" />
                            <h2 className="text-base font-semibold text-primary">{l('ჩუმი საათები', 'Тихие часы', 'Quiet Hours')}</h2>
                        </div>
                        <p className="text-sm text-muted/70">
                            {l('ავტომატური შეტყობინებები არ გაგზავნილა ამ ინტერვალში.', 'Автоматические сообщения не отправляются в этот интервал.', 'Automated messages will not be sent during this window.')}
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted tracking-widest ml-1 uppercase">{l('დან (საათი)', 'С (час)', 'From (hour)')}</label>
                                <input type="number" min={0} max={23} value={quietStart} onChange={e => setQuietStart(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
                                    className="w-24 bg-white border border-border-subtle rounded-2xl px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500/50 text-zinc-900" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted tracking-widest ml-1 uppercase">{l('მდე (საათი)', 'До (час)', 'To (hour)')}</label>
                                <input type="number" min={0} max={23} value={quietEnd} onChange={e => setQuietEnd(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
                                    className="w-24 bg-white border border-border-subtle rounded-2xl px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500/50 text-zinc-900" />
                            </div>
                            <button onClick={handleSaveQuietHours}
                                className="ml-auto px-5 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl active:scale-95 transition-all uppercase">
                                {l('შენახვა', 'Сохранить', 'Save')}
                            </button>
                        </div>
                    </div>

                    <div className="bg-surface rounded-2xl border border-border-subtle p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            <h2 className="text-base font-semibold text-primary">{l('დაბალი ბალანსის გაფრთხილება', 'Предупреждение о низком балансе', 'Low Balance Warning')}</h2>
                        </div>
                        <p className="text-sm text-muted/70">
                            {l('როცა ბალანსი ამ ზღვარს ჩამოეცლება, გამოჩნდება შიდა აპლიკაციის შეტყობინება.', 'Когда баланс опустится ниже этого значения, появится внутреннее уведомление.', 'An in-app notification appears once the balance drops below this.')}
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted tracking-widest ml-1 uppercase">{l('ზღვარი (SMS)', 'Порог (SMS)', 'Threshold (SMS)')}</label>
                                <input type="number" min={0} value={lowBalanceThreshold} onChange={e => setLowBalanceThreshold(e.target.value)}
                                    placeholder={l('— გამორთული —', '— отключено —', '— disabled —')}
                                    className="w-32 bg-white border border-border-subtle rounded-2xl px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500/50 text-zinc-900" />
                            </div>
                            <button onClick={handleSaveLowBalanceThreshold}
                                className="ml-auto px-5 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl active:scale-95 transition-all uppercase">
                                {l('შენახვა', 'Сохранить', 'Save')}
                            </button>
                        </div>
                    </div>

                    <div className="bg-surface rounded-2xl border border-border-subtle p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <Trash2 className="w-4 h-4 text-muted" />
                            <h2 className="text-base font-semibold text-primary">{l('ლოგების ავტომატური წაშლა', 'Автоудаление логов', 'Automatic Log Deletion')}</h2>
                        </div>
                        <p className="text-sm text-muted/70">
                            {l('ამ ვადაზე უფრო ძველი SMS-ლოგები ყოველდღიურად წაიშლება ავტომატურად. ცარიელი = გამორთული — ლოგები არასოდეს არ წაშლილა თავისით.', 'SMS-логи старше этого срока удаляются автоматически, раз в день. Пусто = отключено — логи никогда не удаляются сами по себе.', 'SMS logs older than this are deleted automatically, once a day. Empty = disabled — logs are never deleted on their own.')}
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted tracking-widest ml-1 uppercase">{l('დღეები', 'Дни', 'Days')}</label>
                                <input type="number" min={1} max={3650} value={logRetentionDays} onChange={e => setLogRetentionDays(e.target.value)}
                                    placeholder={l('— გამორთული —', '— отключено —', '— disabled —')}
                                    className="w-32 bg-white border border-border-subtle rounded-2xl px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500/50 text-zinc-900" />
                            </div>
                            <button onClick={handleSaveLogRetention}
                                className="ml-auto px-5 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl active:scale-95 transition-all uppercase">
                                {l('შენახვა', 'Сохранить', 'Save')}
                            </button>
                        </div>
                    </div>

                    <div className={cn('rounded-2xl border p-6 space-y-4', killSwitchActive ? 'bg-rose-500/10 border-rose-500/30' : 'bg-surface border-border-subtle')}>
                        <div className="flex items-center gap-2">
                            <Power className={cn('w-4 h-4', killSwitchActive ? 'text-rose-500' : 'text-muted')} />
                            <h2 className="text-base font-semibold text-primary">{l('გადაუდებელი გაჩერება — ყველა SMS', 'Экстренная остановка — все SMS', 'Emergency Stop — All SMS')}</h2>
                        </div>
                        <p className="text-sm text-muted/70">
                            {l('ჩართვისას მთლიანად ჩერდება ყველა SMS-ის გაგზავნა — ავტომატური, ხელით და შაბლონებით — კატეგორია/შაბლონის ინდივიდუალური ჩართვის მდგომარეობის მიუხედავად.', 'При включении полностью останавливается отправка всех SMS — автоматических, вручную и по шаблонам — независимо от состояния отдельных категорий/шаблонов.', 'When active, ALL SMS sending stops completely — automated, manual, and template-based — regardless of any individual category/template toggle.')}
                        </p>
                        <div className="flex items-center justify-between">
                            <span className={cn('text-xs font-black uppercase tracking-widest', killSwitchActive ? 'text-rose-500' : 'text-muted')}>
                                {killSwitchActive ? l('გაჩერებულია', 'Остановлено', 'Stopped') : l('აქტიური', 'Активно', 'Active')}
                            </span>
                            <button onClick={handleToggleKillSwitch}
                                className={`w-14 h-7 rounded-full transition-colors relative focus:outline-none ${killSwitchActive ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                                <div className={`w-6 h-6 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${killSwitchActive ? 'translate-x-7' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                    </div>

                    <div className="bg-surface rounded-2xl border border-border-subtle p-6 space-y-4">
                        <h2 className="text-base font-semibold text-primary">{l('მონაცემები', 'Данные', 'Data')}</h2>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-primary">{l('ლოგების ექსპორტი (CSV)', 'Экспорт логов (CSV)', 'Export Logs (CSV)')}</p>
                                <p className="text-[11px] text-muted/50">{l('ბოლო 1000 გაგზავნა', 'Последние 1000 отправок', 'Last 1000 sends')}</p>
                            </div>
                            <button onClick={handleExportLogsCsv}
                                className="px-5 py-2.5 bg-surface border border-border-subtle text-primary text-xs font-black rounded-xl active:scale-95 transition-all uppercase hover:border-indigo-500/40">
                                {l('ექსპორტი', 'Экспорт', 'Export')}
                            </button>
                        </div>
                    </div>

                    <div className="bg-surface rounded-2xl border border-border-subtle p-6 space-y-4">
                        <h2 className="text-base font-semibold text-primary">{l('გამგზავნი და კავშირი', 'Отправитель и соединение', 'Sender & Connection')}</h2>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-primary">{l('გამგზავნის სახელი', 'Имя отправителя', 'Sender Name')}</p>
                                <p className="text-[11px] text-muted/50">
                                    {l('საერთოა ყველა ClassCore სტუდიისთვის — ინდივიდუალურად შესაცვლელად საჭიროა ტექნიკურ გუნდთან დაკავშირება.', 'Общее для всех студий ClassCore — для индивидуального изменения свяжитесь с технической командой.', 'Shared across every ClassCore studio — contact the technical team to change it individually.')}
                                </p>
                            </div>
                            <span className="px-3 py-1.5 bg-surface border border-border-subtle rounded-lg text-sm font-black text-primary shrink-0">
                                {process.env.NEXT_PUBLIC_GOSMS_SENDER_ID || 'ClassCore'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                            <div className="flex items-center gap-2">
                                <span className={cn('w-2 h-2 rounded-full', connectionStatus === 'connected' ? 'bg-emerald-500' : connectionStatus === 'checking' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500')} />
                                <span className="text-sm font-bold text-primary">
                                    {connectionStatus === 'connected' && l('დაკავშირებულია', 'Подключено', 'Connected')}
                                    {connectionStatus === 'checking' && l('მოწმდება...', 'Проверка...', 'Checking...')}
                                    {connectionStatus === 'disconnected' && l('კავშირი შეწყვეტილია', 'Соединение потеряно', 'Connection lost')}
                                    {connectionStatus === 'not_configured' && l('არ არის კონფიგურირებული', 'Не настроено', 'Not configured')}
                                </span>
                            </div>
                            {connectionStatus === 'disconnected' && (
                                <button onClick={checkBalance} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black text-indigo-500 hover:bg-indigo-500/10 transition-colors">
                                    <RefreshCw className="w-3.5 h-3.5" /> {l('ხელახლა დაკავშირება', 'Переподключить', 'Reconnect')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Content Tab: Personal SMS */}
            {tab === 'personal' && (
                <div className="space-y-6 animate-fade-up">
                    <div className="bg-surface rounded-2xl border border-border-subtle p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-primary flex items-center gap-2">
                                    <User className="w-4 h-4 text-indigo-400" />
                                    {l('აირჩიეთ სტუდენტი', 'Выберите студента', 'Select Student')}
                                </label>
                                <SearchSelect
                                    options={students
                                        .filter(s => s.phone)
                                        .map(s => ({
                                            value: s.id,
                                            label: s.name || s.full_name || 'No Name',
                                            subLabel: s.phone
                                        }))}
                                    value={selectedStudent}
                                    onChange={(val) => setSelectedStudent(val)}
                                    placeholder={l('— აირჩიეთ —', '— Выберите —', '— Select —')}
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-medium text-primary">
                                {t.messagePlaceholder}
                            </label>
                            <textarea
                                value={personalMsg}
                                onChange={(e) => setPersonalMsg(e.target.value)}
                                className="w-full h-32 bg-white border border-border-subtle focus:border-indigo-500/40 rounded-xl px-4 py-3 text-sm text-zinc-900 focus:outline-none resize-none transition-colors shadow-inner"
                                placeholder={l('ჩაწერეთ შეტყობინება...', 'Введите сообщение...', 'Type your message...')}
                            />
                            <div className="flex items-center justify-between text-xs text-muted/40">
                                <span>{personalMsg.length} {t.charCount}</span>
                                <span>{t.charInfo}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleSendPersonal}
                            disabled={isSendingPersonal || !selectedStudent || !personalMsg}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all
                                hover:shadow-lg disabled:opacity-50 relative overflow-hidden group ml-auto`}
                        >
                            <div className={`absolute inset-0 bg-gradient-to-r ${theme.from} ${theme.to} opacity-90 group-hover:opacity-100 transition-opacity`} />
                            <span className="relative flex items-center gap-2">
                                {isSendingPersonal ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {l('გაგზავნა', 'Отправить', 'Send Now')}
                            </span>
                        </button>
                    </div>
                </div>
            )
            }

            {/* Content Tab: Broadcast (any active manual template — SMS PRD §3/§6, replaces the old hardcoded Holiday tab) */}
            {tab === 'holiday' && <BroadcastTab students={students} studioName={settings.studioName || 'Studio'} />}

            {/* Content Tab: Categories & Templates (SMS PRD §3/§4) */}
            {
                tab === 'text' && (
                    <div className="space-y-6">
                        {/* Instructions */}
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-900/80 leading-relaxed">
                                <p className="font-semibold text-blue-900 mb-1">{t.variablesGuide}:</p>
                                <p>{l('ტექსტში შეგიძლიათ ჩასვათ სპეციალური სიტყვები, რომლებსაც სისტემა ავტომატურად ჩაანაცვლებს სტუდენტის მონაცემებით:', 'В тексте можно вставить специальные слова, которые система автоматически заменит данными ученика:', 'You can insert special words into the text, which the system will automatically replace with student data:')}</p>
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li><code className="bg-blue-500/20 px-1 rounded text-blue-800 font-semibold">{"{name}"}</code> — {l('სახელი (18 წლამდე ავტომატურად მშობლის სახელი, 18 წლიდან — სტუდენტის)', 'Имя (до 18 лет автоматически имя родителя, с 18 лет — ученика)', 'Name (parent name if under 18, student name if 18+)')}</li>
                                    <li><code className="bg-blue-500/20 px-1 rounded text-blue-800 font-semibold">{"{plan}"}</code> — {l('აბონემენტის სახელი (მაგ. 12 გაკვეთილი)', 'Название абонемента (напр. 12 занятий)', 'Subscription Plan Name')}</li>
                                    <li><code className="bg-blue-500/20 px-1 rounded text-blue-800 font-semibold">{"{studio}"}</code> — {l('სტუდიის სახელი', 'Название студии', 'Studio Name')}</li>
                                </ul>
                            </div>
                        </div>

                        <div className="bg-surface rounded-2xl border border-border-subtle p-5 flex items-center justify-between shadow-sm">
                            <div className="pr-4">
                                <h2 className="text-base font-semibold text-primary">{t.autoSend}</h2>
                                <p className="text-sm text-muted/80 mt-1">
                                    {t.autoSendDesc}
                                </p>
                            </div>
                            <button
                                onClick={() => setNotification('autoSms', settings.notifications.autoSms === false ? true : false)}
                                className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-surface ${settings.notifications.autoSms !== false ? 'bg-emerald-500' : 'bg-border-subtle'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm ${settings.notifications.autoSms !== false ? 'translate-x-6' : 'translate-x-0.5'}`} />
                            </button>
                        </div>

                        <CategoryTemplatesTab
                            branches={(settings.branches || []).map(b => ({ value: b.id, label: b.name }))}
                            students={students.filter(s => s.phone).map(s => ({ value: s.id, label: s.name || s.full_name || 'No Name', subLabel: s.phone }))}
                        />
                    </div>
                )
            }

            {/* Content Tab: Logs (SMS PRD §9 — grouped per-template, with retry) */}
            {tab === 'stats' && <LogsTab />}
            </div>
        </PermissionGuard>
    );
}
