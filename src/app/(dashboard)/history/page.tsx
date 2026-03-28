'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { getHistory, AuditEntry } from '@/lib/audit-store';
import { getTrash, removeFromTrash, TrashItem } from '@/lib/trash-store';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Receipt, Search, Download, Trash2, RotateCcw, AlertCircle, Building2, History as HistoryIcon, Clock, CheckCircle2, CreditCard, UserMinus, ShieldAlert, Zap, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';

function getActionMeta(action: string, lang: string) {
    const meta: Record<string, { icon: any, color: string, label: string }> = {
        payment: { icon: CreditCard, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', label: lang === 'ka' ? 'გადახდა' : 'Payment' },
        subscription_issued: { icon: Zap, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20', label: lang === 'ka' ? 'აბონემენტის გააქტიურება' : 'Subscription Issued' },
        subscription_extended: { icon: RefreshCw, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20', label: lang === 'ka' ? 'აბონემენტის გაგრძელება' : 'Subscription Extended' },
        subscription_deleted: { icon: ShieldAlert, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', label: lang === 'ka' ? 'აბონემენტის წაშლა' : 'Subscription Deleted' },
        lesson_checkin: { icon: CheckCircle2, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', label: lang === 'ka' ? 'დასწრება' : 'Lesson Check-in' },
        student_deleted: { icon: UserMinus, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', label: lang === 'ka' ? 'სტუდენტის წაშლა' : 'Student Deleted' },
        staff_deleted: { icon: ShieldAlert, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', label: lang === 'ka' ? 'თანამშრომლის წაშლა' : 'Staff Deleted' },
    };

    return meta[action] || { icon: Receipt, color: 'text-muted bg-surface border-border-subtle', label: action };
}

export default function UnifiedHistoryPage() {
    const { t, lang } = useT();
    const { settings } = useStudio();
    const [activeTab, setActiveTab] = useState<'audit' | 'trash'>('audit');
    const [auditHistory, setAuditHistory] = useState<AuditEntry[]>([]);
    const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
    const [search, setSearch] = useState('');

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
        const { label } = getActionMeta(item.action, lang);
        const searchLower = search.toLowerCase();
        return (
            item.details.toLowerCase().includes(searchLower) ||
            item.studentName?.toLowerCase().includes(searchLower) ||
            item.branchName.toLowerCase().includes(searchLower) ||
            item.performedBy.toLowerCase().includes(searchLower) ||
            label.toLowerCase().includes(searchLower)
        );
    });

    const filteredTrash = trashItems.filter(item => {
        const name = (item.data.name || item.data.fullName || item.data.first_name || item.type).toLowerCase();
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

    const handleRestore = (item: TrashItem) => {
        const keyMap: Record<string, string> = {
            'student': 'cc_students',
            'teacher': 'cc_teachers',
            'subscription': 'cc_subscriptions',
            'group': 'cc_groups'
        };

        const prefix = keyMap[item.type];
        if (prefix) {
            const branchSlug = settings.studioSlug;
            const storageKey = `${prefix}_${branchSlug}_${item.branchId}`;
            const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
            localStorage.setItem(storageKey, JSON.stringify([...existing, item.data]));

            removeFromTrash(item.id);
            window.dispatchEvent(new Event(`cc_${item.type}s_update`));
            alert(lang === 'ka' ? 'აღდგენილია!' : 'Restored!');
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-4 md:space-y-8">
                    <div className="flex items-center justify-between gap-2 w-full px-1 sm:px-0">
                        {/* Tab Navigation */}
                        <div className="flex-1 h-10 flex gap-1 p-1 bg-card border border-border-subtle rounded-2xl overflow-hidden sm:flex-none sm:w-fit">
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

                        {activeTab === 'audit' && (
                            <button
                                onClick={exportToCSV}
                                className="bg-white text-black h-10 w-10 sm:w-auto sm:px-5 rounded-2xl font-black text-[10px] tracking-widest flex items-center justify-center gap-2 hover:scale-[0.98] transition-all shadow-sm border border-border-subtle shrink-0"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{t.exportExcel || 'Export'}</span>
                            </button>
                        )}
                    </div>
                    {/* Alert for Trash */}
                    {activeTab === 'trash' && (
                        <div className="bg-amber-500/10 border-l-[6px] border-l-amber-500 border-amber-500/20 rounded-2xl p-5 flex items-center gap-5 animate-in fade-in slide-in-from-top-4 duration-500 shadow-xl shadow-amber-500/5">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                                <AlertCircle className="w-6 h-6 text-amber-500" strokeWidth={3} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-primary tracking-tight leading-tight">
                                    {lang === 'ka'
                                        ? 'მონაცემების ავტომატური წაშლა'
                                        : 'Automated Data Cleanup'}
                                </p>
                                <p className="text-xs font-bold text-muted/80 mt-1">
                                    {lang === 'ka'
                                        ? 'ყურადღება: მონაცემები ავტომატურად წაიშლება 30 დღის შემდეგ.'
                                        : 'Note: Information in the trash will be permanently deleted after 30 days.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Content Section */}
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
                                {/* Desktop Table */}
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
                                                        <span className="text-sm font-black text-primary">
                                                            {item.studentName || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-black text-indigo-500">
                                                            {item.amount ? `${item.amount} ₾` : '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border", color)}>
                                                                <Icon className="w-4 h-4" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-black text-primary group-hover:text-indigo-400 transition-colors">
                                                                    {label}: {item.details}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-muted mt-0.5 opacity-60">
                                                                    By: {item.performedBy}
                                                                    {item.paymentMethod && ` • ${item.paymentMethod.toUpperCase()}`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* Mobile Card List */}
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
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[11px] font-black text-primary tracking-tight leading-none truncate">{label}</span>
                                                            <span className="text-[9px] font-bold text-muted mt-1 uppercase tracking-widest truncate">
                                                                {item.branchName === 'მთავარი ფილიალი' ? (lang === 'ka' ? 'მთავარი' : 'Main') : item.branchName}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-[11px] font-black text-primary leading-none">
                                                            {new Date(item.timestamp).toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US', { day: '2-digit', month: 'short' })}
                                                        </p>
                                                        <p className="text-[9px] font-bold text-muted/60 mt-1">
                                                            {new Date(item.timestamp).toLocaleTimeString(lang === 'ka' ? 'ka-GE' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="pl-0">
                                                    <p className="text-xs font-bold text-primary leading-snug">
                                                        {item.details}
                                                    </p>
                                                    
                                                    {item.studentName && (
                                                        <div className="mt-1.5 flex items-center gap-1.5 opacity-80">
                                                            <div className="w-1 h-1 rounded-full bg-indigo-500" />
                                                            <span className="text-[10px] font-black text-primary">{item.studentName}</span>
                                                        </div>
                                                    )}

                                                    <div className="mt-3 flex items-center justify-between">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <span className="text-[9px] font-bold text-muted/80 italic shrink-0">
                                                                By {item.performedBy}
                                                            </span>
                                                            {item.paymentMethod && (
                                                                <span className="px-1.5 py-0.5 rounded bg-surface border border-border-subtle text-[8px] font-black uppercase tracking-tighter text-muted shrink-0">
                                                                    {lang === 'ka' ? (item.paymentMethod === 'cash' ? 'ნაღდი' : item.paymentMethod === 'card' ? 'ბარათი' : 'გადმორიცხვა') : item.paymentMethod}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.amount && (
                                                            <span className="bg-emerald-500/10 text-emerald-500 px-2.5 py-0.5 rounded-full text-[10px] font-black border border-emerald-500/10 whitespace-nowrap shrink-0">
                                                                {item.amount} ₾
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {filteredAudit.length === 0 && (
                                    <div className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-20">
                                            <Receipt className="w-16 h-16" />
                                            <p className="text-sm font-black tracking-widest uppercase">{t.noData}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredTrash.map(item => (
                                    <div key={item.id} className="p-4 md:p-6 bg-surface/50 rounded-[1.5rem] md:rounded-[2rem] border border-border-subtle hover:border-rose-500/30 transition-all group relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-3 md:p-4">
                                            <div className="flex items-center gap-1.5 text-rose-500/40">
                                                <Clock className="w-2.5 h-2.5 md:w-3 h-3" />
                                                <span className="text-[8px] md:text-[9px] font-black tracking-widest">
                                                    30d left
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 md:gap-4">
                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-card border border-border-subtle flex items-center justify-center text-muted group-hover:text-rose-500 group-hover:bg-rose-500/5 transition-all shrink-0">
                                                <Building2 className="w-5 h-5 md:w-6 md:h-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm md:text-base font-black text-primary truncate tracking-tight">
                                                    {item.data.name || item.data.fullName || item.data.first_name || 'Unnamed Item'}
                                                </h3>
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-0.5 md:mt-1">
                                                    <span className="w-fit text-[9px] md:text-[10px] font-black text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                                                        {item.type}
                                                    </span>
                                                    <span className="text-[9px] md:text-[10px] font-bold text-muted">
                                                        Deleted {new Date(item.deletedAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRestore(item)}
                                                className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all shadow-lg active:scale-95 shrink-0"
                                                title="Restore"
                                            >
                                                <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
                                            </button>
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
