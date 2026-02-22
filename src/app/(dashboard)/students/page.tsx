'use client';

import { useState } from 'react';
import { Search, UserPlus, Filter, Users, Phone, Calendar, ShieldAlert, Heart, ChevronRight, Edit2 } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { cn, formatDate, getInitials, isExpiringSoon } from '@/lib/utils';
import { StudentModal } from '@/components/students/StudentModal';
import type { Student } from '@/types';

const MOCK_GROUPS = [
    { id: 'g1', name: 'Contemporary Dance' },
    { id: 'g2', name: 'Ballet' },
    { id: 'g3', name: 'Yoga Beginners' },
    { id: 'g4', name: 'Sports Group A' },
    { id: 'g5', name: 'Fitness Pro' },
];

const INITIAL_STUDENTS: Student[] = [
    { id: '1', org_id: 'demo', full_name: 'ნინო ბერიძე', phone: '555 11 22 33', email: 'nino@gmail.com', dance_style: 'Contemporary', medical_cert_expires_at: '2026-06-01', qr_code: 'SF4A3B', created_at: '2026-01-10' },
    { id: '2', org_id: 'demo', full_name: 'გიორგი კვირიკაშვილი', phone: '577 22 33 44', email: 'giorgi@gmail.com', medical_cert_expires_at: '2026-02-28', qr_code: 'SF7X9C', created_at: '2026-01-12' },
    { id: '3', org_id: 'demo', full_name: 'ანა ჩხეიძე', phone: '598 33 44 55', dance_style: 'Ballet', qr_code: 'SF2M5K', created_at: '2026-01-15' },
    { id: '4', org_id: 'demo', full_name: 'დავით მეფარიშვილი', phone: '511 44 55 66', dance_style: 'Ballet', medical_cert_expires_at: '2026-05-10', qr_code: 'SF8R1N', created_at: '2026-01-18' },
    { id: '5', org_id: 'demo', full_name: 'მარიამ ლომიძე', phone: '555 55 66 77', dance_style: 'Ballet', qr_code: 'SF3Q6P', created_at: '2026-01-20' },
    { id: '6', org_id: 'demo', full_name: 'ლუკა ჯავახიშვილი', phone: '577 66 77 88', qr_code: 'SF9T2W', created_at: '2026-01-22' },
    { id: '7', org_id: 'demo', full_name: 'სოფო კაციტაძე', phone: '599 77 88 99', dance_style: 'Contemporary', qr_code: 'SF5H4V', created_at: '2026-01-25' },
    { id: '8', org_id: 'demo', full_name: 'თამო ღვინიაშვილი', phone: '551 88 99 00', dance_style: 'Ballet', medical_cert_expires_at: '2026-07-01', qr_code: 'SF1D8U', created_at: '2026-01-28' },
];

const SUB_MAP: Record<string, { plan: string; sessions_used: number; sessions_total: number | null; status: string; expires_at: string }> = {
    '1': { plan: '12 გაკვეთილი', sessions_used: 7, sessions_total: 12, status: 'active', expires_at: '2026-03-15' },
    '2': { plan: 'ყოველთვიური', sessions_used: 0, sessions_total: null, status: 'active', expires_at: '2026-02-25' },
    '3': { plan: '8 გაკვეთილი', sessions_used: 8, sessions_total: 8, status: 'expired', expires_at: '2026-02-10' },
    '4': { plan: '12 გაკვეთილი', sessions_used: 3, sessions_total: 12, status: 'active', expires_at: '2026-03-30' },
    '5': { plan: 'ყოველთვიური', sessions_used: 0, sessions_total: null, status: 'paused', expires_at: '2026-03-01' },
    '6': { plan: '20 გაკვეთილი', sessions_used: 5, sessions_total: 20, status: 'active', expires_at: '2026-05-01' },
    '7': { plan: '8 გაკვეთილი', sessions_used: 2, sessions_total: 8, status: 'active', expires_at: '2026-04-15' },
    '8': { plan: '12 გაკვეთილი', sessions_used: 11, sessions_total: 12, status: 'active', expires_at: '2026-03-20' },
};

function StatusBadge({ status, t }: { status: string; t: ReturnType<typeof useT>['t'] }) {
    const cls: Record<string, string> = { active: 'badge-active', expired: 'badge-expired', paused: 'badge-paused' };
    const lbl: Record<string, string> = { active: t.active, expired: t.expired, paused: t.paused };
    return <span className={`${cls[status] ?? ''} px-2 py-0.5 rounded-full text-[10px] font-bold`}>{lbl[status] ?? status}</span>;
}

export default function StudentsPage() {
    const { t } = useT();
    const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Student | null>(null);

    const filtered = students.filter(s =>
        s.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (s.dance_style ?? '').toLowerCase().includes(search.toLowerCase())
    );

    function openAdd() { setEditing(null); setModalOpen(true); }
    function openEdit(s: Student) { setEditing(s); setModalOpen(true); }

    function handleSave(data: Partial<Student>) {
        if (editing) {
            setStudents(prev => prev.map(s => s.id === editing.id ? { ...s, ...data } : s));
        } else {
            const newStudent: Student = {
                id: String(Date.now()),
                org_id: 'demo',
                full_name: data.full_name ?? '',
                phone: data.phone ?? '',
                email: data.email,
                birth_date: data.birth_date,
                notes: data.notes,
                dance_style: data.dance_style,
                partner_name: data.partner_name,
                medical_cert_expires_at: data.medical_cert_expires_at,
                photo_url: data.photo_url,
                qr_code: data.qr_code,
                created_at: new Date().toISOString(),
            };
            setStudents(prev => [newStudent, ...prev]);
        }
    }

    function handleDelete(id: string) {
        setStudents(prev => prev.filter(s => s.id !== id));
    }

    return (
        <>
            <div className="space-y-6 animate-fade-up max-w-6xl mx-auto pb-10">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-primary tracking-tight">{t.students}</h1>
                        <p className="text-sm text-muted font-medium opacity-60">{students.length} {t.allStudents}</p>
                    </div>
                    <button onClick={openAdd}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] transition-all text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl shadow-indigo-600/20 whitespace-nowrap">
                        <UserPlus className="w-4 h-4" />
                        <span>{t.addStudent}</span>
                    </button>
                </div>

                {/* Search & Filter */}
                <div className="flex gap-3">
                    <div className="relative flex-1 min-w-0 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-indigo-500 transition-colors pointer-events-none" />
                        <input type="text" placeholder={t.search} value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-card border border-border-subtle rounded-2xl pl-11 pr-5 py-3 text-sm text-primary placeholder:text-muted/30 focus:outline-none focus:border-indigo-500/60 transition-all shadow-sm" />
                    </div>
                    <button className="flex items-center gap-2 bg-card border border-border-subtle hover:border-indigo-500/30 text-muted hover:text-primary text-xs font-bold px-4 py-3 rounded-2xl transition-all flex-shrink-0 shadow-sm">
                        <Filter className="w-4 h-4" />
                        <span className="hidden sm:inline">{t.filter}</span>
                    </button>
                </div>

                {/* Student list */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
                    {filtered.map(student => {
                        const sub = SUB_MAP[student.id];
                        const certExpiring = student.medical_cert_expires_at ? isExpiringSoon(student.medical_cert_expires_at, 30) : false;

                        return (
                            <div key={student.id}
                                onClick={() => openEdit(student)}
                                className="group bg-card border border-border-subtle hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/5 rounded-3xl transition-all duration-300 cursor-pointer overflow-hidden p-5">
                                <div className="flex items-start gap-4">
                                    {/* Avatar */}
                                    <div className="w-14 h-14 rounded-2xl flex-shrink-0 overflow-hidden shadow-lg border-2 border-surface group-hover:border-indigo-500/20 transition-all">
                                        {student.photo_url ? (
                                            <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-sm font-black text-white">
                                                {getInitials(student.full_name)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 mt-0.5">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <h3 className="text-sm font-black text-primary truncate leading-tight group-hover:text-indigo-600 transition-colors">{student.full_name}</h3>
                                            {sub && <StatusBadge status={sub.status} t={t} />}
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-[11px] text-muted font-bold opacity-70">
                                                <Phone className="w-3 h-3 opacity-50" />
                                                <span>{student.phone}</span>
                                            </div>
                                            {student.dance_style && (
                                                <div className="flex items-center gap-1.5 text-[11px] text-indigo-500 font-bold">
                                                    <Heart className="w-3 h-3 opacity-70" />
                                                    <span>{student.dance_style}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-1 text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ChevronRight className="w-5 h-5" />
                                    </div>
                                </div>

                                {/* Footer info */}
                                <div className="mt-4 pt-4 border-t border-border-subtle/50 flex items-center justify-between">
                                    <div className="flex-1">
                                        {sub && sub.sessions_total !== null ? (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between px-0.5">
                                                    <span className="text-[10px] text-muted font-black uppercase tracking-wider opacity-60">სეანსები</span>
                                                    <span className="text-[10px] text-primary font-black tabular-nums">{sub.sessions_used} / {sub.sessions_total}</span>
                                                </div>
                                                <div className="bg-surface rounded-full h-1.5 overflow-hidden shadow-inner">
                                                    <div className="h-full bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.3)] transition-all duration-500"
                                                        style={{ width: `${(sub.sessions_used / sub.sessions_total!) * 100}%` }} />
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-muted font-bold italic opacity-40">აბონემენტის გარეშე</span>
                                        )}
                                    </div>

                                    {student.medical_cert_expires_at && certExpiring && (
                                        <div className="ml-4 flex-shrink-0">
                                            <span className="bg-amber-500/10 text-amber-600 text-[10px] font-black px-2 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1 animate-pulse">
                                                <ShieldAlert className="w-3 h-3" />ცნობა!
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {filtered.length === 0 && (
                        <div className="col-span-full flex flex-col items-center py-20 text-muted/30">
                            <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
                                <Users className="w-10 h-10 opacity-20" />
                            </div>
                            <p className="text-base font-bold">{t.noData}</p>
                            <p className="text-xs font-medium mt-1">სცადეთ სხვა საძიებო სიტყვა</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Student modal */}
            <StudentModal
                open={modalOpen}
                student={editing}
                orgType="dance"
                groups={MOCK_GROUPS}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                onDelete={handleDelete}
            />
        </>
    );
}
