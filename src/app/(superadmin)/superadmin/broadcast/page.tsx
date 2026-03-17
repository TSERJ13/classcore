'use client';

import { useState } from 'react';
import { Send, Megaphone, CheckCircle, Globe } from 'lucide-react';

interface BroadcastMsg { title_ka: string; title_ru: string; title_en: string; body_ka: string; body_ru: string; body_en: string; }

const EMPTY: BroadcastMsg = { title_ka: '', title_ru: '', title_en: '', body_ka: '', body_ru: '', body_en: '' };

function saveBroadcast(msg: BroadcastMsg) {
    const history = (() => { try { return JSON.parse(localStorage.getItem('cc_sa_broadcast_history') || '[]'); } catch { return []; } })();
    const entry = { ...msg, sentAt: new Date().toISOString(), id: Date.now().toString() };
    history.unshift(entry);
    localStorage.setItem('cc_sa_broadcast_history', JSON.stringify(history.slice(0, 20)));
    // Current active broadcast (read by studio dashboard)
    localStorage.setItem('cc_sa_broadcast', JSON.stringify(entry));
}

type LangTab = 'ka' | 'ru' | 'en';
const LANG_FLAGS: Record<LangTab, string> = { ka: '🇬🇪', ru: '🇷🇺', en: '🇬🇧' };
const LANG_NAMES: Record<LangTab, string> = { ka: 'Georgian', ru: 'Russian', en: 'English' };

export default function BroadcastPage() {
    const [msg, setMsg] = useState<BroadcastMsg>(EMPTY);
    const [lang, setLang] = useState<LangTab>('ka');
    const [sent, setSent] = useState(false);
    const [history, setHistory] = useState<Array<BroadcastMsg & { sentAt: string; id: string }>>(() => {
        try { return JSON.parse(localStorage.getItem('cc_sa_broadcast_history') || '[]'); } catch { return []; }
    });

    const send = () => {
        if (!msg.title_ka && !msg.title_en) return;
        saveBroadcast(msg);
        const h = (() => { try { return JSON.parse(localStorage.getItem('cc_sa_broadcast_history') || '[]'); } catch { return []; } })();
        setHistory(h);
        setSent(true);
        setTimeout(() => { setSent(false); setMsg(EMPTY); }, 3000);
    };

    const set = (field: keyof BroadcastMsg, val: string) => setMsg(prev => ({ ...prev, [field]: val }));

    return (
        <div className="space-y-6 animate-fade-up max-w-2xl">
            <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Broadcasting</h1>
                <p className="text-sm text-zinc-500 mt-1">Send system notifications to all studio admins</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-zinc-800">
                    <Megaphone className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-sm font-black text-white">New Broadcast Message</h2>
                </div>

                {/* Language tabs */}
                <div className="flex gap-2">
                    {(['ka', 'ru', 'en'] as LangTab[]).map(l => (
                        <button key={l} onClick={() => setLang(l)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${lang === l ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-zinc-500 hover:text-white bg-zinc-800'}`}>
                            <span>{LANG_FLAGS[l]}</span>{LANG_NAMES[l]}
                        </button>
                    ))}
                </div>

                <div className="space-y-3">
                    <input
                        value={msg[`title_${lang}` as keyof BroadcastMsg]}
                        onChange={e => set(`title_${lang}` as keyof BroadcastMsg, e.target.value)}
                        placeholder={`Title (${LANG_NAMES[lang]})...`}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 transition-colors"
                    />
                    <textarea
                        value={msg[`body_${lang}` as keyof BroadcastMsg]}
                        onChange={e => set(`body_${lang}` as keyof BroadcastMsg, e.target.value)}
                        placeholder={`Message body (${LANG_NAMES[lang]})...`}
                        rows={4}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 transition-colors resize-none"
                    />
                </div>

                <div className="bg-zinc-800/50 rounded-xl p-3 flex items-start gap-2">
                    <Globe className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-zinc-500">Message will be shown to each studio admin in their preferred language when they next open the Dashboard.</p>
                </div>

                {sent ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 text-emerald-400 rounded-xl text-sm font-black">
                        <CheckCircle className="w-4 h-4" /> Broadcast sent successfully!
                    </div>
                ) : (
                    <button onClick={send}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-black rounded-xl transition-all">
                        <Send className="w-4 h-4" /> Send Broadcast
                    </button>
                )}
            </div>

            {/* History */}
            {history.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-zinc-800">
                        <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Recent Broadcasts</h2>
                    </div>
                    <div className="divide-y divide-zinc-800/40">
                        {history.slice(0, 5).map(h => (
                            <div key={h.id} className="px-5 py-4">
                                <p className="text-sm font-black text-white">{h.title_ka || h.title_en}</p>
                                <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{h.body_ka || h.body_en}</p>
                                <p className="text-[10px] text-zinc-700 mt-2">{new Date(h.sentAt).toLocaleString('ka-GE')}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
