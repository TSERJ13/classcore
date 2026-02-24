'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, QrCode, ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { recordCheckin } from '@/lib/checkin-store';

// QR code → student lookup (id matches checkin-store INITIAL_SESSIONS keys)
const STUDENT_DB: Record<string, { id: string; name: string; group: string }> = {
    'SF4A3B': { id: '1', name: 'ნინო ბერიძე', group: 'Contemporary Dance' },
    'SF7X9C': { id: '2', name: 'გიორგი კვირიკაშვილი', group: 'Ballet' },
    'SF2M5K': { id: '3', name: 'ანა ჩხეიძე', group: 'Ballet' },
    'SF8R1N': { id: '4', name: 'დავით მეფარიშვილი', group: 'Ballet' },
    'SF3Q6P': { id: '5', name: 'მარიამ ლომიძე', group: 'Ballet' },
    'SF9T2W': { id: '6', name: 'ლუკა ჯავახიშვილი', group: 'Contemporary Dance' },
    'SF5H4V': { id: '7', name: 'სოფო კაციტაძე', group: 'Contemporary Dance' },
    'SF1D8U': { id: '8', name: 'თამო ღვინიაშვილი', group: 'Ballet' },
};

type CheckStatus = 'idle' | 'checking' | 'success' | 'already' | 'error';

export default function CheckInPage({
    searchParams,
}: {
    searchParams: { code?: string };
}) {
    const code = (searchParams.code ?? '').toUpperCase().trim();
    const student = STUDENT_DB[code];

    const [status, setStatus] = useState<CheckStatus>('idle');
    const [time, setTime] = useState('');
    const [sessionsRemaining, setSessionsRemaining] = useState<number | null>(null);

    useEffect(() => {
        if (!code) return;
        setStatus('checking');
        const t = setTimeout(() => {
            if (student) {
                const result = recordCheckin(student.id, student.name, 'qr');
                setTime(new Date().toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' }));
                setSessionsRemaining(result.sessionsRemaining);
                setStatus(result.alreadyCheckedIn ? 'already' : 'success');
            } else {
                setStatus('error');
            }
        }, 800);
        return () => clearTimeout(t);
    }, [code, student]);


    // ─── Idle / no code ───────────────────────────────────────────
    if (!code || status === 'idle') {
        return (
            <CheckInShell>
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <QrCode className="w-10 h-10 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white">QR Check-in</h1>
                        <p className="text-sm text-white/40 mt-1">სტუდიო ClassCore</p>
                    </div>
                    <p className="text-sm text-white/50 max-w-[260px]">
                        QR კოდი სკანეთ სტუდენტის ბარათიდან ან პორტალიდან.
                    </p>
                </div>
            </CheckInShell>
        );
    }

    // ─── Checking ─────────────────────────────────────────────────
    if (status === 'checking') {
        return (
            <CheckInShell>
                <div className="flex flex-col items-center gap-6">
                    <div className="w-20 h-20 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                    <p className="text-white/50 text-sm">მოწმდება...</p>
                </div>
            </CheckInShell>
        );
    }

    // ─── Error ────────────────────────────────────────────────────
    if (status === 'error') {
        return (
            <CheckInShell>
                <div className="flex flex-col items-center gap-5 text-center">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center animate-pulse">
                            <XCircle className="w-12 h-12 text-red-400" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-red-400">კოდი არ მოიძებნა</h2>
                        <p className="text-sm text-white/40 mt-2 font-mono">{code}</p>
                        <p className="text-xs text-white/30 mt-1">სცადეთ კიდევ ერთხელ ან მიმართეთ ადმინს</p>
                    </div>
                    <Link href="/portal" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                        <ArrowLeft className="w-3 h-3" /> პორტალზე დაბრუნება
                    </Link>
                </div>
            </CheckInShell>
        );
    }

    // ─── Already checked in ───────────────────────────────────────
    if (status === 'already') {
        return (
            <CheckInShell>
                <div className="flex flex-col items-center gap-5 text-center">
                    <div className="w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
                        <AlertCircle className="w-12 h-12 text-amber-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-amber-400/70 uppercase tracking-widest mb-1">უკვე შემოსულია</p>
                        <h2 className="text-xl font-black text-white">{student!.name}</h2>
                        <p className="text-sm text-white/40 mt-1">დღეს უკვე დაფიქსირებულია. სესია არ ჩამოიქვია.</p>
                    </div>
                    <Link href="/portal" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                        <ArrowLeft className="w-3 h-3" /> პორტალზე დაბრუნება
                    </Link>
                </div>
            </CheckInShell>
        );
    }

    // ─── Success ──────────────────────────────────────────────────
    return (
        <CheckInShell>
            <div className="flex flex-col items-center gap-5 text-center w-full">
                {/* Big green checkmark with ripple */}
                <div className="relative flex items-center justify-center">
                    <div className="absolute w-28 h-28 rounded-full bg-emerald-500/10 animate-ping" style={{ animationDuration: '1.5s' }} />
                    <div className="w-24 h-24 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                    </div>
                </div>

                {/* Name */}
                <div>
                    <p className="text-xs font-bold text-emerald-400/70 uppercase tracking-widest mb-1">დასწრება დადასტურდა</p>
                    <h2 className="text-2xl font-black text-white">{student!.name}</h2>
                    <p className="text-sm text-white/40 mt-1">{student!.group}</p>
                </div>

                {/* Time, code & session */}
                <div className="w-full bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className="text-white/35">დრო</span>
                        <span className="text-white/70 font-semibold tabular-nums">{time}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-white/35">თარიღი</span>
                        <span className="text-white/70 font-semibold">{new Date().toLocaleDateString('ka-GE')}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-white/35">კოდი</span>
                        <span className="text-white/70 font-mono font-bold">{code}</span>
                    </div>
                    {sessionsRemaining !== null && (
                        <>
                            <div className="h-px bg-white/[0.07]" />
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-white/35">გამოყენებული სესია</span>
                                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">-1</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-white/35">დარჩენილი სესიები</span>
                                <span className={`text-sm font-black ${sessionsRemaining <= 2 ? 'text-red-400' : 'text-emerald-400'
                                    }`}>{sessionsRemaining}</span>
                            </div>
                        </>
                    )}
                </div>

                {sessionsRemaining !== null && sessionsRemaining <= 2 && sessionsRemaining > 0 && (
                    <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center">
                        <p className="text-xs text-amber-400 font-semibold">⚠️ {sessionsRemaining} სესია დარჩა!</p>
                    </div>
                )}
                {sessionsRemaining === 0 && (
                    <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-2.5 text-center">
                        <p className="text-xs text-red-400 font-semibold">სესიები ამოიწურა!</p>
                    </div>
                )}

                <p className="text-xs text-white/25">ეს ფანჯარა შეიძლება დახუროთ</p>
            </div>
        </CheckInShell>
    );
}

function CheckInShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[#0d0d14] flex flex-col items-center justify-center p-6">
            {/* Logo */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
                    <QrCode className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold text-white/60">ClassCore</span>
            </div>
            <div className="w-full max-w-[320px] flex flex-col items-center">
                {children}
            </div>
        </div>
    );
}
