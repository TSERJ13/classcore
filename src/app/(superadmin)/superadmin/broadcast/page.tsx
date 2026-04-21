'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { Send, Megaphone, CheckCircle, Globe, Edit3, Trash2 } from 'lucide-react';

interface BroadcastMsg { title_ka: string; title_ru: string; title_en: string; body_ka: string; body_ru: string; body_en: string; }

const EMPTY: BroadcastMsg = { title_ka: '', title_ru: '', title_en: '', body_ka: '', body_ru: '', body_en: '' };

function saveBroadcast(msg: BroadcastMsg) {
    const history = (() => { try { return JSON.parse(localStorage.getItem('cc_sa_broadcast_history') || '[]'); } catch { return []; } })();
    const entry = { ...msg, sentAt: new Date().toISOString(), id: (msg as any).id || Date.now().toString() };
    
    // Replace if exists, otherwise unshift
    const idx = history.findIndex((h: any) => h.id === entry.id);
    if (idx > -1) history[idx] = entry;
    else history.unshift(entry);
    
    localStorage.setItem('cc_sa_broadcast_history', JSON.stringify(history.slice(0, 30)));
    localStorage.setItem('cc_sa_broadcast', JSON.stringify(entry));
}

type LangTab = 'ka' | 'ru' | 'en';
const LANG_FLAGS: Record<LangTab, string> = { ka: '🇬🇪', ru: '🇷🇺', en: '🇬🇧' };
const LANG_NAMES: Record<LangTab, string> = { ka: 'ქართული', ru: 'რუსული', en: 'ინგლისური' };

export default function BroadcastPage() {
    const { lang: saLang, t } = useT();
    const [mounted, setMounted] = useState(false);
    const [msg, setMsg] = useState<BroadcastMsg>(EMPTY);
    const [lang, setLang] = useState<LangTab>('ka');
    const [sent, setSent] = useState(false);
    const [history, setHistory] = useState<Array<BroadcastMsg & { sentAt: string; id: string }>>([]);

    useEffect(() => {
        setMounted(true);
        const h = localStorage.getItem('cc_sa_broadcast_history');
        if (h) setHistory(JSON.parse(h));
    }, []);

    const deleteBroadcast = (id: string) => {
        if (!confirm(t.sa_broadcast_deleteConfirm)) return;
        const h = history.filter(item => item.id !== id);
        setHistory(h);
        localStorage.setItem('cc_sa_broadcast_history', JSON.stringify(h));
        const current = localStorage.getItem('cc_sa_broadcast');
        if (current && JSON.parse(current).id === id) localStorage.removeItem('cc_sa_broadcast');
    };

    const editBroadcast = (item: BroadcastMsg & { id: string }) => {
        setMsg(item);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const send = () => {
        if (!msg.title_ka && !msg.title_en) return;
        
        const h = history.filter(item => (msg as any).id ? item.id !== (msg as any).id : true);
        const entry = { ...msg, sentAt: new Date().toISOString(), id: (msg as any).id || Date.now().toString() };
        h.unshift(entry);
        
        const finalHistory = h.slice(0, 30);
        setHistory(finalHistory);
        localStorage.setItem('cc_sa_broadcast_history', JSON.stringify(finalHistory));
        localStorage.setItem('cc_sa_broadcast', JSON.stringify(entry));
        
        setSent(true);
        setTimeout(() => { setSent(false); setMsg(EMPTY); }, 3000);
    };

    const set = (field: keyof BroadcastMsg, val: string) => setMsg(prev => ({ ...prev, [field]: val }));

    if (!mounted) return null;

    return (
        <div className="space-y-6 animate-fade-up max-w-3xl">
            <div>
                <h1 className="text-3xl font-black text-primary tracking-tight">
                    {t.sa_broadcast_title}
                </h1>
                <p className="text-sm text-muted mt-1 font-medium">
                    {t.sa_broadcast_desc}
                </p>
            </div>

            <div className="bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-[2.5rem] p-8 space-y-6 shadow-sm overflow-hidden relative">
                <div className="flex items-center justify-between pb-6 border-b border-border-subtle/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-inner">
                            <Megaphone className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-primary">{t.sa_broadcast_newMsg}</h2>
                            <p className="text-[10px] text-muted font-black uppercase tracking-widest">{t.sa_broadcast_composeDesc}</p>
                        </div>
                    </div>
                </div>

                {/* Language tabs */}
                <div className="flex gap-2">
                    {(['ka', 'ru', 'en'] as LangTab[]).map(l => (
                        <button key={l} onClick={() => setLang(l)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border ${lang === l ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : 'text-muted hover:text-primary bg-black/5 dark:bg-surface border-black/5 dark:border-border-subtle shadow-sm'}`}>
                            <span className="text-sm">{LANG_FLAGS[l]}</span>{LANG_NAMES[l]}
                        </button>
                    ))}
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                         <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">{t.sa_broadcast_inputTitle}</label>
                         <input
                            value={msg[`title_${lang}` as keyof BroadcastMsg] || ''}
                            onChange={e => set(`title_${lang}` as keyof BroadcastMsg, e.target.value)}
                            placeholder={`${LANG_NAMES[lang]}...`}
                            className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle rounded-2xl px-5 py-4 text-sm font-bold text-primary dark:text-white placeholder:text-muted/30 outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                        />
                    </div>
                    <div className="space-y-2">
                         <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">{t.sa_broadcast_inputBody}</label>
                         <textarea
                            value={msg[`body_${lang}` as keyof BroadcastMsg] || ''}
                            onChange={e => set(`body_${lang}` as keyof BroadcastMsg, e.target.value)}
                            placeholder={`${LANG_NAMES[lang]}...`}
                            rows={6}
                            className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle rounded-3xl px-5 py-4 text-sm font-bold text-primary dark:text-white placeholder:text-muted/30 outline-none focus:border-indigo-500/50 transition-all resize-none shadow-inner no-scrollbar"
                        />
                    </div>
                </div>

                <div className="bg-zinc-500/5 border border-border-subtle/30 rounded-[1.5rem] p-4 flex items-start gap-4">
                    <Globe className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-zinc-500 font-bold leading-relaxed">
                        {t.sa_broadcast_warning}
                    </p>
                </div>

                <div className="pt-4">
                    {sent ? (
                        <div className="flex items-center justify-center gap-3 px-6 py-4 bg-emerald-500/10 text-emerald-500 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-inner animate-in zoom-in-95">
                            <CheckCircle className="w-5 h-5" /> 
                            {t.sa_broadcast_success}
                        </div>
                    ) : (
                        <button onClick={send}
                            className="flex items-center gap-3 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-600/30 active:scale-95">
                            <Send className="w-4 h-4" /> {t.sa_broadcast_sendBtn}
                        </button>
                    )}
                </div>
            </div>

            {/* History */}
            {history.length > 0 && (
                <div className="bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle rounded-[2.5rem] overflow-hidden shadow-sm">
                    <div className="px-8 py-5 border-b border-border-subtle bg-zinc-500/5">
                        <h2 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-40">
                             {t.sa_broadcast_history}
                        </h2>
                    </div>
                    <div className="divide-y divide-border-subtle/30">
                        {history.map(h => (
                            <div key={h.id} className="px-8 py-6 hover:bg-zinc-500/2 transition-colors group relative flex items-center justify-between">
                                <div className="space-y-1.5 flex-1 min-w-0 pr-20">
                                    <div className="flex items-center gap-3">
                                        <p className="text-sm font-black text-primary truncate">{h.title_ka || h.title_en}</p>
                                        <div className="flex gap-1">
                                            {h.title_ka && <span className="text-[8px]">🇬🇪</span>}
                                            {h.title_ru && <span className="text-[8px]">🇷🇺</span>}
                                            {h.title_en && <span className="text-[8px]">🇬🇧</span>}
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted font-medium line-clamp-1 opacity-70">{h.body_ka || h.body_en}</p>
                                    <p className="text-[9px] text-muted font-black uppercase tracking-widest opacity-40">{new Date(h.sentAt).toLocaleString('ka-GE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                    <button onClick={() => editBroadcast(h)} className="w-10 h-10 flex items-center justify-center bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle rounded-xl text-indigo-500 hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title={t.edit}><Edit3 className="w-4 h-4" /></button>
                                    <button onClick={() => deleteBroadcast(h.id)} className="w-10 h-10 flex items-center justify-center bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle rounded-xl text-rose-500 hover:bg-rose-600 hover:text-white transition-all shadow-sm" title={t.delete}><Trash2 className="w-4 h-4" /></button>
                                </div>
                                
                                {(msg as any).id === h.id && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
