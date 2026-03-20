'use client';

import { useState, useEffect } from 'react';
import { Building2, Power, Search, ChevronDown, ArrowUpRight, LogIn, Trash2, Edit3, Settings, AlertTriangle, Plus, Minus, Wallet, Zap, Smartphone, X, ShieldCheck } from 'lucide-react';
import { getBillingState, updateBillingState, recordPayment, getSaasReminderSms } from '@/lib/saas-billing';
import { logAction } from '@/lib/analytics';
import { getStudioRegistry, loadSettings, saveSettings } from '@/lib/settings-store';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface StudioRecord {
    slug: string; name: string; logoUrl: string | null;
    studentCount: number; subsCount: number; suspended: boolean;
    notes: string; plan: 'trial' | 'pro' | 'custom';
    nextDue: string | null; status: string; daysOverdue: number;
    ownerPhone: string; ownerEmail: string;
}

function loadStudio(slug: string): StudioRecord {
    const s = loadSettings(slug);
    const meta = (() => { try { return JSON.parse(localStorage.getItem(`cc_sa_meta_${slug}`) || '{}'); } catch { return {}; } })();
    const billing = getBillingState(slug);
    
    let studentCount = 0;
    try { const raw = localStorage.getItem(`cc_student_data_${slug}`) || localStorage.getItem('cc_student_data'); if (raw) studentCount = Object.keys(JSON.parse(raw)).length; } catch { }
    let subsCount = 0;
    try { const raw = localStorage.getItem(`cc_student_subscriptions_${slug}`) || localStorage.getItem('cc_student_subscriptions'); if (raw) Object.values(JSON.parse(raw)).forEach((subs: unknown) => { if (Array.isArray(subs)) subsCount += subs.filter((s: { status?: string }) => s.status === 'active').length; }); } catch { }
    
    const owner = s.staff.find(m => m.role === 'owner');
    
    return { 
        slug, name: s.studioName, logoUrl: s.logoDataUrl, studentCount, subsCount, 
        suspended: meta.suspended || false, notes: meta.notes || '', plan: meta.plan || 'trial',
        nextDue: billing.nextDueDate, status: billing.status, daysOverdue: billing.daysOverdue,
        ownerPhone: owner?.phone || 'N/A',
        ownerEmail: owner?.email || 'N/A'
    };
}

function saveMeta(slug: string, patch: object) {
    try { const existing = JSON.parse(localStorage.getItem(`cc_sa_meta_${slug}`) || '{}'); localStorage.setItem(`cc_sa_meta_${slug}`, JSON.stringify({ ...existing, ...patch })); } catch { }
}

const PLAN_COLORS: Record<string, string> = { 
    trial: 'bg-zinc-500/10 text-zinc-500 dark:bg-zinc-700/50 dark:text-zinc-300', 
    pro: 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border-indigo-600', 
    custom: 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 border-amber-500' 
};
const PLAN_LABELS: Record<string, string> = {
    trial: 'ტრიალი (Trial)',
    pro: 'პრო (Pro)',
    custom: 'სპეციალური'
};
const PLAN_OPTIONS = ['trial', 'pro', 'custom'] as const;

export default function StudiosPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [lang, setLang] = useState<'ka' | 'en'>('ka');
    const [studios, setStudios] = useState<StudioRecord[]>([]);
    const [search, setSearch] = useState('');
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [editingNote, setEditingNote] = useState<string | null>(null);
    const [noteVal, setNoteVal] = useState('');
    const [editingProfile, setEditingProfile] = useState<StudioRecord | null>(null);
    const [profileName, setProfileName] = useState('');
    const [profileSlug, setProfileSlug] = useState('');
    const [profileEmail, setProfileEmail] = useState('');
    const [profilePhone, setProfilePhone] = useState('');
    const [profileLogo, setProfileLogo] = useState('');

    // Custom Modal State
    const [modal, setModal] = useState<{
        type: 'confirm' | 'input' | 'alert' | 'sms' | null,
        title: string,
        message: string,
        inputVal?: string,
        onConfirm?: (val?: string) => void,
        loading?: boolean
    }>({ type: null, title: '', message: '' });

    const loadData = () => { setStudios(getStudioRegistry().map(loadStudio)); };
    useEffect(() => { 
        setMounted(true);
        loadData(); 
        const storedLang = localStorage.getItem('cc_sa_lang') as 'ka' | 'en';
        if (storedLang) setLang(storedLang);
    }, []);

    const toggleSuspend = (slug: string) => {
        const studio = studios.find(s => s.slug === slug);
        if (!studio) return;
        const next = !studio.suspended;
        saveMeta(slug, { suspended: next });
        setStudios(prev => prev.map(s => s.slug === slug ? { ...s, suspended: next } : s));
    };

    const setPlan = (slug: string, plan: string) => {
        const currentMeta = JSON.parse(localStorage.getItem(`cc_sa_meta_${slug}`) || '{}');
        const oldPlan = currentMeta.plan || 'trial';
        
        saveMeta(slug, { plan });
        setStudios(prev => prev.map(s => s.slug === slug ? { ...s, plan: plan as StudioRecord['plan'] } : s));
        setOpenMenu(null);

        // If switching FROM trial TO a paid plan, also trigger a manual activation/payment record
        if (oldPlan === 'trial' && plan !== 'trial') {
            setModal({
                type: 'confirm',
                title: lang === 'ka' ? 'გეგმის შეცვლა' : 'Change Plan',
                message: lang === 'ka' 
                    ? `სტუდია "${slug}" გადადის ფასიან გეგმაზე (${plan.toUpperCase()}). გსურთ საწყისი გადახდის დაფიქსირება და მომსახურების გააქტიურება?`
                    : `Studio "${slug}" is being moved from Trial to ${plan.toUpperCase()}. Record an initial payment and activate subscription?`,
                onConfirm: () => {
                    recordPayment(slug, 'cash', 49, 1);
                    loadData();
                    setModal({ type: null, title: '', message: '' });
                }
            });
        }
    };

    const saveNote = (slug: string) => {
        saveMeta(slug, { notes: noteVal });
        setStudios(prev => prev.map(s => s.slug === slug ? { ...s, notes: noteVal } : s));
        setEditingNote(null);
    };

    const impersonate = (slug: string) => {
        logAction('studio_impersonate', slug);
        localStorage.setItem('cc_sa_impersonate', slug);
        localStorage.setItem('cc_active_studio_slug', slug);
        router.push('/dashboard');
    };

    const updateBalance = (slug: string, delta: number) => {
        const state = getBillingState(slug);
        const current = state.accountBalance || 0;
        updateBillingState(slug, { accountBalance: Math.max(0, current + delta) });
        loadData(); // refresh list
    };

    const manualActivate = (slug: string) => {
        setModal({
            type: 'confirm',
            title: lang === 'ka' ? 'მექანიკური გააქტიურება' : 'Manual Activation',
            message: lang === 'ka'
                ? `ნამდვილად გსურთ 49₾ გადახდის დაფიქსირება სტუდიისთვის "${slug}" და ვადის 30 დღით გაგრძელება?`
                : `Manually record a 49 GEL payment for "${slug}" and extend subscription by 30 days?`,
            onConfirm: () => {
                recordPayment(slug, 'cash', 49, 1);
                loadData();
                setModal({ type: null, title: '', message: '' });
            }
        });
    };

    const sendReminder = (studio: StudioRecord) => {
        if (studio.ownerPhone === 'N/A') {
            setModal({
                type: 'alert',
                title: lang === 'ka' ? 'შეცდომა' : 'Error',
                message: lang === 'ka' ? 'მფლობელის ნომერი არ არის მითითებული.' : 'No owner phone number found.'
            });
            return;
        }

        const text = getSaasReminderSms('ka', 0);
        setModal({
            type: 'sms',
            title: lang === 'ka' ? 'სმს შეხსენება' : 'SMS Reminder',
            message: studio.ownerPhone,
            inputVal: text,
            onConfirm: async (composedText) => {
                setModal(m => ({ ...m, loading: true }));
                try {
                    const res = await fetch('/api/sms/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ to: studio.ownerPhone.replace(/\s/g, ''), text: composedText, studentName: 'Admin' })
                    });
                    if (res.ok) {
                        setModal({ type: 'alert', title: lang === 'ka' ? 'წარმატება' : 'Success', message: lang === 'ka' ? 'შეხსენება გაიგზავნა!' : 'Reminder sent!' });
                    } else {
                        setModal({ type: 'alert', title: lang === 'ka' ? 'შეცდომა' : 'Error', message: lang === 'ka' ? 'SMS-ის გაგზავნა ვერ მოხერხდა.' : 'Failed to send SMS.' });
                    }
                } catch {
                    setModal({ type: 'alert', title: lang === 'ka' ? 'შეცდომა' : 'Error', message: lang === 'ka' ? 'ქსელური შეცდომა.' : 'Network error.' });
                }
            }
        });
    };

    const deleteStudio = (slug: string) => {
        setModal({
            type: 'confirm',
            title: lang === 'ka' ? 'სტუდიის წაშლა' : 'Delete Studio',
            message: lang === 'ka'
                ? `ნამდვილად გსურთ სტუდიის "${slug}" სრულად წაშლა? ეს ქმედება შეუქცევადია და ყველა მონაცემი გაინადგურდება!`
                : `Are you sure you want to completely delete the studio "${slug}"? This action cannot be undone.`,
            onConfirm: () => {
                const list = getStudioRegistry().filter(s => s !== slug);
                localStorage.setItem('cc_studios_list', JSON.stringify(list));
                Object.keys(localStorage).forEach(key => {
                    if (key.endsWith(`_${slug}`)) localStorage.removeItem(key);
                });
                loadData();
                setModal({ type: null, title: '', message: '' });
            }
        });
    };

    const saveProfile = () => {
        if (!editingProfile) return;
        const oldSlug = editingProfile.slug;

        if (oldSlug !== profileSlug) {
            Object.keys(localStorage).forEach(key => {
                if (key.endsWith(`_${oldSlug}`)) {
                    const newKey = key.replace(`_${oldSlug}`, `_${profileSlug}`);
                    localStorage.setItem(newKey, localStorage.getItem(key) || '');
                    localStorage.removeItem(key);
                }
            });
            const list = getStudioRegistry().filter(s => s !== oldSlug);
            list.push(profileSlug);
            localStorage.setItem('cc_studios_list', JSON.stringify(list));
        }

        // Update settings record
        const settingsRaw = localStorage.getItem(`cc_studio_settings_${profileSlug}`);
        try {
            const settings = settingsRaw ? JSON.parse(settingsRaw) : { staff: [] };
            settings.studioName = profileName;
            settings.studioSlug = profileSlug;
            settings.logoDataUrl = profileLogo;
            
            // Update owner staff details if found
            const owner = settings.staff?.find((m: any) => m.role === 'owner');
            if (owner) {
                owner.email = profileEmail;
                owner.phone = profilePhone;
            }
            
            localStorage.setItem(`cc_studio_settings_${profileSlug}`, JSON.stringify(settings));
        } catch { }

        setEditingProfile(null);
        loadData();
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setProfileLogo(reader.result as string);
        reader.readAsDataURL(file);
    };

    const filtered = studios.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.slug.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-6 animate-fade-up">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black text-primary tracking-tight">{lang === 'ka' ? 'სტუდიები' : 'Studios'}</h1>
                    <p className="text-sm text-muted mt-1">{studios.length} {lang === 'ka' ? 'რეგისტრირებული სტუდია' : 'registered studios'}</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted opacity-40" />
                    <input 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        placeholder={lang === 'ka' ? 'ძიება...' : 'Search studios...'} 
                        className="bg-black/5 border border-black/5 dark:border-border-subtle rounded-2xl pl-10 pr-4 py-3 text-sm text-primary dark:text-white placeholder:text-muted outline-none focus:border-indigo-500/50 w-72 shadow-sm transition-all" 
                    />
                </div>
            </div>

            <div className="bg-white/95 border border-black/10 dark:border-border-subtle rounded-[2.5rem] shadow-sm">
                <div className="grid grid-cols-[1.5fr_0.8fr_1fr_1fr_1fr_1fr_0.8fr_auto] gap-4 px-8 py-5 border-b border-black/5 dark:border-border-subtle/50 text-[10px] font-black text-muted uppercase tracking-widest bg-black/[0.02] dark:bg-zinc-500/5">
                    <span>{lang === 'ka' ? 'სტუდია' : 'Studio'}</span>
                    <span className="text-center">{lang === 'ka' ? 'მოსწავლეები' : 'Students'}</span>
                    <span className="text-center">{lang === 'ka' ? 'გეგმა' : 'Plan'}</span>
                    <span className="text-center">{lang === 'ka' ? 'დარჩენილია' : 'Days Left'}</span>
                    <span className="text-center">{lang === 'ka' ? 'ბალანსი' : 'Balance'}</span>
                    <span className="text-center">{lang === 'ka' ? 'სტატუსი' : 'Status'}</span>
                    <span />
                    <span />
                </div>
                {filtered.length === 0 ? (
                    <div className="py-24 text-center text-muted">
                        <Building2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="text-sm font-black uppercase tracking-[0.2em]">{lang === 'ka' ? 'სტუდიები არ მოიძებნა' : 'No studios found'}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border-subtle/50">
                        {filtered.map(studio => {
                            const diffDays = studio.nextDue ? Math.ceil((new Date(studio.nextDue).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : 0;
                            return (
                                <div key={studio.slug} className="group border-b border-black/5 dark:border-border-subtle/30 last:border-0 hover:bg-black/[0.01] dark:hover:bg-zinc-500/2">
                                    <div className="grid grid-cols-[1.5fr_0.8fr_1fr_1fr_1fr_1fr_0.8fr_auto] gap-4 items-center px-8 py-5 transition-colors">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-11 h-11 rounded-2xl overflow-hidden flex-shrink-0 bg-black/5 dark:bg-surface flex items-center justify-center border border-black/5 dark:border-border-subtle shadow-inner group-hover:border-indigo-500/30 transition-all">
                                                {studio.logoUrl ? <img src={studio.logoUrl} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-5 h-5 text-zinc-300 opacity-40" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-primary dark:text-white truncate flex items-center gap-2">
                                                    {studio.name}
                                                    {studio.studentCount > 150 && <span title="High Activity"><AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" /></span>}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                     <p className="text-[10px] text-muted font-mono uppercase tracking-tighter">/{studio.slug}</p>
                                                     <div className="h-1 w-1 rounded-full bg-zinc-700 opacity-30" />
                                                     <p className="text-[10px] text-zinc-500 font-bold">{studio.ownerPhone}</p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="text-center">
                                            <span className="text-sm font-black text-primary dark:text-white tabular-nums">{studio.studentCount}</span>
                                            <p className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest">{lang === 'ka' ? 'მოსწავლე' : 'students'}</p>
                                        </div>

                                        <div className="relative text-center">
                                            <button onClick={() => setOpenMenu(openMenu === studio.slug + '_plan' ? null : studio.slug + '_plan')} className={cn('px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mx-auto border transition-all hover:scale-105 active:scale-95', PLAN_COLORS[studio.plan], openMenu === studio.slug + '_plan' ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : 'border-black/5')}>
                                                {PLAN_LABELS[studio.plan]}<ChevronDown className="w-3 h-3 opacity-50" />
                                            </button>
                                            {openMenu === studio.slug + '_plan' && (
                                                <div className="absolute z-[100] top-full left-1/2 -translate-x-1/2 mt-2 bg-white/95 border border-black/10 dark:border-border-subtle rounded-2xl overflow-hidden shadow-2xl min-w-[170px] animate-in slide-in-from-top-2 duration-200">
                                                    {PLAN_OPTIONS.map(p => (
                                                        <button key={p} onClick={() => setPlan(studio.slug, p)} className={cn(
                                                            'w-full px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest hover:bg-black/5 dark:hover:bg-zinc-500/10 transition-colors border-l-2', 
                                                            studio.plan === p ? 'text-indigo-500 border-indigo-500 bg-indigo-500/5' : 'text-muted border-transparent'
                                                        )}>
                                                            {PLAN_LABELS[p]}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-center">
                                            {studio.nextDue ? (
                                                <div className="flex flex-col items-center">
                                                    <span className={cn("text-sm font-black tabular-nums", diffDays <= 3 ? "text-rose-500" : "text-primary dark:text-white")}>
                                                        {diffDays} {lang === 'ka' ? 'დღე' : 'days'}
                                                    </span>
                                                    <span className="text-[8px] font-black text-muted uppercase tracking-widest opacity-40">
                                                        {new Date(studio.nextDue).toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US', { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                            ) : <span className="text-xs text-muted opacity-20">—</span>}
                                        </div>

                                        <div className="text-center">
                                            <button 
                                                onClick={() => {
                                                    const currentBal = Math.round(getBillingState(studio.slug).accountBalance || 0);
                                                    setModal({
                                                        type: 'input',
                                                        title: lang === 'ka' ? 'ბალანსის შეცვლა' : 'Adjust Balance',
                                                        message: lang === 'ka' ? `მიუთითეთ ახალი ბალანსი სტუდიისთვის ${studio.name}` : `Enter new balance for ${studio.name}`,
                                                        inputVal: String(currentBal),
                                                        onConfirm: (val) => {
                                                            const num = Number(val);
                                                            if (!isNaN(num)) {
                                                                updateBillingState(studio.slug, { accountBalance: num });
                                                                loadData();
                                                            }
                                                            setModal({ type: null, title: '', message: '' });
                                                        }
                                                    });
                                                }}
                                                className="px-4 py-2 bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 rounded-2xl hover:border-indigo-500/30 transition-all group/bal shadow-inner"
                                            >
                                                <span className="text-sm font-black text-primary dark:text-white tabular-nums group-hover/bal:text-indigo-600 dark:group-hover/bal:text-indigo-400 transition-colors">
                                                    {Math.round(getBillingState(studio.slug).accountBalance || 0)} ₾
                                                </span>
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-center">
                                            <button onClick={() => toggleSuspend(studio.slug)} className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95', studio.suspended ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20')}>
                                                <Power className="w-3.5 h-3.5" />{studio.suspended ? (lang === 'ka' ? 'შეჩერებული' : 'Blocked') : (lang === 'ka' ? 'აქტიური' : 'Active')}
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <button onClick={() => sendReminder(studio)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 text-amber-500 hover:text-white hover:bg-amber-500 hover:border-amber-500 transition-all shadow-sm" title={lang === 'ka' ? 'სმს შეხსენება' : 'Send SMS Reminder'}><Smartphone className="w-4 h-4" /></button>
                                            <button onClick={() => manualActivate(studio.slug)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 text-indigo-500 hover:text-white hover:bg-indigo-500 hover:border-indigo-500 transition-all shadow-sm" title={lang === 'ka' ? 'აქტივაცია (30 დღე)' : 'Manual Activate'}><Zap className="w-4 h-4" /></button>
                                            <button onClick={() => impersonate(studio.slug)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 text-emerald-500 hover:text-white hover:bg-emerald-500 hover:border-emerald-500 transition-all shadow-sm" title={lang === 'ka' ? 'შესვლა' : 'Impersonate'}><LogIn className="w-4 h-4" /></button>
                                            <button 
                                                onClick={() => { 
                                                    setEditingProfile(studio); 
                                                    setProfileName(studio.name); 
                                                    setProfileSlug(studio.slug);
                                                    setProfileEmail(studio.ownerEmail);
                                                    setProfilePhone(studio.ownerPhone);
                                                    setProfileLogo(studio.logoUrl || '');
                                                }} 
                                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all shadow-sm"
                                                title={lang === 'ka' ? 'მართვა' : 'Full Control'}
                                            >
                                                <Settings className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => deleteStudio(studio.slug)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 text-rose-500 hover:text-white hover:bg-rose-500 transition-all shadow-sm" title={lang === 'ka' ? 'წაშლა' : 'Delete'}><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    {(editingNote === studio.slug || studio.notes) && (
                                        <div className="px-8 pb-5 flex items-start gap-3">
                                            <div className="flex-1">
                                                {editingNote === studio.slug ? (
                                                    <div className="flex gap-2 items-center">
                                                        <input autoFocus value={noteVal} onChange={e => setNoteVal(e.target.value)} placeholder="შიდა ჩანაწერი / შენიშვნა..." className="flex-1 bg-surface border border-border-subtle rounded-2xl px-5 py-3 text-xs text-primary placeholder:text-muted outline-none focus:border-indigo-500/50 shadow-inner" />
                                                        <button onClick={() => saveNote(studio.slug)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20">{lang === 'ka' ? 'შენახვა' : 'Save'}</button>
                                                        <button onClick={() => setEditingNote(null)} className="px-6 py-3 bg-surface hover:bg-muted/10 text-muted text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-border-subtle">{lang === 'ka' ? 'გაუქმება' : 'Cancel'}</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3 group/note cursor-pointer" onClick={() => { setEditingNote(studio.slug); setNoteVal(studio.notes); }}>
                                                        <div className="px-4 py-2 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                                                            <p className="text-[10px] text-amber-600 font-bold italic flex items-center gap-2">
                                                                <Edit3 className="w-3 h-3 opacity-40" />
                                                                {studio.notes}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Full Control / Edit Profile Modal */}
            {editingProfile && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setEditingProfile(null)} />
                    <div className="relative bg-white/95 border border-black/10 dark:border-border-subtle rounded-[2.5rem] w-full max-w-lg p-10 animate-in zoom-in-95 duration-200 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar">
                        <div className="flex items-center justify-between mb-8">
                             <div>
                                <h3 className="text-2xl font-black text-primary tracking-tight">{lang === 'ka' ? 'სტუდიის მართვა' : 'Studio Management'}</h3>
                                <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-1">Full Control Panel</p>
                             </div>
                             <button onClick={() => setEditingProfile(null)} className="p-3 bg-zinc-500/10 hover:bg-zinc-500/20 text-muted rounded-2xl transition-all"><X className="w-5 h-5" /></button>
                        </div>
                        
                        <div className="space-y-6">
                            {/* Logo Section */}
                            <div className="flex items-center gap-6 p-6 bg-zinc-500/5 rounded-3xl border border-border-subtle/50">
                                <div className="w-24 h-24 rounded-[2rem] overflow-hidden bg-card border border-border-subtle shadow-xl flex-shrink-0 relative group/logo">
                                    {profileLogo ? <img src={profileLogo} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-500 font-black text-2xl">?</div>}
                                    <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 cursor-pointer transition-all">
                                        <Plus className="w-8 h-8 text-white" />
                                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                                    </label>
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1">{lang === 'ka' ? 'ლოგო' : 'Studio Logo'}</p>
                                    <p className="text-xs text-muted/60 leading-tight mb-3">{lang === 'ka' ? 'ატვირთეთ ახალი ლოგო ან შეცვალეთ არსებული. რეკომენდებულია კვადრატული ფორმა.' : 'Upload a new logo or replace the existing one. Square format recommended.'}</p>
                                    <button onClick={() => setProfileLogo('')} className="text-[10px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-widest">{lang === 'ka' ? 'ლოგოს წაშლა' : 'Remove Logo'}</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">{lang === 'ka' ? 'სტუდიის დასახელება' : 'Studio Name'}</label>
                                    <input value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-primary transition-all shadow-inner" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">{lang === 'ka' ? 'ბმული / Slug' : 'Studio Slug'}</label>
                                    <input value={profileSlug} onChange={e => setProfileSlug(e.target.value)} className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-primary transition-all shadow-inner" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">{lang === 'ka' ? 'მფლობელის მეილი' : 'Owner Email'}</label>
                                    <input value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-primary transition-all shadow-inner" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">{lang === 'ka' ? 'მფლობელის ნომერი' : 'Owner Phone'}</label>
                                    <input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-primary transition-all shadow-inner" />
                                </div>
                            </div>

                            <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl">
                                <p className="text-[10px] text-rose-600 dark:text-rose-500/70 font-bold leading-relaxed flex gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                    {lang === 'ka' 
                                        ? 'Slug-ის შეცვლა გამოიწვევს ყველა ადგილობრივი მონაცემის მიგრაციას და შეიძლება დაარღვიოს არსებული ლინკები!' 
                                        : 'Changing the slug will migrate all local storage data and break existing admin links!'}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-10">
                            <button onClick={() => setEditingProfile(null)} className="flex-1 py-4 bg-surface hover:bg-zinc-500/10 text-muted text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all border border-border-subtle">{lang === 'ka' ? 'გაუქმება' : 'Cancel'}</button>
                            <button onClick={saveProfile} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-600/30">{lang === 'ka' ? 'შენახვა' : 'Save Changes'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Global Modal */}
            {modal.type && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => !modal.loading && setModal({ type: null, title: '', message: '' })} />
                    <div className="relative bg-white/95 border border-black/10 dark:border-border-subtle rounded-[2.5rem] w-full max-w-md p-10 animate-in zoom-in-95 duration-200 shadow-2xl text-center">
                        <div className={cn(
                            "w-16 h-16 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-xl",
                            modal.type === 'confirm' ? "bg-indigo-500/10 text-indigo-500" :
                            modal.type === 'sms' ? "bg-amber-500/10 text-amber-500" :
                            modal.type === 'alert' && modal.title === 'Error' ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
                        )}>
                            {modal.type === 'sms' ? <Smartphone className="w-8 h-8" /> : 
                             modal.type === 'confirm' ? <Zap className="w-8 h-8" /> :
                             modal.type === 'alert' && modal.title === 'Error' ? <X className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
                        </div>
                        
                        <h3 className="text-xl font-black text-primary mb-2 tracking-tight uppercase tracking-widest">{modal.title}</h3>
                        
                        {modal.type === 'sms' ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 justify-center text-[10px] font-black text-muted uppercase tracking-widest mb-2">
                                    <Smartphone className="w-3 h-3" /> {modal.message}
                                </div>
                                <textarea 
                                    value={modal.inputVal} 
                                    onChange={e => setModal(m => ({ ...m, inputVal: e.target.value }))}
                                    className="w-full h-32 bg-black/5 dark:bg-surface border border-black/10 dark:border-border-subtle rounded-3xl p-5 text-sm font-bold text-primary outline-none focus:border-indigo-500/50 shadow-inner no-scrollbar"
                                />
                            </div>
                        ) : modal.type === 'input' ? (
                            <div className="space-y-4">
                                <p className="text-sm text-zinc-500 font-medium mb-4">{modal.message}</p>
                                <input 
                                    autoFocus
                                    value={modal.inputVal} 
                                    onChange={e => setModal(m => ({ ...m, inputVal: e.target.value }))}
                                    className="w-full bg-black/5 dark:bg-surface border border-black/10 dark:border-border-subtle rounded-2xl px-6 py-4 text-center text-xl font-black text-primary outline-none focus:border-indigo-500/50 shadow-inner"
                                />
                            </div>
                        ) : (
                            <p className="text-sm text-zinc-500 font-medium mb-8 leading-relaxed px-4">{modal.message}</p>
                        )}

                        <div className="flex gap-4 mt-8">
                            {modal.type === 'alert' ? (
                                <button onClick={() => setModal({ type: null, title: '', message: '' })} className="flex-1 py-4 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl">OK</button>
                            ) : (
                                <>
                                    <button disabled={modal.loading} onClick={() => setModal({ type: null, title: '', message: '' })} className="flex-1 py-4 bg-zinc-500/10 hover:bg-zinc-500/20 text-muted text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all">
                                        {lang === 'ka' ? 'გაუქმება' : 'Cancel'}
                                    </button>
                                    <button 
                                        disabled={modal.loading}
                                        onClick={() => modal.onConfirm?.(modal.inputVal)} 
                                        className={cn(
                                            "flex-1 py-4 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl",
                                            modal.type === 'sms' ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30" : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30",
                                            modal.loading && "opacity-50 cursor-wait"
                                        )}
                                    >
                                        {modal.loading ? '...' : (lang === 'ka' ? 'დადასტურება' : 'Confirm')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
