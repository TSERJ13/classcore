'use client';

import React, { useState } from 'react';
import { X, Mail, Send, Loader2 } from 'lucide-react';
import MainPortal from '@/components/ui/MainPortal';
import { useT } from '@/contexts/LanguageContext';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { createStaffInviteAction } from '@/app/actions/staff-invites';
import { addNotification } from '@/lib/notification-store';

interface InviteTeacherModalProps {
    open: boolean;
    onClose: () => void;
    onSent: () => void;
}

/**
 * Invite-by-email path of the teacher-add flow
 * (docs/authorization-module.md §8) — the alternative to TeacherModal's
 * "admin fills the fields directly". Deliberately minimal: email + role
 * only, matching the PRD's "ადმინისტრატორი შეჰყავს მასწავლებლის მეილს"
 * step. Everything else (name/phone/password, permissions) is decided
 * later — by the teacher on the claim page, then by the admin on the
 * confirmation screen (ConfirmInviteModal).
 */
export function InviteTeacherModal({ open, onClose, onSent }: InviteTeacherModalProps) {
    const { t, lang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('teacher');
    const [sending, setSending] = useState(false);

    if (!open) return null;

    async function handleSend() {
        if (!email.trim()) return;
        setSending(true);
        try {
            await createStaffInviteAction({
                email: email.trim(),
                role,
                lang,
                origin: typeof window !== 'undefined' ? window.location.origin : undefined,
            });
            addNotification(l('მოწვევა გაგზავნილია', 'Приглашение отправлено', 'Invite sent'), 'bg-emerald-500');
            setEmail('');
            onSent();
            onClose();
        } catch (err: any) {
            addNotification(err?.message || l('შეცდომა', 'Ошибка', 'Error'), 'bg-rose-500');
        } finally {
            setSending(false);
        }
    }

    return (
        <MainPortal>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
                <div className="bg-card border border-border-subtle w-full max-w-md rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="px-6 py-5 border-b border-border-subtle flex items-center justify-between">
                        <h2 className="text-sm font-black text-primary">{l('მასწავლებლის მოწვევა', 'Приглашение учителя', 'Invite Teacher')}</h2>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface text-muted">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-[11px] text-muted/70 leading-relaxed">
                            {l('ბმული გაეგზავნება მითითებულ მეილზე — მასწავლებელი თვითონ შეავსებს პროფილს, შემდეგ თქვენ დაადასტურებთ.', 'Ссылка будет отправлена на указанный email — учитель сам заполнит профиль, а вы затем подтвердите.', 'A link will be emailed to this address — the teacher fills in their own profile, then you confirm it.')}
                        </p>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted tracking-widest ml-1 uppercase">{t.email}</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder={t.emailPlaceholder}
                                    className="w-full bg-surface border border-border-subtle rounded-2xl pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-indigo-500/50" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted tracking-widest ml-1 uppercase">{l('როლი', 'Роль', 'Role')}</label>
                            <SearchSelect
                                options={[{ value: 'teacher', label: t.teacherRole }, { value: 'administrator', label: l('ადმინისტრატორი', 'Администратор', 'Administrator') }]}
                                value={role}
                                onChange={setRole}
                            />
                        </div>
                    </div>
                    <div className="p-6 border-t border-border-subtle flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 text-xs font-black text-muted hover:bg-surface rounded-2xl transition-all">
                            {l('გაუქმება', 'Отмена', 'Cancel')}
                        </button>
                        <button onClick={handleSend} disabled={sending || !email.trim()}
                            className="flex-[2] py-3 bg-indigo-600 text-white text-xs font-black rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 uppercase disabled:opacity-50">
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {l('გაგზავნა', 'Отправить', 'Send')}
                        </button>
                    </div>
                </div>
            </div>
        </MainPortal>
    );
}
