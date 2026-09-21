'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import {
    UserPlus, Phone, Users, User, BookOpen,
    Edit2, Zap, MessageSquare,
    Send, Clock, Check, X as XIcon
} from 'lucide-react';
import { cn, getInitials, formatCurrency } from '@/lib/utils';
import { MobileFAB } from '@/components/ui/MobileFAB';
import { TeacherModal } from '@/components/teachers/TeacherModal';
import { InviteTeacherModal } from '@/components/teachers/InviteTeacherModal';
import { ConfirmInviteModal } from '@/components/teachers/ConfirmInviteModal';
import { useT } from '@/contexts/LanguageContext';
import { useStudio } from '@/contexts/StudioContext';
import type { Teacher } from '@/types';
import { getGroups, saveGroups } from '@/lib/group-store';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { getPendingStaffInvitesAction, revokeStaffInviteAction, type StaffInviteRow } from '@/app/actions/staff-invites';
import { addNotification } from '@/lib/notification-store';



export default function TeachersPage() {
    const { t, lang } = useT();
    const { settings, addStaff, updateStaff, removeStaff } = useStudio();
    const { user, profile } = useUser();
    
    const [groups, setGroups] = useState(getGroups());
    useEffect(() => {
        const load = () => setGroups(getGroups());
        window.addEventListener('cc_groups_update', load);
        return () => window.removeEventListener('cc_groups_update', load);
    }, []);

    const GROUP_MAP = Object.fromEntries(groups.map(g => [g.id, g.name]));

    const isDemo = !user || profile?.studio_name === 'Demo Dance Studio' || !profile?.studio_name;
    console.log('TeachersPage isDemo:', isDemo);

    const teachers = (settings.staff || []) as unknown as Teacher[];

    const [search] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Teacher | null>(null);

    // Invite-by-email flow (docs/authorization-module.md §8) — alongside
    // the existing "admin fills the fields directly" path (TeacherModal).
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [pendingInvites, setPendingInvites] = useState<StaffInviteRow[]>([]);
    const [confirmingInvite, setConfirmingInvite] = useState<StaffInviteRow | null>(null);

    function loadPendingInvites() {
        getPendingStaffInvitesAction().then(setPendingInvites).catch(() => {});
    }
    useEffect(() => { loadPendingInvites(); }, []);

    async function handleRevokeInvite(id: string) {
        try {
            await revokeStaffInviteAction({ id });
            loadPendingInvites();
        } catch (err: any) {
            addNotification(err?.message || 'Error', 'bg-rose-500');
        }
    }

    const filtered = teachers.filter(t => {
        const fullName = `${t.first_name || ''} ${t.last_name || t.full_name || ''}`.trim().toLowerCase();
        return fullName.includes(search.toLowerCase());
    }).sort((a, b) => {
        const nameA = `${a.first_name || ''} ${a.last_name || a.full_name || ''}`.trim();
        const nameB = `${b.first_name || ''} ${b.last_name || b.full_name || ''}`.trim();
        return nameA.localeCompare(nameB, lang === 'ka' ? 'ka-GE' : lang === 'ru' ? 'ru-RU' : 'en-US');
    });

    function openAdd() { setEditing(null); setModalOpen(true); }
    function openEdit(t: Teacher) { setEditing(t); setModalOpen(true); }

    // Teacher.assigned_group_ids and Group.teacherId/secondaryTeacherId are
    // two separate copies of the same relationship. groups/page.tsx already
    // keeps them in sync when a GROUP is edited (it pushes the change onto
    // the teacher). This is the missing other direction: when a TEACHER's
    // assigned groups change here, push the change onto the groups too, so
    // a group unchecked here actually loses this teacher (instead of still
    // showing them on the Groups/Calendar/Attendance pages), and a group
    // checked here actually gains them.
    function reconcileGroupAssignments(teacherId: string, oldGroupIds: string[], newGroupIds: string[]) {
        const removed = oldGroupIds.filter(gid => !newGroupIds.includes(gid));
        const added = newGroupIds.filter(gid => !oldGroupIds.includes(gid));
        if (removed.length === 0 && added.length === 0) return;

        const currentGroups = getGroups();
        let changed = false;
        const nextGroups = currentGroups.map(g => {
            if (removed.includes(g.id)) {
                if (g.teacherId === teacherId) {
                    changed = true;
                    return { ...g, teacherId: '' };
                }
                if (g.secondaryTeacherId === teacherId) {
                    changed = true;
                    return { ...g, secondaryTeacherId: '', secondaryTeacherName: '' };
                }
                return g;
            }
            if (added.includes(g.id)) {
                if (!g.teacherId) {
                    changed = true;
                    return { ...g, teacherId };
                }
                if (g.teacherId !== teacherId && !g.secondaryTeacherId) {
                    changed = true;
                    return { ...g, secondaryTeacherId: teacherId };
                }
                // Both teacher slots on this group are already taken by
                // someone else — don't silently overwrite another
                // teacher's assignment. The group keeps whatever it had;
                // the user can resolve the conflict from the Groups page.
                console.warn(`⚠️ [Teachers] Group ${g.id} already has both teacher slots filled — not auto-assigning ${teacherId}.`);
                return g;
            }
            return g;
        });

        if (changed) {
            setGroups(nextGroups);
            saveGroups(nextGroups);
        }
    }

    // async now, awaited by TeacherModal's save() before it closes itself —
    // this used to fire updateStaff()/addStaff() unawaited and close the
    // modal immediately regardless, so a rejection (permission denied,
    // network error) was invisible: the modal reported success while the
    // real write silently failed.
    async function handleSave(data: Partial<Teacher>) {
        const oldGroupIds = editing?.assigned_group_ids || [];
        const newGroupIds = data.assigned_group_ids || [];

        if (editing) {
            await updateStaff(editing.id, data as any);
            reconcileGroupAssignments(editing.id, oldGroupIds, newGroupIds);
        } else {
            // Defense in depth: TeacherModal always assigns an id now,
            // but any other caller of this handler must not be allowed
            // to add a staff member the cloud sync (which requires a
            // non-null primary key) will silently drop.
            const newId = data.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `t_${Date.now()}`);
            const { id: finalId } = await addStaff({
                ...data,
                id: newId,
                status: data.status || 'active',
                permissions: data.permissions || {
                    canViewAttendance: true,
                    canViewSubscriptions: true,
                    canViewStudents: true,
                    canViewCalendar: true,
                    canEditCalendar: true,
                    canViewGroups: true,
                    canViewTeachers: true,
                    canViewHalls: true,
                    canViewShop: true,
                    canViewAnalytics: true,
                    canViewSMS: true
                }
            } as any);
            // Unified Auth (docs/tasks.md): when this teacher gets a real
            // Supabase Auth account, addStaff() returns THAT id, not our
            // optimistic `newId` — use it here so the group's
            // teacherId/secondaryTeacherId actually matches the row that
            // ended up in the `staff` table.
            reconcileGroupAssignments(finalId, [], newGroupIds);
        }
    }

    function handleDelete(id: string) {
        removeStaff(id).catch(() => {});
    }


    const individualCount = teachers.filter(t => t.assigned_individual).length;

    return (
        <PermissionGuard permKey="canViewTeachers">
            <div className="space-y-8 animate-fade-up max-w-7xl mx-auto pb-10">
            {/* ── Top Header Row: Metrics & Add Action ── */}
            <div className="flex flex-row items-center justify-between gap-3 sm:gap-4 lg:gap-8">
                {/* Quick stats - Scoped and Clean */}
                <div className="flex items-center gap-2 sm:gap-3 lg:gap-6 overflow-x-auto no-scrollbar flex-1 py-1">
                    {[
                        { label: t.totalTeachersShort, value: String(teachers.length), icon: Users, colorCls: 'text-violet-600', bgCls: 'bg-violet-500/5' },
                        { label: t.indSessionsShort, value: String(individualCount), icon: User, colorCls: 'text-indigo-600', bgCls: 'bg-indigo-500/5' },
                        { label: t.groupsShort, value: String(groups.length), icon: BookOpen, colorCls: 'text-emerald-600', bgCls: 'bg-emerald-500/5' },
                    ].map(s => (
                        <div key={s.label} className={`flex flex-col justify-center px-4 sm:px-6 lg:px-10 h-12 lg:h-20 rounded-full border border-border-subtle/50 min-w-fit transition-all text-center sm:text-left ${s.bgCls}`}>
                            <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
                                <s.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-6 lg:h-6 ${s.colorCls} opacity-60`} />
                                <span className="text-[13px] sm:text-[16px] lg:text-2xl font-black text-primary leading-none tabular-nums">{s.value}</span>
                            </div>
                            <p className="text-[7px] sm:text-[8px] lg:text-[10px] text-muted font-black tracking-widest mt-1 lg:mt-2 opacity-40 uppercase">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Add Teacher Actions */}
                <div className="hidden sm:flex flex-shrink-0 items-center gap-2">
                    <button onClick={() => setInviteModalOpen(true)}
                        className="flex items-center justify-center gap-2 h-12 px-6 bg-surface border border-border-subtle hover:border-indigo-500/40 active:scale-95 text-primary text-[11px] font-black tracking-widest rounded-[1.25rem] transition-all touch-manipulation">
                        <Send className="w-4 h-4" />
                        <span className="uppercase">{lang === 'ka' ? 'მოწვევა' : lang === 'ru' ? 'Пригласить' : 'Invite'}</span>
                    </button>
                    <button onClick={openAdd}
                        className="flex items-center justify-center gap-2 w-12 h-12 sm:w-auto px-0 sm:px-6 bg-[#6d28d9] hover:bg-[#5b21b6] active:scale-95 text-white text-[11px] font-black tracking-widest rounded-[1.25rem] transition-all touch-manipulation">
                        <UserPlus className="w-5 h-5" />
                        <span className="hidden sm:inline uppercase">{t.addTeacher}</span>
                    </button>
                </div>
            </div>

            {/* Pending invites (docs/authorization-module.md §8) */}
            {pendingInvites.length > 0 && (
                <div className="bg-card border-2 border-dashed border-indigo-500/20 rounded-3xl p-4 space-y-3">
                    <p className="text-[10px] font-black text-indigo-500 tracking-widest uppercase flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" /> {lang === 'ka' ? 'მოწვევები დასადასტურებლად' : lang === 'ru' ? 'Приглашения на подтверждение' : 'Pending invites'}
                    </p>
                    {pendingInvites.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-surface/30 border border-border-subtle/30">
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-primary truncate">
                                    {inv.first_name ? `${inv.first_name} ${inv.last_name}` : inv.email}
                                </p>
                                <p className="text-[9px] font-bold text-muted/50 tracking-widest mt-0.5">
                                    {inv.email} · {inv.status === 'submitted'
                                        ? (lang === 'ka' ? 'შევსებულია — მოსაცდელია დასტური' : lang === 'ru' ? 'Заполнено — ожидает подтверждения' : 'Filled in — awaiting confirmation')
                                        : (lang === 'ka' ? 'მოწვევა გაგზავნილია' : lang === 'ru' ? 'Приглашение отправлено' : 'Invite sent')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {inv.status === 'submitted' && (
                                    <button onClick={() => setConfirmingInvite(inv)}
                                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-all">
                                        <Check className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={() => handleRevokeInvite(inv.id)}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all">
                                    <XIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Teacher cards */}
                <div className="grid gap-4 stagger">
                    {filtered.map(teacher => (
                        <div key={teacher.id}
                            className="group bg-card border-2 border-border-subtle hover:border-violet-500/40 hover:shadow-xl hover:shadow-violet-500/5 rounded-3xl p-4 transition-all duration-300 relative overflow-hidden flex flex-col">
                            <div className="flex items-start gap-4">
                                {/* Avatar with Status Dot */}
                                <div className="relative flex-shrink-0">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-base font-black text-white shadow-lg shadow-violet-500/20 group-hover:scale-105 transition-transform overflow-hidden relative">
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            {getInitials(`${teacher.first_name || ''} ${teacher.last_name || teacher.full_name || ''}`)}
                                        </div>
                                        {teacher.photo_url && (
                                            <img 
                                                src={teacher.photo_url} 
                                                alt="" 
                                                className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300" 
                                                onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
                                            />
                                        )}
                                    </div>
                                    <div className={cn(
                                        "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card shadow-sm",
                                        teacher.status === 'active' ? "bg-emerald-500" : 
                                        teacher.status === 'on_leave' ? "bg-amber-500" : "bg-muted"
                                    )} />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-sm font-black text-primary group-hover:text-violet-600 transition-colors tracking-tight truncate">
                                            {teacher.first_name} {teacher.last_name}
                                        </p>
                                        
                                        {/* Actions */}
                                        <button onClick={(e) => { e.stopPropagation(); openEdit(teacher); }}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface border border-border-subtle text-muted hover:text-violet-600 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all shadow-sm">
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                    </div>

                                    {/* Contacts & rates - more compact */}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold text-muted/60">
                                        <div className="flex items-center gap-2">
                                            <a href={`tel:${teacher.phone}`} className="flex items-center gap-1.5 hover:text-indigo-500 transition-colors">
                                                <Phone className="w-3 h-3 opacity-40 shrink-0" />
                                                {teacher.phone}
                                            </a>
                                            <a href={`sms:${teacher.phone}`} className="p-1 px-1.5 bg-indigo-500/5 hover:bg-indigo-500/10 rounded-md transition-all active:scale-90 group/sms">
                                                <MessageSquare className="w-3 h-3 text-indigo-500 opacity-60 group-hover/sms:opacity-100" />
                                            </a>
                                        </div>
                                        <div className="flex gap-3">
                                            {teacher.rate_per_hour && <span className="text-emerald-600 font-black tracking-tight">{formatCurrency(teacher.rate_per_hour, settings.currency)}/h</span>}
                                            {teacher.rate_per_month && <span className="text-emerald-600 font-black tracking-tight">{formatCurrency(teacher.rate_per_month, settings.currency)}/m</span>}
                                            {(teacher.salary_percentage !== undefined && teacher.salary_percentage !== null) && <span className="text-emerald-600 font-black tracking-tight">{teacher.salary_percentage}%</span>}
                                        </div>
                                    </div>

                                    {/* Assigned groups - even smaller font */}
                                    {(teacher.assigned_group_ids || []).length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2.5 pt-2.5 border-t border-border-subtle/30">
                                            {teacher.assigned_group_ids.filter(gid => GROUP_MAP[gid]).map(gid => (
                                                <span key={gid} className="px-2 py-0.5 bg-surface text-muted/50 text-[8px] font-black tracking-wider rounded-md flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    <BookOpen className="w-2.5 h-2.5 text-violet-500/50" />{GROUP_MAP[gid]}
                                                </span>
                                            ))}
                                            {teacher.assigned_individual && (
                                                <span className="px-2 py-0.5 bg-indigo-500/5 text-indigo-600/60 text-[8px] font-black tracking-wider rounded-md flex items-center gap-1">
                                                    <Zap className="w-2.5 h-2.5" />{t.indSessionShort}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {filtered.length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center text-muted/30">
                            <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-4">
                                <Users className="w-10 h-10 opacity-20" />
                            </div>
                            <p className="text-base font-bold">{t.noData}</p>
                            <p className="text-xs font-medium mt-1">{t.tryAnotherSearch}</p>
                        </div>
                    )}
                </div>

            </div>

            <TeacherModal
                open={modalOpen}
                teacher={editing}
                groups={groups}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                onDelete={handleDelete}
            />

            <InviteTeacherModal
                open={inviteModalOpen}
                onClose={() => setInviteModalOpen(false)}
                onSent={loadPendingInvites}
            />

            <ConfirmInviteModal
                invite={confirmingInvite}
                onClose={() => setConfirmingInvite(null)}
                onConfirmed={loadPendingInvites}
            />

            <MobileFAB icon={<UserPlus className="w-6 h-6" />} onClick={openAdd} />
        </PermissionGuard>
    );
}
