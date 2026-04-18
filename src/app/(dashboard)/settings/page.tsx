'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Building2, Bell, Globe, Shield, CreditCard, Palette,
    Check, Camera, Save, Zap, Settings2, Link2, ExternalLink, Copy, Trash2, User, UserCircle, History, MessageCircle, LogOut as LogOutIcon, Plus, Send, RefreshCcw, ChevronDown, X, Pencil, AlertTriangle, Languages, CalendarDays, ShoppingBag, BarChart2
} from 'lucide-react';
import { checkCloudConnection, syncStaffToCloud, masterStudioPurge } from '@/lib/sync-store';
import { addNotification } from '@/lib/notification-store';
import { useT } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { useConfirm } from '@/contexts/ConfirmContext';
import { THEMES, type ThemeKey, ensureUniqueName, ensureUniqueSlug, convertFinancialData, removeFromRegistry, cleanupRegistry, migrateSlugData, addToRegistry, setActiveSlug } from '@/lib/settings-store';
import { cn, getInitials, compactSlugify, formatCurrency } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { SearchSelect } from '@/components/ui/SearchSelect';

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={cn(
                'relative w-9 h-5 rounded-full transition-all duration-300 flex-shrink-0',
                checked ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'bg-muted/10'
            )}
            style={checked ? { background: 'hsl(var(--accent, 239 84% 67%))' } : undefined}
        >
            <div className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300',
                checked ? 'translate-x-4' : 'translate-x-0'
            )} />
        </button>
    );
}

function Section({ title, icon: Icon, children, defaultOpen = false }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="bg-card border border-border-subtle rounded-2xl md:rounded-3xl shadow-sm hover:shadow-md transition-all">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-5 py-4 md:px-6 md:py-5 bg-surface/10 hover:bg-surface/30 transition-colors group"
            >
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-2.5 rounded-xl md:rounded-2xl bg-indigo-500/5 text-indigo-500 group-hover:bg-indigo-500/10 transition-all">
                        <Icon className="w-4 h-4 md:w-5 md:h-5 transition-transform" />
                    </div>
                    <h2 className="text-sm md:text-base font-black text-primary tracking-tight">{title}</h2>
                </div>
                <div className={cn("p-1.5 md:p-2 rounded-lg md:rounded-xl text-muted group-hover:text-primary transition-all duration-300", isOpen ? "rotate-180" : "rotate-0")}>
                    <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
                </div>
            </button>
            <div className={cn(
                "divide-y divide-border-subtle/20 bg-card transition-all duration-300 ease-in-out",
                isOpen ? "max-h-[2000px] opacity-100 border-t border-border-subtle/30 overflow-visible" : "max-h-0 opacity-0 pointer-events-none overflow-hidden"
            )}>
                {children}
            </div>
        </div>
    );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6 px-5 py-4 md:px-6 md:py-5 hover:bg-surface/30 transition-colors group/row">
            <div className="flex-1 min-w-0 max-w-full sm:max-w-[480px]">
                <p className="text-xs md:text-[13px] font-bold text-primary tracking-tight group-hover/row:text-indigo-500 transition-colors">{label}</p>
                {sub && <p className="text-[10px] md:text-[11px] text-muted/70 mt-0.5 md:mt-1 leading-relaxed">{sub}</p>}
            </div>
            <div className="flex justify-end items-center sm:w-auto w-full mt-1 sm:mt-0 shadow-none">
                {children}
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
    const { t, lang, setLang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const { settings, isLoaded, setTheme, setStudioName, setStudioSlug, setLogo, setNotification, setSecurity, setCurrency, setLanguage, setTimezone, setGoogleCalendar, setPausePrice, updateStaff, removeStaff, addBranch, removeBranch, updateBranch, setCustomRoles, addStaff, setOwnerInfo } = useStudio();
    const { profile, user, logout } = useUser();
    const confirm = useConfirm();
    const isAdmin = profile?.role === 'superadmin' || profile?.role === 'owner' || profile?.role === 'admin';
    const isOwner = profile?.role === 'owner' || profile?.role === 'superadmin';
    const isSuperAdmin = profile?.role === 'superadmin';

    const [nameVal, setNameVal] = useState(settings.studioName);
    const [slugVal, setSlugVal] = useState(settings.studioSlug);
    const [copiedRegLink, setCopiedRegLink] = useState(false);
    const [branchModalOpen, setBranchModalOpen] = useState(false);
    const [newBranchName, setNewBranchName] = useState('');
    const [newBranchAddress, setNewBranchAddress] = useState('');
    const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
    const [newRoleName, setNewRoleName] = useState('');
    const [staffModalOpen, setStaffModalOpen] = useState(false);
    const [newStaff, setNewStaff] = useState({
        first_name: '',
        last_name: '',
        role: 'teacher',
        email: '',
        password: '',
        permissions: {
            canViewAttendance: true,
            canViewSubscriptions: false,
            canViewStudents: true,
            canViewCalendar: true,
            canEditCalendar: false,
            canViewGroups: true,
            canViewTeachers: true,
            canViewHalls: false,
            canViewShop: false,
            canViewAnalytics: false,
            canViewSMS: false,
        },
        allowedBranchIds: [] as string[]
    });


    // Use slugVal (live input) so the link preview updates as-you-type
    const registrationUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/${slugVal}/registration`
        : `/${slugVal}/registration`;

    const copyRegLink = () => {
        navigator.clipboard.writeText(registrationUrl).then(() => {
            setCopiedRegLink(true);
            setTimeout(() => setCopiedRegLink(false), 2000);
        });
    };
    const [nameSaved, setNameSaved] = useState(false);
    const [slugSaved, setSlugSaved] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [sessionVal, setSessionVal] = useState(settings.security.sessionTimeout);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (settings.studioName && !nameVal) {
            setNameVal(settings.studioName);
        }
        
        // Auto-fill slug if empty
        if (!slugVal && !settings.studioSlug) {
            if (nameVal && nameVal.toLowerCase() !== 'studio') {
                setSlugVal(compactSlugify(nameVal));
            } else if (settings.studioName && settings.studioName.toLowerCase() !== 'studio') {
                setSlugVal(compactSlugify(settings.studioName));
            }
        } else if (settings.studioSlug && !slugVal) {
            setSlugVal(settings.studioSlug);
        }
    }, [settings.studioName, settings.studioSlug, nameVal]);



    // Password Modal States
    const [showPwdModal, setShowPwdModal] = useState(false);
    const [pwdVal, setPwdVal] = useState('');
    const [pwdConfirmVal, setPwdConfirmVal] = useState('');
    const [pwdLoading, setPwdLoading] = useState(false);
    const [pwdError, setPwdError] = useState('');
    const [pwdSuccess, setPwdSuccess] = useState(false);
    const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
    const [branchToDeleteId, setBranchToDeleteId] = useState<string | null>(null);
    const [branchDeletePass, setBranchDeletePass] = useState('');
    const [branchDeleteError, setBranchDeleteError] = useState('');
    const [isDeletingBranch, setIsDeletingBranch] = useState(false);
    const [editingStaffData, setEditingStaffData] = useState<any>(null);

    // Sync local state when starting/stopping edit
    useEffect(() => {
        if (editingStaffId) {
            const member = settings.staff?.find((s: any) => s.id === editingStaffId);
            if (member) {
                setEditingStaffData(JSON.parse(JSON.stringify(member))); // Deep clone
            }
        } else {
            setEditingStaffData(null);
        }
    }, [editingStaffId, settings.staff]);





    function saveName() {
        if (!nameVal.trim()) return;
        const uniqueName = nameVal.trim();
        setStudioName(uniqueName);
        setNameVal(uniqueName);

        // Only superadmins can trigger slug changes, and we keep it safe
        if (isSuperAdmin) {
            const uniqueSlug = ensureUniqueSlug(uniqueName, settings.studioSlug);
            if (uniqueSlug !== settings.studioSlug) {
                // We DON'T auto-migrate here to avoid surprising the user
                // They should change the slug input explicitly if they want a URL change
            }
        }

        setNameSaved(true);
        setTimeout(() => setNameSaved(false), 2000);
    }

    async function saveSlug() {
        if (!slugVal || slugVal === settings.studioSlug) return;
        
        const ok = await confirm({
            title: l('მისამართის შეცვლა', 'Смена адреса', 'Change URL Address'),
            message: l(
                `მისამართის შეცვლა (${settings.studioSlug} -> ${slugVal}) გამოიწვევს გვერდის გადატვირთვას. დარწმუნებული ხართ?`,
                `Смена адреса (${settings.studioSlug} -> ${slugVal}) приведет к перезагрузке страницы. Вы уверены?`,
                `Changing the address (${settings.studioSlug} -> ${slugVal}) will cause the page to reload. Are you sure?`
            ),
            confirmText: l('შეცვლა', 'Сменить', 'Change'),
            danger: true
        });

        if (!ok) return;

        const val = ensureUniqueSlug(slugVal, settings.studioSlug);
        
        // 1. Migrate ALL local data keys
        migrateSlugData(settings.studioSlug, val);
        
        // 2. Update Registry and Active Slug
        addToRegistry(val);
        setActiveSlug(val);
        
        // 3. Update cookie for SSR
        document.cookie = `cc_active_slug=${val}; path=/; max-age=31536000; SameSite=Lax`;
        
        setSlugSaved(true);
        addNotification(l('მისამართი წარმატებით შეიცვალა', 'Адрес успешно изменен', 'Address successfully changed'), 'success');
        
        // 4. Forced reload to the new slug URL
        setTimeout(() => {
            window.location.href = `/${val}/settings`;
        }, 1000);
    }

    async function handleReclaimSlug() {
        const target = compactSlugify(slugVal || nameVal);
        if (!target) return;

        const ok = await confirm({
            title: t.reclaimName,
            message: t.reclaimConfirm.replace('"${target}"', `"${target}"`),
            confirmText: t.confirm,
            cancelText: t.cancel,
            danger: true
        });

        if (ok) {
            removeFromRegistry(target);
            cleanupRegistry();
            saveSlug(); // Try saving again after clearing
        }
    }

    async function handleCurrencyChange(newCurrency: 'GEL' | 'USD' | 'EUR') {
        if (newCurrency === settings.currency) return;

        const confirmMsg = l(
            `ყურადღება! ხდება მხოლოდ ვალუტის ნიშნის (სიმბოლოს) ცვლილება (${settings.currency} -> ${newCurrency}). არსებული თანხების კონვერტაცია არ მოხდება. გნებავთ გაგრძელება?`,
            `Внимание! Изменяется только символ валюты (${settings.currency} -> ${newCurrency}). Существующие суммы не будут конвертированы. Хотите продолжить?`,
            `Attention! Only the currency symbol will be changed (${settings.currency} -> ${newCurrency}). Existing amounts will not be converted. Do you want to continue?`
        );

        const ok = await confirm({
            title: t.currencyChangeTitle,
            message: t.currencyChangeDesc.replace('${settings.currency}', settings.currency).replace('${newCurrency}', newCurrency),
            confirmText: t.confirm,
            cancelText: t.cancel,
            danger: false
        });

        if (ok) {
            setCurrency(newCurrency);
        }
    }

    async function handleChangePassword() {
        if (!pwdVal || pwdVal !== pwdConfirmVal) {
            setPwdError(t.passwordsDoNotMatch);
            return;
        }
        if (pwdVal.length < 6) {
            setPwdError(t.passwordTooShort);
            return;
        }

        setPwdError('');
        setPwdLoading(true);
        const supabase = createClient();
        const { error } = await supabase.auth.updateUser({ password: pwdVal });
        setPwdLoading(false);

        if (error) {
            setPwdError(error.message);
        } else {
            setPwdSuccess(true);
            setTimeout(() => {
                setShowPwdModal(false);
                setPwdSuccess(false);
                setPwdVal('');
                setPwdConfirmVal('');
            }, 2000);
        }
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
            if (fileRef.current) fileRef.current.value = '';
        };
        reader.readAsDataURL(file);
    }

    const theme = THEMES[settings.themeKey];
    const ThemeTextCls = theme.text;
    const ThemeBgCls = theme.bg;
    const ThemeBorderCls = theme.border;

    if (!isLoaded) {
        return (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
                <div className="h-10 bg-muted/5 rounded-2xl w-1/4 animate-pulse ml-2" />
                <div className="bg-card border border-border-subtle rounded-3xl h-24 w-full animate-pulse opacity-50" />
                <div className="bg-card border border-border-subtle rounded-3xl h-24 w-full animate-pulse opacity-50" />
                <div className="bg-card border border-border-subtle rounded-3xl h-24 w-full animate-pulse opacity-50" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-up pb-10">
            <div className="hidden md:flex items-center justify-between px-1">
                <h1 className="text-2xl md:text-3xl font-black text-primary tracking-tight">{t.settings}</h1>
            </div>
            {isAdmin && (
                <>
                    <Section title={t.studioSettings} icon={Building2} defaultOpen={true}>
                        {/* Logo */}
                        <Row label={t.logoLabel} sub={t.logoDesc}>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl overflow-hidden border border-border-subtle flex-shrink-0 bg-surface flex items-center justify-center">
                                    {settings.logoDataUrl ? (
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
                                        {t.uploadAction}
                                    </button>
                                    {settings.logoDataUrl && (
                                        <button onClick={() => setLogo(null)} className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors">
                                            {t.removeAction}
                                        </button>
                                    )}
                                </div>
                                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                            </div>
                        </Row>
                        <Row label={t.studioNameLabel} sub={t.sidebarShow}>
                            <div className="flex items-center gap-2">
                                 <input 
                                    value={nameVal} 
                                    onChange={e => {
                                        const nextName = e.target.value;
                                        setNameVal(nextName);
                                    }}
                                    onKeyDown={e => e.key === 'Enter' && saveName()} 
                                    readOnly={!isSuperAdmin}
                                    className={cn(
                                        "w-full max-w-[200px] bg-surface border border-border-subtle focus:border-indigo-500/40 rounded-xl px-3 py-2 text-xs font-medium text-primary outline-none transition-all",
                                        !isSuperAdmin && "opacity-60 cursor-not-allowed"
                                    )} 
                                />
                                {profile?.role === 'superadmin' && (
                                    <button onClick={saveName} className={cn('w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-xl transition-all', nameSaved ? 'bg-emerald-500/20 text-emerald-600' : 'bg-surface text-muted hover:bg-surface hover:text-primary border border-border-subtle')}>
                                        {nameSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                                    </button>
                                )}
                            </div>
                        </Row>
                        <Row label={t.urlSlugLabel}>
                            <div className="flex flex-col gap-2 items-end">
                                <div className="flex items-center gap-2 w-full justify-end">
                                    <span className="text-muted/40 text-[10px]">/</span>
                                    <div className="relative flex items-center gap-2 w-full max-w-[200px]">
                                        <input
                                            value={slugVal}
                                            onChange={e => setSlugVal(compactSlugify(e.target.value))}
                                            onKeyDown={e => e.key === 'Enter' && saveSlug()}
                                            placeholder="studio-slug"
                                            readOnly={profile?.role !== 'superadmin' && settings.studioSlug !== 'demo.classcore.ge'}
                                            className={cn(
                                                "w-full bg-surface border border-border-subtle focus:border-indigo-500/40 rounded-xl px-3 py-2 text-xs font-mono text-muted outline-none transition-colors",
                                                (profile?.role !== 'superadmin' && settings.studioSlug !== 'demo.classcore.ge') && "opacity-60 cursor-not-allowed"
                                            )}
                                        />
                                        {(profile?.role === 'superadmin' || settings.studioSlug === 'demo.classcore.ge' || !settings.studioSlug) && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setSlugVal(compactSlugify(nameVal || settings.studioName))}
                                                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-xl bg-surface text-muted hover:text-indigo-500 border border-border-subtle transition-all"
                                                    title={l('სახელიდან გენერირება', 'Сгенерировать из названия', 'Generate from name')}
                                                >
                                                    <RefreshCcw className="w-3.5 h-3.5" />
                                                </button>
                                                {profile?.role === 'superadmin' && settings.studioSlug && (
                                                    <button
                                                        onClick={handleReclaimSlug}
                                                        className="px-2 py-1 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-lg text-[8px] font-black tracking-widest transition-all"
                                                        title={t.reclaimName}
                                                    >
                                                        {t.reclaimAction}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={saveSlug}
                                                    disabled={!slugVal || slugVal === settings.studioSlug}
                                                    className={cn(
                                                        'w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl transition-all shadow-lg',
                                                        slugSaved ? 'bg-emerald-500 text-white' : 
                                                        (!slugVal || slugVal === settings.studioSlug) ? 'bg-surface text-muted/20 border border-border-subtle/50' :
                                                        'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95'
                                                    )}
                                                >
                                                    {slugSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Row>

                        <Row label={t.registrationLink} sub={l('სტუდენტების რეგისტრაციის ლინკი (ავტომატური დამატება)', 'Ссылка для регистрации студентов (авто-добавление)', 'Student registration link (automatic addition)')}>
                            <div className="flex items-center gap-2">
                                {slugVal ? (
                                    <>
                                        <a href={registrationUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-400 font-mono truncate max-w-[200px] transition-colors">
                                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                            <span className="truncate">/{slugVal}/registration</span>
                                        </a>
                                        <button onClick={copyRegLink} className={cn('w-8 h-8 flex items-center justify-center rounded-xl transition-all flex-shrink-0', copiedRegLink ? 'bg-emerald-500/20 text-emerald-600' : 'bg-surface text-muted hover:text-primary border border-border-subtle')}>
                                            {copiedRegLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-100 italic text-[10px] text-amber-600 font-bold uppercase tracking-widest">
                                        <AlertTriangle className="w-3 h-3" />
                                        {l('მიუთითეთ მისამართი აქტივაციისთვის', 'Укажите адрес для активации', 'Set slug to activate link')}
                                    </div>
                                )}
                            </div>
                        </Row>
                    </Section>

                    {/* ─── Staff Access ─── */}
                    <Section title={t.staffAccess} icon={Shield}>
                        <div className="p-4 space-y-4">
                            <button
                                onClick={() => setStaffModalOpen(true)}
                                className="w-full py-4 bg-indigo-600 text-white text-xs font-black rounded-2xl shadow-xl active:scale-95 transition-all tracking-widest flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                {t.addStaffAction}
                            </button>

                            {settings.staff && settings.staff.length > 0 && (
                                <div className="space-y-3">
                                    {settings.staff.map((member: any) => {
                                        return (
                                            <div key={member.id} className="bg-surface/30 rounded-3xl border border-border-subtle/30 hover:border-indigo-500/30 hover:bg-surface/50 transition-all duration-300">
                                                <div
                                                    onClick={() => setEditingStaffId(member.id)}
                                                    className="p-4 flex items-center justify-between cursor-pointer group"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-black text-lg group-hover:scale-105 transition-transform">
                                                            {getInitials(`${member.first_name} ${member.last_name}`)}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-black text-primary tracking-tight">{member.first_name} {member.last_name}</p>
                                                                <span className={cn(
                                                                    "px-2 py-0.5 rounded-lg text-[9px] font-black tracking-widest border",
                                                                    member.role === 'owner' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                                                )}>
                                                                    {member.role}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] font-bold text-muted/40 tracking-widest mt-0.5">{member.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="w-10 h-10 rounded-xl bg-surface border border-border-subtle flex items-center justify-center text-muted group-hover:text-indigo-500 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all">
                                                        <Settings2 className="w-5 h-5" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </Section>

                    <Section title={t.branchManagement} icon={Building2}>
                        <div className="p-4 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {settings.branches.map(branch => (
                                    <div key={branch.id} className="p-4 bg-surface/30 rounded-2xl border border-border-subtle/30 flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                                <Building2 className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-primary">{branch.id === 'main' ? t.mainBranch : branch.name}</p>
                                                <p className="text-[10px] text-muted font-bold tracking-widest">{branch.address || t.noAddress}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button
                                                onClick={() => {
                                                    setEditingBranchId(branch.id);
                                                    setNewBranchName(branch.name);
                                                    setNewBranchAddress(branch.address || '');
                                                    setBranchModalOpen(true);
                                                }}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg text-indigo-500/40 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            {branch.id !== 'main' && (
                                                <button
                                                    onClick={() => setBranchToDeleteId(branch.id)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => {
                                    setEditingBranchId(null);
                                    setNewBranchName('');
                                    setNewBranchAddress('');
                                    setBranchModalOpen(true);
                                }}
                                className="w-full h-14 flex items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-indigo-500/20 text-indigo-500/60 hover:text-indigo-500 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all font-black tracking-widest text-xs"
                            >
                                <Plus className="w-5 h-5" />
                                {t.addNewBranchAction}
                            </button>
                        </div>
                    </Section>
                </>
            )}

            {/* Security */}
            <Section title={t.settingsSecurity} icon={Shield}>
                {isAdmin && (
                    <Row label={t.twoFactorAuth} sub={t.twoFactorDesc}>
                        <Toggle checked={settings.security.twoFactor} onChange={v => setSecurity('twoFactor', v)} />
                    </Row>
                )}
                <Row label={t.changePasswordTitle}>
                    <button onClick={() => setShowPwdModal(true)} className="px-4 py-2 rounded-xl bg-surface border border-border-subtle text-muted hover:text-primary hover:bg-surface/80 text-xs font-medium transition-all shadow-sm">{t.editAction}</button>
                </Row>
            </Section>


            {/* Account (Merged) Section at the Bottom */}
            {isOwner && (
                <Section title={l('ანგარიში', 'Аккаунт', 'Account')} icon={User} defaultOpen={false}>
                    <Row label={l('სახელი და გვარი', 'Имя и Фаმილია', 'Full Name')} sub={l('მფლობელის სახელი და გვარი', 'Имя и фамилия владельца', 'First and last name of the studio owner')}>
                        <div className="flex gap-2">
                            <input 
                                value={settings.owner_info?.first_name || profile?.first_name || ''} 
                                onChange={e => setOwnerInfo({ first_name: e.target.value })}
                                placeholder={t.firstNameLabel}
                                readOnly={!isSuperAdmin}
                                className={cn(
                                    "w-full max-w-[120px] bg-surface border border-border-subtle focus:border-indigo-500/40 rounded-xl px-3 py-2 text-xs font-medium text-primary outline-none transition-all",
                                    !isSuperAdmin && "opacity-60 cursor-not-allowed text-muted"
                                )}
                            />
                            <input 
                                value={settings.owner_info?.last_name || profile?.last_name || ''} 
                                onChange={e => setOwnerInfo({ last_name: e.target.value })}
                                placeholder={t.lastNameLabel}
                                readOnly={!isSuperAdmin}
                                className={cn(
                                    "w-full max-w-[120px] bg-surface border border-border-subtle focus:border-indigo-500/40 rounded-xl px-3 py-2 text-xs font-medium text-primary outline-none transition-all",
                                    !isSuperAdmin && "opacity-60 cursor-not-allowed text-muted"
                                )}
                            />
                        </div>
                    </Row>
                    <Row label={t.emailLabel} sub={l('საკონტაქტო ელ-ფოსტა', 'Контактный email', 'Owner contact email')}>
                        <div className="px-3 py-2 text-xs font-medium text-muted bg-surface/50 border border-border-subtle/50 rounded-xl">
                            {settings.owner_info?.email || user?.email || 'N/A'}
                        </div>
                    </Row>
                    <Row label={t.phoneLabel} sub={l('საკონტაქტო ტელეფონი', 'Контактный телефон', 'Owner contact phone')}>
                        <input 
                            value={settings.owner_info?.phone || profile?.phone || ''} 
                            onChange={e => setOwnerInfo({ phone: e.target.value })}
                            placeholder="+995 ..."
                            readOnly={!isSuperAdmin}
                            className={cn(
                                "w-full max-w-[200px] bg-surface border border-border-subtle focus:border-indigo-500/40 rounded-xl px-3 py-2 text-xs font-medium text-primary outline-none transition-all",
                                !isSuperAdmin && "opacity-60 cursor-not-allowed text-muted text-right"
                            )}
                        />
                    </Row>
                    <Row label={l('კაბინეტის ნომერი', 'Номер кабинета', 'Cabinet Number')} sub={l('უნიკალური საიდენტიფიკაციო კოდი', 'Уникальный идентификационный код', 'Unique identification code')}>
                        <div className="flex items-center gap-2">
                            <div className="px-4 py-2 bg-surface border border-border-subtle rounded-xl text-xs font-mono font-black text-indigo-500 shadow-inner">
                                {settings.cabinetCode || '---'}
                            </div>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(settings.cabinetCode || '');
                                    addNotification(l('კოდი დაკოპირდა', 'Код скопирован', 'Code copied'), 'success');
                                }}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-surface border border-border-subtle text-muted hover:text-primary transition-all"
                            >
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </Row>
                    <Row label={l('პლატფორმის ენა', 'Язык платформы', 'Platform Language')} sub={l('თქვენი ძირითადი ენა სისტემაში', 'Ваш основной язык в системе', 'Your primary language in the system')}>
                        <LanguageSwitcher variant="landing" mode="persistent" onChange={(l) => setLanguage(l as any)} />
                    </Row>
                    <Row label={l('სისტემიდან გამოსვლა', 'Выйти из системы', 'Logout')} sub={t.logoutDesc}>
                        <button onClick={logout} className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-xs font-black transition-all group">
                            <LogOutIcon className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                            {l('გამოსვლა', 'Выйти', 'Logout')}
                        </button>
                    </Row>
                </Section>
            )}
            {/* Password Modal */}
            {showPwdModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent animate-in fade-in duration-200">
                        <div className="bg-surface border border-border-subtle rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col gap-4">
                            <h3 className="text-lg font-bold text-primary">{t.changePasswordTitle}</h3>

                            <div className="flex flex-col gap-3">
                                <div>
                                    <label className="text-xs font-medium text-muted mb-1 block">{t.newPasswordLabel}</label>
                                    <input
                                        type="password"
                                        value={pwdVal}
                                        onChange={e => setPwdVal(e.target.value)}
                                        className="w-full bg-background border border-border-subtle rounded-xl px-3 py-2 text-sm text-primary outline-none focus:border-indigo-500/40"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted mb-1 block">{t.confirmPasswordLabel}</label>
                                    <input
                                        type="password"
                                        value={pwdConfirmVal}
                                        onChange={e => setPwdConfirmVal(e.target.value)}
                                        className="w-full bg-background border border-border-subtle rounded-xl px-3 py-2 text-sm text-primary outline-none focus:border-indigo-500/40"
                                    />
                                </div>
                            </div>

                            {pwdError && <p className="text-xs font-medium text-red-500">{pwdError}</p>}
                            {pwdSuccess && <p className="text-xs font-medium text-emerald-500">{t.passwordChangeSuccess}</p>}

                            <div className="flex justify-end gap-2 mt-2">
                                <button
                                    onClick={() => { setShowPwdModal(false); setPwdError(''); setPwdVal(''); setPwdConfirmVal(''); }}
                                    className="px-4 py-2 rounded-xl text-xs font-medium text-muted hover:bg-muted/10 transition-colors">
                                    {t.cancel}
                                </button>
                                <button
                                    onClick={handleChangePassword}
                                    disabled={pwdLoading || pwdSuccess}
                                    className="px-4 py-2 rounded-xl text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-colors disabled:opacity-50">
                                    {pwdLoading ? '...' : t.saveAction}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* Branch Creation Modal */}
            {branchModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-transparent animate-in fade-in duration-200">
                    <div className="bg-card border border-border-subtle rounded-2xl w-full max-w-sm p-8 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center gap-2">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-2">
                                <Building2 className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-primary tracking-tight">
                                {editingBranchId
                                    ? t.editBranchTitle
                                    : t.addNewBranchTitle}
                            </h3>
                        </div>
                        <div className="flex flex-col gap-3">
                            <input
                                autoFocus
                                value={newBranchName}
                                onChange={e => setNewBranchName(e.target.value)}
                                placeholder={t.branchNameLabel}
                                className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                            />
                            <input
                                value={newBranchAddress}
                                onChange={e => setNewBranchAddress(e.target.value)}
                                placeholder={t.addressLabel}
                                className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                            />
                        </div>

                        <div className="p-8 border-t border-border-subtle/30 bg-surface/30 flex gap-4">
                            <button
                                onClick={() => setBranchModalOpen(false)}
                                className="flex-1 py-4 text-xs font-black text-muted hover:bg-surface rounded-2xl transition-all"
                            >
                                {t.cancel}
                            </button>
                            <button
                                onClick={() => {
                                    if (!newBranchName.trim()) return;
                                    if (editingBranchId) {
                                        updateBranch(editingBranchId, { name: newBranchName.trim(), address: newBranchAddress.trim() });
                                    } else {
                                        addBranch(newBranchName.trim(), newBranchAddress.trim());
                                    }
                                    setBranchModalOpen(false);
                                    setEditingBranchId(null);
                                    setNewBranchName('');
                                    setNewBranchAddress('');
                                }}
                                className="flex-[2] py-4 bg-indigo-600 text-white text-xs font-black rounded-2xl shadow-xl active:scale-95 transition-all tracking-widest"
                            >
                                {editingBranchId ? t.save : t.add}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Add Staff Modal ─── */}
            {staffModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-transparent p-4 animate-in fade-in duration-200">
                    <div className="bg-card border border-border-subtle w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        <div className="px-8 py-6 border-b border-border-subtle/30 flex items-center justify-between bg-surface/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-500">
                                    <UserCircle className="w-5 h-5" />
                                </div>
                                <h3 className="text-xl font-black text-primary tracking-tight">{t.newStaffMember}</h3>
                            </div>
                            <button onClick={() => setStaffModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-surface text-muted transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-muted tracking-widest ml-1">{t.firstNameLabel}</label>
                                    <input
                                        value={newStaff.first_name}
                                        onChange={e => setNewStaff({ ...newStaff, first_name: e.target.value })}
                                        placeholder="John"
                                        className="w-full bg-surface border border-border-subtle rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-muted tracking-widest ml-1">{t.lastNameLabel}</label>
                                    <input
                                        value={newStaff.last_name}
                                        onChange={e => setNewStaff({ ...newStaff, last_name: e.target.value })}
                                        placeholder="Doe"
                                        className="w-full bg-surface border border-border-subtle rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-muted tracking-widest ml-1 flex items-center gap-2 text-indigo-500">
                                    <Shield className="w-3 h-3" /> {t.assignAccess}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { k: 'canViewAttendance', l: t.attendance },
                                        { k: 'canViewSubscriptions', l: t.subscriptions },
                                        { k: 'canViewStudents', l: t.students },
                                        { k: 'canViewCalendar', l: t.calendar },
                                        { k: 'canEditCalendar', l: t.edit },
                                        { k: 'canViewGroups', l: t.groups },
                                        { k: 'canViewTeachers', l: t.teachers },
                                        { k: 'canViewHalls', l: t.halls },
                                        { k: 'canViewShop', l: t.hallRental },
                                        { k: 'canViewAnalytics', l: t.analytics },
                                        { k: 'canViewSMS', l: 'SMS' },
                                    ].map(({ k, l: label }) => {
                                        const val = (newStaff.permissions as any)[k];
                                        return (
                                            <label key={k} className={cn(
                                                "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all",
                                                val ? "bg-indigo-500/10 border-indigo-500/30" : "bg-surface border-border-subtle opacity-60"
                                            )}>
                                                <input
                                                    type="checkbox"
                                                    checked={!!val}
                                                    onChange={() => {
                                                        setNewStaff({
                                                            ...newStaff,
                                                            permissions: { ...newStaff.permissions, [k]: !val }
                                                        } as any);
                                                    }}
                                                    className="sr-only"
                                                />
                                                <div className={cn('w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all',
                                                    val ? 'bg-indigo-500 border-indigo-500 shadow-sm' : 'border-border-subtle bg-card')}>
                                                    {val && <Check className="w-2.5 h-2.5 text-white" strokeWidth={5} />}
                                                </div>
                                                <span className="text-[11px] font-bold truncate">{label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-muted tracking-widest ml-1">{t.accessLevelLabel}</label>
                                    <SearchSelect
                                        options={[
                                            { value: 'manager', label: t.managerRole },
                                            { value: 'teacher', label: t.teacherRole },
                                            { value: 'receptionist', label: t.receptionistRole },
                                            { value: 'accountant', label: t.accountantRole },
                                        ]}
                                        value={newStaff.role}
                                        onChange={val => setNewStaff({ ...newStaff, role: val })}
                                        className="!border-border-subtle hover:!border-indigo-500/40"
                                    />
                                </div>
                                <div className="space-y-1.5 opacity-60">
                                    <label className="text-[10px] font-black text-muted tracking-widest ml-1">{t.studentStatus}</label>
                                    <div className="w-full bg-surface/50 border border-border-subtle rounded-2xl px-5 py-3.5 text-xs font-bold flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        {t.active}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-muted tracking-widest ml-1">{t.emailLabel}</label>
                                    <input
                                        value={newStaff.email}
                                        onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
                                        placeholder="john@example.com"
                                        className="w-full bg-surface border border-border-subtle rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-muted tracking-widest ml-1">{t.password}</label>
                                    <input
                                        type="password"
                                        value={newStaff.password}
                                        onChange={e => setNewStaff({ ...newStaff, password: e.target.value })}
                                        placeholder="••••••••"
                                        className="w-full bg-surface border border-border-subtle rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-muted tracking-widest ml-1 flex items-center gap-2">
                                    <Building2 className="w-3 h-3" /> {t.calendar + ' ' + t.halls}
                                </label>
                                <div className="space-y-2">
                                    {settings.branches.map(b => {
                                        const allowed = newStaff.allowedBranchIds.length === 0 || newStaff.allowedBranchIds.includes(b.id);
                                        return (
                                            <label key={b.id} className={cn('flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all shadow-sm',
                                                allowed ? 'bg-indigo-500/5 border-indigo-500/40' : 'bg-surface/50 border-border-subtle opacity-60')}>
                                                <input
                                                    type="checkbox"
                                                    checked={allowed}
                                                    onChange={() => {
                                                        const current = newStaff.allowedBranchIds || [];
                                                        let next: string[];
                                                        if (current.length === 0) {
                                                            // If currently All (empty), and we uncheck one, include all EXCEPT this one
                                                            next = settings.branches.filter(br => br.id !== b.id).map(br => br.id);
                                                        } else {
                                                            if (current.includes(b.id)) {
                                                                next = current.filter(id => id !== b.id);
                                                            } else {
                                                                next = [...current, b.id];
                                                            }
                                                        }
                                                        // Final cleanup: if everything is checked, reset to empty (All)
                                                        if (next.length === settings.branches.length) {
                                                            next = [];
                                                        }
                                                        setNewStaff({ ...newStaff, allowedBranchIds: next });
                                                    }}
                                                    className="sr-only"
                                                />
                                                <div className={cn('w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all',
                                                    allowed ? 'bg-indigo-500 border-indigo-500 shadow-md' : 'border-border-subtle bg-card')}>
                                                    {allowed && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                                                </div>
                                                <span className={cn('text-sm font-bold', allowed ? 'text-primary' : 'text-muted')}>{b.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t border-border-subtle/30 bg-surface/30 flex gap-4">
                            <button
                                onClick={() => setStaffModalOpen(false)}
                                className="flex-1 py-4 text-xs font-black text-muted hover:bg-surface rounded-2xl transition-all"
                            >
                                {l('გაუქმება', 'Отмена', 'Cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    if (!newStaff.first_name || !newStaff.email) return;
                                    addStaff({
                                        ...newStaff,
                                        full_name: `${newStaff.first_name} ${newStaff.last_name}`.trim(),
                                        phone: '', // Optional for now
                                        status: 'active'
                                    } as any);
                                    setStaffModalOpen(false);
                                    // Reset
                                    setNewStaff({
                                        first_name: '',
                                        last_name: '',
                                        role: 'teacher',
                                        email: '',
                                        password: '',
                                        permissions: {
                                            canViewAttendance: true,
                                            canViewSubscriptions: false,
                                            canViewStudents: true,
                                            canViewCalendar: true,
                                            canEditCalendar: false,
                                            canViewGroups: true,
                                            canViewTeachers: true,
                                            canViewHalls: false,
                                            canViewShop: false,
                                            canViewAnalytics: false,
                                            canViewSMS: false,
                                        },
                                        allowedBranchIds: []
                                    });
                                }}
                                className="flex-[2] py-4 bg-indigo-600 text-white text-xs font-black rounded-2xl shadow-xl active:scale-95 transition-all tracking-widest"
                            >
                                {t.add}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Edit Staff Access Modal ─── */}
            {editingStaffId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-transparent p-4 animate-in fade-in duration-200">
                    <div className="bg-card border border-border-subtle w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        {(() => {
                            const member = editingStaffData;
                            if (!member) return null;

                            const handleLocalUpdate = (patch: any) => {
                                setEditingStaffData({ ...member, ...patch });
                            };

                            const handleSave = () => {
                                updateStaff(member.id, member);
                                setEditingStaffId(null);
                            };

                            return (
                                <>
                                    <div className="px-8 py-6 border-b border-border-subtle/30 flex items-center justify-between bg-surface/30">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-black text-lg">
                                                {getInitials(`${member.first_name} ${member.last_name}`)}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-primary tracking-tight">{member.first_name} {member.last_name}</h3>
                                                <p className="text-[10px] font-bold text-muted tracking-widest opacity-40">{member.email}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setEditingStaffId(null)} className="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-surface text-muted transition-all">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                                        {/* Basic Info */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-muted tracking-widest ml-1">{t.firstNameLabel}</label>
                                                <input
                                                    value={member.first_name}
                                                    onChange={e => handleLocalUpdate({ first_name: e.target.value })}
                                                    className="w-full bg-surface border border-border-subtle rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-muted tracking-widest ml-1">{t.lastNameLabel}</label>
                                                <input
                                                    value={member.last_name || ''}
                                                    onChange={e => handleLocalUpdate({ last_name: e.target.value })}
                                                    className="w-full bg-surface border border-border-subtle rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-muted tracking-widest ml-1">{t.emailLabel}</label>
                                            <input
                                                value={member.email}
                                                onChange={e => handleLocalUpdate({ email: e.target.value })}
                                                className="w-full bg-surface border border-border-subtle rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                                            />
                                        </div>
                                        {/* Role Selection */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-muted tracking-widest ml-1">{l('წვდომის დონე (როლი)', 'Уровень доступа (Роль)', 'Access Level (Role)')}</label>
                                            <SearchSelect
                                                options={[
                                                    { value: 'owner', label: l('მფლობელი', 'Владелец', 'Owner') },
                                                    { value: 'admin', label: l('ადმინისტრატორი', 'Администратор', 'Admin') },
                                                    { value: 'manager', label: l('მენეჯერი', 'Менеджер', 'Manager') },
                                                    { value: 'teacher', label: l('მასწავლებელი', 'Учитель', 'Teacher') },
                                                    { value: 'receptionist', label: l('რეცეფშენი', 'Ресепшн', 'Receptionist') },
                                                    { value: 'accountant', label: l('ბუღალტერი', 'Бухгалтер', 'Accountant') },
                                                ]}
                                                value={member.role}
                                                onChange={val => handleLocalUpdate({ role: val })}
                                                className="!border-border-subtle hover:!border-indigo-500/40"
                                            />
                                        </div>

                                        {/* Permissions Toggles */}
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-muted tracking-widest ml-1 flex items-center gap-2 text-indigo-500">
                                                <Shield className="w-3 h-3" /> {t.featureAccess}
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    { k: 'canViewAttendance', l: l('დასწრება', 'Посещаемость', 'Attendance') },
                                                    { k: 'canViewSubscriptions', l: l('აბონემენტები', 'Абонементы', 'Subscriptions') },
                                                    { k: 'canViewStudents', l: l('სტუდენტები', 'Сტუდენტები', 'Students') },
                                                    { k: 'canViewCalendar', l: l('კალენდარი', 'Календарь', 'Calendar') },
                                                    { k: 'canEditCalendar', l: l('კალენდრის ედიტი', 'Ред. календаря', 'Edit Calendar') },
                                                    { k: 'canViewGroups', l: l('ჯგუფები', 'Группы', 'Groups') },
                                                    { k: 'canViewTeachers', l: l('მასწავლებლები', 'Учителя', 'Teachers') },
                                                    { k: 'canViewHalls', l: l('დარბაზები', 'Залы', 'Halls') },
                                                    { k: 'canViewShop', l: l('მაღაზია', 'Магазин', 'Shop') },
                                                    { k: 'canViewAnalytics', l: l('ანალიტიკა', 'Аналитика', 'Analytics') },
                                                    { k: 'canViewSMS', l: l('SMS', 'SMS', 'SMS') },
                                                ].map(({ k, l: label }) => {
                                                    const val = (member.permissions as any)?.[k];
                                                    return (
                                                        <label key={k} className={cn(
                                                            "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all",
                                                            val ? "bg-indigo-500/10 border-indigo-500/30 font-bold" : "bg-surface border-border-subtle opacity-60"
                                                        )}>
                                                            <input
                                                                type="checkbox"
                                                                checked={!!val}
                                                                onChange={() => {
                                                                    const next = { ...(member.permissions || {}), [k]: !val };
                                                                    handleLocalUpdate({ permissions: next });
                                                                }}
                                                                className="sr-only"
                                                            />
                                                            <div className={cn('w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all',
                                                                val ? 'bg-indigo-500 border-indigo-500 shadow-sm' : 'border-border-subtle bg-card')}>
                                                                {val && <Check className="w-2.5 h-2.5 text-white" strokeWidth={5} />}
                                                            </div>
                                                            <span className="text-[11px] truncate">{label}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Branch Access */}
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-muted tracking-widest ml-1 flex items-center gap-2">
                                                <Building2 className="w-3 h-3" /> {t.branchAccessRestrictions}
                                            </label>
                                            <div className="grid grid-cols-1 gap-2">
                                                {settings.branches.map(branch => {
                                                    const isAllowed = !member.allowedBranchIds || member.allowedBranchIds.length === 0 || member.allowedBranchIds.includes(branch.id);
                                                    return (
                                                        <label
                                                            key={branch.id}
                                                            className={cn(
                                                                "flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all shadow-sm",
                                                                isAllowed
                                                                    ? "bg-indigo-500/5 border-indigo-500/30"
                                                                    : "bg-surface border-border-subtle opacity-60"
                                                            )}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isAllowed}
                                                                onChange={() => {
                                                                    const current = member.allowedBranchIds || [];
                                                                    let next: string[];
                                                                    if (current.length === 0) {
                                                                        // If currently All (empty), and we uncheck one, include all EXCEPT this one
                                                                        next = settings.branches.filter(br => br.id !== branch.id).map(br => br.id);
                                                                    } else {
                                                                        if (current.includes(branch.id)) {
                                                                            next = current.filter((id: string) => id !== branch.id);
                                                                            // If we just removed the last one, it becomes empty (which means All again)
                                                                            // But maybe the user wanted "None"? Usually login requires at least one.
                                                                        } else {
                                                                            next = [...current, branch.id];
                                                                        }
                                                                    }
                                                                    // Final cleanup: if everything is checked, reset to empty (All)
                                                                    if (next.length === settings.branches.length) {
                                                                        next = [];
                                                                    }
                                                                    handleLocalUpdate({ allowedBranchIds: next });
                                                                }}
                                                                className="sr-only"
                                                            />
                                                            <div className={cn('w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all',
                                                                isAllowed ? 'bg-indigo-500 border-indigo-500 shadow-md' : 'border-border-subtle bg-card')}>
                                                                {isAllowed && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className={cn("text-sm font-bold", isAllowed ? "text-primary" : "text-muted")}>{branch.name}</p>
                                                                {branch.address && <p className="text-[10px] text-muted opacity-40">{branch.address}</p>}
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Dangerous Actions */}
                                        {member.role !== 'owner' && (
                                            <div className="pt-4 border-t border-border-subtle/30">
                                                <button
                                                    onClick={async () => {
                                                        const ok = await confirm({
                                                            title: l('წაშლა', 'Удалить', 'Delete Staff Member'),
                                                            message: l('ნამდვილად გსურთ პერსონალის წაშლა?', 'Вы уверены, что хотите удалить сотрудника?', 'Are you sure you want to remove this staff member?'),
                                                            danger: true
                                                        });
                                                        if (ok) {
                                                            removeStaff(member.id);
                                                            setEditingStaffId(null);
                                                        }
                                                    }}
                                                    className="w-full py-3 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-[10px] font-black tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    {l('პერსონალის წაშლა', 'Удалить сотрудника', 'Remove Staff Member')}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-8 border-t border-border-subtle/30 bg-surface/30 flex gap-4">
                                        <button
                                            onClick={() => setEditingStaffId(null)}
                                            className="flex-1 py-4 text-xs font-black text-muted hover:bg-surface rounded-2xl transition-all"
                                        >
                                            {l('გაუქმება', 'Отмена', 'Cancel')}
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            className="flex-[2] py-4 bg-indigo-600 text-white text-xs font-black rounded-2xl shadow-xl active:scale-95 transition-all tracking-widest flex items-center justify-center gap-2"
                                        >
                                            <Save className="w-4 h-4" />
                                            {l('შენახვა', 'Сохранить', 'Save')}
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
                                         {/* ─── Branch Delete Verify Modal ─── */}
            {branchToDeleteId && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-transparent p-4 animate-in fade-in duration-200">
                    <div className="bg-card border border-border-subtle w-full max-w-sm rounded-2xl shadow-2xl p-8 flex flex-col gap-6 animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center gap-2">
                            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 mb-2">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-primary tracking-tight">{l('ფილიალის წაშლა', 'Удалить филиал', 'Delete Branch')}</h3>
                            <p className="text-[10px] font-bold text-muted opacity-60 leading-relaxed px-4">
                                {l('ფილიალის წასაშლელად შეიყვანეთ ადმინისტრატორის პაროლი დასადასტურებლად.', 'Для удаления филиала введите пароль администратора для подтверждения.', 'To delete the branch, enter the admin password to confirm.')}
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted tracking-widest ml-1">{l('ადმინისტრატორის პაროლი', 'Пароль администратора', 'Admin Password')}</label>
                                <input
                                    type="password"
                                    autoFocus
                                    value={branchDeletePass}
                                    onChange={e => {
                                        setBranchDeletePass(e.target.value);
                                        setBranchDeleteError('');
                                    }}
                                    placeholder="••••••••"
                                    className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-rose-500/50 transition-all shadow-inner"
                                />
                            </div>
                            {branchDeleteError && <p className="text-[10px] font-black text-rose-500 text-center tracking-widest">{branchDeleteError}</p>}
                        </div>

                        <div className="p-8 border-t border-border-subtle/30 bg-surface/30 flex gap-4">
                            <button
                                onClick={() => {
                                    setBranchToDeleteId(null);
                                    setBranchDeletePass('');
                                    setBranchDeleteError('');
                                }}
                                className="flex-1 py-4 text-xs font-black text-muted hover:bg-surface rounded-2xl transition-all"
                            >
                                {t.cancel}
                            </button>
                            <button
                                disabled={!branchDeletePass || isDeletingBranch}
                                onClick={async () => {
                                    setIsDeletingBranch(true);
                                    try {
                                        const supabase = createClient();
                                        const { error } = await supabase.auth.signInWithPassword({
                                            email: user?.email || '',
                                            password: branchDeletePass
                                        });

                                        if (error) {
                                            setBranchDeleteError(t.incorrectPassword);
                                            setIsDeletingBranch(false);
                                            return;
                                        }

                                        removeBranch(branchToDeleteId!);
                                        setBranchToDeleteId(null);
                                        setBranchDeletePass('');
                                        setBranchDeleteError('');
                                        addNotification(l('ფილიალი წარმატებით წაიშალა', 'Филиал успешно удален', 'Branch deleted successfully'), 'success');
                                    } catch (err) {
                                        setBranchDeleteError('Error');
                                    } finally {
                                        setIsDeletingBranch(false);
                                    }
                                }}
                                className="flex-[2] py-4 bg-rose-600 text-white text-xs font-black rounded-2xl shadow-xl active:scale-95 transition-all tracking-widest disabled:opacity-50"
                            >
                                {isDeletingBranch ? '...' : t.delete}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Maintenance Zone */}
            {isOwner && (
                <Section title={l('მოვლა და გასუფთავება', 'Обслуживание и Очистка', 'Maintenance & Cleanup')} icon={RefreshCcw}>
                    <div className="p-6 space-y-6 bg-rose-500/[0.02]">
                        <div className="flex flex-col gap-2 bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10">
                            <div className="flex items-center gap-2 text-rose-500">
                                <AlertTriangle className="w-4 h-4" />
                                <h3 className="text-xs font-black tracking-widest">{l('საშიში ზონა', 'Опасная зона', 'Danger Zone')}</h3>
                            </div>
                            <p className="text-[10px] font-bold text-muted/60 leading-relaxed">
                                {l('მონაცემების გასუფთავება შეუქცევადი პროცესია. დარწმუნდით რომ გაქვთ სარეზერვო ასლი.', 'Очистка данных — необратимый процесс. Убедитесь, что у вас есть резервная копия.', 'Data clearing is irreversible. Ensure you have a backup.')}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { id: 'students', label: t.students, icon: User },
                                { id: 'groups', label: t.groups, icon: Building2 },
                                { id: 'calendar', label: t.calendar, icon: CalendarDays },
                                { id: 'shop', label: t.hallRental, icon: ShoppingBag },
                                { id: 'analytics', label: t.analytics, icon: BarChart2 }
                            ].map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={async () => {
                                        const ok = await confirm({
                                            title: l('მონაცემების გასუფთავება', 'Оინსტრუქცია', 'Clear Data'),
                                            message: l(`ნამდვილად გსურთ "${cat.label}" მონაცემების სრული წაშლა?`, `Вы уверены, что хотите полностью удалить данные "${cat.label}"?`, `Are you sure you want to permanently delete all data for "${cat.label}"?`),
                                            danger: true
                                        });
                                        if (ok) {
                                            const { resetStudioData } = await import('@/lib/settings-store');
                                            await resetStudioData(settings.studioSlug, { [cat.id]: true });
                                            addNotification(l('მონაცემები გასუფთავდა', 'Данные очищены', 'Data cleared'), 'success');
                                            window.location.reload();
                                        }
                                    }}
                                    className="flex items-center justify-between p-4 rounded-2xl border border-border-subtle bg-surface hover:bg-rose-500/5 hover:border-rose-500/20 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-muted/5 flex items-center justify-center text-muted group-hover:text-rose-500 group-hover:bg-rose-500/10 transition-all">
                                            <cat.icon className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-bold text-primary">{cat.label}</span>
                                    </div>
                                    <span className="text-[9px] font-black tracking-widest text-muted opacity-40 group-hover:opacity-100 group-hover:text-rose-500 transition-all">{l('გასუფთავება', 'Очистить', 'RESET')}</span>
                                </button>
                            ))}
                        </div>

                        <div className="pt-4 border-t border-border-subtle/20">
                            <div className="space-y-4">
                                <button
                                    onClick={async () => {
                                        const ok = await confirm({
                                            title: l('სტუდიის სრული გასუფთავება', 'Полная очистка студии', 'Full Studio Reset'),
                                            message: l('ეს გაასუფთავებს აბსოლუტურად ყველა მონაცემს მოსწავლეების, ჯგუფების და ფინანსების ჩათვლით. შენარჩუნდება მხოლოდ სტუდიის სახელი და პერსონალი.', 'Это очистит абсолютно все данные, включая учеников, группы и финансы. Сохранятся только название студии и персонал.', 'This will clear absolutely all data including students, groups, and finances. Only studio name and staff will be kept.'),
                                            danger: true
                                        });
                                        if (ok) {
                                            await masterStudioPurge(settings.studioSlug);
                                            addNotification(l('სტუდია სრულად გასუფთავდა', 'Студия полностью очищена', 'Studio fully reset'), 'success');
                                            window.location.reload();
                                        }
                                    }}
                                    className="w-full py-4 rounded-2xl bg-rose-500 text-white text-xs font-black tracking-[0.2em] shadow-lg shadow-rose-500/20 hover:bg-rose-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    {l('სრული გასუფთავება', 'Полный сброс', 'FULL MASTER RESET')}
                                </button>
                            </div>
                        </div>
                    </div>
                </Section>
            )}

            <div className="flex flex-col items-center justify-center gap-2 py-4">
                <div className="flex items-center justify-center text-[10px] text-muted-foreground/40 px-1 font-bold tracking-widest">
                    <span>ClassCore v2.1 · classcore.ge</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 scale-90">
                    <Zap className="w-2.5 h-2.5 text-indigo-500" />
                    <span className="text-[8px] font-black tracking-[0.3em] text-indigo-500 uppercase">System Integrity: Scorched Earth v2.1</span>
                </div>
            </div>
        </div>
    );
}
