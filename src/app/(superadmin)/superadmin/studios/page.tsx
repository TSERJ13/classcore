'use client';

import { useState, useEffect } from 'react';
import { Building2, Power, Search, ChevronDown, ArrowUpRight, LogIn, Trash2, Edit3, Settings, AlertTriangle, Plus, Wallet, Zap } from 'lucide-react';
import { getBillingState, updateBillingState, recordPayment } from '@/lib/saas-billing';
import { logAction } from '@/lib/analytics';
import { getStudioRegistry, loadSettings, saveSettings } from '@/lib/settings-store';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface StudioRecord {
    slug: string; name: string; logoUrl: string | null;
    studentCount: number; subsCount: number; suspended: boolean;
    notes: string; plan: 'trial' | 'basic' | 'enterprise';
}

function loadStudio(slug: string): StudioRecord {
    const s = loadSettings(slug);
    const meta = (() => { try { return JSON.parse(localStorage.getItem(`cc_sa_meta_${slug}`) || '{}'); } catch { return {}; } })();
    let studentCount = 0;
    try { const raw = localStorage.getItem(`cc_student_data_${slug}`) || localStorage.getItem('cc_student_data'); if (raw) studentCount = Object.keys(JSON.parse(raw)).length; } catch { }
    let subsCount = 0;
    try { const raw = localStorage.getItem(`cc_student_subscriptions_${slug}`) || localStorage.getItem('cc_student_subscriptions'); if (raw) Object.values(JSON.parse(raw)).forEach((subs: unknown) => { if (Array.isArray(subs)) subsCount += subs.filter((s: { status?: string }) => s.status === 'active').length; }); } catch { }
    return { slug, name: s.studioName, logoUrl: s.logoDataUrl, studentCount, subsCount, suspended: meta.suspended || false, notes: meta.notes || '', plan: meta.plan || 'trial' };
}

function saveMeta(slug: string, patch: object) {
    try { const existing = JSON.parse(localStorage.getItem(`cc_sa_meta_${slug}`) || '{}'); localStorage.setItem(`cc_sa_meta_${slug}`, JSON.stringify({ ...existing, ...patch })); } catch { }
}

const PLAN_COLORS: Record<string, string> = { trial: 'bg-zinc-700/50 text-zinc-300', basic: 'bg-indigo-500/10 text-indigo-400', enterprise: 'bg-amber-500/10 text-amber-400' };
const PLAN_OPTIONS = ['trial', 'basic', 'enterprise'] as const;

export default function StudiosPage() {
    const router = useRouter();
    const [studios, setStudios] = useState<StudioRecord[]>([]);
    const [search, setSearch] = useState('');
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [editingNote, setEditingNote] = useState<string | null>(null);
    const [noteVal, setNoteVal] = useState('');
    const [editingProfile, setEditingProfile] = useState<StudioRecord | null>(null);
    const [profileName, setProfileName] = useState('');
    const [profileSlug, setProfileSlug] = useState('');

    const loadData = () => { setStudios(getStudioRegistry().map(loadStudio)); };
    useEffect(() => { loadData(); }, []);

    const toggleSuspend = (slug: string) => {
        const studio = studios.find(s => s.slug === slug);
        if (!studio) return;
        const next = !studio.suspended;
        saveMeta(slug, { suspended: next });
        setStudios(prev => prev.map(s => s.slug === slug ? { ...s, suspended: next } : s));
    };

    const setPlan = (slug: string, plan: string) => {
        saveMeta(slug, { plan });
        setStudios(prev => prev.map(s => s.slug === slug ? { ...s, plan: plan as StudioRecord['plan'] } : s));
        setOpenMenu(null);
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
        if (!confirm(`Manually record a 49 GEL payment for "${slug}" and extend subscription by 30 days?`)) return;
        recordPayment(slug, 'cash', 49, 1);
        loadData();
    };

    const deleteStudio = (slug: string) => {
        if (!confirm(`Are you sure you want to completely delete the studio "${slug}"? This action cannot be undone.`)) return;

        // Remove from registry
        const list = getStudioRegistry().filter(s => s !== slug);
        localStorage.setItem('cc_studios_list', JSON.stringify(list));

        // Purge local storage
        Object.keys(localStorage).forEach(key => {
            if (key.endsWith(`_${slug}`)) {
                localStorage.removeItem(key);
            }
        });

        loadData();
    };

    const saveProfile = () => {
        if (!editingProfile) return;
        const oldSlug = editingProfile.slug;

        if (oldSlug !== profileSlug) {
            // Slug changed -> Duplicate all related local storage keys
            Object.keys(localStorage).forEach(key => {
                if (key.endsWith(`_${oldSlug}`)) {
                    const newKey = key.replace(`_${oldSlug}`, `_${profileSlug}`);
                    localStorage.setItem(newKey, localStorage.getItem(key) || '');
                    localStorage.removeItem(key); // Remove old data
                }
            });
            // Update registry
            const list = getStudioRegistry().filter(s => s !== oldSlug);
            list.push(profileSlug);
            localStorage.setItem('cc_studios_list', JSON.stringify(list));
        }

        // Update studio name in settings
        const settingsRaw = localStorage.getItem(`cc_studio_settings_${profileSlug}`);
        if (settingsRaw) {
            try {
                const settings = JSON.parse(settingsRaw);
                settings.studioName = profileName;
                settings.studioSlug = profileSlug;
                localStorage.setItem(`cc_studio_settings_${profileSlug}`, JSON.stringify(settings));
            } catch { }
        }

        setEditingProfile(null);
        loadData();
    };

    const filtered = studios.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.slug.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-6 animate-fade-up">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div><h1 className="text-2xl font-black text-white tracking-tight">Studios</h1><p className="text-sm text-zinc-500 mt-1">{studios.length} registered studios</p></div>
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search studios..." className="bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 w-64" /></div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-zinc-800 text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                    <span>Studio</span><span className="text-center">Students</span><span className="text-center">Subs</span><span className="text-center">Plan</span><span className="text-center">Balance</span><span className="text-center">Status</span><span />
                </div>
                {filtered.length === 0 ? (
                    <div className="py-16 text-center text-zinc-600"><Building2 className="w-8 h-8 mx-auto mb-3 opacity-30" /><p className="text-sm font-bold">No studios found</p></div>
                ) : (
                    <div className="divide-y divide-zinc-800/50">
                        {filtered.map(studio => (
                            <div key={studio.slug} className="group">
                                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center px-6 py-4 hover:bg-zinc-800/20 transition-colors">
                                    {/* ... existing cells ... */}
                                    <div className="flex items-center gap-3 min-w-0 relative">
                                        <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800 flex items-center justify-center relative group-hover/logo:opacity-80">
                                            {studio.logoUrl ? <img src={studio.logoUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-black text-zinc-400">{studio.name.slice(0, 2).toUpperCase()}</span>}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-white truncate flex items-center gap-2">
                                                {studio.name}
                                                {studio.studentCount > 150 && (
                                                    <span title="High Activity Detected" className="animate-pulse flex items-center justify-center bg-red-500/20 text-red-500 rounded-full w-5 h-5 shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                                                        <AlertTriangle className="w-3 h-3" />
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-[10px] text-zinc-500 font-mono truncate">/{studio.slug}</p>
                                        </div>
                                    </div>
                                    <div className="text-center"><span className="text-sm font-black text-white">{studio.studentCount}</span></div>
                                    <div className="text-center"><span className="text-sm font-black text-emerald-400">{studio.subsCount}</span></div>
                                    <div className="relative text-center">
                                        <button onClick={() => setOpenMenu(openMenu === studio.slug + '_plan' ? null : studio.slug + '_plan')} className={cn('px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 mx-auto', PLAN_COLORS[studio.plan])}>
                                            {studio.plan}<ChevronDown className="w-2.5 h-2.5" />
                                        </button>
                                        {openMenu === studio.slug + '_plan' && (
                                            <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-zinc-950 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl min-w-[120px]">
                                                {PLAN_OPTIONS.map(p => (<button key={p} onClick={() => setPlan(studio.slug, p)} className={cn('w-full px-4 py-2 text-left text-xs font-bold hover:bg-zinc-800 transition-colors', studio.plan === p ? 'text-indigo-400' : 'text-zinc-400')}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1.5 group/bal">
                                            <span className="text-sm font-black text-white tabular-nums">{Math.round(getBillingState(studio.slug).accountBalance || 0)} ₾</span>
                                            <button onClick={() => updateBalance(studio.slug, 10)} className="opacity-0 group-hover/bal:opacity-100 p-1 hover:bg-indigo-500/10 text-indigo-400 rounded-lg transition-all" title="Add 10 GEL">
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-center">
                                        <button onClick={() => toggleSuspend(studio.slug)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all', studio.suspended ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20')}>
                                            <Power className="w-3 h-3" />{studio.suspended ? 'Suspended' : 'Active'}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => manualActivate(studio.slug)} title="Manual Activation (Add 30 Days)" className="w-7 h-7 flex items-center justify-center rounded-lg text-emerald-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"><Zap className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => impersonate(studio.slug)} title="Enter as Studio" className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"><LogIn className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => { setEditingProfile(studio); setProfileName(studio.name); setProfileSlug(studio.slug); }} title="Edit Name & Link" className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-amber-400 hover:bg-amber-500/10 transition-all"><Edit3 className="w-3.5 h-3.5" /></button>
                                        <a href={`/${studio.slug}/${studio.slug}`} target="_blank" className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-white hover:bg-zinc-800 transition-all"><ArrowUpRight className="w-3.5 h-3.5" /></a>
                                        <button onClick={() => { setEditingNote(studio.slug); setNoteVal(studio.notes); setOpenMenu(null); }} title="Internal Notes" className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-white hover:bg-zinc-800 transition-all text-xs font-black">N</button>
                                        <button onClick={() => deleteStudio(studio.slug)} title="Permanently Delete Studio" className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-500 hover:bg-red-500/10 transition-all ml-2"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                                {editingNote === studio.slug && (
                                    <div className="px-6 pb-4 flex gap-2 items-center">
                                        <input autoFocus value={noteVal} onChange={e => setNoteVal(e.target.value)} placeholder="Add internal note..." className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50" />
                                        <button onClick={() => saveNote(studio.slug)} className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black rounded-xl transition-all">Save</button>
                                        <button onClick={() => setEditingNote(null)} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-black rounded-xl transition-all">Cancel</button>
                                    </div>
                                )}
                                {studio.notes && editingNote !== studio.slug && <div className="px-6 pb-3"><p className="text-[10px] text-zinc-500 italic">📝 {studio.notes}</p></div>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Profile Modal */}
            {editingProfile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm shadow-2xl">
                    <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 shadow-2xl">
                        <h3 className="text-lg font-black text-white mb-4">Edit Studio Profile</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5 block">Studio Name</label>
                                <input value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-white transition-colors" />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5 block">Studio Link / Slug</label>
                                <input value={profileSlug} onChange={e => setProfileSlug(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-white transition-colors" />
                                <p className="text-[10px] text-amber-500/80 font-medium mt-2 leading-tight flex gap-1">
                                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                    Warning: Changing the slug will migrate all local storage data and break existing admin links!
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setEditingProfile(null)} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-black rounded-xl transition-all">Cancel</button>
                            <button onClick={saveProfile} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black rounded-xl transition-all">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
