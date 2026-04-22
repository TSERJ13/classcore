'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { useT } from '@/contexts/LanguageContext';
import { useStudio } from '@/contexts/StudioContext';
import { THEMES } from '@/lib/settings-store';
import { MessageSquare, Save, Settings2, BarChart3, AlertCircle, RefreshCw, Send, PartyPopper, User, Shield } from 'lucide-react';
import { addNotification } from '@/lib/notification-store';
import { cn } from '@/lib/utils';
import { SearchSelect, SearchSelectOption } from '@/components/ui/SearchSelect';

export default function SmsManagerPage() {
    const { t, lang } = useT();
    const { settings, setSmsTemplates, setNotification, isLoaded } = useStudio();
    const theme = THEMES[settings.themeKey];
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    // SMS Templates State
    const [templates, setTemplates] = useState(settings.sms_templates);
    const [tab, setTab] = useState<'text' | 'personal' | 'holiday' | 'stats'>('text');
    const [langTab, setLangTab] = useState<'ka' | 'ru' | 'en'>('ka');
    const [isSaving, setIsSaving] = useState(false);

    // Logs State
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    // Students State (for picker)
    const [students, setStudents] = useState<any[]>([]);

    // Personal SMS State
    const [selectedStudent, setSelectedStudent] = useState<string>('');
    const [personalMsg, setPersonalMsg] = useState('');
    const [isSendingPersonal, setIsSendingPersonal] = useState(false);

    // Holiday State
    const [selectedHoliday, setSelectedHoliday] = useState<string | null>(null);

    const HOLIDAYS = [
        { id: 'new_year', icon: '🎄', ka: 'ახალი წელი', ru: 'Новый Год', en: 'New Year' },
        { id: 'easter', icon: '🐣', ka: 'აღდგომა', ru: 'Пасха', en: 'Easter' },
        { id: 'march_8', icon: '💐', ka: '8 მარტი', ru: '8 Марта', en: 'March 8' },
        { id: 'sept_1', icon: '🔔', ka: '1 სექტემბერი', ru: '1 Сентября', en: 'Sept 1' },
    ];

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
            setTemplates(settings.sms_templates);
        }
    }, [isLoaded, settings.sms_templates]);

    useEffect(() => {
        if (tab === 'stats') {
            setIsLoadingLogs(true);
            fetch('/api/sms/logs')
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.logs) {
                        const sorted = [...data.logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                        setLogs(sorted);
                    }
                })
                .catch(() => addNotification({ title: t.errorStatus, message: t.logError, type: 'error', time: t.now }))
                .finally(() => setIsLoadingLogs(false));
        }
    }, [tab]);

    const handleSave = () => {
        setIsSaving(true);
        try {
            setSmsTemplates(templates);
            addNotification({ title: t.sentStatus, message: t.smsSaved, type: 'success', time: t.now });
        } catch (error) {
            addNotification({ title: t.errorStatus, message: t.smsError, type: 'error', time: t.now });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendPersonal = () => {
        if (!selectedStudent || !personalMsg) return;
        setIsSendingPersonal(true);
        const student = students.find(s => s.id === selectedStudent);
        fetch('/api/sms/send', {
            method: 'POST',
            body: JSON.stringify({
                to: student?.phone?.replace(/\s/g, ''),
                text: personalMsg,
                studentId: selectedStudent,
                studentName: student?.name
            })
        }).then(res => res.json())
            .then(data => {
                if (data.success) {
                    addNotification({ title: t.sentStatus, message: t.sentStatus, type: 'success', time: t.now });
                    setPersonalMsg('');
                    setSelectedStudent('');
                } else {
                    addNotification({ title: t.errorStatus, message: data.error || t.smsError, type: 'error', time: t.now });
                }
            })
            .catch(() => addNotification({ title: t.errorStatus, message: t.smsError, type: 'error', time: t.now }))
            .finally(() => setIsSendingPersonal(false));
    };

    const handleSendHoliday = () => {
        if (!selectedHoliday) return;
        const msg = (templates[lang] as any)[selectedHoliday];
        const count = students.filter(s => s.phone).length;
        if (confirm(`${l('ნამდვილად გსურთ გაგზავნოთ მილოცვა ', 'Вы действительно хотите отправить поздравление ', 'Are you sure you want to send the greeting to ')} ${count} ${l('სტუდენტზე?', 'студентам?', 'students?')}`)) {
            addNotification({ title: t.sentStatus, message: `${count} ${l('შეტყობინება რიგშია', 'сообщений в очереди', 'messages queued')}`, type: 'success', time: t.now });
            setSelectedHoliday(null);
        }
    };

    const handleTemplateChange = (key: keyof typeof templates['ka'], value: string) => {
        setTemplates(prev => ({
            ...prev,
            [langTab]: {
                ...prev[langTab],
                [key]: value
            }
        }));
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
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-2 md:flex p-1 bg-surface rounded-xl border border-border-subtle gap-1 w-full md:w-fit">
                <button
                    onClick={() => setTab('text')}
                    className={`px-3 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2
                        ${tab === 'text' ? `${theme.bg} ${theme.text} shadow-sm border border-border-subtle` : 'text-muted/60 hover:text-primary hover:bg-surface'}`}
                >
                    <Settings2 className="w-4 h-4" />
                    {t.manageTexts}
                </button>
                <button
                    onClick={() => setTab('personal')}
                    className={`px-3 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2
                        ${tab === 'personal' ? `${theme.bg} ${theme.text} shadow-sm border border-border-subtle` : 'text-muted/60 hover:text-primary hover:bg-surface'}`}
                >
                    <User className="w-4 h-4" />
                    {l('პერსონალური', 'Личное', 'Personal')}
                </button>
                <button
                    onClick={() => setTab('holiday')}
                    className={`px-3 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2
                        ${tab === 'holiday' ? `${theme.bg} ${theme.text} shadow-sm border border-border-subtle` : 'text-muted/60 hover:text-primary hover:bg-surface'}`}
                >
                    <PartyPopper className="w-4 h-4" />
                    {l('მილოცვა', 'Поздравление', 'Holiday')}
                </button>
                <button
                    onClick={() => setTab('stats')}
                    className={`px-3 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all flex items-center justify-center gap-2
                        ${tab === 'stats' ? `${theme.bg} ${theme.text} shadow-sm border border-border-subtle` : 'text-muted/60 hover:text-primary hover:bg-surface'}`}
                >
                    <BarChart3 className="w-4 h-4" />
                    {t.logsStats}
                </button>
            </div>

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

            {/* Content Tab: Holiday SMS */}
            {
                tab === 'holiday' && (
                    <div className="space-y-6 animate-fade-up">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {HOLIDAYS.map(h => (
                                <button
                                    key={h.id}
                                    onClick={() => setSelectedHoliday(h.id)}
                                    className={cn(
                                        'p-6 rounded-2xl border transition-all text-center space-y-3',
                                        selectedHoliday === h.id
                                            ? 'bg-indigo-500/10 border-indigo-500/40 shadow-sm'
                                            : 'bg-surface border-border-subtle hover:border-indigo-500/20'
                                    )}
                                >
                                    <span className="text-3xl block">{h.icon}</span>
                                    <p className="text-sm font-black text-primary">{h[lang]}</p>
                                </button>
                            ))}
                        </div>

                        {selectedHoliday && (
                            <div className="bg-surface rounded-2xl border border-border-subtle p-6 space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-primary">
                                        {l('შეტყობინების ტექსტი', 'Текст сообщения', 'Message Body')}
                                    </label>
                                    <div className="p-4 bg-zinc-900/50 rounded-xl border border-border-subtle text-sm text-primary leading-relaxed italic">
                                        {((templates[lang] as any)[selectedHoliday] || '')?.replace('{studio}', settings.studioName)}
                                    </div>
                                    <p className="text-[10px] text-muted/60">
                                        {l('* შეტყობინება გაეგზავნება ყველა სტუდენტს, ვისაც მითითებული აქვს ტელეფონის ნომერი.', '* Сообщение будет отправлено всем студентам, у которых указан номер телефона.', '* Message will be sent to all students who have a phone number.')}
                                    </p>
                                </div>

                                <button
                                    onClick={handleSendHoliday}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all
                                    hover:shadow-lg relative overflow-hidden group ml-auto`}
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-r ${theme.from} ${theme.to} opacity-90 group-hover:opacity-100 transition-opacity`} />
                                    <span className="relative flex items-center gap-2">
                                        <PartyPopper className="w-4 h-4" />
                                        {l('ყველაზე გაგზავნა', 'Отправить всем', 'Send to All')}
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                )
            }

            {/* Content Tab: SMS Texts */}
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
                                    <li><code className="bg-blue-500/20 px-1 rounded text-blue-800 font-semibold">{"{name}"}</code> — {t.studentName}</li>
                                    <li><code className="bg-blue-500/20 px-1 rounded text-blue-800 font-semibold">{"{plan}"}</code> — {t.subscription}</li>
                                    <li><code className="bg-blue-500/20 px-1 rounded text-blue-800 font-semibold">{"{studio}"}</code> — {t.studio}</li>
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

                        <div className="bg-surface rounded-2xl border border-border-subtle overflow-hidden">
                            <div className="p-5 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <h2 className="text-base font-semibold text-primary">{t.msgTemplates}</h2>

                                <div className="flex bg-surface border border-border-subtle rounded-lg p-1">
                                    <button
                                        onClick={() => setLangTab('ka')}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${langTab === 'ka' ? 'bg-indigo-500 text-white shadow-sm' : 'text-muted hover:text-primary'}`}
                                    >{t.georgian}</button>
                                    <button
                                        onClick={() => setLangTab('ru')}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${langTab === 'ru' ? 'bg-indigo-500 text-white shadow-sm' : 'text-muted hover:text-primary'}`}
                                    >{t.russian}</button>
                                    <button
                                        onClick={() => setLangTab('en')}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${langTab === 'en' ? 'bg-indigo-500 text-white shadow-sm' : 'text-muted hover:text-primary'}`}
                                    >{t.english}</button>
                                </div>
                            </div>
                            <div className="p-5 space-y-8">

                                <TemplateField
                                    title={l('აბონემენტის ვადის ამოწურვა (დღე 0)', 'Истечение срока абонемента (День 0)', 'Subscription Expiration (Day 0)')}
                                    desc={l('იგზავნება იმავე დღეს, როცა აბონიმენტს ვადა გასდის.', 'Отправляется в день истечения срока абонемента.', 'Sent on the day the subscription expires.')}
                                    value={templates[langTab]?.expiration_day_0 || ''}
                                    onChange={(val) => handleTemplateChange('expiration_day_0', val)}
                                />

                                <TemplateField
                                    title={l('დაბადების დღის მილოცვა', 'Поздравление с днем рождения', 'Birthday Greeting')}
                                    desc={l('იგზავნება სტუდენტის დაბადების დღეს დილით.', 'Отправляется утром в день рождения студента.', 'Sent on the morning of the student\'s birthday.')}
                                    value={templates[langTab]?.birthday || ''}
                                    onChange={(val) => handleTemplateChange('birthday', val)}
                                />

                                <TemplateField
                                    title={l('საახალწლო მილოცვა', 'Новогоднее поздравление', 'New Year Greeting')}
                                    desc={l('საახალწლო მილოცვის შაბლონი', 'Шаблон новогоднего поздравления', 'New Year greeting template')}
                                    value={(templates[langTab] as any)?.new_year || ''}
                                    onChange={(val) => handleTemplateChange('new_year' as any, val)}
                                />

                                <TemplateField
                                    title={l('აღდგომის მილოცვა', 'Пасхальное поздравление', 'Easter Greeting')}
                                    desc={l('სააღდგომო მილოცვის შაბლონი', 'Шаблон пасхального поздравления', 'Easter greeting template')}
                                    value={(templates[langTab] as any)?.easter || ''}
                                    onChange={(val) => handleTemplateChange('easter' as any, val)}
                                />

                                <TemplateField
                                    title={l('8 მარტის მილოცვა', 'Поздравление с 8 Марта', 'March 8 Greeting')}
                                    desc={l('8 მარტის მილოცვის შაბლონი', 'Шаблон поздравления с 8 Марта', 'March 8 greeting template')}
                                    value={(templates[langTab] as any)?.march_8 || ''}
                                    onChange={(val) => handleTemplateChange('march_8' as any, val)}
                                />

                                <TemplateField
                                    title={l('1 სექტემბრის მილოცვა', 'Поздравление с 1 Сентября', 'Sept 1 Greeting')}
                                    desc={l('სწავლის დაწყების მილოცვის შაბლონი', 'Шаблон поздравления с началом учебы', 'Back to school greeting template')}
                                    value={(templates[langTab] as any)?.sept_1 || ''}
                                    onChange={(val) => handleTemplateChange('sept_1' as any, val)}
                                />

                            </div>

                            {/* Save Button */}
                            <div className="p-5 border-t border-border-subtle bg-surface flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all
                                    hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 relative overflow-hidden group`}
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-r ${theme.from} ${theme.to} opacity-90 group-hover:opacity-100 transition-opacity`} />
                                    <span className="relative flex items-center gap-2">
                                        {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        {t.saveTexts}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Content Tab: Stats */}
            {
                tab === 'stats' && (
                    <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-surface rounded-2xl border border-border-subtle p-5 flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0`}>
                                    <MessageSquare className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted/60">{t.totalSentToday}</p>
                                    <p className="text-2xl font-bold text-primary mt-1">
                                        {logs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).length}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-surface rounded-2xl border border-border-subtle p-5 flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0`}>
                                    <BarChart3 className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted/60">{t.totalSentHistory}</p>
                                    <p className="text-2xl font-bold text-primary mt-1">{logs.length}</p>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-surface rounded-2xl border border-border-subtle overflow-hidden">
                            <div className="p-5 border-b border-border-subtle flex justify-between items-center">
                                <h2 className="text-base font-semibold text-primary">{t.recentMessages}</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <tbody className="divide-y divide-border-subtle flex flex-col md:table-row-group">
                                        <tr className="hidden md:table-row bg-surface/30 uppercase text-[10px] font-black tracking-widest text-muted/40 border-b border-border-subtle">
                                            <th className="px-5 py-3">{t.dateTable}</th>
                                            <th className="px-5 py-3">{t.userTable}</th>
                                            <th className="px-5 py-3">{t.numberTable}</th>
                                            <th className="px-5 py-3">{t.sentStatus}</th>
                                            <th className="px-5 py-3">{t.msgIdTable}</th>
                                        </tr>

                                        {isLoadingLogs ? (
                                            <tr>
                                                <td colSpan={5} className="px-5 py-8 text-center text-muted/40">
                                                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                                                    {t.loading}
                                                </td>
                                            </tr>
                                        ) : logs.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-5 py-8 text-center text-muted/40">
                                                    {t.logsEmpty}
                                                </td>
                                            </tr>
                                        ) : (
                                            logs.map((log, i) => (
                                                <tr key={i} className="hover:bg-surface/50 transition-colors flex flex-col md:table-row p-4 md:p-0 border-b md:border-b-0 border-border-subtle/30 last:border-0 relative">
                                                    <div className="absolute left-0 top-4 bottom-4 w-1 bg-indigo-500/20 md:hidden" />
                                                    
                                                    <td className="px-5 py-4 md:py-4 text-primary/80 whitespace-nowrap text-[10px] md:text-xs">
                                                        <span className="md:hidden text-[9px] font-black text-muted/40 uppercase block mb-1">{t.dateTable}</span>
                                                        {new Date(log.timestamp).toLocaleString('ka-GE', {
                                                            month: 'short', day: 'numeric',
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </td>
                                                    <td className="px-5 py-1 md:py-4 text-primary font-bold">
                                                        <span className="md:hidden text-[9px] font-black text-muted/40 uppercase block mb-1">{t.userTable}</span>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center md:hidden">
                                                                <User className="w-3 h-3 text-indigo-500" />
                                                            </div>
                                                            {log.studentName || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-1 md:py-4 text-primary/80 font-mono text-[10px] md:text-xs">
                                                        <span className="md:hidden text-[9px] font-black text-muted/40 uppercase block mb-1">{t.numberTable}</span>
                                                        {log.to}
                                                    </td>
                                                    <td className="px-5 py-2 md:py-4">
                                                        <span className="md:hidden text-[9px] font-black text-muted/40 uppercase block mb-1">{t.sentStatus}</span>
                                                        <div className="flex flex-col gap-1 items-start">
                                                            {log.status === 'success' || log.status === 'DELIVERED' ? (
                                                                <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-[9px] md:text-[10px] font-black tracking-wider uppercase">
                                                                    {t.sentStatus}
                                                                </span>
                                                            ) : (
                                                                <div className="flex flex-col">
                                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-red-500/10 text-red-500 text-[9px] md:text-[10px] font-black tracking-wider uppercase">
                                                                        {t.errorStatus}
                                                                    </span>
                                                                    {log.error && <span className="text-[9px] text-red-500/80 max-w-[150px] leading-tight break-words mt-1">{log.error}</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-2 md:py-4 text-muted/80 text-[10px] md:text-xs w-full max-w-[250px] sm:max-w-xs xl:max-w-sm relative group/td">
                                                        <span className="md:hidden text-[9px] font-black text-muted/40 uppercase block mb-1">{t.msgIdTable}</span>
                                                        <div className="flex flex-col gap-1">
                                                            {log.text && <span className="truncate leading-tight font-medium text-primary/60">{log.text}</span>}
                                                            <span className="text-[8px] font-mono text-muted/30">ID: {log.id || log.messageId || '-'}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))

                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}

// Helper component for textareas
function TemplateField({ title, desc, value, onChange }: { title: string, desc: string, value: string, onChange: (v: string) => void }) {
    const { t } = useT();
    return (
        <div className="space-y-3">
            <div>
                <label className="text-sm font-medium text-primary block">{title}</label>
                <p className="text-xs text-muted/60">{desc}</p>
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-24 bg-white border border-border-subtle focus:border-indigo-500/40 rounded-xl px-4 py-3 text-sm text-zinc-900 focus:outline-none resize-none transition-colors shadow-inner"
                placeholder={t.messagePlaceholder}
            />
            <div className="flex items-center justify-between text-xs text-muted/40">
                <span>{value.length} {t.charCount}</span>
                <span>{t.charInfo}</span>
            </div>
        </div>
    );
}
