'use client';

import { use } from 'react';
import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Wifi, CreditCard, AlertCircle } from 'lucide-react';
import { recordCheckin } from '@/lib/checkin-store';

// HEX-normalised UID → student lookup (id matches INITIAL_SESSIONS keys in checkin-store)
const NFC_DB: Record<string, { id: string; name: string; group: string }> = {
    '04A32B1C': { id: '1', name: 'ნინო ბერიძე', group: 'Contemporary Dance' },
    '04B71E2D': { id: '2', name: 'გიორგი კვირიკაშვილი', group: 'Ballet' },
    '04C85F3E': { id: '3', name: 'ანა ჩხეიძე', group: 'Ballet' },
    '04D96A4F': { id: '4', name: 'დავით მეფარიშვილი', group: 'Ballet' },
    '04EA7B50': { id: '5', name: 'მარიამ ლომიძე', group: 'Ballet' },
    '04FB8C61': { id: '6', name: 'ლუკა ჯავახიშვილი', group: 'Contemporary Dance' },
    '040C9D72': { id: '7', name: 'სოფო კაციტაძე', group: 'Contemporary Dance' },
    '041DAE83': { id: '8', name: 'თამო ღვინიაშვილი', group: 'Ballet' },
};

// Normalise UID: remove separators, uppercase
function normaliseUid(raw: string) {
    return raw.replace(/[:\-\s]/g, '').toUpperCase();
}

type KioskState = 'waiting' | 'scanning' | 'success' | 'already' | 'error' | 'unsupported';

export default function NfcCheckinPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    // We don't need searchParams for NFC kiosk, just resolve it
    use(searchParams);

    const [state, setState] = useState<KioskState>('waiting');
    const [student, setStudent] = useState<{ name: string; group: string } | null>(null);
    const [time, setTime] = useState('');
    const [uid, setUid] = useState('');
    const [nfcAvailable, setNfcAvailable] = useState<boolean | null>(null);
    const [sessionsRemaining, setSessionsRemaining] = useState<number | null>(null);

    // Check NFC availability on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hasNFC = 'NDEFReader' in window;
            setNfcAvailable(hasNFC);
            if (!hasNFC) setState('unsupported');
        }
    }, []);

    async function startNFCScan() {
        if (!nfcAvailable) return;
        setState('scanning');
        try {
            if (!window.NDEFReader) return;
            const ndef = new window.NDEFReader();
            await ndef.scan();
            ndef.addEventListener('reading', ({ serialNumber }: { serialNumber?: string }) => {
                const normUid = normaliseUid(serialNumber || '');
                setUid(normUid);
                const found = NFC_DB[normUid];
                if (found) {
                    // Record attendance + deduct session
                    const result = recordCheckin(found.id, found.name, 'nfc');
                    setStudent(found);
                    setTime(new Date().toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' }));
                    setSessionsRemaining(result.sessionsRemaining);
                    setState(result.alreadyCheckedIn ? 'already' : 'success');
                } else {
                    setState('error');
                }
                // Auto-reset after 4s
                setTimeout(() => {
                    setState('scanning');
                    setStudent(null);
                    setUid('');
                    setSessionsRemaining(null);
                }, 4000);
            });
        } catch {
            setState('unsupported');
        }
    }

    return (
        <NfcShell>
            {state === 'waiting' && (
                <WaitingState onStart={startNFCScan} nfcAvailable={nfcAvailable ?? false} />
            )}
            {state === 'scanning' && <ScanningState />}
            {state === 'success' && student && (
                <SuccessState student={student} time={time} sessionsRemaining={sessionsRemaining ?? 0} />
            )}
            {state === 'already' && student && (
                <AlreadyCheckedInState student={student} />
            )}
            {state === 'error' && <ErrorState uid={uid} />}
            {state === 'unsupported' && <UnsupportedState />}
        </NfcShell>
    );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function NfcShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-base flex flex-col">
            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-bold text-white/60">StudioFlow · NFC Check-in</span>
                </div>
                <span className="text-[11px] text-white/25 font-mono">
                    {new Date().toLocaleDateString('ka-GE')}
                </span>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="w-full max-w-[340px] flex flex-col items-center">
                    {children}
                </div>
            </div>

            {/* Footer */}
            <div className="text-center pb-6 text-[10px] text-white/15 font-mono">
                NFC Kiosk · Android Chrome Required
            </div>
        </div>
    );
}

function WaitingState({ onStart, nfcAvailable }: { onStart: () => void; nfcAvailable: boolean }) {
    return (
        <div className="flex flex-col items-center gap-6 text-center">
            {/* Pulse ring */}
            <div className="relative flex items-center justify-center">
                <div className="absolute w-40 h-40 rounded-full border-2 border-indigo-500/10 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute w-28 h-28 rounded-full border-2 border-indigo-500/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.4s' }} />
                <div className="w-24 h-24 rounded-full bg-indigo-500/10 border-2 border-indigo-500/30 flex items-center justify-center">
                    <CreditCard className="w-10 h-10 text-indigo-400" />
                </div>
            </div>

            <div>
                <h1 className="text-2xl font-black text-white">NFC Check-in</h1>
                <p className="text-sm text-white/40 mt-1">სტუდიო სტუდენტებისთვის</p>
            </div>

            {nfcAvailable ? (
                <>
                    <button
                        onClick={onStart}
                        className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 active:scale-[0.97] text-white font-bold text-base rounded-2xl transition-all shadow-xl shadow-indigo-500/25"
                    >
                        სკანირება დაწყება
                    </button>
                    <p className="text-xs text-white/30">NFC ბარათი მიათხოვე reader-ს</p>
                </>
            ) : (
                <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center">
                    <p className="text-sm font-semibold text-amber-400">NFC მიუწვდომელია</p>
                    <p className="text-xs text-white/40 mt-1">Android Chrome-ზე გახსენი, ან USB RFID reader გამოიყენე</p>
                </div>
            )}
        </div>
    );
}

function ScanningState() {
    return (
        <div className="flex flex-col items-center gap-8 text-center">
            {/* Animated NFC rings */}
            <div className="relative flex items-center justify-center">
                {[0, 1, 2].map(i => (
                    <div
                        key={i}
                        className="absolute rounded-full border-2 border-indigo-400/30 animate-ping"
                        style={{
                            width: `${80 + i * 40}px`,
                            height: `${80 + i * 40}px`,
                            animationDuration: '1.5s',
                            animationDelay: `${i * 0.3}s`,
                        }}
                    />
                ))}
                <div className="w-20 h-20 rounded-full bg-indigo-500/15 border-2 border-indigo-500/50 flex items-center justify-center">
                    <Wifi className="w-10 h-10 text-indigo-400 animate-pulse" />
                </div>
            </div>

            <div>
                <p className="text-2xl font-black text-white">ბარათი მიათხოვე</p>
                <p className="text-sm text-white/40 mt-2">NFC-ს ელოდება...</p>
            </div>

            <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                    <div
                        key={i}
                        className="w-2 h-2 bg-indigo-400/50 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                    />
                ))}
            </div>
        </div>
    );
}

function SuccessState({ student, time, sessionsRemaining }: {
    student: { name: string; group: string };
    time: string;
    sessionsRemaining: number;
}) {
    return (
        <div className="flex flex-col items-center gap-6 text-center w-full">
            {/* Success ring */}
            <div className="relative flex items-center justify-center">
                <div className="absolute w-32 h-32 rounded-full bg-emerald-500/10 animate-ping" style={{ animationDuration: '1s', animationIterationCount: 1 }} />
                <div className="w-28 h-28 rounded-full bg-emerald-500/15 border-2 border-emerald-500/50 flex items-center justify-center">
                    <CheckCircle2 className="w-14 h-14 text-emerald-400" />
                </div>
            </div>

            <div>
                <p className="text-xs font-bold text-emerald-400/70 uppercase tracking-widest mb-1">დასწრება დადასტურდა</p>
                <h2 className="text-2xl font-black text-white">{student.name}</h2>
                <p className="text-sm text-white/40 mt-1">{student.group}</p>
            </div>

            <div className="w-full bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 space-y-2">
                <div className="flex justify-between text-xs">
                    <span className="text-white/35">დრო</span>
                    <span className="text-white/70 font-semibold tabular-nums">{time}</span>
                </div>
                <div className="flex justify-between text-xs">
                    <span className="text-white/35">თარიღი</span>
                    <span className="text-white/70 font-semibold">{new Date().toLocaleDateString('ka-GE')}</span>
                </div>
                <div className="h-px bg-white/[0.07]" />
                {/* Session deduction */}
                <div className="flex justify-between items-center">
                    <span className="text-xs text-white/35">გამოყენებული სესია</span>
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">-1 სესია</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-xs text-white/35">დარჩენილი სესიები</span>
                    <span className={`text-sm font-black tabular-nums ${sessionsRemaining <= 2 ? 'text-red-400' : 'text-emerald-400'
                        }`}>{sessionsRemaining}</span>
                </div>
            </div>

            {sessionsRemaining <= 2 && sessionsRemaining > 0 && (
                <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-amber-400 font-semibold">⚠️ {sessionsRemaining} სესია დარჩა — ახლი გეტყვი ადმინს!</p>
                </div>
            )}
            {sessionsRemaining === 0 && (
                <div className="w-full bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-red-400 font-semibold">სესიები ამოიწურა! გთხოვ განაახლე აბონიმენტი.</p>
                </div>
            )}

            <p className="text-xs text-white/20">4 წამში შემდეგი...</p>
        </div>
    );
}

function AlreadyCheckedInState({ student }: { student: { name: string; group: string } }) {
    return (
        <div className="flex flex-col items-center gap-6 text-center w-full">
            <div className="w-28 h-28 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
                <AlertCircle className="w-14 h-14 text-amber-400" />
            </div>
            <div>
                <p className="text-xs font-bold text-amber-400/70 uppercase tracking-widest mb-1">უკვე შემოსულია</p>
                <h2 className="text-xl font-black text-white">{student.name}</h2>
                <p className="text-sm text-white/40 mt-1">{student.group}</p>
                <p className="text-xs text-white/30 mt-2">დღეს უკვე დაფიქსირებულია. სესია არ ჩამოიქვია.</p>
            </div>
            <p className="text-xs text-white/20">4 წამში შემდეგი...</p>
        </div>
    );
}

function ErrorState({ uid }: { uid: string }) {
    return (
        <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-28 h-28 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
                <XCircle className="w-14 h-14 text-red-400" />
            </div>
            <div>
                <h2 className="text-xl font-black text-red-400">ბარათი არ მოიძებნა</h2>
                {uid && <p className="text-xs text-white/30 mt-1 font-mono">UID: {uid}</p>}
                <p className="text-xs text-white/30 mt-2">მიმართეთ ადმინს ბარათის დასარეგისტრირებლად</p>
            </div>
            <p className="text-xs text-white/20">3 წამში ხელახლა...</p>
        </div>
    );
}

function UnsupportedState() {
    return (
        <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
                <Wifi className="w-12 h-12 text-amber-400 opacity-50" />
            </div>
            <div>
                <h2 className="text-xl font-black text-amber-400">NFC მიუწვდომელია</h2>
                <p className="text-sm text-white/40 mt-2 max-w-[260px] leading-relaxed">
                    ამ გვერდი საჭიროებს Android Chrome ბრაუზერს NFC-მხარდაჭერით.
                </p>
                <div className="mt-4 bg-white/[0.04] border border-white/[0.07] rounded-xl p-3 text-left">
                    <p className="text-[11px] font-bold text-white/50 mb-2">ალტერნატივა:</p>
                    <ul className="space-y-1 text-xs text-white/35">
                        <li>• USB RFID reader → Attendance გვერდი</li>
                        <li>• QR სკანი → /checkin</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
