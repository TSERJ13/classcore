'use client';

import { useState, useRef, useEffect } from 'react';
import {
    Building2, Bell, Globe, Shield, CreditCard, Palette,
    Upload, Check, Camera, Save, Zap, Settings2,
} from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { THEMES, BG_THEMES, type ThemeKey, type BgKey } from '@/lib/settings-store';
import { cn, getInitials } from '@/lib/utils';

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={cn(
                'relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0',
                checked ? 'bg-indigo-500' : 'bg-muted/10'
            )}
            style={checked ? { background: 'hsl(var(--accent, 239 84% 67%))' } : undefined}
        >
            <span className={cn(
                'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200',
                checked ? 'translate-x-5' : 'translate-x-0.5'
            )} />
        </button>
    );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
    return (
        <div className="bg-card border border-border-subtle rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border-subtle/50">
                <Icon className="w-4 h-4 text-muted" />
                <h2 className="text-sm font-bold text-primary">{title}</h2>
            </div>
            <div className="divide-y divide-border-subtle/30">{children}</div>
        </div>
    );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-primary">{label}</p>
                {sub && <p className="text-[11px] text-muted mt-0.5">{sub}</p>}
            </div>
            {children}
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
    const { t, lang } = useT();
    const { settings, setTheme, setBg, setStudioName, setStudioSlug, setLogo, setNotification, setSecurity, setLandingContent } = useStudio();
    const { profile, user } = useUser();
    const isAdmin = profile?.role === 'admin';

    const [nameVal, setNameVal] = useState(settings.studioName);
    const [slugVal, setSlugVal] = useState(settings.studioSlug);
    const [nameSaved, setNameSaved] = useState(false);
    const [slugSaved, setSlugSaved] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [sessionVal, setSessionVal] = useState(settings.security.sessionTimeout);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setNameVal(settings.studioName);
        setSlugVal(settings.studioSlug);
    }, [settings.studioName, settings.studioSlug]);

    // Auto-sync studio name from profile if it's currently a default/demo name
    useEffect(() => {
        if (profile?.studio_name && (settings.studioName.toLowerCase().includes('demo') || settings.studioName === 'ჩემი სტუდია')) {
            if (profile.studio_name !== settings.studioName) {
                setStudioName(profile.studio_name);
                setNameVal(profile.studio_name);
            }
        }
    }, [profile?.studio_name, settings.studioName]);

    function saveName() {
        if (!nameVal.trim()) return;
        setStudioName(nameVal.trim());
        setNameSaved(true);
        setTimeout(() => setNameSaved(false), 2000);
    }

    function saveSlug() {
        const val = slugVal.trim() || nameVal.trim().toLowerCase().replace(/\s+/g, '-');
        setStudioSlug(val);
        setSlugSaved(true);
        setTimeout(() => setSlugSaved(false), 2000);
    }

    function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            setLogo(result);
            setUploading(false);
        };
        reader.readAsDataURL(file);
    }

    const theme = THEMES[settings.themeKey];
    const ThemeTextCls = theme.text;
    const ThemeBgCls = theme.bg;
    const ThemeBorderCls = theme.border;

    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fade-up pb-10">

            {/* ─── Header ─── */}
            <div>
                <h1 className="text-xl font-bold text-primary">{t.settings}</h1>
                <p className="text-sm text-muted mt-0.5">{settings.studioName}</p>
            </div>

            {/* ─── Studio Identity ─── */}
            <Section title={l('სტუდიის ინდივიდუალობა', 'Идентичность студии', 'Studio Identity')} icon={Building2}>
                {/* Logo */}
                <Row label={l('ლოგო', 'Логотип', 'Logo')} sub={l('სტუდიის ლოგო (PNG/JPG)', 'Логотип студии (PNG/JPG)', 'Your studio logo (PNG/JPG)')}>
                    <div className="flex items-center gap-3">
                        {/* Preview */}
                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-border-subtle flex-shrink-0 bg-surface flex items-center justify-center">
                            {settings.logoDataUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={settings.logoDataUrl} alt="logo" className="w-full h-full object-cover" />
                            ) : (
                                <div className={`w-full h-full bg-gradient-to-br ${theme.from} ${theme.to} flex items-center justify-center`}>
                                    <span className="text-base font-black text-white">{getInitials(settings.studioName)}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <button
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border-subtle text-muted hover:text-primary hover:bg-surface/80 text-xs font-medium transition-all shadow-sm"
                            >
                                {uploading ? <span className="animate-spin">⏳</span> : <Camera className="w-3.5 h-3.5" />}
                                {l('ატვირთვა', 'Загрузить', 'Upload')}
                            </button>
                            {settings.logoDataUrl && (
                                <button
                                    onClick={() => setLogo(null)}
                                    className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors"
                                >{l('წაშლა', 'Удалить', 'Remove')}</button>
                            )}
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </div>
                </Row>

                {/* Studio name */}
                <Row label={l('სტუდიის სახელი', 'Название студии', 'Studio Name')} sub={l('გამოჩნდება სადენავ პანელში', 'Отображается в боковой панели', 'Shown in sidebar')}>
                    <div className="flex items-center gap-2">
                        <input
                            value={nameVal}
                            onChange={e => setNameVal(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveName()}
                            className="w-48 bg-surface border border-border-subtle focus:border-indigo-500/40 rounded-xl px-3 py-2 text-xs font-medium text-primary outline-none transition-all"
                            style={{ borderColor: nameSaved ? 'hsl(var(--accent, 239 84% 67%) / 0.5)' : undefined }}
                        />
                        <button
                            onClick={saveName}
                            className={cn('w-8 h-8 flex items-center justify-center rounded-xl transition-all', nameSaved ? 'bg-emerald-500/20 text-emerald-600' : 'bg-surface text-muted hover:bg-surface hover:text-primary border border-border-subtle')}
                        >
                            {nameSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </Row>

                {/* Email */}
                <Row label={l('ელ-ფოსტა', 'Email', 'Email')} sub={l('თქვენი ანგარიშის მეილი', 'Email вашего аккаунта', 'Your account email')}>
                    <div className="px-3 py-2 bg-surface/50 border border-border-subtle/50 rounded-xl text-xs font-medium text-muted/60 min-w-[12rem] text-right">
                        {user?.email || 'N/A'}
                    </div>
                </Row>

                {/* Owner */}
                <Row label={l('მფლობელი', 'Владелец', 'Owner')} sub={l('სახელი და გვარი', 'Имя и фамилия', 'First and last name')}>
                    <div className="px-3 py-2 bg-surface/50 border border-border-subtle/50 rounded-xl text-xs font-medium text-primary min-w-[12rem] text-right">
                        {profile?.first_name} {profile?.last_name}
                    </div>
                </Row>

                {/* Slug */}
                <Row label={l('URL slug', 'URL slug', 'URL Slug')} sub="classcore.ge/{slug}">
                    <div className="flex items-center gap-2">
                        <span className="text-muted/40 text-xs">/</span>
                        <input
                            value={slugVal}
                            onChange={e => setSlugVal(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                            onKeyDown={e => e.key === 'Enter' && saveSlug()}
                            className="w-36 bg-surface border border-border-subtle focus:border-indigo-500/40 rounded-xl px-3 py-2 text-xs font-mono text-muted outline-none transition-colors"
                        />
                        <button
                            onClick={saveSlug}
                            className={cn('w-8 h-8 flex items-center justify-center rounded-xl transition-all', slugSaved ? 'bg-emerald-500/20 text-emerald-600' : 'bg-surface text-muted hover:bg-surface hover:text-primary border border-border-subtle')}
                        >
                            {slugSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </Row>
            </Section>

            {/* ─── Color Theme ─── */}
            <Section title={l('ფერთა პალიტრა', 'Цветовая палитра', 'Color Theme')} icon={Palette}>
                <div className="px-5 py-5">
                    <p className="text-xs text-muted mb-4">{l('აირჩიეთ ინტერფეისის ძირითადი ფერი', 'Выберите основной цвет интерфейса', 'Choose the main accent color for the interface')}</p>
                    <div className="grid grid-cols-7 gap-2">
                        {(Object.entries(THEMES) as [ThemeKey, typeof THEMES[ThemeKey]][]).map(([key, th]) => {
                            const isActive = settings.themeKey === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setTheme(key)}
                                    className="flex flex-col items-center gap-2 group"
                                >
                                    <div className={cn(
                                        'w-10 h-10 rounded-full transition-all duration-200 shadow-lg flex items-center justify-center',
                                        `bg-gradient-to-br ${th.from} ${th.to}`,
                                        isActive ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-[#111116] scale-110' : 'opacity-60 hover:opacity-100 hover:scale-105'
                                    )}>
                                        {isActive && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                                    </div>
                                    <span className={cn('text-[10px] font-medium', isActive ? 'text-primary uppercase font-bold' : 'text-muted')}>{th.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Live preview strip */}
                    <div className="mt-5 p-3 rounded-xl bg-surface/50 border border-border-subtle">
                        <p className="text-[10px] text-muted mb-2">{l('წინასწარი ხედი', 'Предпросмотр', 'Preview')}</p>
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${theme.from} ${theme.to} flex items-center justify-center flex-shrink-0`}>
                                <Zap className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                                <div className={`h-1.5 rounded-full bg-gradient-to-r ${theme.from} ${theme.to} w-3/4`} />
                                <div className="h-1 rounded-full bg-muted/20 w-1/2 mt-1.5" />
                            </div>
                            <span className={cn('text-xs font-bold px-2.5 py-1 rounded-lg border', ThemeBgCls, ThemeTextCls, ThemeBorderCls)}>
                                {theme.label}
                            </span>
                        </div>
                    </div>
                </div>
            </Section>

            {/* ─── Background Theme ─── */}
            <Section title={l('ფონის ფერი', 'Цвет фона', 'Background Color')} icon={Palette}>
                <div className="px-5 py-5">
                    <p className="text-xs text-muted mb-4">{l('ინტერფეისის ფონის ფერი', 'Цвет фона интерфейса', 'Choose the overall background darkness')}</p>
                    <div className="grid grid-cols-7 gap-2">
                        {(Object.entries(BG_THEMES) as [BgKey, typeof BG_THEMES[BgKey]][]).map(([key, bg]) => {
                            const isActive = settings.bgKey === key;
                            return (
                                <button key={key} onClick={() => setBg(key)} className="flex flex-col items-center gap-2 group">
                                    <div className={cn(
                                        'w-10 h-10 rounded-full border-2 transition-all duration-200 shadow-lg flex items-center justify-center',
                                        isActive ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-[#111116] scale-110 border-white/30' : 'border-white/[0.12] opacity-70 hover:opacity-100 hover:scale-105'
                                    )} style={{ background: bg.base }}>
                                        {isActive && <Check className="w-4 h-4 text-white/80" strokeWidth={3} />}
                                    </div>
                                    <span className={cn('text-[10px] font-medium', isActive ? 'text-primary uppercase font-bold' : 'text-muted')}>{bg.label}</span>
                                </button>
                            );
                        })}
                    </div>
                    {/* bg preview */}
                    <div className="mt-5 rounded-xl overflow-hidden border border-border-subtle">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle/50" style={{ background: BG_THEMES[settings.bgKey].surface }}>
                            <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${theme.from} ${theme.to}`} />
                            <div className="flex-1 h-1.5 rounded-full bg-muted/20" />
                        </div>
                        <div className="flex gap-2 p-2" style={{ background: BG_THEMES[settings.bgKey].base }}>
                            {[30, 50, 70].map(w => (
                                <div key={w} className="rounded-lg p-2 flex-1" style={{ background: BG_THEMES[settings.bgKey].card }}>
                                    <div className="h-1.5 rounded-full mb-1" style={{ background: `hsl(var(--accent, 239 84% 67%) / 0.5)`, width: `${w}%` }} />
                                    <div className="h-1 rounded-full bg-muted/20" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Section>

            {/* ─── Notifications ─── */}
            <Section title={t.settingsNotif} icon={Bell}>
                <Row label={l('ახალი სტუდენტი', 'Новый студент', 'New Student')} sub={l('შეტყობინება ახალი სტუდენტის დამატებისას', 'Уведомлять при добавлении нового студента', 'Notify when a new student is added')}>
                    <Toggle checked={settings.notifications.newStudent} onChange={v => setNotification('newStudent', v)} />
                </Row>
                <Row label={l('სესიების ნაკლებობა', 'Мало сессий', 'Low Sessions')} sub={l('სტუდენტს 2-ზე ნაკლები სესია დარჩა', 'У студента осталось менее 2 сессий', 'Student has fewer than 2 sessions left')}>
                    <Toggle checked={settings.notifications.lowSessions} onChange={v => setNotification('lowSessions', v)} />
                </Row>
                <Row label={l('ყოველდღიური ანგარიში', 'Ежедневный отчёт', 'Daily Report')} sub={l('ყოველდღე 20:00-ზე გამოგიგზავნოთ ანგარიში', 'Отчёт каждый день в 20:00', 'Receive a daily report at 20:00')}>
                    <Toggle checked={settings.notifications.dailyReport} onChange={v => setNotification('dailyReport', v)} />
                </Row>
                <Row label="Telegram Bot" sub={l('მოინიშნეთ Telegram-ის არხში', 'Уведомления в Telegram канале', 'Attendance alerts in Telegram channel')}>
                    <Toggle checked={settings.notifications.telegramBot} onChange={v => setNotification('telegramBot', v)} />
                </Row>
            </Section>

            {/* ─── Language ─── */}
            <Section title={t.settingsLang} icon={Globe}>
                <Row label={l('ინტერფეისის ენა', 'Язык интерфейса', 'Interface Language')} sub={l('ყველა ტექსტის ენა', 'Язык всех текстов', 'Language of all text')}>
                    <div className="text-xs text-muted">
                        {lang === 'ka' ? '🇬🇪 ქართული' : lang === 'ru' ? '🇷🇺 Русский' : '🇬🇧 English'}
                        <span className="ml-1 text-muted/40">(sidebar)</span>
                    </div>
                </Row>
                <Row label={l('ვალუტა', 'Валюта', 'Currency')} sub={l('გადახდების ვალუტა', 'Валюта платежей', 'Currency for payments')}>
                    <select className="bg-surface border border-border-subtle rounded-xl px-3 py-2 text-xs text-primary outline-none focus:border-indigo-500/40 transition-all">
                        <option value="gel">₾ GEL</option>
                        <option value="usd">$ USD</option>
                        <option value="eur">€ EUR</option>
                        <option value="rub">₽ RUB</option>
                    </select>
                </Row>
                <Row label={l('დროის ზონა', 'Часовой пояс', 'Timezone')}>
                    <select className="bg-surface border border-border-subtle rounded-xl px-3 py-2 text-xs text-primary outline-none focus:border-indigo-500/40 transition-all">
                        <option>Asia/Tbilisi (UTC+4)</option>
                        <option>Europe/Moscow (UTC+3)</option>
                        <option>UTC</option>
                    </select>
                </Row>
            </Section>

            {/* ─── Security ─── */}
            <Section title={t.settingsSecurity} icon={Shield}>
                <Row label={l('ორფაქტორიანი ავთ.', 'Двухфакторная аутент.', '2-Factor Auth')} sub={l('SMS ან Authenticator App-ით', 'Через SMS или Authenticator App', 'Via SMS or Authenticator App')}>
                    <Toggle checked={settings.security.twoFactor} onChange={v => setSecurity('twoFactor', v)} />
                </Row>
                <Row label={l('სესიის ვადა (წუთი)', 'Таймаут сессии (мин)', 'Session Timeout (min)')} sub={l('უმოქმედო სესიის ხანგრძლივობა', 'Длительность неактивной сессии', 'Auto-logout after inactivity')}>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={sessionVal}
                            min={5} max={480}
                            onChange={e => setSessionVal(Number(e.target.value))}
                            onBlur={() => setSecurity('sessionTimeout', sessionVal)}
                            className="w-20 bg-surface border border-border-subtle rounded-xl px-3 py-2 text-xs text-primary outline-none text-center focus:border-indigo-500/40 transition-all"
                        />
                        <span className="text-xs text-muted">{l('წთ', 'мин', 'min')}</span>
                    </div>
                </Row>
                <Row label={l('პაროლის შეცვლა', 'Изменить пароль', 'Change Password')}>
                    <button className="px-4 py-2 rounded-xl bg-surface border border-border-subtle text-muted hover:text-primary hover:bg-surface/80 text-xs font-medium transition-all shadow-sm">
                        {l('შეცვლა', 'Изменить', 'Change')}
                    </button>
                </Row>
            </Section>

            {/* ─── Subscription ─── */}
            <Section title={t.subscriptions} icon={CreditCard}>
                <Row label="Pro Plan" sub={l('გაგრძელდება 28 მარტს', 'Истекает 28 марта', 'Renews March 28')}>
                    <div className="flex items-center gap-2">
                        <span className={cn('text-xs font-bold px-2.5 py-1 rounded-lg border', ThemeBgCls, ThemeTextCls, ThemeBorderCls)}>
                            <Zap className="w-3 h-3 inline mr-1" />Pro
                        </span>
                    </div>
                </Row>
                <Row label={l('თვიური გადასახადი', 'Ежемесячная оплата', 'Monthly Billing')} sub="₾149 / month">
                    <button className="px-4 py-2 rounded-xl bg-surface border border-border-subtle text-muted hover:text-primary hover:bg-surface/80 text-xs font-medium transition-all shadow-sm">
                        {l('მართვა', 'Управлять', 'Manage')}
                    </button>
                </Row>
            </Section>

            {/* ─── Integrations ─── */}
            <Section title={l('ინტეგრაციები', 'Интеграции', 'Integrations')} icon={Settings2}>
                {[
                    { name: 'Telegram Bot', active: settings.notifications.telegramBot, icon: '✈' },
                    { name: 'Google Calendar', active: false, icon: '📅' },
                    { name: 'Stripe Payments', active: false, icon: '💳' },
                ].map(item => (
                    <Row key={item.name} label={item.name}>
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{item.icon}</span>
                            <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border',
                                item.active
                                    ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                    : 'bg-surface text-muted/40 border-border-subtle/50'
                            )}>
                                {item.active ? l('აქტიური', 'Активно', 'Active') : l('გამოთიშული', 'Откл.', 'Disabled')}
                            </span>
                        </div>
                    </Row>
                ))}
            </Section>

            {/* ─── Landing Page Content (Admin Only) ─── */}
            {isAdmin && (
                <Section title={l('მთავარი გვერდის კონტენტი', 'Контент главной страницы', 'Landing Page Content')} icon={Globe}>
                    <div className="px-5 py-5 space-y-6">
                        {/* Hero */}
                        <div className="space-y-4">
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest leading-none mb-1 opacity-40">Hero სექცია</p>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-muted/40 mb-1.5 block">სათაური</label>
                                    <textarea
                                        value={settings.landingContent.heroTitle}
                                        onChange={e => setLandingContent({ heroTitle: e.target.value })}
                                        rows={2}
                                        className="w-full bg-surface border border-border-subtle focus:border-indigo-500/40 rounded-xl px-3 py-2 text-sm text-primary outline-none hide-scrollbar resize-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-muted/40 mb-1.5 block">ქვესათაური</label>
                                    <textarea
                                        value={settings.landingContent.heroSubtitle}
                                        onChange={e => setLandingContent({ heroSubtitle: e.target.value })}
                                        rows={2}
                                        className="w-full bg-surface border border-border-subtle focus:border-indigo-500/40 rounded-xl px-3 py-2 text-xs text-muted outline-none hide-scrollbar resize-none transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Features */}
                        <div className="space-y-4 pt-4 border-t border-border-subtle/50">
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest leading-none mb-1 opacity-40">ფუნქციები (Features)</p>
                            <div className="space-y-4">
                                {settings.landingContent.features.map((f, i) => (
                                    <div key={i} className="p-4 rounded-xl bg-surface/30 border border-border-subtle space-y-3 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                                <span className="text-xs text-indigo-600 font-bold">#{i + 1}</span>
                                            </div>
                                            <input
                                                value={f.title}
                                                onChange={e => {
                                                    const next = [...settings.landingContent.features];
                                                    next[i] = { ...f, title: e.target.value };
                                                    setLandingContent({ features: next });
                                                }}
                                                placeholder="სათაური"
                                                className="flex-1 bg-transparent border-none text-sm font-bold text-primary outline-none placeholder:text-muted/20"
                                            />
                                        </div>
                                        <textarea
                                            value={f.desc}
                                            onChange={e => {
                                                const next = [...settings.landingContent.features];
                                                next[i] = { ...f, desc: e.target.value };
                                                setLandingContent({ features: next });
                                            }}
                                            placeholder="აღწერა"
                                            rows={2}
                                            className="w-full bg-transparent border-none text-xs text-muted outline-none hide-scrollbar resize-none placeholder:text-muted/20"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Section>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between text-[10px] text-muted/30 px-1 font-bold uppercase tracking-widest">
                <span>ClassCore v1.0 · classcore.ge</span>
                <button className="hover:text-red-500 transition-colors">{l('ანგარიშის წაშლა', 'Удалить аккаунт', 'Delete Account')}</button>
            </div>
        </div>
    );
}
