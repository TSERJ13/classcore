'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    UserCircle, CreditCard, Zap, History, MessageCircle,
    ChevronRight, Copy, Check, ExternalLink, Send, Shield, Info, Wallet, Loader2,
    Trash2, Building2, UserPlus, Filter, RotateCcw, Users, Save,
    FileText, User, Lock, Mail, BadgeCheck, GraduationCap, Banknote, Plus, StickyNote, Clock, Circle, CheckCircle2, X, Edit, LayoutDashboard, Key, MapPin
} from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/contexts/LanguageContext';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { cn, formatCurrency, getLocalISODate } from '@/lib/utils';
import { getBillingState, getPaymentLogs, SAAS_PRICE_GEL } from '@/lib/saas-billing';
import { addNotification } from '@/lib/notification-store';
import { type StaffPermissions, type UserRole, type Branch, type StaffMember, ensureUniqueSlug, removeFromRegistry, cleanupRegistry, saveSettings } from '@/lib/settings-store';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { useConfirm } from '@/contexts/ConfirmContext';
import { compactSlugify } from '@/lib/utils';

export default function ProfilePage() {
    const { t, lang } = useT();
    const { settings, addStaff, removeStaff, updateStaff, restoreFromTrash, clearOldTrash, addBranch, updateBranch, removeBranch, setActiveBranch, setSettings } = useStudio();
    const { profile, user } = useUser();
    const confirm = useConfirm();
    const [mounted, setMounted] = useState(false);
    const [activeSection, setActiveSection] = useState<'branches' | 'team' | 'history' | 'trash'>('branches');

    // Modals & Editing
    const [isAddingStaff, setIsAddingStaff] = useState(false);
    const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
    const [isAddingBranch, setIsAddingBranch] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

    useEffect(() => {
        setMounted(true);
        clearOldTrash();

        // Check for persisted tab (e.g. from Settings shortcut)
        const savedTab = localStorage.getItem('cc_profile_tab');
        if (savedTab && ['branches', 'team', 'history', 'trash'].includes(savedTab)) {
            setActiveSection(savedTab as any);
            localStorage.removeItem('cc_profile_tab'); // Clean up
        }
    }, []);

    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    const canManageStaff = profile?.role === 'admin' || profile?.role === 'owner';

    const billing = useMemo(() => {
        if (!mounted || !settings.studioSlug) return null;
        return getBillingState(settings.studioSlug);
    }, [mounted, settings.studioSlug]);

    const daysRemaining = billing?.status === 'trial' ? billing.daysLeftInTrial :
        billing?.status === 'active' ? Math.max(0, Math.floor((new Date(billing.nextDueDate || '').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;

    // Staff Form State
    const [staffForm, setStaffForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        role: 'teacher' as UserRole | string,
        allowedBranchIds: [] as string[],
        permissions: {
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
    });

    // Branch Form State
    const [branchForm, setBranchForm] = useState({
        name: '',
        address: ''
    });

    useEffect(() => {
        if (editingStaff) {
            setStaffForm({
                first_name: editingStaff.first_name || '',
                last_name: editingStaff.last_name || '',
                email: editingStaff.email || '',
                password: editingStaff.password || '',
                role: editingStaff.role,
                allowedBranchIds: editingStaff.allowedBranchIds || [],
                permissions: editingStaff.permissions || {
                    canViewAttendance: true, canViewSubscriptions: true, canViewStudents: true,
                    canViewCalendar: true, canEditCalendar: true, canViewGroups: true,
                    canViewTeachers: true, canViewHalls: true, canViewShop: true,
                    canViewAnalytics: true, canViewSMS: true
                }
            });
        } else {
            setStaffForm({
                first_name: '', last_name: '', email: '', password: '', role: 'teacher', allowedBranchIds: [],
                permissions: {
                    canViewAttendance: true, canViewSubscriptions: true, canViewStudents: true,
                    canViewCalendar: true, canEditCalendar: true, canViewGroups: true,
                    canViewTeachers: true, canViewHalls: true, canViewShop: true,
                    canViewAnalytics: true, canViewSMS: true
                }
            });
        }
    }, [editingStaff]);

    useEffect(() => {
        if (editingBranch) {
            setBranchForm({ name: editingBranch.name, address: editingBranch.address || '' });
        } else {
            setBranchForm({ name: '', address: '' });
        }
    }, [editingBranch]);

    const handleStaffSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!staffForm.email || !staffForm.first_name) return;

        if (editingStaff) {
            updateStaff(editingStaff.id, staffForm as any);
            addNotification({ title: 'Success', message: l('განახლდა', 'Обновлено', 'Staff updated'), type: 'success', time: String(Date.now()) });
            setEditingStaff(null);
        } else {
            addStaff(staffForm as any);
            addNotification({ title: 'Success', message: l('დაემატა', 'Добавлено', 'Staff added'), type: 'success', time: String(Date.now()) });
            setIsAddingStaff(false);
        }
    };

    const handleBranchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!branchForm.name) return;

        if (editingBranch) {
            updateBranch(editingBranch.id, branchForm);
            addNotification({ title: 'Success', message: l('ფილიალი განახლდა', 'Филиал обновлен', 'Branch updated'), type: 'success', time: String(Date.now()) });
            setEditingBranch(null);
        } else {
            addBranch(branchForm.name, branchForm.address);
            addNotification({ title: 'Success', message: l('ფილიალი დაემატა', 'Фილიალი добавлен', 'Branch added'), type: 'success', time: String(Date.now()) });
            setIsAddingBranch(false);
        }
    };

    if (!mounted || !billing) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-indigo-500 opacity-20" /></div>;

    return (
        <div className="min-h-screen bg-transparent p-4 md:p-8 animate-in fade-in duration-700">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* ─── COMPACT MERGED BENTO HUB ─── */}
                <div className="bg-card/40 backdrop-blur-xl border border-border-subtle rounded-[2.5rem] p-8 shadow-xl shadow-black/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32" />

                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                        <div className="flex items-center gap-6 text-center md:text-left">
                            <div className="w-1.5 h-12 bg-indigo-500 rounded-full hidden md:block" />
                            <div>
                                <h2 className="text-2xl font-black text-primary tracking-tight">{profile?.first_name} {profile?.last_name}</h2>
                                <p className="text-[10px] font-black text-indigo-500/60 tracking-widest mt-1">ID: {settings.cabinetCode || '---'} • {profile?.role}</p>
                            </div>
                        </div>

                        {profile?.role === 'admin' && (
                            <div className="flex flex-wrap items-center justify-center md:justify-end gap-8 md:gap-12">
                                <div className="flex items-center gap-4 group/stat">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                        <Wallet className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-muted opacity-40 tracking-widest mb-0.5 whitespace-nowrap">{l('ბალანსი', 'Баланс', 'Balance')}</p>
                                        <p className="text-2xl font-black text-primary tabular-nums tracking-tighter group-hover/stat:text-indigo-500 transition-colors">{formatCurrency(billing.accountBalance, 'GEL')}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 group/stat">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                        <Shield className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <p className="text-[9px] font-black text-muted opacity-40 tracking-widest leading-none whitespace-nowrap">{l('პაკეტი', 'Пაკეტ', 'Subscription')}</p>
                                            <div className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[8px] font-black tracking-widest animate-pulse">{billing.status}</div>
                                        </div>
                                        <div className="flex items-baseline gap-1.5">
                                            <p className="text-2xl font-black text-primary tabular-nums tracking-tighter">{daysRemaining}</p>
                                            <span className="text-[10px] font-bold text-muted opacity-40 tracking-widest">{l('დღე', 'д', 'days')}</span>
                                        </div>
                                    </div>
                                </div>

                                <button className="px-8 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-600/20 whitespace-nowrap">
                                    {l('შევსება', 'Пополнить', 'Top Up')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── NAVIGATION DOCK ─── */}
                <div className="flex justify-center overflow-x-auto no-scrollbar pb-2">
                    <nav className="inline-flex w-full md:w-auto items-center bg-card/60 backdrop-blur-2xl border border-border-subtle p-1.5 rounded-[2rem] shadow-lg shadow-black/5 gap-0.5">
                        {[
                            { id: 'branches', label: l('ფილიალები', 'Филиалы', 'Branches'), icon: Building2 },
                            profile?.role === 'admin' && { id: 'team', label: l('გუნდი', 'Команда', 'Team'), icon: Users },
                            profile?.role === 'admin' && { id: 'history', label: l('ისტორია', 'История', 'Logs'), icon: History },
                            profile?.role === 'admin' && { id: 'trash', label: l('სანაგვე', 'Корзина', 'Trash'), icon: Trash2 },
                        ].filter(Boolean).map((tab: any) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveSection(tab.id as any)}
                                className={cn(
                                    "flex-1 md:flex-none flex items-center justify-center gap-2.5 px-4 md:px-6 py-3 rounded-[1.5rem] text-[10px] font-black tracking-widest transition-all whitespace-nowrap",
                                    activeSection === tab.id
                                        ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/20"
                                        : "text-muted hover:text-primary hover:bg-surface/50"
                                )}
                            >
                                <tab.icon className="w-4 h-4" />
                                <span className="hidden sm:block">{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* ─── MAIN CONTENT ─── */}
                <div className="min-h-[400px]">
                    <div className="bg-card/30 backdrop-blur-xl border border-border-subtle rounded-[2.5rem] shadow-xl shadow-black/5 overflow-hidden">

                        {activeSection === 'branches' && (
                            <div className="p-8 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                            <Building2 className="w-6 h-6" />
                                        </div>
                                        <h3 className="text-xl font-black text-primary tracking-tight">{l('ფილიალები', 'Филиалы', 'Branch Network')}</h3>
                                    </div>
                                    {profile?.role === 'admin' && (
                                        <button onClick={() => setIsAddingBranch(true)} className="px-6 py-3 bg-indigo-600 text-white shadow-lg shadow-indigo-600/10 rounded-xl font-black text-[9px] tracking-widest hover:scale-105 active:scale-95 transition-all">
                                            {l('დამატება', 'Добавить', 'Add Branch')}
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {settings.branches
                                        .filter(b => {
                                            if (profile?.role === 'admin') return true;
                                            if (settings.activeBranchId === 'main') return true;
                                            if (!profile?.allowedBranchIds || profile.allowedBranchIds.length === 0) return true;
                                            return profile.allowedBranchIds.includes(b.id);
                                        })
                                        .map(b => (
                                            <div key={b.id} className={cn(
                                                "bg-surface/40 border p-6 rounded-[2rem] group transition-all flex flex-col justify-between relative overflow-hidden h-[180px]",
                                                settings.activeBranchId === b.id ? "border-indigo-500/50 bg-indigo-500/5 shadow-lg shadow-indigo-500/5" : "border-border-subtle hover:border-indigo-500/20"
                                            )}>
                                                {settings.activeBranchId === b.id && (
                                                    <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-md border border-emerald-500/20">
                                                        <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                                                        <span className="text-[8px] font-black text-emerald-500 tracking-widest">Active</span>
                                                    </div>
                                                )}

                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-card border border-border-subtle flex items-center justify-center text-indigo-500">
                                                            <Building2 className="w-5 h-5" />
                                                        </div>
                                                        <div className="min-w-0 pr-4">
                                                            <p className="text-sm font-black text-primary tracking-tight truncate">{b.name}</p>
                                                            <p className="text-[9px] font-bold text-muted opacity-40 tracking-widest truncate">{b.address || 'Global Access'}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 mt-auto">
                                                    <button
                                                        onClick={() => { setActiveBranch(b.id); window.location.href = '/'; }}
                                                        className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <LayoutDashboard className="w-3.5 h-3.5" />
                                                        {l('გადასვლა', 'Перейти', 'Visit')}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingBranch(b)}
                                                        className="w-11 h-11 bg-surface border border-border-subtle text-muted hover:text-primary hover:border-indigo-500/30 rounded-xl flex items-center justify-center transition-all"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    {profile?.role === 'admin' && b.id !== 'main' && (
                                                        <button
                                                            onClick={() => removeBranch(b.id)}
                                                            className="w-11 h-11 bg-surface border border-border-subtle text-muted hover:text-red-500 hover:border-red-500/30 rounded-xl flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {activeSection === 'team' && (
                            <div className="p-8 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="flex items-center justify-between mb-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                                            <Users className="w-6 h-6" />
                                        </div>
                                        <h3 className="text-xl font-black text-primary tracking-tight">{l('გუნდი', 'Команда', 'Staff Roster')}</h3>
                                    </div>
                                    <button onClick={() => { setEditingStaff(null); setIsAddingStaff(true); }} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[9px] tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-indigo-600/20">
                                        {l('დამატება', 'Добавить', 'Add Personnel')}
                                    </button>
                                </div>

                                {settings.studioSlug === 'demo.classcore.ge' && (
                                    <div className="mb-8 p-6 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex flex-col md:flex-row items-center gap-6 animate-pulse">
                                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                                            <Shield className="w-6 h-6" />
                                        </div>
                                        <div className="text-center md:text-left">
                                            <p className="text-[11px] font-black text-amber-500 tracking-widest mb-1">{l('სინქრონიზაცია გამორთულია', 'Сინхронизация отключена', 'Cloud Sync Disabled')}</p>
                                            <p className="text-xs font-bold text-primary opacity-80 leading-relaxed">
                                                {l('თქვენ იყენებთ დემო მისამართს. სხვა ბრაუზერიდან შესასვლელად აუცილებელია "პარამეტრებში" მიუთითოთ თქვენი სტუდიის უნიკალური მისამართი (Slug).', 'Вы используете демо-адрес. Для входа из другого браузера необходимо указать уникальный адрес вашей студии (Slug) в настройках.', 'You are using a demo slug. To enable log-in from other browsers, you must set a unique studio slug in Settings.')}
                                            </p>
                                        </div>
                                        <Link href="/settings" className="px-6 py-3 bg-amber-500 text-white rounded-xl font-black text-[9px] tracking-widest hover:scale-105 transition-all md:ml-auto whitespace-nowrap">
                                            {l('გასწორება', 'Исправить', 'Fix Now')}
                                        </Link>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(settings.staff || []).map(member => (
                                        <div key={member.id} className="bg-surface/40 border border-border-subtle p-5 rounded-[2rem] flex items-center justify-between group hover:border-indigo-500/10 transition-all">
                                            <div className="flex items-center gap-5 min-w-0 pr-4">
                                                <div className="w-12 h-12 rounded-2xl bg-card border border-border-subtle flex items-center justify-center text-lg font-black text-indigo-500">
                                                    {member.first_name?.[0] || 'U'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <p className="text-sm font-black text-primary truncate">{member.first_name} {member.last_name}</p>
                                                        <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600 text-[8px] font-black tracking-widest">{member.role}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[9px] font-bold text-muted opacity-40 tracking-widest truncate">{member.email}</p>
                                                        <div className="w-1 h-1 rounded-full bg-border-subtle" />
                                                        <p className="text-[9px] font-bold text-indigo-500/60 tracking-widest">
                                                            {member.allowedBranchIds?.length ? `${member.allowedBranchIds.length} ${l('ფილიალი', 'Филиала', 'Branches')}` : l('ყველა ფილიალი', 'Все филиалы', 'All Branches')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setEditingStaff(member)}
                                                    className="w-9 h-9 bg-surface border border-border-subtle text-muted hover:text-primary rounded-xl flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => removeStaff(member.id)}
                                                    className="w-9 h-9 bg-surface border border-border-subtle text-muted hover:text-red-500 hover:border-red-500/30 rounded-xl flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeSection === 'history' && (
                            <div className="p-8 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                                        <History className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-black text-primary tracking-tight">{l('ლოგები', 'История', 'Consolidated History')}</h3>
                                </div>
                                <div className="border border-border-subtle rounded-[2.5rem] bg-surface/20 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-card/30 border-b border-border-subtle text-[9px] font-black text-muted tracking-[0.2em]">
                                                <tr>
                                                    <th className="px-6 py-5">Date</th>
                                                    <th className="px-6 py-5">Context / Plan</th>
                                                    <th className="px-6 py-5">Branch</th>
                                                    <th className="px-6 py-5 text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border-subtle/20">
                                                {(settings.subscriptionLogs || []).map(log => {
                                                    const branchName = settings.branches.find(b => b.id === (log as any).branchId)?.name || 'Global';
                                                    return (
                                                        <tr key={log.id} className="hover:bg-indigo-500/5 transition-colors group">
                                                            <td className="px-6 py-5 text-[10px] font-bold text-muted font-mono whitespace-nowrap">{new Date(log.date).toLocaleDateString()}</td>
                                                            <td className="px-6 py-5">
                                                                <p className="text-xs font-black text-primary truncate max-w-[200px]">{log.studentName}</p>
                                                                <p className="text-[8px] font-bold text-muted opacity-40 tracking-widest">{log.planName}</p>
                                                            </td>
                                                            <td className="px-6 py-5">
                                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-border-subtle rounded-lg">
                                                                    <Circle className="w-1 h-1 fill-indigo-500 text-indigo-500" />
                                                                    <span className="text-[9px] font-black text-primary tracking-tight">{branchName}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5 text-right text-sm font-black text-emerald-500 tabular-nums">+{formatCurrency(log.amount, 'GEL')}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeSection === 'trash' && (
                            <div className="p-8 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                                        <Trash2 className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-black text-primary tracking-tight">{l('სანაგვე', 'Корзина', 'Recycle Hub')}</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(settings.trash || []).map(item => (
                                        <div key={item.id} className="bg-surface/40 border border-border-subtle p-5 rounded-[2rem] flex flex-col justify-between hover:border-indigo-500/20 transition-all group/trash group">
                                            <div className="flex items-center gap-4 mb-6">
                                                <div className="w-10 h-10 rounded-xl bg-card border border-border-subtle flex items-center justify-center text-[11px] font-black text-muted">
                                                    {item.type[0]}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-black text-primary truncate tracking-tighter">
                                                        {item.type === 'staff' ? item.data.first_name : item.id}
                                                    </p>
                                                    <p className="text-[8px] font-bold text-red-500/60 tracking-widest">{item.type}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => restoreFromTrash(item.id)} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black tracking-widest shadow-lg shadow-indigo-600/10 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                                {l('აღდგენა', 'Восстановить', 'Restore')}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── FOOTER: TECH SUPPORT ─── */}
                <div className="pt-8">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="bg-violet-500/5 border border-violet-500/10 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6 group hover:bg-violet-500/10 transition-all cursor-pointer" onClick={() => window.dispatchEvent(new CustomEvent('toggle-support'))}>
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-3xl bg-violet-500 text-white flex items-center justify-center shadow-2xl shadow-violet-500/30">
                                    <MessageCircle className="w-8 h-8" />
                                </div>
                                <div>
                                    <h4 className="text-xl font-black text-primary tracking-tight">{l('დახმარება', 'Техподдержка', 'Tech Hub')}</h4>
                                    <p className="text-[10px] font-bold text-violet-400 tracking-widest leading-none mt-2">{l('ონლაინ მხარდაჭერა', 'Онлайн чат', '24/7 Priority Support')}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="hidden sm:flex items-center gap-2.5 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] font-black text-emerald-500 tracking-widest">{l('ონლაინშია', 'Онлайн', 'Live Now')}</span>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-500 group-hover:translate-x-1 transition-transform">
                                    <ChevronRight className="w-6 h-6" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Mobile Support Fab */}
            <button onClick={() => window.dispatchEvent(new CustomEvent('toggle-support'))} className="fixed bottom-6 right-6 md:hidden w-16 h-16 bg-violet-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-violet-500/40 z-[40]">
                <MessageCircle className="w-7 h-7" />
            </button>

            {/* ─── STAFF MODAL (ADD/EDIT) ─── */}
            {(isAddingStaff || !!editingStaff) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => { setIsAddingStaff(false); setEditingStaff(null); }} />
                    <div className="bg-card w-full max-w-2xl rounded-[2.5rem] border border-border-subtle shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                        <div className="p-8 border-b border-border-subtle flex items-center justify-between bg-surface/30 flex-shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-primary tracking-tight">
                                    {editingStaff ? l('რედაქტირება', 'Редактировать', 'Identity Management') : l('პერსონალის დამატება', 'Добавить сотрудника', 'Personnel Registration')}
                                </h3>
                                <p className="text-[9px] font-bold text-muted tracking-widest mt-1">Configure credentials & access level</p>
                            </div>
                            <button onClick={() => { setIsAddingStaff(false); setEditingStaff(null); }} className="w-11 h-11 rounded-xl bg-surface border border-border-subtle flex items-center justify-center text-muted hover:text-primary transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleStaffSubmit} className="p-8 space-y-8 overflow-y-auto no-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted tracking-widest ml-1">{l('სახელი', 'Имя', 'Name')}</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="John Doe..."
                                        className="w-full bg-surface/50 border border-border-subtle rounded-2xl px-5 py-4 text-sm font-bold text-primary focus:border-indigo-500/30 transition-all outline-none"
                                        value={staffForm.first_name}
                                        onChange={e => setStaffForm({ ...staffForm, first_name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted tracking-widest ml-1">{l('როლი', 'Роль', 'Position')}</label>
                                    <SearchSelect
                                        options={[
                                            { value: 'admin', label: 'Admin', subLabel: 'Full System Access' },
                                            { value: 'manager', label: 'Manager', subLabel: 'Operational Access' },
                                            { value: 'teacher', label: 'Teacher', subLabel: 'Classroom Operations' },
                                            { value: 'reception', label: 'Reception', subLabel: 'Entry & Sales' }
                                        ]}
                                        value={staffForm.role}
                                        onChange={val => setStaffForm({ ...staffForm, role: val })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted tracking-widest ml-1">Email / Login</label>
                                    <div className="relative">
                                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/40" />
                                        <input
                                            type="email"
                                            required
                                            placeholder="credentials@access.com"
                                            className="w-full bg-surface/50 border border-border-subtle rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-primary focus:border-indigo-500/30 transition-all outline-none"
                                            value={staffForm.email}
                                            onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted tracking-widest ml-1">{l('პაროლი', 'Пароль', 'Staff Password')}</label>
                                    <div className="relative">
                                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/40" />
                                        <input
                                            type="text"
                                            required
                                            placeholder="Secure key..."
                                            className="w-full bg-surface/50 border border-border-subtle rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-primary focus:border-indigo-500/30 transition-all outline-none"
                                            value={staffForm.password}
                                            onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Branch Assignment */}
                            <div className="space-y-4 pt-4 border-t border-border-subtle">
                                <label className="text-[10px] font-black text-muted tracking-widest ml-1 flex items-center gap-2">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {l('წვდომა ფილიალებზე', 'Доступ к филиалам', 'Branch Access Restrictions')}
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {settings.branches.map(b => (
                                        <div
                                            key={b.id}
                                            onClick={() => {
                                                const current = staffForm.allowedBranchIds;
                                                const next = current.includes(b.id) ? current.filter(id => id !== b.id) : [...current, b.id];
                                                setStaffForm({ ...staffForm, allowedBranchIds: next });
                                            }}
                                            className={cn(
                                                "p-4 rounded-2xl border flex items-center gap-3 cursor-pointer transition-all",
                                                staffForm.allowedBranchIds.includes(b.id) ? "bg-indigo-500/10 border-indigo-500/40" : "bg-card border-border-subtle hover:border-indigo-500/20"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                                                staffForm.allowedBranchIds.includes(b.id) ? "bg-indigo-600 border-indigo-600" : "bg-surface border-border-subtle"
                                            )}>
                                                {staffForm.allowedBranchIds.includes(b.id) && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className={cn("text-[10px] font-black tracking-tight", staffForm.allowedBranchIds.includes(b.id) ? "text-primary" : "text-muted")}>
                                                {b.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[8px] font-bold text-muted/60 text-center">{l('თუ არცერთი ფილიალი არაა არჩეული, წვდომა ყველაზე ექნება', 'Если ничего не выбрано, доступ ко всем филиалам', 'Leave empty for unrestricted access to all current and future branches')}</p>
                            </div>

                            {/* Detailed Permissions */}
                            <div className="space-y-4 pt-4 border-t border-border-subtle">
                                <label className="text-[10px] font-black text-muted tracking-widest ml-1 flex items-center gap-2">
                                    <Shield className="w-3.5 h-3.5" />
                                    {l('უფლებები', 'Разрешения', 'Security & Permissions')}
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <PermissionToggle label={t.permViewAttendance} active={staffForm.permissions.canViewAttendance} onClick={() => setStaffForm({ ...staffForm, permissions: { ...staffForm.permissions, canViewAttendance: !staffForm.permissions.canViewAttendance } })} />
                                    <PermissionToggle label={t.permViewSubscriptions} active={staffForm.permissions.canViewSubscriptions} onClick={() => setStaffForm({ ...staffForm, permissions: { ...staffForm.permissions, canViewSubscriptions: !staffForm.permissions.canViewSubscriptions } })} />
                                    <PermissionToggle label={t.permViewStudents} active={staffForm.permissions.canViewStudents} onClick={() => setStaffForm({ ...staffForm, permissions: { ...staffForm.permissions, canViewStudents: !staffForm.permissions.canViewStudents } })} />
                                    <PermissionToggle label={t.permViewCalendar} active={staffForm.permissions.canViewCalendar} onClick={() => setStaffForm({ ...staffForm, permissions: { ...staffForm.permissions, canViewCalendar: !staffForm.permissions.canViewCalendar } })} />
                                    <PermissionToggle label={t.permEditCalendar} active={staffForm.permissions.canEditCalendar} onClick={() => setStaffForm({ ...staffForm, permissions: { ...staffForm.permissions, canEditCalendar: !staffForm.permissions.canEditCalendar } })} />
                                    <PermissionToggle label={t.permViewGroups} active={staffForm.permissions.canViewGroups} onClick={() => setStaffForm({ ...staffForm, permissions: { ...staffForm.permissions, canViewGroups: !staffForm.permissions.canViewGroups } })} />
                                    <PermissionToggle label={t.permViewTeachers} active={staffForm.permissions.canViewTeachers} onClick={() => setStaffForm({ ...staffForm, permissions: { ...staffForm.permissions, canViewTeachers: !staffForm.permissions.canViewTeachers } })} />
                                    <PermissionToggle label={t.permViewHalls} active={staffForm.permissions.canViewHalls} onClick={() => setStaffForm({ ...staffForm, permissions: { ...staffForm.permissions, canViewHalls: !staffForm.permissions.canViewHalls } })} />
                                    <PermissionToggle label={t.permViewShop} active={staffForm.permissions.canViewShop} onClick={() => setStaffForm({ ...staffForm, permissions: { ...staffForm.permissions, canViewShop: !staffForm.permissions.canViewShop } })} />
                                    <PermissionToggle label={t.permViewAnalytics} active={staffForm.permissions.canViewAnalytics} onClick={() => setStaffForm({ ...staffForm, permissions: { ...staffForm.permissions, canViewAnalytics: !staffForm.permissions.canViewAnalytics } })} />
                                    <PermissionToggle label={t.permViewSMS} active={staffForm.permissions.canViewSMS} onClick={() => setStaffForm({ ...staffForm, permissions: { ...staffForm.permissions, canViewSMS: !staffForm.permissions.canViewSMS } })} />
                                </div>
                            </div>

                            <div className="pt-4">
                                <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-[1.75rem] font-black text-xs tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-all shadow-2xl shadow-indigo-600/30">
                                    {editingStaff ? l('შენახვა', 'Сохранить', 'Authorize Changes') : l('დადასტურება', 'Подтвердить', 'Registry New Member')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── BRANCH MODAL (ADD/EDIT) ─── */}
            {(isAddingBranch || !!editingBranch) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => { setIsAddingBranch(false); setEditingBranch(null); }} />
                    <div className="bg-card w-full max-w-lg rounded-[2.5rem] border border-border-subtle shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-border-subtle flex items-center justify-between bg-surface/30">
                            <div>
                                <h3 className="text-xl font-black text-primary tracking-tight">
                                    {editingBranch ? l('რედაქტირება', 'Редактировать', 'Configure Branch') : l('ფილიალის დამატება', 'Добавить филиал', 'Node Expansion')}
                                </h3>
                                <p className="text-[9px] font-bold text-muted tracking-widest mt-1">Define location & reach</p>
                            </div>
                            <button onClick={() => { setIsAddingBranch(false); setEditingBranch(null); }} className="w-11 h-11 rounded-xl bg-surface border border-border-subtle flex items-center justify-center text-muted hover:text-primary transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleBranchSubmit} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted tracking-widest ml-1">{l('სახელი', 'Имя', 'Official Name')}</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-surface/50 border border-border-subtle rounded-2xl px-5 py-4 text-sm font-bold text-primary focus:border-indigo-500/30 transition-all outline-none"
                                    value={branchForm.name}
                                    onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted tracking-widest ml-1">{l('მისამართი', 'Адрес', 'Physical Address')}</label>
                                <div className="relative">
                                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/40" />
                                    <input
                                        type="text"
                                        placeholder="Street, City, Building..."
                                        className="w-full bg-surface/50 border border-border-subtle rounded-2xl pl-12 pr-5 py-4 text-sm font-bold text-primary focus:border-indigo-500/30 transition-all outline-none"
                                        value={branchForm.address}
                                        onChange={e => setBranchForm({ ...branchForm, address: e.target.value })}
                                    />
                                </div>
                            </div>
                            <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-[1.75rem] font-black text-xs tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-all shadow-2xl shadow-indigo-600/30 mt-4">
                                {editingBranch ? l('განახლება', 'Обновить', 'Apply Location Updates') : l('დადასტურება', 'Подтвердить', 'Initialize Branch')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function PermissionToggle({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
                active ? "bg-indigo-500/5 border-indigo-500/20 shadow-sm" : "bg-card border-border-subtle hover:border-indigo-500/10"
            )}
        >
            <span className={cn("text-[10px] font-black tracking-widest", active ? "text-indigo-500" : "text-muted opacity-40")}>{label}</span>
            <div className={cn(
                "w-9 h-5 rounded-full relative transition-colors",
                active ? "bg-indigo-500" : "bg-muted/20"
            )}>
                <div className={cn(
                    "w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm",
                    active ? "right-0.5" : "left-0.5 outline outline-1 outline-black/5"
                )} />
            </div>
        </div>
    );
}
