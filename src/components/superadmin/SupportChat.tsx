'use client';

import { useState, useEffect, useRef } from 'react';
import { 
    MessageSquare, Smartphone, Building2, Search, Send, 
    AlertCircle, CheckCircle2, Paperclip, X, FileText, Image as ImageIcon, 
    Download
} from 'lucide-react';
import { getStudioRegistry, loadSettings } from '@/lib/settings-store';
import { getSaasReminderSms, getBillingState } from '@/lib/saas-billing';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';

export interface ChatAttachment {
    name: string;
    type: string;
    size: number;
    data: string; // Base64
}

export interface ChatMessage { 
    id: string; 
    text: string; 
    sender: 'admin' | 'student' | 'manager'; 
    senderName?: string; 
    timestamp: string; 
    read?: boolean; 
    attachment?: ChatAttachment;
}

interface ChatEntry { 
    studioSlug: string; 
    studioName: string; 
    studentId: string; 
    messages: ChatMessage[]; 
}

function loadChats(): ChatEntry[] {
    const slugs = getStudioRegistry();
    const all: ChatEntry[] = [];
    
    slugs.forEach(slug => {
        try {
            const s = loadSettings(slug);
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(`chat_${slug}_`) || key === `chat_${slug}_classcore_support`) {
                    const raw = localStorage.getItem(key);
                    if (!raw) continue;
                    
                    try {
                        const msgs = JSON.parse(raw);
                        if (Array.isArray(msgs) && msgs.length > 0) {
                            const studentId = key.replace(`chat_${slug}_`, '');
                            all.push({ 
                                studioSlug: slug, 
                                studioName: s?.studioName || slug, 
                                studentId, 
                                messages: msgs 
                            });
                        }
                    } catch (parseErr) {
                        console.warn(`[SupportChat] Corrupt chat data at ${key}:`, parseErr);
                    }
                }
            }
        } catch (slugErr) {
            console.warn(`[SupportChat] Failed to load chats for slug ${slug}:`, slugErr);
        }
    });

    return all.sort((a, b) => {
        try {
            const aLast = a.messages[a.messages.length - 1]?.timestamp || '';
            const bLast = b.messages[b.messages.length - 1]?.timestamp || '';
            return bLast.localeCompare(aLast);
        } catch {
            return 0;
        }
    });
}

export default function SupportChat({ layout = 'dashboard' }: { layout?: 'dashboard' | 'monitor' }) {
    const { t, lang } = useT();
    const [mounted, setMounted] = useState(false);
    const [chats, setChats] = useState<ChatEntry[]>([]);
    const [openChat, setOpenChat] = useState<ChatEntry | null>(null);
    const [replyInput, setReplyInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [allStudios, setAllStudios] = useState<Array<{ slug: string; name: string }>>([]);
    const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const [showMobileChat, setShowMobileChat] = useState(false);
    const [showInfo, setShowInfo] = useState(true);
    const [smsStatus, setSmsStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [isSmsMode, setIsSmsMode] = useState(false);

    const refresh = () => {
        const loaded = loadChats();
        setChats(loaded);
        const slugs = getStudioRegistry();
        setAllStudios(slugs.map(slug => ({
            slug,
            name: loadSettings(slug).studioName
        })));
        
        if (openChat) {
            const updated = loaded.find(c => c.studioSlug === openChat.studioSlug && c.studentId === openChat.studentId);
            if (updated) setOpenChat(updated);
        }
    };

    useEffect(() => {
        setMounted(true);
        refresh();

        window.addEventListener('storage', refresh);
        const timer = setInterval(refresh, 5000);
        return () => {
            clearInterval(timer);
            window.removeEventListener('storage', refresh);
        };
    }, [openChat?.studioSlug]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [openChat?.messages]);

    const markAsRead = (entry: ChatEntry) => {
        const key = entry.studentId === 'classcore_support' 
            ? `chat_${entry.studioSlug}_classcore_support`
            : `chat_${entry.studioSlug}_${entry.studentId}`;
        
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const msgs = JSON.parse(raw);
                if (Array.isArray(msgs)) {
                    let changed = false;
                    const updated = msgs.map((m: any) => {
                        if (m.read === false && m.sender !== 'student') {
                            changed = true;
                            return { ...m, read: true };
                        }
                        return m;
                    });
                    
                    if (changed) {
                        localStorage.setItem(key, JSON.stringify(updated));
                        window.dispatchEvent(new Event('storage'));
                    }
                }
            }
        } catch {}
    };

    useEffect(() => {
        if (openChat) markAsRead(openChat);
    }, [openChat?.messages.length]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            alert(t.sa_chat_fileTooLarge);
            return;
        }

        const reader = new FileReader();
        reader.onload = (prev) => {
            setAttachment({
                name: file.name,
                type: file.type,
                size: file.size,
                data: prev.target?.result as string
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsDataURL(file);
    };

    const handleSendReply = (entry: ChatEntry) => {
        if (!replyInput.trim() && !attachment) return;

        if (isSmsMode) {
            if (!studioInfo?.ownerPhone) {
                alert(t.sa_chat_phoneNotFound);
                return;
            }
            setSmsStatus('sending');
            fetch('/api/sms/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    to: studioInfo.ownerPhone.replace(/\s/g, ''), 
                    text: replyInput,
                    studentName: t.sa_chat_owner
                })
            }).then(res => {
                if (res.ok) {
                    setSmsStatus('success');
                    setTimeout(() => setSmsStatus('idle'), 3000);
                    const smsLog: ChatMessage = {
                        id: Date.now().toString(),
                        text: `[SMS ${t.sa_chat_smsLogSent}]: ${replyInput}`,
                        sender: 'student',
                        senderName: t.sa_chat_systemSmsLabel,
                        timestamp: new Date().toISOString()
                    };
                    const key = entry.studentId === 'classcore_support' 
                        ? `chat_${entry.studioSlug}_classcore_support`
                        : `chat_${entry.studioSlug}_${entry.studentId}`;
                    const existing = JSON.parse(localStorage.getItem(key) || '[]');
                    localStorage.setItem(key, JSON.stringify([...existing, smsLog]));
                    setReplyInput('');
                    window.dispatchEvent(new Event('storage'));
                    refresh();
                } else {
                    setSmsStatus('error');
                    setTimeout(() => setSmsStatus('idle'), 3000);
                }
            });
            return;
        }

        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            text: replyInput,
            sender: 'student',
            senderName: t.sa_chat_supportName,
            read: false,
            timestamp: new Date().toISOString(),
            attachment: attachment || undefined
        };

        const key = entry.studentId === 'classcore_support' 
            ? `chat_${entry.studioSlug}_classcore_support`
            : `chat_${entry.studioSlug}_${entry.studentId}`;
             
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        localStorage.setItem(key, JSON.stringify([...existing, newMessage]));
        
        setReplyInput('');
        setAttachment(null);
        window.dispatchEvent(new Event('storage'));
        refresh();
    };

    if (!mounted) return null;

    const studioInfo = openChat ? (() => {
        try {
            const s = loadSettings(openChat.studioSlug);
            const staff = Array.isArray(s?.staff) ? s.staff : [];
            const owner = staff.find(m => m.role === 'owner') || staff[0];
            const state = getBillingState(openChat.studioSlug);
            let studentCount = 0;
            try { 
                const rawData = localStorage.getItem(`cc_student_data_${openChat.studioSlug}`);
                if (rawData) {
                    const parsed = JSON.parse(rawData);
                    if (parsed && typeof parsed === 'object') {
                        studentCount = Object.keys(parsed).length;
                    }
                }
            } catch {}
            
            let plan = 'trial';
            try {
                const metaRaw = localStorage.getItem(`cc_sa_meta_${openChat.studioSlug}`);
                if (metaRaw) {
                    const meta = JSON.parse(metaRaw);
                    plan = meta?.plan || 'trial';
                }
            } catch {}
            if (openChat.studioSlug === 'demo.classcore.ge') plan = 'trial';

            return {
                ownerName: owner?.full_name || 'N/A',
                ownerPhone: owner?.phone || 'N/A',
                ownerEmail: owner?.email || 'N/A',
                balance: state?.accountBalance || 0,
                plan,
                students: studentCount
            };
        } catch (err) {
            console.error('[SupportChat] Failed to generate studioInfo:', err);
            return { ownerName: 'Error', ownerPhone: 'N/A', ownerEmail: 'N/A', balance: 0, plan: 'unknown', students: 0 };
        }
    })() : null;

    return (
        <div className={cn("flex flex-col h-full bg-white dark:bg-zinc-900 border-none lg:rounded-3xl overflow-hidden transition-all duration-500", 
            layout === 'dashboard' ? 'h-full' : 'h-full md:h-[800px]')}>
            
            <div className="p-4 md:p-6 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 flex-shrink-0">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-sm md:text-base font-black text-primary dark:text-white tracking-tight leading-none uppercase">{t.sa_chat_title}</h2>
                        <p className="hidden md:block text-[10px] text-muted font-bold uppercase tracking-widest mt-1 opacity-40">{t.sa_chat_desc}</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className={cn("relative transition-all duration-300", searchQuery ? "w-64" : "w-10 md:w-64")}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted opacity-40" />
                        <input 
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={t.sa_chat_searchPlaceholder}
                            className={cn("w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl pl-9 pr-4 py-2 text-[11px] text-primary dark:text-white placeholder:text-muted/40 focus:border-indigo-500/50 outline-none transition-all",
                                !searchQuery && "md:opacity-100 opacity-0 focus:opacity-100")}
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className={cn("flex flex-col bg-black/[0.01] dark:bg-white/[0.01] divide-y divide-black/5 dark:divide-white/5 overflow-y-auto no-scrollbar transition-all duration-300",
                    showMobileChat ? "hidden md:flex md:w-80 border-r border-black/5 dark:border-white/5" : "flex-1 md:w-80 md:flex-none md:border-r border-black/5 dark:border-white/5")}>
                    {chats.length === 0 ? (
                        <div className="p-20 text-center opacity-20">
                            <MessageSquare className="w-10 h-10 mx-auto mb-2 text-muted" />
                            <p className="text-[10px] font-black uppercase tracking-widest">{t.sa_chat_noChats}</p>
                        </div>
                    ) : chats.map((chat, i) => {
                        const last = chat.messages[chat.messages.length - 1];
                        const isUnread = chat.messages.some(m => !m.read && m.sender !== 'student');
                        const isActive = openChat?.studioSlug === chat.studioSlug && openChat?.studentId === chat.studentId;
                        
                        return (
                            <button 
                                key={i}
                                onClick={() => { setOpenChat(chat); setShowMobileChat(true); }}
                                className={cn("w-full px-5 py-5 text-left transition-all relative group",
                                    isActive ? "bg-indigo-500/10 border-l-2 border-l-indigo-500" : "hover:bg-black/[0.03] dark:hover:bg-white/5",
                                    isUnread && "bg-red-500/[0.03]")}
                            >
                                <div className="flex items-center gap-3 mb-1">
                                    <div className={cn("w-2 h-2 rounded-full", isUnread ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-muted opacity-20")} />
                                    <p className="text-xs font-black text-primary group-hover:text-indigo-400 transition-colors truncate">{chat.studioName}</p>
                                </div>
                                <div className="flex justify-between items-end pl-5">
                                    <p className="text-[10px] text-muted font-bold truncate pr-4 opacity-40">{last?.text || (last?.attachment ? t.sa_chat_attachment : t.sa_chat_noMessages)}</p>
                                    <p className="text-[9px] text-muted opacity-20 font-black shrink-0">{last?.timestamp ? new Date(last.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className={cn("flex-1 flex flex-col bg-white dark:bg-white/[0.01] relative transition-all duration-300 backdrop-blur-md",
                    !showMobileChat ? "hidden md:flex" : "flex")}>
                    {!openChat ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-30 select-none">
                            <div className="w-20 h-20 rounded-[2.5rem] bg-black/5 dark:bg-white/5 flex items-center justify-center mb-6 border border-black/5 dark:border-white/10 shadow-sm">
                                <MessageSquare className="w-8 h-8 text-muted" />
                            </div>
                            <h3 className="text-sm font-black text-primary dark:text-white uppercase tracking-[0.2em] mb-2">{t.sa_chat_selectStudio}</h3>
                            <p className="text-xs font-bold text-muted max-w-[200px]">{t.sa_chat_selectStudioDesc}</p>
                        </div>
                    ) : (
                        <>
                            <div className="px-4 md:px-6 py-4 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setShowMobileChat(false)} className="md:hidden p-2 bg-black/5 dark:bg-white/5 rounded-xl text-muted">
                                        <X className="w-4 h-4 rotate-45" />
                                    </button>
                                    <div className="min-w-0">
                                        <h3 className="text-xs font-black text-primary truncate">{openChat?.studioName}</h3>
                                        <p className="text-[9px] text-muted font-bold uppercase tracking-wider truncate opacity-40">{openChat?.studentId === 'classcore_support' ? t.sa_chat_officialSupport : openChat?.studentId}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setShowInfo(!showInfo)}
                                        className={cn("hidden lg:flex px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all items-center gap-2 border shadow-sm",
                                            showInfo ? "bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/20" : "bg-black/5 dark:bg-white/5 text-muted border-black/5 dark:border-white/10")}
                                    >
                                        {t.sa_chat_info}
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (!openChat) return;
                                            const s = loadSettings(openChat.studioSlug);
                                            setReplyInput(getSaasReminderSms(s.language || 'ka', 0));
                                        }}
                                        className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[10px] font-black uppercase transition-all flex items-center gap-2 border border-amber-500/20"
                                    >
                                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                        <span className="hidden xs:inline">{t.sa_chat_reminder}</span>
                                    </button>
                                </div>
                            </div>

                            <div ref={scrollRef} className="flex-1 p-4 md:p-6 space-y-4 overflow-y-auto no-scrollbar">
                                {openChat.messages.length === 0 && (
                                    <div className="text-center py-10 opacity-10">
                                        <p className="text-[10px] font-black uppercase tracking-widest italic">{t.sa_chat_convoStart}</p>
                                    </div>
                                )}
                                {openChat.messages.map((msg, i) => {
                                    const isSupport = msg.sender === 'student';
                                    return (
                                        <div key={i} className={cn("flex flex-col gap-1", isSupport ? "items-end" : "items-start")}>
                                            {msg.text && (
                                                <div className={cn("max-w-[90%] md:max-w-[80%] px-4 py-3 rounded-2xl text-[13px] md:text-xs shadow-xl leading-relaxed transition-all",
                                                    isSupport ? "bg-indigo-600 text-white rounded-br-none shadow-indigo-500/20" : "bg-white dark:bg-white/10 text-primary dark:text-white rounded-bl-none border border-white/10 shadow-black/5")}>
                                                    {msg.text}
                                                </div>
                                            )}
                                            {msg.attachment && (
                                                <div className={cn("max-w-[90%] md:max-w-[80%] p-2 rounded-2xl border bg-white/5 border-white/10 shadow-sm overflow-hidden group/attach",
                                                    isSupport ? "rounded-br-none" : "rounded-bl-none")}>
                                                    {msg.attachment.type.startsWith('image/') ? (
                                                        <div className="relative">
                                                            <img src={msg.attachment.data} alt={msg.attachment.name} className="max-w-full rounded-xl max-h-60 object-cover" />
                                                            <a href={msg.attachment.data} download={msg.attachment.name} 
                                                               className="absolute inset-0 bg-black/60 opacity-0 group-hover/attach:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-black text-[10px] uppercase">
                                                                <Download className="w-4 h-4" /> {t.download}
                                                            </a>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-3 p-2 pr-4 min-w-[200px]">
                                                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted">
                                                                <FileText className="w-5 h-5" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[10px] font-black text-primary truncate">{msg.attachment.name}</p>
                                                                <p className="text-[9px] text-muted font-bold">{(msg.attachment.size/1024).toFixed(1)} KB</p>
                                                            </div>
                                                            <a href={msg.attachment.data} download={msg.attachment.name} className="p-2 hover:bg-white/5 rounded-lg text-muted transition-colors">
                                                                <Download className="w-4 h-4" />
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 px-1">
                                                <span className="text-[9px] text-muted opacity-40 font-black uppercase tracking-tight">
                                                    {isSupport ? t.sa_chat_supportLabel : t.sa_chat_adminLabel} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {isSupport && msg.read && <CheckCircle2 className="w-2.5 h-2.5 text-indigo-500 opacity-60" />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="p-4 border-t border-black/5 dark:border-white/10 bg-black/[0.01] dark:bg-black/40 backdrop-blur-xl">
                                {attachment && (
                                    <div className="mb-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3 flex items-center justify-between ring-1 ring-indigo-500/10">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-500 flex-shrink-0">
                                                {attachment.type.startsWith('image/') ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                            </div>
                                            <div className="min-w-0 pr-4">
                                                <p className="text-[11px] font-black text-primary dark:text-white truncate">{attachment.name}</p>
                                                <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold uppercase">{t.sa_chat_readyToSend}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setAttachment(null)} className="p-2 hover:bg-red-500/10 hover:text-red-500 text-muted transition-all rounded-xl flex-shrink-0">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-muted transition-all active:scale-90 shadow-sm"
                                    >
                                        <Paperclip className="w-5 h-5" />
                                    </button>
                                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                                    
                                    <div className="flex-1 relative">
                                        <textarea 
                                            value={replyInput}
                                            onChange={e => setReplyInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(openChat!); } }}
                                            placeholder={t.sa_chat_typeReply}
                                            rows={1}
                                            className="w-full bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl px-5 py-3.5 text-[13px] md:text-xs text-primary dark:text-white placeholder:text-muted/40 outline-none focus:border-indigo-500/50 transition-all resize-none shadow-sm min-h-[48px] max-h-32 pt-3.5"
                                        />
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleSendReply(openChat!)}
                                            disabled={(!replyInput.trim() && !attachment) || smsStatus === 'sending'}
                                            className={cn("p-4 md:p-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl transition-all shadow-xl shadow-indigo-600/20 active:scale-95",
                                                ((!replyInput.trim() && !attachment) || smsStatus === 'sending') && "opacity-50 grayscale cursor-not-allowed")}
                                        >
                                            <Send className="w-5 h-5" />
                                        </button>
                                        <button 
                                            onClick={() => { setIsSmsMode(true); setTimeout(() => handleSendReply(openChat!), 0); setIsSmsMode(false); }}
                                            disabled={!replyInput.trim() || smsStatus === 'sending'}
                                            className={cn("p-4 md:p-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl transition-all shadow-xl shadow-amber-500/20 active:scale-95",
                                                (!replyInput.trim() || smsStatus === 'sending') && "opacity-50 grayscale cursor-not-allowed")}
                                        >
                                            <Smartphone className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {openChat && showInfo && studioInfo && (
                    <div className="hidden lg:flex w-72 border-l border-black/5 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.01] flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-6 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                            <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-4 opacity-40">{t.sa_chat_studioProfile}</h4>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[9px] text-muted font-bold uppercase mb-1 opacity-40">{t.sa_chat_owner}</p>
                                    <p className="text-sm font-black text-primary dark:text-white">{studioInfo?.ownerName}</p>
                                    <p className="text-[10px] text-muted font-black flex items-center gap-1.5 mt-0.5 opacity-60">
                                        <Smartphone className="w-3 h-3 text-indigo-500" /> {studioInfo?.ownerPhone}
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div className="bg-white/5 border border-white/10 p-3 rounded-2xl text-center shadow-sm">
                                        <p className="text-[8px] text-muted font-black uppercase mb-1 opacity-40">{t.sa_chat_balance}</p>
                                        <p className="text-xs font-black text-emerald-400 tabular-nums">{Math.round(studioInfo?.balance || 0)} ₾</p>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 p-3 rounded-2xl text-center shadow-sm">
                                        <p className="text-[8px] text-muted font-black uppercase mb-1 opacity-40">{t.sa_chat_students}</p>
                                        <p className="text-xs font-black text-primary dark:text-white tabular-nums">{studioInfo?.students}</p>
                                    </div>
                                </div>
                                <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 opacity-10"><Building2 className="w-8 h-8" /></div>
                                    <p className="text-[8px] text-indigo-600 dark:text-indigo-500 font-black uppercase mb-1">{t.sa_chat_plan}</p>
                                    <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{studioInfo?.plan === 'trial' ? t.sa_chat_trial : studioInfo?.plan.toUpperCase()}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 p-6 space-y-4 overflow-y-auto no-scrollbar">
                            <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-4 opacity-40">{t.sa_chat_quickActions}</h4>
                            <div className="space-y-3">
                                <button 
                                    onClick={() => setReplyInput(`${t.sa_chat_greeting} ${studioInfo?.ownerName?.split(' ')[0] || ''}, `)}
                                    className="w-full p-4 bg-white/5 hover:bg-white/10 text-xs font-black text-primary dark:text-white rounded-2xl text-left transition-all flex items-center gap-3 border border-white/10 group shadow-sm"
                                >
                                    <Send className="w-3.5 h-3.5 text-muted group-hover:text-indigo-400 transition-colors" />
                                    {t.sa_chat_greeting}
                                </button>
                                
                                <div className="pt-2">
                                    <button 
                                        disabled={smsStatus === 'sending'}
                                        onClick={() => {
                                            if (!openChat || !studioInfo) return;
                                            setIsSmsMode(true);
                                            handleSendReply(openChat);
                                            setIsSmsMode(false);
                                        }}
                                        className={cn("w-full p-4 text-xs font-black rounded-2xl text-left transition-all flex items-center gap-3 border shadow-sm",
                                            smsStatus === 'idle' ? "bg-white/5 hover:bg-white/10 text-primary border-white/10" :
                                            smsStatus === 'sending' ? "bg-white/10 text-muted border-white/20 cursor-wait" :
                                            smsStatus === 'success' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                            "bg-red-500/10 text-red-500 border-red-500/20"
                                        )}
                                    >
                                        <Smartphone className="w-3.5 h-3.5" />
                                        <span>
                                            {smsStatus === 'idle' ? t.sa_chat_sendSms :
                                             smsStatus === 'sending' ? t.sa_chat_sending :
                                             smsStatus === 'success' ? t.sa_chat_sent : t.sa_chat_error}
                                        </span>
                                    </button>
                                    <p className="text-[9px] text-muted mt-2 px-1 font-bold italic opacity-20">* {t.sa_chat_smsCostNote}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
