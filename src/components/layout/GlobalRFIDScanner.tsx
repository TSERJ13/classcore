'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { getStudents, lookupByUid } from '@/lib/student-store';
import { getSubscriptions, getSubscription, incrementSessionsUsed } from '@/lib/subscription-store';
import { recordCheckin, refundCheckin, hasCheckinToday, getSessionsRemaining } from '@/lib/checkin-store';
import { getLocalISODate, cn, getInitials } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';
import { X, CheckCircle, AlertTriangle, Info, Plus, Check } from 'lucide-react';
import { useStudio } from '@/contexts/StudioContext';

export function GlobalRFIDScanner() {
    const pathname = usePathname();
    const { t, lang } = useT();
    const { settings } = useStudio();
    
    const rfidBuffer = useRef('');
    const rfidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const [popup, setPopup] = useState<{
        studentId: string;
        studentName: string;
        photo?: string;
        phase: 'info' | 'success' | 'expired' | 'confirm_undo';
        message?: string;
        sessionsRemaining?: number;
        planName?: string;
        isMonthly?: boolean;
        totalSessions?: number;
        usedSessions?: number;
    } | null>(null);

    const closePopup = useCallback(() => setPopup(null), []);

    const processGlobalScan = useCallback((code: string) => {
        if (pathname?.includes('/attendance')) return;
        
        const clean = code.toUpperCase().replace(/[:\-\s]/g, '').trim();
        if (!clean) return;

        let studentId = lookupByUid(clean)?.studentId ?? null;
        if (!studentId) {
            const students = getStudents();
            const student = students.find(s => (s.card_uid || '').toUpperCase().replace(/[:\-\s]/g, '') === clean);
            studentId = student?.id ?? null;
        }

        const student = studentId ? getStudents().find(s => s.id === studentId) : null;
        if (student && studentId) {
            const todayStr = getLocalISODate();
            const allSubs = getSubscriptions()[studentId] || [];
            const activeSubs = allSubs.filter(s => s.status === 'active' && s.expires_at >= todayStr);
            const studentPhoto = (student as any).photo || student.photo_url;
            const isAlreadyCheckedIn = hasCheckinToday(studentId);

            // Get relevant sub
            const sub = activeSubs.length > 0 
                ? activeSubs[0] 
                : allSubs.sort((a, b) => b.expires_at.localeCompare(a.expires_at))[0];

            if (!sub) {
                setPopup({
                    studentId,
                    studentName: student.full_name,
                    photo: studentPhoto,
                    phase: 'expired',
                    message: t.noSubscription || 'No Subscription'
                });
                return;
            }

            const isExpired = sub.status !== 'active' || sub.expires_at < todayStr;
            const sessionsTotal = sub.sessions_total;
            const usedSessions = sub.sessions_used || 0;
            const isMonthly = sub.type === 'monthly';
            const sessionsRemaining = isMonthly ? Infinity : Math.max(0, (sessionsTotal || 0) - usedSessions);

            // Phase 1: Info or Toggle Prep
            if (popup?.studentId !== studentId || (popup?.phase !== 'info' && popup?.phase !== 'confirm_undo')) {
                setPopup({
                    studentId,
                    studentName: student.full_name,
                    photo: studentPhoto,
                    phase: isAlreadyCheckedIn ? 'confirm_undo' : (isExpired ? 'expired' : 'info'),
                    sessionsRemaining,
                    planName: sub.plan || 'Active Plan',
                    isMonthly,
                    totalSessions: sessionsTotal || 0,
                    usedSessions,
                    message: isAlreadyCheckedIn ? (t.alreadyCheckedIn || 'Already Checked In') : (isExpired ? (t.subscriptionExpired || 'Expired') : undefined)
                });

                setTimeout(() => setPopup(curr => curr?.studentId === studentId && (curr?.phase === 'info' || curr?.phase === 'expired' || curr?.phase === 'confirm_undo') ? null : curr), 6000);
                return;
            }

            // Phase 2: Action (Record or Refund)
            if (popup.studentId === studentId) {
                if (popup.phase === 'info' && !isExpired) {
                    recordCheckin(studentId, student.full_name, 'nfc', undefined, undefined, sub.id, todayStr);
                    setPopup(prev => prev ? { 
                        ...prev, 
                        phase: 'success',
                        sessionsRemaining: isMonthly ? Infinity : Math.max(0, sessionsRemaining - 1),
                        usedSessions: usedSessions + 1
                    } : null);
                    setTimeout(() => setPopup(curr => curr?.studentId === studentId && curr?.phase === 'success' ? null : curr), 3000);
                } else if (popup.phase === 'confirm_undo') {
                    refundCheckin(studentId, todayStr);
                    setPopup(null);
                }
            }
        }
    }, [pathname, popup, t]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
            if (e.key === 'Enter') {
                const val = rfidBuffer.current.trim();
                rfidBuffer.current = '';
                if (rfidTimer.current) { clearTimeout(rfidTimer.current); rfidTimer.current = null; }
                if (val) processGlobalScan(val);
                return;
            }
            if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                rfidBuffer.current += e.key;
                if (rfidTimer.current) clearTimeout(rfidTimer.current);
                rfidTimer.current = setTimeout(() => { rfidBuffer.current = ''; }, 120);
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [processGlobalScan]);

    if (!popup) return null;

    const isMonthly = popup.isMonthly;
    const rem = popup.sessionsRemaining ?? 0;
    const noSub = popup.phase === 'expired' && rem <= 0;
    
    const sessionColor = noSub ? 'text-rose-500' : rem <= 2 ? 'text-red-500' : rem === 3 ? 'text-amber-500' : 'text-emerald-500';
    const boxBg = noSub ? 'bg-rose-500/5 border border-rose-500/20' : rem <= 2 ? 'bg-red-500/5 border border-red-500/20' : rem === 3 ? 'bg-amber-500/5 border border-amber-500/20' : 'bg-emerald-500/5 border border-emerald-500/20';
    const barColor = noSub ? 'bg-rose-500' : rem <= 2 ? 'bg-red-500' : rem === 3 ? 'bg-amber-500' : 'bg-emerald-500';
    const percent = isMonthly ? 100 : Math.max(0, Math.min(100, (rem / (popup.totalSessions || 1)) * 100));

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in duration-200" onClick={closePopup}>
            <div className="bg-card w-full max-w-[320px] sm:max-w-sm rounded-[3rem] p-8 shadow-2xl border border-white/5 relative overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                <button onClick={closePopup} className="absolute top-6 right-6 text-muted/40 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                </button>

                <div className="flex justify-center mb-6">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full overflow-hidden bg-surface flex items-center justify-center border-4 border-card shadow-xl z-10 relative">
                            {popup.photo ? (
                                <img src={popup.photo} alt={popup.studentName} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-black text-3xl">
                                    {getInitials(popup.studentName)}
                                </div>
                            )}
                        </div>
                        <div className={cn('absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-4 border-card shadow-lg z-20',
                            popup.phase === 'success' && 'bg-emerald-500',
                            popup.phase === 'expired' && 'bg-rose-500',
                            popup.phase === 'info' && 'bg-blue-500',
                            popup.phase === 'confirm_undo' && 'bg-amber-500'
                        )}>
                            {popup.phase === 'success' && <Check className="w-4 h-4 text-white" strokeWidth={4} />}
                            {popup.phase === 'expired' && <AlertTriangle className="w-4 h-4 text-white" />}
                            {popup.phase === 'info' && <Info className="w-4 h-4 text-white" />}
                            {popup.phase === 'confirm_undo' && <Info className="w-4 h-4 text-white" />}
                        </div>
                    </div>
                </div>

                <div className="text-center mb-6">
                    <h3 className="text-2xl font-black text-primary tracking-tight">{popup.studentName}</h3>
                    <p className={cn('text-[11px] font-black tracking-widest mt-2 px-3 py-1 rounded-full inline-block uppercase',
                        popup.phase === 'success' ? 'text-emerald-600 bg-emerald-500/10' :
                        popup.phase === 'expired' ? 'text-rose-600 bg-rose-500/10' :
                        popup.phase === 'confirm_undo' ? 'text-amber-600 bg-amber-500/10' :
                        'text-blue-600 bg-blue-500/10 animate-pulse'
                    )}>
                        {popup.phase === 'success' ? '✅ ' + (t.attendanceSheet || 'დასწრება') + ' OK' :
                         popup.phase === 'expired' ? '❌ ' + (t.subscriptionExpired || 'ამოწურულია') :
                         popup.phase === 'confirm_undo' ? '⚠️ ' + (t.alreadyCheckedIn || 'უკვე აქაა') :
                         'ℹ️ ' + (t.scanAgainToConfirm || 'კვლავ გაატარეთ')}
                    </p>
                </div>

                <div className={cn('rounded-[2rem] p-5 mb-6 transition-colors', boxBg)}>
                    <div className="flex items-center justify-between mb-2.5">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest mb-0.5 leading-none">
                                {popup.planName || 'Plan'}
                            </span>
                            <span className="text-xs font-bold text-muted opacity-60">
                                {noSub ? (t.noSubscription || 'აბონემენტი არ არის') : `${t.remaining || 'დარჩენილი'} ${isMonthly ? (t.days || 'დღე') : (t.visits || 'ვიზიტი')}`}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {popup.phase === 'success' && <span className="text-xs text-amber-600 font-black animate-bounce">-1</span>}
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

                {(popup.phase === 'info' || popup.phase === 'confirm_undo') && (
                    <p className="text-[10px] font-bold text-muted/40 text-center uppercase tracking-[0.2em] mb-4">
                        {popup.phase === 'confirm_undo' ? (t.scanToUndo || 'კვლავ გაატარეთ გასაუქმებლად') : (t.scanToConfirm || 'კვლავ გაატარეთ დასადასტურებლად')}
                    </p>
                )}

                {popup.phase === 'expired' && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <button className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-[#6d28d9] text-white transition-all active:scale-95 shadow-lg shadow-indigo-500/20 border border-white/10 opacity-50 cursor-not-allowed">
                            <Plus className="w-5 h-5 stroke-[3]" />
                            <span className="text-[9px] font-black tracking-widest uppercase">{t.groupSubscription || 'ჯგუფური'}</span>
                        </button>
                        <button className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-amber-500 text-white transition-all active:scale-95 shadow-lg shadow-amber-500/20 border border-white/10 opacity-50 cursor-not-allowed">
                            <Plus className="w-5 h-5 stroke-[3]" />
                            <span className="text-[9px] font-black tracking-widest uppercase">{t.individualSubscription || 'ინდივიდუალური'}</span>
                        </button>
                        <p className="col-span-2 text-[8px] text-center text-muted font-bold opacity-40 uppercase tracking-tighter mt-1">{t.openAttendanceToIssue || 'გახსენით დასწრება გამოსაწერად'}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

