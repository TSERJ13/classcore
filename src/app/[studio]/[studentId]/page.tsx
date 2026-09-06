'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { SupportChat } from '@/components/support/SupportChat';
import {
    User, CreditCard, Calendar, CheckCircle,
    ArrowRight, ShieldCheck, Heart,
    MessageSquare, Smartphone, Clock,
    QrCode, Copy, Check, Info, CalendarDays,
    Send, ChevronRight, ChevronLeft, Download, Users,
    ExternalLink, BellOff, BellRing,
    CircleUser, AlertCircle, ShoppingBag, Tag, Loader2, TrendingUp, Activity, History, X
} from 'lucide-react';
const UserIcon = User;
import { cn, getLocalISODate, formatCurrency, getScopedKey, safeSetItem, formatDate } from '@/lib/utils';
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

type ActiveTab = 'info' | 'schedule' | 'history' | 'shop' | 'chat';


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

    // Sync portal language with student's preferred language
    useEffect(() => {
        if (studentData?.preferred_language) {
            setLang(studentData.preferred_language as any, 'session');
        }
    }, [studentData?.preferred_language, setLang]);

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
    const [showQrModal, setShowQrModal] = useState(false);
    const [scheduleView, setScheduleView] = useState<'daily' | 'weekly'>('daily');
    const [monthOffset, setMonthOffset] = useState(0);
    const [historyRange, setHistoryRange] = useState<'current' | '3m' | '6m' | '12m'>('current');
    const [selectedPeriodOffset, setSelectedPeriodOffset] = useState<number>(0);
    const [viewAllMonths, setViewAllMonths] = useState(false);

    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isSyncingChat, setIsSyncingChat] = useState(false);
    const [selectedChatId, setSelectedChatId] = useState<string>('studio');
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const hasLoadedRef = useRef(false);

    const [authState, setAuthState] = useState<'welcome' | 'phone' | 'authenticated'>('welcome');
    const [phoneInput, setPhoneInput] = useState('');
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        let isMounted = true;

        // 🚀 1. INSTANT 0-MS LOCAL RENDER
        if (studentId && studio && typeof window !== 'undefined') {
            const targetId = studentId.trim().toLowerCase();
            const localStudents = getStudents();
            const localMatch = localStudents.find(st =>
                st.id && st.id.trim().toLowerCase() === targetId
            );
            if (localMatch && isMounted) {
                setStudentData(localMatch as Student);
                const s = getSubscription(localMatch.id || studentId, undefined, undefined, false);
                const todayStr = getLocalISODate();
                const isValidActive = s && s.status === 'active' && s.expires_at >= todayStr && (s.sessions_total === null || (s.sessions_total - (s.sessions_used || 0)) > 0);
                setSub(isValidActive ? s : null);
                setIsLoading(false); // Render portal in 0ms!

                const patch = getStudentPatch(studentId);
                const nfcUid = patch.nfc_uid || localMatch.nfc_uid;
                const origin = typeof window !== 'undefined' ? window.location.origin : '';
                const studioSlug = studio || 'studio';
                const finalQrData = nfcUid ? nfcUid : `${origin}/${studioSlug}/${studentId}`;
                generateQRDataUrl(finalQrData).then(url => { if (isMounted) setQrDataUrl(url); });
            }
        }

        const loadPortal = async () => {
            if (!studentId || !studio) {
                if (isMounted) setIsLoading(false);
                return;
            }

            try {
                if (isMounted) setSyncing(true);
                const unwrap = (i: any) => (i?.data && typeof i.data === 'object') ? { ...i, ...i.data } : i;
                const targetId = studentId.trim().toLowerCase();

                let foundStudent: any = null;

                try {
                    const cloudData = await fetchFullStudioState(studio, undefined, undefined, true, studentId);
                    if (cloudData && isMounted) {
                        const settingsBlob = cloudData.settingsRecord?.staff_data || cloudData.studio?.settings;
                        const mapping: any = {
                            cc_student_data: [
                                ...(cloudData.students || []),
                                ...(settingsBlob?.students || [])
                            ].map(unwrap),
                            cc_groups: (cloudData.groups || settingsBlob?.groups || []).map(unwrap),
                            cc_halls: (cloudData.halls || settingsBlob?.halls || []).map(unwrap),
                            cc_teachers: (cloudData.staff || settingsBlob?.staff || []).map(unwrap),
                            cc_attendance_archive: (cloudData.attendance || settingsBlob?.attendance || []).map(unwrap),
                            cc_subscription_plans: (cloudData.plans || settingsBlob?.subscription_plans || []).map(unwrap),
                            cc_student_subscriptions: [
                                ...(cloudData.subscriptions || []),
                                ...(settingsBlob?.subscriptions || [])
                            ].map(unwrap).reduce((acc: any, sub: any) => {
                                const sId = sub.student_id;
                                if (sId) { if (!acc[sId]) acc[sId] = []; acc[sId].push(sub); }
                                return acc;
                            }, {}),
                            cc_shop_products: (cloudData.products || settingsBlob?.shop_products || []).map(unwrap),
                            cc_calendar_events: (cloudData.events || settingsBlob?.calendar_events || []).map(unwrap),
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
                        if (settingsBlob) setSettings(settingsBlob);

                        const unwrappedStudents = mapping.cc_student_data;
                        foundStudent = unwrappedStudents.find((s: any) => 
                            (s.id && s.id.trim().toLowerCase() === targetId) || 
                            (s.student_id && s.student_id.trim().toLowerCase() === targetId)
                        );
                    }
                } catch (err) {
                    console.error('Cloud hydration error:', err);
                } finally {
                    if (isMounted) setSyncing(false);
                }

                // Fallback to local store if cloud query didn't find student or timed out
                if (!foundStudent && typeof window !== 'undefined') {
                    const students = getStudents();
                    foundStudent = students.find(st => 
                        st.id && st.id.trim().toLowerCase() === targetId
                    );
                }

                if (foundStudent && isMounted) {
                    setStudentData(foundStudent as Student);
                    const s = getSubscription(foundStudent.id || studentId, undefined, undefined, false);
                    const todayStr = getLocalISODate();
                    const isValidActive = s && s.status === 'active' && s.expires_at >= todayStr && (s.sessions_total === null || (s.sessions_total - (s.sessions_used || 0)) > 0);
                    setSub(isValidActive ? s : null);

                    const patch = getStudentPatch(studentId);
                    const nfcUid = patch.nfc_uid || foundStudent.nfc_uid;
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    const studioSlug = studio || 'studio';
                    const finalQrData = nfcUid ? nfcUid : `${origin}/${studioSlug}/${studentId}`;
                    generateQRDataUrl(finalQrData).then(url => {
                        if (isMounted) setQrDataUrl(url);
                    });
                    
                    logAction('portal_visit', studio, { studentId });
                    hasLoadedRef.current = true;
                }
            } catch (err) {
                console.error('Portal load error:', err);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                    setSyncing(false);
                }
            }
        };

        loadPortal();

        return () => {
            isMounted = false;
        };
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

    const handleAuth = () => {
        if (!studentData) return;
        const cleanInput = phoneInput.replace(/\D/g, '');
        const cleanStudentPhone = studentData.phone.replace(/\D/g, '');
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

    // ✅ Computed variables that were missing
    const initials = studentData ? (
        (studentData.first_name?.[0] || '') + (studentData.last_name?.[0] || '')
    ).toUpperCase() : '';

    const remaining = sub?.sessions_total != null && sub?.sessions_used != null
        ? sub.sessions_total - sub.sessions_used
        : null;

    const isExpiring = remaining != null && remaining <= 2;

    if (isLoading || (syncing && !studentData)) {
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

    const renderAttendanceHistoryCard = () => {
        const todayStr = getLocalISODate();
        const checkins = getStudentCheckins(studentId);
        const checkinDates = new Set(checkins.map(c => c.date));

        const enrolledGroups = getGroups().filter(g =>
            studentData?.enrolled_group_ids?.includes(g.id)
        );
        // 🛠️ FIX: individual/pair-lesson events store `student_id` as a
        // comma-joined string (e.g. "idA,idB") when the lesson was issued to
        // a couple/pair subscription (see IssueSubscriptionModal.tsx, which
        // passes the same joined studentId into both saveSubscription() and
        // generateIndividualEvents()). An exact `e.student_id === studentId`
        // check here NEVER matches for either half of a pair, so a paired
        // student's own individual lessons silently never appeared on their
        // own student-portal history. Split + compare instead.
        const myEvents = getEvents().filter(e => (e.student_id || '').split(',').map(x => x.trim().toLowerCase()).includes(studentId) || studentData?.enrolled_group_ids?.includes(e.group_id || ''));

        // Student subscriptions to verify active subscription status on past dates
        const studentSubs = getStudentSubscriptions(studentId);
        const isIndOrRentalSub = (s: SubscriptionInfo) => s.plan_type === 'individual' || s.plan_type === 'rental';

        // 🛠️ FIX: an individual/rental subscription must NEVER "cover" (or
        // gate the visible history range for) a GROUP class, and vice versa
        // — the same isolation rule attendance/page.tsx already enforces
        // for roster matching ("NEVER leak individual sub visits into group
        // classes"). Before this fix, a single global earliestStudentDate /
        // hadActiveSubOnDate mixed all subscription types together, so e.g.
        // an old individual-lesson subscription's purchase date could
        // silently "open the gate" and mark a brand-new group's sessions as
        // covered/missed for dates before the student ever joined that
        // group.
        const earliestDateFor = (subs: SubscriptionInfo[]) => {
            let earliest = studentData?.created_at ? getLocalISODate(new Date(studentData.created_at)) : '';
            const dates = subs.map(s => s.purchased_at).filter(Boolean).sort();
            if (dates.length > 0 && (!earliest || dates[0] < earliest)) earliest = dates[0];
            return earliest;
        };
        const groupSubs = studentSubs.filter(s => !isIndOrRentalSub(s));
        const indSubs = studentSubs.filter(s => isIndOrRentalSub(s));
        const earliestGroupDate = earliestDateFor(groupSubs);

        const hadActiveSubOnDateFor = (dateStr: string, subs: SubscriptionInfo[]) => {
            if (!subs || subs.length === 0) return false;
            return subs.some(s => {
                const purchaseDate = s.purchased_at ? getLocalISODate(new Date(s.purchased_at)) : '';
                const expiryDate = s.expires_at || '';
                if (purchaseDate && dateStr < purchaseDate) return false;
                if (expiryDate && dateStr > expiryDate) return false;
                return true;
            });
        };

        const weekdayLabels = lang === 'ka' 
            ? ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი']
            : lang === 'ru'
            ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
            : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

        // Helper to compute stats & days for any month offset
        const calculateMonthData = (offset: number) => {
            const now = new Date();
            const targetDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
            const year = targetDate.getFullYear();
            const month = targetDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            const firstDayRaw = new Date(year, month, 1).getDay();
            const startingEmptySlots = (firstDayRaw + 6) % 7;

            const monthYearLabel = targetDate.toLocaleDateString(
                lang === 'ka' ? 'ka-GE' : lang === 'ru' ? 'ru-RU' : 'en-US',
                { month: 'long', year: 'numeric' }
            );
            const monthShortLabel = targetDate.toLocaleDateString(
                lang === 'ka' ? 'ka-GE' : lang === 'ru' ? 'ru-RU' : 'en-US',
                { month: 'short' }
            );

            let scheduledCount = 0;
            let attendedCount = 0;
            let missedWithSubCount = 0;
            let noSubCount = 0;

            const days: Array<{
                dayNum: number;
                dateStr: string;
                isScheduled: boolean;
                status: 'attended' | 'missed_with_sub' | 'no_sub' | 'none' | 'future';
            }> = [];

            for (let d = 1; d <= daysInMonth; d++) {
                const dateObj = new Date(year, month, d);
                const dStr = getLocalISODate(dateObj);
                const dayOfWeek = (dateObj.getDay() + 6) % 7; // Mon=0

                const hasScheduledGroup = enrolledGroups.some(g => {
                    if (g.schedule_slots && Array.isArray(g.schedule_slots)) {
                        return g.schedule_slots.some((s: any) => s.dayOfWeek === dayOfWeek);
                    }
                    return false;
                });
                const hasIndividualEvent = myEvents.some(e => e.date === dStr);
                const groupDayEligible = hasScheduledGroup && (!earliestGroupDate || dStr >= earliestGroupDate);
                const isScheduledDay = groupDayEligible || hasIndividualEvent;

                let status: 'attended' | 'missed_with_sub' | 'no_sub' | 'none' | 'future' = 'none';

                if (dStr > todayStr) {
                    status = isScheduledDay ? 'future' : 'none';
                } else if (checkinDates.has(dStr)) {
                    status = 'attended';
                    if (isScheduledDay) scheduledCount++;
                    attendedCount++;
                } else if (isScheduledDay) {
                    scheduledCount++;
                    const covered =
                        (groupDayEligible && hadActiveSubOnDateFor(dStr, groupSubs)) ||
                        (hasIndividualEvent && hadActiveSubOnDateFor(dStr, indSubs));
                    if (covered) {
                        status = 'missed_with_sub';
                        missedWithSubCount++;
                    } else {
                        status = 'no_sub';
                        noSubCount++;
                    }
                }

                days.push({
                    dayNum: d,
                    dateStr: dStr,
                    isScheduled: isScheduledDay,
                    status
                });
            }

            const totalMissed = missedWithSubCount + noSubCount;
            const rate = scheduledCount > 0
                ? Math.round((attendedCount / scheduledCount) * 100)
                : (attendedCount > 0 ? 100 : 0);
            const missedRate = scheduledCount > 0
                ? Math.round((totalMissed / scheduledCount) * 100)
                : 0;

            return {
                offset,
                year,
                month,
                monthYearLabel,
                monthShortLabel,
                startingEmptySlots,
                days,
                scheduledCount,
                attendedCount,
                missedWithSubCount,
                noSubCount,
                totalMissed,
                rate,
                missedRate
            };
        };

        // Determine which month offsets belong to the selected range
        const periodOffsets: number[] =
            historyRange === 'current' ? [monthOffset] :
            historyRange === '3m' ? [0, -1, -2] :
            historyRange === '6m' ? [0, -1, -2, -3, -4, -5] :
            [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11];

        const monthsData = periodOffsets.map(calculateMonthData);

        // Aggregate statistics for the selected period
        const totalPeriodScheduled = monthsData.reduce((sum, m) => sum + m.scheduledCount, 0);
        const totalPeriodAttended = monthsData.reduce((sum, m) => sum + m.attendedCount, 0);
        const totalPeriodMissedWithSub = monthsData.reduce((sum, m) => sum + m.missedWithSubCount, 0);
        const totalPeriodNoSub = monthsData.reduce((sum, m) => sum + m.noSubCount, 0);
        const totalPeriodMissed = totalPeriodMissedWithSub + totalPeriodNoSub;

        const periodAttendanceRate = totalPeriodScheduled > 0
            ? Math.round((totalPeriodAttended / totalPeriodScheduled) * 100)
            : (totalPeriodAttended > 0 ? 100 : 0);

        const periodMissedRate = totalPeriodScheduled > 0
            ? Math.round((totalPeriodMissed / totalPeriodScheduled) * 100)
            : 0;

        const periodMissedWithSubRate = totalPeriodScheduled > 0
            ? Math.round((totalPeriodMissedWithSub / totalPeriodScheduled) * 100)
            : 0;

        const periodMissedNoSubRate = totalPeriodScheduled > 0
            ? Math.round((totalPeriodNoSub / totalPeriodScheduled) * 100)
            : 0;

        // Current active month to show in calendar
        const activeMonth = historyRange === 'current'
            ? monthsData[0]
            : (monthsData.find(m => m.offset === selectedPeriodOffset) || monthsData[0]);

        // Helper to render a month's days grid with designer aesthetics
        const renderMonthGrid = (m: ReturnType<typeof calculateMonthData>) => (
            <div className="space-y-3">
                {/* Weekday Labels Header */}
                <div className="grid grid-cols-7 text-center">
                    {weekdayLabels.map((wLabel, i) => (
                        <span key={i} className="text-[10px] font-black text-muted opacity-50 uppercase tracking-wider py-0.5">{wLabel}</span>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                    {/* Empty offset slots */}
                    {Array.from({ length: m.startingEmptySlots }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square" />
                    ))}

                    {/* Month Days */}
                    {m.days.map((dayItem) => {
                        const isToday = dayItem.dateStr === todayStr;
                        return (
                            <div
                                key={dayItem.dayNum}
                                title={`${dayItem.dateStr} — ${dayItem.status}`}
                                className={cn(
                                    "aspect-square rounded-2xl flex flex-col items-center justify-center text-xs font-bold transition-all relative select-none",
                                    dayItem.status === 'attended' && "bg-emerald-500 text-white shadow-md shadow-emerald-500/25 font-black scale-[0.98]",
                                    dayItem.status === 'missed_with_sub' && "bg-rose-500 text-white shadow-md shadow-rose-500/25 font-black scale-[0.98]",
                                    dayItem.status === 'no_sub' && "bg-amber-400 text-amber-950 border-2 border-amber-500 font-black shadow-md shadow-amber-400/30 scale-[0.98]",
                                    dayItem.status === 'future' && "bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200/60 dark:border-indigo-800/40",
                                    dayItem.status === 'none' && "text-muted/40 hover:text-muted/80 hover:bg-surface/60",
                                    isToday && (dayItem.status === 'none' || dayItem.status === 'future') && "ring-2 ring-indigo-500 text-indigo-600 dark:text-indigo-400 font-black bg-indigo-500/10"
                                )}
                            >
                                <span>{dayItem.dayNum}</span>
                                {dayItem.status === 'future' && (
                                    <span className="w-1 h-1 rounded-full bg-indigo-500 absolute bottom-1.5" />
                                )}
                                {isToday && dayItem.status !== 'future' && (
                                    <span className="w-1 h-1 rounded-full bg-indigo-500 absolute bottom-1.5" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );

        return (
            <div className="bg-card border border-border-subtle rounded-[2.5rem] p-5 sm:p-7 shadow-xl shadow-indigo-500/5 animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                {/* Header & Range Selector */}
                <div className="space-y-3 pb-3 border-b border-border-subtle/50">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner shrink-0">
                                <Activity className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm sm:text-base font-black text-primary tracking-tight">
                                    {l('დასწრების ისტორია', 'История посещений', 'Attendance History')}
                                </h3>
                                <p className="text-[10px] sm:text-xs font-bold text-muted opacity-60">
                                    {historyRange === 'current'
                                        ? l('მიმდინარე თვე', 'Текущий месяц', 'Current Month')
                                        : historyRange === '3m'
                                        ? l('ბოლო 3 თვე', 'Последние 3 месяца', 'Last 3 Months')
                                        : historyRange === '6m'
                                        ? l('ბოლო 6 თვე', 'Последние 6 месяцев', 'Last 6 Months')
                                        : l('ბოლო 12 თვე', 'Последние 12 месяцев', 'Last 12 Months')}
                                </p>
                            </div>
                        </div>

                        {/* 🛠️ FIX: was a single `overflow-x-auto` row — with 4
                        Georgian labels this never fully fit a phone-width
                        card, so the last pill ("12 თვე") sat half-cut at the
                        scrollable edge with no hint that it could be
                        scrolled to, reading as a broken/ugly filter. A 2x2
                        grid on narrow screens always shows all 4 options at
                        once with nothing clipped; it becomes a single row
                        again once there's room (sm+). */}
                        <div className="grid grid-cols-2 sm:flex sm:items-center gap-1 p-1 bg-surface rounded-2xl border border-border-subtle text-xs shrink-0">
                            {([
                                { id: 'current', label: l('მიმდინარე თვე', 'Текущий месяц', 'Current') },
                                { id: '3m', label: l('3 თვე', '3 мес.', '3 Mo') },
                                { id: '6m', label: l('6 თვე', '6 мес.', '6 Mo') },
                                { id: '12m', label: l('12 თვე', '12 мес.', '12 Mo') },
                            ] as const).map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setHistoryRange(tab.id);
                                        setSelectedPeriodOffset(0);
                                        setViewAllMonths(false);
                                    }}
                                    className={cn(
                                        "px-2 sm:px-3 py-1.5 rounded-xl font-black text-[10px] sm:text-xs transition-all whitespace-nowrap sm:flex-1 text-center",
                                        historyRange === tab.id
                                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-[1.02]"
                                            : "text-muted hover:text-primary hover:bg-surface/80"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 🛠️ FIX: the two cards below both repeated their own
                percentage twice (once as a small header badge, once as the
                big number) — the same figure shown twice in one card reads
                as a glitch, not as information. Removed the redundant
                badges. Also swapped the order so the positive "Attendance"
                figure leads (parents check "did my kid go?", not "how much
                did they miss?" first) and added a plain-language note when
                the sample is too small (1-2 scheduled lessons) for a 100%/0%
                swing to mean anything — without it, a brand-new student's
                very first missed class reads as a dramatic "100% missed"
                red flag instead of what it actually is. */}
                {totalPeriodScheduled > 0 && totalPeriodScheduled <= 2 && (
                    <p className="text-[10px] sm:text-[11px] font-bold text-muted/70 bg-surface/60 border border-border-subtle/50 rounded-2xl px-3 py-2 -mt-2">
                        {l(
                            `ჯერ მხოლოდ ${totalPeriodScheduled} დაგეგმილი გაკვეთილია ამ პერიოდში — პროცენტი მეტ მონაცემთან ერთად დაზუსტდება.`,
                            `Пока всего ${totalPeriodScheduled} запланированных занятий за этот период — процент уточнится с большим количеством данных.`,
                            `Only ${totalPeriodScheduled} lesson(s) scheduled so far this period — the percentage will settle in as more data comes in.`
                        )}
                    </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                    {/* 1. დასწრების პროცენტობა (positive framing leads) */}
                    <div className="bg-emerald-500/[0.04] dark:bg-emerald-500/[0.07] border border-emerald-500/20 rounded-3xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            {l('დასწრება', 'Посещаемость', 'Attendance')}
                        </span>
                        <div className="my-2">
                            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">
                                {periodAttendanceRate}%
                            </div>
                            <p className="text-[10px] sm:text-[11px] font-bold text-muted mt-0.5">
                                {totalPeriodAttended} / {totalPeriodScheduled} {l('გაკვეთილზე ესწრებოდა', 'занятий посещено', 'lessons attended')}
                            </p>
                        </div>
                        <div className="pt-2 border-t border-emerald-500/15 flex items-center justify-between text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <span>{l('ვიზიტები', 'Визиты', 'Visits')}:</span>
                            <span className="font-black tabular-nums">{totalPeriodAttended} {l('დასწრებული', 'посещено', 'attended')}</span>
                        </div>
                    </div>

                    {/* 2. გაცდენების პროცენტობა */}
                    <div className="bg-rose-500/[0.04] dark:bg-rose-500/[0.07] border border-rose-500/20 rounded-3xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-rose-500/40 transition-all">
                        <span className="text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                            {l('გაცდენები', 'Пропуски', 'Missed')}
                        </span>
                        <div className="my-2">
                            <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight tabular-nums">
                                {periodMissedRate}%
                            </div>
                            <p className="text-[10px] sm:text-[11px] font-bold text-muted mt-0.5">
                                {totalPeriodMissed} {l('გაცდენა', 'пропусков', 'missed')}
                            </p>
                        </div>
                        <div className="pt-2 border-t border-rose-500/15 space-y-1 text-[10px]">
                            {totalPeriodMissedWithSub > 0 && (
                                <div className="flex items-center justify-between text-rose-500 font-bold">
                                    <span>{l('აქტიური აბონემენტით', 'С активным абонементом', 'With active sub')}:</span>
                                    <span className="font-black tabular-nums">{totalPeriodMissedWithSub}</span>
                                </div>
                            )}
                            {totalPeriodNoSub > 0 && (
                                <div className="flex items-center justify-between font-black text-amber-700 dark:text-amber-300 bg-amber-400/25 px-1.5 py-0.5 rounded-md border border-amber-400/40">
                                    <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        {l('აბონემენტი არ ჰქონდა', 'Не было абонемента', 'No subscription')}:
                                    </span>
                                    <span className="tabular-nums">{totalPeriodNoSub}</span>
                                </div>
                            )}
                            {totalPeriodMissed === 0 && (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {l('გაცდენის გარეშე 🎉', 'Без пропусков 🎉', 'No misses 🎉')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Segmented Progress Bar */}
                <div className="space-y-1.5">
                    <div className="h-2.5 w-full bg-surface rounded-full overflow-hidden flex p-0.5 border border-border-subtle/60 gap-0.5">
                        {periodAttendanceRate > 0 && (
                            <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${periodAttendanceRate}%` }}
                                title={`${l('დასწრება', 'Посещаемость', 'Attendance')}: ${periodAttendanceRate}%`}
                            />
                        )}
                        {totalPeriodScheduled > 0 && totalPeriodMissedWithSub > 0 && (
                            <div
                                className="h-full bg-rose-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.round((totalPeriodMissedWithSub / totalPeriodScheduled) * 100)}%` }}
                                title={`${l('გაცდენა (აბონემენტით)', 'Пропуск с аб.', 'Missed (with sub)')}: ${periodMissedWithSubRate}%`}
                            />
                        )}
                        {totalPeriodScheduled > 0 && totalPeriodNoSub > 0 && (
                            <div
                                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                                style={{ width: `${Math.round((totalPeriodNoSub / totalPeriodScheduled) * 100)}%` }}
                                title={`${l('აბონემენტის გარეშე', 'Без абонемента', 'No sub')}: ${periodMissedNoSubRate}%`}
                            />
                        )}
                    </div>
                </div>

                {/* Sleek Legend */}
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] font-bold text-muted/80 px-2 py-1.5 bg-surface/50 rounded-2xl border border-border-subtle/40">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-sm shadow-emerald-500/30" />
                        <span>{l('მოვიდა', 'Пришел', 'Attended')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 shadow-sm shadow-rose-500/30" />
                        <span>{l('გაცდენა (აბონემენტით)', 'Пропуск (с аб.)', 'Missed (with sub)')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-500 shrink-0 shadow-sm shadow-amber-400/30" />
                        <span className="text-amber-600 dark:text-amber-400 font-extrabold">{l('აბონემენტის გარეშე', 'Без абонемента', 'No sub')}</span>
                    </div>
                </div>

                {/* Calendar Navigation and Month Display */}
                {historyRange === 'current' ? (
                    <div className="space-y-3 pt-2 border-t border-border-subtle/50">
                        {/* Month Header with < > Arrows */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 capitalize tracking-wide">
                                {activeMonth.monthYearLabel}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setMonthOffset(prev => prev - 1)}
                                    className="w-8 h-8 rounded-xl bg-surface border border-border-subtle hover:border-indigo-500/40 text-primary flex items-center justify-center transition-all active:scale-90 shadow-sm"
                                    title={l('წინა თვე', 'Предыдущий месяц', 'Previous Month')}
                                >
                                    <ChevronLeft className="w-4 h-4 text-indigo-500" />
                                </button>
                                {monthOffset < 0 && (
                                    <button
                                        onClick={() => setMonthOffset(prev => prev + 1)}
                                        className="w-8 h-8 rounded-xl bg-surface border border-border-subtle hover:border-indigo-500/40 text-primary flex items-center justify-center transition-all active:scale-90 shadow-sm"
                                        title={l('შემდეგი თვე', 'Следующий месяц', 'Next Month')}
                                    >
                                        <ChevronRight className="w-4 h-4 text-indigo-500" />
                                    </button>
                                )}
                            </div>
                        </div>
                        {renderMonthGrid(activeMonth)}
                    </div>
                ) : (
                    <div className="space-y-4 pt-2 border-t border-border-subtle/50">
                        {/* Month Selector Pills within the selected period */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                                {monthsData.map((m) => {
                                    const isSelected = !viewAllMonths && activeMonth.offset === m.offset;
                                    return (
                                        <button
                                            key={m.offset}
                                            onClick={() => {
                                                setSelectedPeriodOffset(m.offset);
                                                setViewAllMonths(false);
                                            }}
                                            className={cn(
                                                "px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border",
                                                isSelected
                                                    ? "bg-indigo-600 text-white border-indigo-600 font-black shadow-md shadow-indigo-600/20"
                                                    : "bg-surface hover:bg-surface/80 text-muted hover:text-primary border-border-subtle"
                                            )}
                                        >
                                            <span className="capitalize">{m.monthShortLabel}</span>
                                            {m.missedRate > 0 && (
                                                <span className={cn(
                                                    "text-[9px] px-1 rounded-md font-black",
                                                    isSelected ? "bg-white/20 text-white" : "bg-rose-500/10 text-rose-500"
                                                )}>
                                                    {m.missedRate}%
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => setViewAllMonths(!viewAllMonths)}
                                className={cn(
                                    "px-2.5 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-black shrink-0 transition-all border",
                                    viewAllMonths
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                        : "bg-surface hover:bg-surface/80 text-muted hover:text-primary border-border-subtle"
                                )}
                            >
                                {viewAllMonths ? l('ერთი თვე', 'Один', 'Single') : l('ყველა', 'Все', 'All')}
                            </button>
                        </div>

                        {/* Calendar View: Either All Months or the Selected Single Month */}
                        {viewAllMonths ? (
                            <div className="space-y-5">
                                {monthsData.map((m) => (
                                    <div key={m.offset} className="space-y-3 bg-surface/30 rounded-2xl p-3 sm:p-4 border border-border-subtle/50">
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-xs font-black text-primary capitalize">{m.monthYearLabel}</span>
                                            <div className="flex items-center gap-2 text-[10px] font-bold">
                                                <span className="text-emerald-600 dark:text-emerald-400">{l('დასწრება', 'Посещ.', 'Att.')}: <b>{m.rate}%</b></span>
                                                <span className="text-rose-600 dark:text-rose-400">{l('გაცდენა', 'Проп.', 'Missed')}: <b>{m.missedRate}%</b></span>
                                            </div>
                                        </div>
                                        {renderMonthGrid(m)}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 capitalize">
                                        {activeMonth.monthYearLabel}
                                    </span>
                                    <div className="flex items-center gap-2 text-[10px] font-bold">
                                        <span className="text-emerald-600 dark:text-emerald-400">{l('დასწრება', 'Посещ.', 'Att.')}: <b>{activeMonth.rate}%</b></span>
                                        <span className="text-rose-600 dark:text-rose-400">{l('გაცდენა', 'Проп.', 'Missed')}: <b>{activeMonth.missedRate}%</b></span>
                                    </div>
                                </div>
                                {renderMonthGrid(activeMonth)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-card animate-fade-up max-w-lg mx-auto pb-24 md:pb-10 pt-6 px-4 relative overflow-x-hidden">
            <div className="flex items-center justify-between mb-8 mt-2 px-1">
                <div className="flex items-center gap-3">
                    {settings.logoDataUrl ? (
                        <div className="relative group p-1">
                            <div className="absolute inset-0 bg-indigo-500/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                            <img src={settings.logoDataUrl} alt={settings.studioName} className="w-10 h-10 rounded-xl object-contain shadow-md relative z-10" />
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
                    { id: 'history', icon: History, label: l('ისტორია', 'История', 'History') },
                    { id: 'shop', icon: ShoppingBag, label: t.shop },
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
                            <div className="flex items-start justify-between gap-3 relative z-10">
                                <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0">
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.8rem] bg-gradient-to-br from-indigo-500 to-indigo-700 p-0.5 shadow-xl shadow-indigo-500/20 shrink-0">
                                        <div className="w-full h-full bg-card rounded-[1.7rem] flex items-center justify-center overflow-hidden">
                                            {studentData.photo_url ? (
                                                <img src={studentData.photo_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-xl sm:text-2xl font-black text-indigo-500">{initials || '??'}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-left flex-1 min-w-0">
                                        <div className="flex flex-col mb-1">
                                            {/* 🛠️ FIX: was a single `truncate` line, so anyone
                                            with a moderately long name (very common —
                                            first + last name, sometimes both partners of a
                                            couple) had it cut off with "..." on their own
                                            profile, right next to the QR button that caused
                                            the squeeze. A person's own name is the last
                                            thing that should ever be clipped — let it wrap
                                            onto a second line instead, with a slightly
                                            smaller size on small screens to fit more of it
                                            per line. */}
                                            <h1 className="text-lg sm:text-2xl font-black text-primary tracking-tight leading-tight [overflow-wrap:anywhere] line-clamp-2">
                                                {studentData.full_name || `${studentData.first_name} ${studentData.last_name}`}
                                            </h1>
                                            <p className="text-[10px] font-bold text-indigo-500 tracking-widest uppercase opacity-70 mt-0.5 truncate">
                                                {studentData.enrolled_group_ids && studentData.enrolled_group_ids.length > 0
                                                    ? getGroups().filter(g => studentData.enrolled_group_ids?.includes(g.id)).map(g => g.name).join(', ')
                                                    : '—'}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <p className={cn("text-[10px] font-black tracking-widest uppercase", (sub?.status === 'active' || (sub?.sessions_total && sub.sessions_used < sub.sessions_total)) ? "text-emerald-500" : "text-rose-500")}>
                                                {(sub?.status === 'active' || (sub?.sessions_total && sub.sessions_used < sub.sessions_total)) ? t.active : t.inactive || 'InActive'}
                                            </p>
                                            <span className="w-1 h-1 rounded-full bg-border-subtle/50" />
                                            <p className="text-[10px] font-bold text-muted tracking-widest opacity-40">ID: {(studentData?.id || studentId).toUpperCase()}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* QR Code Quick Button */}
                                <button
                                    onClick={() => setShowQrModal(true)}
                                    className="w-11 h-11 rounded-2xl bg-indigo-500/10 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-500/20 flex items-center justify-center transition-all shadow-sm active:scale-90 shrink-0 group"
                                    title={l('QR კოდის ჩვენება', 'Показать QR код', 'Show QR Code')}
                                >
                                    <QrCode className="w-5 h-5 transition-transform group-hover:scale-110" />
                                </button>
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
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-muted opacity-40 uppercase tracking-widest">ID</span>
                                    <p className="text-sm font-black text-primary tabular-nums">{(studentData?.id || studentId).toUpperCase()}</p>
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
                                                <span>{t.expiryDate}: <span className="text-primary font-black">{formatDate(sub.expires_at)}</span></span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Attendance History Card */}
                        {renderAttendanceHistoryCard()}
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
                                            return e.org_id === studio && (sIdMatch || studentIsInGroup);
                                        });

                                        let displayEvents: CalendarEvent[] = [];
                                        if (scheduleView === 'daily') {
                                            displayEvents = myEvents.filter(e => {
                                                if (e.date === todayStr) return true;
                                                if (e.recurring === 'weekly') return new Date(`${e.date}T00:00:00`).getDay() === todayDate.getDay();
                                                return false;
                                            }).sort((a, b) => a.start_time.localeCompare(b.start_time));
                                        } else {
                                            const startOfWeek = new Date(todayDate);
                                            startOfWeek.setDate(todayDate.getDate() - (todayDate.getDay() === 0 ? 6 : todayDate.getDay() - 1));
                                            displayEvents = myEvents.filter(e => {
                                                const evDate = new Date(`${e.date}T00:00:00`);
                                                if (![1,2,3,4,5].includes(evDate.getDay())) return false;
                                                if (e.recurring === 'weekly') return true;
                                                const endOfWeek = new Date(startOfWeek);
                                                endOfWeek.setDate(startOfWeek.getDate() + 4);
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
                                        const allEvents = getEvents().filter(e => e.org_id === studio);
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
                                                            // 🛠️ Same pair-subscription fix as renderAttendanceHistoryCard() above.
                                                            const isMyEvent = studentData?.enrolled_group_ids?.includes(ev.group_id || '') || (ev.student_id || '').split(',').map(x => x.trim().toLowerCase()).includes(studentId);
                                                            return (
                                                                <div key={`${ev.id}-${dayDate}`} className={cn("relative bg-surface border rounded-3xl p-4 flex gap-4 transition-all overflow-hidden", isMyEvent ? "border-indigo-500/30 bg-indigo-50/20 shadow-lg shadow-indigo-500/5" : "border-border-subtle opacity-80 shadow-sm", dayDate < todayStr && "opacity-40 grayscale-[0.5]")}>
                                                                    {isMyEvent && (
                                                                        <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[8px] font-black tracking-widest px-3 py-1 rounded-bl-2xl uppercase">{t.myClass}</div>
                                                                    )}
                                                                    <div className="flex-shrink-0 w-12 flex flex-col items-center justify-center font-black">
                                                                        <span className="text-[11px] text-primary tabular-nums">{ev.start_time}</span>
                                                                        <div className="w-px h-3 bg-border-subtle my-0.5" />
                                                                        <span className="text-[9px] text-muted opacity-40 tabular-nums">{ev.end_time}</span>
                                                                    </div>
                                                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                                        <h4 className="text-sm font-black text-primary truncate mb-1">{ev.title}</h4>
                                                                        {ev.teacher_id && (
                                                                            <div className="flex items-center gap-1 text-[10px] font-bold text-muted tracking-wider">
                                                                                <UserIcon className="w-3 h-3 text-indigo-500" />
                                                                                <span className="truncate max-w-[120px]">{teachers.find(tc => tc.id === ev.teacher_id)?.full_name || t.teacherRole}</span>
                                                                            </div>
                                                                        )}
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

                {activeTab === 'history' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                        {/* Subscriptions History Section */}
                        <div className="bg-card border border-border-subtle rounded-[2.5rem] p-6 sm:p-8 space-y-6 shadow-xl shadow-indigo-500/5">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-black text-primary tracking-tight flex items-center gap-2">
                                    <CreditCard className="w-5 h-5 text-indigo-500" />
                                    {l('აბონემენტების ისტორია', 'История абонементов', 'Subscription History')}
                                </h3>
                                <span className="text-[10px] font-bold text-muted/60 tracking-widest uppercase">
                                    {getStudentSubscriptions(studentId).length} {l('ჩანაწერი', 'запись', 'records')}
                                </span>
                            </div>

                            {(() => {
                                const allStudentSubs = getStudentSubscriptions(studentId);
                                if (allStudentSubs.length === 0) {
                                    return (
                                        <div className="py-10 text-center space-y-3 opacity-40">
                                            <CreditCard className="w-10 h-10 mx-auto text-muted stroke-[1]" />
                                            <p className="text-xs font-bold text-muted">{t.historyEmpty || 'აბონემენტების ისტორია ცარიელია'}</p>
                                        </div>
                                    );
                                }
                                const todayStr = getLocalISODate();
                                return (
                                    <div className="space-y-4">
                                        {allStudentSubs.map(s => {
                                            const isActive = s.status === 'active' && s.expires_at >= todayStr && (s.sessions_total === null || (s.sessions_total - (s.sessions_used || 0)) > 0);
                                            const rem = s.sessions_total !== null ? Math.max(0, s.sessions_total - (s.sessions_used || 0)) : null;
                                            return (
                                                <div key={s.id} className="bg-surface/50 border border-border-subtle/70 rounded-3xl p-5 space-y-3 transition-all hover:border-indigo-500/20">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                                                                <CreditCard className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <h4 className="text-sm font-black text-primary tracking-tight">{s.plan}</h4>
                                                                <div className="flex items-center gap-1.5 opacity-60">
                                                                    <Clock className="w-3 h-3 text-muted" />
                                                                    <p className="text-[10px] font-bold text-muted">{formatDate(s.purchased_at || s.expires_at)}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className={cn("px-3 py-1 rounded-xl text-[10px] font-black tracking-wider block mb-1", isActive ? "bg-emerald-500 text-white" : "bg-rose-500/10 text-rose-500 border border-rose-500/20")}>
                                                                {isActive ? t.active : t.expired}
                                                            </span>
                                                            {s.amount_paid ? (
                                                                <span className="text-xs font-black text-indigo-600 tabular-nums">{formatCurrency(s.amount_paid, settings.currency)}</span>
                                                            ) : null}
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-between items-center pt-3 border-t border-border-subtle/50 text-[10px] font-bold text-muted">
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar className="w-3.5 h-3.5 text-indigo-500 opacity-60" />
                                                            <span>{t.expiryDate}: <span className="text-primary font-black">{formatDate(s.expires_at)}</span></span>
                                                        </div>
                                                        {rem !== null ? (
                                                            <span className="text-indigo-500 font-black">{rem} / {s.sessions_total} {t.sessions}</span>
                                                        ) : (
                                                            <span className="text-emerald-500 font-black">{l('უპატივცემულო / ულიმიტო', 'Безлимит', 'Unlimited')}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Attendance History Card */}
                        {renderAttendanceHistoryCard()}
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
            </div>

            {/* Student QR Code Modal Popup */}
            {showQrModal && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setShowQrModal(false)}
                >
                    <div
                        className="bg-card border border-border-subtle rounded-[2.5rem] p-6 sm:p-8 max-w-sm w-full shadow-2xl space-y-6 relative animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={() => setShowQrModal(false)}
                            className="absolute top-5 right-5 w-9 h-9 rounded-2xl bg-surface hover:bg-surface/80 border border-border-subtle flex items-center justify-center text-muted hover:text-primary transition-all active:scale-90"
                            title={l('დახურვა', 'Закрыть', 'Close')}
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="text-center space-y-1.5 pt-1">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
                                <QrCode className="w-6 h-6" />
                            </div>
                            <h3 className="text-base sm:text-lg font-black text-primary tracking-tight">
                                {studentData?.full_name || l('მოსწავლის QR კოდი', 'QR код ученика', 'Student QR Code')}
                            </h3>
                            <p className="text-[11px] font-bold text-muted opacity-60">
                                {l('წარუდგინეთ ადმინისტრატორს შესვლისას', 'Предъявите администратору при входе', 'Show to administrator at check-in')}
                            </p>
                        </div>

                        {/* High-res QR Code */}
                        <div className="flex justify-center">
                            <div className="p-4 bg-white rounded-3xl shadow-xl shadow-indigo-500/10 border border-border-subtle/40">
                                {qrDataUrl ? (
                                    <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 sm:w-52 sm:h-52 object-contain" />
                                ) : (
                                    <div className="w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center animate-pulse">
                                        <QrCode className="w-12 h-12 text-border-subtle" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Student ID & Copy Button */}
                        <div className="space-y-2">
                            <button
                                onClick={handleCopyId}
                                className="w-full flex items-center justify-between gap-3 bg-surface border border-border-subtle hover:border-indigo-500/40 rounded-2xl px-5 py-3.5 transition-all group active:scale-[0.99]"
                            >
                                <div className="text-left">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted opacity-50 block">ID</span>
                                    <span className="text-sm sm:text-base font-mono font-black text-primary tracking-wider uppercase">
                                        {studentId}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                    <span>{copied ? l('კოპირებულია', 'Скопировано', 'Copied') : l('კოპირება', 'Копировать', 'Copy')}</span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="text-center pt-12 pb-6">
                <p className="text-[9px] font-black text-muted tracking-[0.3em] opacity-20">ClassCore Portal</p>
            </div>
        </div>
    );
}
