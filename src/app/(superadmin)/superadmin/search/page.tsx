'use client';

import { useState, useMemo } from 'react';
import { Search, Building2, Users, CreditCard, ChevronRight } from 'lucide-react';
import { getStudioRegistry, loadSettings } from '@/lib/settings-store';
import Link from 'next/link';

type ResultType = 'studio' | 'client' | 'payment';
interface SearchResult { type: ResultType; title: string; sub: string; href: string; }

function globalSearch(query: string): SearchResult[] {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const results: SearchResult[] = [];
    const slugs = getStudioRegistry();

    slugs.forEach(slug => {
        const s = loadSettings(slug);
        // Match studio
        if (s.studioName.toLowerCase().includes(q) || slug.includes(q)) {
            results.push({ type: 'studio', title: s.studioName, sub: `/${slug}`, href: '/superadmin/studios' });
        }
        // Match students
        try {
            const raw = localStorage.getItem(`cc_student_data_${slug}`) || localStorage.getItem('cc_student_data');
            if (raw) {
                const students = JSON.parse(raw) as Record<string, { name?: string; phone?: string; email?: string }>;
                Object.entries(students).forEach(([, st]) => {
                    if ((st.name || '').toLowerCase().includes(q) || (st.phone || '').includes(q) || (st.email || '').toLowerCase().includes(q)) {
                        results.push({ type: 'client', title: st.name || '—', sub: `${st.phone || ''} • ${s.studioName}`, href: '/superadmin/clients' });
                    }
                });
            }
        } catch { }
        // Match payments
        try {
            const raw = localStorage.getItem(`cc_saas_payments_${slug}`);
            if (raw) {
                const payments = JSON.parse(raw) as Array<{ date: string; method: string; amount: number }>;
                payments.forEach(p => {
                    if (p.method.toLowerCase().includes(q) || p.date.includes(q)) {
                        results.push({ type: 'payment', title: `${p.amount}₾ — ${p.method}`, sub: `${s.studioName} • ${new Date(p.date).toLocaleDateString('ka-GE')}`, href: '/superadmin/billing' });
                    }
                });
            }
        } catch { }
    });

    return results.slice(0, 30);
}

const TYPE_ICONS: Record<ResultType, React.ElementType> = { studio: Building2, client: Users, payment: CreditCard };
const TYPE_COLORS: Record<ResultType, string> = { studio: 'text-indigo-400 bg-indigo-500/10', client: 'text-violet-400 bg-violet-500/10', payment: 'text-amber-400 bg-amber-500/10' };
const TYPE_LABELS: Record<ResultType, string> = { studio: 'Studio', client: 'Client', payment: 'Payment' };

export default function SearchPage() {
    const [query, setQuery] = useState('');
    const results = useMemo(() => globalSearch(query), [query]);

    const grouped = results.reduce((acc, r) => {
        (acc[r.type] = acc[r.type] || []).push(r);
        return acc;
    }, {} as Record<ResultType, SearchResult[]>);

    return (
        <div className="space-y-6 animate-fade-up max-w-3xl">
            <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Universal Search</h1>
                <p className="text-sm text-zinc-500 mt-1">Search studios, clients, and transactions</p>
            </div>
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Type to search..."
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-indigo-500/60 rounded-2xl pl-12 pr-4 py-4 text-base text-white placeholder:text-zinc-600 outline-none transition-colors" />
            </div>

            {query && results.length === 0 && (
                <div className="py-12 text-center text-zinc-600"><p className="text-sm font-bold">No results for "{query}"</p></div>
            )}

            {(['studio', 'client', 'payment'] as ResultType[]).map(type => {
                const items = grouped[type];
                if (!items?.length) return null;
                const Icon = TYPE_ICONS[type];
                return (
                    <div key={type} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${TYPE_COLORS[type].split(' ')[0]}`} />
                            <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">{TYPE_LABELS[type]}s</span>
                            <span className="ml-auto text-[10px] text-zinc-600 font-black">{items.length}</span>
                        </div>
                        <div className="divide-y divide-zinc-800/40">
                            {items.map((r, i) => (
                                <Link key={i} href={r.href} className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-800/30 transition-colors group">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[type]}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-white truncate">{r.title}</p>
                                        <p className="text-[11px] text-zinc-500 truncate">{r.sub}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
                                </Link>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
