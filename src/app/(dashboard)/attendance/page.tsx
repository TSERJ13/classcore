'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    Search, Scan, CalendarCheck, Check, AlertTriangle, CheckCircle2,
    ChevronLeft, ChevronRight, Calendar, Clock, X, Plus, Edit2,
    Instagram, Facebook, Send, MessageCircle, Phone, MessageSquare, Info, ShieldAlert,
    ShoppingCart, PlusCircle, Package, ArrowRight, TrendingUp, Trash2
} from 'lucide-react';
import { cn, getInitials, isExpiringSoon, getLocalISODate, formatCurrency, calculateAge } from '@/lib/utils';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { recordCheckin, forceCheckin, getCheckinCountToday, getStudentCheckins, refundCheckin, deleteCheckin, getSessionsRemaining } from '@/lib/checkin-store';
import { getStudents, updateStudent, lookupByUid, getStudentPatches } from '@/lib/student-store';
import { useUser } from '@/hooks/useUser';
import { useStudio } from '@/contexts/StudioContext';
import { getSubscriptions, getSubscription, saveSubscription, pauseActiveSubscription, type SubscriptionInfo } from '@/lib/subscription-store';
import { getEventsByDate, getEvents } from '@/lib/event-store';
import { getTeacherName } from '@/lib/teacher-store';
import { getGroups } from '@/lib/group-store';
import { loadSettings, getScopedKey } from '@/lib/settings-store';
import type { Student, CalendarEvent } from '@/types';
import StudentModal from '@/components/students/StudentModal';
import { ArrowLeftRight } from 'lucide-react';
import { getPlans } from '@/lib/plan-store';
import { IssueSubscriptionModal } from '@/components/subscriptions/IssueSubscriptionModal';
import { ManualSmsModal } from '@/components/ui/ManualSmsModal';
import { getStudentSales, recordSale, type ShopSale } from '@/lib/sales-store';
import type { Product } from '@/types';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { generateDayOptions, generateMonthOptions, generateYearOptions } from '@/lib/date-utils';
import { StandardDatePicker } from '@/components/ui/StandardDatePicker';

// ─── Data ──────────────────────────────────────────────────────────────────────



type State = 'present' | 'absent' | 'none';

import { getStudentsByClass } from '@/lib/student-data';

const THEME_CLASSES: Record<string, string> = {
    indigo: 'border-#6d28d9 text-#6d28d9 hover:bg-#6d28d9/10',
    violet: 'border-violet-500 text-violet-500 hover:bg-violet-500/10',
    emerald: 'border-emerald-500 text-emerald-500 hover:bg-emerald-500/10',
    rose: 'border-rose-500 text-rose-500 hover:bg-rose-500/10',
    amber: 'border-amber-500 text-amber-500 hover:bg-amber-500/10',
    cyan: 'border-cyan-500 text-cyan-500 hover:bg-cyan-500/10',
    fuchsia: 'border-fuchsia-500 text-fuchsia-500 hover:bg-fuchsia-500/10',
};

const SCAN_MAP: Record<string, string> = {
    'ID4A3B': '1', 'ID7X9C': '2', 'ID2M5K': '3', 'ID8R1N': '4',
    'ID3Q6P': '5', 'ID9T2W': '6', 'ID5H4V': '7', 'ID1D8U': '8',
    '04A32B1C': '1', '04B71E2D': '2', '04C85F3E': '3', '04D96A4F': '4',
};

const AVATAR_COLORS = ['from-#6d28d9 to-violet-600', 'from-emerald-500 to-teal-600', 'from-rose-500 to-pink-600', 'from-amber-500 to-orange-600'];
function avatarColor(id: string) { return AVATAR_COLORS[parseInt(id) % AVATAR_COLORS.length]; }

// ─── Popup ─────────────────────────────────────────────────────────────────────

type PopupPhase = 'success' | 'confirm' | 'double-success';
interface PopupData { studentId: string; studentName: string; sessionsRemaining: number; checkinCount: number; phase: PopupPhase; isMonthly?: boolean; }

function useCountdown(active: boolean, seconds: number, onDone: () => void) {
    const [remaining, setRemaining] = useState(seconds);
    useEffect(() => {
        if (!active) { setRemaining(seconds); return; }
        setRemaining(seconds);
        const interval = setInterval(() => {
            setRemaining(r => { if (r <= 1) { clearInterval(interval); onDone(); return 0; } return r - 1; });
        }, 1000);
        return () => clearInterval(interval);
    }, [active, seconds, onDone]);
    return remaining;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ScanPopup({ data, onClose, onConfirm, t, subscriptions, onSelectSub }: {
    data: PopupData;
    onClose: () => void;
    onConfirm: () => void;
    t: any;
    subscriptions?: SubscriptionInfo[];
    onSelectSub?: (subId: string) => void;
}) {
    const autoClose = data.phase === 'success' || data.phase === 'double-success';
    const hasMultipleSubs = (subscriptions?.length ?? 0) > 1;
    const secs = data.phase === 'double-success' ? 3 : 4;
    const countdown = useCountdown(autoClose && !hasMultipleSubs, secs, onClose);
    const progress = autoClose && !hasMultipleSubs ? (countdown / secs) * 100 : 100;

    return (
        <>
            <div className="fixed inset-0 z-[60] bg-black/20" onClick={autoClose && !hasMultipleSubs ? onClose : undefined} />
            <div className="fixed inset-x-0 bottom-0 z-[70] flex justify-center pb-24 px-4 items-center sm:inset-0 sm:pb-0 animate-in fade-in zoom-in-95 duration-200">
                <div className={cn(
                    'w-[calc(100vw-4rem)] max-w-[280px] sm:w-full sm:max-w-sm rounded-[2.5rem] border overflow-hidden bg-card transition-all',
                    data.phase === 'success' && 'border-emerald-500/10',
                    data.phase === 'confirm' && 'border-amber-500/10',
                    data.phase === 'double-success' && 'border-#6d28d9/10',
                )}>
                    {autoClose && !hasMultipleSubs && (
                        <div className="h-1 bg-surface relative overflow-hidden">
                            <div className={cn('h-full transition-all ease-linear', data.phase === 'success' ? 'bg-emerald-500' : 'bg-#6d28d9')}
                                style={{ width: `${progress}%`, transitionDuration: '1s' }} />
                        </div>
                    )}
                    <div className="p-8">
                        <div className="flex justify-center mb-6">
                            <div className="relative">
                                <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br ${avatarColor(data.studentId)} flex items-center justify-center text-white text-3xl font-black`}>
                                    {getInitials(data.studentName)}
                                </div>
                                <div className={cn('absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-4 border-card',
                                    data.phase === 'success' && 'bg-emerald-500',
                                    data.phase === 'confirm' && 'bg-amber-500',
                                    data.phase === 'double-success' && 'bg-#6d28d9',
                                )}>
                                    {data.phase === 'success' && <Check className="w-4 h-4 text-white" strokeWidth={4} />}
                                    {data.phase === 'confirm' && <AlertTriangle className="w-4 h-4 text-white" strokeWidth={3} />}
                                    {data.phase === 'double-success' && <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={3} />}
                                </div>
                            </div>
                        </div>
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-black text-primary tracking-tight">{data.studentName}</h2>
                            {data.phase === 'success' && <><p className="text-[11px] font-black text-emerald-600 tracking-widest mt-2 bg-emerald-500/10 px-3 py-1 rounded-full inline-block">✅ {t.attendanceSheet} OK</p></>}
                            {data.phase === 'confirm' && <p className="text-[11px] font-black text-amber-600 tracking-widest mt-2 bg-amber-500/10 px-3 py-1 rounded-full inline-block">⚠️ {t.alreadyCheckedIn}</p>}
                            {data.phase === 'double-success' && <p className="text-[11px] font-black text-#5b21b6 tracking-widest mt-2 bg-#6d28d9/10 px-3 py-1 rounded-full inline-block">✅ ×2 {data.isMonthly ? t.days : t.visit}</p>}
                        </div>

                        {hasMultipleSubs && subscriptions && onSelectSub ? (
                            <div className="space-y-3 mb-6">
                                <p className="text-[10px] font-black text-muted text-center opacity-40 tracking-widest">{t.selectSubscription}</p>
                                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                    {subscriptions.map(s => {
                                        const rem = (s.sessions_total ?? 0) - (s.sessions_used ?? 0);
                                        return (
                                            <button
                                                key={s.id}
                                                onClick={() => onSelectSub(s.id)}
                                                className="w-full text-left p-3 rounded-2xl bg-surface border border-border-subtle hover:border-#6d28d9/50 hover:bg-#6d28d9/5 transition-all group"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[11px] font-black text-primary truncate max-w-[140px]">{s.plan}</span>
                                                    <span className="text-[10px] font-black text-#5b21b6 tabular-nums">
                                                        {s.type === 'monthly' ? '∞' : rem}
                                                    </span>
                                                </div>
                                                <p className="text-[8px] font-bold text-muted opacity-40 mt-0.5">{s.expires_at}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className={cn('rounded-2xl p-4 mb-8 mt-2 flex items-center justify-between', data.sessionsRemaining <= 2 ? 'bg-red-500/5 border border-red-500/20' : 'bg-surface border border-border-subtle')}>
                                <span className="text-xs font-bold text-muted opacity-60">{t.remaining} {data.isMonthly ? t.days : t.visits}</span>
                                <div className="flex items-center gap-2">
                                    {(data.phase === 'success' || data.phase === 'double-success') && <span className="text-[10px] text-amber-600 font-black">-1</span>}
                                    <span className={cn('text-xl font-black tabular-nums', (data.sessionsRemaining <= 2 && !data.isMonthly) ? 'text-red-500' : 'text-emerald-500')}>
                                        {data.isMonthly ? '∞' : data.sessionsRemaining}
                                    </span>
                                </div>
                            </div>
                        )}

                        {data.phase === 'confirm' ? (
                            <div className="space-y-3">
                                <p className="text-xs text-center text-muted font-medium mb-4">{t.confirmVisit}</p>
                                <button onClick={onConfirm} className="w-full py-3.5 bg-[#6d28d9] hover:bg-[#5b21b6] active:scale-[0.97] text-white font-black text-sm rounded-2xl transition-all uppercase tracking-widest">{t.yesConfirm}</button>
                                <button onClick={onClose} className="w-full py-3 bg-surface hover:bg-surface/80 text-muted font-bold text-sm rounded-2xl transition-all">{t.skip}</button>
                            </div>
                        ) : (
                            <button onClick={onClose} className="w-full py-3.5 bg-surface hover:bg-surface/80 text-muted font-bold text-sm rounded-2xl transition-all">
                                {t.close} {(!hasMultipleSubs && autoClose) && `(${countdown}s)`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AttendancePage() {
    const { t, l } = useLanguage();
    const confirm = useConfirm();
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    const { user, profile } = useUser();
    const { settings } = useStudio();
    const isDemo = !user || profile?.studio_name === 'Demo Dance Studio' || !profile?.studio_name;

    const [groups, setGroups] = useState(getGroups());
    const GROUP_MAP = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g.name])), [groups]);
    useEffect(() => {
        const load = () => setGroups(getGroups());
        window.addEventListener('cc_groups_update', load);
        return () => window.removeEventListener('cc_groups_update', load);
    }, []);

    const [selectedDate, setSelectedDate] = useState(new Date());
    const dateKey = getLocalISODate(selectedDate);
    const rawSchedule = getEventsByDate(dateKey);
    
    const filteredSchedule = useMemo(() => {
        const dayOfWeek = (selectedDate.getDay() + 6) % 7;
        
        let targetSchedule = rawSchedule;
        if (targetSchedule.length === 0) {
            targetSchedule = groups
                .filter(g => g.schedule_slots?.some(s => s.dayOfWeek === dayOfWeek))
                .map(g => {
                    const slot = g.schedule_slots?.find(s => s.dayOfWeek === dayOfWeek);
                    return {
                        id: `virtual-${g.id}`,
                        group_id: g.id,
                        title: g.name,
                        type: 'group',
                        color: g.color || '#6d28d9',
                        start_time: slot?.startTime || '00:00',
                        end_time: slot?.endTime || '23:59'
                    };
                }) as any;
        }

        return targetSchedule.filter(ev => {
            if (profile?.role === 'teacher' || profile?.role === 'coach') {
                return profile.assigned_group_ids?.includes(ev.group_id || '');
            }
            return true;
        }).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    }, [rawSchedule, profile, groups, selectedDate]);

    const [selectedClass, setSelectedClass] = useState('');
    const selClass = filteredSchedule.find(s => s.id === selectedClass);
    const [att, setAtt] = useState<Record<string, State>>({});

    // Smart Auto-Selection based on current time for TODAY, or first class for OTHER days
    useEffect(() => {
        if (filteredSchedule.length > 0) {
            const now = new Date();
            const isToday = selectedDate.toDateString() === now.toDateString();
            
            let targetId = '';
            if (isToday) {
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                // Find class that is currently active or next upcoming (within a 1-hour window)
                const currentOrNext = filteredSchedule.find(s => {
                    const [startH, startM] = (s.start_time || '00:00').split(':').map(Number);
                    const classStartMins = startH * 60 + startM;
                    return classStartMins >= currentMinutes - 60; // Up to 1 hour ago or future
                }) || filteredSchedule[0];
                targetId = currentOrNext.id;
            } else {
                targetId = filteredSchedule[0].id;
            }

            // ONLY auto-select if:
            // 1. Current selectedClass is empty
            // 2. Current selectedClass is not in the new filteredSchedule list (e.g. date changed)
            // 3. OR the current selectedClass is a "virtual" fallback that was just replaced by real events
            const currentIsValid = filteredSchedule.find(s => s.id === selectedClass);
            const currentIsVirtual = selectedClass.startsWith('virtual-');
            const hasRealEvents = filteredSchedule.some(s => !s.id.startsWith('virtual-'));

            if (!selectedClass || !currentIsValid || (currentIsVirtual && hasRealEvents)) {
                setSelectedClass(targetId);
            }
        }
    }, [selectedDate, filteredSchedule, selectedClass]);

    // ── Persistence ──


    useEffect(() => {
        const loadAtt = () => {
            const key = getScopedKey('cc_attendance_archive');
            let saved = localStorage.getItem(key);

            // 🚚 MIGRATION: If new scoped key is empty, check legacy branch-scoped key formats
            if (!saved) {
                const slug = settings.studioSlug;
                const legacyKeys = [
                    `cc_attendance_archive_${slug}_main`,
                    `cc_attendance_archive_${settings.orgId}_main`,
                    `cc_attendance_archive_${slug}` // Fallback
                ];
                
                for (const lKey of legacyKeys) {
                    const legacyData = localStorage.getItem(lKey);
                    if (legacyData) {
                        console.log('🚚 [Attendance] Migrating legacy archive from:', lKey);
                        localStorage.setItem(key, legacyData);
                        saved = legacyData;
                        break;
                    }
                }
            }

            if (saved) {
                try {
                    const data = JSON.parse(saved);
                    if (data[dateKey] && data[dateKey][selectedClass]) {
                        setAtt(data[dateKey][selectedClass]);
                        return;
                    }
                } catch (e) {
                    console.error('❌ [Attendance] Failed to parse archive:', e);
                }
            }
            setAtt({});
        };

        loadAtt();
        const events = ['cc_attendance_update', 'cc_student_update', 'cc_subscription_update'];
        events.forEach(e => window.addEventListener(e, loadAtt));
        return () => events.forEach(e => window.removeEventListener(e, loadAtt));
    }, [dateKey, selectedClass, settings.studioSlug, settings.orgId]);

    const saveAttendance = useCallback((newAtt: Record<string, State>) => {
        const key = getScopedKey('cc_attendance_archive');
        const saved = localStorage.getItem(key);
        const data = saved ? JSON.parse(saved) : {};
        if (!data[dateKey]) data[dateKey] = {};
        data[dateKey][selectedClass] = newAtt;
        localStorage.setItem(key, JSON.stringify(data));
        setAtt(newAtt);
    }, [dateKey, selectedClass]);

    const [qrInput, setQrInput] = useState('');
    const [flash, setFlash] = useState<string | null>(null);
    const [scanError, setScanError] = useState('');
    const [popup, setPopup] = useState<PopupData | null>(null);
    const [subs, setSubs] = useState<ReturnType<typeof getSubscriptions>>({});

    const refreshSubs = useCallback(() => {
        setSubs(getSubscriptions());
    }, []);

    useEffect(() => {
        refreshSubs();

        // Listen to focus window and custom events to refresh background updates
        window.addEventListener('focus', refreshSubs);
        window.addEventListener('cc_subscription_update', refreshSubs);
        return () => {
            window.removeEventListener('focus', refreshSubs);
            window.removeEventListener('cc_subscription_update', refreshSubs);
        };
    }, [refreshSubs]);
    const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [activeTab, setTab] = useState<'recent' | 'subs' | 'products'>('recent');

    // Modals & Forms
    const [editModal, setEditModal] = useState(false);
    const [freezeModal, setFreezeModal] = useState(false);
    const [manualSmsOpen, setManualSmsOpen] = useState(false);
    const [freezeDays, setFreezeDays] = useState('7');
    const [issueModalOpen, setIssueModalOpen] = useState(false);
    
    // Shop state in drawer
    const [studentSales, setStudentSales] = useState<ShopSale[]>([]);
    const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
    const [sellSearch, setSellSearch] = useState('');
    const [quickSellQty, setQuickSellQty] = useState(1);

    const [studentPatches, setStudentPatches] = useState<Record<string, any>>({});

    const qrRef = useRef<HTMLInputElement>(null);
    const rfidBuffer = useRef('');
    const rfidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (selectedStudent) {
            setStudentSales(getStudentSales(selectedStudent));
            const saved = localStorage.getItem('cc_shop_products');
            setAvailableProducts(saved ? JSON.parse(saved) : []);
            
            import('@/lib/student-store').then(mod => {
                setStudentPatches(mod.getStudentPatches());
            });
        }
    }, [selectedStudent, drawerOpen]);

    const getSubStatus = useCallback((studentId: string) => {
        const todayStr = getLocalISODate();
        const activeSub = getSubscription(studentId, selClass?.group_id, (selClass?.type as any) === 'individual' ? 'individual' : 'group');
        
        let isExpired = !activeSub;
        if (activeSub) {
            const hasExpiredByDate = activeSub.expires_at < todayStr;
            const hasUsedAllSessions = activeSub.type === 'sessions' && activeSub.sessions_total !== null && activeSub.sessions_used >= activeSub.sessions_total;
            isExpired = hasExpiredByDate || hasUsedAllSessions;
        }
        
        return { activeSub, isExpired };
    }, [selClass]);

    const cls = filteredSchedule.find(s => s.id === selectedClass) || filteredSchedule[0] || ({} as CalendarEvent);

    // 1. Get base students list
    const students = useMemo(() => {
        return getStudents()
            .map(s => ({ ...s, ...(studentPatches[s.id] || {}) } as Student))
            .filter(s => {
                if (cls?.type === 'individual' || cls?.type === 'rental') return true;
                if (cls?.group_id && s.enrolled_group_ids?.includes(cls.group_id)) return true;
                return (s as any).classes?.includes(selectedClass);
            });
    }, [studentPatches, cls, selectedClass]);

    // 2. Pre-calculate statuses for ALL visible students once
    const studentStatuses = useMemo(() => {
        const statuses: Record<string, { activeSub: any; isExpired: boolean }> = {};
        students.forEach(s => {
            statuses[s.id] = getSubStatus(s.id);
        });
        return statuses;
    }, [students, getSubStatus]);

    // 3. Filter and Sort using pre-calculated statuses
    const filtered = useMemo(() => {
        return students
            .filter(s => !search || s.full_name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => {
                const expiredA = studentStatuses[a.id]?.isExpired;
                const expiredB = studentStatuses[b.id]?.isExpired;
                if (!expiredA && expiredB) return -1;
                if (expiredA && !expiredB) return 1;
                return (a.full_name || '').localeCompare(b.full_name || '');
            });
    }, [students, search, studentStatuses]);

    const handleQuickSell = (productId: string) => {
        const product = availableProducts.find(p => p.id === productId);
        if (!product || !selectedStudent) return;
        
        if (product.quantity < quickSellQty) {
            alert(t.insufficientStock);
            return;
        }

        const selStudent = students.find(s => s.id === selectedStudent);
        if (!selStudent) return;

        recordSale({
            studentId: selectedStudent,
            studentName: selStudent.full_name,
            productId: product.id,
            productName: product.name,
            quantity: quickSellQty,
            price: product.price * quickSellQty
        });

        // Update inventory in localStorage
        const newProducts = availableProducts.map(p => 
            p.id === productId ? { ...p, quantity: p.quantity - quickSellQty } : p
        );
        localStorage.setItem('cc_shop_products', JSON.stringify(newProducts));
        setAvailableProducts(newProducts);
        setStudentSales(getStudentSales(selectedStudent));
        setQuickSellQty(1);
    };


    // Merge patches into selected student data
    const selStudentRaw = selectedStudent ? students.find(s => s.id === selectedStudent) : null;
    const selStudent = selStudentRaw ? {
        ...selStudentRaw,
        ...(studentPatches[selStudentRaw.id] || {})
    } as Student : null;

    useEffect(() => { qrRef.current?.focus(); }, []);
    const closePopup = useCallback(() => { setPopup(null); setTimeout(() => qrRef.current?.focus(), 50); }, []);
    const openProfile = (id: string) => {
        setSelectedStudent(id);
        setDrawerOpen(true);
    };

    useEffect(() => {
        setSearch('');
    }, [selectedClass, selectedDate]);

    const confirmDouble = useCallback(() => {
        if (!popup) return;
        const result = forceCheckin(popup.studentId, popup.studentName, 'manual', selectedClass, selClass?.group_id);
        const sub = getSubscription(popup.studentId);
        const isMonthly = sub?.type === 'monthly';
        saveAttendance({ ...att, [popup.studentId]: 'present' });
        setPopup({ ...popup, sessionsRemaining: result.sessionsRemaining, checkinCount: popup.checkinCount + 1, phase: 'double-success', isMonthly });
    }, [popup, att, saveAttendance, selectedClass, selClass]);

    const processCode = useCallback((code: string, choiceSubId?: string) => {
        if (popup?.phase === 'confirm' && !choiceSubId) return;
        const clean = code.toUpperCase().replace(/[:\-\s]/g, '').trim();
        if (!clean) return;

        let studentId = lookupByUid(clean)?.studentId ?? null;
        let studentName = lookupByUid(clean)?.studentName ?? null;

        if (!studentId) {
            studentId = SCAN_MAP[clean] ?? null;
            if (studentId) studentName = getStudents().find(x => x.id === studentId)?.full_name ?? null;
        }

        if (studentId && studentName) {
            const todayStr = getLocalISODate();
            const studentSubs = (getSubscriptions()[studentId] || []).filter(s => {
                const expired = s.status !== 'active' || s.expires_at < todayStr;
                if (expired) return false;
                if (s.plan_type === 'individual' && cls.type !== 'individual') return false;
                if (s.group_id && s.group_id !== cls.group_id) return false;
                return true;
            });

            // If multiple valid subs and NO specific sub chosen yet
            if (studentSubs.length > 1 && !choiceSubId) {
                const checkinCount = getCheckinCountToday(studentId);
                const sub = getSubscription(studentId, cls.group_id);
                setPopup({
                    studentId,
                    studentName,
                    sessionsRemaining: getSessionsRemaining(studentId, cls.group_id),
                    checkinCount,
                    phase: 'success',
                    isMonthly: sub?.type === 'monthly',
                    // @ts-ignore
                    subscriptions: studentSubs
                });
                return;
            }

            const checkinCount = getCheckinCountToday(studentId);
            const result = recordCheckin(studentId, studentName, 'manual', selectedClass, selClass?.group_id, choiceSubId, dateKey);
            const newAtt = { ...att, [studentId!]: 'present' as State };
            saveAttendance(newAtt);
            setScanError('');
            setFlash(studentId);
            setSelectedStudent(studentId);
            setTimeout(() => setFlash(null), 2500);
            setQrInput('');

            const sub = choiceSubId ? getSubscriptions()[studentId].find(s => s.id === choiceSubId) : getSubscription(studentId, cls.group_id);
            const isMonthly = sub?.type === 'monthly';

            if (result.alreadyCheckedIn && !choiceSubId) {
                setPopup({ studentId, studentName, sessionsRemaining: result.sessionsRemaining, checkinCount, phase: 'confirm', isMonthly });
            } else {
                setPopup({ studentId, studentName, sessionsRemaining: result.sessionsRemaining, checkinCount: checkinCount + 1, phase: 'success', isMonthly });
            }
        } else {
            setScanError(`${t.noData}`);
            setTimeout(() => setScanError(''), 3000);
            setQrInput('');
        }
    }, [popup, att, t, saveAttendance, cls, selectedClass, selClass, dateKey]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const active = document.activeElement as HTMLElement | null;
            if (active && active !== qrRef.current && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
            if (popup?.phase === 'confirm') return;
            if (e.key === 'Enter') {
                const val = (qrRef.current?.value ?? '').trim() || rfidBuffer.current.trim();
                rfidBuffer.current = '';
                if (rfidTimer.current) { clearTimeout(rfidTimer.current); rfidTimer.current = null; }
                if (val) processCode(val);
                setQrInput('');
                return;
            }
            if (e.key === 'Escape') { closePopup(); return; }
            if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                rfidBuffer.current += e.key;
                if (document.activeElement !== qrRef.current) qrRef.current?.focus();
                if (rfidTimer.current) clearTimeout(rfidTimer.current);
                rfidTimer.current = setTimeout(() => { rfidBuffer.current = ''; }, 120);
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [processCode, closePopup, popup]);

    function toggle(id: string, choiceSubId?: string) {
        const student = students.find(s => s.id === id);
        if (!student) return;

        const { activeSub, isExpired } = getSubStatus(id);

        if (isExpired && (att[id] ?? 'none') === 'none' && !choiceSubId) {
            alert(t.subscriptionExpired);
            return;
        }

        const cur = att[id] ?? 'none';
        let next: State = 'none';

        if (cur === 'none') {
            const todayStr = getLocalISODate();
            const studentSubs = (subs[id] || []).filter(s => {
                const expired = s.status !== 'active' || s.expires_at < todayStr;
                if (expired) return false;
                if (s.plan_type === 'individual' && cls.type !== 'individual') return false;
                if (s.group_id && s.group_id !== cls.group_id) return false;
                return true;
            });

            if (studentSubs.length > 1 && !choiceSubId) {
                const checkinCount = getCheckinCountToday(id);
                setPopup({
                    studentId: id,
                    studentName: student.full_name,
                    sessionsRemaining: getSessionsRemaining(id, cls.group_id),
                    checkinCount,
                    phase: 'success',
                    isMonthly: activeSub?.type === 'monthly',
                    // @ts-ignore
                    subscriptions: studentSubs
                });
                return;
            }

            // Mark present: deduct session
            recordCheckin(id, student.full_name, 'manual', selectedClass, selClass?.group_id, choiceSubId, dateKey);
            next = 'present';

            const usedSub = choiceSubId ? (subs[id] || []).find(s => s.id === choiceSubId) : activeSub;

            // --- Immediate SMS Trigger for "0 Visits Left" ---
            if (usedSub && usedSub.type === 'sessions' && usedSub.sessions_total) {
                const remainingBefore = usedSub.sessions_total - (usedSub.sessions_used || 0);
                if (remainingBefore === 1) {
                    const smsKey = `sms_sent_${usedSub.id}_day_0`;
                    // Only send if we haven't already sent it
                    if (!localStorage.getItem(smsKey)) {
                        const currentHour = new Date().getHours();
                        const isQuietHours = currentHour >= 23 || currentHour < 10;
                        const autoSms = JSON.parse(localStorage.getItem('cc_studio_settings') || '{}')?.notifications?.autoSms !== false;

                        if (autoSms && !isQuietHours) {
                            // Mark pending immediately so UI picks it up
                            localStorage.setItem(smsKey, 'pending');

                            let phone = (student.phone || '').replace(/[^0-9]/g, '');
                            if (phone.length === 9) phone = '995' + phone;
                            if (!phone) return;

                            const prefLang = student.preferred_language || 'ka';
                            // Use proper loadSettings to get deep merged defaults
                            const settings = loadSettings();
                            const templates = settings.sms_templates || {};

                            // Safe extraction to prevent flat structure fallback bugs
                            let tpl = t.smsTemplateExpiration;
                            const langTemplates = (templates as any)[prefLang];
                            if (langTemplates && typeof langTemplates === 'object') {
                                tpl = langTemplates.expiration_day_0 || tpl;
                            } else if (templates.ka && typeof templates.ka === 'object') {
                                tpl = templates.ka.expiration_day_0 || tpl;
                            }

                            const studioName = settings.studioName || 'Studio';
                            let msg = tpl.replace(/{name}/g, student.full_name);
                            msg = msg.replace(/{plan}/g, (usedSub as any).plan_name || '');
                            msg = msg.replace(/{studio}/g, studioName);

                            fetch('/api/sms/send', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ to: phone, text: msg, studentName: student.full_name })
                            }).then(res => res.json()).then(data => {
                                if (data.success || (Array.isArray(data) && data[0]?.success)) {
                                    localStorage.setItem(smsKey, 'true');
                                } else {
                                    localStorage.setItem(smsKey, 'failed');
                                }
                            }).catch(() => localStorage.setItem(smsKey, 'failed'));
                        }
                    }
                }
            }
        } else if (cur === 'present') {
            // Mark absent: refund session (since it was present)
            refundCheckin(id);
            next = 'absent';
        } else {
            next = 'none';
        }

        saveAttendance({ ...att, [id]: next });
        setPopup(null);

        // Immediate refresh of subscriptions to show the updated count
        setTimeout(() => {
            setSubs(getSubscriptions());
        }, 10);
    }

    const days = [t.sunday, t.monday, t.tuesday, t.wednesday, t.thursday, t.friday, t.saturday];
    const months = [t.jan, t.feb, t.mar, t.apr, t.may, t.jun, t.jul, t.aug, t.sep, t.oct, t.nov, t.dec];

    const day = days[selectedDate.getDay()];
    const month = months[selectedDate.getMonth()];
    const dateStr = `${day}, ${selectedDate.getDate()} ${month}`;

    function isCurrentClass(start?: string) {
        if (!start) return false;
        const h = parseInt(start.split(':')[0]);
        const ch = new Date().getHours();
        return h <= ch && h + 2 > ch;
    }

    return (
        <div className="flex flex-col flex-1 min-h-[100dvh] bg-card animate-fade-up overflow-x-hidden relative max-w-full">
            {!mounted ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-2xl border-4 border-#6d28d9/20 border-t-#6d28d9 animate-spin" />
                </div>
            ) : (
                <>
                    {popup && <ScanPopup
                        data={popup}
                        onClose={closePopup}
                        onConfirm={confirmDouble}
                        t={t}
                        // @ts-ignore
                        subscriptions={popup.subscriptions}
                        onSelectSub={(subId) => {
                            if (popup.studentId) toggle(popup.studentId, subId);
                        }}
                    />}

                    {/* Global Hidden RFID Input */}
                    <input
                        ref={qrRef}
                        value={qrInput}
                        onChange={e => setQrInput(e.target.value)}
                        className="absolute opacity-0 -z-50 w-[1px] h-[1px]"
                        aria-hidden="true"
                        tabIndex={-1}
                    />


                    {/* Desktop Status Floater (Top Right) */}
                    <div className="hidden lg:flex absolute top-6 right-8 z-50 items-center justify-end pointer-events-none">
                        {scanError && <span className="text-xs font-bold text-white bg-red-500 px-4 py-2.5 rounded-2xl animate-bounce">{scanError}</span>}
                        {flash && <span className="text-xs font-bold text-white bg-emerald-500 px-4 py-2.5 rounded-2xl">{t.success}</span>}
                    </div>

                    {/* Mobile Header / LARGE Date Picker */}
                    <div className={cn(
                        'flex lg:hidden flex-col gap-3 pt-5 pb-4 px-3 border-b transition-colors duration-300 relative w-full',
                        scanError ? 'bg-red-500/5' : flash ? 'bg-emerald-500/5' : 'bg-card'
                    )}>
                        {/* Status Line */}
                        <div className="flex items-center justify-center h-4 relative">
                            {scanError && <span className="text-[10px] font-black text-red-500 bg-red-500/10 px-2.5 py-1 rounded-full animate-bounce">{scanError}</span>}
                            {flash && <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full">{t.success}</span>}
                            {!scanError && !flash && <span className="text-[10px] font-black tracking-[0.2em] text-muted opacity-40 uppercase">{t.attendance}</span>}
                        </div>

                        {/* Stretched TALL Date Picker (Mobile) */}
                        <div className="flex items-center justify-between bg-surface p-1 rounded-2xl h-14 shadow-sm relative overflow-hidden group">
                            <button
                                onClick={() => setSelectedDate(new Date(new Date(selectedDate).setDate(selectedDate.getDate() - 1)))}
                                className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-card text-muted hover:text-#5b21b6 transition-all active:scale-90 flex-shrink-0 relative z-10"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            
                            <div className="relative flex-1 flex items-center justify-center min-w-0 h-full">
                                <StandardDatePicker
                                    hideIcon={true}
                                    value={dateKey}
                                    onChange={(val) => {
                                        const d = new Date(val);
                                        if (!isNaN(d.getTime())) setSelectedDate(d);
                                    }}
                                    className="[&_label]:hidden [&>div]:!bg-transparent [&>div]:!border-none [&>div]:!shadow-none [&_input]:!h-full [&_input]:!py-0 [&_input]:!pl-0 [&_input]:!text-[14px] [&_input]:!font-black [&_input]:uppercase [&_input]:text-center [&_input]:!bg-transparent w-full h-[40px] flex items-center justify-center"
                                />
                            </div>

                            <button
                                onClick={() => setSelectedDate(new Date(new Date(selectedDate).setDate(selectedDate.getDate() + 1)))}
                                className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-card text-muted hover:text-#5b21b6 transition-all active:scale-90 flex-shrink-0 relative z-10"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        {/* Left Panel: Schedule (Desktop) */}
                        <div className="hidden lg:flex w-64 border-r border-border-subtle bg-surface/30 flex-col">
                            <div className="p-4 border-b border-border-subtle/50 flex flex-col gap-3">
                                {/* Desktop Date Picker */}
                                {mounted && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between bg-surface p-1 rounded-xl mb-1 relative overflow-hidden group">
                                            <button
                                                onClick={() => setSelectedDate(new Date(new Date(selectedDate).setDate(selectedDate.getDate() - 1)))}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-card text-muted hover:text-#5b21b6 transition-colors active:scale-95 flex-shrink-0 relative z-10"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            
                                            <div className="flex-1 flex items-center cursor-pointer active:scale-95 transition-transform">
                                                <StandardDatePicker
                                                    value={dateKey}
                                                    onChange={(val) => {
                                                        const d = new Date(val);
                                                        if (!isNaN(d.getTime())) setSelectedDate(d);
                                                    }}
                                                    className="flex-1 flex items-center [&_label]:hidden [&>div]:!bg-transparent [&>div]:!border-none [&>div]:!shadow-none [&_input]:!py-1 [&_input]:!h-auto [&_input]:!pl-10 [&_input]:!text-[10px] [&_input]:!font-black [&_input]:!tracking-[0.05em] [&_input]:text-center [&_input]:!bg-transparent"
                                                />
                                            </div>

                                            <button
                                                onClick={() => setSelectedDate(new Date(new Date(selectedDate).setDate(selectedDate.getDate() + 1)))}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-card text-muted hover:text-#5b21b6 transition-colors active:scale-95 flex-shrink-0 relative z-10"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <p className="text-[10px] font-black tracking-[0.2em] text-muted opacity-40 px-1 mt-1">{t.schedule}</p>
                            </div>
                            <div className="flex-1 p-3 space-y-1.5 flex-shrink-0 overflow-y-auto no-scrollbar">
                                {mounted && filteredSchedule.map(s => {
                                    const isCurrent = isCurrentClass(s.start_time);
                                    const isActive = selectedClass === s.id;
                                    const timeStr = `${s.start_time}–${s.end_time}`;
                                    return (
                                        <button key={s.id} onClick={() => setSelectedClass(s.id)}
                                            className={cn(
                                                'w-full text-left p-4 rounded-2xl transition-all group border relative overflow-hidden',
                                                isActive
                                                    ? 'bg-[#6d28d9] border-[#6d28d9] scale-[1.02] z-10 text-white shadow-xl shadow-indigo-500/10'
                                                    : 'bg-card border-border-subtle hover:bg-surface hover:border-border-subtle/50'
                                            )}>
                                            <h3 className={cn(
                                                'text-sm font-black truncate leading-tight transition-colors',
                                                isActive ? 'text-white' : 'text-primary'
                                            )}>
                                                {s.title || (s.group_id ? GROUP_MAP[s.group_id] : (s.type === 'individual' ? t.indSession : t.untitledClass))}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-2">
                                                <Clock className={cn(
                                                    'w-3 h-3 transition-colors',
                                                    isActive ? 'text-white/60' : isCurrent ? 'text-emerald-500' : 'text-muted opacity-40'
                                                )} />
                                                <span className={cn(
                                                    'text-[10px] font-black tabular-nums transition-colors',
                                                    isActive ? 'text-white/80' : isCurrent ? 'text-emerald-600' : 'text-muted'
                                                )}>{timeStr}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-3">
                                                <span className={cn(
                                                    'text-[9px] font-bold tracking-tight truncate max-w-[100px] transition-colors',
                                                    isActive ? 'text-white/60' : 'text-muted opacity-50'
                                                )}>{getTeacherName(s.teacher_id)}</span>
                                                {isCurrent && (
                                                    <span className={cn(
                                                        'w-2 h-2 rounded-full animate-pulse',
                                                        isActive ? 'bg-white' : 'bg-emerald-500'
                                                    )} />
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Middle Panel: Student List */}
                        <div className="flex-1 flex flex-col bg-card border-r border-border-subtle overflow-hidden">
                            <div className="p-3 md:p-6 border-b border-border-subtle/50 flex flex-col gap-3 md:gap-4 flex-shrink-0">
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0 pr-2">
                                        <h2 className="text-lg md:text-xl font-black text-primary tracking-tight truncate">
                                            {cls.title || (cls.group_id ? GROUP_MAP[cls.group_id] : (cls.type === 'individual' ? t.indSession : t.untitledClass))}
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                                            <p className="text-[10px] md:text-xs font-bold text-muted opacity-60">{cls.start_time}–{cls.end_time} · {getTeacherName(cls.teacher_id)}</p>
                                            {cls.notes && (
                                                <div className="flex items-center gap-1 px-2 py-0.5 bg-#f5f3ff border border-#ede9fe rounded-full">
                                                    <Info className="w-3 h-3 text-#a78bfa" />
                                                    <p className="text-[9px] font-bold text-#5b21b6 truncate max-w-[200px]">{cls.notes}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 md:gap-2 flex-shrink-0">
                                        {mounted && ((() => {
                                            const hasAnyAtt = Object.values(att).some(v => v !== 'none');
                                            return (
                                                <>
                                                    <button onClick={() => {
                                                        const n: Record<string, State> = { ...att };
                                                        students.forEach(s => {
                                                            const { isExpired } = getSubStatus(s.id);
                                                            if (n[s.id] !== 'present' && !isExpired) {
                                                                recordCheckin(s.id, s.full_name, 'manual', selectedClass, cls?.group_id, undefined, dateKey);
                                                                n[s.id] = 'present';
                                                            }
                                                        });
                                                        saveAttendance(n);
                                                        setTimeout(() => setSubs(getSubscriptions()), 20);
                                                    }} className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[9px] font-black tracking-wider hover:bg-emerald-500/20 transition-colors">{t.markAllPresent}</button>

                                                    {hasAnyAtt && (
                                                        <button onClick={async () => {
                                                            if (!await confirm(t.confirmDeleteAttendance)) return;
                                                            const n: Record<string, State> = { ...att };
                                                            import('@/lib/checkin-store').then(mod => {
                                                                students.forEach(s => {
                                                                    if (n[s.id] === 'present') {
                                                                        mod.refundCheckin(s.id);
                                                                    }
                                                                    n[s.id] = 'none';
                                                                });
                                                                saveAttendance(n);
                                                                setTimeout(() => setSubs(getSubscriptions()), 20);
                                                            });
                                                        }} className="px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-[9px] font-black tracking-wider hover:bg-red-500/20 transition-colors ml-1">{t.deleteAttendance}</button>
                                                    )}
                                                </>
                                            );
                                        })())}
                                    </div>
                                </div>
                                <div className="lg:hidden w-full flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-2 pb-1.5 flex-shrink-0 -mx-3 px-3 scroll-smooth touch-pan-x relative z-30">
                                    {mounted && filteredSchedule.map(s => (
                                        <button key={s.id} onClick={() => setSelectedClass(s.id)}
                                            className={cn(
                                                'px-5 py-2.5 rounded-2xl text-[12px] font-black whitespace-nowrap transition-all border-[3px] flex-shrink-0 snap-start active:scale-95 duration-200',
                                                selectedClass === s.id ? 'bg-[#6d28d9] text-white border-[#6d28d9] shadow-lg shadow-indigo-500/30' : 'bg-surface text-muted border-border-subtle hover:border-muted/30'
                                            )}>
                                            {s.title || (s.group_id ? GROUP_MAP[s.group_id] : (s.type === 'individual' ? t.indSession : t.untitledClass))}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Main Student List Section */}
                            <div className="flex-1 p-2 md:p-4 pb-24 md:pb-4 space-y-2.5 md:space-y-4 overflow-y-auto no-scrollbar overflow-x-hidden">
                                {!mounted ? (
                                    <div className="space-y-4 px-2">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="w-full h-20 md:h-24 bg-surface animate-pulse rounded-[1.5rem] md:rounded-[2rem]" />
                                        ))}
                                    </div>
                                ) : filtered.length > 0 ? filtered.map(st => {
                                    const state = att[st.id] ?? 'none';
                                    const isSel = selectedStudent === st.id;
                                    const getStudentDisplay = () => {
                                        const todayStr = getLocalISODate();
                                        const active = getSubscription(st.id, cls?.group_id, (cls?.type as any) === 'individual' ? 'individual' : 'group');
                                        
                                        if (active) {
                                            const hasExpiredByDate = active.expires_at < todayStr;
                                            const hasUsedAllSessions = active.type === 'sessions' && active.sessions_total !== null && active.sessions_used >= active.sessions_total;
                                            
                                            if (hasExpiredByDate || hasUsedAllSessions) {
                                                const expiryDate = new Date(active.expires_at);
                                                const now = new Date();
                                                const diff = (now.getTime() - expiryDate.getTime()) / (1000 * 86400);
                                                if (diff > 7) return { color: 'red', label: null, isExpired: true };
                                                return { color: 'yellow', label: 'ამოიწურა', isExpired: true };
                                            }
                                            return { color: 'emerald', label: t.active, isExpired: false, activeSub: active };
                                        }

                                        // No active sub at all for this group/type - check if they EVER had one
                                        const all = subs[st.id] || [];
                                        if (all.length === 0) return { color: 'red', label: null, isExpired: true };
                                        
                                        const last = [...all].sort((a,b) => b.expires_at.localeCompare(a.expires_at))[0];
                                        const expiryDate = new Date(last.expires_at);
                                        const now = new Date();
                                        const diff = (now.getTime() - expiryDate.getTime()) / (1000 * 86400);
                                        if (diff > 7) return { color: 'red', label: null, isExpired: true };
                                        return { color: 'yellow', label: 'ამოიწურა', isExpired: true };
                                    };

                                    const { color, label, isExpired, activeSub } = getStudentDisplay();

                                    return (
                                        <div key={st.id}
                                            onClick={() => openProfile(st.id)}
                                            className={cn(
                                                'w-full flex items-center justify-between gap-3 p-4 md:p-6 rounded-2xl md:rounded-[2rem] transition-all group border relative overflow-hidden cursor-pointer shadow-sm',
                                                isFl ? 'bg-emerald-500/5 border-emerald-500/20' :
                                                    isSel ? 'bg-#f5f3ff/50 border-#ddd6fe' :
                                                        'bg-card border-border-subtle hover:bg-surface/50 hover:border-border-subtle/50',
                                                isExpired && 'opacity-90'
                                            )}>

                                            {/* Avatar + Info Area (Fills space) */}
                                            <div className="flex items-center gap-3.5 md:gap-5 relative z-10 flex-1 min-w-0">
                                                {/* Photo */}
                                                <div
                                                    className={cn(
                                                        "w-11 h-11 md:w-14 md:h-14 rounded-full border-[3px] transition-all flex-none flex items-center justify-center overflow-hidden relative",
                                                        color === 'emerald' ? "border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]" :
                                                            color === 'yellow' ? "border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]" :
                                                                "border-red-500 hover:border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                                                    )}
                                                >
                                                    <span className={cn(
                                                        `w-full h-full rounded-full flex items-center justify-center transition-transform duration-300`,
                                                        !mounted ? "bg-surface" : (color === 'emerald' ? "bg-emerald-500" : (color === 'yellow' ? "bg-amber-500" : "bg-red-500"))
                                                    )}>
                                                        {st.photo_url ? (
                                                            <img src={st.photo_url} alt={st.full_name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-[11px] md:text-sm font-black text-white">{getInitials(st.full_name)}</span>
                                                        )}
                                                    </span>
                                                </div>

                                                {/* Text Info */}
                                                <div className="flex-1 min-w-0 py-0.5">
                                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                                        <p className={cn(
                                                            'text-[13px] md:text-[15px] font-black truncate tracking-tight', 
                                                            state === 'present' ? 'text-emerald-600' : state === 'absent' ? 'text-red-500' : 'text-primary'
                                                        )}>
                                                            {st.full_name}
                                                        </p>
                                                        {label && (
                                                            <span className={cn(
                                                                "shrink-0 text-[8px] font-black tracking-widest px-2 py-0.5 rounded-md border uppercase",
                                                                color === 'emerald' ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" : "text-amber-600 border-amber-500/20 bg-amber-500/5"
                                                            )}>
                                                                {label}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Progress/Status Bar */}
                                                    <div className="flex items-center gap-3 w-full">
                                                        {(() => {
                                                            const subId = activeSub ? activeSub.id : st.id;
                                                            const day0 = localStorage.getItem(`sms_sent_${subId}_day_0`);
                                                            const isSent = day0 === 'true';

                                                            if (isExpired || !activeSub) {
                                                                return (
                                                                    <>
                                                                        <div className="flex-1 h-1 bg-surface rounded-full overflow-hidden border border-border-subtle/30"></div>
                                                                        <span className="shrink-0 text-[7px] font-black tracking-widest text-muted opacity-30 uppercase">NO SUB</span>
                                                                    </>
                                                                );
                                                            }

                                                            const remaining = (activeSub.sessions_total ?? 0) - (activeSub.sessions_used ?? 0);
                                                            return (
                                                                <>
                                                                    <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden border border-border-subtle/20 relative shadow-inner">
                                                                        <div
                                                                            className={cn(
                                                                                "h-full transition-all duration-700",
                                                                                remaining <= 3 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" :
                                                                                    remaining <= 5 ? "bg-amber-500" : "bg-[#6d28d9] shadow-[0_0_8px_rgba(109,40,217,0.3)]"
                                                                            )}
                                                                            style={{ width: `${Math.max(3, Math.min(100, (remaining / (activeSub.sessions_total || 1)) * 100))}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className={cn(
                                                                        "shrink-0 text-[10px] font-black tabular-nums tracking-tighter flex items-center gap-1",
                                                                        remaining <= 3 ? "text-red-500" : "text-muted"
                                                                    )}>
                                                                        {remaining} {t.visit}
                                                                        {isSent && <MessageSquare className="w-2.5 h-2.5 text-emerald-500 opacity-60" />}
                                                                    </span>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Attendance Toggle (Fixed Right) */}
                                            <div className="flex-none pl-1 relative z-20">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (isExpired && state === 'none') {
                                                            setSelectedStudent(st.id);
                                                            setIssueModalOpen(true);
                                                        } else {
                                                            toggle(st.id);
                                                        }
                                                    }}
                                                    className={cn(
                                                        "w-11 h-11 md:w-14 md:h-14 rounded-2xl border-2 flex items-center justify-center transition-all active:scale-90",
                                                        state === 'present' ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20" :
                                                            state === 'absent' ? "bg-red-500 border-red-500 text-white shadow-lg shadow-red-500/20" :
                                                                isExpired ? "bg-transparent border-red-500 text-red-500 hover:bg-red-500/5" :
                                                                    "bg-surface border-border-subtle text-muted/30"
                                                    )}
                                                >
                                                    {state === 'present' ? (
                                                        <Check className="w-6 h-6 stroke-[3]" />
                                                    ) : state === 'absent' ? (
                                                        <X className="w-6 h-6 stroke-[3]" />
                                                    ) : (
                                                        <Plus className="w-6 h-6 stroke-[3]" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="p-16 text-center">
                                        <div className="w-16 h-16 rounded-3xl bg-surface border-2 border-border-subtle flex items-center justify-center mx-auto mb-6 opacity-30">
                                            <Search className="w-8 h-8" />
                                        </div>
                                        <h3 className="text-sm font-black text-muted opacity-40 tracking-widest uppercase">{t.noData}</h3>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Panel: Student Details / Drawer */}
                        {drawerOpen && (
                            <div className="lg:hidden fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
                                onClick={() => setDrawerOpen(false)} />
                        )}
                        <div className={cn(
                            "bg-surface/30 flex-col overflow-hidden transition-all duration-300 ease-in-out lg:w-[35%] lg:min-w-[340px]",
                            drawerOpen
                                ? "fixed inset-x-4 top-20 bottom-10 z-[100] bg-card rounded-[2.5rem] flex border border-border-subtle animate-in slide-in-from-bottom-8 lg:static lg:inset-auto lg:z-0 lg:rounded-none lg:shadow-none lg:animate-none lg:border-l shadow-2xl"
                                : "hidden lg:flex lg:border-l lg:border-border-subtle"
                        )}>
                            {selStudent ? (
                                <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
                                    {!mounted ? (
                                        <div className="p-8 space-y-4">
                                            <div className="w-24 h-24 rounded-[2rem] bg-surface animate-pulse mx-auto" />
                                            <div className="h-4 w-32 bg-surface animate-pulse mx-auto" />
                                        </div>
                                    ) : (() => {
                                        const { activeSub, isExpired } = getSubStatus(selStudent.id);
                                        const visitsLeft = activeSub?.sessions_total ? activeSub.sessions_total - activeSub.sessions_used : '∞';

                                        let daysLeft = '—';
                                        if (activeSub?.expires_at) {
                                            const diff = new Date(activeSub.expires_at).getTime() - new Date().getTime();
                                            daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))).toString();
                                        }

                                        return (
                                            <>
                                                {/* Header in Side Panel */}
                                                <div className="p-6 flex flex-col border-b border-border-subtle/50 bg-card/40 relative">
                                                    <div className="absolute top-4 right-4 lg:hidden z-10">
                                                        <button
                                                            onClick={() => setDrawerOpen(false)}
                                                            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface border border-border-subtle text-muted hover:text-primary transition-all active:scale-95 shadow-md"
                                                        >
                                                            <X className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                    
                                                    <div className="hidden lg:flex absolute top-6 right-6 gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setDrawerOpen(false);
                                                                setEditModal(true);
                                                            }}
                                                            className="p-3 rounded-xl bg-surface border border-border-subtle text-muted hover:text-#6d28d9 hover:border-#6d28d9/30 transition-all active:scale-90"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    <div className="flex items-center gap-5">
                                                        <div className={cn(
                                                            "w-16 h-16 md:w-24 md:h-24 rounded-[1.75rem] flex items-center justify-center text-white text-2xl md:text-3xl font-black shadow-xl ring-4 ring-white shrink-0 overflow-hidden",
                                                            isExpired ? "bg-red-500" : "bg-emerald-500"
                                                        )}>
                                                            {selStudent.photo_url ? (
                                                                <img src={selStudent.photo_url} alt={selStudent.full_name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                getInitials(selStudent.full_name)
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="text-xl md:text-2xl font-black text-primary tracking-tight truncate mb-1">{selStudent.full_name}</h3>
                                                            <div className="flex items-center gap-2">
                                                                <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", isExpired ? "bg-red-500" : "bg-emerald-500")} />
                                                                <span className={cn("text-[9px] md:text-[10px] font-black tracking-widest uppercase", isExpired ? "text-red-500" : "text-emerald-600")}>
                                                                    {isExpired ? t.subscriptionExpired : t.active}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Quick Actions */}
                                                    <div className="grid grid-cols-2 gap-3 mt-6">
                                                        <a href={`tel:${selStudent.phone}`}
                                                            className="flex items-center justify-center gap-2 h-11 rounded-xl bg-#6d28d9 text-white font-black text-[10px] tracking-widest uppercase shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                                                            <Phone className="w-3.5 h-3.5" />
                                                            <span>{t.callShort || 'CALL'}</span>
                                                        </a>
                                                        <button onClick={() => setManualSmsOpen(true)}
                                                            className="flex items-center justify-center gap-2 h-11 rounded-xl bg-surface border border-border-subtle text-muted font-black text-[10px] tracking-widest uppercase hover:bg-card active:scale-95 transition-all">
                                                            <MessageSquare className="w-3.5 h-3.5" />
                                                            <span>SMS</span>
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                                        <div className="p-3 rounded-xl bg-surface/50 border border-border-subtle/50">
                                                            <p className="text-[8px] font-black text-muted tracking-widest opacity-40 uppercase mb-1">{t.remaining}</p>
                                                            <p className="text-lg font-black text-primary tabular-nums tracking-tighter">{visitsLeft} <span className="text-[10px] opacity-40 font-bold ml-1">{t.visitShort || 'V'}</span></p>
                                                        </div>
                                                        <div className="p-3 rounded-xl bg-surface/50 border border-border-subtle/50">
                                                            <p className="text-[8px] font-black text-muted tracking-widest opacity-40 uppercase mb-1">{t.expiryDate}</p>
                                                            <p className="text-lg font-black text-primary tabular-nums tracking-tighter">{daysLeft} <span className="text-[10px] opacity-40 font-bold ml-1">{t.days}</span></p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex px-4 pt-2 gap-1 border-b border-border-subtle/50 bg-card/20 flex-shrink-0">
                                                    {[
                                                        { id: 'recent', label: t.visits, icon: CalendarCheck },
                                                        { id: 'subs', label: t.subscriptions, icon: Package },
                                                        { id: 'products', label: t.purchases, icon: ShoppingCart }
                                                    ].map(tab => (
                                                        <button key={tab.id} onClick={() => setTab(tab.id as any)}
                                                            className={cn(
                                                                "flex-1 py-4 flex items-center justify-center gap-2 text-[10px] font-black tracking-widest transition-all relative overflow-hidden",
                                                                activeTab === tab.id ? "text-#5b21b6" : "text-muted opacity-50 hover:opacity-100"
                                                            )}>
                                                            <tab.icon className="w-3.5 h-3.5" />
                                                            <span>{tab.label}</span>
                                                            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-#6d28d9" />}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                                                    {activeTab === 'recent' && (
                                                        <div className="space-y-3 pb-24">
                                                            {getStudentCheckins(selStudent.id).length > 0 ? getStudentCheckins(selStudent.id).map((ch, i) => (
                                                                <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-surface/40 border border-border-subtle/30 group hover:border-#6d28d9/30 transition-all">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-xl bg-#6d28d9/10 flex items-center justify-center text-#6d28d9 shrink-0">
                                                                            <CalendarCheck className="w-5 h-5" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs font-black text-primary capitalize leading-tight">{ch.date}</p>
                                                                            <p className="text-[10px] font-bold text-muted opacity-60 mt-0.5">{ch.time} · {cls.title}</p>
                                                                        </div>
                                                                    </div>
                                                                    <button onClick={async (e) => { e.stopPropagation(); if (await confirm(t.confirmDelete)) { deleteCheckin(selStudent.id, ch.date, ch.time); setSubs(getSubscriptions()); } }}
                                                                        className="p-2 rounded-xl bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all">
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            )) : <div className="text-center py-12 opacity-30 font-black text-[10px] tracking-widest">{t.noData}</div>}
                                                        </div>
                                                    )}
                                                    {/* Other tabs follow the same clean pattern but are slightly more condensed to prevent overflow */}
                                                    {activeTab === 'subs' && (
                                                        <div className="space-y-4 pb-24">
                                                            {(subs[selStudent.id] || []).map((sub, idx) => {
                                                                const isExpired = sub.expires_at && new Date(sub.expires_at) < new Date();
                                                                const isActive = sub.status === 'active' && !isExpired;
                                                                return (
                                                                    <div key={idx} className={cn("p-4 rounded-2xl border transition-all", isActive ? "bg-#6d28d9/5 border-#6d28d9/20 shadow-sm" : "bg-surface/30 border-border-subtle opacity-60")}>
                                                                        <div className="flex justify-between items-start mb-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={cn("text-[9px] font-black tracking-widest", isActive ? "text-emerald-500" : "text-muted")}>{sub.status.toUpperCase()}</span>
                                                                                <span className="text-[9px] font-bold text-muted opacity-40">{sub.purchased_at}</span>
                                                                            </div>
                                                                        </div>
                                                                        <p className="text-sm font-black text-primary leading-snug mb-3">{sub.plan}</p>
                                                                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border-subtle/20">
                                                                            <div>
                                                                                <p className="text-[8px] font-black text-muted tracking-widest opacity-40 uppercase mb-0.5">{t.expiryDate}</p>
                                                                                <p className="text-xs font-black text-primary tabular-nums">{sub.expires_at || '—'}</p>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[8px] font-black text-muted tracking-widest opacity-40 uppercase mb-0.5">{t.balance}</p>
                                                                                <p className="text-xs font-black text-primary tabular-nums">{sub.sessions_total !== null ? `${sub.sessions_total - sub.sessions_used} / ${sub.sessions_total}` : '∞'}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="p-4 bg-card border-t border-border-subtle/50 flex items-center justify-between gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] mt-auto flex-shrink-0">
                                                    <button onClick={() => setIssueModalOpen(true)}
                                                        className="flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl bg-[#6d28d9] text-white font-black text-[11px] tracking-widest uppercase shadow-lg shadow-violet-500/20 active:scale-95 transition-all">
                                                        <PlusCircle className="w-4 h-4" />
                                                        <span>{t.issuePlan}</span>
                                                    </button>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
                                    <div className="w-24 h-24 rounded-[2.5rem] bg-surface flex items-center justify-center mb-8 shadow-inner border border-border-subtle">
                                        <Scan className="w-10 h-10 text-#6d28d9 opacity-50" />
                                    </div>
                                    <p className="text-lg font-black text-primary tracking-tight">{t.scanCard}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Modals */}
                    {selStudent && (
                        <>
                            <ManualSmsModal open={manualSmsOpen} onClose={() => setManualSmsOpen(false)} studentName={selStudent.full_name} studentPhone={selStudent.phone || ''} />
                            <StudentModal open={editModal} student={selStudent} onClose={() => setEditModal(false)} onSave={(data) => { updateStudent(selStudent.id, data); import('@/lib/student-store').then(mod => setStudentPatches(mod.getStudentPatches())); setEditModal(false); }} />
                            <IssueSubscriptionModal open={issueModalOpen} onClose={() => setIssueModalOpen(false)} initialStudentId={selStudent.id} onIssue={(data) => { import('@/lib/subscription-store').then(mod => { mod.saveSubscription(data.student_id, { ...data, id: `sub_${Date.now()}` } as any); setSubs(mod.getSubscriptions()); }); setIssueModalOpen(false); }} />
                        </>
                    )}
                </>
            )}
        </div>
    );
}
