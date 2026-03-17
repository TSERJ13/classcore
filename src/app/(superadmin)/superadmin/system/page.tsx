'use client';

import { useState } from 'react';
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
    const [confirm, setConfirm] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const stats = typeof window !== 'undefined' ? getStorageStats() : { totalKeys: 0, ccKeys: 0, totalBytes: 0 };
    const slugs = typeof window !== 'undefined' ? getStudioRegistry() : [];

    const doAction = (key: string, fn: () => void) => { fn(); setConfirm(null); setDone(key); setTimeout(() => setDone(null), 3000); };

    const tools = [
        { id: 'export', label: 'Export All Data', desc: 'Download full ClassCore localStorage backup as JSON', icon: Download, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', dangerous: false, action: exportAllData },
        { id: 'clear_chat', label: 'Clear All Chats', desc: 'Delete all private and group chat logs across all studios', icon: Trash2, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dangerous: true, action: () => { for (let i = localStorage.length - 1; i >= 0; i--) { const key = localStorage.key(i); if (key?.startsWith('chat_') || key?.startsWith('group_chat_')) localStorage.removeItem(key); } } },
        { id: 'clear_sa_meta', label: 'Clear SA Metadata', desc: 'Reset all superadmin notes, plan overrides, and suspension states', icon: RefreshCw, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', dangerous: true, action: () => { for (let i = localStorage.length - 1; i >= 0; i--) { const key = localStorage.key(i); if (key?.startsWith('cc_sa_meta_')) localStorage.removeItem(key); } } },
        { id: 'clear_shop', label: 'Clear All Shop Sales', desc: 'Delete all recorded shop sales across all studios', icon: Trash2, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', dangerous: true, action: () => { for (let i = localStorage.length - 1; i >= 0; i--) { const key = localStorage.key(i); if (key?.startsWith('cc_shop_sales')) localStorage.removeItem(key); } } },
    ];

    const [promoCodes, setPromoCodes] = useState<{ code: string; discount: number; type: 'percent' | 'fixed' }[]>(() => {
        if (typeof window === 'undefined') return [];
        const saved = localStorage.getItem('cc_sa_promo_codes');
        return saved ? JSON.parse(saved) : [];
    });
    const [newPromo, setNewPromo] = useState({ code: '', discount: 10, type: 'percent' as const });

    const addPromo = () => {
        if (!newPromo.code) return;
        const updated = [...promoCodes, newPromo];
        setPromoCodes(updated);
        localStorage.setItem('cc_sa_promo_codes', JSON.stringify(updated));
        setNewPromo({ code: '', discount: 10, type: 'percent' });
    };

    const deletePromo = (code: string) => {
        const updated = promoCodes.filter(p => p.code !== code);
        setPromoCodes(updated);
        localStorage.setItem('cc_sa_promo_codes', JSON.stringify(updated));
    };

    return (
        <div className="space-y-6 animate-fade-up pb-20">
            <div><h1 className="text-2xl font-black text-white tracking-tight">System Tools & Promos</h1><p className="text-sm text-zinc-500 mt-1">Data management and promotion control</p></div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3"><RefreshCw className="w-5 h-5 text-indigo-400" /><h2 className="text-sm font-black text-white">Promo Code Management</h2></div>
                    <div className="flex gap-2">
                        <input
                            placeholder="CODE"
                            value={newPromo.code}
                            onChange={e => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                            className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] font-black text-white outline-none focus:border-indigo-500"
                        />
                        <input
                            type="number"
                            value={newPromo.discount}
                            onChange={e => setNewPromo({ ...newPromo, discount: Number(e.target.value) })}
                            className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] font-black text-white outline-none"
                        />
                        <select
                            value={newPromo.type}
                            onChange={e => setNewPromo({ ...newPromo, type: e.target.value as any })}
                            className="bg-zinc-800 border border-zinc-700 rounded-lg px-1 py-1 text-[11px] font-black text-white outline-none"
                        >
                            <option value="percent">%</option>
                            <option value="fixed">GEL</option>
                        </select>
                        <button onClick={addPromo} className="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white text-[11px] font-black rounded-lg transition-all">Add</button>
                    </div>
                </div>
                <div className="space-y-2">
                    {promoCodes.map(promo => (
                        <div key={promo.code} className="flex items-center justify-between p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl">
                            <div className="flex items-center gap-4">
                                <span className="text-xs font-black text-white tracking-wider">{promo.code}</span>
                                <span className="text-[10px] font-bold text-zinc-500 uppercase">{promo.discount}{promo.type === 'percent' ? '%' : ' GEL'} Discount</span>
                            </div>
                            <button onClick={() => deletePromo(promo.code)} className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                    {promoCodes.length === 0 && <p className="text-xs text-zinc-600 italic">No active promo codes</p>}
                </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4"><Database className="w-5 h-5 text-indigo-400" /><h2 className="text-sm font-black text-white">localStorage Statistics</h2></div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center"><p className="text-2xl font-black text-white">{stats.totalKeys}</p><p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mt-1">Total Keys</p></div>
                    <div className="text-center"><p className="text-2xl font-black text-indigo-400">{stats.ccKeys}</p><p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mt-1">ClassCore Keys</p></div>
                    <div className="text-center"><p className="text-2xl font-black text-amber-400">{(stats.totalBytes / 1024).toFixed(1)}KB</p><p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider mt-1">Storage Used</p></div>
                </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <h2 className="text-sm font-black text-white mb-3">Studio Registry ({slugs.length})</h2>
                <div className="flex flex-wrap gap-2">
                    {slugs.map(slug => (<span key={slug} className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-[11px] font-mono text-zinc-400">/{slug}</span>))}
                    {slugs.length === 0 && <p className="text-xs text-zinc-600">No studios registered</p>}
                </div>
            </div>
            <div className="space-y-3">
                <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest">Actions</h2>
                {tools.map(tool => (
                    <div key={tool.id} className={cn('border rounded-2xl p-5 flex items-center gap-4', tool.bg)}>
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', tool.bg)}><tool.icon className={cn('w-5 h-5', tool.color)} /></div>
                        <div className="flex-1"><p className="text-sm font-black text-white">{tool.label}</p><p className="text-xs text-zinc-500 mt-0.5">{tool.desc}</p></div>
                        {done === tool.id ? (
                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-xs font-black"><CheckCircle className="w-4 h-4" /> Done</div>
                        ) : confirm === tool.id ? (
                            <div className="flex items-center gap-2">
                                <button onClick={() => doAction(tool.id, tool.action)} className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-black rounded-xl transition-all">Yes, proceed</button>
                                <button onClick={() => setConfirm(null)} className="px-3 py-2 bg-zinc-800 text-zinc-400 text-xs font-black rounded-xl hover:bg-zinc-700 transition-all">Cancel</button>
                            </div>
                        ) : (
                            <button onClick={() => tool.dangerous ? setConfirm(tool.id) : doAction(tool.id, tool.action)} className={cn('px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2', tool.dangerous ? 'bg-zinc-800 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-500/30' : 'bg-indigo-500 hover:bg-indigo-600 text-white')}>
                                {tool.dangerous && <AlertTriangle className="w-3 h-3" />}{tool.label}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
