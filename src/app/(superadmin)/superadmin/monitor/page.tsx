'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { MessageSquare, Smartphone, Clock } from 'lucide-react';
import { getStudioRegistry, loadSettings } from '@/lib/settings-store';
import { cn } from '@/lib/utils';
import SupportChat from '@/components/superadmin/SupportChat';

type MonitorTab = 'chats' | 'sms';

interface SmsEntry { 
    studioSlug: string; 
    studioName: string; 
    to: string; 
    text: string; 
    status: string; 
    timestamp: string; 
    studentName?: string; 
}

function loadSmsLogs(): SmsEntry[] {
    const slugs = getStudioRegistry();
    const all: SmsEntry[] = [];
    slugs.forEach(slug => {
        const s = loadSettings(slug);
        try {
            const raw = localStorage.getItem(`cc_sms_logs_${slug}`);
            if (raw) {
                const logs = JSON.parse(raw);
                logs.forEach((l: any) => all.push({ ...l, studioSlug: slug, studioName: s.studioName }));
            }
        } catch { }
    });
    return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export default function MonitorPage() {
    const { t } = useT();
    const [mounted, setMounted] = useState(false);
    const [tab, setTab] = useState<MonitorTab>('chats');
    const [smsLogs, setSmsLogs] = useState<SmsEntry[]>([]);

    useEffect(() => {
        setMounted(true);
        setSmsLogs(loadSmsLogs());
        const refresh = () => setSmsLogs(loadSmsLogs());
        window.addEventListener('storage', refresh);
        return () => window.removeEventListener('storage', refresh);
    }, []);

    if (!mounted) return null;

    return (
        <div className="space-y-6 animate-fade-up pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-black text-primary dark:text-white tracking-tight uppercase">{t.sa_monitor_title}</h1>
                    <p className="text-[10px] text-muted mt-2 font-black uppercase tracking-widest leading-none opacity-40">{t.sa_monitor_desc}</p>
                </div>

                <div className="flex gap-2 p-1.5 bg-white/95 border border-black/10 dark:border-border-subtle rounded-2xl shadow-sm">
                    <button 
                        onClick={() => setTab('chats')}
                        className={cn('flex items-center gap-2.5 px-7 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-widest',
                            tab === 'chats' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-muted hover:text-primary dark:hover:text-white')}
                    >
                        <MessageSquare className="w-4 h-4" />
                        {t.sa_monitor_chatsTab}
                    </button>
                    <button 
                        onClick={() => setTab('sms')}
                        className={cn('flex items-center gap-2.5 px-7 py-3 rounded-xl text-xs font-black transition-all uppercase tracking-widest',
                            tab === 'sms' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-muted hover:text-primary dark:hover:text-white')}
                    >
                        <Smartphone className="w-4 h-4" />
                        {t.sa_monitor_smsTab}
                    </button>
                </div>
            </div>

            {tab === 'chats' ? (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 shadow-sm rounded-[2.5rem] overflow-hidden">
                    <SupportChat layout="monitor" />
                </div>
            ) : (
                <div className="bg-white/95 border border-black/10 dark:border-border-subtle rounded-[2.5rem] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500 shadow-sm">
                    <div className="p-8 border-b border-black/10 dark:border-border-subtle bg-black/5 dark:bg-surface flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-card border border-black/5 dark:border-border-subtle flex items-center justify-center text-indigo-500 shadow-inner">
                                <Smartphone className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-base font-black text-primary dark:text-white uppercase tracking-tight">{t.sa_monitor_smsLogTitle}</h2>
                                <p className="text-[9px] text-muted font-black uppercase tracking-widest mt-1 opacity-40">{t.sa_monitor_smsLogDesc}</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-black text-primary dark:text-white bg-white/95 dark:bg-card border border-black/10 dark:border-border-subtle px-4 py-1.5 rounded-xl uppercase tracking-widest shadow-sm">
                            {t.sa_monitor_total}: {smsLogs.length}
                        </span>
                    </div>

                    <div className="divide-y divide-black/5 dark:divide-border-subtle/50">
                        {smsLogs.length === 0 ? (
                            <div className="py-28 text-center bg-white/95 dark:bg-card">
                                <Smartphone className="w-16 h-16 mx-auto mb-6 text-muted opacity-10" />
                                <p className="text-sm font-black text-muted uppercase tracking-[0.2em] opacity-30">{t.sa_monitor_noLogs}</p>
                            </div>
                        ) : (
                            smsLogs.map((log, i) => (
                                <div key={i} className="flex items-center gap-8 px-10 py-6 hover:bg-black/5 dark:hover:bg-muted/5 transition-all group">
                                    <div className="relative">
                                        <div className={cn('w-3 h-3 rounded-full flex-shrink-0 shadow-[0_0_12px_currentColor] transition-all group-hover:scale-125', 
                                            log.status === 'success' || log.status === 'DELIVERED' ? 'text-emerald-500 bg-emerald-500' : 'text-rose-500 bg-rose-500')} />
                                        <div className={cn('absolute -inset-1 rounded-full animate-ping opacity-20',
                                            log.status === 'success' || log.status === 'DELIVERED' ? 'bg-emerald-500' : 'bg-rose-500')} />
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1.5">
                                            <p className="text-sm font-black text-primary dark:text-white group-hover:text-indigo-500 transition-colors uppercase tracking-tight">{log.studentName || log.to}</p>
                                            <span className="text-[10px] text-muted opacity-50 font-mono">• {log.to}</span>
                                        </div>
                                        <p className="text-xs text-muted font-medium line-clamp-1 group-hover:line-clamp-none transition-all leading-relaxed">{log.text}</p>
                                    </div>

                                    <div className="text-right flex-shrink-0 space-y-2">
                                        <div className="px-3 py-1 bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle rounded-lg">
                                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest">{log.studioName}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 justify-end text-[10px] text-muted font-black uppercase tracking-tighter opacity-40">
                                            <Clock className="w-3 h-3" />
                                            {log.timestamp ? new Date(log.timestamp).toLocaleString('ka-GE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
