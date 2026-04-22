'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, Users, User, Calendar, Phone, ShieldAlert, Heart, ChevronRight, AlertTriangle, SortAsc, BookOpen, X, ChevronDown, Link2, Check, Edit2, Trash2, Zap, AlertCircle, Filter } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useUser } from '@/hooks/useUser';
import { useStudio } from '@/contexts/StudioContext';
import { cn, getInitials, isExpiringSoon, calculateAge, formatDate } from '@/lib/utils';
import { StudentModal } from '@/components/students/StudentModal';
import { getStudents } from '@/lib/student-store';
import { useConfirm } from '@/contexts/ConfirmContext';
import type { Student } from '@/types';

// removed

// removed local INITIAL_STUDENTS

import { getSubscriptions, getSubscription } from '@/lib/subscription-store';
import { getGroups } from '@/lib/group-store';
import type { Group } from '@/lib/group-store';

function StatusBadge({ status, t }: { status: string; t: ReturnType<typeof useT>['t'] }) {
    const cls: Record<string, string> = { active: 'badge-active', expired: 'badge-expired', paused: 'badge-paused' };
    const lbl: Record<string, string> = { active: t.active, expired: t.expired, paused: t.paused };
    return <span className={`${cls[status] ?? ''} px-2 py-0.5 rounded-full text-[10px] font-bold`}>{lbl[status] ?? status}</span>;
}

export default function StudentsPage() {
    const { t, lang } = useT();
    const { user, profile } = useUser();
    const { settings, addToTrash } = useStudio();
    const { confirm } = useConfirm();
    const isDemo = !user || profile?.studio_name === 'Demo Dance Studio' || !profile?.studio_name;

    const [students, setStudents] = useState<Student[]>([]);

    useEffect(() => {
        const load = () => setStudents(getStudents());
        load();
        const events = ['cc_student_update', 'cc_subscription_update'];
        events.forEach(e => window.addEventListener(e, load));
        return () => events.forEach(e => window.removeEventListener(e, load));
    }, [isDemo, settings.activeBranchId]);

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
    const [sortBy, setSortBy] = useState<'none' | 'first_name' | 'last_name' | 'gender'>('none');
    const [groupFilter, setGroupFilter] = useState<string | null>(null);
    const [groups, setGroups] = useState<Group[]>([]);
    const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
    const groupDropdownRef = useRef<HTMLDivElement>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Student | null>(null);

    useEffect(() => {
        setGroups(getGroups());
    }, []);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target as Node)) {
                setGroupDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = students.filter(s => {
        const fullName = s.full_name || '';
        const matchesSearch = fullName.toLowerCase().includes(search.toLowerCase()) ||
            (s.dance_style || '').toLowerCase().includes(search.toLowerCase());

        const sub = getSubscription(s.id);
        const isActive = sub?.status === 'active';
        const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && isActive) || (statusFilter === 'inactive' && !isActive);
        const matchesGender = genderFilter === 'all' || s.gender === genderFilter;

        const st = s as Student & { enrolled_group_ids?: string[]; classes?: string[] };
        const enrolledGroupIds = st.enrolled_group_ids || [];
        // Also check legacy `classes` field: cls1 → g1, cls2 → g2, etc.
        const classesAsGroupIds = (st.classes || []).map((c: string) => {
            const m = c.match(/^cls(\d+)$/);
            return m ? `g${m[1]}` : c;
        });
        const allGroupIds = [...enrolledGroupIds, ...classesAsGroupIds];
        const matchesGroup = !groupFilter || allGroupIds.includes(groupFilter);

        return matchesSearch && matchesStatus && matchesGroup && matchesGender;
    }).sort((a, b) => {
        if (sortBy === 'none') {
            return new Date(b.created_at || parseInt(b.id)).getTime() - new Date(a.created_at || parseInt(a.id)).getTime();
        }
        if (sortBy === 'gender') {
            return (a.gender || '').localeCompare(b.gender || '');
        }
        const nameA = a.full_name || '';
        const nameB = b.full_name || '';
        const valA = sortBy === 'first_name'
            ? (a.first_name || nameA.split(' ')[0] || '')
            : (a.last_name || nameA.split(' ')[1] || nameA.split(' ')[0] || '');
        const valB = sortBy === 'first_name'
            ? (b.first_name || nameB.split(' ')[0] || '')
            : (b.last_name || nameB.split(' ')[1] || nameB.split(' ')[0] || '');
        return valA.localeCompare(valB, 'ka');
    });

    function openAdd() { setEditing(null); setModalOpen(true); }
    function openEdit(s: Student) { setEditing(s); setModalOpen(true); }

    function handleSave(data: Partial<Student>) {
        import('@/lib/student-store').then(async mod => {
            let studentId = data.id || editing?.id;
            
            if (!studentId && (data.first_name || data.last_name)) {
                studentId = mod.generateFormattedStudentId(data.first_name || '', data.last_name || '');
            }
            if (!studentId) studentId = `ST${Date.now().toString().slice(-7)}`;

            // Duplicate check for new students
            if (!editing) {
                const dup = mod.checkDuplicateStudent(data.full_name || '', data.phone || '');
                if (dup) {
                    if (!confirm(`სტუდენტი ამ სახელით ან ნომრით უკვე არსებობს (${dup.full_name}). მაინც გსურთ დამატება?`)) {
                        return;
                    }
                }
            }

            mod.updateStudent(studentId, {
                ...data,
                id: studentId,
                org_id: settings.orgId || 'demo',
                status: 'active',
                created_at: data.created_at || new Date().toISOString()
            }, editing?.id);

            // Refresh local state
            setStudents(mod.getStudents());
            setModalOpen(false);
        });
    }

    async function handleDelete(id: string) {
        if (!await confirm(t.confirmDelete)) return;

        const student = students.find(s => s.id === id);
        if (student) {
            addToTrash({
                id: `trash_${student.id}_${Date.now()}`,
                type: 'student',
                data: student,
                branchId: settings.activeBranchId || 'main'
            });
        }
        import('@/lib/student-store').then(mod => {
            mod.deleteStudent(id);
            if (typeof window !== 'undefined') window.dispatchEvent(new Event('cc_student_update'));
        });
    }

    return (
        <>
            <div className="space-y-8 animate-fade-up max-w-7xl mx-auto pb-10">
                {/* Header / Actions - Responsive Layout */}
                <div className="flex flex-col gap-3 w-full">

                    {/* Top Section: Status & Add */}
                    <div className="flex flex-row items-stretch justify-between gap-2 sm:gap-3 w-full">
                        {/* Row 1 on Mobile: Status Filter */}
                        <div className="flex flex-[3] lg:flex-none w-full lg:w-fit h-12 bg-surface border border-border-subtle p-1 rounded-2xl sm:rounded-[1.25rem] gap-1 shrink-0">
                            {[
                                { id: 'all', label: t.allFilter, icon: Users, activeColor: 'bg-[#6d28d9]', hoverColor: 'hover:text-[#5b21b6]' },
                                { id: 'active', label: t.active, icon: Zap, activeColor: 'bg-[#6d28d9]', hoverColor: 'hover:text-emerald-600' },
                                { id: 'inactive', label: t.expired, icon: AlertCircle, activeColor: 'bg-[#6d28d9]', hoverColor: 'hover:text-rose-600' },
                            ].map(v => (
                                <button key={v.id} onClick={() => setStatusFilter(prev => prev === v.id ? 'all' : v.id as any)}
                                    className={cn(
                                    'flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-1 sm:px-4 h-full rounded-xl text-[9px] sm:text-xs font-black tracking-widest transition-all',
                                    statusFilter === v.id ? cn(v.activeColor, 'text-white') : cn('text-muted hover:bg-surface-hover', v.hoverColor)
                                )}>
                                <v.icon className="w-4 h-4 sm:w-4 sm:h-4 flex-shrink-0" />
                                <span className="hidden sm:inline whitespace-nowrap">{v.label}</span>
                            </button>
                            ))}
                        </div>

                        {/* Add Button */}
                        <div className="flex flex-shrink-0 items-center h-12">
                            <button onClick={openAdd}
                                className="flex-shrink-0 flex items-center justify-center gap-2 bg-[#6d28d9] hover:bg-[#5b21b6] transition-all text-white text-[11px] sm:text-xs font-black tracking-widest w-12 h-12 sm:w-auto px-0 sm:px-6 rounded-[1.25rem] active:scale-95 touch-manipulation">
                                <UserPlus className="w-5 h-5 sm:w-4 sm:h-4 flex-shrink-0" />
                                <span className="hidden sm:inline whitespace-nowrap uppercase">{t.addStudent}</span>
                            </button>
                        </div>
                    </div>

                    {/* Bottom Section: Filter + Search */}
                    <div className="flex flex-row items-stretch justify-between gap-2 sm:gap-3 w-full">

                        {/* Unified Filter Dropdown */}
                        <div className="relative flex flex-shrink-0 h-12" ref={groupDropdownRef}>
                            <button
                                onClick={() => setGroupDropdownOpen(v => !v)}
                                className={cn(
                                    "flex items-center justify-center w-10 sm:w-auto sm:px-4 h-full rounded-2xl sm:rounded-[1.25rem] border border-border-subtle bg-surface transition-all gap-1.5",
                                    groupDropdownOpen || groupFilter ? "bg-violet-500/10 text-violet-600 border-violet-500/30 shadow-sm" : "text-muted hover:bg-surface-hover"
                                )}>
                                <Filter className={cn("w-4 h-4 sm:w-4 sm:h-4 flex-shrink-0", (groupDropdownOpen || groupFilter) ? "text-violet-500" : "text-[#6d28d9]")} />
                                <span className="hidden sm:inline text-[10px] sm:text-xs font-black tracking-widest truncate max-w-[100px]">
                                    {groupFilter ? groups.find(g => g.id === groupFilter)?.name : (t.filterByGroups || 'ფილტრი')}
                                </span>
                            </button>

                            {/* Dropdown Menu */}
                            {groupDropdownOpen && (
                                <div className="absolute left-0 lg:left-auto lg:right-0 top-[calc(100%+6px)] z-50 w-[240px] bg-card border border-border-subtle rounded-2xl shadow-xl overflow-hidden animate-fade-up">
                                    <div className="p-1 space-y-1">
                                        {/* Sort Section */}
                                        <div className="px-3 pt-2 pb-1 text-[10px] font-black text-muted tracking-widest">{'დახარისხება'}</div>
                                        <button onClick={() => { setSortBy('none'); setGroupDropdownOpen(false); }} className={cn("w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between", sortBy === 'none' ? "bg-indigo-50 text-[#5b21b6] dark:bg-[#6d28d9]/10" : "text-muted hover:bg-surface-hover")}>
                                            <span>{'ნაგულისხმევი'}</span>
                                            {sortBy === 'none' && <Check className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => { setSortBy('first_name'); setGroupDropdownOpen(false); }} className={cn("w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between", sortBy === 'first_name' ? "bg-indigo-50 text-[#5b21b6] dark:bg-[#6d28d9]/10" : "text-muted hover:bg-surface-hover")}>
                                            <span>{t.byFirstName}</span>
                                            {sortBy === 'first_name' && <Check className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => { setSortBy('last_name'); setGroupDropdownOpen(false); }} className={cn("w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between", sortBy === 'last_name' ? "bg-indigo-50 text-[#5b21b6] dark:bg-[#6d28d9]/10" : "text-muted hover:bg-surface-hover")}>
                                            <span>{t.byLastName}</span>
                                            {sortBy === 'last_name' && <Check className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => { setSortBy('gender'); setGroupDropdownOpen(false); }} className={cn("w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between", sortBy === 'gender' ? "bg-indigo-50 text-[#5b21b6] dark:bg-[#6d28d9]/10" : "text-muted hover:bg-surface-hover")}>
                                            <span>{t.gender}</span>
                                            {sortBy === 'gender' && <Check className="w-4 h-4" />}
                                        </button>

                                        <div className="h-px bg-border-subtle my-1 mx-2" />

                                        {/* Gender Section */}
                                        <div className="px-3 pt-2 pb-1 text-[10px] font-black text-muted tracking-widest">{t.gender}</div>
                                        <button onClick={() => { setGenderFilter('all'); setGroupDropdownOpen(false); }} className={cn("w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between", genderFilter === 'all' ? "bg-indigo-50 text-[#5b21b6] dark:bg-[#6d28d9]/10" : "text-muted hover:bg-surface-hover")}>
                                            <span>{t.allFilter}</span>
                                            {genderFilter === 'all' && <Check className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => { setGenderFilter(prev => prev === 'male' ? 'all' : 'male'); setGroupDropdownOpen(false); }} className={cn("w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between", genderFilter === 'male' ? "bg-indigo-50 text-[#5b21b6] dark:bg-[#6d28d9]/10" : "text-muted hover:bg-surface-hover")}>
                                            <span>{t.male}</span>
                                            {genderFilter === 'male' && <Check className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => { setGenderFilter(prev => prev === 'female' ? 'all' : 'female'); setGroupDropdownOpen(false); }} className={cn("w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between", genderFilter === 'female' ? "bg-indigo-50 text-[#5b21b6] dark:bg-[#6d28d9]/10" : "text-muted hover:bg-surface-hover")}>
                                            <span>{t.female}</span>
                                            {genderFilter === 'female' && <Check className="w-4 h-4" />}
                                        </button>
                                        
                                        <div className="h-px bg-border-subtle my-1 mx-2" />

                                        {/* Group Section */}
                                        <div className="px-3 pt-2 pb-1 text-[10px] font-black text-muted tracking-widest">{t.group}</div>
                                        <div className="max-h-[160px] overflow-y-auto no-scrollbar pb-1 px-1">
                                            <button
                                                onClick={() => { setGroupFilter(null); setGroupDropdownOpen(false); }}
                                                className={cn("w-full text-left px-3 py-2.5 mb-0.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between", !groupFilter ? "bg-violet-50 text-violet-600 dark:bg-violet-500/10" : "text-muted hover:bg-surface-hover")}>
                                                    <span>{t.allGroups}</span>
                                                    {!groupFilter && <Check className="w-4 h-4" />}
                                            </button>
                                            {groups.map(g => (
                                                <button
                                                    key={g.id}
                                                    onClick={() => { setGroupFilter(prev => prev === g.id ? null : g.id); setGroupDropdownOpen(false); }}
                                                    className={cn("w-full text-left px-3 py-2.5 mb-0.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between", groupFilter === g.id ? "bg-violet-50 text-violet-600 dark:bg-violet-500/10" : "text-muted hover:bg-surface-hover")}>
                                                    <span className="truncate pr-2">{g.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md", groupFilter === g.id ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20" : "bg-surface border border-border-subtle")}>{g.enrolled}</span>
                                                        {groupFilter === g.id && <Check className="w-4 h-4" />}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Search */}
                        <div className="relative flex-1 group h-12">
                            <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/50 group-focus-within:text-[#6d28d9] transition-colors pointer-events-none" />
                            <input type="text" placeholder={t.search} value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full h-full bg-surface border border-border-subtle rounded-2xl sm:rounded-[1.25rem] pl-9 sm:pl-10 pr-4 text-xs sm:text-sm text-primary placeholder:text-muted/30 focus:outline-none focus:border-[#6d28d9]/40 transition-all font-medium" />
                        </div>
                    </div>
                </div>

                {/* Student list */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
                    {filtered.map(student => {
                        const sub = getSubscription(student.id);
                        const certExpiring = student.medical_cert_expires_at ? isExpiringSoon(student.medical_cert_expires_at, 30) : false;
                        const subEndsToday = sub && sub.expires_at === new Date().toISOString().slice(0, 10);

                        return (
                            <div key={student.id}
                                className="group bg-card border-2 border-border-subtle hover:border-[#6d28d9]/40 rounded-[2rem] transition-all duration-300 cursor-pointer overflow-hidden p-5 relative flex flex-col">
                                <div className="flex items-start gap-4">
                                    {/* Avatar */}
                                    <div className="w-14 h-14 rounded-2xl flex-shrink-0 overflow-hidden border-2 border-surface group-hover:border-[#6d28d9]/20 transition-all">
                                        {student.photo_url ? (
                                            <img src={student.photo_url} alt={student.full_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-[#6d28d9] to-[#4338ca] flex items-center justify-center text-sm font-black text-white">
                                                {getInitials(student.full_name)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 mt-0.5">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <h3 className="text-sm font-black text-primary truncate leading-tight group-hover:text-[#5b21b6] transition-colors">{student.full_name}</h3>
                                            {sub && <StatusBadge status={sub.status} t={t} />}
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-[11px] text-muted font-bold opacity-70">
                                                <Phone className="w-3 h-3 opacity-50" />
                                                <span>{student.phone}</span>
                                            </div>
                                            
                                            {(student.gender || student.birth_date) && (
                                                <div className="flex items-center gap-3 pt-0.5 opacity-60">
                                                    {student.gender && (
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-muted uppercase tracking-tighter">
                                                            <User className="w-2.5 h-2.5" />
                                                            {student.gender === 'male' ? t.male : t.female}
                                                        </div>
                                                    )}
                                                    {student.birth_date && (
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-muted uppercase">
                                                            <Calendar className="w-2.5 h-2.5" />
                                                            {formatDate(student.birth_date)} {calculateAge(student.birth_date) !== null && `(${calculateAge(student.birth_date)} ${t.years})`}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Social Links */}
                                            {student.social_links && Object.entries(student.social_links).some(([_, v]) => v) && (
                                                <div className="flex gap-2 items-center pt-1.5">
                                                    {Object.entries(student.social_links).map(([platform, link]) => {
                                                        if (!link) return null;

                                                        const icons: Record<string, { color: string, icon: React.ReactNode }> = {
                                                            facebook: {
                                                                color: 'text-[#6d28d9] bg-[#6d28d9]/10 border-[#6d28d9]/20',
                                                                icon: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                                                            },
                                                            instagram: {
                                                                color: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
                                                                icon: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.17.054 1.805.249 2.227.412.558.217.957.477 1.377.896.419.42.679.819.896 1.377.163.422.358 1.057.412 2.227.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.054 1.17-.249 1.805-.412 2.227-.217.558-.477.957-.896 1.377-.42.419-.819.679-1.377.896-.422.163-1.057.358-2.227.412-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.17-.054-1.805-.249-2.227-.412-.558-.217-.957-.477-1.377-.896-.419-.42-.679-.819-.896-1.377-.163-.422-.358-1.057-.412-2.227-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.054-1.17.249-1.805.412-2.227.217-.558.477-.957.896-1.377.42-.419.819-.679 1.377-.896.422-.163 1.057-.358 2.227-.412 1.266-.058 1.646-.07 4.85-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-1.277.057-2.148.259-2.911.556-.788.306-1.457.715-2.122 1.38-.665.665-1.074 1.334-1.38 2.122-.297.763-.499 1.634-.556 2.911-.058 1.28-.072 1.688-.072 4.947s.014 3.667.072 4.947c.057 1.277.259 2.148.556 2.911.306.788.715 1.457 1.38 2.122.665.665 1.334 1.074 2.122 1.38.763.297 1.634.499 2.911.556 1.28.058 1.688.072 4.947.072s3.667-.014 4.947-.072c1.277-.057 2.148-.259 2.911-.556.788-.306 1.457-.715 2.122-1.38.665-.665 1.074-1.334 1.38-2.122.297-.763.499-1.634.556-2.911.058-1.28.072-1.688.072-4.947s-.014-3.667-.072-4.947c-.057-1.277-.259-2.148-.556-2.911-.306-.788-.715-1.457-1.38-2.122-.665-.665-1.334-1.074-2.122-1.38-.763-.297-1.634-.499-2.911-.556-1.28-.058-1.688-.072-4.947-.072zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.162 6.162 6.162 6.162-2.759 6.162-6.162-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.791-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                                                            },
                                                            telegram: {
                                                                color: 'text-indigo-400 bg-[#6d28d9]/10 border-[#6d28d9]/20',
                                                                icon: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.14-.26.26-.534.26l.195-2.93 5.318-4.803c.231-.205-.05-.319-.36-.113L6.47 13.91l-2.834-.884c-.616-.191-.628-.616.129-.913l11.07-4.262c.512-.191.96.117.859.37z" /></svg>
                                                            },
                                                            whatsapp: {
                                                                color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
                                                                icon: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                                            }
                                                        };

                                                        const p = icons[platform as keyof typeof icons];
                                                        if (!p) return null;

                                                        return (
                                                            <a key={platform} href={link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="group/social">
                                                                <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 border", p.color)}>
                                                                    {p.icon}
                                                                </div>
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {student.dance_style && (
                                                <div className="flex items-center gap-1.5 text-[11px] text-[#6d28d9] font-bold">
                                                    <Heart className="w-3 h-3 opacity-70" />
                                                    <span>{student.dance_style}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions hover */}
                                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                    <button onClick={(e) => { e.stopPropagation(); openEdit(student); }}
                                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-surface border border-border-subtle text-muted hover:text-[#5b21b6] hover:border-[#6d28d9]/40 hover:bg-[#6d28d9]/5 transition-all shadow-sm">
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(student.id); }}
                                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-surface border border-border-subtle text-muted hover:text-red-500 hover:border-red-500/40 hover:bg-red-500/5 transition-all shadow-sm">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Footer info */}
                                <div className="mt-4 pt-4 border-t border-border-subtle/50 flex items-center justify-between">
                                    <div className="flex-1">
                                        {sub && sub.sessions_total !== null ? (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between px-0.5">
                                                    <span className="text-[10px] text-muted font-black tracking-wider opacity-60">{t.remaining}</span>
                                                    <span className="text-[10px] text-primary font-black tabular-nums">
                                                        {sub.sessions_total - sub.sessions_used} / {sub.sessions_total}
                                                    </span>
                                                </div>
                                                <div className="bg-surface rounded-full h-1.5 overflow-hidden shadow-inner border border-border-subtle/20">
                                                    {(() => {
                                                        const remaining = sub.sessions_total - sub.sessions_used;
                                                        const percent = (remaining / sub.sessions_total) * 100;
                                                        return (
                                                            <div
                                                                className={cn(
                                                                    "h-full rounded-full transition-all duration-700 shadow-sm",
                                                                    remaining <= 0 ? "bg-red-500 shadow-red-500/20" :
                                                                        remaining <= 3 ? "bg-gradient-to-r from-red-500 to-amber-500 shadow-amber-500/20" :
                                                                            "bg-gradient-to-r from-[#6d28d9] to-violet-500 shadow-[#6d28d9]/20"
                                                                )}
                                                                style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                                                            />
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-muted font-bold italic opacity-40">{t.noSubscriptionShort}</span>
                                        )}
                                    </div>

                                    {student.medical_cert_expires_at && certExpiring && (
                                        <div className="ml-4 flex-shrink-0">
                                            <span className="bg-amber-500/10 text-amber-600 text-[10px] font-black px-2 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1 animate-pulse">
                                                <ShieldAlert className="w-3 h-3" />{t.certShort}
                                            </span>
                                        </div>
                                    )}

                                    {subEndsToday && (
                                        <div className="ml-4 flex-shrink-0">
                                            <span className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-lg border border-red-600 flex items-center gap-1 animate-bounce shadow-lg shadow-red-500/20">
                                                <AlertTriangle className="w-3 h-3" />{t.expiresTodayShort}
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
                            <p className="text-xs font-medium mt-1">{t.tryAnotherSearch}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Student modal */}
            <StudentModal
                open={modalOpen}
                student={editing}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                onDelete={handleDelete}
            />
        </>
    );
}
