'use client';

import { useState, useEffect } from 'react';
import { Trash2, Download, RefreshCw, AlertTriangle, Database, CheckCircle } from 'lucide-react';
import { getStudioRegistry } from '@/lib/settings-store';
import { cn } from '@/lib/utils';

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
    const [mounted, setMounted] = useState(false);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const [lang, setLang] = useState<'ka' | 'en'>('ka');
    const [cleanupDays, setCleanupDays] = useState(30);
    const [promoCodes, setPromoCodes] = useState<{ code: string; discount: number; type: 'percent' | 'fixed'; singleUse: boolean; maxUses: number; usedCount: number }[]>(() => {
        if (typeof window === 'undefined') return [];
        const saved = localStorage.getItem('cc_sa_promo_codes');
        return saved ? JSON.parse(saved) : [];
    });
    const [newPromo, setNewPromo] = useState({ code: '', discount: 10, type: 'percent' as const, singleUse: false, maxUses: 0 });

    useEffect(() => {
        setMounted(true);
        const storedLang = localStorage.getItem('cc_sa_lang') as 'ka' | 'en';
        if (storedLang) setLang(storedLang);
    }, []);

    const stats = mounted && typeof window !== 'undefined' ? getStorageStats() : { totalKeys: 0, ccKeys: 0, totalBytes: 0 };
    const slugs = mounted && typeof window !== 'undefined' ? getStudioRegistry() : [];

    if (!mounted) return null;

    const doAction = (key: string, fn: () => void) => { fn(); setConfirmingId(null); setDone(key); setTimeout(() => setDone(null), 3000); };

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
        { id: 'export', label: lang === 'ka' ? 'მონაცემების ექსპორტი' : 'Export All Data', desc: lang === 'ka' ? 'ClassCore-ის სრული მონაცემების გადმოწერა JSON ფორმატში' : 'Download full ClassCore localStorage backup as JSON', icon: Download, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', dangerous: false, action: exportAllData },
        { id: 'cleanup_chat_30', label: lang === 'ka' ? 'ჩატების გასუფთავება > 30 დღე' : 'Clear Chats > 30 Days', desc: lang === 'ka' ? 'ბოლო 30 დღის განმავლობაში უმოქმედო ჩატების ავტომატური წაშლა' : 'Automatically delete all chat threads with no activity in the last 30 days', icon: Trash2, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dangerous: true, action: () => clearOldChats(30) },
        { id: 'clear_sa_meta', label: lang === 'ka' ? 'SA მეტამონაცემების გასუფთავება' : 'Clear SA Metadata', desc: lang === 'ka' ? 'სუპერადმინის ჩანაწერების, გეგმების და სტატუსების განულება' : 'Reset all superadmin notes, plan overrides, and suspension states', icon: RefreshCw, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', dangerous: true, action: () => { for (let i = localStorage.length - 1; i >= 0; i--) { const key = localStorage.key(i); if (key?.startsWith('cc_sa_meta_')) localStorage.removeItem(key); } } },
        { id: 'clear_shop', label: lang === 'ka' ? 'მაღაზიის გაყიდვების წაშლა' : 'Clear All Shop Sales', desc: lang === 'ka' ? 'ყველა სტუდიის მაღაზიის გაყიდვების ისტორიის წაშლა' : 'Delete all recorded shop sales across all studios', icon: Trash2, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', dangerous: true, action: () => { for (let i = localStorage.length - 1; i >= 0; i--) { const key = localStorage.key(i); if (key?.startsWith('cc_shop_sales')) localStorage.removeItem(key); } } },
    ];

    const addPromo = () => {
        if (!newPromo.code) return;
        const entry = { ...newPromo, usedCount: 0 };
        const updated = [...promoCodes, entry];
        setPromoCodes(updated);
        localStorage.setItem('cc_sa_promo_codes', JSON.stringify(updated));
        setNewPromo({ code: '', discount: 10, type: 'percent', singleUse: false, maxUses: 0 });
    };

    const deletePromo = (code: string) => {
        const updated = promoCodes.filter(p => p.code !== code);
        setPromoCodes(updated);
        localStorage.setItem('cc_sa_promo_codes', JSON.stringify(updated));
    };

    return (
        <div className="space-y-6 animate-fade-up pb-20">
            <div>
                <h1 className="text-2xl font-black text-primary tracking-tight uppercase">{lang === 'ka' ? 'სისტემური ხელსაწყოები' : 'System Tools'}</h1>
                <p className="text-sm text-muted mt-1 font-medium">{lang === 'ka' ? 'მონაცემების მართვა, გასუფთავება და სისტემური მთლიანობა' : 'Data Management, Cleanup & System Integrity'}</p>
            </div>

            <div className="bg-white/95 border border-black/10 dark:border-border-subtle rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4"><Database className="w-5 h-5 text-indigo-600" /><h2 className="text-sm font-black text-primary uppercase">{lang === 'ka' ? 'localStorage-ის სტატისტიკა' : 'localStorage Statistics'}</h2></div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center"><p className="text-2xl font-black text-[#1e293b] tabular-nums">{stats.totalKeys}</p><p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">{lang === 'ka' ? 'ჯამური გასაღები' : 'Total Keys'}</p></div>
                    <div className="text-center"><p className="text-2xl font-black text-indigo-600 tabular-nums">{stats.ccKeys}</p><p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">{lang === 'ka' ? 'ClassCore გასაღები' : 'ClassCore Keys'}</p></div>
                    <div className="text-center"><p className="text-2xl font-black text-amber-600 tabular-nums">{(stats.totalBytes / 1024).toFixed(1)}KB</p><p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">{lang === 'ka' ? 'გამოყენებული' : 'Storage Used'}</p></div>
                </div>
            </div>
            <div className="bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Trash2 className="w-5 h-5 text-rose-500" />
                        <h2 className="text-sm font-black text-primary uppercase tracking-tight">{lang === 'ka' ? 'ჩატების გასუფთავება' : 'Custom Chat Cleanup'}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-muted uppercase">{lang === 'ka' ? 'წაშალეთ ძველი ვიდრე:' : 'Delete older than:'}</span>
                        <input 
                            type="number" 
                            value={cleanupDays} 
                            onChange={e => setCleanupDays(Number(e.target.value))} 
                            className="w-16 bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle rounded-lg px-2 py-1 text-xs font-black text-primary dark:text-white outline-none" 
                        />
                        <span className="text-xs font-bold text-muted">{lang === 'ka' ? 'დღე' : 'Days'}</span>
                        <button 
                            onClick={() => { if(window.confirm(lang === 'ka' ? `ნამდვილად გსურთ წაშალოთ ყველა ჩატი რომელიც ძველია ვიდრე ${cleanupDays} დღე?` : `Delete ALL chat messages older than ${cleanupDays} days?`)) clearOldChats(cleanupDays); }} 
                            className="ml-2 px-4 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-black rounded-lg transition-all shadow-lg shadow-rose-500/20 uppercase"
                        >
                            {lang === 'ka' ? 'წაშლა' : 'Run Purge'}
                        </button>
                    </div>
                </div>
                <p className="text-[11px] text-muted italic opacity-60 leading-relaxed px-1">
                    * This tool scans all `chat_` and `group_chat_` records in systemic storage. Messages with a timestamp matching the criteria will be permanently removed.
                </p>
            </div>

            <div className="bg-white/95 border border-black/10 dark:border-border-subtle rounded-2xl p-5 shadow-sm">
                <h2 className="text-sm font-black text-primary mb-3">{lang === 'ka' ? 'სტუდიების რეესტრი' : 'Studio Registry'} ({slugs.length})</h2>
                <div className="flex flex-wrap gap-2">
                    {slugs.map(slug => (<span key={slug} className="px-2.5 py-1 bg-black/5 border border-black/5 rounded-lg text-[11px] font-mono text-zinc-400 tracking-tight">/{slug}</span>))}
                    {slugs.length === 0 && <p className="text-xs text-zinc-400">{lang === 'ka' ? 'სტუდიები არ არის რეგისტრირებული' : 'No studios registered'}</p>}
                </div>
            </div>
            <div className="space-y-3">
                <h2 className="text-sm font-black text-muted uppercase tracking-widest opacity-40">{lang === 'ka' ? 'ქმედებები' : 'Actions'}</h2>
                {tools.map(tool => (
                    <div key={tool.id} className={cn('border rounded-2xl p-5 flex items-center gap-4 shadow-sm', tool.bg)}>
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', tool.bg)}><tool.icon className={cn('w-5 h-5', tool.color)} /></div>
                        <div className="flex-1"><p className="text-sm font-black text-primary">{tool.label}</p><p className="text-xs text-muted mt-0.5">{tool.desc}</p></div>
                        {done === tool.id ? (
                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-black"><CheckCircle className="w-4 h-4" /> {lang === 'ka' ? 'დასრულდა' : 'Done'}</div>
                        ) : confirmingId === tool.id ? (
                            <div className="flex items-center gap-2">
                                <button onClick={() => doAction(tool.id, tool.action)} className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all shadow-sm">{lang === 'ka' ? 'დიახ, გააგრძელე' : 'Yes, proceed'}</button>
                                <button onClick={() => setConfirmingId(null)} className="px-3 py-2 bg-black/5 dark:bg-surface text-muted text-xs font-black rounded-xl border border-black/5 dark:border-border-subtle hover:bg-black/10 dark:hover:bg-muted/10 transition-all shadow-sm">{lang === 'ka' ? 'გაუქმება' : 'Cancel'}</button>
                            </div>
                        ) : (
                            <button onClick={() => tool.dangerous ? setConfirmingId(tool.id) : doAction(tool.id, tool.action)} className={cn('px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm', tool.dangerous ? 'bg-surface hover:bg-rose-500/10 text-muted hover:text-rose-600 dark:hover:text-rose-400 border border-border-subtle' : 'bg-indigo-600 hover:bg-indigo-700 text-white')}>
                                {tool.dangerous && <AlertTriangle className="w-3 h-3" />}{tool.label}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
