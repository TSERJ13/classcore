'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, Search, Building2, Phone, Mail, Copy, Check } from 'lucide-react';
import { getStudioRegistry, loadSettings } from '@/lib/settings-store';

interface GlobalClient {
    id: string;
    name: string;
    phone: string;
    email?: string;
    dob?: string;
    studioSlug: string;
    studioName: string;
    subscriptionStatus?: string;
}

function loadAllClients(): GlobalClient[] {
    const slugs = getStudioRegistry();
    const all: GlobalClient[] = [];
    slugs.forEach(slug => {
        const s = loadSettings(slug);
        try {
            const raw = localStorage.getItem(`cc_student_data_${slug}`) || (slugs.length === 1 ? localStorage.getItem('cc_student_data') : null);
            if (!raw) return;
            const data = JSON.parse(raw) as Record<string, {
                name?: string; phone?: string; email?: string; dob?: string;
            }>;
            Object.entries(data).forEach(([id, student]) => {
                all.push({
                    id, studioSlug: slug, studioName: s.studioName,
                    name: student.name || '—',
                    phone: student.phone || '—',
                    email: student.email,
                    dob: student.dob,
                });
            });
        } catch { }
    });
    return all;
}

export default function GlobalClientsPage() {
    const [clients, setClients] = useState<GlobalClient[]>([]);
    const [search, setSearch] = useState('');
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => { setClients(loadAllClients()); }, []);

    const filtered = useMemo(() =>
        clients.filter(c =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.phone.includes(search) ||
            (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
            c.studioName.toLowerCase().includes(search.toLowerCase())
        ), [clients, search]);

    const copy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div className="space-y-6 animate-fade-up">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Global Client Database</h1>
                    <p className="text-sm text-zinc-500 mt-1">{clients.length} clients across all studios</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, email..."
                        className="bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 w-72" />
                </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-[2fr_1.5fr_1.5fr_1.5fr] gap-4 px-6 py-3 border-b border-zinc-800 text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                    <span>Client</span><span>Phone</span><span>Email</span><span>Studio</span>
                </div>
                {filtered.length === 0 ? (
                    <div className="py-16 text-center text-zinc-600">
                        <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-bold">{search ? 'No results found' : 'No clients yet'}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-800/40 max-h-[600px] overflow-y-auto">
                        {filtered.map((c, i) => (
                            <div key={`${c.studioSlug}-${c.id}`} className="grid grid-cols-[2fr_1.5fr_1.5fr_1.5fr] gap-4 items-center px-6 py-3.5 hover:bg-zinc-800/20 transition-colors">
                                <div>
                                    <p className="text-sm font-black text-white">{c.name}</p>
                                    {c.dob && <p className="text-[10px] text-zinc-600 mt-0.5">🎂 {c.dob}</p>}
                                </div>
                                <button onClick={() => copy(c.phone, `${i}-phone`)} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors font-mono group text-left">
                                    {copied === `${i}-phone` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                    {c.phone}
                                </button>
                                <button onClick={() => c.email && copy(c.email, `${i}-email`)} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors group text-left truncate">
                                    {c.email ? (
                                        <>{copied === `${i}-email` ? <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />}<span className="truncate">{c.email}</span></>
                                    ) : <span className="text-zinc-700">—</span>}
                                </button>
                                <div className="flex items-center gap-1.5">
                                    <Building2 className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                                    <span className="text-xs text-zinc-400 truncate">{c.studioName}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
