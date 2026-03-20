'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
    User, CreditCard, Calendar, CheckCircle,
    ArrowRight, ShieldCheck, Heart,
    MessageSquare, Smartphone, Clock,
    QrCode, Copy, Check, Info, CalendarDays,
    Send, ChevronRight, Download,
    ExternalLink, BellOff, BellRing,
    CircleUser, AlertCircle, ShoppingBag, Tag
} from 'lucide-react';
const UserIcon = User;
import { cn, getLocalISODate, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { getSubscription, renewSubscription, getStudentSubscriptions, type SubscriptionInfo } from '@/lib/subscription-store';
import { useT } from '@/contexts/LanguageContext';
import { getStudentPatch, getStudents, saveStudentPatch } from '@/lib/student-store';
import { getGroups, getGroupById } from '@/lib/group-store';
import { generateQRDataUrl } from '@/lib/qr';
import { loadSettings, DEFAULT_SETTINGS } from '@/lib/settings-store';
import { getEvents } from '@/lib/event-store';
import { logAction } from '@/lib/analytics';
import { getTeachers } from '@/lib/teacher-store';
import { getHalls, type HallData } from '@/lib/hall-store';
import type { Student, CalendarEvent, Teacher, Product } from '@/types';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

type ActiveTab = 'info' | 'schedule' | 'chat' | 'shop';

interface ChatMessage {
    id: string;
    text: string;
    sender: 'student' | 'manager';
    read?: boolean;
    timestamp: string;
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

export default function StudentPortalPage() {
    const { studio, studentId } = useParams() as { studio: string, studentId: string };
    const { t, setLang, lang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const [sub, setSub] = useState<SubscriptionInfo | null>(null);
    const [studentData, setStudentData] = useState<Student | null>(null);
    const [status, setStatus] = useState<'idle' | 'paying' | 'success'>('idle');
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const [runtimeError, setRuntimeError] = useState<string | null>(null);

    useEffect(() => {
        try {
            setSettings(loadSettings(studio));
        } catch (err) {
            console.error('Settings load error:', err);
        }
    }, [studio]);

    const [activeTab, setActiveTab] = useState<ActiveTab>('info');
    const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([]);
    const [groupMessages, setGroupMessages] = useState<Record<string, ChatMessage[]>>({});
    const [chatTab, setChatTab] = useState<'private' | 'groups'>('private');
    const [selectedGroupChatId, setSelectedGroupChatId] = useState<string | null>(null);
    const [scheduleSubTab, setScheduleSubTab] = useState<'mine' | 'all'>('mine');
    const [chatInput, setChatInput] = useState('');
    const [selectedSlots, setSelectedSlots] = useState<Array<{ date: string, time: string }>>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
    const [selectedStyle, setSelectedStyle] = useState<string>('');
    const [selectedHallId, setSelectedHallId] = useState<string>('');
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [halls, setHalls] = useState<HallData[]>([]);
    const [shopProducts, setShopProducts] = useState<Product[]>([]);

    // Auth state
    const [authState, setAuthState] = useState<'welcome' | 'phone' | 'authenticated'>('welcome');
    const [phoneInput, setPhoneInput] = useState('');
    const [authError, setAuthError] = useState('');

    // Load Chats & Sync
    useEffect(() => {
        const loadPortal = async () => {
            try {
                if (!studentId || !studio) return;

                const students = getStudents();
                const student = students.find(st => st.id.toLowerCase() === studentId.toLowerCase());
                setStudentData(student || null);

                if (student) {
                    const s = getSubscription(studentId);
                    setSub(s || null);

                    const patch = getStudentPatch(studentId);
                    const code = patch.qr_code || s?.student_id || studentId;

                    if (code) {
                        const origin = typeof window !== 'undefined' ? window.location.origin : '';
                        const portalUrl = `${origin}/${studio}/${studentId}`;
                        generateQRDataUrl(portalUrl).then(setQrDataUrl);
                    }

                    // Check if already authenticated in this session
                    const isAuth = typeof window !== 'undefined' ? sessionStorage.getItem(`auth_${studentId}`) : null;
                    if (isAuth === 'true') {
                        setAuthState('authenticated');
                    }

                    // Language Sync
                    if (student.preferred_language) {
                        setLang(student.preferred_language);
                    }

                    logAction('portal_visit', studio, { studentId });
                }
            } catch (err) {
                console.error('Portal load error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadPortal();
    }, [studentId, studio, setLang]);

    // Metadata Sync
    useEffect(() => {
        if (typeof document === 'undefined') return;

        if (isLoading) {
            document.title = `${t.loading} | ClassCore`;
        } else if (studentData) {
            document.title = `${studentData.full_name || studentData.id} | ${settings.studioName || 'Client Portal'}`;
        } else {
            document.title = `${t.dataNotFound} | ClassCore`;
        }
    }, [isLoading, studentData, settings.studioName]);

    useEffect(() => {
        setTeachers(getTeachers().filter(t => t.org_id === studio));
        setHalls(getHalls());

        // Load shop products — try plain key AND scoped key (studio slug variant)
        try {
            const keysToTry = [
                'cc_shop_products',
                `cc_shop_products_${studio}`,
            ];
            let allProducts: Product[] = [];
            for (const key of keysToTry) {
                const saved = localStorage.getItem(key);
                if (saved) {
                    const parsed: Product[] = JSON.parse(saved);
                    // Merge unique products by id
                    parsed.forEach(p => {
                        if (!allProducts.find(x => x.id === p.id)) {
                            allProducts.push(p);
                        }
                    });
                }
            }
            setShopProducts(allProducts.filter(p => p.is_active !== false));
        } catch { /* ignore */ }
    }, [studio]);

    const handleSendMessage = () => {
        if (!chatInput.trim()) return;
        const msg: ChatMessage = {
            id: Date.now().toString(),
            text: chatInput,
            sender: 'student',
            read: false,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (chatTab === 'private') {
            const updated = [...privateMessages, msg];
            setPrivateMessages(updated);
            localStorage.setItem(`chat_${studio}_${studentId}`, JSON.stringify(updated));
        } else if (selectedGroupChatId) {
            const current = groupMessages[selectedGroupChatId] || [];
            const updated = [...current, { ...msg, senderName: studentData?.full_name || 'Student' }];
            setGroupMessages(prev => ({ ...prev, [selectedGroupChatId]: updated }));
            localStorage.setItem(`group_chat_${studio}_${selectedGroupChatId}`, JSON.stringify(updated));
        }
        setChatInput('');
    };

    const handleProductInterest = (product: Product) => {
        const text = `🛍️ ${t.buyProductInterest}:\n${product.name}\n${t.price}: ${formatCurrency(product.price, settings.currency || 'GEL')}`;
        const msg: ChatMessage = {
            id: Date.now().toString(),
            text,
            sender: 'student',
            read: false,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        const updated = [...privateMessages, msg];
        setPrivateMessages(updated);
        localStorage.setItem(`chat_${studio}_${studentId}`, JSON.stringify(updated));
        // Switch to chat tab and private subtab
        setActiveTab('chat');
        setChatTab('private');
    };

    // Unified Storage Sync
    useEffect(() => {
        if (!studentId || !studio) return;

        const refreshChats = () => {
            // Private
            const savedPriv = localStorage.getItem(`chat_${studio}_${studentId}`);
            if (savedPriv) setPrivateMessages(JSON.parse(savedPriv));

            // Groups
            if (studentData?.enrolled_group_ids) {
                const groupsMap: Record<string, ChatMessage[]> = {};
                studentData.enrolled_group_ids
                    .filter(gid => getGroupById(gid))
                    .forEach(gid => {
                        const savedGrp = localStorage.getItem(`group_chat_${studio}_${gid}`);
                        if (savedGrp) groupsMap[gid] = JSON.parse(savedGrp);
                    });
                setGroupMessages(groupsMap);
            }
        };

        refreshChats();
        window.dispatchEvent(new Event('cc_attendance_update'));

        const handleStorage = (e: StorageEvent) => {
            if (e.key?.includes(studio)) refreshChats();
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [studentId, studio, studentData?.enrolled_group_ids]);

    const toggleSlot = (date: string, time: string) => {
        const key = { date, time };
        const exists = selectedSlots.find(s => s.date === date && s.time === time);
        if (exists) {
            setSelectedSlots(prev => prev.filter(s => !(s.date === date && s.time === time)));
        } else {
            setSelectedSlots(prev => [...prev, key]);
        }
    };

    const requestSelectedLessons = () => {
        if (selectedSlots.length === 0) return;

        const sortedSlots = [...selectedSlots].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        const slotsStr = sortedSlots
            .map(s => `• ${s.date}: ${s.time}`)
            .join('\n');

        const teacherName = teachers.find(t => t.id === selectedTeacherId)?.full_name || t.any;
        const styleName = selectedStyle || t.any;

        const msgText = `${t.lessonRequest}:\n\n${t.times}:\n${slotsStr}\n\n${t.teacher}: ${teacherName}\n${t.style}: ${styleName}`;

        const msg: ChatMessage = {
            id: Date.now().toString(),
            text: msgText,
            sender: 'student',
            read: false,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            metadata: {
                type: 'lesson_request',
                status: 'pending',
                slots: sortedSlots,
                teacherId: selectedTeacherId,
                style: selectedStyle,
                studentId,
                studentName: studentData?.full_name
            }
        };

        const updated = [...privateMessages, msg];
        setPrivateMessages(updated);
        localStorage.setItem(`chat_${studio}_${studentId}`, JSON.stringify(updated));

        setActiveTab('chat');
        setChatTab('private');
        setSelectedSlots([]);
        // Notify storage for other tabs
        window.dispatchEvent(new Event('storage'));
    };

    const addToCalendar = (ev: CalendarEvent, type: 'google' | 'apple') => {
        const start = ev.start_time.replace(':', '');
        const end = ev.end_time.replace(':', '');
        const date = ev.date.replace(/-/g, '');

        if (type === 'google') {
            const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&dates=${date}T${start}00/${date}T${end}00&details=${encodeURIComponent('Studio Class at ' + settings.studioName)}&location=${encodeURIComponent(settings.studioName)}`;
            window.open(url, '_blank');
        } else {
            downloadIcal(ev); // Apple/Standard iCal
        }
    };

    const toggleReminders = () => {
        if (!studentId) return;
        const patch = getStudentPatch(studentId);
        const next = !patch.sms_reminders;
        const newPatch = { ...patch, sms_reminders: next };
        saveStudentPatch(studentId, newPatch);
        // Dispatch event to trigger refresh if any observers exist
        window.dispatchEvent(new Event('cc_student_update'));
    };

    const downloadIcal = (ev: CalendarEvent) => {
        const start = ev.start_time.replace(':', '');
        const end = ev.end_time.replace(':', '');
        const date = ev.date.replace(/-/g, '');
        const ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'BEGIN:VEVENT',
            `SUMMARY:${ev.title}`,
            `DTSTART:${date}T${start}00`,
            `DTEND:${date}T${end}00`,
            `LOCATION:${settings.studioName}`,
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\n');

        const blob = new Blob([ics], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${ev.title}.ics`;
        link.click();
    };

    const handleAuth = () => {
        if (!studentData) return;

        // Basic phone number matching (remove non-digits for comparison)
        const cleanInput = phoneInput.replace(/\D/g, '');
        const cleanStudentPhone = studentData.phone.replace(/\D/g, '');

        // Match last 9 digits or full
        if (cleanInput && (cleanStudentPhone === cleanInput || cleanStudentPhone.endsWith(cleanInput))) {
            sessionStorage.setItem(`auth_${studentId}`, 'true');
            setAuthState('authenticated');
        } else {
            setAuthError(t.incorrectPhone);
            setTimeout(() => setAuthError(''), 3000);
        }
    };

    const handleCopyId = () => {
        if (!studentId) return;
        navigator.clipboard.writeText(studentId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePay = () => {
        setStatus('paying');
        setTimeout(() => {
            const updated = renewSubscription(studentId);
            setSub(updated);
            setStatus('success');
            setTimeout(() => setStatus('idle'), 3000);
        }, 2000);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-card flex flex-col items-center justify-center p-6 space-y-4">
                <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl animate-pulse flex items-center justify-center">
                    <div className="w-8 h-8 bg-indigo-500/20 rounded-full" />
                </div>
                <div className="h-4 w-32 bg-indigo-500/5 rounded-full animate-pulse" />
            </div>
        );
    }

    if (!studentData) {
        return (
            <div className="min-h-screen bg-card flex flex-col items-center justify-center p-6 text-center space-y-6">
                <div className="w-20 h-20 bg-amber-500/10 rounded-[2rem] flex items-center justify-center text-amber-500 shadow-xl shadow-amber-500/5">
                    <AlertCircle className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-xl font-black text-primary tracking-tight">{t.noData}</h1>
                    <p className="text-[11px] text-muted font-medium opacity-60 max-w-[200px] mx-auto">
                        {t.dataNotFound}
                    </p>
                </div>
                <div className="pt-4 space-y-2 opacity-30">
                    <p className="text-[9px] font-mono uppercase tracking-widest">ID: {studentId}</p>
                    <p className="text-[9px] font-mono uppercase tracking-widest">Studio: {studio}</p>
                </div>
            </div>
        );
    }

    // Authentication Screens
    if (authState === 'welcome') {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-8 animate-fade-in p-6 text-center">
                <div className="w-20 h-20 bg-indigo-500 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/40 animate-bounce-subtle">
                    <ShieldCheck className="w-10 h-10 text-white" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-black text-primary tracking-tight">ClassCore Auth</h1>
                    <p className="text-sm text-muted font-medium opacity-60 max-w-[280px]">
                        {t.authRequired}
                    </p>
                </div>
                <button
                    onClick={() => setAuthState('phone')}
                    className="w-full max-w-xs py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 group"
                >
                    {t.portalLogin} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <p className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] opacity-40">{t.authSecurity}</p>
            </div>
        );
    }

    if (authState === 'phone') {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-8 animate-fade-up p-6">
                <div className="w-full max-w-xs space-y-6">
                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-4">
                            <div className="w-12 h-12 bg-surface border border-border-subtle rounded-2xl flex items-center justify-center text-indigo-500">
                                <Smartphone className="w-6 h-6" />
                            </div>
                        </div>
                        <h2 className="text-xl font-black text-primary tracking-tight">{t.confirmPhone}</h2>
                        <p className="text-[11px] text-muted font-medium opacity-60">
                            {t.enterPhoneForAuth}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="relative group">
                            <input
                                type="tel"
                                value={phoneInput}
                                onChange={e => setPhoneInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAuth()}
                                placeholder="5XX XX XX XX"
                                className={cn(
                                    "w-full bg-surface border rounded-2xl px-5 py-4 text-center text-lg font-black tracking-widest text-primary focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono",
                                    authError ? "border-red-500/50 bg-red-500/5" : "border-border-subtle focus:border-indigo-500/50"
                                )}
                            />
                            {authError && (
                                <p className="text-[10px] font-black text-red-500 text-center mt-2 animate-shake">
                                    {authError}
                                </p>
                            )}
                        </div>

                        <button
                            onClick={handleAuth}
                            className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
                        >
                            {t.confirm}
                        </button>
                    </div>

                    <button
                        onClick={() => setAuthState('welcome')}
                        className="w-full text-[11px] font-bold text-muted hover:text-primary transition-colors text-center"
                    >
                        {t.backToPortal}
                    </button>
                </div>
            </div>
        );
    }

    try {
        const isExpiring = sub ? new Date(sub.expires_at).getTime() < new Date().getTime() + (7 * 24 * 60 * 60 * 1000) : false;
        const remaining = sub?.sessions_total ? sub.sessions_total - sub.sessions_used : null;

        const initials = studentData.full_name
            ? studentData.full_name.split(' ').map((n: string) => n && n[0]).filter(Boolean).join('').toUpperCase()
            : (studentData.first_name?.[0] || '') + (studentData.last_name?.[0] || '');

        return (
            <div className="min-h-screen bg-card animate-fade-up max-w-lg mx-auto pb-24 md:pb-10 pt-6 px-4 relative">
                <div className="absolute top-4 right-4 z-50">
                    <LanguageSwitcher variant="landing" align="right" hideLabel={true} />
                </div>

                {/* Header Section */}
                <div className="flex flex-col items-center justify-center mb-6 mt-2 pt-2">
                    {settings.logoDataUrl ? (
                        <div className="relative group p-1">
                            <div className="absolute inset-0 bg-indigo-500/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                            <img src={settings.logoDataUrl} alt={settings.studioName} className="w-10 h-10 rounded-xl object-contain shadow-md relative z-10" />
                        </div>
                    ) : (
                        <div className="w-10 h-10 bg-card border border-border-subtle rounded-xl flex items-center justify-center shadow-md shadow-black/5 mb-2 overflow-hidden group">
                            <div className="w-full h-full bg-indigo-500 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                                <CircleUser className="text-white w-5 h-5" />
                            </div>
                        </div>
                    )}
                    <div className="text-center mt-1.5 group">
                        <h1 className="text-sm font-black text-primary tracking-tight mb-0 group-hover:text-indigo-500 transition-colors uppercase">{settings.studioName}</h1>
                        <div className="flex items-center justify-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                            <span className="text-[9px] font-bold text-muted uppercase tracking-[0.2em] opacity-40">{t.portalSubtitle}</span>
                        </div>
                    </div>
                </div>



                {/* Tab Navigation */}
                <div className="grid grid-cols-4 gap-1 bg-surface/50 p-1.5 rounded-2xl border border-border-subtle mb-8 backdrop-blur-sm sticky top-4 z-40">
                    <button
                        onClick={() => setActiveTab('info')}
                        className={cn(
                            "flex flex-col items-center gap-1 py-2 rounded-xl transition-all",
                            activeTab === 'info' ? "bg-white text-indigo-500 shadow-md border border-indigo-500/10" : "text-muted hover:text-primary"
                        )}
                    >
                        <Info className="w-4 h-4" />
                        <span className="text-[9px] font-black uppercase tracking-wider">{t.info}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('schedule')}
                        className={cn(
                            "flex flex-col items-center gap-1 py-2 rounded-xl transition-all",
                            activeTab === 'schedule' ? "bg-white text-indigo-500 shadow-md border border-indigo-500/10" : "text-muted hover:text-primary"
                        )}
                    >
                        <CalendarDays className="w-4 h-4" />
                        <span className="text-[9px] font-black uppercase tracking-wider">{t.schedule}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('shop')}
                        className={cn(
                            "flex flex-col items-center gap-1 py-2 rounded-xl transition-all",
                            activeTab === 'shop' ? "bg-white text-indigo-500 shadow-md border border-indigo-500/10" : "text-muted hover:text-primary"
                        )}
                    >
                        <ShoppingBag className="w-4 h-4" />
                        <span className="text-[9px] font-black uppercase tracking-wider">{t.shop}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={cn(
                            "flex flex-col items-center gap-1 py-2 rounded-xl transition-all",
                            activeTab === 'chat' ? "bg-white text-indigo-500 shadow-md border border-indigo-500/10" : "text-muted hover:text-primary"
                        )}
                    >
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-[9px] font-black uppercase tracking-wider">{t.chat}</span>
                    </button>
                </div>

                {/* Tab Content */}
                <div className="space-y-6">
                    {activeTab === 'info' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                            {/* Profile Card */}
                            <div className="bg-card border border-border-subtle rounded-[2.5rem] p-8 shadow-xl shadow-indigo-500/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-indigo-500/10 transition-all duration-700" />
                                <div className="flex items-center gap-5 relative z-10">
                                    <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-indigo-500 to-indigo-700 p-0.5 shadow-xl shadow-indigo-500/20">
                                        <div className="w-full h-full bg-card rounded-[1.9rem] flex items-center justify-center overflow-hidden">
                                            {studentData.photo_url ? (
                                                <img src={studentData.photo_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-2xl font-black text-indigo-500">{initials || '??'}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-left flex-1 min-w-0">
                                        <h1 className="text-2xl font-black text-primary tracking-tight mb-1 truncate">{studentData.full_name || `${studentData.first_name} ${studentData.last_name}`}</h1>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{sub?.status === 'active' ? t.active : t.inactive || 'InActive'}</p>
                                                <span className="w-1 h-1 rounded-full bg-border-subtle/50" />
                                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest opacity-40">ID: {studentId}</p>
                                            </div>

                                            {/* Header Balance & History */}
                                            <div className="flex items-center gap-2 bg-emerald-500/5 px-2.5 py-1.5 rounded-xl border border-emerald-500/10">
                                                <span className="text-[11px] font-black text-emerald-600 tabular-nums">
                                                    {formatCurrency(studentData.balance || 0, settings.currency)}
                                                </span>
                                                <Link
                                                    href={`/${studio}/${studentId}/history`}
                                                    className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                                                >
                                                    <Clock className="w-3.5 h-3.5" />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-border-subtle/50 relative z-10">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-muted uppercase tracking-widest opacity-40">{t.studentPhone}</p>
                                        <p className="text-xs font-bold text-primary">{studentData.phone || '—'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-black text-muted uppercase tracking-widest opacity-40">{t.danceStyle}</p>
                                        <p className="text-xs font-bold text-primary">{studentData.dance_style || '—'}</p>
                                    </div>
                                </div>
                            </div>


                            {/* Subscription & Progress Bar */}
                            {sub && (
                                <div className={cn(
                                    "bg-card border rounded-[2.5rem] p-8 space-y-6 shadow-xl shadow-black/5",
                                    isExpiring ? "border-amber-500/40 bg-amber-500/[0.03]" : "border-border-subtle"
                                )}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                                                <CreditCard className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h2 className="text-base font-black text-primary tracking-tight">{t.subscriptionRenewal}</h2>
                                                <p className="text-[10px] font-bold text-muted opacity-60 uppercase tracking-widest">{sub.plan}</p>
                                            </div>
                                        </div>
                                        <span className={cn(
                                            "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider",
                                            sub.status === 'active' ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-rose-500 text-white shadow-rose-500/20"
                                        )}>
                                            {sub.status === 'active' ? t.active : t.expired}
                                        </span>
                                    </div>

                                    {sub.sessions_total && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between text-[11px] font-black text-primary uppercase tracking-widest mb-1 px-1">
                                                <span>{t.remaining}</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-xl text-indigo-500 tabular-nums">{remaining}</span>
                                                    <span className="opacity-40">/ {sub.sessions_total}</span>
                                                </div>
                                            </div>
                                            <div className="h-4 bg-surface rounded-full overflow-hidden p-1 border border-border-subtle/50 shadow-inner">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all duration-1000 ease-out shadow-sm",
                                                        (remaining && remaining <= 2) ? "bg-rose-500" : "bg-gradient-to-r from-indigo-500 to-indigo-600"
                                                    )}
                                                    style={{ width: `${(remaining! / sub.sessions_total) * 100}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between px-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                                    <span className="text-[9px] font-bold text-muted uppercase tracking-widest opacity-60">
                                                        {t.used} {sub.sessions_used}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-muted">
                                                    <Calendar className="w-3.5 h-3.5 opacity-40 text-indigo-500" />
                                                    <span>{t.expiryDate}: <span className="text-primary font-black">{sub.expires_at}</span></span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* QR Card */}
                            <div className="bg-card border border-border-subtle rounded-[2.5rem] p-8 shadow-xl shadow-black/5 space-y-6">
                                <div className="flex flex-col items-center gap-6 py-4">
                                    <div className="relative group">
                                        <div className="absolute -inset-4 bg-indigo-500/5 rounded-[2rem] blur-2xl opacity-0 hover:opacity-100 transition-opacity" />
                                        <div className="relative w-40 h-40 bg-white rounded-3xl p-3 shadow-2xl shadow-indigo-500/10 border border-border-subtle/30">
                                            {qrDataUrl ? (
                                                <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center animate-pulse">
                                                    <QrCode className="w-10 h-10 text-border-subtle" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-full space-y-2">
                                        <p className="text-[10px] text-muted font-black uppercase tracking-widest opacity-40 text-center">{t.qrIdAndCopy}</p>
                                        <button
                                            onClick={handleCopyId}
                                            className="w-full flex items-center justify-between gap-4 bg-surface/50 border border-border-subtle hover:border-indigo-500/40 rounded-2xl px-6 py-4 transition-all"
                                        >
                                            <span className="text-lg font-mono font-black text-primary tracking-tighter">{studentId}</span>
                                            {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-muted opacity-40" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Notifications Toggle */}
                            <div className="bg-card border border-border-subtle rounded-[2.5rem] p-6 shadow-xl shadow-black/5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                                            <BellRing className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-primary tracking-tight">{t.smsReminders}</p>
                                            <p className="text-[10px] font-medium text-muted opacity-60">{t.getNotifiedBeforeLesson}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={toggleReminders}
                                        className={cn(
                                            "w-12 h-6 rounded-full transition-all relative overflow-hidden ring-1 ring-inset ring-black/5",
                                            (getStudentPatch(studentId).sms_reminders) ? "bg-indigo-500 shadow-inner" : "bg-slate-200"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-md",
                                            (getStudentPatch(studentId).sms_reminders) ? "left-7" : "left-1"
                                        )} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'schedule' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-4">
                            {/* Schedule Tabs */}
                            <div className="grid grid-cols-2 gap-2 bg-surface/50 p-1 rounded-2xl border border-border-subtle">
                                <button
                                    onClick={() => setScheduleSubTab('mine')}
                                    className={cn(
                                        "py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        scheduleSubTab === 'mine' ? "bg-white text-indigo-500 shadow-sm" : "text-muted hover:text-primary"
                                    )}
                                >
                                    {t.mySchedule}
                                </button>
                                <button
                                    onClick={() => setScheduleSubTab('all')}
                                    className={cn(
                                        "py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        scheduleSubTab === 'all' ? "bg-white text-indigo-500 shadow-sm" : "text-muted hover:text-primary"
                                    )}
                                >
                                    {t.studioSchedule}
                                </button>
                            </div>

                            {scheduleSubTab === 'mine' ? (
                                <div className="space-y-4">
                                    <div className="bg-card border border-border-subtle rounded-[2.5rem] p-6 shadow-xl shadow-black/5 space-y-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                                <CalendarDays className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h2 className="text-base font-black text-primary tracking-tight">{t.activeGroups}</h2>
                                                <p className="text-[10px] font-bold text-muted opacity-60 uppercase tracking-widest">{t.yourRegisteredClasses}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {(() => {
                                                // Filter events to only show ones that occur today or in the future
                                                // Handling weekly recurring events by checking if they fall on the same day of the week
                                                const todayStr = getLocalISODate();
                                                const todayDate = new Date(`${todayStr}T00:00:00`);

                                                const allEvents = getEvents();
                                                const myEvents = allEvents.filter(e => {
                                                    const sIdMatch = e.student_id?.toLowerCase() === studentId.toLowerCase();
                                                    const hasGroupId = !!e.group_id;
                                                    const studentIsInGroup = studentData?.enrolled_group_ids?.some(gid => gid.toLowerCase() === e.group_id?.toLowerCase());
                                                    const groupExists = hasGroupId ? !!getGroups().find(g => g.id.toLowerCase() === e.group_id?.toLowerCase()) : false;

                                                    const isMine = sIdMatch || (hasGroupId && studentIsInGroup && groupExists);

                                                    if (e.org_id !== studio || !isMine) return false;

                                                    if (e.recurring === 'weekly') {
                                                        // Always project recurring events, ignoring the original anchor date
                                                        return true;
                                                    }
                                                    return e.date >= todayStr;
                                                });

                                                // Project weekly events to their *next* upcoming date
                                                const projectedEvents = myEvents.map(e => {
                                                    if (e.recurring === 'weekly') {
                                                        const evDate = new Date(`${e.date}T00:00:00`);
                                                        const evDay = evDate.getDay();

                                                        // Find next occurrence
                                                        const projDate = new Date(todayDate);
                                                        const currentDay = projDate.getDay();
                                                        const diff = (evDay + 7 - currentDay) % 7;
                                                        projDate.setDate(projDate.getDate() + diff);

                                                        // If diff is 0 but the time has already passed today, shift to next week
                                                        if (diff === 0) {
                                                            const now = new Date();
                                                            const currentStrTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                                            if (e.end_time <= currentStrTime) {
                                                                projDate.setDate(projDate.getDate() + 7);
                                                            }
                                                        }

                                                        return { ...e, date: getLocalISODate(projDate) };
                                                    }
                                                    return e;
                                                }).sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

                                                // Deduplicate exact same projected events (same title, date, time)
                                                const uniqueEvents = projectedEvents.filter((ev, index, self) =>
                                                    index === self.findIndex((t) => (
                                                        t.title === ev.title && t.date === ev.date && t.start_time === ev.start_time
                                                    ))
                                                );

                                                if (uniqueEvents.length === 0) return (
                                                    <div className="py-8 text-center bg-surface/30 rounded-3xl border border-dashed border-border-subtle">
                                                        <p className="text-xs font-bold text-muted opacity-40">{t.noRegisteredClasses}</p>
                                                    </div>
                                                );

                                                return uniqueEvents.map(ev => {
                                                    const dateObj = new Date(ev.date);
                                                    const dayName = dateObj.toLocaleDateString(studentData?.preferred_language === 'ka' ? 'ka-GE' : 'en-US', { weekday: 'short' });
                                                    const dayNum = dateObj.getDate();
                                                    const monthName = dateObj.toLocaleDateString(studentData?.preferred_language === 'ka' ? 'ka-GE' : 'en-US', { month: 'short' });

                                                    return (
                                                        <div key={ev.id} className="group relative bg-surface border border-border-subtle hover:border-indigo-500/30 rounded-3xl p-4 flex gap-4 transition-all hover:shadow-lg hover:shadow-indigo-500/5 overflow-hidden">
                                                            {ev.type === 'individual' && (
                                                                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-2xl z-10">
                                                                    {t.individual}
                                                                </div>
                                                            )}
                                                            <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center bg-indigo-50/50 rounded-2xl py-2 border border-indigo-100/50 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                                                                <span className="text-[8px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-80">{monthName}</span>
                                                                <span className="text-xl font-black leading-none my-0.5">{dayNum}</span>
                                                                <span className="text-[8px] font-bold uppercase tracking-widest opacity-60 group-hover:opacity-80">{dayName}</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                                <h4 className="text-sm font-black text-primary truncate mb-1 pr-12">{ev.title}</h4>
                                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-muted uppercase tracking-wider">
                                                                    <div className="flex items-center gap-1">
                                                                        <Clock className="w-3 h-3 text-indigo-500" />
                                                                        <span>{ev.start_time} - {ev.end_time}</span>
                                                                    </div>
                                                                    {ev.teacher_id && teachers.find(t => t.id === ev.teacher_id) && (
                                                                        <div className="flex items-center gap-1">
                                                                            <UserIcon className="w-3 h-3 text-indigo-500" />
                                                                            <span className="truncate max-w-[100px]">{teachers.find(t => t.id === ev.teacher_id)?.full_name}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {(ev as any).notes && (
                                                                    <p className="mt-2 text-[10px] font-medium text-muted/80 leading-relaxed border-l-2 border-indigo-100 pl-2">
                                                                        {(ev as any).notes}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="flex-shrink-0 flex items-center pl-2">
                                                                <button
                                                                    onClick={() => downloadIcal(ev)}
                                                                    className="w-10 h-10 bg-surface hover:bg-slate-100 border border-border-subtle rounded-xl flex items-center justify-center text-primary transition-all active:scale-95 group-hover:border-indigo-500/30 group-hover:text-indigo-600"
                                                                    title="Add to Calendar"
                                                                >
                                                                    <Calendar className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-card border border-border-subtle rounded-[2.5rem] p-6 shadow-xl shadow-black/5 space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-500">
                                            <Info className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-black text-primary tracking-tight">{t.studioSchedule}</h2>
                                            <p className="text-[10px] font-bold text-muted opacity-60 uppercase tracking-widest">{t.bookedTimes}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Selection Controls */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5 px-1">
                                                <label className="text-[9px] font-black text-muted uppercase tracking-widest">{t.teachers}</label>
                                                <SearchSelect
                                                    options={[
                                                        { value: '', label: t.any },
                                                        ...teachers.filter(t => t.assigned_individual).map(t => ({
                                                            value: t.id, label: t.full_name || t.id
                                                        }))
                                                    ]}
                                                    value={selectedTeacherId}
                                                    onChange={setSelectedTeacherId}
                                                    className="!border-border-subtle hover:!border-indigo-500/50 shadow-sm [&>div]:py-2 [&>div]:px-3 [&>div]:text-[11px]"
                                                />
                                            </div>
                                            <div className="space-y-1.5 px-1">
                                                <label className="text-[9px] font-black text-muted uppercase tracking-widest">{t.style}</label>
                                                <SearchSelect
                                                    options={[
                                                        { value: '', label: t.any },
                                                        ...Array.from(new Set(teachers.flatMap(t => t.specialty))).map(s => ({
                                                            value: s, label: s
                                                        }))
                                                    ]}
                                                    value={selectedStyle}
                                                    onChange={setSelectedStyle}
                                                    className="!border-border-subtle hover:!border-indigo-500/50 shadow-sm [&>div]:py-2 [&>div]:px-3 [&>div]:text-[11px]"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="flex overflow-x-auto pb-4 gap-3 scrollbar-hide -mx-2 px-2">
                                                {(() => {
                                                    const events = getEvents().filter(e => e.org_id === studio);
                                                    const days = [];
                                                    const today = new Date();
                                                    for (let i = 0; i < 7; i++) {
                                                        const d = new Date(today);
                                                        d.setDate(today.getDate() + i);
                                                        days.push(getLocalISODate(d));
                                                    }

                                                    // Dynamic time slots
                                                    const timeSlots: string[] = [];
                                                    const startH = 10;
                                                    const endH = 20;
                                                    for (let h = startH; h <= endH; h++) {
                                                        timeSlots.push(`${String(h).padStart(2, '0')}:00`);
                                                    }

                                                    return days.map((date, idx) => {
                                                        const d = new Date(date);
                                                        const dayName = d.toLocaleDateString(studentData?.preferred_language === 'ka' ? 'ka-GE' : 'en-US', { weekday: 'short' });
                                                        const dayNum = d.getDate();
                                                        const isToday = idx === 0;

                                                        return (
                                                            <div key={date} className="flex flex-col gap-2 min-w-[90px]">
                                                                <div className={cn(
                                                                    "text-center py-2 px-1 rounded-xl border transition-all",
                                                                    isToday ? "bg-indigo-600 border-indigo-700 text-white shadow-md shadow-indigo-600/10" : "bg-surface/50 border-border-subtle"
                                                                )}>
                                                                    <p className={cn("text-[8px] font-black uppercase tracking-widest", isToday ? "text-indigo-100" : "text-muted")}>{dayName}</p>
                                                                    <p className={cn("text-lg font-black leading-none mt-0.5", isToday ? "text-white" : "text-primary")}>{dayNum}</p>
                                                                </div>

                                                                <div className="flex flex-col gap-1.5">
                                                                    {timeSlots.map(time => {
                                                                        const isValidDateStr = `${date}T00:00:00`;
                                                                        const targetDateObj = new Date(isValidDateStr);
                                                                        const targetDay = targetDateObj.getDay();

                                                                        const isOccupied = events.some(e => {
                                                                            if (selectedTeacherId && e.teacher_id !== selectedTeacherId) return false;
                                                                            // Since hall selection is removed, we treat all occurrences as potentially occupied if we want to show studio availability
                                                                            // But user specifically said "avoid choosing a hall", so we filter only by teacher/style if provided

                                                                            let dateMatch = false;
                                                                            if (e.date === date) {
                                                                                dateMatch = true;
                                                                            } else if (e.recurring === 'weekly') {
                                                                                const evDateObj = new Date(`${e.date}T00:00:00`);
                                                                                if (evDateObj.getDay() === targetDay) {
                                                                                    dateMatch = true;
                                                                                }
                                                                            }

                                                                            if (!dateMatch) return false;

                                                                            const cellStartStr = time;
                                                                            const cellEndH = parseInt(time.split(':')[0]) + 1;
                                                                            const cellEndStr = `${String(cellEndH).padStart(2, '0')}:00`;

                                                                            return e.start_time < cellEndStr && e.end_time > cellStartStr;
                                                                        });
                                                                        const isSelected = selectedSlots.some(s => s.date === date && s.time === time);

                                                                        return (
                                                                            <button
                                                                                key={time}
                                                                                disabled={isOccupied}
                                                                                onClick={() => toggleSlot(date, time)}
                                                                                className={cn(
                                                                                    "w-full py-2 rounded-lg text-[10px] font-black transition-all border",
                                                                                    isOccupied
                                                                                        ? "bg-slate-50/30 border-slate-100 text-slate-200 cursor-not-allowed opacity-30 line-through"
                                                                                        : isSelected
                                                                                            ? "bg-indigo-600 border-indigo-700 text-white shadow-lg shadow-indigo-600/20 scale-105 z-10"
                                                                                            : "bg-card border-border-subtle text-primary hover:border-indigo-500/40 hover:bg-indigo-50/50 hover:text-indigo-600"
                                                                                )}
                                                                            >
                                                                                {time}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>

                                            {selectedSlots.length > 0 && (
                                                <div className="fixed bottom-24 left-6 right-6 z-50 animate-fade-up">
                                                    <button
                                                        onClick={requestSelectedLessons}
                                                        className="w-full bg-indigo-600 text-white py-5 rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all ring-4 ring-white"
                                                    >
                                                        <Send className="w-5 h-5" />
                                                        {t.confirm} ({selectedSlots.length})
                                                    </button>
                                                </div>
                                            )}

                                            <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-3xl space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Info className="w-4 h-4 text-indigo-500" />
                                                    <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">{t.instruction}</p>
                                                </div>
                                                <p className="text-[11px] font-bold text-indigo-600/80 leading-relaxed">
                                                    {t.instructionText}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'chat' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-4">
                            {/* Chat Tabs */}
                            <div className="grid grid-cols-2 gap-2 bg-surface/50 p-1 rounded-2xl border border-border-subtle">
                                <button
                                    onClick={() => setChatTab('private')}
                                    className={cn(
                                        "py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        chatTab === 'private' ? "bg-white text-indigo-500 shadow-sm" : "text-muted hover:text-primary"
                                    )}
                                >
                                    {t.administration}
                                </button>
                                <button
                                    onClick={() => setChatTab('groups')}
                                    className={cn(
                                        "py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        chatTab === 'groups' ? "bg-white text-indigo-500 shadow-sm" : "text-muted hover:text-primary"
                                    )}
                                >
                                    {t.groups}
                                </button>
                            </div>

                            {chatTab === 'groups' && !selectedGroupChatId ? (
                                <div className="bg-card border border-border-subtle rounded-[2.5rem] p-6 space-y-3">
                                    <h4 className="text-xs font-black text-primary uppercase tracking-widest opacity-50 px-2">{t.yourGroups}</h4>
                                    {studentData.enrolled_group_ids?.length ? (
                                        <div className="space-y-2">
                                            {studentData.enrolled_group_ids.filter(gid => getGroupById(gid)).map(gid => (
                                                <button
                                                    key={gid}
                                                    onClick={() => setSelectedGroupChatId(gid)}
                                                    className="w-full flex items-center justify-between p-4 bg-surface/50 hover:bg-surface border border-border-subtle rounded-2xl transition-all"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                                            <MessageSquare className="w-4 h-4" />
                                                        </div>
                                                        <span className="text-sm font-bold text-primary">{getGroupById(gid)?.name || gid}</span>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-muted opacity-40" />
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[10px] font-bold text-muted text-center py-8">{t.noGroupsFound}</p>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-card border border-border-subtle rounded-[2.5rem] h-[550px] flex flex-col shadow-xl shadow-black/5 overflow-hidden">
                                    {/* Chat Header if Group */}
                                    {chatTab === 'groups' && (
                                        <div className="px-5 py-4 border-b border-border-subtle flex items-center gap-3 bg-surface/30">
                                            <button onClick={() => setSelectedGroupChatId(null)} className="p-1 hover:text-indigo-500 transition-colors">
                                                <ArrowRight className="w-4 h-4 rotate-180" />
                                            </button>
                                            <span className="text-xs font-black text-primary uppercase tracking-widest">{getGroupById(selectedGroupChatId!)?.name || selectedGroupChatId}</span>
                                        </div>
                                    )}

                                    {/* Chat messages */}
                                    <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-none">
                                        {((chatTab === 'private' ? privateMessages : groupMessages[selectedGroupChatId!]) || []).length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-4">
                                                <div className="w-16 h-16 bg-surface border border-border-subtle rounded-3xl flex items-center justify-center text-indigo-500 shadow-inner">
                                                    <MessageSquare className="w-8 h-8 opacity-40" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-primary tracking-tight">
                                                        {chatTab === 'private' ? t.privateChat : t.groupChat}
                                                    </h4>
                                                    <p className="text-[10px] font-medium text-muted mt-1 leading-relaxed">
                                                        {t.chatWelcome}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            ((chatTab === 'private' ? privateMessages : groupMessages[selectedGroupChatId!]) || []).map(m => (
                                                <div key={m.id} className={cn("flex w-full gap-2 items-end", m.sender === 'student' ? "justify-end" : "justify-start")}>
                                                    {m.sender === 'manager' && (
                                                        <div className="w-8 h-8 rounded-full flex-shrink-0 bg-surface border border-border-subtle overflow-hidden flex items-center justify-center text-primary shadow-sm">
                                                            {settings.logoDataUrl ? (
                                                                <img src={settings.logoDataUrl} alt="Studio" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-[10px] font-black uppercase">{settings.studioName?.[0] || 'S'}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className={cn("flex flex-col", m.sender === 'student' ? "items-end" : "items-start", "max-w-[75%]")}>
                                                        <div className={cn(
                                                            "p-4 rounded-3xl text-sm font-medium shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2 duration-300",
                                                            m.sender === 'student' ? "bg-indigo-600 text-white rounded-br-none" : "bg-card border border-border-subtle text-primary rounded-bl-none",
                                                            m.metadata?.type === 'lesson_request' ? "bg-amber-50 border-amber-200 text-amber-900" : ""
                                                        )}>
                                                            {chatTab === 'groups' && m.sender === 'manager' && (
                                                                <p className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-50">{t.administration}</p>
                                                            )}
                                                            {m.metadata?.type === 'lesson_request' ? (
                                                                <div className="space-y-2">
                                                                    <div className="font-bold border-b border-black/10 pb-2 mb-2 flex flex-col gap-1">
                                                                        <span className="text-xs">{t.bookingRequest}</span>
                                                                        <span className="text-[10px] font-mono opacity-80">
                                                                            {m.metadata.slots.map(s => `${s.date.slice(5)} ${s.time}`).join(', ')}
                                                                        </span>
                                                                    </div>
                                                                    <p className="opacity-90">{m.text}</p>
                                                                    {m.metadata.status === 'confirmed' && (
                                                                        <div className="mt-2 px-3 py-1.5 bg-emerald-500/20 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-1.5 border border-emerald-500/30">
                                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                                            {t.confirmed}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                m.text
                                                            )}
                                                        </div>
                                                        <span className="text-[9px] font-black text-muted uppercase opacity-50 mt-1.5 px-2">{m.timestamp}</span>
                                                    </div>
                                                    {m.sender === 'student' && (
                                                        <div className="w-8 h-8 rounded-full flex-shrink-0 bg-indigo-100 border border-indigo-200 overflow-hidden flex items-center justify-center text-indigo-600 shadow-sm">
                                                            {studentData?.photo_url ? (
                                                                <img src={studentData.photo_url} alt="Profile" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-[10px] font-black uppercase">{studentData?.full_name?.[0] || studentData?.first_name?.[0] || 'S'}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Chat input */}
                                    <div className="p-4 border-t border-border-subtle/50 bg-surface/30">
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                value={chatInput}
                                                onChange={e => setChatInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                                placeholder={t.messagePlaceholder}
                                                className="w-full bg-card border border-border-subtle rounded-2xl pl-5 pr-14 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                                            />
                                            <button
                                                onClick={handleSendMessage}
                                                className="absolute right-2 top-2 w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                                            >
                                                <Send className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Shop Tab */}
                    {activeTab === 'shop' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h2 className="text-sm font-black text-primary tracking-tight">{settings.studioName || 'Studio'} {t.shop}</h2>
                                    <p className="text-[10px] text-muted opacity-50 font-medium mt-0.5">{t.availableProducts}</p>
                                </div>
                                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                    <ShoppingBag className="w-4 h-4" />
                                </div>
                            </div>

                            {shopProducts.length === 0 ? (
                                <div className="py-16 flex flex-col items-center gap-3 text-center">
                                    <div className="w-16 h-16 bg-surface border border-border-subtle rounded-3xl flex items-center justify-center opacity-30">
                                        <ShoppingBag className="w-8 h-8 text-muted" />
                                    </div>
                                    <p className="text-xs font-bold text-muted opacity-40">{t.noProducts}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {shopProducts.map(product => {
                                        const CATEGORY_LABELS: Record<string, string> = {
                                            categoryShoes: t.categoryShoes,
                                            categoryClothing: t.categoryClothing,
                                            categoryAccessories: t.categoryAccessories,
                                            categoryEquipment: t.categoryEquipment,
                                            categoryOther: t.categoryOther,
                                        };

                                        return (
                                            <div key={product.id} className="bg-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex flex-col group">
                                                {/* Photo */}
                                                <div className="aspect-square bg-surface flex items-center justify-center overflow-hidden relative">
                                                    {product.photo_url ? (
                                                        <img src={product.photo_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2 opacity-20">
                                                            <ShoppingBag className="w-8 h-8 text-muted" />
                                                        </div>
                                                    )}
                                                    {product.quantity <= 3 && (
                                                        <span className="absolute top-2 right-2 px-2 py-0.5 bg-red-500 text-white text-[9px] font-black uppercase tracking-wider rounded-full">
                                                            {product.quantity === 0 ? t.outOfStock : `${product.quantity} ${t.left}`}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div className="p-3 flex flex-col gap-1 flex-1">
                                                    <div className="flex items-start justify-between gap-1">
                                                        <p className="text-xs font-black text-primary leading-tight">{product.name}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        <span className="text-[9px] font-bold text-muted uppercase tracking-wider opacity-50">
                                                            {CATEGORY_LABELS[product.category ?? ''] || product.category}
                                                        </span>
                                                        {product.size && (
                                                            <>
                                                                <span className="text-[9px] opacity-20">·</span>
                                                                <span className="text-[9px] font-bold text-muted uppercase tracking-wider opacity-50">{product.size}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-auto pt-2">
                                                        <Tag className="w-3 h-3 text-indigo-500" />
                                                        <span className="text-sm font-black text-indigo-500">{formatCurrency(product.price, settings.currency || 'GEL')}</span>
                                                    </div>
                                                    {product.quantity > 0 && (
                                                        <button
                                                            onClick={() => handleProductInterest(product)}
                                                            className="w-full mt-2 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-md shadow-indigo-500/20"
                                                        >
                                                            {t.interested}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <p className="text-center text-[9px] font-bold text-muted uppercase tracking-[0.2em] opacity-20 pt-4">{t.buyInStudio}</p>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="text-center pt-12 pb-6">
                        <p className="text-[9px] font-black text-muted uppercase tracking-[0.3em] opacity-20">Persistence System</p>
                    </div>
                </div>
            </div>
        );
    } catch (err) {
        return (
            <div className="min-h-screen bg-card flex flex-col items-center justify-center p-6 text-center space-y-6">
                <div className="w-20 h-20 bg-rose-500/10 rounded-[2rem] flex items-center justify-center text-rose-500 shadow-xl shadow-rose-500/5">
                    <AlertCircle className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-xl font-black text-primary tracking-tight">{t.portalError}</h1>
                    <p className="text-[11px] text-muted font-medium opacity-60 max-w-[200px] mx-auto">
                        {t.errorApology}
                    </p>
                </div>
                <div className="p-4 bg-rose-500/5 rounded-2xl border border-rose-500/10 max-w-xs overflow-auto">
                    <p className="text-[10px] font-mono text-rose-500/70 text-left whitespace-pre-wrap">
                        {String(err)}
                    </p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-indigo-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
                >
                    {t.refreshPage}
                </button>
            </div>
        );
    }
}
