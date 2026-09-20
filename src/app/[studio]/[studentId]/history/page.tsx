'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Clock, CreditCard, ShoppingBag, Calendar, ShieldCheck } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getStudentSubscriptions, type SubscriptionInfo } from '@/lib/subscription-store';
import { useT } from '@/contexts/LanguageContext';
import { getStudents } from '@/lib/student-store';
import { loadSettings, DEFAULT_SETTINGS } from '@/lib/settings-store';
import type { Student } from '@/types';
import { useUser } from '@/hooks/useUser';
import Link from 'next/link';

export default function PaymentHistoryPage() {
    const params = useParams() as { studio: string, studentId: string };
    const studio = (params?.studio || '').toLowerCase();
    const studentId = (params?.studentId || '').toLowerCase();
    const router = useRouter();
    const { t, lang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const [history, setHistory] = useState<SubscriptionInfo[]>([]);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [studentData, setStudentData] = useState<Student | null>(null);

    // Same real-auth gate as the parent [studentId]/page.tsx (docs/tasks.md's
    // Student portal phase) — this sub-route had no gate of its own at all
    // before this, despite showing the same private payment history.
    const { user: authUser, profile: authProfile, loading: authLoading } = useUser();

    useEffect(() => {
        if (!studentId || !studio) return;
        setSettings(loadSettings(studio));
        const subs = getStudentSubscriptions(studentId);
        setHistory([...subs].sort((a, b) => (b.purchased_at || '').localeCompare(a.purchased_at || '')));

        const students = getStudents();
        setStudentData(students.find(s => s.id === studentId) || null);
    }, [studentId, studio]);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="w-20 h-20 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (!authUser) {
        return (
            <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-8 p-6 text-center">
                <div className="w-20 h-20 bg-indigo-500 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/40">
                    <ShieldCheck className="w-10 h-10 text-white" />
                </div>
                <Link href="/login" className="py-4 px-8 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/20 active:scale-95 transition-all">
                    {t.portalLogin}
                </Link>
            </div>
        );
    }

    if (authProfile?.role === 'student' && authProfile?.student_id !== studentId) {
        return (
            <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-8 text-center space-y-6">
                <p className="text-sm font-medium text-muted">{l('ეს არ არის თქვენი გვერდი.', 'Это не ваша страница.', 'This is not your page.')}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-card animate-fade-up max-w-lg mx-auto pb-10 pt-6 px-4 space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="w-10 h-10 rounded-2xl bg-surface border border-border-subtle flex items-center justify-center text-primary hover:bg-surface-hover transition-all shadow-sm"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-xl font-black text-primary tracking-tight">{t.paymentHistory}</h1>
                    <p className="text-[10px] font-bold text-muted tracking-widest opacity-60">{studentData?.full_name}</p>
                </div>
            </div>

            {/* Content */}
            <div className="space-y-4">
                {history.length > 0 ? (
                    history.map(s => (
                        <div key={s.id} className="bg-card border border-border-subtle rounded-3xl p-6 shadow-xl shadow-black/5 hover:border-indigo-500/20 transition-all group">
                            <div className="flex items-center justify-between gap-4 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                                        <CreditCard className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-primary tracking-tight">{s.plan}</p>
                                        <div className="flex items-center gap-1.5 opacity-40">
                                            <Clock className="w-3 h-3 text-muted" />
                                            <p className="text-[9px] font-bold text-muted">{formatDate(s.purchased_at)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-black text-indigo-600 tabular-nums">{formatCurrency(s.amount_paid || 0, settings.currency)}</p>
                                    <p className="text-[9px] font-black text-emerald-500 tracking-widest">{t.success}</p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-border-subtle/50 flex justify-between items-center opacity-60">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5 text-muted" />
                                    <span className="text-[10px] font-bold text-muted">{t.ends}: {formatDate(s.expires_at)}</span>
                                </div>
                                {s.sessions_total && (
                                    <span className="text-[10px] font-black text-indigo-500 tracking-widest">{s.sessions_total} {t.sessions}</span>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-20 text-center space-y-4 opacity-40">
                        <ShoppingBag className="w-12 h-12 mx-auto text-muted stroke-[1]" />
                        <p className="text-sm font-medium italic">{t.historyEmpty}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
