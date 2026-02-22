'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, ChevronLeft, ChevronRight, Users, Scan, AlertTriangle, CheckCircle2, Search, CalendarCheck, Clock, CheckCheck } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';
import { recordCheckin, forceCheckin, getCheckinCountToday } from '@/lib/checkin-store';
import { lookupByUid } from '@/lib/student-store';

// ─── Data ──────────────────────────────────────────────────────────────────────

const SCHEDULE = [
    { id: 'cls1', time: '09:00–11:00', name: 'Contemporary Dance', teacher: 'ნინო კ.', hall: 'დარბაზი 1', total: 8 },
    { id: 'cls2', time: '11:00–12:00', name: 'Ballet', teacher: 'ანა ბ.', hall: 'დიდი დარბ.', total: 5 },
    { id: 'cls3', time: '13:30–15:00', name: 'Yoga Beginners', teacher: 'გ. მ.', hall: 'სტუდია 2', total: 6 },
    { id: 'cls4', time: '16:00–17:30', name: 'Hip-Hop', teacher: 'დ. ლ.', hall: 'დარბაზი 1', total: 10 },
    { id: 'cls5', time: '18:30–20:00', name: 'Sports Group A', teacher: 'მ. ა.', hall: 'სპ. დარ.', total: 9 },
];

type State = 'present' | 'absent' | 'none';

const STUDENTS_BY_CLASS: Record<string, { id: string; full_name: string }[]> = {
    cls1: [{ id: '1', full_name: 'ნინო ბერიძე' }, { id: '2', full_name: 'გიორგი კვირიკაშვილი' }, { id: '3', full_name: 'ანა ჩხეიძე' }, { id: '5', full_name: 'მარიამ ლომიძე' }, { id: '6', full_name: 'ლუკა ჯავახიშვილი' }, { id: '7', full_name: 'სოფო კაციტაძე' }, { id: '8', full_name: 'თამო ღვინიაშვილი' }, { id: '9', full_name: 'ბეკა ნოზაძე' }],
    cls2: [{ id: '1', full_name: 'ნინო ბერიძე' }, { id: '10', full_name: 'ქეთი ხარებავა' }, { id: '11', full_name: 'სალომე კვაჭაძე' }, { id: '12', full_name: 'ანი ლოლაძე' }, { id: '13', full_name: 'ნათია ტყეშელაშვილი' }],
    cls3: [{ id: '3', full_name: 'ანა ჩხეიძე' }, { id: '14', full_name: 'ირმა ბერეკაშვილი' }, { id: '15', full_name: 'ხათუნა ოდიშელი' }, { id: '16', full_name: 'ელენა კობახიძე' }, { id: '17', full_name: 'ნინო გოგბეძე' }, { id: '18', full_name: 'ლელა ჭიჭინაძე' }],
    cls4: [{ id: '4', full_name: 'დავით მეფარიშვილი' }, { id: '6', full_name: 'ლუკა ჯავახიშვილი' }, { id: '19', full_name: 'ნიკა ბახტაძე' }, { id: '20', full_name: 'გიო ახობაძე' }, { id: '21', full_name: 'სანდრო ჯახელი' }, { id: '22', full_name: 'ვახო მჭედლიძე' }, { id: '23', full_name: 'ლაშა ბიჭიკაშვილი' }, { id: '24', full_name: 'ზოსიმე კვარაცხელია' }, { id: '25', full_name: 'შოთა ნიჟარაძე' }, { id: '26', full_name: 'გელა ხვედელიძე' }],
    cls5: [{ id: '2', full_name: 'გიორგი კვირიკაშვილი' }, { id: '5', full_name: 'მარიამ ლომიძე' }, { id: '8', full_name: 'თამო ღვინიაშვილი' }, { id: '27', full_name: 'ნატო ხოჭოლავა' }, { id: '28', full_name: 'ია ჩიქოვანი' }, { id: '29', full_name: 'ანა გეგეჭკორი' }, { id: '30', full_name: 'თამარ ბუხრიკიძე' }, { id: '31', full_name: 'ეკა კობეშავა' }, { id: '32', full_name: 'ციცი ჩიქვანია' }],
};

const SCAN_MAP: Record<string, string> = {
    'SF4A3B': '1', 'SF7X9C': '2', 'SF2M5K': '3', 'SF8R1N': '4',
    'SF3Q6P': '5', 'SF9T2W': '6', 'SF5H4V': '7', 'SF1D8U': '8',
    '04A32B1C': '1', '04B71E2D': '2', '04C85F3E': '3', '04D96A4F': '4',
};

const ALL_STUDENTS = Object.values(STUDENTS_BY_CLASS).flat().filter((v, i, a) => a.findIndex(x => x.id === v.id) === i);
const AVATAR_COLORS = ['from-indigo-500 to-violet-600', 'from-emerald-500 to-teal-600', 'from-rose-500 to-pink-600', 'from-amber-500 to-orange-600'];
function avatarColor(id: string) { return AVATAR_COLORS[parseInt(id) % AVATAR_COLORS.length]; }

// ─── Popup ─────────────────────────────────────────────────────────────────────

type PopupPhase = 'success' | 'confirm' | 'double-success';
interface PopupData { studentId: string; studentName: string; sessionsRemaining: number; checkinCount: number; phase: PopupPhase; }

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

function ScanPopup({ data, onClose, onConfirm }: { data: PopupData; onClose: () => void; onConfirm: () => void; }) {
    const autoClose = data.phase === 'success' || data.phase === 'double-success';
    const secs = data.phase === 'double-success' ? 3 : 4;
    const countdown = useCountdown(autoClose, secs, onClose);
    const progress = autoClose ? (countdown / secs) * 100 : 100;

    return (
        <>
            <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={autoClose ? onClose : undefined} />
            <div className="fixed inset-x-0 bottom-0 z-[70] flex justify-center pb-6 px-4 items-center sm:inset-0 sm:pb-0 animate-in fade-in zoom-in-95 duration-200">
                <div className={cn(
                    'w-full max-w-sm rounded-[2.5rem] border shadow-2xl overflow-hidden bg-card',
                    data.phase === 'success' && 'border-emerald-500/30 shadow-emerald-500/10',
                    data.phase === 'confirm' && 'border-amber-500/30 shadow-amber-500/10',
                    data.phase === 'double-success' && 'border-indigo-500/30 shadow-indigo-500/10',
                )}>
                    {autoClose && (
                        <div className="h-1 bg-surface relative overflow-hidden">
                            <div className={cn('h-full transition-all ease-linear', data.phase === 'success' ? 'bg-emerald-500' : 'bg-indigo-500')}
                                style={{ width: `${progress}%`, transitionDuration: '1s' }} />
                        </div>
                    )}
                    <div className="p-8">
                        <div className="flex justify-center mb-6">
                            <div className="relative">
                                <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${avatarColor(data.studentId)} flex items-center justify-center text-white text-3xl font-black shadow-xl`}>
                                    {getInitials(data.studentName)}
                                </div>
                                <div className={cn('absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-4 border-card',
                                    data.phase === 'success' && 'bg-emerald-500',
                                    data.phase === 'confirm' && 'bg-amber-500',
                                    data.phase === 'double-success' && 'bg-indigo-500',
                                )}>
                                    {data.phase === 'success' && <Check className="w-4 h-4 text-white" strokeWidth={4} />}
                                    {data.phase === 'confirm' && <AlertTriangle className="w-4 h-4 text-white" strokeWidth={3} />}
                                    {data.phase === 'double-success' && <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={3} />}
                                </div>
                            </div>
                        </div>
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-black text-primary tracking-tight">{data.studentName}</h2>
                            {data.phase === 'success' && <><p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mt-2 bg-emerald-500/10 px-3 py-1 rounded-full inline-block">✅ დასწრება OK</p></>}
                            {data.phase === 'confirm' && <p className="text-[11px] font-black text-amber-600 uppercase tracking-widest mt-2 bg-amber-500/10 px-3 py-1 rounded-full inline-block">⚠️ უკვე შემოსულია</p>}
                            {data.phase === 'double-success' && <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mt-2 bg-indigo-500/10 px-3 py-1 rounded-full inline-block">✅ ×2 მეორე ვიზიტი</p>}
                        </div>
                        <div className={cn('rounded-2xl p-4 mb-6 flex items-center justify-between shadow-inner', data.sessionsRemaining <= 2 ? 'bg-red-500/5 border border-red-500/20' : 'bg-surface border border-border-subtle')}>
                            <span className="text-xs font-bold text-muted opacity-60">დარჩენილი სესიები</span>
                            <div className="flex items-center gap-2">
                                {(data.phase === 'success' || data.phase === 'double-success') && <span className="text-[10px] text-amber-600 font-black">-1</span>}
                                <span className={cn('text-xl font-black tabular-nums', data.sessionsRemaining <= 2 ? 'text-red-500' : 'text-emerald-500')}>{data.sessionsRemaining}</span>
                            </div>
                        </div>
                        {data.phase === 'confirm' ? (
                            <div className="space-y-3">
                                <p className="text-xs text-center text-muted font-medium mb-4">დავაფიქსიროთ კიდევ ერთი ვიზიტი?</p>
                                <button onClick={onConfirm} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white font-black text-sm rounded-2xl transition-all shadow-xl shadow-indigo-600/20">დიახ, დაფიქსირება</button>
                                <button onClick={onClose} className="w-full py-3 bg-surface hover:bg-surface/80 text-muted font-bold text-sm rounded-2xl transition-all">გამოტოვება</button>
                            </div>
                        ) : (
                            <button onClick={onClose} className="w-full py-3.5 bg-surface hover:bg-surface/80 text-muted font-bold text-sm rounded-2xl transition-all">
                                დახურვა ({countdown}s)
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
    const { lang } = useT();
    const [date, setDate] = useState(new Date());
    const [selectedClass, setSelectedClass] = useState(SCHEDULE[0].id);
    const [att, setAtt] = useState<Record<string, State>>({});
    const [qrInput, setQrInput] = useState('');
    const [flash, setFlash] = useState<string | null>(null);
    const [scanError, setScanError] = useState('');
    const [popup, setPopup] = useState<PopupData | null>(null);
    const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const qrRef = useRef<HTMLInputElement>(null);
    const rfidBuffer = useRef('');
    const rfidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cls = SCHEDULE.find(s => s.id === selectedClass)!;
    const students = STUDENTS_BY_CLASS[selectedClass] || [];
    const filtered = students.filter(s => !search || s.full_name.toLowerCase().includes(search.toLowerCase()));

    const presentCount = students.filter(s => att[s.id] === 'present').length;
    const absentCount = students.filter(s => att[s.id] === 'absent').length;
    const selStudent = selectedStudent ? students.find(s => s.id === selectedStudent) : null;

    useEffect(() => { qrRef.current?.focus(); }, []);
    const closePopup = useCallback(() => { setPopup(null); setTimeout(() => qrRef.current?.focus(), 50); }, []);

    const confirmDouble = useCallback(() => {
        if (!popup) return;
        const result = forceCheckin(popup.studentId, popup.studentName, 'manual');
        setAtt(p => ({ ...p, [popup.studentId]: 'present' }));
        setPopup({ ...popup, sessionsRemaining: result.sessionsRemaining, checkinCount: popup.checkinCount + 1, phase: 'double-success' });
    }, [popup]);

    const processCode = useCallback((code: string) => {
        if (popup?.phase === 'confirm') return;
        const clean = code.toUpperCase().replace(/[:\-\s]/g, '').trim();
        if (!clean) return;

        let studentId = lookupByUid(clean)?.studentId ?? null;
        let studentName = lookupByUid(clean)?.studentName ?? null;

        if (!studentId) {
            studentId = SCAN_MAP[clean] ?? null;
            if (studentId) studentName = ALL_STUDENTS.find(x => x.id === studentId)?.full_name ?? null;
        }

        if (studentId && studentName) {
            const checkinCount = getCheckinCountToday(studentId);
            const result = recordCheckin(studentId, studentName, 'manual');
            setAtt(p => ({ ...p, [studentId!]: 'present' }));
            setScanError('');
            setFlash(studentId);
            setSelectedStudent(studentId);
            setTimeout(() => setFlash(null), 2500);
            setQrInput('');
            if (result.alreadyCheckedIn) {
                setPopup({ studentId, studentName, sessionsRemaining: result.sessionsRemaining, checkinCount, phase: 'confirm' });
            } else {
                setPopup({ studentId, studentName, sessionsRemaining: result.sessionsRemaining, checkinCount: checkinCount + 1, phase: 'success' });
            }
        } else {
            setScanError(`UID/კოდი არ მოიძებნა`);
            setTimeout(() => setScanError(''), 3000);
            setQrInput('');
        }
    }, [popup]);

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

    function toggle(id: string) {
        setAtt(p => {
            const cur = p[id] ?? 'none';
            return { ...p, [id]: cur === 'none' ? 'present' : cur === 'present' ? 'absent' : 'none' };
        });
    }

    const dateStr = date.toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
    function isCurrentClass(time: string) { const h = parseInt(time.split(':')[0]); const ch = new Date().getHours(); return h <= ch && h + 2 > ch; }

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] -m-4 md:-m-8 bg-card animate-fade-up overflow-hidden">
            {popup && <ScanPopup data={popup} onClose={closePopup} onConfirm={confirmDouble} />}

            {/* Header / Scan Bar */}
            <div className={cn(
                'flex items-center gap-4 px-6 py-4 border-b group transition-all duration-500',
                scanError ? 'bg-red-500/5' : flash ? 'bg-emerald-500/5' : 'bg-card'
            )}>
                <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all shadow-inner', flash ? 'bg-emerald-500 text-white' : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20')}>
                    <Scan className="w-5 h-5" />
                </div>
                <div className="flex-1 relative">
                    <input ref={qrRef} value={qrInput} onChange={e => setQrInput(e.target.value)}
                        placeholder="ბარათის წაკითხვა..."
                        className="w-full bg-transparent text-lg font-bold text-primary placeholder:text-muted/20 outline-none" />
                    {scanError && <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-bold text-red-500 bg-red-500/10 px-3 py-1 rounded-full animate-bounce">{scanError}</span>}
                </div>
                <div className="hidden md:flex items-center gap-3 bg-surface px-4 py-2 rounded-2xl border border-border-subtle shadow-sm">
                    <CalendarCheck className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-black text-primary uppercase tracking-wider">{dateStr}</span>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: Schedule */}
                <div className="w-64 border-r border-border-subtle bg-surface/30 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-border-subtle/50">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted opacity-40">განრიგი</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {SCHEDULE.map(s => {
                            const isCurrent = isCurrentClass(s.time);
                            const isActive = selectedClass === s.id;
                            return (
                                <button key={s.id} onClick={() => setSelectedClass(s.id)}
                                    className={cn(
                                        'w-full text-left p-4 rounded-2xl transition-all group border shadow-sm relative overflow-hidden',
                                        isActive
                                            ? 'border-transparent shadow-xl scale-[1.02] z-10'
                                            : 'bg-card border-border-subtle hover:bg-surface hover:border-border-subtle/50'
                                    )}
                                    style={isActive ? { backgroundColor: 'hsla(var(--accent), 0.5)', color: '#fff' } : undefined}>
                                    <h3 className={cn(
                                        'text-sm font-black truncate leading-tight transition-colors',
                                        isActive ? 'text-white' : 'text-primary'
                                    )}>{s.name}</h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Clock className={cn(
                                            'w-3 h-3 transition-colors',
                                            isActive ? 'text-white/60' : isCurrent ? 'text-emerald-500' : 'text-muted opacity-40'
                                        )} />
                                        <span className={cn(
                                            'text-[10px] font-black tabular-nums transition-colors',
                                            isActive ? 'text-white/80' : isCurrent ? 'text-emerald-600' : 'text-muted'
                                        )}>{s.time}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-3">
                                        <span className={cn(
                                            'text-[9px] font-bold uppercase tracking-tight truncate max-w-[100px] transition-colors',
                                            isActive ? 'text-white/60' : 'text-muted opacity-50'
                                        )}>{s.teacher}</span>
                                        {isCurrent && (
                                            <span className={cn(
                                                'w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]',
                                                isActive ? 'bg-white shadow-white/50' : 'bg-emerald-500'
                                            )} />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Middle Panel: Student List */}
                <div className="w-full md:w-[560px] flex flex-col bg-card overflow-hidden border-r border-border-subtle">
                    <div className="p-6 border-b border-border-subtle/50 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black text-primary tracking-tight">{cls.name}</h2>
                                <p className="text-xs font-bold text-muted opacity-60 mt-0.5">{cls.time} · {cls.teacher}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { const n: Record<string, State> = { ...att }; students.forEach(s => n[s.id] = 'present'); setAtt(n); }} className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[10px] font-black uppercase tracking-wider hover:bg-emerald-500/20 shadow-sm transition-all">დამსწრე</button>
                                <button onClick={() => { const n: Record<string, State> = { ...att }; students.forEach(s => n[s.id] = 'absent'); setAtt(n); }} className="px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 text-[10px] font-black uppercase tracking-wider hover:bg-red-500/20 shadow-sm transition-all">არ არის</button>
                            </div>
                        </div>
                        <div className="relative group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-indigo-500 transition-colors" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="მოსწავლის ძებნა..."
                                className="w-full bg-surface border border-border-subtle rounded-2xl pl-10 pr-4 py-3 text-sm font-bold text-primary placeholder:text-muted/20 outline-none focus:border-indigo-500/60 transition-all shadow-inner" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-border-subtle">
                        {filtered.map(st => {
                            const state = att[st.id] ?? 'none';
                            const isSel = selectedStudent === st.id;
                            const isFl = flash === st.id;
                            return (
                                <button key={st.id} onClick={() => { setSelectedStudent(isSel ? null : st.id); toggle(st.id); }}
                                    className={cn(
                                        'w-full flex items-center gap-4 p-4 rounded-3xl transition-all group border shadow-sm',
                                        isFl ? 'bg-emerald-500/5 border-emerald-500/20' :
                                            isSel ? 'bg-indigo-50/50 border-indigo-200 shadow-indigo-500/5' :
                                                'bg-card border-border-subtle hover:bg-surface/50 hover:border-border-subtle/50'
                                    )}>
                                    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarColor(st.id)} flex items-center justify-center shadow-lg border-2 border-surface group-hover:scale-110 transition-transform`}>
                                        <span className="text-[11px] font-black text-white">{getInitials(st.full_name)}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={cn('text-sm font-black truncate leading-tight', state === 'present' ? 'text-emerald-600' : state === 'absent' ? 'text-red-500' : 'text-primary')}>{st.full_name}</p>
                                        <p className="text-[10px] font-bold text-muted opacity-40 mt-1 uppercase tracking-wider">{cls.name}</p>
                                    </div>
                                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all shadow-sm', state === 'present' ? 'bg-emerald-500 border-emerald-500' : state === 'absent' ? 'bg-red-500 border-red-500' : 'border-border-subtle bg-surface')}>
                                        {state === 'present' && <Check className="w-4 h-4 text-white" strokeWidth={4} />}
                                        {state === 'absent' && <X className="w-4 h-4 text-white" strokeWidth={4} />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel: Student Profile */}
                <div className="flex-1 min-w-[400px] bg-surface/30 flex flex-col overflow-hidden">
                    {selStudent ? (
                        <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
                            <div className="p-8 flex flex-col items-center text-center border-b border-border-subtle/50 bg-card/40">
                                <div className={`w-28 h-28 rounded-[2.5rem] bg-gradient-to-br ${avatarColor(selStudent.id)} flex items-center justify-center text-white text-4xl font-black shadow-2xl mb-6 border-4 border-card`}>
                                    {getInitials(selStudent.full_name)}
                                </div>
                                <h2 className="text-xl font-black text-primary tracking-tight leading-tight">{selStudent.full_name}</h2>
                                <p className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] mt-2 opacity-80">{cls.name}</p>
                                {(() => {
                                    const state = att[selStudent.id] ?? 'none';
                                    return (
                                        <div className={cn('mt-6 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border shadow-sm', state === 'present' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : state === 'absent' ? 'bg-red-500/10 border-red-500/30 text-red-600' : 'bg-surface border-border-subtle text-muted opacity-60')}>
                                            {state === 'present' ? 'დამსწრე' : state === 'absent' ? 'არ არის' : 'აღურიცხავი'}
                                        </div>
                                    );
                                })()}
                            </div>
                            <div className="p-6 grid grid-cols-2 gap-3 border-b border-border-subtle/50">
                                <div className="bg-card border border-border-subtle rounded-2xl p-4 text-center shadow-sm">
                                    <p className="text-2xl font-black text-primary tabular-nums">8</p>
                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest mt-1 opacity-40">სესია</p>
                                </div>
                                <div className="bg-card border border-border-subtle rounded-2xl p-4 text-center shadow-sm">
                                    <p className="text-2xl font-black text-primary tabular-nums">12</p>
                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest mt-1 opacity-40">სულ</p>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] opacity-30">ბოლო დასწრებები</p>
                                <div className="space-y-3">
                                    {['20.02.2026 · 09:10', '16.02.2026 · 11:45', '11.02.2026 · 09:05'].map((v, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-surface/50 border border-border-subtle/50">
                                            <CalendarCheck className="w-4 h-4 text-indigo-500 opacity-60" />
                                            <span className="text-[11px] font-bold text-muted">{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-40 group">
                            <div className="w-20 h-20 rounded-[2rem] bg-surface flex items-center justify-center mb-6 shadow-inner border border-border-subtle group-hover:scale-110 transition-transform">
                                <Scan className="w-8 h-8 text-indigo-500 opacity-50" />
                            </div>
                            <p className="text-sm font-black text-primary tracking-tight">ბარათი მიადეთ</p>
                            <p className="text-[10px] font-bold text-muted mt-2 max-w-[160px] leading-relaxed uppercase tracking-wider">ელოდება RFID ან QR კოდის სკანირებას</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
