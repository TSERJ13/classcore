'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { Trash2, Plus, Tag, Ticket, CheckCircle, AlertCircle, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PromoCode {
    code: string;
    discount: number;
    type: 'percent' | 'fixed';
    singleUse: boolean;
    maxUses: number;
    usedCount: number;
}

export default function PromosPage() {
    const { t } = useT();
    const [mounted, setMounted] = useState(false);
    const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
    const [newPromo, setNewPromo] = useState({ code: '', discount: 10, type: 'percent' as const, singleUse: false, maxUses: 0 });
    const [done, setDone] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const mapRow = (r: any): PromoCode => ({
        code: r.code,
        discount: r.discount ?? 0,
        type: r.type === 'fixed' ? 'fixed' : 'percent',
        singleUse: !!r.single_use,
        maxUses: r.max_uses ?? 0,
        usedCount: r.used_count ?? 0,
    });

    const loadPromos = async () => {
        try {
            const res = await fetch('/api/superadmin/promos', { cache: 'no-store' });
            const data = await res.json();
            if (Array.isArray(data.promos)) setPromoCodes(data.promos.map(mapRow));
        } catch (e) {
            console.error('Failed to load promo codes:', e);
        }
    };

    useEffect(() => {
        setMounted(true);
        loadPromos();
    }, []);

    const addPromo = async () => {
        if (!newPromo.code || saving) return;
        setSaving(true);
        try {
            await fetch('/api/superadmin/promos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPromo),
            });
            await loadPromos();
            setNewPromo({ code: '', discount: 10, type: 'percent', singleUse: false, maxUses: 0 });
            setDone('added');
            setTimeout(() => setDone(null), 3000);
        } catch (e) {
            console.error('Failed to add promo:', e);
        } finally {
            setSaving(false);
        }
    };

    const deletePromo = async (code: string) => {
        try {
            await fetch(`/api/superadmin/promos?code=${encodeURIComponent(code)}`, { method: 'DELETE' });
            await loadPromos();
        } catch (e) {
            console.error('Failed to delete promo:', e);
        }
    };

    if (!mounted) return null;

    return (
        <div className="space-y-6 animate-fade-up pb-20">
            <div>
                <h1 className="text-2xl font-black text-primary dark:text-white tracking-tight uppercase">{t.sa_promos_title}</h1>
                <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-1 opacity-40">{t.sa_promos_desc}</p>
            </div>

            {/* Quick Stats Overlay */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-[2rem] p-6 flex items-center gap-5 shadow-sm">
                    <div className="w-14 h-14 rounded-2xl bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle flex items-center justify-center text-indigo-500 shadow-inner">
                        <Tag className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-primary dark:text-white tabular-nums">{promoCodes.length}</p>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest opacity-40">{t.sa_promos_activeCodes}</p>
                    </div>
                </div>
                <div className="bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-[2rem] p-6 flex items-center gap-5 shadow-sm">
                    <div className="w-14 h-14 rounded-2xl bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle flex items-center justify-center text-emerald-500 shadow-inner">
                        <TrendingUp className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-primary dark:text-white tabular-nums">{promoCodes.reduce((acc, p) => acc + (p.usedCount || 0), 0)}</p>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest opacity-40">{t.sa_promos_totalUsage}</p>
                    </div>
                </div>
                <div className="bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-[2rem] p-6 flex items-center gap-5 shadow-sm">
                    <div className="w-14 h-14 rounded-2xl bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle flex items-center justify-center text-amber-500 shadow-inner">
                        <Users className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-primary dark:text-white tabular-nums">{promoCodes.filter(p => p.usedCount > 0).length}</p>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest opacity-40">{t.sa_promos_effectivePromos}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Add Promo Card */}
                <div className="lg:col-span-1">
                    <div className="bg-white/95 border border-black/10 dark:border-border-subtle rounded-[2.5rem] p-8 space-y-7 shadow-sm sticky top-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3.5 bg-black/5 dark:bg-surface rounded-2xl border border-black/5 dark:border-border-subtle shadow-inner">
                                <Plus className="w-5 h-5 text-indigo-500" />
                            </div>
                            <h2 className="text-sm font-black text-primary dark:text-white uppercase tracking-tight">{t.sa_promos_newPromo}</h2>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 opacity-60">{t.sa_promos_codeLabel}</label>
                                <input
                                    placeholder="SUMMER2026"
                                    value={newPromo.code}
                                    onChange={e => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                                    className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle rounded-2xl px-5 py-4 text-sm font-black text-primary dark:text-white focus:border-indigo-500/50 outline-none transition-all placeholder:text-muted/30 shadow-inner"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 opacity-60">{t.sa_promos_discountLabel}</label>
                                    <input
                                        type="number"
                                        value={newPromo.discount}
                                        onChange={e => setNewPromo({ ...newPromo, discount: Number(e.target.value) })}
                                        className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle rounded-2xl px-5 py-4 text-sm font-black text-primary dark:text-white focus:border-indigo-500/50 outline-none transition-all shadow-inner"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 opacity-60">{t.sa_promos_typeLabel}</label>
                                    <select
                                        value={newPromo.type}
                                        onChange={e => setNewPromo({ ...newPromo, type: e.target.value as any })}
                                        className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle rounded-2xl px-4 py-4 text-sm font-black text-primary dark:text-white focus:border-indigo-500/50 outline-none transition-all shadow-inner appearance-none"
                                    >
                                        <option value="percent">{t.sa_promos_percentOption}</option>
                                        <option value="fixed">{t.sa_promos_fixedOption}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-2 space-y-4">
                                <label className="flex items-center gap-4 p-5 bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle rounded-2xl hover:bg-black/10 dark:hover:bg-muted/10 transition-all cursor-pointer group shadow-sm">
                                    <input 
                                        type="checkbox" 
                                        checked={newPromo.singleUse} 
                                        onChange={e => setNewPromo({ ...newPromo, singleUse: e.target.checked })} 
                                        className="w-5 h-5 rounded-lg border-black/10 dark:border-border-subtle bg-white dark:bg-card text-indigo-500 focus:ring-indigo-500 transition-all" 
                                    />
                                    <div>
                                        <p className="text-xs font-black text-primary dark:text-white uppercase tracking-tight">{t.sa_promos_singleUseLabel}</p>
                                        <p className="text-[9px] text-muted font-bold mt-1 uppercase tracking-widest opacity-40">{t.sa_promos_singleUseDesc}</p>
                                    </div>
                                </label>

                                <div className="p-5 bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle rounded-2xl space-y-3 shadow-sm">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-60">{t.sa_promos_usageLimit}</p>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="number" 
                                            value={newPromo.maxUses} 
                                            onChange={e => setNewPromo({ ...newPromo, maxUses: Number(e.target.value) })} 
                                            className="flex-1 bg-white/95 dark:bg-card border border-black/5 dark:border-border-subtle rounded-xl px-4 py-2.5 text-xs font-black text-primary dark:text-white outline-none shadow-sm" 
                                        />
                                        <span className="text-[9px] text-muted font-black uppercase tracking-widest opacity-30">0 = ∞</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={addPromo}
                                disabled={!newPromo.code}
                                className={cn(
                                    "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95",
                                    newPromo.code ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20" : "bg-black/5 text-muted opacity-30 cursor-not-allowed"
                                )}
                            >
                                {done === 'added' ? <span className="flex items-center justify-center gap-2 animate-in zoom-in-95"><CheckCircle className="w-4 h-4" /> {t.sa_promos_addedSuccess}</span> : t.sa_promos_addBtn}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Promo List */}
                <div className="lg:col-span-2 space-y-5">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.3em] opacity-40">{t.sa_promos_activeCodesList}</h3>
                        <div className="h-[1px] flex-1 ml-6 bg-gradient-to-r from-black/5 to-transparent dark:from-border-subtle/50" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {promoCodes.length === 0 ? (
                            <div className="md:col-span-2 py-32 text-center bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-[2.5rem] shadow-sm">
                                <Ticket className="w-16 h-16 text-muted mx-auto mb-6 opacity-10" />
                                <p className="text-sm font-black text-muted uppercase tracking-[0.2em] opacity-30">{t.sa_promos_noCodes}</p>
                            </div>
                        ) : promoCodes.map(promo => (
                            <div key={promo.code} className="group bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-[2.5rem] p-7 space-y-6 hover:shadow-lg transition-all shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle flex items-center justify-center text-indigo-500 shadow-inner group-hover:scale-110 transition-transform">
                                            <Tag className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-base font-black text-primary dark:text-white tracking-widest uppercase">{promo.code}</p>
                                            <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-1">
                                                <span className="text-indigo-500">{promo.discount}{promo.type === 'percent' ? '%' : ' ₾'}</span> {t.sa_studios_discountLabel}
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => deletePromo(promo.code)}
                                        className="w-11 h-11 rounded-2xl bg-black/5 dark:bg-surface hover:bg-rose-500 text-muted hover:text-white border border-black/5 dark:border-border-subtle transition-all flex items-center justify-center shadow-sm"
                                        title="წაშლა"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-4 pt-6 border-t border-black/5 dark:border-border-subtle/50">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[9px] font-black text-muted uppercase tracking-widest opacity-40">{t.sa_promos_statusLabel}</p>
                                         <div className="flex flex-wrap gap-2 justify-end">
                                            {promo.singleUse && <span className="text-[8px] font-black text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 uppercase tracking-widest">{t.sa_promos_singleUseLabel}</span>}
                                            {promo.maxUses > 0 ? (
                                                <span className="text-[8px] font-black text-indigo-500 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20 uppercase tracking-widest">{t.sa_studios_limitLabel} {promo.maxUses}</span>
                                            ) : (
                                                <span className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 uppercase tracking-widest">{t.sa_promos_infiniteLabel}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[9px] font-black text-muted uppercase tracking-widest opacity-40">{t.sa_promos_usageFreqLabel}</p>
                                            <span className="text-[10px] font-black text-emerald-500 tabular-nums">{promo.usedCount || 0} {t.sa_promos_usageLabel}</span>
                                        </div>
                                        <div className="w-full bg-black/5 dark:bg-surface h-2 rounded-full overflow-hidden shadow-inner">
                                            <div 
                                                className="bg-emerald-500 h-full transition-all duration-1000" 
                                                style={{ width: promo.maxUses > 0 ? `${Math.min(100, (promo.usedCount / promo.maxUses) * 100)}%` : '100%' }} 
                                            />
                                        </div>
                                    </div>
                                </div>

                                {promo.maxUses > 0 && promo.usedCount >= promo.maxUses && (
                                    <div className="pt-2 flex items-center gap-2 text-rose-500/80 font-black text-[9px] uppercase tracking-widest italic animate-pulse">
                                        <AlertCircle className="w-3.5 h-3.5" /> {t.sa_promos_expiredLabel}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
