'use client';

import { useState, useEffect } from 'react';
import { Users, Copy, Check, Search, MessageSquare } from 'lucide-react';
import { getStudioRegistry, loadSettings } from '@/lib/settings-store';
import { cn } from '@/lib/utils';
import { syncGlobalAdminRegistry } from '@/lib/admin-sync';

interface UserRecord { slug: string; studioName: string; logoUrl: string | null; language: string; supportNote: string; tier: string; studentCount: number; }

const LANG_FLAG: Record<string, string> = { ka: '🇬🇪', ru: '🇷🇺', en: '🇬🇧' };
const TIER_COLORS: Record<string, string> = { 
    trial: 'text-muted bg-surface border border-border-subtle', 
    starter: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20', 
    growth: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 border border-violet-500/20', 
    enterprise: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20' 
};

export default function UsersPage() {
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [search, setSearch] = useState('');
    const [lang, setLang] = useState<'ka' | 'en'>('ka');
    const [editingNote, setEditingNote] = useState<string | null>(null);
    const [noteVal, setNoteVal] = useState('');
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

    useEffect(() => { 
        setMounted(true);
        const init = async () => {
            setLoading(true);
            try {
                // DATABASE-FIRST: Always fetch from cloud
                const data = await syncGlobalAdminRegistry();
                if (data && Array.isArray(data)) {
                    const mapped: UserRecord[] = data.map((s: any) => ({
                        slug: s.slug,
                        studioName: s.name,
                        logoUrl: s.logoUrl,
                        language: s.language || 'ka',
                        supportNote: s.supportNote || '',
                        tier: s.plan || 'trial',
                        studentCount: s.studentCount || 0
                    }));
                    setUsers(mapped); 
                }
            } catch (err) {
                console.error('Failed to sync users:', err);
                setUsers([]);
            } finally {
                setLoading(false);
            }
            
            const storedLang = localStorage.getItem('cc_sa_lang') as 'ka' | 'en';
            if (storedLang) setLang(storedLang);
        };
        init();
    }, []);

    const filtered = users.filter(u => u.studioName.toLowerCase().includes(search.toLowerCase()) || u.slug.toLowerCase().includes(search.toLowerCase()));

    const saveNote = (slug: string) => {
        try { const existing = JSON.parse(localStorage.getItem(`cc_sa_meta_${slug}`) || '{}'); localStorage.setItem(`cc_sa_meta_${slug}`, JSON.stringify({ ...existing, supportNote: noteVal })); } catch { }
        setUsers(prev => prev.map(u => u.slug === slug ? { ...u, supportNote: noteVal } : u));
        setEditingNote(null);
        
        // Also sync to cloud for persistence
        syncGlobalAdminRegistry();
    };

    const copySlug = (slug: string) => { animatorClipboardCopy(slug); setCopiedSlug(slug); setTimeout(() => setCopiedSlug(null), 2000); };
    
    const animatorClipboardCopy = (text: string) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        }
    };

    if (!mounted) return null;

    return (
        <div className="space-y-6 animate-fade-up">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black text-primary tracking-tight">{lang === 'ka' ? 'მომხმარებლები და მხარდაჭერა' : 'Users & Support'}</h1>
                    <p className="text-sm text-muted mt-1">{lang === 'ka' ? 'სტუდიის ანგარიშები და მხარდაჭერის ჩანაწერები' : 'Studio accounts and support notes'}</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted opacity-40" />
                    <input 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        placeholder={lang === 'ka' ? 'ძიება...' : 'Search...'} 
                        className="bg-black/5 dark:bg-card border border-black/5 dark:border-border-subtle rounded-2xl pl-10 pr-4 py-3 text-sm text-primary dark:text-white placeholder:text-muted outline-none focus:border-indigo-500/50 w-64 shadow-sm transition-all" 
                    />
                </div>
            </div>

            {loading ? (
                <div className="py-24 flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{lang === 'ka' ? 'სინქრონიზაცია...' : 'Syncing...'}</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filtered.length === 0 ? (
                        <div className="py-24 text-center bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-[2.5rem] text-muted shadow-sm">
                            <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="text-sm font-black uppercase tracking-[0.2em]">{lang === 'ka' ? 'მომხმარებელი ვერ მოიძებნა' : 'No users found'}</p>
                        </div>
                    ) : filtered.map(user => (
                        <div key={user.slug} className="bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-center gap-5 p-6">
                                <div className="w-12 h-12 rounded-[1.25rem] overflow-hidden flex-shrink-0 bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle flex items-center justify-center shadow-inner">
                                    {user.logoUrl ? <img src={user.logoUrl} alt="" className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-zinc-300 opacity-40" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <p className="text-base font-black text-primary dark:text-white truncate">{user.studioName}</p>
                                        <span className="text-lg grayscale-[0.5] hover:grayscale-0 transition-all cursor-default" title={user.language.toUpperCase()}>{LANG_FLAG[user.language] || '🌐'}</span>
                                        <span className={cn('px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border', TIER_COLORS[user.tier] || TIER_COLORS.trial)}>
                                            {user.tier === 'trial' ? (lang === 'ka' ? 'ტესტირება' : 'Trial') : 
                                             user.tier === 'starter' ? (lang === 'ka' ? 'სტარტერი' : 'Starter') :
                                             user.tier === 'growth' ? (lang === 'ka' ? 'ზრდა' : 'Growth') :
                                             user.tier === 'enterprise' ? (lang === 'ka' ? 'პრემიუმი' : 'Pro') : user.tier}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <button onClick={() => copySlug(user.slug)} className="flex items-center gap-1.5 text-[10px] text-muted hover:text-indigo-500 font-mono font-black uppercase tracking-tighter transition-colors group/slug">
                                            {copiedSlug === user.slug ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 opacity-40 group-hover/slug:opacity-100" />}
                                            /{user.slug}
                                        </button>
                                        <span className="text-[10px] text-muted opacity-20">•</span>
                                        <span className="text-[10px] text-muted font-black uppercase tracking-widest opacity-60 tabular-nums">{user.studentCount} {lang === 'ka' ? 'მოსწავლე' : 'students'}</span>
                                    </div>
                                </div>
                                <button onClick={() => { setEditingNote(user.slug); setNoteVal(user.supportNote); }} className="flex items-center gap-2 px-5 py-3 bg-black/5 dark:bg-surface hover:bg-black/10 dark:hover:bg-muted/10 text-muted hover:text-primary dark:hover:text-white border border-black/5 dark:border-border-subtle rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
                                    <MessageSquare className="w-4 h-4 opacity-40" />
                                    <span className="hidden sm:inline">{lang === 'ka' ? 'ჩანაწერი' : 'Note'}</span>
                                </button>
                            </div>
                            {editingNote === user.slug ? (
                                <div className="border-t border-black/5 dark:border-border-subtle/50 px-6 py-5 flex gap-4 bg-black/[0.01]">
                                    <textarea 
                                        autoFocus 
                                        value={noteVal} 
                                        onChange={e => setNoteVal(e.target.value)} 
                                        placeholder={lang === 'ka' ? 'დაამატეთ მხარდაჭერის შენიშვნა, საკონტაქტო ინფორმაცია და ა.შ.' : 'Add support note, contact info, issues...'} 
                                        rows={3} 
                                        className="flex-1 bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle rounded-2xl px-5 py-3.5 text-xs font-bold text-primary dark:text-white placeholder:text-muted/40 outline-none focus:border-indigo-500/50 resize-none shadow-inner" 
                                    />
                                    <div className="flex flex-col gap-2">
                                        <button onClick={() => saveNote(user.slug)} className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20">{lang === 'ka' ? 'შენახვა' : 'Save'}</button>
                                        <button onClick={() => setEditingNote(null)} className="px-5 py-3 bg-white/95 dark:bg-card hover:bg-black/5 dark:hover:bg-zinc-500/10 text-muted border border-black/5 dark:border-border-subtle text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">{lang === 'ka' ? 'გაუქმება' : 'Cancel'}</button>
                                    </div>
                                </div>
                            ) : user.supportNote ? (
                                <div className="border-t border-black/5 dark:border-border-subtle/50 px-6 py-4 bg-black/[0.02] dark:bg-zinc-500/5">
                                    <p className="text-[11px] text-primary/70 dark:text-white/60 font-medium whitespace-pre-wrap leading-relaxed">
                                        <span className="opacity-40 mr-2 text-xs">💬</span> {user.supportNote}
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
