'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    Search, Scan, CalendarCheck, Check, AlertTriangle, CheckCircle2,
    ChevronLeft, ChevronRight, Calendar, Clock, X, Plus, Edit2,
    Instagram, Facebook, Send, MessageCircle, Phone, MessageSquare, Info, ShieldAlert,
    ShoppingCart, PlusCircle, Package, ArrowRight, TrendingUp, Trash2,
    GraduationCap
} from 'lucide-react';
import { cn, getInitials, isExpiringSoon, getLocalISODate, formatCurrency, calculateAge } from '@/lib/utils';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { recordCheckin, forceCheckin, getCheckinCountToday, getStudentCheckins, refundCheckin, deleteCheckin, getSessionsRemaining } from '@/lib/checkin-store';
import { getStudents, updateStudent, lookupByUid, getStudentPatches } from '@/lib/student-store';
import { useUser } from '@/hooks/useUser';
import { useStudio } from '@/contexts/StudioContext';
import { getSubscriptions, getSubscription, saveSubscription, pauseActiveSubscription, deleteSubscription, type SubscriptionInfo } from '@/lib/subscription-store';
import { getEventsByDate, getEvents } from '@/lib/event-store';
import { getTeacherName, getTeacherPhoto } from '@/lib/teacher-store';
import { getGroups } from '@/lib/group-store';
import { loadSettings, getScopedKey } from '@/lib/settings-store';
import type { Student, CalendarEvent } from '@/types';
import StudentModal from '@/components/students/StudentModal';
import { ArrowLeftRight } from 'lucide-react';
import { getPlans } from '@/lib/plan-store';
import { IssueSubscriptionModal } from '@/components/subscriptions/IssueSubscriptionModal';
import { ManualSmsModal } from '@/components/ui/ManualSmsModal';
import { getStudentSales, recordSale, deleteSale, type ShopSale } from '@/lib/sales-store';
import type { Product } from '@/types';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { generateDayOptions, generateMonthOptions, generateYearOptions } from '@/lib/date-utils';
import { StandardDatePicker } from '@/components/ui/StandardDatePicker';

// ─── Data ──────────────────────────────────────────────────────────────────────

type State = 'present' | 'absent' | 'none';

import { getStudentsByClass } from '@/lib/student-data';

const THEME_CLASSES: Record<string, string> = {
    indigo: 'border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10',
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

type PopupPhase = 'success' | 'confirm' | 'double-success' | 'info' | 'expired';
interface PopupData { 
    studentId: string; 
    studentName: string; 
    sessionsRemaining: number; 
    checkinCount: number; 
    phase: PopupPhase; 
    isMonthly?: boolean; 
    isIndividual?: boolean;
    photo?: string; 
    planName?: string; 
    totalSessions?: number;
    usedSessions?: number;
}

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
    onSelectSub?: (type: 'group' | 'individual') => void;
}) {
    const autoClose = data.phase === 'success' || data.phase === 'double-success';
    const hasMultipleSubs = (subscriptions?.length ?? 0) > 1;
    const secs = data.phase === 'double-success' ? 3 : 4;
    const countdown = useCountdown(autoClose && !hasMultipleSubs, secs, onClose);
    const progress = autoClose && !hasMultipleSubs ? (countdown / secs) * 100 : 100;

    const isIndividual = data.isIndividual;
    const isMonthly = data.isMonthly;
    const rem = data.sessionsRemaining;
    const noSub = data.phase === 'expired';
    
    const sessionColor = noSub ? 'text-rose-500' : rem <= 2 ? 'text-red-500' : rem === 3 ? 'text-amber-500' : isIndividual ? 'text-orange-500' : 'text-emerald-500';
    const boxBg = noSub ? 'bg-rose-500/5 border border-rose-500/20' : rem <= 2 ? 'bg-red-500/5 border border-red-500/20' : rem === 3 ? 'bg-amber-500/5 border border-amber-500/20' : isIndividual ? 'bg-orange-500/5 border border-orange-500/20' : 'bg-emerald-500/5 border border-emerald-500/20';
    const barColor = noSub ? 'bg-rose-500' : rem <= 2 ? 'bg-red-500' : rem === 3 ? 'bg-amber-500' : isIndividual ? 'bg-orange-500' : 'bg-emerald-500';
    const percent = isMonthly ? 100 : Math.max(0, Math.min(100, (rem / (data.totalSessions || 1)) * 100));

    return (
        <>
            <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose} />
            <div className="fixed inset-x-0 bottom-0 z-[70] flex justify-center pb-24 px-4 items-center sm:inset-0 sm:pb-0 animate-in fade-in zoom-in-95 duration-200" onClick={onClose}>
                <div className="bg-card w-full max-w-[320px] sm:max-w-sm rounded-[3rem] p-8 shadow-2xl border border-white/5 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                    <button onClick={onClose} className="absolute top-6 right-6 text-muted/40 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>

                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full overflow-hidden bg-surface flex items-center justify-center border-4 border-card shadow-xl z-10 relative">
                                {data.photo ? (
                                    <img src={data.photo} alt={data.studentName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-black text-3xl">
                                        {getInitials(data.studentName)}
                                    </div>
                                )}
                            </div>
                            <div className={cn('absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-4 border-card shadow-lg z-20',
                                data.phase === 'success' && 'bg-emerald-500',
                                data.phase === 'expired' && 'bg-rose-500',
                                data.phase === 'info' && 'bg-blue-500',
                                data.phase === 'confirm' && 'bg-amber-500',
                                data.phase === 'double-success' && 'bg-[#6d28d9]'
                            )}>
                                {data.phase === 'success' && <Check className="w-4 h-4 text-white" strokeWidth={4} />}
                                {data.phase === 'expired' && <AlertTriangle className="w-4 h-4 text-white" />}
                                {data.phase === 'info' && <Info className="w-4 h-4 text-white" />}
                                {data.phase === 'confirm' && <Info className="w-4 h-4 text-white" />}
                                {data.phase === 'double-success' && <Check className="w-4 h-4 text-white" strokeWidth={4} />}
                            </div>
                        </div>
                    </div>

                    <div className="text-center mb-6">
                        <h3 className="text-2xl font-black text-primary tracking-tight">{data.studentName}</h3>
                        <p className={cn('text-[11px] font-black tracking-widest mt-2 px-3 py-1 rounded-full inline-block uppercase',
                            data.phase === 'success' ? 'text-emerald-600 bg-emerald-500/10' :
                            data.phase === 'expired' ? 'text-rose-600 bg-rose-500/10' :
                            data.phase === 'confirm' ? 'text-amber-600 bg-amber-500/10' :
                            'text-blue-600 bg-blue-500/10 animate-pulse'
                        )}>
                            {data.phase === 'success' ? '✅ ' + (t.attendanceSheet || 'დასწრება') + ' OK' :
                             data.phase === 'expired' ? '❌ ' + (t.subscriptionExpired || 'ამოწურულია') :
                             data.phase === 'confirm' ? '⚠️ ' + (t.alreadyCheckedIn || 'უკვე აქაა') :
                             data.phase === 'double-success' ? '✅ ×2 ' + (isMonthly ? t.days : t.visit) :
                             'ℹ️ ' + (t.scanAgainToConfirm || 'კვლავ გაატარეთ')}
                        </p>
                    </div>

                    <div className={cn('rounded-[2rem] p-5 mb-6 transition-colors', boxBg)}>
                        <div className="flex items-center justify-between mb-2.5">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest mb-0.5 leading-none">
                                    {data.planName || (noSub ? 'NO PLAN' : 'ACTIVE PLAN')}
                                </span>
                                <span className="text-xs font-bold text-muted opacity-60">
                                    {noSub ? (t.noSubscription || 'აბონემენტი არ არის') : `${t.remaining || 'დარჩენილი'} ${isMonthly ? (t.days || 'დღე') : (t.visits || 'ვიზიტი')}`}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {(data.phase === 'success' || data.phase === 'double-success') && <span className="text-xs text-amber-600 font-black animate-bounce">-1</span>}
                                <span className={cn('text-xl font-black tabular-nums tracking-tighter', sessionColor)}>
                                    {isMonthly ? '∞' : noSub ? '—' : rem}
                                </span>
                            </div>
                        </div>
                        {!noSub && (
                            <div className="w-full h-1 bg-black/5 rounded-full overflow-hidden">
                                <div className={cn('h-full transition-all duration-1000', barColor)} style={{ width: `${percent}%` }} />
                            </div>
                        )}
                    </div>

                    {data.phase === 'info' && (
                        <p className="text-[10px] font-bold text-muted/40 text-center uppercase tracking-[0.2em] mb-4 animate-pulse">
                            {t.scanToConfirm || 'კვლავ გაატარეთ დასადასტურებლად'}
                        </p>
                    )}

                    {data.phase === 'expired' ? (
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <button onClick={() => onSelectSub?.('group')} className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-[#6d28d9] text-white transition-all active:scale-95 shadow-lg shadow-indigo-500/20 border border-white/10">
                                <Plus className="w-5 h-5 stroke-[3]" />
                                <span className="text-[9px] font-black tracking-widest uppercase">{t.groupSubscription || 'ჯგუფური'}</span>
                            </button>
                            <button onClick={() => onSelectSub?.('individual')} className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-amber-500 text-white transition-all active:scale-95 shadow-lg shadow-amber-500/20 border border-white/10">
                                <Plus className="w-5 h-5 stroke-[3]" />
                                <span className="text-[9px] font-black tracking-widest uppercase">{t.individualSubscription || 'ინდივიდუალური'}</span>
                            </button>
                        </div>
                    ) : (
                        <button onClick={onClose} className="w-full py-4 bg-surface hover:bg-surface/80 text-muted font-black text-xs rounded-2xl transition-all uppercase tracking-widest">
                            {t.close || 'დახურვა'} {(!hasMultipleSubs && autoClose) && `(${countdown}s)`}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AttendancePage() {
    const { t, lang, l } = useLanguage();
    const confirm = useConfirm();
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    const { user, profile } = useUser();
    const { settings } = useStudio();
    const isDemo = !user || profile?.studio_name === 'Demo Dance Studio' || !profile?.studio_name;

    const [groups, setGroups] = useState(getGroups());
    const GROUP_MAP = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g.name])), [groups]);
    const GROUP_COLOR_MAP = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g.color])), [groups]);
    useEffect(() => {
        const load = () => setGroups(getGroups());
        window.addEventListener('cc_groups_update', load);
        window.addEventListener('cc_calendar_events_update', load);
        window.addEventListener('cc_data_hydrated', load);
        return () => {
            window.removeEventListener('cc_groups_update', load);
            window.removeEventListener('cc_calendar_events_update', load);
            window.removeEventListener('cc_data_hydrated', load);
        };
    }, []);

    const [selectedDate, setSelectedDate] = useState(new Date());
    const dateKey = getLocalISODate(selectedDate);
    const rawSchedule = getEventsByDate(dateKey);
    
    const filteredSchedule = useMemo(() => {
        const dayOfWeek = (selectedDate.getDay() + 6) % 7;
        
        let targetSchedule = [...rawSchedule];
        
        const existingGroupIds = new Set(rawSchedule.map(ev => ev.group_id).filter(Boolean));
        
        const virtualEvents = groups
            .filter(g => g.schedule_slots?.some(s => s.dayOfWeek === dayOfWeek))
            .filter(g => !existingGroupIds.has(g.id))
            .map(g => {
                const slot = g.schedule_slots?.find(s => s.dayOfWeek === dayOfWeek);
                return {
                    id: `virtual-${g.id}`,
                    group_id: g.id,
                    title: g.name,
                    type: 'group',
                    color: g.color || '#6d28d9',
                    start_time: slot?.startTime || '00:00',
                    end_time: slot?.endTime || '23:59',
                    teacher_id: g.teacher_id || '',
                    hall_id: g.hall_id || ''
                };
            });
        
        targetSchedule = [...targetSchedule, ...virtualEvents];

        return targetSchedule.filter(ev => {
            if (profile?.role === 'teacher' || profile?.role === 'coach') {
                return profile.assigned_group_ids?.includes(ev.group_id || '');
            }
            return true;
        }).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
          .map(ev => {
              const g = groups.find(x => x.id === ev.group_id);
              const tid = ev.teacher_id || g?.teacherId;
              return {
                  ...ev,
                  teacherPhoto: tid ? getTeacherPhoto(tid) : null,
                  teacherName: tid ? getTeacherName(tid) : (ev.coach || g?.coach || '')
              };
          });
    }, [rawSchedule, profile, groups, selectedDate]);

    const [selectedClass, setSelectedClass] = useState('');
    const selClass = filteredSchedule.find(s => s.id === selectedClass);
    const [att, setAtt] = useState<Record<string, State>>({});

    useEffect(() => {
        if (filteredSchedule.length > 0) {
            const now = new Date();
            const isToday = selectedDate.toDateString() === now.toDateString();
            
            let targetId = '';
            if (isToday) {
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                const currentOrNext = filteredSchedule.find(s => {
                    const [startH, startM] = (s.start_time || '00:00').split(':').map(Number);
                    const classStartMins = startH * 60 + startM;
                    return classStartMins >= currentMinutes - 60;
                }) || filteredSchedule[0];
                targetId = currentOrNext.id;
            } else {
                targetId = filteredSchedule[0].id;
            }

            const currentIsValid = filteredSchedule.find(s => s.id === selectedClass);
            const currentIsVirtual = selectedClass.startsWith('virtual-');
            const hasRealEvents = filteredSchedule.some(s => !s.id.startsWith('virtual-'));

            if (!selectedClass || !currentIsValid || (currentIsVirtual && hasRealEvents)) {
                setSelectedClass(targetId);
            }
        }
    }, [selectedDate, filteredSchedule, selectedClass]);

    useEffect(() => {
        const loadAtt = () => {
            const key = getScopedKey('cc_attendance_archive');
            let saved = localStorage.getItem(key);

            if (!saved) {
                const slug = settings.studioSlug;
                const legacyKeys = [`cc_attendance_archive_${slug}_main`, `cc_attendance_archive_${settings.orgId}_main`, `cc_attendance_archive_${slug}`];
                for (const lKey of legacyKeys) {
                    const legacyData = localStorage.getItem(lKey);
                    if (legacyData) {
                        localStorage.setItem(key, legacyData);
                        saved = legacyData;
                        break;
                    }
                }
            }

            const finalAtt: Record<string, State> = {};
            if (saved) {
                try {
                    const data = JSON.parse(saved);
                    if (data[dateKey] && data[dateKey][selectedClass]) {
                        Object.assign(finalAtt, data[dateKey][selectedClass]);
                    }
                } catch (e) {}
            }

            try {
                const checkinKey = getScopedKey(`cc_checkins_${dateKey}`);
                const checkinRaw = localStorage.getItem(checkinKey);
                if (checkinRaw) {
                    const checkins = JSON.parse(checkinRaw);
                    if (Array.isArray(checkins)) {
                        checkins.forEach((c: any) => {
                            if (c.classId === selectedClass || c.groupId === selClass?.group_id) {
                                finalAtt[c.studentId] = 'present';
                            }
                        });
                    }
                }
            } catch (e) {}

            try {
                const cloudRaw = localStorage.getItem(getScopedKey('cc_attendance_data'));
                if (cloudRaw) {
                    const cloudData = JSON.parse(cloudRaw);
                    for (const [studentId, records] of Object.entries(cloudData)) {
                        if (Array.isArray(records)) {
                            records.forEach((r: any) => {
                                if (r.date === dateKey) {
                                    const rClass = r.class_id || r.data?.classId;
                                    const rGroup = r.group_id || r.data?.groupId;
                                    if (rClass === selectedClass || rGroup === selClass?.group_id) {
                                        finalAtt[studentId] = 'present';
                                    }
                                }
                            });
                        }
                    }
                }
            } catch (e) {}

            setAtt(finalAtt);
        };

        loadAtt();
        const events = ['cc_attendance_update', 'cc_student_update', 'cc_subscription_update'];
        events.forEach(e => window.addEventListener(e, loadAtt));
        return () => events.forEach(e => window.removeEventListener(e, loadAtt));
    }, [dateKey, selectedClass, settings.studioSlug, settings.orgId, selClass]);

    const saveAttendance = useCallback((newAtt: Record<string, State>) => {
        const key = getScopedKey('cc_attendance_archive');
        const saved = localStorage.getItem(key);
        const data = saved ? JSON.parse(saved) : {};
        if (!data[dateKey]) data[dateKey] = {};
        data[dateKey][selectedClass] = newAtt;
        localStorage.setItem(key, JSON.stringify(data));
        setAtt(newAtt);
    }, [dateKey, selectedClass]);

    const [popup, setPopup] = useState<PopupData | null>(null);
    const [subs, setSubs] = useState<ReturnType<typeof getSubscriptions>>({});
    const [updateTrigger, setUpdateTrigger] = useState(0);

    const refreshSubs = useCallback(() => {
        setSubs(getSubscriptions());
        setUpdateTrigger(prev => prev + 1);
    }, []);

    useEffect(() => {
        refreshSubs();
        window.addEventListener('focus', refreshSubs);
        window.addEventListener('cc_subscription_update', refreshSubs);
        window.addEventListener('cc_attendance_update', refreshSubs);
        return () => {
            window.removeEventListener('focus', refreshSubs);
            window.removeEventListener('cc_subscription_update', refreshSubs);
            window.removeEventListener('cc_attendance_update', refreshSubs);
        };
    }, [refreshSubs]);

    const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [issueModalOpen, setIssueModalOpen] = useState(false);
    const [issueType, setIssueType] = useState<'group' | 'individual' | undefined>(undefined);
    const [studentPatches, setStudentPatches] = useState<Record<string, any>>({});

    const qrRef = useRef<HTMLInputElement>(null);
    const rfidBuffer = useRef('');
    const rfidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const getSubStatus = useCallback((studentId: string) => {
        const todayStr = getLocalISODate();
        const allStudentSubs = Object.values(subs).flat().filter(sub => sub.student_id === studentId || sub.couple_partner_id === studentId);
        
        let activeSub = allStudentSubs.find(sub => 
            sub.status === 'active' && 
            (selClass?.type === 'individual' ? sub.plan_type === 'individual' : (sub.group_id === selClass?.group_id || !sub.group_id))
        );
        
        if (activeSub) {
            const isUnlimited = activeSub.sessions_total === null;
            const remaining = isUnlimited ? Infinity : (activeSub.sessions_total - (activeSub.sessions_used ?? 0));
            const isExpired = activeSub.expires_at < todayStr || (!isUnlimited && remaining <= 0);
            const isIndividual = activeSub.plan_type === 'individual' || activeSub.plan?.toLowerCase().includes('ინდ') || activeSub.plan?.toLowerCase().includes('indiv');
            
            return { activeSub, isExpired, isIndividual, status: isExpired ? 'expired' : 'active', score: isExpired ? 2 : 0, label: isExpired ? t.expired : t.active, color: isExpired ? 'red' : 'emerald', remaining };
        }

        return { activeSub: null, isExpired: true, status: 'suspended', score: 3, label: t.noSubscription, color: 'red', remaining: 0 };
    }, [selClass, subs, t]);

    const students = useMemo(() => {
        const base = getStudents();
        return base
            .map(s => ({ ...s, ...(studentPatches[s.id] || {}) } as Student))
            .filter(s => {
                if (selClass?.type === 'individual' || selClass?.type === 'rental') {
                    return s.id === selClass.student_id || (selClass.couple_partner_id && s.id === selClass.couple_partner_id);
                }
                if (selClass?.group_id && (s.enrolled_group_ids || []).includes(selClass.group_id)) return true;
                const studentSubs = subs[s.id] || [];
                return studentSubs.some(sub => sub.status === 'active' && (!sub.group_id || sub.group_id === selClass?.group_id));
            });
    }, [studentPatches, selClass, subs]);

    const studentStatuses = useMemo(() => {
        const statuses: Record<string, any> = {};
        students.forEach(s => { statuses[s.id] = getSubStatus(s.id); });
        return statuses;
    }, [students, getSubStatus]);

    const filtered = useMemo(() => {
        return students
            .filter(s => !search || s.full_name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => {
                const sA = studentStatuses[a.id]?.score ?? 2;
                const sB = studentStatuses[b.id]?.score ?? 2;
                if (sA !== sB) return sA - sB;
                return (a.full_name || '').localeCompare(b.full_name || '');
            });
    }, [students, search, studentStatuses]);

    const processCode = useCallback((code: string) => {
        const clean = code.toUpperCase().replace(/[:\-\s]/g, '').trim();
        if (!clean) return;

        const student = lookupByUid(clean) || getStudents().find(s => (s.card_uid || '').toUpperCase().replace(/[:\-\s]/g, '') === clean);
        if (!student) return;

        const studentId = student.id;
        const todayStr = getLocalISODate();
        const studentSubs = (getSubscriptions()[studentId] || []).filter(s => {
            if (s.status !== 'active' || s.expires_at < todayStr) return false;
            if (s.plan_type === 'individual' && selClass?.type !== 'individual') return false;
            if (s.group_id && s.group_id !== selClass?.group_id) return false;
            return true;
        });

        if (studentSubs.length === 0) {
            setPopup({
                studentId,
                studentName: student.full_name,
                sessionsRemaining: 0,
                checkinCount: getCheckinCountToday(studentId),
                phase: 'expired',
                photo: (student as any).photo || student.photo_url
            });
            return;
        }

        const sub = studentSubs[0];
        const isMonthly = sub.type === 'monthly';
        const rem = isMonthly ? Infinity : (sub.sessions_total - (sub.sessions_used || 0));

        if (popup?.studentId !== studentId || popup?.phase !== 'info') {
            setPopup({
                studentId,
                studentName: student.full_name,
                sessionsRemaining: rem,
                checkinCount: getCheckinCountToday(studentId),
                phase: 'info',
                isMonthly,
                isIndividual: sub.plan_type === 'individual' || sub.plan?.toLowerCase().includes('ინდ') || sub.plan?.toLowerCase().includes('indiv'),
                planName: sub.plan,
                photo: (student as any).photo || student.photo_url,
                totalSessions: sub.sessions_total,
                usedSessions: sub.sessions_used
            });
            setTimeout(() => setPopup(curr => curr?.studentId === studentId && curr?.phase === 'info' ? null : curr), 5000);
            return;
        }

        recordCheckin(studentId, student.full_name, 'nfc', selectedClass, selClass?.group_id, sub.id, dateKey);
        saveAttendance({ ...att, [studentId]: 'present' });
        setPopup(prev => prev ? { ...prev, phase: 'success', sessionsRemaining: isMonthly ? Infinity : Math.max(0, rem - 1) } : null);
        setTimeout(() => setPopup(curr => curr?.studentId === studentId && curr?.phase === 'success' ? null : curr), 3000);
    }, [popup, att, saveAttendance, selectedClass, selClass, dateKey]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
            if (e.key === 'Enter') {
                const val = rfidBuffer.current.trim();
                rfidBuffer.current = '';
                if (val) processCode(val);
                return;
            }
            if (e.key.length === 1) {
                rfidBuffer.current += e.key;
                if (rfidTimer.current) clearTimeout(rfidTimer.current);
                rfidTimer.current = setTimeout(() => { rfidBuffer.current = ''; }, 150);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [processCode]);

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-[1600px] mx-auto p-4 sm:p-8">
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-primary">{t.attendance || 'დასწრება'}</h1>
                        <p className="text-muted text-sm font-medium mt-1">{dateKey}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <StandardDatePicker selectedDate={selectedDate} onChange={setSelectedDate} />
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <aside className="lg:col-span-4 space-y-4">
                        <div className="bg-card rounded-[2.5rem] p-6 border border-border-subtle shadow-sm">
                            <h2 className="text-lg font-black mb-4 px-2 uppercase tracking-widest text-primary/40">{t.schedule || 'განრიგი'}</h2>
                            <div className="space-y-2">
                                {filteredSchedule.map((ev) => (
                                    <button
                                        key={ev.id}
                                        onClick={() => setSelectedClass(ev.id)}
                                        className={cn(
                                            "w-full text-left p-4 rounded-3xl transition-all duration-300 border relative overflow-hidden group",
                                            selectedClass === ev.id 
                                                ? "bg-primary text-primary-foreground border-transparent shadow-xl shadow-primary/20 scale-[1.02]" 
                                                : "bg-surface hover:bg-surface/80 border-border-subtle"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-black uppercase tracking-tighter opacity-60">
                                                {ev.start_time} — {ev.end_time}
                                            </span>
                                            {ev.type === 'individual' && <span className="bg-amber-500/20 text-amber-600 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">IND</span>}
                                        </div>
                                        <h3 className="font-black text-sm truncate">{ev.title}</h3>
                                        <div className="flex items-center gap-2 mt-2">
                                            <div className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center overflow-hidden">
                                                {ev.teacherPhoto ? <img src={ev.teacherPhoto} className="w-full h-full object-cover" /> : <div className="text-[8px] font-bold">{getInitials(ev.teacherName || '')}</div>}
                                            </div>
                                            <span className="text-[10px] font-bold opacity-60">{ev.teacherName}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </aside>

                    <main className="lg:col-span-8 space-y-6">
                        <div className="bg-card rounded-[3rem] border border-border-subtle shadow-sm overflow-hidden min-h-[600px]">
                            <div className="p-8 border-b border-border-subtle bg-surface/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted/40" />
                                    <input
                                        type="text"
                                        placeholder={t.searchStudentPlaceholder}
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="w-full bg-background border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold focus:ring-2 ring-primary/20 transition-all placeholder:text-muted/30"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="p-3.5 rounded-2xl bg-surface border border-border-subtle text-primary/60 hover:text-primary transition-colors">
                                        <Scan className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {filtered.map(s => {
                                        const status = studentStatuses[s.id];
                                        const isPresent = att[s.id] === 'present';
                                        
                                        return (
                                            <div key={s.id} className={cn(
                                                "group p-5 rounded-[2rem] border transition-all duration-300 relative overflow-hidden",
                                                isPresent ? "bg-emerald-500/5 border-emerald-500/20" : "bg-surface border-border-subtle"
                                            )}>
                                                <div className="flex items-center gap-4">
                                                    <div className="relative">
                                                        <div className="w-14 h-14 rounded-full overflow-hidden bg-background border-2 border-card shadow-sm group-hover:scale-105 transition-transform">
                                                            {s.photo_url ? <img src={s.photo_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-xl text-primary/20">{getInitials(s.full_name)}</div>}
                                                        </div>
                                                        {isPresent && <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-card text-white"><Check className="w-3.5 h-3.5" strokeWidth={4} /></div>}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-black text-sm text-primary truncate leading-tight mb-0.5">{s.full_name}</h4>
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn("text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full",
                                                                status.color === 'emerald' ? (status.isIndividual ? "bg-orange-500/10 text-orange-600 border border-orange-500/20" : "bg-emerald-500/10 text-emerald-600") :
                                                                status.color === 'red' ? "bg-rose-500/10 text-rose-600" :
                                                                "bg-amber-500/10 text-amber-600"
                                                            )}>
                                                                {status.isIndividual && 'IND · '}{status.label}
                                                            </span>
                                                            {!status.isExpired && <span className="text-[10px] font-bold text-muted/40">{status.remaining === Infinity ? '∞' : status.remaining} {t.visits}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {isPresent ? (
                                                            <button 
                                                                onClick={() => {
                                                                    refundCheckin(s.id, dateKey);
                                                                    saveAttendance({ ...att, [s.id]: 'none' });
                                                                }}
                                                                className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        ) : (
                                                            <button 
                                                                onClick={() => {
                                                                    if (status.isExpired) {
                                                                        setPopup({ studentId: s.id, studentName: s.full_name, phase: 'expired', sessionsRemaining: 0, checkinCount: 0, photo: s.photo_url });
                                                                    } else {
                                                                        recordCheckin(s.id, s.full_name, 'manual', selectedClass, selClass?.group_id, status.activeSub?.id, dateKey);
                                                                        saveAttendance({ ...att, [s.id]: 'present' });
                                                                    }
                                                                }}
                                                                className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all active:scale-90"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>

            {popup && (
                <ScanPopup
                    data={popup}
                    t={t}
                    onClose={() => setPopup(null)}
                    onConfirm={() => {}}
                    onSelectSub={(type) => {
                        setIssueType(type);
                        setSelectedStudent(popup.studentId);
                        setPopup(null);
                        setIssueModalOpen(true);
                    }}
                />
            )}

            {issueModalOpen && (
                <IssueSubscriptionModal
                    isOpen={issueModalOpen}
                    onClose={() => setIssueModalOpen(false)}
                    onSuccess={() => {
                        setIssueModalOpen(false);
                        refreshSubs();
                    }}
                    initialStudentId={selectedStudent || undefined}
                    initialType={issueType}
                />
            )}
        </div>
    );
}
