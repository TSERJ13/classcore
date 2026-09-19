'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Calendar, CreditCard, Users, CalendarDays, Edit2, BookOpen, GraduationCap, DoorOpen, ShoppingBag, BarChart2, MessageSquare, Loader2 } from 'lucide-react';
import MainPortal from '@/components/ui/MainPortal';
import { useT } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { confirmStaffInviteAction, type StaffInviteRow } from '@/app/actions/staff-invites';
import { ROLE_DEFAULT_PERMISSIONS, resolveRoleTier } from '@/lib/permissions/role-defaults';
import { addNotification } from '@/lib/notification-store';

interface ConfirmInviteModalProps {
    invite: StaffInviteRow | null;
    onClose: () => void;
    onConfirmed: () => void;
}

/**
 * The PRD's "დასადასტურებელი ეკრანი" (confirmation screen,
 * docs/authorization-module.md §8) — shared endpoint for both the invite
 * path (this modal, after the teacher submitted their own info) and would
 * also be where the manual-fill path's own review step lives if it ever
 * gets one; TeacherModal.tsx currently activates a manually-filled teacher
 * immediately instead, which the PRD doesn't strictly require changing.
 */
export function ConfirmInviteModal({ invite, onClose, onConfirmed }: ConfirmInviteModalProps) {
    const { t, lang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (invite) {
            const roleTier = resolveRoleTier(invite.role, false);
            setPermissions(roleTier ? { ...ROLE_DEFAULT_PERMISSIONS[roleTier] } : {});
        }
    }, [invite]);

    if (!invite) return null;

    const PERMS = [
        { key: 'canViewAttendance', label: t.attendance, icon: Calendar },
        { key: 'canViewSubscriptions', label: t.subscriptions, icon: CreditCard },
        { key: 'canViewStudents', label: t.students, icon: Users },
        { key: 'canViewCalendar', label: t.calendar, icon: CalendarDays },
        { key: 'canEditCalendar', label: l('კალენდრის რედაქტირება', 'Редактирование календаря', 'Edit Calendar'), icon: Edit2 },
        { key: 'canViewGroups', label: t.groups, icon: BookOpen },
        { key: 'canViewTeachers', label: t.teachers, icon: GraduationCap },
        { key: 'canViewHalls', label: t.halls, icon: DoorOpen },
        { key: 'canViewShop', label: t.shop, icon: ShoppingBag },
        { key: 'canViewAnalytics', label: t.analytics, icon: BarChart2 },
        { key: 'canViewSMS', label: t.sms_manager, icon: MessageSquare },
    ];

    async function handleConfirm() {
        if (!invite) return;
        setSaving(true);
        try {
            await confirmStaffInviteAction({ id: invite.id, permissions });
            addNotification(l('თანამშრომელი დამატებულია', 'Сотрудник добавлен', 'Staff member added'), 'bg-emerald-500');
            onConfirmed();
            onClose();
        } catch (err: any) {
            addNotification(err?.message || l('შეცდომა', 'Ошибка', 'Error'), 'bg-rose-500');
        } finally {
            setSaving(false);
        }
    }

    return (
        <MainPortal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
                <div className="bg-card border border-border-subtle w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    <div className="px-6 py-5 border-b border-border-subtle flex items-center justify-between flex-shrink-0">
                        <div>
                            <h2 className="text-sm font-black text-primary">{invite.first_name} {invite.last_name}</h2>
                            <p className="text-[10px] text-muted/60 font-bold">{invite.email} · {invite.phone}</p>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface text-muted">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4 overflow-y-auto">
                        <p className="text-[10px] font-black text-muted tracking-widest opacity-40 uppercase">
                            {l('წვდომის უფლებები (როლის ნაგულისხმევი)', 'Права доступа (по умолчанию для роли)', 'Access permissions (role defaults)')}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {PERMS.map(({ key, label, icon: Icon }) => {
                                const val = !!permissions[key];
                                return (
                                    <button key={key} type="button"
                                        onClick={() => setPermissions(p => ({ ...p, [key]: !val }))}
                                        className={cn('flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left',
                                            val ? 'bg-indigo-500/5 border-indigo-500/20 text-primary' : 'bg-surface border-border-subtle opacity-60 text-muted')}
                                    >
                                        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', val ? 'bg-indigo-500 text-white' : 'bg-muted/10 text-muted')}>
                                            <Icon className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-[10px] font-bold truncate">{label}</span>
                                        <div className={cn('ml-auto w-4 h-4 rounded-md border flex items-center justify-center', val ? 'bg-indigo-500 border-indigo-500' : 'border-border-subtle bg-white')}>
                                            {val && <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="p-6 border-t border-border-subtle flex gap-3 flex-shrink-0">
                        <button onClick={onClose} className="flex-1 py-3 text-xs font-black text-muted hover:bg-surface rounded-2xl transition-all">
                            {l('გაუქმება', 'Отмена', 'Cancel')}
                        </button>
                        <button onClick={handleConfirm} disabled={saving}
                            className="flex-[2] py-3 bg-indigo-600 text-white text-xs font-black rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 uppercase disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            {l('დადასტურება და დამატება', 'Подтвердить и добавить', 'Confirm & Add')}
                        </button>
                    </div>
                </div>
            </div>
        </MainPortal>
    );
}
