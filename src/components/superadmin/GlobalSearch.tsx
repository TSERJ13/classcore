'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Building2, Users, CreditCard, ChevronRight, X, Command } from 'lucide-react';
import { getStudioRegistry, loadSettings } from '@/lib/settings-store';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useT } from '@/contexts/LanguageContext';

type ResultType = 'studio' | 'client' | 'payment';
interface SearchResult { type: ResultType; title: string; sub: string; href: string; }

function globalSearch(query: string, lang: 'ka' | 'en' | 'ru'): SearchResult[] {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const results: SearchResult[] = [];
    
    // 1. Get True Global Studio Data from the cloud cache
    const cloudData: any[] = (() => {
        try { return JSON.parse(localStorage.getItem('cc_sa_studios_data') || '[]'); } catch { return []; }
    })();

    cloudData.forEach(s => {
        if (s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q)) {
            results.push({ type: 'studio', title: s.name, sub: `/${s.slug}`, href: `/superadmin/studios?search=${s.slug}` });
        }
    });

    const slugs = getStudioRegistry();
    slugs.forEach(slug => {
        // Skip studios already matched via cloud data (avoid duplicates)
        if (cloudData.find(cs => cs.slug === slug)) return;
        
        try {
            const s = loadSettings(slug);
            
            // Match studio (legacy fallback)
            if ((s?.studioName || '').toLowerCase().includes(q) || slug.includes(q)) {
                results.push({ type: 'studio', title: s?.studioName || slug, sub: `/${slug}`, href: `/superadmin/studios?search=${slug}` });
            }
            
            // Match students
            try {
                const raw = localStorage.getItem(`cc_student_data_${slug}`) || localStorage.getItem('cc_student_data');
                if (raw) {
                    const students = JSON.parse(raw);
                    if (students && typeof students === 'object') {
                        Object.entries(students).forEach(([, st]: [any, any]) => {
                            if (st && ((st.name || '').toLowerCase().includes(q) || (st.phone || '').includes(q) || (st.email || '').toLowerCase().includes(q))) {
                                results.push({ type: 'client', title: st.name || '—', sub: `${st.phone || ''} • ${s?.studioName || slug}`, href: `/superadmin/clients?search=${st.name}` });
                            }
                        });
                    }
                }
            } catch { }
            
            // Match payments
            try {
                const raw = localStorage.getItem(`cc_saas_payments_${slug}`);
                if (raw) {
                    const payments = JSON.parse(raw);
                    if (Array.isArray(payments)) {
                        payments.forEach(p => {
                            if (p && ((p.method?.toLowerCase() || '').includes(q) || (p.date || '').includes(q))) {
                                results.push({ type: 'payment', title: `${p.amount}₾ — ${p.method}`, sub: `${s?.studioName || slug} • ${new Date(p.date).toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US')}`, href: '/superadmin/billing' });
                            }
                        });
                    }
                }
            } catch { }
        } catch (err) {
            console.error('[GlobalSearch] Error processing slug:', slug, err);
        }
    });

    return results.slice(0, 20);
}

const TYPE_ICONS: Record<ResultType, React.ElementType> = { studio: Building2, client: Users, payment: CreditCard };
const TYPE_COLORS: Record<ResultType, string> = { 
    studio: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20', 
    client: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 border border-violet-500/20', 
    payment: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20' 
};

function getTypeLabel(type: ResultType, t: any) {
    const labels: Record<ResultType, string> = {
        studio: t.sa_search_studio,
        client: t.sa_search_student,
        payment: t.sa_search_payment
    };
    return labels[type];
}

function getTypePlural(type: ResultType, t: any) {
    const plurals: Record<ResultType, string> = {
        studio: t.sa_search_studios,
        client: t.sa_search_students,
        payment: t.sa_search_payments
    };
    return plurals[type];
}

export default function GlobalSearch({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { t, lang } = useT();
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const results = useMemo(() => globalSearch(query, lang), [query, lang]);

    useEffect(() => {

        const handleDown = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onClose(); // Toggle mechanism handled by parent
            }
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleDown);
        return () => window.removeEventListener('keydown', handleDown);
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
            setQuery('');
        }
    }, [isOpen]);

    const grouped = results.reduce((acc, r) => {
        (acc[r.type] = acc[r.type] || []).push(r);
        return acc;
    }, {} as Record<ResultType, SearchResult[]>);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-20 px-4 md:pt-32">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />
            
            <div className="relative w-full max-w-2xl bg-white dark:bg-[#0c0c0e] border border-black/5 dark:border-white/10 rounded-[2rem] shadow-2xl shadow-black/20 overflow-hidden animate-in zoom-in-95 slide-in-from-top-4 duration-300 flex flex-col">
                {/* Search Header */}
                <div className="relative flex items-center px-6 py-5 border-b border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
                    <Search className="w-5 h-5 text-indigo-500 mr-4 shrink-0" />
                    <input 
                        ref={inputRef}
                        value={query} 
                        onChange={e => setQuery(e.target.value)}
                        placeholder={t.sa_search_placeholder}
                        className="flex-1 bg-transparent border-none outline-none text-base font-bold text-primary dark:text-white placeholder:text-zinc-400"
                    />
                    <div className="flex items-center gap-2 ml-4">
                        <kbd className="hidden md:flex h-6 items-center gap-1 rounded bg-black/5 dark:bg-white/10 px-2 font-mono text-[10px] font-black text-muted uppercase">
                            <Command className="w-3 h-3" /> K
                        </kbd>
                        <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all">
                            <X className="w-5 h-5 text-zinc-400" />
                        </button>
                    </div>
                </div>

                {/* Results Area */}
                <div className="max-h-[60vh] overflow-y-auto no-scrollbar pb-6">
                    {!query && (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
                                <Search className="w-8 h-8 text-indigo-500 opacity-40" />
                            </div>
                            <p className="text-sm font-black text-zinc-500 uppercase tracking-widest leading-relaxed">
                                {t.sa_search_desc}
                            </p>
                        </div>
                    )}

                    {query && results.length === 0 && (
                        <div className="p-12 text-center text-zinc-400">
                            <p className="text-sm font-bold italic">
                                {t.sa_search_noResults}: "{query}"
                            </p>
                        </div>
                    )}

                    {query && results.length > 0 && (
                        <div className="p-4 space-y-6">
                            {(['studio', 'client', 'payment'] as ResultType[]).map(type => {
                                const items = grouped[type];
                                if (!items?.length) return null;
                                const Icon = TYPE_ICONS[type];
                                return (
                                    <div key={type} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="px-3 mb-2 flex items-center gap-2">
                                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{getTypePlural(type, t)}</span>
                                            <div className="h-[1px] flex-1 bg-black/5 dark:bg-white/5" />
                                        </div>
                                        <div className="space-y-1">
                                            {items.map((r, i) => (
                                                <Link 
                                                    key={i} 
                                                    href={r.href} 
                                                    onClick={onClose}
                                                    className="flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-indigo-500/[0.08] dark:hover:bg-indigo-500/10 transition-all group"
                                                >
                                                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 shadow-sm', TYPE_COLORS[type])}>
                                                        <Icon className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-black text-primary dark:text-white truncate">{r.title}</p>
                                                        <p className="text-[11px] text-muted dark:text-zinc-500 truncate font-medium">{r.sub}</p>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Tip */}
                <div className="px-6 py-4 border-t border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] flex items-center justify-between">
                    <div className="flex items-center gap-4 opacity-40">
                        <div className="flex items-center gap-1.5 font-bold text-[9px] text-muted uppercase tracking-widest">
                            <span className="px-1 py-0.5 rounded border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">↑↓</span> {t.sa_search_navigate}
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-[9px] text-muted uppercase tracking-widest">
                            <span className="px-1 py-0.5 rounded border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">↵</span> {t.sa_search_select}
                        </div>
                    </div>
                    <p className="text-[9px] font-black text-indigo-500/60 uppercase tracking-widest">Global Search v2.0</p>
                </div>
            </div>
        </div>
    );
}
