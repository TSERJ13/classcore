'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { getStudents, lookupByUid } from '@/lib/student-store';
import { getSubscriptions, getSubscription, incrementSessionsUsed } from '@/lib/subscription-store';
import { recordCheckin, getCheckinCountToday, getSessionsRemaining } from '@/lib/checkin-store';
import { getLocalISODate } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';
import { X, CheckCircle, AlertTriangle, Info, CalendarCheck, MapPin } from 'lucide-react';
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
        phase: 'info' | 'success' | 'expired';
        message?: string;
        sessionsRemaining?: number;
        planName?: string;
    } | null>(null);

    const closePopup = useCallback(() => setPopup(null), []);

    const processGlobalScan = useCallback((code: string) => {
        // If on attendance page, let the local scanner handle it
        if (pathname?.includes('/attendance')) return;
        
        const clean = code.toUpperCase().replace(/[:\-\s]/g, '').trim();
        if (!clean) return;

        let studentId = lookupByUid(clean)?.studentId ?? null;
        
        if (!studentId) {
            const students = getStudents();
            const student = students.find(s => s.card_uid?.toUpperCase().replace(/[:\-\s]/g, '') === clean);
            studentId = student?.id ?? null;
        }

        const student = studentId ? getStudents().find(s => s.id === studentId) : null;

        if (student && studentId) {
            const todayStr = getLocalISODate();
            const subs = getSubscriptions()[studentId] || [];
            const activeSubs = subs.filter(s => s.status === 'active' && s.expires_at >= todayStr);

            // 1. No Active Subscription -> Expired Popup
            if (activeSubs.length === 0) {
                setPopup({
                    studentId,
                    studentName: student.full_name,
                    photo: student.photo_url,
                    phase: 'expired',
                    message: lang === 'ka' ? 'აბონემენტი ამოწურულია' : lang === 'ru' ? 'Абонемент истек' : 'Subscription Expired'
                });
                setTimeout(() => setPopup(curr => curr?.studentId === studentId && curr?.phase === 'expired' ? null : curr), 5000);
                return;
            }

            // 2. Info Phase (First Scan)
            if (popup?.studentId !== studentId || popup?.phase !== 'info') {
                const sub = activeSubs[0]; // Take the first active sub globally
                setPopup({
                    studentId,
                    studentName: student.full_name,
                    photo: student.photo_url,
                    phase: 'info',
                    sessionsRemaining: sub.type === 'monthly' || sub.sessions_total === null ? Infinity : Math.max(0, sub.sessions_total - (sub.sessions_used || 0)),
                    planName: sub.plan || 'Active Plan'
                });

                // Clear after 5 seconds if no second scan
                setTimeout(() => setPopup(curr => curr?.studentId === studentId && curr?.phase === 'info' ? null : curr), 5000);
                return;
            }

            // 3. Success Phase (Second Scan within 5s)
            if (popup?.phase === 'info' && popup.studentId === studentId) {
                // Deduct visit
                recordCheckin(studentId, student.full_name, 'nfc', undefined, undefined, activeSubs[0].id, todayStr);
                
                // Fire events to update global UI
                window.dispatchEvent(new Event('cc_attendance_update'));
                window.dispatchEvent(new Event('cc_subscription_update'));

                setPopup(prev => prev ? { ...prev, phase: 'success' } : null);

                // Auto close after 3 seconds
                setTimeout(() => setPopup(curr => curr?.studentId === studentId && curr?.phase === 'success' ? null : curr), 3000);
            }
        }
    }, [pathname, popup, lang]);

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

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-white/10 relative overflow-hidden text-center animate-in zoom-in-95 duration-300">
                <button onClick={closePopup} className="absolute top-6 right-6 text-muted hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                </button>

                {/* Status Icon Header */}
                <div className="flex justify-center mb-6 relative">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full overflow-hidden bg-surface flex items-center justify-center border-4 border-card shadow-xl z-10 relative">
                            {popup.photo ? (
                                <img src={popup.photo} alt={popup.studentName} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black text-3xl">
                                    {popup.studentName.charAt(0)}
                                </div>
                            )}
                        </div>
                        {/* Phase Badges */}
                        {popup.phase === 'success' && (
                            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2 rounded-full border-4 border-card shadow-lg z-20 animate-in zoom-in">
                                <CheckCircle className="w-6 h-6" />
                            </div>
                        )}
                        {popup.phase === 'expired' && (
                            <div className="absolute -bottom-2 -right-2 bg-rose-500 text-white p-2 rounded-full border-4 border-card shadow-lg z-20 animate-in zoom-in">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                        )}
                        {popup.phase === 'info' && (
                            <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white p-2 rounded-full border-4 border-card shadow-lg z-20 animate-pulse">
                                <Info className="w-6 h-6" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <h3 className="text-2xl font-black text-primary mb-1 tracking-tight">{popup.studentName}</h3>
                
                {popup.phase === 'expired' && (
                    <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500">
                        <p className="font-black text-lg tracking-widest">{popup.message}</p>
                    </div>
                )}

                {popup.phase === 'info' && (
                    <div className="mt-6 space-y-4">
                        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                            <p className="text-sm font-bold opacity-80 mb-1">{popup.planName}</p>
                            <p className="text-3xl font-black tabular-nums tracking-tighter">
                                {popup.sessionsRemaining === Infinity ? '∞' : popup.sessionsRemaining} <span className="text-sm opacity-60 font-bold tracking-widest">დარჩენილი</span>
                            </p>
                        </div>
                        <p className="text-xs font-bold text-muted animate-pulse">
                            {lang === 'ka' ? 'კიდევ ერთხელ გაატარეთ დასადასტურებლად' : 'Scan again to confirm'}
                        </p>
                    </div>
                )}

                {popup.phase === 'success' && (
                    <div className="mt-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                        <p className="font-black text-lg tracking-widest uppercase">ვიზიტი დაფიქსირდა!</p>
                        <p className="text-sm font-bold mt-1 opacity-80">
                            {popup.sessionsRemaining === Infinity ? '∞' : popup.sessionsRemaining} <span className="opacity-60">დარჩენილი</span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
