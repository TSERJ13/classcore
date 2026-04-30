'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { getHistory, AuditEntry } from '@/lib/audit-store';
import { getTrash, removeFromTrash, clearTrash, TrashItem } from '@/lib/trash-store';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Receipt, Search, Download, Trash2, RotateCcw, AlertCircle, Building2, History as HistoryIcon, Clock, CheckCircle2, CreditCard, UserMinus, ShieldAlert, Zap, RefreshCw, CalendarDays, User, Users, RefreshCcw } from 'lucide-react';
import { cn, getScopedKey } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';
import { useConfirm } from '@/contexts/ConfirmContext';

function getActionMeta(action: string, lang: string) {
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const meta: Record<string, { icon: any, color: string, label: string }> = {
        payment: { icon: CreditCard, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', label: l('გადახდა', 'Оплата', 'Payment') },
        subscription_issued: { icon: Zap, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20', label: l('აბონემენტის გააქტიურება', 'Активация подписки', 'Subscription Issued') },
        subscription_extended: { icon: RefreshCw, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20', label: l('აბონემენტის გაგრძელება', 'Продление подписки', 'Subscription Extended') },
        subscription_deleted: { icon: ShieldAlert, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', label: l('აბონემენტის წაშლა', 'Удаление подписки', 'Subscription Deleted') },
        lesson_checkin: { icon: CalendarDays, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', label: l('გაკვეთილზე დასწრება', 'Отметка на уроке', 'Lesson Check-in') },
        student_deleted: { icon: Trash2, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', label: l('სტუდენტის წაშლა', 'Удаление студента', 'Student Deleted') },
        staff_deleted: { icon: ShieldAlert, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', label: l('თანამშრომლის წაშლა', 'Удаление сотрудника', 'Staff Deleted') },
        group_deleted: { icon: Trash2, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', label: l('ჯგუფის წაშლა', 'Удаление группы', 'Group Deleted') },
    };

    return meta[action] || { icon: Receipt, color: 'text-muted bg-surface border-border-subtle', label: action };
}

export default function UnifiedHistoryPage() {
    const { t, lang } = useT();
    const { settings } = useStudio();
    const confirm = useConfirm();
    const [activeTab, setActiveTab] = useState<'audit' | 'trash'>('audit');
    const [auditHistory, setAuditHistory] = useState<AuditEntry[]>([]);
    const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
    const [search, setSearch] = useState('');

    const formatDate = (date: any) => new Date(date).toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US', { day: '2-digit', month: 'short' });

    useEffect(() => {
        setAuditHistory(getHistory());
        setTrashItems(getTrash());

        const histHandler = () => setAuditHistory(getHistory());
        const trashHandler = () => setTrashItems(getTrash());

        window.addEventListener('cc_history_update', histHandler);
        window.addEventListener('cc_trash_update', trashHandler);

        return () => {
            window.removeEventListener('cc_history_update', histHandler);
            window.removeEventListener('cc_trash_update', trashHandler);
        };
    }, []);

    const filteredAudit = auditHistory.filter(item => {
        const { label } = getActionMeta(item.action || '', lang);
        const searchLower = search.toLowerCase();
        return (
            (item.details || "").toLowerCase().includes(searchLower) ||
            (item.studentName || "").toLowerCase().includes(searchLower) ||
            (item.branchName || "").toLowerCase().includes(searchLower) ||
            (item.performedBy || "").toLowerCase().includes(searchLower) ||
            (label || "").toLowerCase().includes(searchLower)
        );
    });

    const filteredTrash = trashItems.filter(item => {
        const data = item.data || {};
        const name = (data.name || data.fullName || data.first_name || item.type || "").toLowerCase();
        return name.includes(search.toLowerCase());
    });

    const exportToCSV = () => {
        if (activeTab !== 'audit') return;
        const headers = ["Date", "Branch", "Action", "Student", "Amount", "Details", "Performed By"];
        const rows = filteredAudit.map(item => [
            new Date(item.timestamp).toLocaleString(lang === 'ka' ? 'ka-GE' : lang === 'ru' ? 'ru-RU' : 'en-US'),
            item.branchName,
            item.action,
            item.studentName || '-',
            item.amount || '0',
            item.details,
            item.performedBy
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `history_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleRestore = async (item: TrashItem) => {
        const keyMap: Record<string, string> = {
            'student': 'cc_students',
            'teacher': 'cc_teachers',
            'subscription': 'cc_subscriptions',
            'group': 'cc_groups'
        };

        const prefix = keyMap[item.type];
        if (prefix) {
            const storageKey = getScopedKey(prefix, settings.studioSlug, item.branchId);
            const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
            localStorage.setItem(storageKey, JSON.stringify([...existing, item.data]));

            removeFromTrash(item.id);
            window.dispatchEvent(new Event(`cc_${item.type}s_update`));
            await confirm.alert({
                message: lang === 'ka' ? 'აღდგენილია!' : 'Restored!',
                confirmText: t.ok || 'OK'
            });
        }
    };

    const handleDeletePermanently = async (id: string) => {
        if (await confirm({
            message: lang === 'ka' ? 'დარწმუნებული ხართ რომ გსურთ სრულად წაშლა? მონაცემი აღარ აღდგება.' : 'Are you sure you want to permanently delete? This cannot be undone.',
            danger: true
        })) {
            removeFromTrash(id);
        }
    };

    const handleClearTrash = async () => {
        if (await confirm({
            message: lang === 'ka' ? 'ნამდვილად გსურთ ნაგვის ყუთის სრულად გასუფთავება?' : 'Are you sure you want to empty the trash?',
            danger: true
        })) {
            clearTrash();
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-4 md:space-y-8">
                    <div className="flex items-center justify-between gap-2 w-full px-1 sm:px-0">
                        <div className="flex-1 h-12 flex gap-1 p-1 bg-card border border-border-subtle rounded-[1.25rem] overflow-hidden sm:flex-none sm:w-fit shadow-sm">
                            <button
                                onClick={() => setActiveTab('audit')}
                                className={cn(
                                    "flex-1 px-4 sm:px-6 rounded-xl text-[10px] sm:text-xs font-black tracking-widest transition-all whitespace-nowrap text-center flex items-center justify-center h-full",
                                    activeTab === 'audit' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-muted hover:text-primary hover:bg-surface"
                                )}
                            >
                                <HistoryIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                                {t.history}
                            </button>
                            <button
                                onClick={() => setActiveTab('trash')}
                                className={cn(
                                    "flex-1 px-4 sm:px-6 rounded-xl text-[10px] sm:text-xs font-black tracking-widest transition-all whitespace-nowrap text-center flex items-center justify-center h-full",
                                    activeTab === 'trash' ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "text-muted hover:text-primary hover:bg-surface"
                                )}
                            >
                                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                                {t.trash}
                            </button>
                        </div>

                        {activeTab === 'audit' ? (
                            <button
                                onClick={exportToCSV}
                                className="bg-white text-black h-12 w-12 sm:w-auto sm:px-5 rounded-[1.25rem] font-black text-[10px] tracking-widest flex items-center justify-center gap-2 hover:scale-[0.98] transition-all shadow-sm border border-border-subtle shrink-0"
                            >
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">{t.exportExcel || 'Export'}</span>
                            </button>
                        ) : (
                            <button
                                onClick={handleClearTrash}
                                disabled={filteredTrash.length === 0}
                                className="bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white disabled:opacity-50 disabled:hover:bg-rose-500/10 disabled:hover:text-rose-500 h-12 w-12 sm:w-auto sm:px-5 rounded-[1.25rem] font-black text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm shrink-0"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span className="hidden sm:inline">{lang === 'ka' ? 'გასუფთავება' : 'Empty Trash'}</span>
                            </button>
                        )}
                    </div>
                    {activeTab === 'trash' && (
                        <div className="bg-amber-500/10 border-l-[6px] border-l-amber-500 border-amber-500/20 rounded-2xl p-5 flex items-center gap-5 animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl shadow-amber-500/5">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                                <AlertCircle className="w-6 h-6 text-amber-500" strokeWidth={3} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-primary tracking-tight leading-tight">
                                    {lang === 'ka' ? 'მონაცემების ავტომატური წაშლა' : 'Automated Data Cleanup'}
                                </p>
                                <p className="text-xs font-bold text-muted/80 mt-1">
                                    {lang === 'ka' ? 'ყურადღება: მონაცემები ავტომატურად წაიშლება 30 დღის შემდეგ.' : 'Note: Information in the trash will be permanently deleted after 30 days.'}
                                </p>
                            </div>
                        </div>
                    )}

                    <Card className="rounded-[1.5rem] md:rounded-[2rem] border-border-subtle shadow-2xl overflow-hidden min-h-[400px]">
                        <div className="p-3 md:p-4 flex flex-col md:flex-row gap-3 md:gap-4 border-b border-border-subtle/50">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/50" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder={t.search}
                                    className="w-full bg-surface/50 border border-border-subtle rounded-xl md:rounded-2xl pl-11 pr-4 py-2.5 md:py-3 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-muted/30"
                                />
                            </div>
                        </div>

                        {activeTab === 'audit' ? (
                            <div className="overflow-x-auto overflow-hidden">
                                <table className="w-full text-left hidden md:table">
                                    <thead>
                                        <tr className="border-b border-border-subtle/50">
                                            <th className="px-6 py-4 text-[10px] font-black text-muted tracking-widest uppercase">{t.calDate}</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted tracking-widest uppercase">{lang === 'ka' ? 'ფილიალი' : 'Branch'}</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted tracking-widest uppercase">{t.student}</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted tracking-widest uppercase">{t.price}</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted tracking-widest uppercase">{t.info}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-subtle/30">
                                        {filteredAudit.map(item => {
                                            const { icon: Icon, color, label } = getActionMeta(item.action, lang);
                                            return (
                                                <tr key={item.id} className="hover:bg-surface/30 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-black text-primary">
                                                                {new Date(item.timestamp).toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-muted">
                                                                {new Date(item.timestamp).toLocaleTimeString(lang === 'ka' ? 'ka-GE' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-[10px] font-black tracking-wider border border-indigo-500/10">
                                                            {item.branchName === 'მთავარი ფილიალი' ? (lang === 'ka' ? 'მთავარი' : 'Main') : item.branchName}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-black text-primary">{item.studentName || '-'}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-black text-indigo-500">{item.amount ? `${item.amount} ₾` : '-'}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border", color)}>
                                                                <Icon className="w-4 h-4" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-black text-primary group-hover:text-indigo-400 transition-colors">
                                                                    {label}
                                                                </span>
                                                                {item.details && item.details !== item.studentName && (
                                                                    <span className="text-[10px] font-bold text-muted mt-0.5 opacity-60">
                                                                        {item.details}
                                                                    </span>
                                                                )}
                                                                <span className="text-[9px] font-black text-indigo-500/40 uppercase tracking-widest mt-1">
                                                                    By: {item.performedBy || 'System'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                <div className="flex flex-col md:hidden divide-y divide-border-subtle/10 overflow-hidden">
                                    {filteredAudit.map(item => {
                                        const { icon: Icon, color, label } = getActionMeta(item.action, lang);
                                        return (
                                            <div key={item.id} className="p-4 space-y-2.5 active:bg-surface/50 transition-colors">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border shadow-sm shrink-0", color)}>
                                                            <Icon className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0 flex-1 py-0.5">
                                                            <p className="text-[11px] md:text-[13px] font-black text-primary leading-tight">
                                                                {label}: <span className="text-indigo-500/80 font-bold">{item.details}</span>
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1.5 opacity-40">
                                                                <p className="text-[8px] md:text-[9px] font-black tracking-[0.15em] uppercase">
                                                                    By: {item.performedBy || 'System'}
                                                                </p>
                                                                {item.branchName && (
                                                                    <>
                                                                        <span className="w-1 h-1 rounded-full bg-current opacity-20" />
                                                                        <p className="text-[8px] md:text-[9px] font-black tracking-[0.15em] uppercase">
                                                                            {item.branchName}
                                                                        </p>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-[11px] font-black text-primary leading-none">
                                                            {new Date(item.timestamp).toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US', { day: '2-digit', month: 'short' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 flex flex-col gap-4">
                                {filteredTrash.map(item => (
                                    <div key={item.id} className="p-3 md:p-4 bg-surface/50 rounded-[1.25rem] md:rounded-[1.5rem] border border-border-subtle hover:border-rose-500/30 transition-all group relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-2 md:p-3">
                                            <div className="flex items-center gap-1.5 text-rose-500/40">
                                                <Clock className="w-2.5 h-2.5" />
                                                <span className="text-[8px] md:text-[9px] font-black tracking-widest">
                                                    30d left
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-card border border-border-subtle flex items-center justify-center text-muted group-hover:text-rose-500 group-hover:bg-rose-500/5 transition-all shrink-0">
                                                <Building2 className="w-4 h-4 md:w-5 md:h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0 pr-12 sm:pr-0">
                                                <h3 className="text-[13px] sm:text-sm font-black text-primary truncate tracking-tight">
                                                    {item.data.name || item.data.fullName || item.data.first_name || item.data.full_name || 'Unnamed Item'}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10 uppercase tracking-tighter">
                                                        {item.type}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-muted/60">
                                                        {lang === 'ka' ? 'წაიშალა' : 'Deleted'} {new Date(item.deletedAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    onClick={() => handleDeletePermanently(item.id)}
                                                    className="w-8 h-8 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-surface border border-border-subtle text-muted hover:bg-rose-500 hover:text-white hover:border-rose-500 flex items-center justify-center transition-all shadow-sm active:scale-95"
                                                    title={lang === 'ka' ? 'სრულად წაშლა' : 'Delete Permanently'}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleRestore(item)}
                                                    className="w-8 h-8 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all shadow-sm active:scale-95"
                                                    title={lang === 'ka' ? 'აღდგენა' : 'Restore'}
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {filteredTrash.length === 0 && (
                                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-muted opacity-20">
                                        <Trash2 className="w-16 h-16 mb-4" />
                                        <p className="text-sm font-black tracking-widest">{t.noData}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
        </div>
    );
}
