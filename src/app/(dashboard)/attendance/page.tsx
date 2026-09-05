'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    Search, Scan, CalendarCheck, Check, AlertTriangle, CheckCircle2,
    ChevronLeft, ChevronRight, Calendar, Clock, X, Plus, Edit2,
    Instagram, Facebook, Send, MessageCircle, Phone, MessageSquare, Info, ShieldAlert,
    ShoppingCart, PlusCircle, Package, ArrowRight, TrendingUp, Trash2,
    GraduationCap
} from 'lucide-react';
import { cn, getInitials, isExpiringSoon, getLocalISODate, formatCurrency, calculateAge, formatDate } from '@/lib/utils';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { recordCheckin, forceCheckin, getCheckinCountToday, getStudentCheckins, refundCheckin, deleteCheckin, getSessionsRemaining } from '@/lib/checkin-store';
import { getStudents, updateStudent, lookupByUid, getStudentPatches } from '@/lib/student-store';
import { useUser } from '@/hooks/useUser';
import { useStudio } from '@/contexts/StudioContext';
import { getSubscriptions, getSubscription, saveSubscription, pauseActiveSubscription, deleteSubscription, type SubscriptionInfo } from '@/lib/subscription-store';
import { getEventsByDate, getEvents, updateEvent } from '@/lib/event-store';
import { getTeacherName, getTeacherPhoto } from '@/lib/teacher-store';
import { getGroups } from '@/lib/group-store';
import { getVisibleGroupIds, isTeacherRole } from '@/lib/access';
import { loadSettings, getScopedKey, DEFAULT_SETTINGS } from '@/lib/settings-store';
import { formatSmsTemplate, sendSms } from '@/lib/sms-service';
import type { Student, CalendarEvent } from '@/types';
import StudentModal from '@/components/students/StudentModal';
import { ArrowLeftRight } from 'lucide-react';
import { getPlans } from '@/lib/plan-store';
import { IssueSubscriptionModal } from '@/components/subscriptions/IssueSubscriptionModal';
import { ManualSmsModal } from '@/components/ui/ManualSmsModal';
import { getStudentSales, recordSale, deleteSale, type ShopSale } from '@/lib/sales-store';
import type { Product } from '@/types';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

// ─── Data ──────────────────────────────────────────────────────────────────────

let _renderStartTime = 0;

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

const AVATAR_COLORS = ['from-[#6d28d9] to-violet-600', 'from-emerald-500 to-teal-600', 'from-rose-500 to-pink-600', 'from-amber-500 to-orange-600'];
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
                    data.phase === 'double-success' && 'border-[#6d28d9]/10',
                )}>
                    {autoClose && !hasMultipleSubs && (
                        <div className="h-1 bg-surface relative overflow-hidden">
                            <div className={cn('h-full transition-all ease-linear', data.phase === 'success' ? 'bg-emerald-500' : 'bg-[#6d28d9]')}
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
                                    data.phase === 'double-success' && 'bg-[#6d28d9]',
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
                            {data.phase === 'double-success' && <p className="text-[11px] font-black text-[#5b21b6] tracking-widest mt-2 bg-[#6d28d9]/10 px-3 py-1 rounded-full inline-block">✅ ×2 {data.isMonthly ? t.days : t.visit}</p>}
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
                                                className="w-full text-left p-3 rounded-2xl bg-surface border border-border-subtle hover:border-[#6d28d9]/50 hover:bg-[#6d28d9]/5 transition-all group"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[11px] font-black text-primary truncate max-w-[140px]">{s.plan}</span>
                                                    <span className="text-[10px] font-black text-[#5b21b6] tabular-nums">
                                                        {s.type === 'monthly' ? '∞' : rem}
                                                    </span>
                                                </div>
                                                <p className="text-[8px] font-bold text-muted opacity-40 mt-0.5">{formatDate(s.expires_at)}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (() => {
                            const rem = data.sessionsRemaining;
                            const noSub = rem < 0;
                            const sessionColor = noSub ? 'text-amber-500' : rem <= 2 ? 'text-red-500' : rem === 3 ? 'text-amber-500' : 'text-emerald-500';
                            const boxBg = noSub ? 'bg-amber-500/5 border border-amber-500/20' : rem <= 2 ? 'bg-red-500/5 border border-red-500/20' : rem === 3 ? 'bg-amber-500/5 border border-amber-500/20' : 'bg-emerald-500/5 border border-emerald-500/20';
                            return (
                                <div className={cn('rounded-2xl p-4 mb-8 mt-2 flex items-center justify-between', boxBg)}>
                                    <span className="text-xs font-bold text-muted opacity-60">
                                        {noSub ? (t.noSubscription || 'აბონიმენტი არ არის') : `${t.remaining} ${data.isMonthly ? t.days : t.visits}`}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {!noSub && (data.phase === 'success' || data.phase === 'double-success') && <span className="text-[10px] text-amber-600 font-black">-1</span>}
                                        <span className={cn('text-xl font-black tabular-nums', sessionColor)}>
                                            {data.isMonthly ? '∞' : noSub ? '—' : rem}
                                        </span>
                                    </div>
                                </div>
                            );
                        })()}

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
    if (_renderStartTime === 0 && typeof window !== 'undefined') {
        _renderStartTime = performance.now();
        console.log(`[Perf] 🚀 AttendancePage FIRST RENDER START: ${_renderStartTime.toFixed(2)}ms`);
        
        // 3. activeSlug resolution
        const slugStart = performance.now();
        const activeSlug = localStorage.getItem('cc_active_studio_slug');
        console.log(`[Perf] 🏎️ activeSlug resolved to '${activeSlug}' at ${(performance.now() - _renderStartTime).toFixed(2)}ms (took ${(performance.now() - slugStart).toFixed(2)}ms)`);
    }

    const { t, lang, l } = useLanguage();
    const confirm = useConfirm();
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    const { user, profile } = useUser();
    const { settings } = useStudio();
    const isDemo = !user || profile?.studio_name === 'Demo Dance Studio' || !profile?.studio_name;

    const [groups, setGroups] = useState(getGroups());
    const [events, setEvents] = useState(() => getEvents());
    const GROUP_MAP = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g.name])), [groups]);
    const GROUP_COLOR_MAP = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g.color])), [groups]);
    useEffect(() => {
        const load = () => {
            setGroups(getGroups());
            setEvents(getEvents());
        };
        window.addEventListener('cc_groups_update', load);
        window.addEventListener('cc_calendar_events_update', load);
        window.addEventListener('cc_subscription_update', load);
        window.addEventListener('cc_data_hydrated', load);
        return () => {
            window.removeEventListener('cc_groups_update', load);
            window.removeEventListener('cc_calendar_events_update', load);
            window.removeEventListener('cc_subscription_update', load);
            window.removeEventListener('cc_data_hydrated', load);
        };
    }, []);

    const [selectedDate, setSelectedDate] = useState(new Date());
    const dateKey = getLocalISODate(selectedDate);
    const isToday = dateKey === getLocalISODate();
    
    const filteredSchedule = useMemo(() => {
        const dayOfWeek = (selectedDate.getDay() + 6) % 7;
        const isTeacher = isTeacherRole(profile?.role);
        const visibleGroupIds = isTeacher ? (getVisibleGroupIds(profile as any, (settings.staff || []) as any, groups as any) || []) : null;

        const availableGroups = (isTeacher && visibleGroupIds)
            ? groups.filter(g => visibleGroupIds.includes(g.id))
            : groups;

        // 1. Concrete events from calendar_events for this specific date
        const concreteEvents = events.filter(e => e.date === dateKey);

        // 2. Scheduled regular group classes for this day of week (virtual fallback)
        // Only include if the group does not already have an explicit event in concreteEvents
        const virtualGroupClasses = availableGroups
            .filter(g => g.schedule_slots?.some(s => s.dayOfWeek === dayOfWeek))
            .filter(g => !concreteEvents.some(ev => ev.group_id === g.id))
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
                    teacher_id: g.teacherId || '',
                    hall_id: g.hall_id || ''
                };
            }) as any;

        // 3. Dynamic individual lessons from active individual subscriptions with schedule slots for this day
        const allSubsMap = getSubscriptions();
        const allSubs = Object.values(allSubsMap).flat().filter(Boolean);
        const uniqueSubsMap = new Map<string, any>();
        allSubs.forEach((s: any) => { if (s?.id) uniqueSubsMap.set(s.id, s); });
        const activeIndSubs = Array.from(uniqueSubsMap.values()).filter((s: any) =>
            s && (s.plan_type === 'individual' || s.category?.toLowerCase() === 'individual') &&
            s.status === 'active' &&
            Array.isArray(s.schedule) && s.schedule.length > 0
        );
        const dayOfWeekSunday0 = selectedDate.getDay();
        const virtualIndLessons: any[] = [];
        activeIndSubs.forEach((sub: any) => {
            const subStart = sub.purchased_at ? sub.purchased_at.split('T')[0] : '';
            const subEnd = sub.expires_at ? sub.expires_at.split('T')[0] : '';
            if (subStart && dateKey < subStart) return;
            if (subEnd && dateKey > subEnd) return;

            const slot = sub.schedule?.find((sc: any) => sc.day === dayOfWeekSunday0);
            if (slot) {
                const subEventId = `sub-ind-${sub.id}-${dateKey}`;
                const alreadyExists = concreteEvents.some(ev =>
                    ev.id === subEventId ||
                    (ev.type === 'individual' && ev.student_id === sub.student_id && ev.start_time === slot.time)
                );
                if (!alreadyExists) {
                    const sIds: string[] = (sub.student_id || '').split(',').map((id: string) => id.trim()).filter(Boolean);
                    const allSts = getStudents();
                    const matched = sIds.map((id: string) => allSts.find(x => x.id === id)).filter(Boolean);
                    const displayNames = matched.length > 0 ? matched.map(st => st?.full_name?.split(' ')[0] || st?.first_name || '').join(' & ') : 'ინდივიდუალური';

                    virtualIndLessons.push({
                        id: subEventId,
                        student_id: sub.student_id,
                        title: `${displayNames} (${sub.plan || 'Individual'})`,
                        type: 'individual',
                        color: sub.color || '#6d28d9',
                        start_time: slot.time || '15:00',
                        end_time: slot.endTime || '16:00',
                        teacher_id: sub.teacher_id || '',
                        hall_id: slot.hallId || ''
                    });
                }
            }
        });

        // 4. Merge all! Regular groups, concrete events, and individual lessons appear together seamlessly
        let targetSchedule = [...concreteEvents, ...virtualGroupClasses, ...virtualIndLessons];

        // Staff IDs for the current teacher
        const staffMe = (settings.staff || []).find(s => {
            if (profile?.id && s.id === profile.id) return true;
            if (profile?.email && s.email && s.email.toLowerCase() === profile.email.toLowerCase()) return true;
            const pName = ((profile as any)?.full_name || (profile as any)?.first_name || '').toLowerCase().trim();
            const sName = ((s as any)?.full_name || (s as any)?.first_name || '').toLowerCase().trim();
            return pName && sName && (sName === pName || sName.includes(pName));
        });
        const teacherIds = new Set([profile?.id, staffMe?.id, (profile as any)?.staff_id].filter(Boolean) as string[]);

        return targetSchedule.filter(ev => {
            if (isTeacher && visibleGroupIds) {
                // If it's a group class:
                if (ev.group_id) {
                    const primary = ev.teacher_id || (ev as any).teacherId;
                    return visibleGroupIds.includes(ev.group_id) || (primary && teacherIds.has(primary));
                }
                // If it's an individual lesson:
                if (ev.type === 'individual') {
                    const evTid = ev.teacher_id || (ev as any).teacherId;
                    if (evTid && teacherIds.has(evTid)) return true;
                    const evCoach = (ev.coach || '').toLowerCase().trim();
                    const myName = (staffMe?.full_name || (profile as any)?.full_name || '').toLowerCase().trim();
                    if (evCoach && myName && (evCoach.includes(myName) || myName.includes(evCoach))) return true;
                    // If no teacher is explicitly attached, check if this teacher does individual lessons
                    if (!evTid && (staffMe?.assigned_individual || (profile as any)?.assigned_individual)) return true;
                    return false;
                }
                // Fallback for other events with teacher_id
                const evTid = ev.teacher_id || (ev as any).teacherId;
                return evTid ? teacherIds.has(evTid) : false;
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
    }, [events, profile, groups, selectedDate, settings.staff, dateKey]);

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
        const start = performance.now();
        const data = getSubscriptions();
        console.log(`[Perf] 🔄 refreshSubs() called at ${(performance.now() - _renderStartTime).toFixed(2)}ms. Took ${(performance.now() - start).toFixed(2)}ms`);
        setSubs(data);
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
    const [timeEditOpen, setTimeEditOpen] = useState(false);
    const [timeEditStart, setTimeEditStart] = useState('');
    const [timeEditEnd, setTimeEditEnd] = useState('');
    
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
        
        // 1. Check for specific group sub
        let activeSub = getSubscription(studentId, selClass?.group_id, (selClass?.type as any) === 'individual' ? 'individual' : 'group');
        
        // 2. If nothing found, check for a general sub (group_id: undefined)
        if (!activeSub) {
            activeSub = getSubscription(studentId, undefined, (selClass?.type as any) === 'individual' ? 'individual' : 'group');
        }
        
        if (activeSub) {
            const hasExpiredByDate = activeSub.expires_at < todayStr;
            const isUnlimited = activeSub.sessions_total === null;
            const remaining = isUnlimited ? Infinity : ((activeSub.sessions_total ?? 0) - (activeSub.sessions_used ?? 0));
            const hasUsedAllSessions = !isUnlimited && activeSub.sessions_total !== null && remaining <= 0;
            
            if (hasExpiredByDate || hasUsedAllSessions) {
                return { activeSub, isExpired: true, status: 'expired', score: 2, label: t.expired, color: 'red', remaining };
            }

            // Granular scoring for active subs
            if (isUnlimited) {
                return { activeSub, isExpired: false, status: 'active', score: 0, label: t.active, color: 'emerald', remaining: Infinity };
            }
            if (remaining === 1) {
                return { activeSub, isExpired: false, status: 'warning', score: 1, label: t.active, color: 'yellow', remaining };
            }
            if (remaining <= 3) {
                return { activeSub, isExpired: false, status: 'warning', score: 0.5, label: t.active, color: 'amber', remaining };
            }
            
            return { activeSub, isExpired: false, status: 'active', score: 0, label: t.active, color: 'emerald', remaining };
        }

        // 3. Check for any previous sub for grace period or just mark as none
        const all = subs[studentId] || [];
        if (all.length > 0) {
            const last = [...all].sort((a,b) => b.expires_at.localeCompare(a.expires_at))[0];
            const remaining = (last.sessions_total ?? 0) - (last.sessions_used ?? 0);
            return { activeSub: null, isExpired: true, status: 'expired', score: 2, label: t.expired, color: 'red', remaining };
        }

        return { activeSub: null, isExpired: true, status: 'suspended', score: 3, label: t.noSubscription, color: 'red', remaining: 0 };
    }, [selClass, subs, t.active, t.expired, t.noSubscription]);

    const cls = filteredSchedule.find(s => s.id === selectedClass) || filteredSchedule[0] || ({} as CalendarEvent);

    // Full roster keyed by id (patches applied), independent of the selected
    // class — used to resolve the 1-2 students an individual/rental lesson
    // actually belongs to (`ev.student_id`, comma-separated for a pair),
    // for the stacked-avatar UI on the schedule cards / header below.
    const allStudentsById = useMemo(() => {
        const map: Record<string, Student> = {};
        getStudents().forEach(s => {
            const merged = { ...s, ...(studentPatches[s.id] || {}) } as Student;
            map[merged.id] = merged;
        });
        return map;
    }, [studentPatches]);

    const getEventStudents = useCallback((ev: any): Student[] => {
        if (!ev?.student_id) return [];
        const ids = String(ev.student_id).split(',').map((id: string) => id.trim()).filter(Boolean);
        return ids.map(id => allStudentsById[id]).filter(Boolean) as Student[];
    }, [allStudentsById]);

    // 1. Get base students list
    const students = useMemo(() => {
        const start = performance.now();
        console.log(`[Perf] 👥 getStudents() useMemo Triggered at ${(start - _renderStartTime).toFixed(2)}ms. Dependencies resolved: { studentPatches: ${Object.keys(studentPatches).length}, cls: ${cls?.id}, selectedClass: ${selectedClass}, subs: ${Object.keys(subs).length} }`);
        const base = getStudents();
        console.log(`[Perf] 👥 getStudents() took ${(performance.now() - start).toFixed(2)}ms`);
        return base
            .map(s => ({ ...s, ...(studentPatches[s.id] || {}) } as Student))
            .filter(s => {
                if (cls?.type === 'individual' || cls?.type === 'rental') {
                    // 🎯 Only the 1 (or 2, for a pair) student(s) this specific
                    // lesson was actually booked for (`cls.student_id`, comma-
                    // separated) — not the whole studio roster. Previously this
                    // unconditionally returned true for every student, so
                    // selecting an individual/rental lesson showed all ~60+
                    // students in the middle panel instead of just the 1-2 who
                    // are actually enrolled in it.
                    const clsStudentIds = cls?.student_id
                        ? String(cls.student_id).split(',').map((id: string) => id.trim()).filter(Boolean)
                        : [];
                    if (clsStudentIds.length > 0) return clsStudentIds.includes(s.id);
                    // Legacy event with no student_id recorded — fall back to
                    // showing everyone rather than an empty, unusable list.
                    return true;
                }
                if (cls?.group_id && (s.enrolled_group_ids || []).includes(cls.group_id)) return true;

                // Allow students with active subscriptions for this group
                const studentSubs = subs[s.id] || [];
                const hasActiveSub = studentSubs.some(sub =>
                    sub.status === 'active' &&
                    (!sub.group_id || sub.group_id === cls?.group_id)
                );
                if (hasActiveSub) return true;

                return (s as any).classes?.includes(selectedClass);
            });
    }, [studentPatches, cls, selectedClass, subs]);

    // 2. Pre-calculate statuses for ALL visible students once
    const studentStatuses = useMemo(() => {
        const statuses: Record<string, { activeSub: any; isExpired: boolean; score: number; label: string | null; color: string; remaining: number }> = {};
        students.forEach(s => {
            statuses[s.id] = getSubStatus(s.id);
        });
        return statuses;
    }, [students, getSubStatus]);

    // 3. Filter and Sort using pre-calculated statuses
    const filtered = useMemo(() => {
        const start = performance.now();
        const res = students
            .filter(s => !search || s.full_name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => {
                const sA = studentStatuses[a.id]?.score ?? 2;
                const sB = studentStatuses[b.id]?.score ?? 2;
                if (sA !== sB) return sA - sB;
                return (a.full_name || '').localeCompare(b.full_name || '');
            });
        console.log(`[Perf] 🎯 Filter/Sort completed at ${(performance.now() - _renderStartTime).toFixed(2)}ms (took ${(performance.now() - start).toFixed(2)}ms). Rendering ${res.length} students.`);
        return res;
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

                            const prefLang = (student.preferred_language || 'ka') as 'ka' | 'ru' | 'en';
                            const settings = loadSettings();
                            const templates = settings.sms_templates || {};

                            const defaultTpl = (DEFAULT_SETTINGS.sms_templates as any)[prefLang]?.expiration_day_0 ||
                                               (DEFAULT_SETTINGS.sms_templates as any)['ka']?.expiration_day_0 ||
                                               'გამარჯობა {name}, გენატრებათ ვარჯიში? თქვენი აბონემენტი ({plan}) იწურება დღეს. გთხოვთ განაახლოთ.';
                            let tpl = defaultTpl;
                            const langTemplates = (templates as any)[prefLang];
                            if (langTemplates && typeof langTemplates === 'object' && langTemplates.expiration_day_0) {
                                tpl = langTemplates.expiration_day_0;
                            } else if (templates.ka && typeof templates.ka === 'object' && templates.ka.expiration_day_0) {
                                tpl = templates.ka.expiration_day_0;
                            }

                            const studioName = settings.studioName || 'Studio';
                            const planName = usedSub?.plan || (usedSub as any)?.plan_name || '';
                            const msg = formatSmsTemplate(tpl, {
                                student,
                                planName,
                                studioName
                            });

                            sendSms({ to: phone, text: msg, studentName: student.full_name }).then(res => {
                                if (res.success) {
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
        <PermissionGuard permKey="canViewAttendance">
            <div className="flex flex-col flex-1 min-h-[100dvh] bg-card animate-fade-up overflow-x-hidden relative max-w-full">
            {!mounted ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-2xl border-4 border-[#6d28d9]/20 border-t-#6d28d9 animate-spin" />
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


                    {/* ── Time Edit Modal ── */}
                    {timeEditOpen && cls.id && (
                        <>
                            <div className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm" onClick={() => setTimeEditOpen(false)} />
                            <div className="fixed inset-x-4 bottom-6 z-[90] sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:w-80 animate-in fade-in zoom-in-95 duration-200">
                                <div className="bg-card border border-border-subtle rounded-[2rem] shadow-2xl p-6">
                                    <div className="flex items-center justify-between mb-5">
                                        <h3 className="text-sm font-black text-primary tracking-tight">დრო</h3>
                                        <button onClick={() => setTimeEditOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-surface hover:bg-surface/80 text-muted transition-colors">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="flex-1">
                                            <label className="text-[9px] font-black text-muted opacity-50 uppercase tracking-widest block mb-1.5">დასაწყისი</label>
                                            <input
                                                type="time"
                                                value={timeEditStart}
                                                onChange={e => setTimeEditStart(e.target.value)}
                                                className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-sm font-black text-primary focus:outline-none focus:border-[#6d28d9] focus:ring-1 focus:ring-[#6d28d9]/20 transition-all"
                                            />
                                        </div>
                                        <div className="text-muted opacity-40 font-black mt-5">–</div>
                                        <div className="flex-1">
                                            <label className="text-[9px] font-black text-muted opacity-50 uppercase tracking-widest block mb-1.5">დასასრული</label>
                                            <input
                                                type="time"
                                                value={timeEditEnd}
                                                onChange={e => setTimeEditEnd(e.target.value)}
                                                className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-sm font-black text-primary focus:outline-none focus:border-[#6d28d9] focus:ring-1 focus:ring-[#6d28d9]/20 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (timeEditStart && timeEditEnd && cls.id && !cls.id.startsWith('virtual-')) {
                                                updateEvent(cls.id, { start_time: timeEditStart, end_time: timeEditEnd });
                                                window.dispatchEvent(new Event('cc_calendar_events_update'));
                                            }
                                            setTimeEditOpen(false);
                                        }}
                                        className="w-full py-3 bg-[#6d28d9] hover:bg-[#5b21b6] active:scale-[0.98] text-white font-black text-sm rounded-xl transition-all"
                                    >
                                        შენახვა
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Desktop Status Floater (Top Right) */}
                    <div className="hidden lg:flex absolute top-6 right-8 z-50 items-center justify-end pointer-events-none">
                        {scanError && <span className="text-xs font-bold text-white bg-red-500 px-4 py-2.5 rounded-2xl animate-bounce">{scanError}</span>}
                        {flash && <span className="text-xs font-bold text-white bg-emerald-500 px-4 py-2.5 rounded-2xl">{t.success}</span>}
                    </div>

                    {/* Mobile Header / Sleek Date Navigator */}
                    <div className={cn(
                        'flex lg:hidden flex-col gap-1.5 p-2 transition-colors duration-300 relative w-full border-b bg-card',
                        scanError ? 'bg-red-500/5' : flash ? 'bg-emerald-500/5' : ''
                    )}>
                        {/* Status Line */}
                        {(scanError || flash) && (
                            <div className="flex items-center justify-center h-4 relative">
                                {scanError && <span className="text-[10px] font-black text-red-500 bg-red-500/10 px-2.5 py-1 rounded-full animate-bounce">{scanError}</span>}
                                {flash && <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full">{t.success}</span>}
                            </div>
                        )}

                        {/* Elegant Mobile Date Bar */}
                        <div className="flex items-center justify-between bg-surface border border-border-subtle rounded-2xl p-1 shadow-sm">
                            <button
                                type="button"
                                title={l('წინა დღე', 'Предыдущий день', 'Previous day')}
                                onClick={() => {
                                    const prev = new Date(selectedDate);
                                    prev.setDate(prev.getDate() - 1);
                                    setSelectedDate(prev);
                                }}
                                className="w-10 h-10 flex items-center justify-center rounded-xl text-muted hover:text-primary hover:bg-card active:scale-90 transition-all flex-shrink-0"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>

                            <div className="relative flex-1 flex items-center justify-center px-2 h-10 cursor-pointer group">
                                <input
                                    type="date"
                                    value={dateKey}
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            const [y, m, d] = e.target.value.split('-').map(Number);
                                            if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                                                setSelectedDate(new Date(y, m - 1, d));
                                            }
                                        }
                                    }}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                />
                                <div className="flex items-center gap-2 pointer-events-none select-none">
                                    <div className="w-7 h-7 rounded-lg bg-[#6d28d9]/10 flex items-center justify-center text-[#6d28d9]">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[13px] font-black text-primary tracking-tight">
                                            {selectedDate.toLocaleDateString(lang === 'ka' ? 'ka-GE' : lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </span>
                                        {isToday ? (
                                            <span className="px-1.5 py-0.5 rounded-md bg-[#6d28d9]/10 text-[#6d28d9] text-[9px] font-black uppercase tracking-wider">
                                                {l('დღეს', 'сегодня', 'today')}
                                            </span>
                                        ) : (
                                            <span className="text-[11px] font-bold text-muted capitalize">
                                                ({selectedDate.toLocaleDateString(lang === 'ka' ? 'ka-GE' : lang === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'short' })})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                title={l('შემდეგი დღე', 'Следующий день', 'Next day')}
                                onClick={() => {
                                    const next = new Date(selectedDate);
                                    next.setDate(next.getDate() + 1);
                                    setSelectedDate(next);
                                }}
                                className="w-10 h-10 flex items-center justify-center rounded-xl text-muted hover:text-primary hover:bg-card active:scale-90 transition-all flex-shrink-0"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        {/* Left Panel: Schedule (Desktop) */}
                        <div className="hidden xl:flex w-56 border-r border-border-subtle bg-surface/30 flex-col">
                            <div className="p-3.5 border-b border-border-subtle/50 flex flex-col gap-2.5">
                                {/* Desktop Date Picker */}
                                {mounted && (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between bg-card border border-border-subtle rounded-2xl p-1 shadow-sm hover:border-[#6d28d9]/40 transition-all">
                                            <button
                                                type="button"
                                                title={l('წინა დღე', 'Предыдущий день', 'Previous day')}
                                                onClick={() => {
                                                    const prev = new Date(selectedDate);
                                                    prev.setDate(prev.getDate() - 1);
                                                    setSelectedDate(prev);
                                                }}
                                                className="w-7 h-7 flex items-center justify-center rounded-xl text-muted hover:text-primary hover:bg-surface active:scale-95 transition-all flex-shrink-0"
                                            >
                                                <ChevronLeft className="w-3.5 h-3.5" />
                                            </button>

                                            <div className="relative flex-1 flex items-center justify-center px-1 h-7 cursor-pointer group min-w-0">
                                                <input
                                                    type="date"
                                                    value={dateKey}
                                                    onChange={(e) => {
                                                        if (e.target.value) {
                                                            const [y, m, d] = e.target.value.split('-').map(Number);
                                                            if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                                                                setSelectedDate(new Date(y, m - 1, d));
                                                            }
                                                        }
                                                    }}
                                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                                />
                                                <div className="flex items-center gap-1.5 pointer-events-none select-none truncate">
                                                    <Calendar className="w-3.5 h-3.5 text-[#6d28d9] flex-shrink-0 group-hover:scale-110 transition-transform" />
                                                    <span className="text-[11.5px] font-black text-primary tracking-tight truncate">
                                                        {selectedDate.toLocaleDateString(lang === 'ka' ? 'ka-GE' : lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                    <span className="text-[9px] font-black text-muted uppercase tracking-wider flex-shrink-0">
                                                        {isToday ? l('დღეს', 'сег', 'today') : selectedDate.toLocaleDateString(lang === 'ka' ? 'ka-GE' : lang === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'short' })}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                title={l('შემდეგი დღე', 'Следующий день', 'Next day')}
                                                onClick={() => {
                                                    const next = new Date(selectedDate);
                                                    next.setDate(next.getDate() + 1);
                                                    setSelectedDate(next);
                                                }}
                                                className="w-7 h-7 flex items-center justify-center rounded-xl text-muted hover:text-primary hover:bg-surface active:scale-95 transition-all flex-shrink-0"
                                            >
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        {!isToday && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedDate(new Date())}
                                                className="w-full py-1 px-2 text-[10px] font-black text-[#6d28d9] bg-[#6d28d9]/5 hover:bg-[#6d28d9]/10 rounded-xl transition-all text-center flex items-center justify-center gap-1 border border-[#6d28d9]/15"
                                            >
                                                <span>↩</span>
                                                <span>{l('დღეს დაბრუნება', 'Вернуться к сегодня', 'Jump to Today')}</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                                <p className="text-[10px] font-black tracking-[0.2em] text-muted opacity-40 px-1">{t.schedule}</p>
                            </div>
                            <div className="flex-1 p-3 space-y-1.5 flex-shrink-0 overflow-y-auto no-scrollbar">
                                {mounted && (
                                    filteredSchedule.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-4 py-8 text-center">
                                            <div className="w-10 h-10 rounded-2xl bg-surface border border-border-subtle flex items-center justify-center text-muted mb-2 shadow-sm">
                                                <Calendar className="w-5 h-5 opacity-40" />
                                            </div>
                                            <p className="text-xs font-bold text-primary mb-0.5">
                                                {isToday ? l('დღეს არ არის გაკვეთილები', 'Сегодня нет занятий', 'No classes today') : l('ამ დღეს გაკვეთილები არ არის', 'В этот день нет занятий', 'No classes on this day')}
                                            </p>
                                            <p className="text-[10px] text-muted">
                                                {l('განრიგი ცარიელია', 'Расписание пусто', 'Schedule is empty')}
                                            </p>
                                        </div>
                                    ) : (
                                        filteredSchedule.map(s => {
                                            const isCurrent = isCurrentClass(s.start_time);
                                            const isActive = selectedClass === s.id;
                                            const timeStr = `${s.start_time}–${s.end_time}`;
                                            const classColor = s.color || (s.group_id ? GROUP_COLOR_MAP[s.group_id] : null) || '#6d28d9';
                                    
                                    return (
                                        <button key={s.id} onClick={() => setSelectedClass(s.id)}
                                            className={cn(
                                                'w-full text-left p-3.5 rounded-2xl transition-all group border relative overflow-hidden',
                                                isActive
                                                    ? 'z-10 text-white shadow-xl'
                                                    : 'bg-card border-border-subtle hover:bg-surface hover:border-border-subtle/50'
                                            )}
                                            style={isActive ? { 
                                                backgroundColor: classColor, 
                                                borderColor: classColor,
                                                boxShadow: `0 10px 25px -5px ${classColor}40`
                                            } : {}}>
                                            <h3 className={cn(
                                                'text-[12.5px] font-black truncate leading-tight transition-colors',
                                                isActive ? 'text-white' : 'text-primary'
                                            )}>
                                                {s.title || (s.group_id ? GROUP_MAP[s.group_id] : (s.type === 'individual' ? t.indSession : t.untitledClass))}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <Clock className={cn(
                                                    'w-2.5 h-2.5 transition-colors',
                                                    isActive ? 'text-white/60' : isCurrent ? 'text-emerald-500' : 'text-muted opacity-40'
                                                )} />
                                                <span className={cn(
                                                    'text-[9px] font-black tabular-nums transition-colors',
                                                    isActive ? 'text-white/80' : isCurrent ? 'text-emerald-600' : 'text-muted'
                                                )}>{timeStr}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-2.5">
                                                <div className="flex items-center gap-2">
                                                    {(s.type === 'individual' || s.type === 'rental') && getEventStudents(s).length > 0 ? (
                                                        <div className="flex -space-x-2 shrink-0">
                                                            {getEventStudents(s).slice(0, 2).map(st => (
                                                                <div key={st.id} className="w-5 h-5 rounded-full border border-white/40 overflow-hidden bg-indigo-500 flex items-center justify-center text-[6px] font-black text-white shrink-0">
                                                                    {st.photo_url ? (
                                                                        <img src={st.photo_url} alt={st.full_name} className="w-full h-full object-cover" />
                                                                    ) : getInitials(st.full_name)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (s as any).teacherPhoto ? (
                                                        <img src={(s as any).teacherPhoto} alt="" className="w-5 h-5 rounded-full object-cover border border-white/20" />
                                                    ) : (
                                                        <GraduationCap className={cn("w-3.5 h-3.5", isActive ? "text-white/40" : "text-muted opacity-30")} />
                                                    )}
                                                    <span className={cn(
                                                        'text-[8px] font-bold tracking-tight truncate max-w-[100px] transition-colors',
                                                        isActive ? 'text-white/60' : 'text-muted opacity-50'
                                                    )}>
                                                        {(s.type === 'individual' || s.type === 'rental') && getEventStudents(s).length > 0
                                                            ? getEventStudents(s).map(st => st.full_name).join(', ')
                                                            : ((s as any).teacherName || getTeacherName(s.teacher_id))}
                                                    </span>
                                                </div>
                                                {isCurrent && (
                                                    <span className={cn(
                                                        'w-1.5 h-1.5 rounded-full animate-pulse',
                                                        isActive ? 'bg-white' : 'bg-emerald-500'
                                                    )} />
                                                )}
                                            </div>
                                        </button>
                                    );
                                })))}
                            </div>
                        </div>

                        {/* Middle Panel: Student List */}
                        <div className="flex-1 flex flex-col bg-card border-r border-border-subtle overflow-hidden">
                            {filteredSchedule.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-fade-up">
                                    <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 mb-4 shadow-sm">
                                        <Calendar className="w-8 h-8 opacity-80" />
                                    </div>
                                    <h3 className="text-lg font-bold text-primary mb-1">
                                        {isToday ? l('დღეს არ არის გაკვეთილები', 'Сегодня нет занятий', 'No classes scheduled today') : l('ამ დღეს გაკვეთილები არ არის', 'В этот день нет занятий', 'No classes scheduled on this date')}
                                    </h3>
                                    <p className="text-xs text-muted max-w-sm mb-6 leading-relaxed">
                                        {isTeacherRole(profile?.role)
                                            ? l('თქვენს ჯგუფებს ამ დღეს გაკვეთილი არ აქვთ ჩანიშნული.', 'У ваших групп на этот день не запланировано занятий.', 'No classes scheduled for your groups on this day.')
                                            : l('არჩეულ თარიღზე განრიგში გაკვეთილები არ მოიძებნა.', 'На выбранную дату занятий не найдено.', 'No classes found in the schedule for the selected date.')
                                        }
                                    </p>
                                    {!isToday && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDate(new Date())}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-1.5"
                                        >
                                            <span>↩</span>
                                            <span>{l('დღევანდელ დღეზე დაბრუნება', 'Вернуться к сегодняшнему дню', 'Back to Today')}</span>
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div className="p-3 md:p-6 border-b border-border-subtle/50 flex flex-col gap-3 md:gap-4 flex-shrink-0">
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0 pr-2">
                                        <h2 className="text-lg md:text-xl font-black text-primary tracking-tight truncate">
                                            {cls.title || (cls.group_id ? GROUP_MAP[cls.group_id] : (cls.type === 'individual' ? t.indSession : t.untitledClass))}
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                                            <div className="flex items-center gap-1.5">
                                                {(cls.type === 'individual' || cls.type === 'rental') && getEventStudents(cls).length > 0 ? (
                                                    <div className="flex -space-x-2 shrink-0">
                                                        {getEventStudents(cls).slice(0, 2).map(st => (
                                                            <div key={st.id} className="w-4 h-4 rounded-full border border-card overflow-hidden bg-indigo-500 flex items-center justify-center text-[5px] font-black text-white shrink-0">
                                                                {st.photo_url ? (
                                                                    <img src={st.photo_url} alt={st.full_name} className="w-full h-full object-cover" />
                                                                ) : getInitials(st.full_name)}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (cls as any).teacherPhoto ? (
                                                    <img src={(cls as any).teacherPhoto} alt="" className="w-4 h-4 rounded-full object-cover border border-border-subtle" />
                                                ) : (
                                                    <GraduationCap className="w-3.5 h-3.5 text-muted opacity-30" />
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setTimeEditStart(cls.start_time || '');
                                                        setTimeEditEnd(cls.end_time || '');
                                                        setTimeEditOpen(true);
                                                    }}
                                                    className="text-[10px] md:text-xs font-bold text-muted opacity-60 hover:opacity-100 hover:text-[#6d28d9] transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                                                >
                                                    <Clock className="w-3 h-3 shrink-0" />
                                                    {cls.start_time}–{cls.end_time} · {(cls as any).teacherName || getTeacherName(cls.teacher_id)}
                                                </button>
                                            </div>
                                            {cls.notes && (
                                                <div className="flex items-center gap-1 px-2 py-0.5 bg-[#f5f3ff] border border-[#ede9fe] rounded-full">
                                                    <Info className="w-3 h-3 text-[#a78bfa]" />
                                                    <p className="text-[9px] font-bold text-[#5b21b6] truncate max-w-[200px]">{cls.notes}</p>
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
                                {/* Horizontal Scroll Hint Wrapper */}
                                <div className="xl:hidden relative w-full flex-shrink-0 z-30 group/scroll">
                                    <div className="w-full flex overflow-x-auto no-scrollbar gap-2 pb-1.5 px-3 touch-pan-x">
                                        {mounted && filteredSchedule.map(s => {
                                            const classColor = s.color || (s.group_id ? GROUP_COLOR_MAP[s.group_id] : null) || '#6d28d9';
                                            return (
                                                <button key={s.id} onClick={() => setSelectedClass(s.id)}
                                                    className={cn(
                                                        'px-3.5 py-2 rounded-xl text-[11px] font-black whitespace-nowrap transition-all border-2 flex-shrink-0 active:scale-95 duration-200',
                                                        selectedClass === s.id ? 'text-white shadow-lg' : 'bg-surface text-muted border-border-subtle hover:border-muted/30'
                                                    )}
                                                    style={selectedClass === s.id ? { 
                                                        backgroundColor: classColor, 
                                                        borderColor: classColor,
                                                        boxShadow: `0 4px 12px ${classColor}30`
                                                    } : {}}>
                                                    {s.title || (s.group_id ? GROUP_MAP[s.group_id] : (s.type === 'individual' ? t.indSession : t.untitledClass))}
                                                </button>
                                            );
                                        })}
                                        {/* Spacer to prevent last item from being covered by the gradient */}
                                        <div className="w-6 flex-shrink-0" />
                                    </div>
                                    {/* Fade Gradient + Arrow Indicator */}
                                    <div className="absolute right-0 top-0 bottom-1.5 w-16 bg-gradient-to-l from-card to-transparent pointer-events-none flex items-center justify-end pr-1.5">
                                        <ChevronRight className="w-4 h-4 text-muted/60 animate-[pulse_2s_ease-in-out_infinite]" />
                                    </div>
                                </div>
                            </div>

                            {/* Main Student List Section */}
                            <div className="flex-1 p-0 md:p-4 pb-24 md:pb-4 space-y-0.5 md:space-y-4 overflow-y-auto no-scrollbar overflow-x-hidden">
                                {!mounted ? (
                                    <div className="space-y-4 px-2">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="w-full h-20 md:h-24 bg-surface animate-pulse rounded-[1.5rem] md:rounded-[2rem]" />
                                        ))}
                                    </div>
                                ) : filtered.length > 0 ? filtered.map(st => {
                                    const state = att[st.id] ?? 'none';
                                    const isSel = selectedStudent === st.id;
                                    const isFl = flash === st.id;

                                    const sInf = studentStatuses[st.id] || { score: 3, label: null, isExpired: true, activeSub: null, color: 'red' };
                                    const { label, isExpired, activeSub, color: statusColor, remaining } = sInf;

                                    return (
                                        <div key={st.id}
                                            onClick={() => openProfile(st.id)}
                                            className={cn(
                                                'w-full flex items-center justify-between gap-3 p-4 md:p-6 rounded-none md:rounded-[2rem] transition-all group border-b md:border md:relative overflow-hidden cursor-pointer',
                                                isFl ? 'bg-emerald-500/5 border-emerald-500/20' :
                                                    isSel ? 'bg-[#f5f3ff]/50 border-[#ddd6fe]' :
                                                        'bg-card border-border-subtle hover:bg-surface/50 hover:border-border-subtle/50',
                                                isExpired && 'opacity-90'
                                            )}>

                                            {/* Avatar + Info Area (Fills space) */}
                                            <div className="flex items-center gap-3.5 md:gap-5 relative z-10 flex-1 min-w-0">
                                                {/* Photo */}
                                                <div
                                                    className={cn(
                                                        "w-11 h-11 md:w-14 md:h-14 rounded-full border-[3px] transition-all flex-none flex items-center justify-center overflow-hidden relative",
                                                        isExpired ? "border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.3)]" :
                                                        remaining === 1 ? "border-yellow-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]" :
                                                        remaining <= 3 ? "border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]" :
                                                        "border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                                                    )}
                                                >
                                                    <span className={cn(
                                                        `w-full h-full rounded-full flex items-center justify-center transition-transform duration-300`,
                                                        !mounted ? "bg-surface" : (
                                                            isExpired ? "bg-red-500" :
                                                            remaining === 1 ? "bg-yellow-400" :
                                                            remaining <= 3 ? "bg-amber-500" :
                                                            "bg-emerald-500"
                                                        )
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
                                                                "shrink-0 text-[6px] md:text-[8px] font-black tracking-tighter px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-md border uppercase inline-flex transition-colors",
                                                                isExpired ? "text-red-500 border-red-500/20 bg-red-500/5" : 
                                                                remaining === 1 ? "text-yellow-600 border-yellow-500/20 bg-yellow-500/5" :
                                                                remaining <= 3 ? "text-amber-600 border-amber-500/20 bg-amber-500/5" :
                                                                "text-emerald-500 border-emerald-500/20 bg-emerald-500/5"
                                                            )}>
                                                                {isExpired ? t.expired : label}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Progress/Status Bar */}
                                                    <div className="flex items-center gap-3 w-full">
                                                        {(() => {
                                                            const subToDisplay = activeSub || (activeSub === null ? (subs[st.id]?.[0] || null) : null);
                                                            const isActuallyNone = !subToDisplay;
                                                            const isReallyExpired = isExpired || (subToDisplay && subToDisplay.expires_at < getLocalISODate());
                                                            const isInf = subToDisplay && subToDisplay.sessions_total === null;
                                                            const remaining = subToDisplay ? (isInf ? Infinity : (subToDisplay.sessions_total - (subToDisplay.sessions_used ?? 0))) : 0;
                                                            
                                                            if (isActuallyNone) {
                                                                return (
                                                                    <div className="flex-1 h-1 bg-surface rounded-full overflow-hidden border border-border-subtle/30"></div>
                                                                );
                                                            }

                                                            return (
                                                                <>
                                                                    <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden border border-border-subtle/20 relative shadow-inner">
                                                                        <div
                                                                            className={cn(
                                                                                "h-full transition-all duration-700",
                                                                                isReallyExpired ? "bg-red-500 opacity-20" :
                                                                                remaining === Infinity ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" :
                                                                                remaining === 1 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" :
                                                                                remaining <= 3 ? "bg-amber-500" : 
                                                                                "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                                                                            )}
                                                                            style={{ width: remaining === Infinity ? '100%' : (subToDisplay.sessions_total ? `${Math.max(5, Math.min(100, (remaining / subToDisplay.sessions_total) * 100))}%` : '100%') }}
                                                                        />
                                                                    </div>
                                                                    <span className={cn(
                                                                        "shrink-0 text-[10px] font-black tabular-nums tracking-tighter flex items-center gap-1",
                                                                        isReallyExpired ? "text-red-500" :
                                                                        remaining === Infinity ? "text-emerald-600" :
                                                                        remaining === 1 ? "text-red-500" :
                                                                        remaining <= 3 ? "text-amber-600" : 
                                                                        "text-emerald-600"
                                                                    )}>
                                                                        {remaining === Infinity ? '∞' : remaining} {t.visit}
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
                                </>
                            )}
                        </div>

                        {/* Right Panel: Student Details / Drawer */}
                        {drawerOpen && (
                            <div className="xl:hidden fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
                                onClick={() => setDrawerOpen(false)} />
                        )}
                        <div className={cn(
                            "bg-surface/30 flex-col overflow-hidden transition-all duration-300 ease-in-out xl:w-[35%] xl:min-w-[340px]",
                            drawerOpen
                                ? "fixed inset-0 z-[100] bg-card flex animate-in slide-in-from-bottom-8 xl:static xl:inset-auto xl:z-0 xl:rounded-none xl:shadow-none xl:animate-none xl:border-l shadow-2xl"
                                : "hidden xl:flex xl:border-l xl:border-border-subtle"
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
                                            const exp = new Date(activeSub.expires_at);
                                            const diff = exp.getTime() - new Date().getTime();
                                            const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
                                            daysLeft = exp.getFullYear() > 2050 || days > 365 ? '∞' : days.toString();
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
                                                            className="p-3 rounded-xl bg-surface border border-border-subtle text-muted hover:text-[#6d28d9] hover:border-[#6d28d9]/30 transition-all active:scale-90"
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
                                                            className="flex items-center justify-center gap-2 h-11 rounded-xl bg-surface border border-emerald-500/20 text-emerald-600 font-black text-[10px] tracking-widest uppercase shadow-sm active:scale-95 transition-all">
                                                            <Phone className="w-3.5 h-3.5" />
                                                            <span>{t.callShort || 'CALL'}</span>
                                                        </a>
                                                        <button onClick={() => setManualSmsOpen(true)}
                                                            className="flex items-center justify-center gap-2 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 font-black text-[10px] tracking-widest uppercase hover:bg-blue-500/20 active:scale-95 transition-all">
                                                            <MessageSquare className="w-3.5 h-3.5" />
                                                            <span>SMS</span>
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                                        <div className="p-3 rounded-xl bg-surface/50 border border-border-subtle/50">
                                                            <p className="text-[8px] font-black text-muted tracking-widest opacity-40 uppercase mb-1">{t.remaining}</p>
                                                            <p className="text-lg font-black text-primary tabular-nums tracking-tighter">
                                                                {visitsLeft} <span className="text-[10px] opacity-40 font-bold ml-1">{t.visit}</span>
                                                            </p>
                                                        </div>
                                                        <div className="p-3 rounded-xl bg-surface/50 border border-border-subtle/50">
                                                            <p className="text-[8px] font-black text-muted tracking-widest opacity-40 uppercase mb-1">{t.expiryDate}</p>
                                                            <p className="text-lg font-black text-primary tabular-nums tracking-tighter">
                                                                {daysLeft} <span className="text-[10px] opacity-40 font-bold ml-1">{t.days}</span>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <button onClick={() => setIssueModalOpen(true)}
                                                        className="w-full mt-4 h-11 flex items-center justify-center gap-2 rounded-xl text-white font-black text-[10px] tracking-widest uppercase shadow-lg active:scale-95 transition-all"
                                                        style={{ 
                                                            backgroundColor: selClass?.color || (selClass?.group_id ? GROUP_COLOR_MAP[selClass.group_id] : null) || '#6d28d9',
                                                            boxShadow: `0 8px 20px -4px ${(selClass?.color || (selClass?.group_id ? GROUP_COLOR_MAP[selClass.group_id] : null) || '#6d28d9')}40`
                                                        }}>
                                                        <PlusCircle className="w-4 h-4" />
                                                        <span>{t.issueSubscription || t.issuePlan}</span>
                                                    </button>
                                                </div>

                                                <div className="flex px-4 pt-2 gap-1 border-b border-border-subtle/50 bg-card/20 flex-shrink-0">
                                                    {[
                                                        { id: 'recent', label: t.visits, icon: CalendarCheck, color: 'indigo' },
                                                        { id: 'subs', label: t.subscriptions, icon: Package, color: 'emerald' },
                                                        { id: 'products', label: t.purchases, icon: ShoppingCart, color: 'rose' }
                                                    ].map(tab => (
                                                        <button key={tab.id} onClick={() => setTab(tab.id as any)}
                                                            className={cn(
                                                                "flex-1 py-4 flex items-center justify-center gap-2 text-[10px] font-black tracking-widest transition-all relative overflow-hidden",
                                                                activeTab === tab.id ? `text-${tab.color}-600` : "text-muted opacity-50 hover:opacity-100"
                                                            )}>
                                                            <tab.icon className="w-3.5 h-3.5" />
                                                            <span>{tab.label}</span>
                                                            {activeTab === tab.id && <div className={cn("absolute bottom-0 left-0 right-0 h-0.5", `bg-${tab.color}-600`)} />}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                                                    {activeTab === 'recent' && (
                                                        <div className="space-y-3 pb-24">
                                                            {getStudentCheckins(selStudent.id).length > 0 ? getStudentCheckins(selStudent.id).map((ch, i) => (
                                                                <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-surface/40 border border-border-subtle/30 group hover:border-[#6d28d9]/30 transition-all">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                                                            style={{ 
                                                                                backgroundColor: `${selClass?.color || (selClass?.group_id ? GROUP_COLOR_MAP[selClass.group_id] : null) || '#6d28d9'}15`,
                                                                                color: selClass?.color || (selClass?.group_id ? GROUP_COLOR_MAP[selClass.group_id] : null) || '#6d28d9'
                                                                            }}>
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
                                                    {activeTab === 'subs' && (
                                                        <div className="space-y-4 pb-24">
                                                            {(subs[selStudent.id] || []).map((sub, idx) => {
                                                                const isExpired = sub.expires_at && new Date(sub.expires_at) < new Date();
                                                                const isActive = sub.status === 'active' && !isExpired;
                                                                return (
                                                                    <div key={idx} className={cn("p-4 rounded-2xl border transition-all", isActive ? "bg-[#6d28d9]/5 border-[#6d28d9]/20 shadow-sm" : "bg-surface/30 border-border-subtle opacity-60")}>
                                                                        <div className="flex justify-between items-start mb-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={cn("text-[9px] font-black tracking-widest", isActive ? "text-emerald-500" : "text-muted")}>{isExpired ? l('ვადაგასულია', 'ИСТЁКШИЙ', 'EXPIRED') : (sub.status === 'active' ? l('აქტიური', 'АКТИВНЫЙ', 'ACTIVE') : (sub.status || "active").toUpperCase())}</span>
                                                                                <span className="text-[9px] font-bold text-muted opacity-40">{formatDate(sub.purchased_at)}</span>
                                                                            </div>
                                                                            <button onClick={async (e) => { 
                                                                                e.stopPropagation(); 
                                                                                if (await confirm(t.confirmDelete)) { 
                                                                                    // Optimistic Update
                                                                                    setSubs(prev => {
                                                                                        const next = { ...prev };
                                                                                        if (next[selStudent.id]) {
                                                                                            next[selStudent.id] = next[selStudent.id].filter(s => s.id !== sub.id);
                                                                                        }
                                                                                        return next;
                                                                                    });
                                                                                    deleteSubscription(selStudent.id, sub.id); 
                                                                                } 
                                                                            }}
                                                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-muted/40 hover:text-red-500 transition-all">
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                        <p className="text-sm font-black text-primary leading-snug mb-3">{sub.plan}</p>
                                                                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border-subtle/20">
                                                                            <div>
                                                                                <p className="text-[8px] font-black text-muted tracking-widest opacity-40 uppercase mb-0.5">{t.expiryDate}</p>
                                                                                <p className="text-xs font-black text-primary tabular-nums">{sub.expires_at ? formatDate(sub.expires_at) : '—'}</p>
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
                                                    {activeTab === 'products' && (
                                                        <div className="space-y-3 pb-24">
                                                            {getStudentSales(selStudent.id).length > 0 ? getStudentSales(selStudent.id).map((sale, i) => (
                                                                <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-surface/40 border border-border-subtle/30 group hover:border-rose-500/30 transition-all">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                                                                            <ShoppingCart className="w-5 h-5" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs font-black text-primary leading-tight">{sale.productName}</p>
                                                                            <p className="text-[10px] font-bold text-muted opacity-60 mt-0.5">{sale.date} · {sale.price}₾</p>
                                                                        </div>
                                                                    </div>
                                                                    <button onClick={async (e) => { e.stopPropagation(); if (await confirm(t.confirmDelete)) { deleteSale(sale.id); setSubs(getSubscriptions()); } }}
                                                                        className="p-2 rounded-xl bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all">
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            )) : <div className="text-center py-12 opacity-30 font-black text-[10px] tracking-widest">{t.noData}</div>}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex-shrink-0 min-h-[40px]" />
                                            </>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
                                    <div className="w-24 h-24 rounded-[2.5rem] bg-surface flex items-center justify-center mb-8 shadow-inner border border-border-subtle">
                                        <Scan className="w-10 h-10 text-[#6d28d9] opacity-50" />
                                    </div>
                                    <p className="text-lg font-black text-primary tracking-tight">{t.scanCard}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Modals */}
                    {selStudent && (
                        <>
                            <ManualSmsModal open={manualSmsOpen} onClose={() => setManualSmsOpen(false)} student={selStudent} studentName={selStudent.full_name} studentPhone={selStudent.phone || ''} />
                            <StudentModal open={editModal} student={selStudent} onClose={() => setEditModal(false)} onSave={(data) => { updateStudent(selStudent.id, data); import('@/lib/student-store').then(mod => setStudentPatches(mod.getStudentPatches())); setEditModal(false); }} />
                            <IssueSubscriptionModal 
                                open={issueModalOpen} 
                                onClose={() => setIssueModalOpen(false)} 
                                initialStudentId={selStudent.id} 
                                defaultType={cls.type === 'individual' ? 'individual' : 'group'}
                                onIssue={(data) => { 
                                    import('@/lib/subscription-store').then(mod => { 
                                        mod.saveSubscription(data.student_id, { ...data, id: `sub_${Date.now()}` } as any); 
                                        setSubs(mod.getSubscriptions()); 
                                    }); 
                                    setIssueModalOpen(false); 
                                }} 
                            />
                        </>
                    )}
                </>
            )}
            </div>
        </PermissionGuard>
    );
}
