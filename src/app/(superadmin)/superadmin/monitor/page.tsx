'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Smartphone, Building2, Clock } from 'lucide-react';
import { getStudioRegistry, loadSettings } from '@/lib/settings-store';
import { cn } from '@/lib/utils';

type MonitorTab = 'chats' | 'sms';

interface ChatEntry { studioSlug: string; studioName: string; studentId: string; messages: Array<{ text: string; sender: 'admin' | 'student'; timestamp: string }>; }
interface SmsEntry { studioSlug: string; studioName: string; to: string; text: string; status: string; timestamp: string; studentName?: string; }

function loadChats(): ChatEntry[] {
    const slugs = getStudioRegistry();
    const all: ChatEntry[] = [];
    slugs.forEach(slug => {
        const s = loadSettings(slug);
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(`chat_${slug}_`) || key?.startsWith('chat_')) {
                    const msgs = JSON.parse(localStorage.getItem(key) || '[]');
                    if (msgs.length > 0) {
                        const studentId = key.replace(`chat_${slug}_`, '').replace('chat_', '');
                        all.push({ studioSlug: slug, studioName: s.studioName, studentId, messages: msgs });
                    }
                }
            }
        } catch { }
    });
    return all.sort((a, b) => {
        const aLast = a.messages[a.messages.length - 1]?.timestamp || '';
        const bLast = b.messages[b.messages.length - 1]?.timestamp || '';
        return bLast.localeCompare(aLast);
    });
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
                logs.forEach((l: SmsEntry) => all.push({ ...l, studioSlug: slug, studioName: s.studioName }));
            }
        } catch { }
    });
    return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export default function MonitorPage() {
    const [tab, setTab] = useState<MonitorTab>('chats');
    const [chats, setChats] = useState<ChatEntry[]>([]);
    const [smsLogs, setSmsLogs] = useState<SmsEntry[]>([]);
    const [openChat, setOpenChat] = useState<ChatEntry | null>(null);

    useEffect(() => {
        setChats(loadChats());
        setSmsLogs(loadSmsLogs());
    }, []);

    return (
        <div className="space-y-6 animate-fade-up">
            <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Chat & SMS Monitor</h1>
                <p className="text-sm text-zinc-500 mt-1">Read-only access to all studio communications</p>
            </div>

            <div className="flex gap-2">
                {([['chats', 'Chats', MessageSquare], ['sms', 'SMS Logs', Smartphone]] as const).map(([key, label, Icon]) => (
                    <button key={key} onClick={() => setTab(key)}
                        className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all',
                            tab === key ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-zinc-500 hover:text-white bg-zinc-900 border border-zinc-800')}>
                        <Icon className="w-4 h-4" />{label}
                        <span className="ml-1 text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded-md">
                            {key === 'chats' ? chats.length : smsLogs.length}
                        </span>
                    </button>
                ))}
            </div>

            {tab === 'chats' && (
                <div className="grid gap-3">
                    {chats.length === 0 ? (
                        <div className="py-16 text-center bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-600"><MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-30" /><p className="text-sm font-bold">No chats found</p></div>
                    ) : chats.map((chat, i) => {
                        const last = chat.messages[chat.messages.length - 1];
                        return (
                            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                                <button onClick={() => setOpenChat(openChat?.studentId === chat.studentId ? null : chat)}
                                    className="w-full flex items-center gap-4 p-4 hover:bg-zinc-800/30 transition-colors text-left">
                                    <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                        <MessageSquare className="w-4 h-4 text-zinc-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-white">{chat.studentId}</p>
                                        <p className="text-[10px] text-zinc-500 flex items-center gap-1.5"><Building2 className="w-3 h-3" />{chat.studioName}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-xs text-zinc-400 truncate max-w-[150px]">{last?.text?.slice(0, 40)}...</p>
                                        <p className="text-[10px] text-zinc-600 flex items-center gap-1 justify-end mt-0.5"><Clock className="w-2.5 h-2.5" />{last?.timestamp ? new Date(last.timestamp).toLocaleDateString('ka-GE') : ''}</p>
                                    </div>
                                </button>
                                {openChat?.studentId === chat.studentId && (
                                    <div className="border-t border-zinc-800 p-4 space-y-2 max-h-64 overflow-y-auto">
                                        {chat.messages.map((msg, j) => (
                                            <div key={j} className={cn('flex', msg.sender === 'admin' ? 'justify-end' : 'justify-start')}>
                                                <div className={cn('max-w-xs px-3 py-2 rounded-xl text-xs', msg.sender === 'admin' ? 'bg-indigo-500/20 text-indigo-200' : 'bg-zinc-800 text-zinc-300')}>
                                                    <p>{msg.text}</p>
                                                    <p className="text-[9px] opacity-50 mt-0.5">{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === 'sms' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    {smsLogs.length === 0 ? (
                        <div className="py-16 text-center text-zinc-600"><Smartphone className="w-8 h-8 mx-auto mb-3 opacity-30" /><p className="text-sm font-bold">No SMS logs found</p></div>
                    ) : (
                        <div className="divide-y divide-zinc-800/40">
                            {smsLogs.map((log, i) => (
                                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0', log.status === 'success' || log.status === 'DELIVERED' ? 'bg-emerald-400' : 'bg-red-400')} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-white">{log.studentName || log.to}</p>
                                        <p className="text-[10px] text-zinc-500 truncate">{log.text}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-xs text-indigo-400 font-bold">{log.studioName}</p>
                                        <p className="text-[10px] text-zinc-600">{log.timestamp ? new Date(log.timestamp).toLocaleDateString('ka-GE') : ''}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
