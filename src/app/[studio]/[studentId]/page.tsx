'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { SupportChat } from '@/components/support/SupportChat';
import {
    User, CreditCard, Calendar, CheckCircle,
    ArrowRight, ShieldCheck, Heart,
    MessageSquare, Smartphone, Clock,
    QrCode, Copy, Check, Info, CalendarDays,
    Send, ChevronRight, Download, UserRound,
    ExternalLink, BellOff, BellRing, X, Image as ImageIcon,
    CircleUser, AlertCircle, ShoppingBag, Tag, Loader2, TrendingUp, Activity
} from 'lucide-react';
const UserIcon = User;
import { cn, getLocalISODate, formatCurrency, getScopedKey, safeSetItem } from '@/lib/utils';
import Link from 'next/link';
import { getSubscription, renewSubscription, getStudentSubscriptions, type SubscriptionInfo } from '@/lib/subscription-store';
import { useT } from '@/contexts/LanguageContext';
import { getStudentPatch, getStudents, saveStudentPatch } from '@/lib/student-store';
import { getStudentCheckins } from '@/lib/checkin-store';
import { getGroups, getGroupById } from '@/lib/group-store';
import { generateQRDataUrl } from '@/lib/qr';
import { loadSettings, DEFAULT_SETTINGS } from '@/lib/settings-store';
import { getEvents } from '@/lib/event-store';
import { logAction } from '@/lib/analytics';
import { getTeachers } from '@/lib/teacher-store';
import { getHalls, type HallData } from '@/lib/hall-store';
import { fetchFullStudioState } from '@/lib/master-sync';
import type { Student, CalendarEvent, Teacher, Product } from '@/types';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { AppLogo as Logo } from '@/components/ui/Logo';

type ActiveTab = 'info' | 'schedule' | 'shop' | 'chat';


export default function StudentPortalPage() {
    const params = useParams();
    const studio = (params?.studio as string || '').toLowerCase();
    const studentId = (params?.studentId as string || '').toLowerCase();

    useEffect(() => {
        if (studio && typeof window !== 'undefined') {
            const current = localStorage.getItem('cc_active_studio_slug');
            if (current !== studio) {
                safeSetItem('cc_active_studio_slug', studio, studio);
                // Also trigger a refresh of store states that might depend on activeSlug
                window.dispatchEvent(new Event('cc_settings_update'));
            }
        }
    }, [studio]);

    const { t, setLang, lang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const [sub, setSub] = useState<SubscriptionInfo | null>(null);
    const [studentData, setStudentData] = useState<Student | null>(null);
    const [status, setStatus] = useState<'idle' | 'paying' | 'success'>('idle');
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const [runtimeError, setRuntimeError] = useState<string | null>(null);
    const [groups, setGroups] = useState<any[]>([]);
    const [syncing, setSyncing] = useState(false);

    // 🛡️ SAFETY REDIRECT
    useEffect(() => {
        if (studentId === 'dashboard') {
            router.replace('/dashboard');
        }
    }, [studentId, router]);

    useEffect(() => {
        const load = async () => {
            try {
                const local = loadSettings(studio);
                if (local.studioName === DEFAULT_SETTINGS.studioName && local.studioSlug !== studio) {
                    const cloudData = await fetchFullStudioState(studio, undefined, undefined, true);
                    const cloud = cloudData?.settingsRecord?.settings || cloudData?.studio?.settings;
                    if (cloud) {
                        safeSetItem(`cc_settings_${studio}`, JSON.stringify(cloud), studio);
                        setSettings(cloud);
                        return;
                    }
                }
                setSettings(local);
            } catch (err) {
                console.error('Settings load error:', err);
            }
        };
        load();
    }, [studio]);

    useEffect(() => {
        setGroups(getGroups());
    }, [studio]);

    const [activeTab, setActiveTab] = useState<ActiveTab>('info');
    const [scheduleSubTab, setScheduleSubTab] = useState<'mine' | 'all'>('mine');
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
    const [selectedStyle, setSelectedStyle] = useState<string>('');
    const [selectedHallId, setSelectedHallId] = useState<string>('');
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [halls, setHalls] = useState<HallData[]>([]);
    const [shopProducts, setShopProducts] = useState<Product[]>([]);
    const [isQrExpanded, setIsQrExpanded] = useState(false);
    const [scheduleView, setScheduleView] = useState<'daily' | 'weekly'>('daily');

    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isSyncingChat, setIsSyncingChat] = useState(false);
    const [selectedChatId, setSelectedChatId] = useState<string>('studio');
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const hasLoadedRef = useRef(false);

    const [authState, setAuthState] = useState<'welcome' | 'phone' | 'authenticated'>('welcome');
    const [phoneInput, setPhoneInput] = useState('');
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        const loadPortal = async () => {
            if (hasLoadedRef.current) return;
            const targetId = studentId.trim().toLowerCase();

            // 🚀 FAST-PATH: Load local data immediately to show UI instantly
            if (typeof window !== 'undefined') {
                const students = getStudents();
                const student = students.find(st => 
                    (st.id && st.id.trim().toLowerCase() === targetId) || 
                    (st.student_id && st.student_id.trim().toLowerCase() === targetId)
                );
                if (student) {
                    setStudentData(student);
                    const s = getSubscription(studentId, undefined, undefined, true);
                    setSub(s || null);
                    setIsLoading(false); // Stop loading screen early
                }
            }

            try {
                if (!studentId || !studio) return;

                setSyncing(true);
                const unwrap = (i: any) => {
                    let res = (i?.data && typeof i.data === 'object') ? { ...i, ...i.data } : i;
                    // 🕒 Time Normalization: Cloud storage uses ISO strings, UI expects HH:mm
                    if (typeof res.start_time === 'string' && res.start_time.includes('T')) {
                        res.start_time = res.start_time.split('T')[1].substring(0, 5);
                    }
                    if (typeof res.end_time === 'string' && res.end_time.includes('T')) {
                        res.end_time = res.end_time.split('T')[1].substring(0, 5);
                    }
                    return res;
                };
                const targetId = studentId.trim().toLowerCase();

                try {
                    const cloudData = await fetchFullStudioState(studio, undefined, undefined, true, studentId);
                    if (cloudData) {
                            // 🚀 SCORCHED EARTH v4.2: Ultra-Robust Hydration
                            const studioData = cloudData.studio || {};
                            const settingsBlob = cloudData.settingsRecord?.staff_data || studioData.settings || {};
                            
                            // 🎨 BRANDING RECOVERY: Ensure logo is pulled from studio metadata if missing in settings blob
                            if (!settingsBlob.studioLogo && !settingsBlob.logoDataUrl && studioData.logo_url) {
                                settingsBlob.studioLogo = studioData.logo_url;
                            }
                            const mapping: any = {
                                cc_student_data: [
                                    ...(cloudData.students || []),
                                    ...(settingsBlob?.students || [])
                                ].map(unwrap),
                                cc_groups: (cloudData.groups || settingsBlob?.groups || []).map(unwrap),
                                cc_halls: (cloudData.halls || settingsBlob?.halls || []).map(unwrap),
                                cc_teachers: (cloudData.staff || settingsBlob?.staff || []).map(unwrap),
                                cc_attendance_archive: (cloudData.attendance || settingsBlob?.attendance || []).map(unwrap),
                                cc_subscription_plans: (cloudData.subscription_plans || settingsBlob?.subscription_plans || []).map(unwrap),
                                cc_student_subscriptions: [
                                    ...(cloudData.subscriptions || []),
                                    ...(settingsBlob?.subscriptions || [])
                                ].map(unwrap).reduce((acc: any, sub: any) => {
                                    const sId = sub.student_id;
                                    if (sId) { if (!acc[sId]) acc[sId] = []; acc[sId].push(sub); }
                                    return acc;
                                }, {}),
                                cc_shop_products: (cloudData.products || settingsBlob?.shop_products || []).map(unwrap),
                                cc_calendar_events: (cloudData.calendar_events || settingsBlob?.calendar_events || []).map(unwrap),
                                [`cc_studio_settings_${studio}`]: settingsBlob
                            };

                        for (const [rawKey, data] of Object.entries(mapping)) {
                            if (data) {
                                const scopedKey = getScopedKey(rawKey, studio);
                                safeSetItem(scopedKey, JSON.stringify(data), studio);
                            }
                        }
                        
                        setGroups((cloudData.groups || []).map(unwrap));
                        setHalls((cloudData.halls || []).map(unwrap));
                        setTeachers((cloudData.staff || []).map(unwrap));
                        setSettings(settingsBlob || null);
                        
                        setSettings(settingsBlob || null);
                        
                        const unwrappedStudents = mapping.cc_student_data;
                        const found = unwrappedStudents.find((s: any) => 
                            (s.id && s.id.trim().toLowerCase() === targetId) || 
                            (s.student_id && s.student_id.trim().toLowerCase() === targetId)
                        );
                        
                        if (found) {
                            setStudentData(found as Student);
                            const s = getSubscription(found.id, undefined, undefined, true);
                            setSub(s || null);
                        } else {
                            console.warn('Student not found in cloud data');
                        }
                    }
                } catch (err) {
                    console.error('Cloud hydration error:', err);
                } finally {
                    setSyncing(false);
                }

                // Fallback to local if cloud was slow/empty and we still don't have student data
                if (typeof window !== 'undefined') {
                    const students = getStudents();
                    const student = students.find(st => 
                        (st.id && st.id.trim().toLowerCase() === targetId) || 
                        (st.student_id && st.student_id.trim().toLowerCase() === targetId)
                    );
                    if (student) {
                        setStudentData(prev => prev || student);
                        const s = getSubscription(studentId, undefined, undefined, true);
                        setSub(prev => prev || s || null);
                        
                        const patch = getStudentPatch(studentId);
                        const nfcUid = patch.nfc_uid || student.nfc_uid;
                        const origin = typeof window !== 'undefined' ? window.location.origin : '';
                        const studioSlug = studio || 'studio';
                        const finalQrData = nfcUid ? nfcUid : `${origin}/${studioSlug}/${studentId}`;
                        generateQRDataUrl(finalQrData).then(setQrDataUrl);
                        
                        if (student.preferred_language) {
                            // Don't use setLang here to avoid re-triggering the effect
                        }
                        logAction('portal_visit', studio, { studentId });
                        hasLoadedRef.current = true;
                    }
                }
            } catch (err) {
                console.error('Portal load error:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadPortal();
    }, [studentId, studio]);

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
        try {
            const keysToTry = ['cc_shop_products', `cc_shop_products_${studio}`];
            let allProducts: Product[] = [];
            for (const key of keysToTry) {
                const saved = localStorage.getItem(key);
                if (saved) {
                    const parsed: Product[] = JSON.parse(saved);
                    parsed.forEach(p => { if (!allProducts.find(x => x.id === p.id)) allProducts.push(p); });
                }
            }
            setShopProducts(allProducts.filter(p => p.is_active !== false));
        } catch { /* ignore */ }
    }, [studio]);

    const handleProductInterest = (product: Product) => {
        alert(`${t.buyProductInterest}: ${product.name}.`);
    };

    const addToCalendar = (ev: CalendarEvent, type: 'google' | 'apple') => {
        const start = ev.start_time.replace(':', '');
        const end = ev.end_time.replace(':', '');
        const date = ev.date.replace(/-/g, '');
        if (type === 'google') {
            const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&dates=${date}T${start}00/${date}T${end}00`;
            window.open(url, '_blank');
        } else {
            downloadIcal(ev);
        }
    };

    const syncChat = async (forcePushMessages?: any[]) => {
        if (!studentId || !studio) return;
        setIsSyncingChat(true);
        try {
            const channelId = selectedChatId === 'studio' ? studentId : selectedChatId;
            const res = await fetch(`/api/public/chat?studio=${studio}&studentId=${channelId}`);
            if (res.ok) {
                const data = await res.json();
                const cloudMessages = data.messages || [];
                const localKey = getScopedKey(`chat_${channelId}`, studio);
                let finalMessages = forcePushMessages || cloudMessages;
                setChatMessages(finalMessages);
                safeSetItem(localKey, JSON.stringify(finalMessages), studio);
            }
        } catch (err) {
            console.error('Chat sync error:', err);
        } finally {
            setIsSyncingChat(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'chat') syncChat();
    }, [activeTab, selectedChatId]);

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !studentId || !studio) return;
        const channelId = selectedChatId === 'studio' ? studentId : selectedChatId;
        const newMsg = {
            id: Date.now().toString(),
            text: chatInput,
            sender: 'student',
            sender_name: studentData?.full_name || 'Student',
            timestamp: new Date().toISOString(),
            read: false
        };
        const updatedMessages = [...chatMessages, newMsg];
        setChatMessages(updatedMessages);
        setChatInput('');
        const localKey = getScopedKey(`chat_${channelId}`, studio);
        safeSetItem(localKey, JSON.stringify(updatedMessages), studio);
        try {
            await fetch('/api/public/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studio, studentId: channelId, messages: updatedMessages })
            });
        } catch (err) {
            console.error('Failed to sync message:', err);
        }
    };

    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [chatMessages]);

    const toggleReminders = () => {
        if (!studentId) return;
        const patch = getStudentPatch(studentId);
        const next = !patch.sms_reminders;
        saveStudentPatch(studentId, { ...patch, sms_reminders: next });
        window.dispatchEvent(new Event('cc_student_update'));
    };

    const downloadIcal = (ev: CalendarEvent) => {
        const start = ev.start_time.replace(':', '');
        const end = ev.end_time.replace(':', '');
        const date = ev.date.replace(/-/g, '');
        const ics = ['BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT',`SUMMARY:${ev.title}`,`DTSTART:${date}T${start}00`,`DTEND:${date}T${end}00`,`LOCATION:${settings.studioName}`,'END:VEVENT','END:VCALENDAR'].join('\n');
        const blob = new Blob([ics], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `${ev.title}.ics`; link.click();
    };

    useEffect(() => {
        if (typeof window === 'undefined' || !studentId) return;
        const saved = localStorage.getItem(`cc_portal_session_${studentId}`);
        if (saved) {
            try {
                const session = JSON.parse(saved);
                const isFresh = Date.now() - session.timestamp < 30 * 60 * 1000;
                if (session.authenticated && isFresh) {
                    setAuthState('authenticated');
                } else {
                    localStorage.removeItem(`cc_portal_session_${studentId}`);
                }
            } catch (e) {}
        }
    }, [studentId]);

    const handleAuth = () => {
        if (!studentData) return;
        const cleanInput = phoneInput.replace(/\D/g, '');
        const cleanStudentPhone = studentData.phone.replace(/\D/g, '');
        if (cleanInput && (cleanStudentPhone === cleanInput || cleanStudentPhone.endsWith(cleanInput))) {
            const session = {
                authenticated: true,
                timestamp: Date.now()
            };
            localStorage.setItem(`cc_portal_session_${studentId}`, JSON.stringify(session));
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

    // ✅ Computed variables that were missing
    const initials = studentData ? (
        (studentData.first_name?.[0] || '') + (studentData.last_name?.[0] || '')
    ).toUpperCase() : '';

    const remaining = sub?.sessions_total != null && sub?.sessions_used != null
        ? sub.sessions_total - sub.sessions_used
        : null;

    const isExpiring = remaining != null && remaining <= 2;

    if (isLoading || syncing) {
        return (
            <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Logo className="w-8 h-8 opacity-20" />
                    </div>
                </div>
                <div className="space-y-2">
                    <p className="text-sm font-black tracking-[0.2em] text-indigo-500 animate-pulse uppercase">{t.loading || 'Loading Portal'}</p>
                    <p className="text-[10px] font-bold text-muted tracking-widest opacity-40 uppercase">Secure Connection Established</p>
                </div>
            </div>
        );
    }

    if (!studentData) {
        return (
            <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-8 text-center space-y-8">
                <div className="w-24 h-24 bg-rose-500/10 rounded-[2.5rem] flex items-center justify-center text-rose-500">
                    <AlertCircle className="w-12 h-12" />
                </div>
                <div className="space-y-3 max-w-xs">
                    <h1 className="text-xl font-black text-primary tracking-tight">{t.noData || 'Data Not Found'}</h1>
                    <p className="text-sm font-medium text-muted leading-relaxed">
                        {t.dataNotFoundDesc || 'We could not find your student profile. Please check the link or contact your studio.'}
                    </p>
                </div>
                
                {/* Emergency Debug Info */}
                <div className="p-6 bg-card/50 rounded-3xl border border-border-subtle w-full max-w-md text-left space-y-3">
                    <p className="text-[10px] font-black text-muted tracking-widest uppercase opacity-40">System Debug Info</p>
                    <div className="grid grid-cols-2 gap-4 text-[11px] font-bold">
                        <div>
                            <p className="text-muted opacity-50 mb-1">Studio Slug</p>
                            <p className="text-primary truncate">{studio || 'NULL'}</p>
                        </div>
                        <div>
                            <p className="text-muted opacity-50 mb-1">Student ID</p>
                            <p className="text-primary truncate">{(studentId || 'NULL').toUpperCase()}</p>
                        </div>
                    </div>
                    <div className="pt-2 text-[9px] font-mono text-muted/50 break-all">
                        Status: {(window as any)._portalDebug?.status || 'Active'}
                    </div>
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-600/20"
                    >
                        RETRY CONNECTION
                    </button>
                </div>

                <div className="pt-8">
                    <Logo className="w-12 h-12 opacity-10 grayscale" />
                </div>
            </div>
        );
    }

    if (authState === 'welcome') {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-8 animate-fade-in p-6 text-center">
                <div className="w-20 h-20 bg-indigo-500 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/40 animate-bounce-subtle">
                    <ShieldCheck className="w-10 h-10 text-white" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-black text-primary tracking-tight">ClassCore Auth</h1>
                    <p className="text-sm text-muted font-medium opacity-60 max-w-[280px]">{t.authRequired}</p>
                </div>
                <button
                    onClick={() => setAuthState('phone')}
                    className="w-full max-w-xs py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 group"
                >
                    {t.portalLogin} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <p className="text-[10px] font-bold text-muted tracking-[0.2em] opacity-40">{t.authSecurity}</p>
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
                        <p className="text-[11px] text-muted font-medium opacity-60">{t.enterPhoneForAuth}</p>
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
                            {authError && <p className="text-[10px] font-black text-red-500 text-center mt-2 animate-shake">{authError}</p>}
                        </div>
                        <button onClick={handleAuth} className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/20 active:scale-95 transition-all">
                            {t.confirm}
                        </button>
                    </div>
                    <button onClick={() => setAuthState('welcome')} className="w-full text-[11px] font-bold text-muted hover:text-primary transition-colors text-center">
                        {t.backToPortal}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-card animate-fade-up max-w-lg mx-auto pb-24 md:pb-10 pt-6 px-4 relative overflow-x-hidden">
            <div className="flex items-center justify-between mb-8 mt-2 px-1">
                <div className="flex items-center gap-3">
                    {(settings?.logoDataUrl || settings?.studioLogo) ? (
                        <div className="relative group p-1">
                            <div className="absolute inset-0 bg-indigo-500/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                            <img src={settings.logoDataUrl || settings.studioLogo} alt={settings.studioName} className="w-10 h-10 rounded-xl object-contain shadow-md relative z-10" />
                        </div>
                    ) : (
                        <div className="w-10 h-10 bg-card border border-border-subtle rounded-xl flex items-center justify-center shadow-md shadow-black/5 overflow-hidden group">
                            <div className="w-full h-full bg-indigo-500 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                                <CircleUser className="text-white w-5 h-5" />
                            </div>
                        </div>
                    )}
                    <div className="text-left group">
                        <h1 className="text-sm font-black text-primary tracking-tight mb-0 group-hover:text-indigo-500 transition-colors leading-none">{settings.studioName}</h1>
                        <div className="flex items-center gap-1 mt-0.5">
                            <span className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                            <span className="text-[9px] font-bold text-muted tracking-widest opacity-40 uppercase">{t.portalSubtitle}</span>
                        </div>
                    </div>
                </div>
                <LanguageSwitcher variant="landing" align="right" hideLabel={true} />
            </div>

            {/* Tab Navigation */}
            <div className="grid grid-cols-4 gap-1 bg-surface/50 p-1.5 rounded-2xl border border-border-subtle mb-8 backdrop-blur-sm sticky top-4 z-40">
                {([
                    { id: 'info', icon: Info, label: t.info },
                    { id: 'schedule', icon: CalendarDays, label: t.schedule },
                    { id: 'shop', icon: ShoppingBag, label: t.shop },
                    { id: 'chat', icon: MessageSquare, label: l('ჩათი', 'Чат', 'Chat') },
                ] as const).map(({ id, icon: Icon, label }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={cn(
                            "flex flex-col items-center gap-1 py-2 rounded-xl transition-all",
                            activeTab === id ? "bg-white text-indigo-500 shadow-md border border-indigo-500/10" : "text-muted hover:text-primary"
                        )}
                    >
                        <Icon className="w-4 h-4" />
                        <span className="text-[9px] font-black tracking-wider">{label}</span>
                    </button>
                ))}
            </div>


            {/* Tab Content */}
            <div className="space-y-6">
                {activeTab === 'info' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                        {/* Profile Card */}
                        <div className="bg-card border border-border-subtle rounded-[2.5rem] p-5 sm:p-8 shadow-xl shadow-indigo-500/5 relative overflow-hidden group">
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
                                    <div className="flex flex-col mb-1">
                                        <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight">
                                            {studentData.full_name || `${studentData.first_name} ${studentData.last_name}`}
                                        </h1>
                                        <p className="text-[10px] font-bold text-indigo-500 tracking-widest uppercase opacity-70 mt-0.5">
                                            {studentData.enrolled_group_ids && studentData.enrolled_group_ids.length > 0
                                                ? getGroups().filter(g => studentData.enrolled_group_ids?.includes(g.id)).map(g => g.name).join(', ')
                                                : '—'}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <p className={cn("text-[10px] font-black tracking-widest uppercase", (sub?.status === 'active' || (sub?.sessions_total && sub.sessions_used < sub.sessions_total)) ? "text-emerald-500" : "text-rose-500")}>
                                            {(sub?.status === 'active' || (sub?.sessions_total && sub.sessions_used < sub.sessions_total)) ? t.active : t.inactive || 'InActive'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-border-subtle/50 relative z-10">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-muted tracking-widest opacity-40 uppercase">{l('ბალანსი', 'Баланс', 'Balance')}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-emerald-600 tabular-nums">
                                            {formatCurrency(studentData.balance || 0, settings.currency)}
                                        </span>
                                        <Link href={`/${studio}/${studentId}/history`} className="w-5 h-5 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 hover:bg-emerald-500/20 transition-all border border-emerald-500/20">
                                            <Clock className="w-3 h-3" />
                                        </Link>
                                    </div>
                                </div>
                                <div className="space-y-1 sm:col-span-1">
                                    <p className="text-[9px] font-black text-muted tracking-widest opacity-40 uppercase">{l('ჯგუფები', 'Группы', 'Groups')}</p>
                                    <p className="text-xs font-bold text-primary truncate">
                                        {studentData.enrolled_group_ids && studentData.enrolled_group_ids.length > 0
                                            ? getGroups().filter(g => studentData.enrolled_group_ids?.includes(g.id)).map(g => g.name).join(', ')
                                            : '—'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Subscription Card */}
                        {sub && (
                            <div className={cn(
                                "bg-card border rounded-[2.5rem] p-6 sm:p-8 space-y-6 shadow-xl shadow-black/5",
                                isExpiring ? "border-amber-500/40 bg-amber-500/[0.03]" : "border-border-subtle"
                            )}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                                            <CreditCard className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-black text-primary tracking-tight">{t.subscriptionRenewal}</h2>
                                            <p className="text-[10px] font-bold text-muted opacity-60 tracking-widest">{sub.plan}</p>
                                        </div>
                                    </div>
                                    <span className={cn("px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider", sub.status === 'active' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")}>
                                        {sub.status === 'active' ? t.active : t.expired}
                                    </span>
                                </div>

                                {sub.sessions_total && remaining !== null && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between text-[11px] font-black text-primary tracking-widest mb-1 px-1">
                                            <span>{t.remaining}</span>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-xl text-indigo-500 tabular-nums">{remaining}</span>
                                                <span className="opacity-40">/ {sub.sessions_total}</span>
                                            </div>
                                        </div>
                                        <div className="h-4 bg-surface rounded-full overflow-hidden p-1 border border-border-subtle/50 shadow-inner">
                                            <div
                                                className={cn("h-full rounded-full transition-all duration-1000 ease-out shadow-sm", remaining <= 2 ? "bg-rose-500" : "bg-gradient-to-r from-indigo-500 to-indigo-600")}
                                                style={{ width: `${(remaining / sub.sessions_total) * 100}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between px-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                <span className="text-[9px] font-bold text-muted tracking-widest opacity-60">{t.used} {sub.sessions_used}</span>
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

                        {/* Contribution Graph (GitHub Style) */}
                        <div className="bg-card border border-border-subtle rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-indigo-500/5 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-black text-primary tracking-tight flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-indigo-500" />
                                    {l('დასწრების ისტორია', 'История посещений', 'Attendance History')}
                                </h3>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                                        <span className="text-[9px] font-bold text-muted opacity-40 uppercase">{l('იყო', 'Был', 'Present')}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 bg-rose-500 rounded-sm" />
                                        <span className="text-[9px] font-bold text-muted opacity-40 uppercase">{l('არა', 'Нет', 'Absent')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto no-scrollbar pb-2">
                                <div className="flex gap-1 min-w-max">
                                    {(() => {
                                        const today = new Date();
                                        const checkins = getStudentCheckins(studentId);
                                        const checkinDates = new Set(checkins.map(c => c.date));
                                        
                                        const enrolledGroups = getGroups().filter(g => studentData?.enrolled_group_ids?.includes(g.id));
                                        const myEvents = getEvents().filter(e => e.student_id === studentId || studentData?.enrolled_group_ids?.includes(e.group_id || ''));
                                        
                                        // Find the first subscription date
                                        const allSubs = getStudentSubscriptions(studentId);
                                        let startDate = new Date();
                                        if (allSubs.length > 0) {
                                            const dates = allSubs
                                                .map(s => s.purchased_at || s.expires_at)
                                                .filter(Boolean)
                                                .map(d => new Date(d));
                                            
                                            if (dates.length > 0) {
                                                const minTime = Math.min(...dates.map(d => d.getTime()));
                                                startDate = new Date(minTime);
                                            } else {
                                                startDate.setMonth(startDate.getMonth() - 2); // Default to 3 months window
                                            }
                                        } else {
                                            startDate.setMonth(startDate.getMonth() - 2);
                                        }

                                        // Adjust to start of the week (Monday)
                                        const dayOf = startDate.getDay();
                                        const diff = startDate.getDate() - dayOf + (dayOf === 0 ? -6 : 1);
                                        startDate.setDate(diff);
                                        startDate.setHours(0,0,0,0);

                                        // End date is 3 months from start date
                                        const endDate = new Date(startDate);
                                        endDate.setMonth(endDate.getMonth() + 3);

                                        const curr = new Date(startDate);
                                        const days: { date: string; status: 'present' | 'absent' | 'none'; month: string; isStartOfMonth: boolean }[] = [];
                                        let lastMonth = '';
                                        
                                        while (curr <= endDate) {
                                            const dStr = getLocalISODate(curr);
                                            const dayOfWeek = (curr.getDay() + 6) % 7; // Mon=0
                                            const monthName = curr.toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US', { month: 'short' });
                                            
                                            let status: 'present' | 'absent' | 'none' = 'none';
                                            
                                            if (checkinDates.has(dStr)) {
                                                status = 'present';
                                            } else if (curr <= today) {
                                                const hasScheduledGroup = enrolledGroups.some(g => g.schedule_slots?.some((s: any) => s.dayOfWeek === dayOfWeek));
                                                const hasIndividualEvent = myEvents.some(e => e.date === dStr);
                                                
                                                if (hasScheduledGroup || hasIndividualEvent) {
                                                    status = 'absent';
                                                }
                                            }

                                            days.push({ 
                                                date: dStr, 
                                                status, 
                                                month: monthName,
                                                isStartOfMonth: monthName !== lastMonth
                                            });
                                            lastMonth = monthName;
                                            curr.setDate(curr.getDate() + 1);
                                        }

                                        const weeks: typeof days[] = [];
                                        let currentWeek: typeof days = [];
                                        
                                        days.forEach(d => {
                                            currentWeek.push(d);
                                            if (currentWeek.length === 7) {
                                                weeks.push(currentWeek);
                                                currentWeek = [];
                                            }
                                        });
                                        if (currentWeek.length > 0) {
                                            while (currentWeek.length < 7) currentWeek.push({ date: '', status: 'none', month: '', isStartOfMonth: false });
                                            weeks.push(currentWeek);
                                        }

                                        return (
                                            <div className="flex gap-2">
                                                {/* Day Labels */}
                                                <div className="flex flex-col gap-1.5 pt-5 pr-1">
                                                    {['M', '', 'W', '', 'F', '', ''].map((label, i) => (
                                                        <div key={i} className="h-4 flex items-center">
                                                            <span className="text-[8px] font-black text-muted opacity-30 uppercase">{label}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="flex gap-1.5 flex-1">
                                                    {weeks.map((week, wIdx) => {
                                                        const monthLabel = week.find(d => d.isStartOfMonth)?.month;
                                                        return (
                                                            <div key={wIdx} className="flex flex-col gap-1.5">
                                                                <div className="h-4 flex items-center justify-center">
                                                                    {monthLabel && <span className="text-[9px] font-black text-muted opacity-40 uppercase whitespace-nowrap">{monthLabel}</span>}
                                                                </div>
                                                                <div className="flex flex-col gap-1.5">
                                                                    {week.map((day, dIdx) => (
                                                                        <div
                                                                            key={dIdx}
                                                                            title={day.date}
                                                                            className={cn(
                                                                                "w-4 h-4 rounded-[4px] transition-all duration-500",
                                                                                day.date === '' ? "opacity-0" :
                                                                                day.status === 'present' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" :
                                                                                day.status === 'absent' ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.1)]" :
                                                                                "bg-indigo-500/5 border border-indigo-500/5"
                                                                            )}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-between border-t border-border-subtle/50 pt-4">
                                <p className="text-[10px] font-bold text-muted opacity-40 uppercase tracking-widest">
                                    {l('სტუდენტია: ', 'Студент с: ', 'Joined: ')}
                                    {(() => {
                                        const allSubs = getStudentSubscriptions(studentId);
                                        if (allSubs.length > 0) {
                                            const dates = allSubs.map(s => s.purchased_at).filter(Boolean).map(d => new Date(d));
                                            if (dates.length > 0) return new Date(Math.min(...dates.map(d => d.getTime()))).toLocaleDateString();
                                        }
                                        return '—';
                                    })()}
                                </p>
                                <div className="flex gap-1.5">
                                     {[0,1,2,3,4].map(i => (
                                         <div key={i} className={cn("w-3 h-3 rounded-sm", i === 0 ? "bg-indigo-500/5" : i === 4 ? "bg-emerald-500" : "bg-emerald-500/" + (i*20))} />
                                     ))}
                                </div>
                            </div>
                        </div>


                        {/* QR Card */}
                        <div className="bg-card border border-border-subtle rounded-[2.5rem] overflow-hidden shadow-xl shadow-black/5 transition-all duration-500">
                            <div className="p-6 sm:p-8 border-b border-border-subtle/50 bg-surface/10">
                                <div className="flex items-center justify-between gap-4 mb-2">
                                    <h1 className="text-xl font-black text-primary truncate leading-tight">{studentData?.full_name || t.loading}</h1>
                                    <div className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 text-[8px] font-black uppercase tracking-widest rounded-md border border-emerald-500/20">{studentData?.status || 'Active'}</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsQrExpanded(!isQrExpanded)}
                                className="w-full p-6 sm:p-8 flex items-center justify-between hover:bg-surface/50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-all", isQrExpanded ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20")}>
                                        <QrCode className="w-6 h-6" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm font-black text-primary tracking-tight">{t.qrCode || 'QR კოდი'}</h3>
                                        <p className="text-[10px] font-bold text-muted opacity-60 tracking-widest">{isQrExpanded ? t.hideQr || 'დამალვა' : t.showQr || 'ჩვენება'}</p>
                                    </div>
                                </div>
                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300", isQrExpanded ? "rotate-180 bg-indigo-50/50" : "bg-surface border border-border-subtle")}>
                                    <ChevronRight className={cn("w-4 h-4 text-primary", isQrExpanded && "rotate-90")} />
                                </div>
                            </button>
                            <div className={cn("px-8 pb-8 space-y-6 overflow-hidden transition-all duration-500 ease-in-out", isQrExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 invisible")}>
                                <div className="flex flex-col items-center gap-6 py-4">
                                    <div className="relative w-48 h-48 bg-white rounded-3xl p-4 shadow-2xl shadow-indigo-500/10 border border-border-subtle/30">
                                        {qrDataUrl ? (
                                            <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center animate-pulse">
                                                <QrCode className="w-10 h-10 text-border-subtle" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-full space-y-2">
                                        <p className="text-[10px] text-muted font-black tracking-widest opacity-40 text-center">{t.qrIdAndCopy}</p>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleCopyId(); }}
                                            className="w-full flex items-center justify-between gap-4 bg-surface/50 border border-border-subtle hover:border-indigo-500/40 rounded-2xl px-6 py-4 transition-all"
                                        >
                                            <span className="text-lg font-mono font-black text-primary tracking-tighter">{studentId}</span>
                                            {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-muted opacity-40" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'schedule' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-4">
                        <div className="flex flex-col gap-3">
                            <div className="grid grid-cols-2 gap-2 bg-surface/50 p-1 rounded-2xl border border-border-subtle">
                                <button onClick={() => setScheduleSubTab('mine')} className={cn("py-2 rounded-xl text-[10px] font-black tracking-widest transition-all", scheduleSubTab === 'mine' ? "bg-white text-indigo-500 shadow-sm" : "text-muted hover:text-primary")}>{t.mySchedule}</button>
                                <button onClick={() => setScheduleSubTab('all')} className={cn("py-2 rounded-xl text-[10px] font-black tracking-widest transition-all", scheduleSubTab === 'all' ? "bg-white text-indigo-500 shadow-sm" : "text-muted hover:text-primary")}>{t.studioSchedule}</button>
                            </div>
                        </div>

                        {scheduleSubTab === 'mine' ? (
                            <div className="bg-card border border-border-subtle rounded-[2.5rem] p-6 shadow-xl shadow-black/5 space-y-6">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                            <CalendarDays className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-base font-black text-primary tracking-tight">{t.activeGroups}</h2>
                                            <p className="text-[10px] font-bold text-muted opacity-60 tracking-widest">{t.yourRegisteredClasses}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={toggleReminders}
                                        className={cn("flex items-center gap-2 px-3 py-1.5 rounded-2xl transition-all border", getStudentPatch(studentId).sms_reminders ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-600" : "bg-surface border-border-subtle text-muted")}
                                    >
                                        <BellRing className={cn("w-3.5 h-3.5", getStudentPatch(studentId).sms_reminders ? "animate-wiggle" : "opacity-40")} />
                                        <span className="text-[9px] font-black uppercase tracking-wider">{t.reminder}</span>
                                        <div className={cn("w-6 h-3 rounded-full relative transition-all", getStudentPatch(studentId).sms_reminders ? "bg-indigo-500" : "bg-slate-200")}>
                                            <div className={cn("absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all", getStudentPatch(studentId).sms_reminders ? "right-0.5" : "left-0.5")} />
                                        </div>
                                    </button>
                                </div>

                                <div className="flex bg-surface/50 p-1 rounded-xl border border-border-subtle">
                                    {(['daily', 'weekly'] as const).map(v => (
                                        <button key={v} onClick={() => setScheduleView(v)} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all uppercase", scheduleView === v ? "bg-white text-indigo-500 shadow-sm" : "text-muted hover:text-primary")}>
                                            {v === 'daily' ? <Calendar className="w-3 h-3 opacity-60" /> : <CalendarDays className="w-3 h-3 opacity-60" />}
                                            {v === 'daily' ? t.day : t.week}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-4">
                                    {(() => {
                                        const todayStr = getLocalISODate();
                                        const todayDate = new Date(`${todayStr}T00:00:00`);
                                        const allEvents = getEvents();
                                        const myEvents = allEvents.filter(e => {
                                            const sIdMatch = e.student_id?.toLowerCase() === studentId.toLowerCase();
                                            const studentIsInGroup = studentData?.enrolled_group_ids?.some(gid => gid.toLowerCase() === e.group_id?.toLowerCase());
                                            const isThisStudio = !e.org_id || e.org_id === studio || e.org_id === settings?.orgId;
                                            return isThisStudio && (sIdMatch || studentIsInGroup);
                                        });

                                        let displayEvents: CalendarEvent[] = [];
                                        if (scheduleView === 'daily') {
                                            // 📅 SHOW NEXT 3 UPCOMING LESSONS
                                            displayEvents = myEvents
                                                .filter(e => {
                                                    if (e.recurring === 'weekly') return true;
                                                    return e.date >= todayStr;
                                                })
                                                .sort((a, b) => {
                                                    if (a.recurring === 'weekly' && b.recurring !== 'weekly') return -1;
                                                    if (a.recurring !== 'weekly' && b.recurring === 'weekly') return 1;
                                                    return a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time);
                                                })
                                                .slice(0, 3);
                                        } else {
                                            const startOfWeek = new Date(todayDate);
                                            startOfWeek.setDate(todayDate.getDate() - (todayDate.getDay() === 0 ? 6 : todayDate.getDay() - 1));
                                            displayEvents = myEvents.filter(e => {
                                                const evDate = new Date(`${e.date}T00:00:00`);
                                                if (e.recurring === 'weekly') return true;
                                                const endOfWeek = new Date(startOfWeek);
                                                endOfWeek.setDate(startOfWeek.getDate() + 6);
                                                return evDate >= startOfWeek && evDate <= endOfWeek;
                                            }).sort((a, b) => new Date(`${a.date}T00:00:00`).getDay() - new Date(`${b.date}T00:00:00`).getDay() || a.start_time.localeCompare(b.start_time));
                                        }

                                        if (displayEvents.length === 0) return (
                                            <div className="py-8 text-center bg-surface/30 rounded-3xl border border-dashed border-border-subtle">
                                                <p className="text-xs font-bold text-muted opacity-40">{t.noRegisteredClasses}</p>
                                            </div>
                                        );

                                        return (
                                            <div className="space-y-3">
                                                {displayEvents.map((ev, idx) => {
                                                    const dateObj = new Date(`${ev.date}T00:00:00`);
                                                    const dayName = dateObj.toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US', { weekday: 'short' });
                                                    const dayFull = dateObj.toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US', { weekday: 'long' });
                                                    const dayNum = dateObj.getDate();
                                                    const monthName = dateObj.toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US', { month: 'short' });
                                                    const showDayHeader = idx === 0 || displayEvents[idx-1].date !== ev.date;
                                                    return (
                                                        <div key={`${ev.id}-${ev.date}`} className="space-y-2">
                                                            {scheduleView === 'weekly' && showDayHeader && (
                                                                <div className="flex items-center gap-2 px-2 mt-4 first:mt-0">
                                                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{dayFull}</span>
                                                                    <div className="h-px flex-1 bg-indigo-500/10" />
                                                                </div>
                                                            )}
                                                            <div className={cn("group relative bg-surface border border-border-subtle hover:border-indigo-500/30 rounded-3xl p-4 flex gap-4 transition-all hover:shadow-lg hover:shadow-indigo-500/5 overflow-hidden", ev.date < todayStr && "opacity-40 grayscale-[0.5]")}>
                                                                {ev.type === 'individual' && (
                                                                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-black tracking-widest px-3 py-1 rounded-bl-2xl z-10 uppercase">{t.individual}</div>
                                                                )}
                                                                <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center bg-indigo-50/50 rounded-2xl py-2 border border-indigo-100/50 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                                                                    <span className="text-[8px] font-black tracking-widest opacity-60 group-hover:opacity-80 uppercase">{monthName}</span>
                                                                    <span className="text-xl font-black leading-none my-0.5 tabular-nums">{dayNum}</span>
                                                                    <span className="text-[8px] font-bold tracking-widest opacity-60 group-hover:opacity-80 uppercase">{dayName}</span>
                                                                </div>
                                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                                    <h4 className="text-sm font-black text-primary truncate mb-1 pr-12">{ev.title}</h4>
                                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-muted tracking-wider">
                                                                        <div className="flex items-center gap-1">
                                                                            <Clock className="w-3 h-3 text-indigo-500" />
                                                                            <span className="tabular-nums">{ev.start_time} - {ev.end_time}</span>
                                                                        </div>
                                                                        {ev.teacher_id && (
                                                                            <div className="flex items-center gap-1">
                                                                                <UserIcon className="w-3 h-3 text-indigo-500" />
                                                                                <span className="truncate max-w-[100px]">{teachers.find(tc => tc.id === ev.teacher_id)?.full_name || t.teacherRole}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex-shrink-0 flex items-center pl-2">
                                                                    <button onClick={() => downloadIcal(ev)} className="w-10 h-10 bg-surface hover:bg-slate-100 border border-border-subtle rounded-xl flex items-center justify-center text-primary transition-all active:scale-95">
                                                                        <Calendar className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-card border border-border-subtle rounded-[2.5rem] p-6 shadow-xl shadow-black/5 space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-500">
                                        <CalendarDays className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-primary tracking-tight">{t.studioSchedule}</h2>
                                        <p className="text-[10px] font-bold text-muted opacity-60 tracking-widest">{t.bookedTimes}</p>
                                    </div>
                                </div>

                                <div className="flex bg-surface/50 p-1 rounded-xl border border-border-subtle">
                                    {(['daily', 'weekly'] as const).map(v => (
                                        <button key={v} onClick={() => setScheduleView(v)} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all uppercase", scheduleView === v ? "bg-white text-indigo-500 shadow-sm" : "text-muted hover:text-primary")}>
                                            {v === 'daily' ? <Calendar className="w-3 h-3 opacity-60" /> : <CalendarDays className="w-3 h-3 opacity-60" />}
                                            {v === 'daily' ? t.day : t.week}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-8">
                                    {(() => {
                                        const allEvents = getEvents().filter(e => !e.org_id || e.org_id === studio || e.org_id === settings?.orgId);
                                        const today = new Date();
                                        const todayStr = getLocalISODate();
                                        let days: string[] = [];
                                        if (scheduleView === 'daily') {
                                            days = [todayStr];
                                        } else {
                                            const startOfWeek = new Date(today);
                                            startOfWeek.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
                                            for (let i = 0; i < 5; i++) {
                                                const d = new Date(startOfWeek);
                                                d.setDate(startOfWeek.getDate() + i);
                                                days.push(getLocalISODate(d));
                                            }
                                        }

                                        return days.map(dayDate => {
                                            const d = new Date(`${dayDate}T00:00:00`);
                                            const dayName = d.toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US', { weekday: 'long' });
                                            const dayNum = d.getDate();
                                            const monthName = d.toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US', { month: 'short' });
                                            const isToday = dayDate === todayStr;
                                            const dayOfWeek = d.getDay();
                                            const dayEvents = allEvents.filter(e => {
                                                if (e.date === dayDate) return true;
                                                if (e.recurring === 'weekly') return new Date(`${e.date}T00:00:00`).getDay() === dayOfWeek;
                                                return false;
                                            }).sort((a, b) => a.start_time.localeCompare(b.start_time));

                                            if (dayEvents.length === 0) return null;

                                            return (
                                                <div key={dayDate} className="space-y-4">
                                                    <div className="flex items-center gap-3 px-1">
                                                        <div className={cn("px-3 py-1 rounded-lg text-[10px] font-black tracking-[0.2em] uppercase", isToday ? "bg-indigo-600 text-white" : "bg-surface border border-border-subtle text-muted")}>
                                                            {isToday ? t.today : dayName}
                                                        </div>
                                                        <div className="h-px flex-1 bg-border-subtle opacity-30" />
                                                        <span className="text-[10px] font-black text-muted opacity-40 uppercase tabular-nums">{dayNum} {monthName}</span>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {dayEvents.map(ev => {
                                                            const isMyEvent = studentData?.enrolled_group_ids?.includes(ev.group_id || '') || ev.student_id === studentId;
                                                            const groupData = groups.find(g => g.id === ev.group_id);
                                                            return (
                                                                <div key={`${ev.id}-${dayDate}`} className={cn("relative bg-surface border rounded-3xl p-4 flex gap-4 transition-all overflow-hidden group", isMyEvent ? "border-indigo-500/30 bg-indigo-50/20 shadow-lg shadow-indigo-500/5" : "border-border-subtle opacity-80 shadow-sm", dayDate < todayStr && "opacity-40 grayscale-[0.5]")}>
                                                                    {groupData && (
                                                                        <div className={cn(
                                                                            "w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black border-2 shadow-sm transition-transform group-hover:scale-105 shrink-0",
                                                                            groupData.color ? "" : "bg-violet-500 text-white border-violet-600/20"
                                                                        )} style={groupData.color ? { backgroundColor: groupData.color, color: '#fff', borderColor: 'rgba(255,255,255,0.2)' } : {}}>
                                                                            {groupData.name[0]}
                                                                        </div>
                                                                    )}
                                                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                                        <h4 className="text-sm font-black text-primary truncate mb-1">{ev.title}</h4>
                                                                        {ev.teacher_id && (
                                                                            <div className="flex items-center gap-1 text-[10px] font-bold text-muted tracking-wider">
                                                                                <UserIcon className="w-3 h-3 text-indigo-500" />
                                                                                <span className="truncate max-w-[120px]">{teachers.find(tc => tc.id === ev.teacher_id)?.full_name || t.teacherRole}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-shrink-0 flex flex-col items-end justify-center font-black">
                                                                        <span className="text-[11px] text-primary tabular-nums">{ev.start_time}</span>
                                                                        <span className="text-[9px] text-muted opacity-40 tabular-nums">{ev.end_time}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'shop' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
                        <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-3xl p-5 mb-2 relative overflow-hidden">
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                    <ShoppingBag className="w-6 h-6" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">{t.shop}</span>
                                    <h2 className="text-base font-black text-primary tracking-tight mt-0.5">{t.availableProducts}</h2>
                                </div>
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
                                {shopProducts.map(product => (
                                    <div key={product.id} className="bg-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex flex-col group">
                                        <div className="aspect-square bg-surface flex items-center justify-center overflow-hidden relative">
                                            {product.photo_url ? (
                                                <img src={product.photo_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 opacity-20">
                                                    <ShoppingBag className="w-8 h-8 text-muted" />
                                                </div>
                                            )}
                                            {product.quantity <= 3 && (
                                                <span className="absolute top-2 right-2 px-2 py-0.5 bg-red-500 text-white text-[9px] font-black tracking-wider rounded-full">
                                                    {product.quantity === 0 ? t.outOfStock : `${product.quantity} ${t.left}`}
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-3 flex flex-col gap-1 flex-1">
                                            <p className="text-xs font-black text-primary leading-tight">{product.name}</p>
                                            <div className="flex items-center gap-1 mt-auto pt-2">
                                                <Tag className="w-3 h-3 text-indigo-500" />
                                                <span className="text-sm font-black text-indigo-500">{formatCurrency(product.price, settings.currency || 'GEL')}</span>
                                            </div>
                                            {product.quantity > 0 && (
                                                <button onClick={() => handleProductInterest(product)} className="w-full mt-2 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-black tracking-wider rounded-xl transition-all active:scale-95 shadow-md shadow-indigo-500/20">
                                                    {t.interested}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="text-center text-[9px] font-bold text-muted tracking-[0.2em] opacity-20 pt-4">{t.buyInStudio}</p>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="fixed inset-0 z-[100] flex justify-center bg-black/10 backdrop-blur-sm animate-in fade-in duration-300 sm:px-4">
                        <div className="w-full h-full max-w-lg bg-white shadow-2xl overflow-hidden flex flex-col relative animate-in slide-in-from-bottom-8 duration-500">
                            <div className="h-16 border-b border-border-subtle bg-white/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-20">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                                        <MessageSquare className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black text-primary tracking-tight leading-none mb-1">{selectedChatId === 'studio' ? settings.studioName : (groups.find(g => g.id === selectedChatId)?.name || t.chat)}</h2>
                                        <p className="text-[10px] font-bold text-emerald-500 tracking-widest uppercase leading-none">Online</p>
                                    </div>
                                </div>
                            <button onClick={() => setActiveTab('info')} className="p-2 text-muted hover:text-primary transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {studentData?.enrolled_group_ids && studentData.enrolled_group_ids.length > 0 && (
                            <div className="flex gap-2 p-4 border-b border-border-subtle bg-surface/30 overflow-x-auto no-scrollbar">
                                <button onClick={() => setSelectedChatId('studio')} className={cn("px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all flex items-center gap-2", selectedChatId === 'studio' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "bg-white border border-border-subtle text-muted hover:text-primary")}>
                                    <ShieldCheck className="w-3 h-3" />
                                    {lang === 'ka' ? 'სტუდია' : (t.administration || 'Studio')}
                                </button>
                                {studentData.enrolled_group_ids.map(gid => {
                                    const group = groups.find((g: any) => g.id === gid);
                                    if (!group) return null;
                                    return (
                                        <button key={gid} onClick={() => setSelectedChatId(gid)} className={cn("px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all flex items-center gap-2", selectedChatId === gid ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "bg-white border border-border-subtle text-muted hover:text-primary")}>
                                            <UserRound className="w-3 h-3" />
                                            {group.name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-surface/5">
                            {chatMessages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                                    <div className="w-16 h-16 bg-surface border border-border-subtle rounded-3xl flex items-center justify-center text-indigo-500">
                                        <MessageSquare className="w-8 h-8" />
                                    </div>
                                    <p className="text-xs font-bold px-10">{selectedChatId === 'studio' ? t.chatWelcome : t.chatStartHint}</p>
                                </div>
                            ) : (
                                chatMessages.map((m, idx) => {
                                    const isMe = m.sender === 'student';
                                    return (
                                        <div key={m.id || idx} className={cn("flex gap-3", isMe ? "flex-row-reverse" : "flex-row")}>
                                            <div className="flex-shrink-0 mt-auto">
                                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm", isMe ? "bg-indigo-600 text-white" : "bg-white border border-border-subtle text-primary")}>
                                                    {isMe ? (studentData?.photo_url ? <img src={studentData.photo_url} className="w-full h-full rounded-full object-cover" /> : studentData?.full_name?.[0]) : (selectedChatId === 'studio' ? <ShieldCheck className="w-4 h-4" /> : <UserRound className="w-4 h-4" />)}
                                                </div>
                                            </div>
                                            <div className={cn("flex flex-col max-w-[80%]", isMe ? "items-end" : "items-start")}>
                                                {!isMe && (
                                                    <span className="text-[9px] font-black text-muted opacity-40 uppercase tracking-widest mb-1 px-1">{selectedChatId === 'studio' ? settings.studioName : (m.sender_name || 'Admin')}</span>
                                                )}
                                                <div className={cn("p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm", isMe ? "bg-indigo-600 text-white rounded-br-none" : "bg-white border border-border-subtle text-primary rounded-bl-none")}>
                                                    {m.attachment && (
                                                        <div className="mb-3 overflow-hidden rounded-xl border border-white/10">
                                                            <img src={m.attachment.data} className="w-full h-auto max-h-[300px] object-contain bg-black/10" alt="attachment" />
                                                        </div>
                                                    )}
                                                    {m.text}
                                                </div>
                                                <span className="text-[8px] font-bold text-muted/30 tracking-widest mt-1 px-1 uppercase">
                                                    {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            {isSyncingChat && (
                                <div className="flex items-center gap-2 text-muted/40 font-bold text-[10px] tracking-widest px-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    {t.loading}
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-card/80 backdrop-blur-md border-t border-border-subtle">
                            <div className="relative flex items-center gap-3">
                                    <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-surface border border-border-subtle text-muted hover:text-indigo-500 rounded-xl transition-all active:scale-95">
                                        <ImageIcon className="w-5 h-5" />
                                    </button>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file && studentId && studio) {
                                                const reader = new FileReader();
                                                reader.onload = async (ev) => {
                                                    const attachment = { name: file.name, type: file.type, size: file.size, data: ev.target?.result as string };
                                                    const channelId = selectedChatId === 'studio' ? studentId : selectedChatId;
                                                    const newMsg = { id: Date.now().toString(), text: '', attachment, sender: 'student', sender_name: studentData?.full_name || 'Student', timestamp: new Date().toISOString(), read: false };
                                                    const updated = [...chatMessages, newMsg];
                                                    setChatMessages(updated);
                                                    const localKey = getScopedKey(`chat_${channelId}`, studio);
                                                    safeSetItem(localKey, JSON.stringify(updated), studio);
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        className="hidden" 
                                        accept="image/*" 
                                    />
                                    <div className="relative flex-1">
                                        <input
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                            placeholder={(t.sendMessageToStart || 'Message') + '...'}
                                            className="w-full bg-surface border border-border-subtle focus:border-indigo-500/40 rounded-2xl px-5 py-4 pr-14 text-sm font-medium outline-none transition-all placeholder:text-muted/40 shadow-inner"
                                        />
                                        <button onClick={handleSendMessage} disabled={!chatInput.trim() || isSyncingChat} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 text-white rounded-xl disabled:opacity-20 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-600/20">
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                            </div>
                            <p className="text-center text-[9px] font-bold text-muted/30 tracking-[0.2em] mt-3 uppercase">{settings.studioName} Secure Messenger</p>
                        </div>
                    </div>
                </div>
                )}
            </div>

            {/* Footer */}
            <div className="text-center pt-12 pb-6">
                <p className="text-[9px] font-black text-muted tracking-[0.3em] opacity-20">ClassCore Portal</p>
            </div>
        </div>
    );
}
 
