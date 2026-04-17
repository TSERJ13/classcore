'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { Trash2, Download, RefreshCw, AlertTriangle, Database, CheckCircle, Sync } from 'lucide-react';
import { getStudioRegistry } from '@/lib/settings-store';
import { cn } from '@/lib/utils';
import { syncGlobalAdminRegistry } from '@/lib/admin-sync';

function exportAllData() {
    const keys: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key?.startsWith('cc_')) { try { keys[key] = JSON.parse(localStorage.getItem(key) || 'null'); } catch { keys[key] = localStorage.getItem(key); } } }
    const blob = new Blob([JSON.stringify(keys, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `classcore_backup_${new Date().toISOString().slice(0, 10)}.json`; a.click();
}

function getStorageStats() {
    let total = 0, ccKeys = 0;
    for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i)!; const val = localStorage.getItem(key) || ''; total += key.length + val.length; if (key.startsWith('cc_')) ccKeys++; }
    return { totalKeys: localStorage.length, ccKeys, totalBytes: total };
}

export default function SystemPage() {
    const { lang, t } = useT();
    const [mounted, setMounted] = useState(false);
    const [cleanupDays, setCleanupDays] = useState(30);
    const [slugs, setSlugs] = useState<string[]>([]);
    
    const [promoCodes, setPromoCodes] = useState<{ code: string; discount: number; type: 'percent' | 'fixed'; singleUse: boolean; maxUses: number; usedCount: number }[]>(() => {
        if (typeof window === 'undefined') return [];
        const saved = localStorage.getItem('cc_sa_promo_codes');
        return saved ? JSON.parse(saved) : [];
    });
    const [newPromo, setNewPromo] = useState({ code: '', discount: 10, type: 'percent' as const, singleUse: false, maxUses: 0 });

    useEffect(() => {
        setMounted(true);
        const init = async () => {
            setLoading(true);
            try {
                // DATABASE-FIRST: Verify current cloud registry
                const data = await syncGlobalAdminRegistry();
                if (data && Array.isArray(data)) {
                    setSlugs(data.map((s: any) => s.slug));
                }
            } catch (err) {
                console.error('Failed to sync system registry:', err);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const stats = mounted && typeof window !== 'undefined' ? getStorageStats() : { totalKeys: 0, ccKeys: 0, totalBytes: 0 };

    if (!mounted) return null;

    const doAction = (key: string, fn: () => void | Promise<void>) => { 
        const result = fn(); 
        if (result instanceof Promise) {
            result.then(() => {
                setConfirmingId(null); 
                setDone(key); 
                setTimeout(() => setDone(null), 3000); 
            });
        } else {
            setConfirmingId(null); 
            setDone(key); 
            setTimeout(() => setDone(null), 3000); 
        }
    };

    const clearOldChats = (days: number) => {
        const threshold = Date.now() - (days * 24 * 60 * 60 * 1000);
        let count = 0;
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key?.startsWith('chat_') || key?.startsWith('group_chat_')) {
                try {
                    const messages = JSON.parse(localStorage.getItem(key) || '[]');
                    if (Array.isArray(messages) && messages.length > 0) {
                        const lastMsg = messages[messages.length - 1];
                        const time = lastMsg.timestamp ? new Date(lastMsg.timestamp).getTime() : 0;
                        if (time < threshold) {
                            localStorage.removeItem(key);
                            count++;
                        }
                    } else if (Array.isArray(messages) && messages.length === 0) {
                        localStorage.removeItem(key);
                        count++;
                    }
                } catch { }
            }
        }
        alert(`Cleared ${count} chat threads older than ${days} days.`);
    };


    const tools = [
        { id: 'export', label: t.sa_system_export_label, desc: t.sa_system_export_desc, icon: Download, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', dangerous: false, action: exportAllData },
        { id: 'global_wipe', label: t.sa_system_wipe_label, desc: t.sa_system_wipe_desc, icon: Database, color: 'text-rose-600', bg: 'bg-rose-500/10 border-rose-500/20', dangerous: true, action: async () => {
            try {
                const res = await fetch('/api/superadmin/global-purge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ slugs: slugs })
                });
                const data = await res.json();
                if (res.ok) alert(`Purged ${data.deleted} studios.`);
                else throw new Error(data.error);
            } catch (err: any) { alert('Error: ' + err.message); }
        }},
        { id: 'cleanup_chat_30', label: t.sa_system_clearChats_label, desc: t.sa_system_clearChats_desc, icon: Trash2, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dangerous: true, action: () => clearOldChats(30) },
    ];

    return (
        <div className="space-y-6 animate-fade-up pb-20">
            <div>
                <h1 className="text-2xl font-black text-primary tracking-tight uppercase">{t.sa_system_title}</h1>
                <p className="text-sm text-muted mt-1 font-medium">{t.sa_system_desc}</p>
            </div>

            {loading ? (
                <div className="py-24 flex flex-col items-center justify-center space-y-4 bg-white/50 rounded-2xl border border-black/5">
                    <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t.sa_system_stats_refreshing}</p>
                </div>
            ) : (
                <>
                    <div className="bg-white/95 border border-black/10 dark:border-border-subtle rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center gap-3 mb-4"><Database className="w-5 h-5 text-indigo-600" /><h2 className="text-sm font-black text-primary uppercase">{t.sa_system_stats_title}</h2></div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center"><p className="text-2xl font-black text-[#1e293b] tabular-nums">{stats.totalKeys}</p><p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">{t.sa_system_stats_totalKeys}</p></div>
                            <div className="text-center"><p className="text-2xl font-black text-indigo-600 tabular-nums">{stats.ccKeys}</p><p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">{t.sa_system_stats_ccKeys}</p></div>
                            <div className="text-center"><p className="text-2xl font-black text-amber-600 tabular-nums">{(stats.totalBytes / 1024).toFixed(1)}KB</p><p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">{t.sa_system_stats_used}</p></div>
                        </div>
                    </div>

                    <div className="bg-white/95 border border-black/10 dark:border-border-subtle rounded-2xl p-5 shadow-sm">
                        <h2 className="text-sm font-black text-primary mb-3 uppercase tracking-tight">{t.sa_system_cloud_registry} ({slugs.length})</h2>
                        <div className="flex flex-wrap gap-2">
                            {slugs.map(slug => (<span key={slug} className="px-2.5 py-1 bg-black/5 border border-black/5 rounded-lg text-[11px] font-mono text-zinc-400 tracking-tight">/{slug}</span>))}
                            {slugs.length === 0 && <p className="text-xs text-zinc-400 font-black uppercase opacity-20">{t.sa_system_empty}</p>}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-sm font-black text-muted uppercase tracking-widest opacity-40">{t.sa_system_actions}</h2>
                        {tools.map(tool => (
                            <div key={tool.id} className={cn('border rounded-2xl p-5 flex items-center gap-4 shadow-sm', tool.bg)}>
                                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner', tool.bg)}>
                                    <tool.icon className={cn('w-5 h-5', tool.color)} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-black text-primary">{tool.label}</p>
                                    <p className="text-xs text-muted mt-0.5 font-medium">{tool.desc}</p>
                                </div>
                                {done === tool.id ? (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-black"><CheckCircle className="w-4 h-4" /> {t.done}</div>
                                ) : confirmingId === tool.id ? (
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => doAction(tool.id, tool.action)} className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-rose-600/20">{t.sa_system_yesDelete}</button>
                                        <button onClick={() => setConfirmingId(null)} className="px-3 py-2 bg-white text-muted text-xs font-black rounded-xl border border-black/5 hover:bg-black/5 transition-all shadow-sm">{t.sa_studios_cancel}</button>
                                    </div>
                                ) : (
                                    <button onClick={() => tool.dangerous ? setConfirmingId(tool.id) : doAction(tool.id, tool.action)} className={cn('px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm uppercase tracking-wider', tool.dangerous ? 'bg-white hover:bg-rose-500/10 text-muted hover:text-rose-600 border border-black/5' : 'bg-indigo-600 hover:bg-indigo-700 text-white')}>
                                        {tool.dangerous && <AlertTriangle className="w-3 h-3" />}{tool.label}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
