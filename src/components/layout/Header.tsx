'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
    Menu, Bell, X, Trash2, CheckCircle2, MessageSquare, Send, Search, Users, 
    User as UserIcon, ChevronRight, Pin, LogOut, Plus, Building2, Check, 
    ExternalLink, Shield, Paperclip, FileText, Image as ImageIcon, Download 
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useMobileMenu } from '@/contexts/MobileMenuContext';
import { useT } from '@/contexts/LanguageContext';
import { useUser } from '@/hooks/useUser';
import { useStudio } from '@/contexts/StudioContext';
import { getNotifications, markAsRead, clearAll, addNotification, type Notification } from '@/lib/notification-store';
import { cn } from '@/lib/utils';
import { getStudents } from '@/lib/student-store';
import { getGroups } from '@/lib/group-store';
import { getTeachers } from '@/lib/teacher-store';
import { addIndividualLesson } from '@/lib/event-store';
import { saveSubscription } from '@/lib/subscription-store';
import { getLocalISODate } from '@/lib/utils';
import { THEMES } from '@/lib/settings-store';
import type { Student } from '@/types';
import type { Group } from '@/lib/group-store';
import { NotesDrawer } from '@/components/dashboard/NotesDrawer';

interface ChatAttachment {
    name: string;
    type: string;
    size: number;
    data: string; // Base64
}

interface ChatMessage {
    id: string;
    text: string;
    sender: 'student' | 'manager';
    senderName?: string;
    read?: boolean;
    timestamp: string;
    attachment?: ChatAttachment;
    metadata?: {
        type: 'lesson_request' | 'lesson_proposal' | 'lesson_confirmed';
        status?: 'pending' | 'proposed' | 'confirmed' | 'cancelled';
        slots: Array<{ date: string, time: string }>;
        teacherId?: string;
        style?: string;
        studentId?: string;
        studentName?: string;
        hallId?: string;
        hallName?: string;
    };
}

const SUPPORT_CHAT_ID = 'classcore_support';

export function Header() {
    const pathname = usePathname();
    const { toggle } = useMobileMenu();
    const { user, profile, loading, logout } = useUser();
    const { settings, activeBranchId, addBranch, setActiveBranch } = useStudio();
    const { t, lang } = useT();
    const [notifOpen, setNotifOpen] = useState(false);
    const [messengerOpen, setMessengerOpen] = useState(false);
    const [notesOpen, setNotesOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'private' | 'group' | 'support'>('private');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const [chatInput, setChatInput] = useState('');
    const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [calLabel, setCalLabel] = useState('');
    const [uncompletedNotesCount, setUncompletedNotesCount] = useState(0);
    const [profileOpen, setProfileOpen] = useState(false);
    const [branchModalOpen, setBranchModalOpen] = useState(false);
    const [newBranchName, setNewBranchName] = useState('');
    const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');

    const students = getStudents();
    const groups = getGroups();

    // Calculate unread counts
    const updateUnreadCounts = () => {
        const counts: Record<string, number> = {};
        const prefix = `chat_${settings.studioSlug}_`;
        const groupPrefix = `group_chat_${settings.studioSlug}_`;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(prefix) || key?.startsWith(groupPrefix)) {
                try {
                    const chatId = key.replace(prefix, '').replace(groupPrefix, '');
                    const msgs = JSON.parse(localStorage.getItem(key) || '[]') as ChatMessage[];
                    const unread = msgs.filter(m => m.sender === 'student' && !m.read).length;
                    if (unread > 0) counts[chatId] = unread;
                } catch (e) { console.error(e); }
            }
        }
        setUnreadCounts(counts);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            alert('File too large (max 2MB)');
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
        };
        reader.readAsDataURL(file);
    };

    const updateNotesCount = () => {
        const key = `cc_notes_${settings.studioSlug || 'global'}`;
        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                const notes = JSON.parse(saved);
                const uncompleted = notes.filter((n: any) => !n.completed).length;
                setUncompletedNotesCount(uncompleted);
            } else {
                setUncompletedNotesCount(0);
            }
        } catch (e) {
            setUncompletedNotesCount(0);
        }
    };

    useEffect(() => {
        updateUnreadCounts();
        updateNotesCount();
    }, [messengerOpen, notesOpen, settings.studioSlug]);

    const getLastMessageTime = (chatId: string, type: 'private' | 'group') => {
        const key = type === 'private'
            ? `chat_${settings.studioSlug}_${chatId}`
            : `group_chat_${settings.studioSlug}_${chatId}`;
        try {
            const msgs = JSON.parse(localStorage.getItem(key) || '[]') as ChatMessage[];
            return msgs.length > 0 ? new Date(msgs[msgs.length - 1].timestamp).getTime() : 0;
        } catch {
            return 0;
        }
    };

    // Load messages when selectedChatId changes
    useEffect(() => {
        if (!selectedChatId) return;
        const key = activeTab === 'private'
            ? `chat_${settings.studioSlug}_${selectedChatId}`
            : `group_chat_${settings.studioSlug}_${selectedChatId}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            const msgs = JSON.parse(saved) as ChatMessage[];
            // Mark all as read
            const updated = msgs.map(m => m.sender === 'student' ? { ...m, read: true } : m);
            setMessages(updated);
            localStorage.setItem(key, JSON.stringify(updated));
            updateUnreadCounts();
        } else {
            setMessages([]);
        }
    }, [selectedChatId, activeTab, settings.studioSlug]);

    useEffect(() => {
        const checkBroadcast = () => {
            try {
                const b = JSON.parse(localStorage.getItem('cc_sa_broadcast') || 'null');
                if (b) {
                    const dismissedKey = `cc_dismissed_bc_${b.id}`;
                    const notifAddedKey = `cc_notif_added_${b.id}`;
                    const dismissed = localStorage.getItem(dismissedKey);
                    const notifAdded = localStorage.getItem(notifAddedKey);

                    if (!dismissed && !notifAdded) {
                        const title = (b as any)[`title_${lang}`] || b.title_ka || b.title_en;
                        const body = (b as any)[`body_${lang}`] || b.body_ka || b.body_en;

                        addNotification({
                            title: `📢 ${title}`,
                            message: body,
                            type: 'info'
                        });

                        localStorage.setItem(notifAddedKey, 'true');
                        setNotifications(getNotifications());
                    }
                }
            } catch (e) {
                console.error("Broadcast check failed", e);
            }
        };

        checkBroadcast();
        const interval = setInterval(checkBroadcast, 30000);
        window.addEventListener('storage', checkBroadcast);
        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', checkBroadcast);
        };
    }, [lang, settings.studioSlug]);

    useEffect(() => {
        const handleToggleSupport = () => {
            setMessengerOpen(true);
            setActiveTab('support');
            setSelectedChatId(SUPPORT_CHAT_ID);
        };
        window.addEventListener('toggle-support', handleToggleSupport);
        return () => window.removeEventListener('toggle-support', handleToggleSupport);
    }, []);

    // Sync with other tabs (Student Portal)
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            updateUnreadCounts();
            updateNotesCount();
            if (!selectedChatId) return;
            const key = activeTab === 'private'
                ? `chat_${settings.studioSlug}_${selectedChatId}`
                : `group_chat_${settings.studioSlug}_${selectedChatId}`;
            if (e.key === key && e.newValue) {
                const msgs = JSON.parse(e.newValue) as ChatMessage[];
                // If this chat is active, mark incoming as read
                const updated = msgs.map(m => m.sender === 'student' ? { ...m, read: true } : m);
                setMessages(updated);
                
                // Only update localStorage if we actually changed something to avoid infinite loops
                const hasUnread = msgs.some(m => m.sender === 'student' && !m.read);
                if (hasUnread) {
                    localStorage.setItem(key, JSON.stringify(updated));
                }
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [selectedChatId, activeTab, settings.studioSlug]);

    const handleSendMessage = () => {
        if ((!chatInput.trim() && !attachment) || !selectedChatId) return;
        
        const isSupport = selectedChatId === SUPPORT_CHAT_ID;
        
        const msg: ChatMessage = {
            id: Date.now().toString(),
            text: chatInput,
            attachment: attachment || undefined,
            sender: 'manager',
            read: isSupport ? false : true, // Support messages are unread for SuperAdmin
            timestamp: new Date().toISOString()
        };

        const updated = [...messages, msg];
        setMessages(updated);
        
        const key = activeTab === 'private'
            ? `chat_${settings.studioSlug}_${selectedChatId}`
            : `group_chat_${settings.studioSlug}_${selectedChatId}`;
        
        localStorage.setItem(key, JSON.stringify(updated));
        setChatInput('');
        setAttachment(null);

        // Notify SuperAdmin (Dispatch storage event for cross-tab updates)
        window.dispatchEvent(new Event('storage'));

        // Simulated Email Notification to SuperAdmin
        if (isSupport) {
            console.log(`[SIMULATED EMAIL] To: adminclasscore@gmail.com | Subject: New Support Message from ${settings.studioName} | Content: ${chatInput}`);
            // In a real app, this would be a fetch to an API route:
            // fetch('/api/notify/support', { method: 'POST', body: JSON.stringify({ studio: settings.studioName, text: chatInput }) });
        }

        // Keep the local auto-reply for better UX if needed, but SuperAdmin can now reply for real
        if (isSupport && messages.length === 0) {
            setTimeout(() => {
                const replyMsg: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    text: t.chatWelcome,
                    sender: 'student',
                    senderName: 'ClassCore Support',
                    read: false,
                    timestamp: new Date().toISOString()
                };
                const final = [...updated, replyMsg];
                setMessages(final);
                localStorage.setItem(key, JSON.stringify(final));
                window.dispatchEvent(new Event('storage'));
            }, 1000);
        }
    };

    const handleApproveLesson = (msgId: string) => {
        if (!selectedChatId) return;
        const msgIndex = messages.findIndex(m => m.id === msgId);
        if (msgIndex === -1) return;

        const msg = messages[msgIndex];
        if (!msg.metadata || msg.metadata.type !== 'lesson_request' || !msg.metadata.slots) return;

        // Create events for each slot
        const teacherId = msg.metadata.teacherId || '';
        const title = msg.metadata.style ? `${msg.metadata.style} (${t.individual})` : t.individual;
        const studentObj = students.find(s => s.id === selectedChatId);
        const studentName = studentObj?.full_name || `${studentObj?.first_name} ${studentObj?.last_name}` || selectedChatId;

        msg.metadata.slots.forEach(slot => {
            const endHour = String(parseInt(slot.time.split(':')[0]) + 1).padStart(2, '0') + ':00';
            const hallIdToUse = msg.metadata?.hallId || 'h1';

            addIndividualLesson(
                selectedChatId,
                title,
                teacherId,
                slot.date,
                slot.time,
                endHour,
                hallIdToUse,
                settings.studioSlug
            );

            // Also create a 1-session active subscription for this lesson for billing tracking
            saveSubscription(selectedChatId, {
                id: `ind_sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                student_id: selectedChatId,
                plan: title,
                sessions_used: 0,
                sessions_total: 1,
                status: 'active',
                expires_at: slot.date,
                purchased_at: getLocalISODate(),
                type: 'sessions',
                plan_type: 'individual'
            });
        });

        // Update main message status
        const updatedMessages = [...messages];
        updatedMessages[msgIndex] = {
            ...msg,
            metadata: {
                ...msg.metadata,
                status: 'confirmed'
            }
        };

        // Add auto-reply
        const replyMsg: ChatMessage = {
            id: Date.now().toString(),
            text: `${t.confirmed} (${msg.metadata.slots.length} ${t.sessionsShort}).`,
            sender: 'manager',
            read: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        updatedMessages.push(replyMsg);

        setMessages(updatedMessages);
        const key = `chat_${settings.studioSlug}_${selectedChatId}`;
        localStorage.setItem(key, JSON.stringify(updatedMessages));
    };

    useEffect(() => {
        setNotifications(getNotifications());
    }, [notifOpen]);

    // Read calendar label from localStorage (written by CalendarPage)
    useEffect(() => {
        const readLabel = () => setCalLabel(localStorage.getItem('cc_cal_header_label') ?? '');
        readLabel();
        window.addEventListener('storage', readLabel);
        return () => window.removeEventListener('storage', readLabel);
    }, [pathname]);

    // Track Cloud Sync Status
    useEffect(() => {
        const handleSyncOk = (e: any) => {
            setLastSyncTime(e.detail?.time || new Date().toISOString());
            setSyncStatus('synced');
            // Flash success state if it was syncing
        };
        const handleSyncStart = () => setSyncStatus('syncing');
        
        window.addEventListener('cc_sync_push_ok', handleSyncOk);
        window.addEventListener('cc_sync_pull_ok', handleSyncOk);
        window.addEventListener('cc_instant_sync_request', handleSyncStart);
        
        return () => {
            window.removeEventListener('cc_sync_push_ok', handleSyncOk);
            window.removeEventListener('cc_sync_pull_ok', handleSyncOk);
            window.removeEventListener('cc_instant_sync_request', handleSyncStart);
        };
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    // Derive page title from t.* translations using pathname
    const PAGE_TITLES: Record<string, string> = {
        '/dashboard': t.dashboard,
        '/students': t.students,
        '/attendance': t.attendance,
        '/groups': t.groups,
        '/settings': t.settings,
        '/calendar': t.calendar,
        '/teachers': t.teachers,
        '/halls': t.halls,
        '/hall-rental': t.hallRental,
        '/subscriptions': t.subscriptions,
        '/analytics': t.analytics,
        '/billing': t.billing,
        '/shop': t.shop,
        '/sms-manager': t.smsManager || 'SMS მენეჯერი',
        '/history': t.history,
        '/trash': t.trash,
    };

    const rawTitle = Object.entries(PAGE_TITLES).find(([key]) =>
        pathname.startsWith(key)
    )?.[1] ?? t.dashboard;

    const isDashboard = pathname === '/dashboard' || pathname === '/';
    const isCalendar = pathname.startsWith('/calendar');
    const displayTitle = isDashboard ? null : isCalendar && calLabel ? calLabel : rawTitle;

    useEffect(() => {
        if (typeof document !== 'undefined') {
            const pageName = displayTitle || rawTitle;
            const studioName = settings?.studioName || 'ClassCore';
            document.title = pageName ? `${pageName} | ${studioName}` : studioName;
        }
    }, [displayTitle, rawTitle, settings?.studioName]);

    const handleMarkRead = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        markAsRead(id);
        setNotifications(getNotifications());
    };

    const handleClearAll = () => {
        clearAll();
        setNotifications([]);
    };

    const activeBranchName = settings.branches.find(b => b.id === activeBranchId)?.name || 'Main Branch';

    return (
        <>
            <style jsx global>{`
                @keyframes pulse-slow {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.3; transform: scale(0.85); }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 4s ease-in-out infinite;
                }
            `}</style>
            <header className="sticky top-0 z-[30] h-14 md:h-16 bg-white/90 backdrop-blur-lg border-b border-border-subtle flex items-center px-4 md:px-6 transition-all duration-300 w-full flex-shrink-0">
                <div className="w-full flex items-center justify-between relative">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggle}
                            className="md:hidden p-2 -ml-1 text-primary/80 hover:text-primary transition-colors bg-surface/50 rounded-xl"
                            aria-label="Menu"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Centered Page Title */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none whitespace-nowrap">
                        <h1 className="text-[12px] md:text-sm font-black text-primary tracking-tight md:tracking-wider truncate max-w-[140px] md:max-w-[300px] uppercase">
                            {displayTitle || rawTitle || (isDashboard ? t.dashboard : '')}
                        </h1>
                    </div>

                    <div className="flex items-center gap-0 md:gap-2 pr-0 sm:pr-2">
                        <button
                            onClick={() => {
                                setNotesOpen(true);
                                setMessengerOpen(false);
                                setNotifOpen(false);
                            }}
                            className="relative w-7 h-7 md:w-11 md:h-11 flex items-center justify-center rounded-xl text-primary/60 hover:text-primary hover:bg-surface active:bg-surface transition-colors touch-manipulation"
                            aria-label="Notes"
                        >
                            <Pin className="w-4 h-4 md:w-5 h-5 -rotate-45" />
                            {uncompletedNotesCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 md:top-3 md:right-3 w-1 h-1 rounded-full bg-amber-500 ring-2 ring-card shadow-sm" />
                            )}
                        </button>

                        <button
                            onClick={() => {
                                setMessengerOpen(true);
                                setNotifOpen(false);
                                setNotesOpen(false);
                            }}
                            className="relative w-7 h-7 md:w-11 md:h-11 flex items-center justify-center rounded-xl text-primary/60 hover:text-primary hover:bg-surface active:bg-surface transition-colors touch-manipulation"
                            aria-label="Messenger"
                        >
                            <MessageSquare className="w-4 h-4 md:w-5 h-5" />
                            {Object.values(unreadCounts).reduce((a, b) => a + b, 0) > 0 && (
                                <span className={cn(
                                    "absolute top-1.5 right-1.5 md:top-3 md:right-3 w-1 h-1 rounded-full ring-2 ring-card shadow-sm",
                                    unreadCounts[SUPPORT_CHAT_ID] ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-emerald-500"
                                )} />
                            )}
                        </button>

                        <button
                            onClick={() => {
                                setNotifOpen((v: boolean) => !v);
                                setMessengerOpen(false);
                                setNotesOpen(false);
                            }}
                            className="relative w-7 h-7 md:w-11 md:h-11 flex items-center justify-center rounded-xl text-primary/60 hover:text-primary hover:bg-surface active:bg-surface transition-colors touch-manipulation"
                            aria-label="Notifications"
                        >
                            <Bell className="w-4 h-4 md:w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 md:top-3 md:right-3 w-1 h-1 rounded-full bg-red-500 ring-2 ring-card shadow-sm" />
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* New Branch Modal */}
            {branchModalOpen && (
                <>
                    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setBranchModalOpen(false)} />
                    <div className={cn(
                        "fixed z-[101] flex flex-col bg-card shadow-2xl transition-all duration-300 overflow-hidden",
                        "inset-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-[2.5rem]",
                        "animate-in zoom-in-95 sm:zoom-in-95"
                    )}>
                        {/* Header */}
                        <div className="p-6 border-b border-border-subtle bg-card/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between sm:hidden">
                            <h2 className="text-sm font-black text-primary uppercase tracking-widest">{t.newBranch}</h2>
                            <button onClick={() => setBranchModalOpen(false)} className="p-2 text-muted"><Plus className="w-5 h-5 rotate-45" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-6 overscroll-contain">
                            <div className="flex flex-col items-center text-center gap-2">
                                <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-2">
                                    <Building2 className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-black text-primary tracking-tight">{t.newBranch}</h3>
                                <p className="text-xs font-bold text-muted px-4 leading-relaxed opacity-60">
                                    {t.enterBranchName}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="relative group">
                                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-indigo-500 transition-colors" />
                                    <input
                                        autoFocus
                                        value={newBranchName}
                                        onChange={e => setNewBranchName(e.target.value)}
                                        placeholder={t.branchNamePlaceholder}
                                        className="w-full bg-surface border border-border-subtle rounded-2xl pl-11 pr-4 py-4 text-[12px] sm:text-sm font-black focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-inner"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-card/80 backdrop-blur-md border-t border-border-subtle flex gap-3 sticky bottom-0 z-10 pb-safe-offset-2">
                            <button
                                onClick={() => {
                                    setBranchModalOpen(false);
                                    setNewBranchName('');
                                }}
                                className="flex-1 py-4 text-xs font-black text-muted hover:bg-surface rounded-2xl transition-colors"
                            >
                                {t.cancel}
                            </button>
                            <button
                                onClick={() => {
                                    if (!newBranchName.trim()) return;
                                    addBranch(newBranchName.trim());
                                    setBranchModalOpen(false);
                                    setNewBranchName('');
                                }}
                                className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl active:scale-95 transition-all tracking-widest"
                            >
                                {t.add}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {notifOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                        onClick={() => setNotifOpen(false)}
                    />
                    <div className="fixed top-0 right-0 h-full w-full md:w-80 z-50 bg-card border-l border-border-subtle shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface/30">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shadow-inner">
                                    <Bell className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                    <p className="text-base font-black text-primary leading-tight">{t.notifications}</p>
                                    <p className="text-[10px] text-muted font-bold tracking-tight opacity-70 uppercase">{t.recentActivity || 'Recent Activity'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {notifications.length > 0 && (
                                    <button onClick={handleClearAll} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition-all">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={() => setNotifOpen(false)}
                                    className="w-8 h-8 flex items-center justify-center rounded-xl text-muted hover:text-primary hover:bg-surface transition-colors touch-manipulation">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto divide-y divide-border-subtle/50 no-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-muted opacity-30">
                                    <Bell className="w-10 h-10 mb-2" />
                                    <p className="text-xs font-bold">{t.noNotifications}</p>
                                </div>
                            ) : (
                                notifications.map(n => (
                                    <div
                                        key={n.id}
                                        className={cn(
                                            "flex items-start gap-4 px-5 py-5 hover:bg-surface/50 transition-colors relative group",
                                            !n.read && "bg-indigo-500/[0.02]"
                                        )}
                                    >
                                        <span className={cn("w-2 h-2 rounded-full mt-2 flex-shrink-0", n.dot, n.read && "opacity-20")} />
                                        <div className="flex-1 min-w-0">
                                            <p className={cn("text-sm font-medium leading-snug", n.read ? "text-primary/40" : "text-primary/80")}>{n.text}</p>
                                            <p className="text-[11px] text-muted font-bold mt-1 opacity-60">{n.time}</p>
                                        </div>
                                        {!n.read && (
                                            <button
                                                onClick={(e) => handleMarkRead(n.id, e)}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-indigo-500 transition-all"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="px-5 py-5 border-t border-border-subtle bg-surface/30">
                            <button
                                onClick={() => {
                                    const hist = localStorage.getItem('cc_notifications_history');
                                    alert(hist ? t.notifHistoryCount.replace('{count}', JSON.parse(hist).length.toString()) : t.historyEmpty);
                                }}
                                className="w-full py-3 rounded-xl bg-card border border-border-subtle text-xs font-bold text-muted hover:text-primary hover:bg-card shadow-sm transition-all"
                            >
                                {t.history}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {messengerOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                        onClick={() => {
                            setMessengerOpen(false);
                            setSelectedChatId(null);
                        }}
                    />
                    <div className="fixed top-0 right-0 h-full w-full md:w-[400px] z-50 bg-card border-l border-border-subtle shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        {/* Messenger Header */}
                        <div className="flex items-center justify-between px-5 py-5 border-b border-border-subtle bg-surface/30">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <h2 className="text-base font-black text-primary tracking-tight">Messenger</h2>
                            </div>
                            <button
                                onClick={() => {
                                    setMessengerOpen(false);
                                    setSelectedChatId(null);
                                }}
                                className="w-10 h-10 flex items-center justify-center rounded-xl text-muted hover:text-primary hover:bg-surface transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {!selectedChatId ? (
                            <>
                                {/* Search & Tabs */}
                                <div className="p-4 space-y-4">
                                    <div className="relative group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-indigo-500 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder={`${t.search}...`}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-surface border border-border-subtle rounded-2xl pl-11 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-1 p-1 bg-surface rounded-xl border border-border-subtle">
                                        <button
                                            onClick={() => setActiveTab('private')}
                                            className={cn(
                                                "flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-black tracking-widest transition-all",
                                                activeTab === 'private' ? "bg-card text-indigo-500 shadow-sm border border-indigo-500/10" : "text-muted hover:text-primary"
                                            )}
                                        >
                                            <UserIcon className="w-3.5 h-3.5" />
                                            {t.privateLabel}
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('group')}
                                            className={cn(
                                                "flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-black tracking-widest transition-all",
                                                activeTab === 'group' ? "bg-card text-indigo-500 shadow-sm border border-indigo-500/10" : "text-muted hover:text-primary"
                                            )}
                                        >
                                            <Users className="w-3.5 h-3.5" />
                                            {t.groups}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setActiveTab('support');
                                                setSelectedChatId(SUPPORT_CHAT_ID);
                                            }}
                                            className={cn(
                                                "flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-black tracking-widest transition-all relative",
                                                activeTab === 'support' ? "bg-card text-indigo-500 shadow-sm border border-indigo-500/10" : "text-muted hover:text-primary"
                                            )}
                                        >
                                            <Shield className="w-3.5 h-3.5" />
                                            {lang === 'ka' ? 'მხარდაჭერა' : 'Support'}
                                            {unreadCounts[SUPPORT_CHAT_ID] > 0 && (
                                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-2 ring-white" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* List */}
                                <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
                                    {activeTab === 'private' ? (
                                        <div className="divide-y divide-border-subtle/30">
                                            {students
                                                .filter(s => s.id !== SUPPORT_CHAT_ID)
                                                .filter(s => s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || (s.first_name + ' ' + s.last_name).toLowerCase().includes(searchQuery.toLowerCase()))
                                                .sort((a, b) => getLastMessageTime(b.id, 'private') - getLastMessageTime(a.id, 'private'))
                                                .map(s => (
                                                    <button
                                                        key={s.id}
                                                        onClick={() => setSelectedChatId(s.id)}
                                                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface transition-colors text-left"
                                                    >
                                                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-black border border-indigo-500/20 overflow-hidden">
                                                            {s.photo_url ? <img src={s.photo_url} className="w-full h-full object-cover" /> : s.full_name?.[0] || s.first_name?.[0]}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-black text-primary truncate">{s.full_name || `${s.first_name} ${s.last_name}`}</p>
                                                            <p className="text-[10px] font-bold text-muted tracking-widest opacity-60">ID: {s.id}</p>
                                                        </div>
                                                        {unreadCounts[s.id] && (
                                                            <span className="px-2 py-0.5 rounded-full bg-red-500 text-[10px] font-black text-white shadow-lg shadow-red-500/20">+{unreadCounts[s.id]}</span>
                                                        )}
                                                        <ChevronRight className="w-4 h-4 text-muted opacity-20" />
                                                    </button>
                                                ))}
                                        </div>
                                    ) : activeTab === 'group' ? (
                                        <div className="divide-y divide-border-subtle/30">
                                            {groups
                                                .filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                                .sort((a, b) => getLastMessageTime(b.id, 'group') - getLastMessageTime(a.id, 'group'))
                                                .map(g => (
                                                    <button
                                                        key={g.id}
                                                        onClick={() => setSelectedChatId(g.id)}
                                                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface transition-colors text-left"
                                                    >
                                                        <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-500 font-black border border-violet-500/20">
                                                            {g.name[0]}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-black text-primary truncate">{g.name}</p>
                                                            <p className="text-[10px] font-bold text-muted tracking-widest opacity-60">{g.coach}</p>
                                                        </div>
                                                        {unreadCounts[g.id] && (
                                                            <span className="px-2 py-0.5 rounded-full bg-red-500 text-[10px] font-black text-white shadow-lg shadow-red-500/20">+{unreadCounts[g.id]}</span>
                                                        )}
                                                        <ChevronRight className="w-4 h-4 text-muted opacity-20" />
                                                    </button>
                                                ))}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                                            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                                                <Shield className="w-8 h-8" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-black text-primary tracking-tight">{lang === 'ka' ? 'მხარდაჭერის ჩატი' : 'Support Chat'}</p>
                                                <p className="text-[10px] font-bold text-muted opacity-60 leading-relaxed tracking-widest uppercase">{lang === 'ka' ? 'აქ შეგიძლიათ დაუკავშირდეთ ClassCore-ის გუნდს' : 'Contact ClassCore team directly'}</p>
                                            </div>
                                            <button 
                                                onClick={() => setSelectedChatId(SUPPORT_CHAT_ID)}
                                                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                                            >
                                                {lang === 'ka' ? 'ჩატის გახსნა' : 'Open Chat'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Chat Header */}
                                <div className="flex items-center gap-4 px-5 py-4 border-b border-border-subtle bg-surface/20">
                                    <button
                                        onClick={() => {
                                            setSelectedChatId(null);
                                            if (activeTab === 'support') setActiveTab('private');
                                        }}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-muted hover:text-primary transition-all rotate-180"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center font-black",
                                            selectedChatId === SUPPORT_CHAT_ID ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "bg-indigo-500/10 text-indigo-500"
                                        )}>
                                            {selectedChatId === SUPPORT_CHAT_ID ? (
                                                <Shield className="w-5 h-5" />
                                            ) : activeTab === 'private'
                                                ? (students.find(s => s.id === selectedChatId)?.full_name?.[0] || students.find(s => s.id === selectedChatId)?.first_name?.[0])
                                                : groups.find(g => g.id === selectedChatId)?.name[0]
                                            }
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-primary leading-none mb-1">
                                                {selectedChatId === SUPPORT_CHAT_ID ? (
                                                    "ClassCore Admin"
                                                ) : activeTab === 'private'
                                                    ? (students.find(s => s.id === selectedChatId)?.full_name || `${students.find(s => s.id === selectedChatId)?.first_name} ${students.find(s => s.id === selectedChatId)?.last_name}`)
                                                    : groups.find(g => g.id === selectedChatId)?.name
                                                }
                                            </p>
                                            <p className="text-[10px] font-bold text-emerald-500 tracking-widest leading-none">
                                                {selectedChatId === SUPPORT_CHAT_ID ? "Official Support" : "Online"}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Messages Area */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-surface/5">
                                    {messages.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center px-6">
                                            <div className="w-16 h-16 bg-surface border border-border-subtle rounded-3xl flex items-center justify-center text-indigo-500 shadow-inner mb-4">
                                                <MessageSquare className="w-8 h-8 opacity-20" />
                                            </div>
                                            <p className="text-xs font-bold text-muted leading-relaxed">
                                                {t.chatStartHint}
                                            </p>
                                        </div>
                                    ) : (
                                        messages.map(m => (
                                            <div key={m.id} className={cn("flex flex-col", m.sender === 'manager' ? "items-end" : "items-start")}>
                                                <div className={cn(
                                                    "max-w-[85%] p-4 rounded-3xl text-sm font-medium shadow-sm transition-all animate-in fade-in zoom-in duration-300",
                                                    m.sender === 'manager' ? "bg-indigo-600 text-white rounded-br-none" : "bg-card border border-border-subtle text-primary rounded-bl-none",
                                                    m.metadata?.type === 'lesson_request' ? "bg-amber-500/10 border-amber-500/20 text-amber-900 shadow-none" : ""
                                                )}>
                                                    {m.attachment && (
                                                        <div className="mb-3 overflow-hidden rounded-2xl border border-white/10">
                                                            {m.attachment.type.startsWith('image/') ? (
                                                                <img src={m.attachment.data} className="w-full h-auto max-h-[300px] object-contain bg-black/10" alt="attachment" />
                                                            ) : (
                                                                <div className="bg-black/20 p-4 flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                                                                        <FileText className="w-5 h-5" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-xs font-bold truncate">{m.attachment.name}</p>
                                                                        <p className="text-[10px] opacity-60">{(m.attachment.size / 1024).toFixed(1)} KB</p>
                                                                    </div>
                                                                    <a 
                                                                        href={m.attachment.data} 
                                                                        download={m.attachment.name}
                                                                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                                                    >
                                                                        <Download className="w-4 h-4" />
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {activeTab === 'group' && m.sender === 'student' && (
                                                        <p className="text-[9px] font-black tracking-widest mb-1 opacity-50">{m.senderName || t.students}</p>
                                                    )}
                                                    {m.metadata?.type === 'lesson_request' ? (
                                                        <div className="space-y-3 w-full min-w-[200px]">
                                                            <div className="flex items-center gap-2 pb-2 border-b border-amber-500/20">
                                                                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600">
                                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                                </div>
                                                                <span className="text-xs font-black text-amber-800 tracking-tight">{t.bookingRequest}</span>
                                                            </div>
                                                            <div className="space-y-1.5 pt-1">
                                                                <div className="flex items-center justify-between text-[11px]">
                                                                    <span className="font-bold text-amber-900/60 tracking-widest">სტილი:</span>
                                                                    <span className="font-black text-amber-900">{m.metadata.style || t.any}</span>
                                                                </div>
                                                                {m.metadata.hallName && (
                                                                    <div className="flex items-center justify-between text-[11px]">
                                                                        <span className="font-bold text-amber-900/60 tracking-widest">დარბაზი:</span>
                                                                        <span className="font-black text-amber-900">{m.metadata.hallName}</span>
                                                                    </div>
                                                                )}
                                                                <div className="pt-2">
                                                                    <span className="text-[9px] font-bold text-amber-900/60 tracking-widest mb-1 block">არჩეული დროები:</span>
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {m.metadata.slots.map((s, i) => (
                                                                            <span key={i} className="px-1.5 py-0.5 bg-white/50 rounded text-[10px] font-bold text-amber-900 font-mono">
                                                                                {new Date(s.date).toLocaleDateString('ka-GE', { day: 'numeric', month: 'short' })} {s.time}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {m.metadata.status !== 'confirmed' ? (
                                                                <button
                                                                    onClick={() => handleApproveLesson(m.id)}
                                                                    className="w-full mt-2 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[11px] font-black tracking-widest shadow-md shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                                >
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    {t.confirm}
                                                                </button>
                                                            ) : (
                                                                <div className="w-full mt-2 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-xl text-[10px] font-black tracking-widest text-center flex items-center justify-center gap-1 border border-emerald-500/20">
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    {t.confirmed}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        m.text
                                                    )}
                                                </div>
                                                <span className="text-[9px] font-black text-muted opacity-40 mt-1.5 px-1">{m.timestamp}</span>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Input Area */}
                                <div className="p-4 border-t border-border-subtle bg-card space-y-4">
                                    {attachment && (
                                        <div className="flex items-center gap-3 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl animate-fade-in">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                                {attachment.type.startsWith('image/') ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black text-indigo-500 tracking-widest truncate">{attachment.name}</p>
                                                <p className="text-[9px] font-bold text-muted opacity-60">{(attachment.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                            <button onClick={() => setAttachment(null)} className="w-8 h-8 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}

                                    <div className="relative flex items-center gap-2">
                                        <div className="flex-1 relative group">
                                            <input
                                                type="text"
                                                value={chatInput}
                                                onChange={(e) => setChatInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                                placeholder={t.sendMessageToStart}
                                                className="w-full bg-surface border border-border-subtle rounded-2xl pl-5 pr-12 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all shadow-inner"
                                            />
                                            <button 
                                                onClick={() => fileInputRef.current?.click()}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-indigo-500 hover:bg-surface transition-all"
                                            >
                                                <Paperclip className="w-5 h-5" />
                                            </button>
                                            <input 
                                                type="file" 
                                                ref={fileInputRef} 
                                                onChange={handleFileChange} 
                                                className="hidden" 
                                                accept="image/*,.pdf,.doc,.docx"
                                            />
                                        </div>
                                        <button
                                            onClick={handleSendMessage}
                                            disabled={!chatInput.trim() && !attachment}
                                            className={cn(
                                                "w-12 h-12 flex items-center justify-center rounded-2xl transition-all active:scale-95 shadow-xl flex-shrink-0",
                                                (chatInput.trim() || attachment) ? "bg-indigo-600 text-white shadow-indigo-600/20" : "bg-surface border border-border-subtle text-muted opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <Send className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}

            <NotesDrawer
                open={notesOpen}
                onClose={() => setNotesOpen(false)}
            />
        </>
    );
}
