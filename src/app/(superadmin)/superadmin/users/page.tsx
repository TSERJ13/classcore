'use client';

import { useState, useEffect } from 'react';
import { Users, Copy, Check, Search, MessageSquare } from 'lucide-react';
import { getStudioRegistry, loadSettings } from '@/lib/settings-store';
import { cn } from '@/lib/utils';

interface UserRecord { slug: string; studioName: string; logoUrl: string | null; language: string; supportNote: string; tier: string; studentCount: number; }

function loadUsers(): UserRecord[] {
    return getStudioRegistry().map(slug => {
        const s = loadSettings(slug);
        const meta = (() => { try { return JSON.parse(localStorage.getItem(`cc_sa_meta_${slug}`) || '{}'); } catch { return {}; } })();
        let studentCount = 0;
        try { const raw = localStorage.getItem(`cc_student_data_${slug}`) || localStorage.getItem('cc_student_data'); if (raw) studentCount = Object.keys(JSON.parse(raw)).length; } catch { }
        return { slug, studioName: s.studioName, logoUrl: s.logoDataUrl, language: s.language, supportNote: meta.supportNote || '', tier: meta.plan || 'trial', studentCount };
    });
}

const LANG_FLAG: Record<string, string> = { ka: '🇬🇪', ru: '🇷🇺', en: '🇬🇧' };
const TIER_COLORS: Record<string, string> = { trial: 'text-zinc-400 bg-zinc-800', starter: 'text-blue-400 bg-blue-500/10', growth: 'text-violet-400 bg-violet-500/10', enterprise: 'text-amber-400 bg-amber-500/10' };

export default function UsersPage() {
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [search, setSearch] = useState('');
    const [editingNote, setEditingNote] = useState<string | null>(null);
    const [noteVal, setNoteVal] = useState('');
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

    useEffect(() => { setUsers(loadUsers()); }, []);

    const filtered = users.filter(u => u.studioName.toLowerCase().includes(search.toLowerCase()) || u.slug.toLowerCase().includes(search.toLowerCase()));

    const saveNote = (slug: string) => {
        try { const existing = JSON.parse(localStorage.getItem(`cc_sa_meta_${slug}`) || '{}'); localStorage.setItem(`cc_sa_meta_${slug}`, JSON.stringify({ ...existing, supportNote: noteVal })); } catch { }
        setUsers(prev => prev.map(u => u.slug === slug ? { ...u, supportNote: noteVal } : u));
        setEditingNote(null);
    };

    const copySlug = (slug: string) => { navigator.clipboard.writeText(slug); setCopiedSlug(slug); setTimeout(() => setCopiedSlug(null), 2000); };

    return (
        <div className="space-y-6 animate-fade-up">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div><h1 className="text-2xl font-black text-white tracking-tight">Users & Support</h1><p className="text-sm text-zinc-500 mt-1">Studio accounts and support notes</p></div>
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 w-56" /></div>
            </div>
            <div className="grid gap-4">
                {filtered.length === 0 ? (
                    <div className="py-16 text-center bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-600"><Users className="w-8 h-8 mx-auto mb-3 opacity-30" /><p className="text-sm font-bold">No users found</p></div>
                ) : filtered.map(user => (
                    <div key={user.slug} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="flex items-center gap-4 p-5">
                            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800 flex items-center justify-center">
                                {user.logoUrl ? <img src={user.logoUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-black text-zinc-400">{user.studioName.slice(0, 2).toUpperCase()}</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-black text-white">{user.studioName}</p>
                                    <span className="text-lg">{LANG_FLAG[user.language] || '🌐'}</span>
                                    <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider', TIER_COLORS[user.tier] || TIER_COLORS.trial)}>{user.tier}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                    <button onClick={() => copySlug(user.slug)} className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 font-mono transition-colors">
                                        {copiedSlug === user.slug ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                        /{user.slug}
                                    </button>
                                    <span className="text-[10px] text-zinc-600">•</span>
                                    <span className="text-[10px] text-zinc-500">{user.studentCount} students</span>
                                </div>
                            </div>
                            <button onClick={() => { setEditingNote(user.slug); setNoteVal(user.supportNote); }} className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl text-xs font-bold transition-all">
                                <MessageSquare className="w-3.5 h-3.5" /><span className="hidden sm:inline">Note</span>
                            </button>
                        </div>
                        {editingNote === user.slug ? (
                            <div className="border-t border-zinc-800 px-5 py-4 flex gap-2">
                                <textarea autoFocus value={noteVal} onChange={e => setNoteVal(e.target.value)} placeholder="Add support note, contact info, issues..." rows={3} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 resize-none" />
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => saveNote(user.slug)} className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black rounded-xl transition-all">Save</button>
                                    <button onClick={() => setEditingNote(null)} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-black rounded-xl transition-all">Cancel</button>
                                </div>
                            </div>
                        ) : user.supportNote ? (
                            <div className="border-t border-zinc-800 px-5 py-3"><p className="text-[11px] text-zinc-400 whitespace-pre-wrap">💬 {user.supportNote}</p></div>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}
