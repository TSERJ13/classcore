'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, Search, Building2, Phone, Mail, Globe, Zap, Shield, CreditCard, ExternalLink, Calendar } from 'lucide-react';
import { getStudioRegistry, loadSettings } from '@/lib/settings-store';
import { getBillingState } from '@/lib/saas-billing';
import { cn, formatCurrency } from '@/lib/utils';
import { syncGlobalAdminRegistry } from '@/lib/admin-sync';

interface StudioClient {
    slug: string;
    name: string;
    logoUrl: string | null;
    ownerName: string;
    ownerPhone: string;
    ownerEmail: string;
    plan: string;
    status: 'active' | 'suspended';
    studentCount: number;
    billingStatus: string;
    nextDue: string | null;
    currency: string;
}

export default function GlobalClientsPage() {
    const [mounted, setMounted] = useState(false);
    const [studios, setStudios] = useState<StudioClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [lang, setLang] = useState<'ka' | 'en'>('ka');

    useEffect(() => { 
        setMounted(true);
        const init = async () => {
            setLoading(true);
            try {
                // DATABASE-FIRST: Always fetch from cloud
                const data = await syncGlobalAdminRegistry();
                if (data && Array.isArray(data)) {
                    const mapped: StudioClient[] = data.map((s: any) => ({
                        slug: s.slug,
                        name: s.name,
                        logoUrl: s.logoUrl,
                        ownerName: s.ownerName,
                        ownerPhone: s.ownerPhone,
                        ownerEmail: s.ownerEmail || 'N/A',
                        studentCount: s.studentCount,
                        billingStatus: s.billingStatus,
                        nextDue: s.nextDue || null,
                        currency: s.currency || 'GEL',
                        status: (s.suspended ? 'suspended' : 'active') as 'active' | 'suspended',
                        plan: s.plan
                    })).sort((a, b) => a.name.localeCompare(b.name));
                    setStudios(mapped); 
                } else {
                    setStudios([]);
                }
            } catch (err) {
                console.error('Failed to load studio registry:', err);
                setStudios([]);
            } finally {
                setLoading(false);
            }
            
            const storedLang = localStorage.getItem('cc_sa_lang') as 'ka' | 'en';
            if (storedLang) setLang(storedLang);
        };
        init();
    }, []);

    const filtered = useMemo(() =>
        studios.filter(s =>
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.slug.toLowerCase().includes(search.toLowerCase()) ||
            s.ownerName.toLowerCase().includes(search.toLowerCase()) ||
            s.ownerPhone.includes(search)
        ), [studios, search]);

    if (!mounted) return null;

    return (
        <div className="space-y-8 animate-fade-up pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-[#1e293b] tracking-tight uppercase">
                        {lang === 'ka' ? 'სტუდიების რეესტრი' : 'Studio Directory'}
                    </h1>
                    <p className="text-[10px] text-zinc-500 mt-1 font-black uppercase tracking-widest opacity-60">
                        {lang === 'ka' ? `${studios.length} რეგისტრირებული კლიენტი (სტუდია)` : `${studios.length} Registered Studio Clients`}
                    </p>
                </div>
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        placeholder={lang === 'ka' ? "ძიება სტუდიით, მფლობელით..." : "Search studio, owner..."}
                        className="bg-white border border-black/10 dark:border-border-subtle rounded-2xl pl-11 pr-6 py-4 text-sm text-primary placeholder:text-zinc-400 outline-none focus:border-indigo-500/50 w-full md:w-96 shadow-sm transition-all" 
                    />
                </div>
            </div>

            {loading ? (
                <div className="py-32 flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{lang === 'ka' ? 'სინქრონიზაცია...' : 'Syncing with cloud...'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.length === 0 ? (
                        <div className="col-span-full py-32 text-center bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-[2.5rem] shadow-sm">
                            <div className="w-20 h-20 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center mx-auto mb-6 text-indigo-500/20">
                                <Globe className="w-10 h-10" />
                            </div>
                            <h3 className="text-sm font-black text-primary dark:text-white uppercase tracking-[0.2em] mb-2">{lang === 'ka' ? 'კლიენტები არ მოიძებნა' : 'No clients found'}</h3>
                            <p className="text-[10px] text-muted font-black uppercase tracking-widest opacity-40">{lang === 'ka' ? 'რეესტრი ამჟამად ცარიელია' : 'The directory is currently empty'}</p>
                        </div>
                    ) : filtered.map((s) => (
                        <div key={s.slug} className="group bg-white dark:bg-card border border-black/10 dark:border-border-subtle rounded-3xl p-6 hover:shadow-xl transition-all shadow-sm flex flex-col">
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-zinc-50 border border-black/5 flex items-center justify-center shadow-inner group-hover:border-indigo-500/30 transition-all">
                                        {s.logoUrl ? <img src={s.logoUrl} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-6 h-6 text-zinc-300" />}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-base font-black text-[#1e293b] dark:text-white truncate">{s.name}</h3>
                                        <p className="text-[10px] text-zinc-500 font-mono tracking-tighter mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">/{s.slug}</p>
                                    </div>
                                </div>
                                <span className={cn(
                                    "px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border",
                                    s.status === 'active' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                )}>
                                    {s.status === 'active' ? (lang === 'ka' ? 'აქტიური' : 'Active') : (lang === 'ka' ? 'შეჩერებული' : 'Blocked')}
                                </span>
                            </div>

                            <div className="space-y-4 flex-1">
                                <div className="bg-zinc-50 dark:bg-zinc-500/5 p-4 rounded-2xl border border-black/5 dark:border-border-subtle">
                                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <Globe className="w-3 h-3" /> {lang === 'ka' ? 'მფლობელი' : 'Owner Contact'}
                                    </p>
                                    <p className="text-xs font-black text-[#1e293b] dark:text-white">{s.ownerName}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-[10px] font-bold text-zinc-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {s.ownerPhone}</span>
                                        {s.ownerEmail !== '—' && <span className="text-[10px] font-bold text-zinc-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {s.ownerEmail.split('@')[0]}...</span>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-zinc-50 dark:bg-zinc-500/5 p-4 rounded-2xl border border-black/5 dark:border-border-subtle text-center">
                                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">{lang === 'ka' ? 'მოსწავლე' : 'Students'}</p>
                                        <p className="text-xl font-black text-indigo-600 tabular-nums">{s.studentCount}</p>
                                    </div>
                                    <div className="bg-zinc-50 dark:bg-zinc-500/5 p-4 rounded-2xl border border-black/5 dark:border-border-subtle text-center">
                                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">{lang === 'ka' ? 'გეგმა' : 'Plan'}</p>
                                        <p className="text-xs font-black text-emerald-600 uppercase pt-2 tracking-tight">{s.plan}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 pt-5 border-t border-black/5 dark:border-border-subtle flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                        {lang === 'ka' ? 'გადახდის ვადა' : 'Next Due'}
                                    </span>
                                    <span className={cn("text-[11px] font-black mt-0.5 flex items-center gap-1.5", s.billingStatus === 'overdue' ? "text-rose-500" : "text-zinc-600 dark:text-zinc-400")}>
                                        <Calendar className="w-3 h-3" />
                                        {s.nextDue ? new Date(s.nextDue).toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US', { month: 'short', day: 'numeric' }) : '—'}
                                    </span>
                                </div>
                                <button 
                                    onClick={() => window.location.href = `/superadmin/studios?search=${s.slug}`}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-xl transition-all shadow-lg shadow-indigo-600/20 uppercase tracking-wider flex items-center gap-2"
                                >
                                    {lang === 'ka' ? 'მართვა' : 'Manage'} <Zap className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {filtered.length === 0 && !loading && (
                <div className="py-24 text-center bg-white border border-black/10 dark:border-border-subtle rounded-[2.5rem] shadow-sm">
                    <Building2 className="w-12 h-12 mx-auto mb-4 text-zinc-200" />
                    <p className="text-sm font-black text-zinc-400 uppercase tracking-[0.2em]">
                        {lang === 'ka' ? 'სტუდია ვერ მოიძებნა' : 'No studios found'}
                    </p>
                </div>
            )}
        </div>
    );
}
