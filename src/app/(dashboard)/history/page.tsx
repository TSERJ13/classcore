'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { getHistory, AuditEntry } from '@/lib/audit-store';
import { getTrash, removeFromTrash, TrashItem } from '@/lib/trash-store';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Receipt, Search, Download, Trash2, RotateCcw, AlertCircle, Building2, History as HistoryIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';

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

    const filteredAudit = auditHistory.filter(item =>
        item.details.toLowerCase().includes(search.toLowerCase()) ||
        item.studentName?.toLowerCase().includes(search.toLowerCase()) ||
        item.branchName.toLowerCase().includes(search.toLowerCase())
    );

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
        <div className="flex flex-col h-screen">
            <Header />
            <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-surface/30">
                <div className="max-w-6xl mx-auto space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Tab Navigation */}
                        <div className="flex gap-2 p-1 bg-card border border-border-subtle rounded-2xl w-fit">
                            <button
                                onClick={() => setActiveTab('audit')}
                                className={cn(
                                    "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                    activeTab === 'audit' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-muted hover:text-primary hover:bg-surface"
                                )}
                            >
                                <HistoryIcon className="w-4 h-4 inline-block mr-2" />
                                {t.history}
                            </button>
                            <button
                                onClick={() => setActiveTab('trash')}
                                className={cn(
                                    "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                    activeTab === 'trash' ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "text-muted hover:text-primary hover:bg-surface"
                                )}
                            >
                                <Trash2 className="w-4 h-4 inline-block mr-2" />
                                {t.trash}
                            </button>
                        </div>

                        {activeTab === 'audit' && (
                            <button
                                onClick={exportToCSV}
                                className="bg-white text-black px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl border border-border-subtle"
                            >
                                <Download className="w-3.5 h-3.5" />
                                {t.exportExcel || 'Export'}
                            </button>
                        )}
                    </div>

                    {/* Alert for Trash */}
                    {activeTab === 'trash' && (
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                            <p className="text-xs font-bold text-amber-200/80 uppercase tracking-wider">
                                {lang === 'ka'
                                    ? 'მონაცემები ავტომატურად წაიშლება 30 დღის შემდეგ.'
                                    : 'Data will be permanently deleted after 30 days.'}
                            </p>
                        </div>
                    )}

                    {/* Content Section */}
                    <Card className="p-2 rounded-[2rem] border-border-subtle shadow-2xl overflow-hidden min-h-[400px]">
                        <div className="p-4 flex flex-col md:flex-row gap-4 border-b border-border-subtle/50">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder={t.search}
                                    className="w-full bg-surface/50 border border-border-subtle rounded-2xl pl-12 pr-4 py-3 text-sm font-black focus:outline-none focus:border-indigo-500/50 transition-all"
                                />
                            </div>
                        </div>

                        {activeTab === 'audit' ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-border-subtle/50">
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">{t.calDate}</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">{lang === 'ka' ? 'ფილიალი' : 'Branch'}</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">{t.student}</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">{t.price}</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-muted uppercase tracking-widest">{t.info}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-subtle/30">
                                        {filteredAudit.map(item => (
                                            <tr key={item.id} className="hover:bg-surface/30 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-primary">
                                                            {new Date(item.timestamp).toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-muted uppercase">
                                                            {new Date(item.timestamp).toLocaleTimeString(lang === 'ka' ? 'ka-GE' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-wider border border-indigo-500/10">
                                                        {item.branchName}
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
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-primary group-hover:text-indigo-400 transition-colors">
                                                            {item.details}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-muted uppercase mt-0.5 opacity-60">
                                                            By: {item.performedBy}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredAudit.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center">
                                                    <div className="flex flex-col items-center gap-3 opacity-20">
                                                        <Receipt className="w-12 h-12" />
                                                        <p className="text-sm font-black uppercase tracking-widest">{t.noData}</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredTrash.map(item => (
                                    <div key={item.id} className="p-6 bg-surface/50 rounded-[2rem] border border-border-subtle hover:border-rose-500/30 transition-all group relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4">
                                            <div className="flex items-center gap-1.5 text-rose-500/40">
                                                <Clock className="w-3 h-3" />
                                                <span className="text-[9px] font-black uppercase tracking-widest">
                                                    30d left
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-card border border-border-subtle flex items-center justify-center text-muted group-hover:text-rose-500 group-hover:bg-rose-500/5 transition-all">
                                                <Building2 className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-base font-black text-primary truncate uppercase tracking-tight">
                                                    {item.data.name || item.data.fullName || item.data.first_name || 'Unnamed Item'}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-black text-indigo-400 uppercase bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                                                        {item.type}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-muted uppercase">
                                                        Deleted {new Date(item.deletedAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRestore(item)}
                                                className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all shadow-lg active:scale-95"
                                                title="Restore"
                                            >
                                                <RotateCcw className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {filteredTrash.length === 0 && (
                                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-muted opacity-20">
                                        <Trash2 className="w-16 h-16 mb-4" />
                                        <p className="text-sm font-black uppercase tracking-widest">{t.noData}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                </div>
            </main>
        </div>
    );
}
