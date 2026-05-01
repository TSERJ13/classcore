'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { getTrash, removeFromTrash, TrashItem } from '@/lib/trash-store';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Trash2, Search, RotateCcw, AlertCircle, Building2, User, Users, CreditCard, Mail, Phone, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { cn, getScopedKey } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';
import { useConfirm } from '@/contexts/ConfirmContext';

export default function TrashPage() {
    const { t, lang } = useT();
    const { settings } = useStudio();
    const { confirm, alert } = useConfirm();
    const [trash, setTrash] = useState<TrashItem[]>([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setTrash(getTrash());
        const handler = () => setTrash(getTrash());
        window.addEventListener('cc_trash_update', handler);
        return () => window.removeEventListener('cc_trash_update', handler);
    }, []);

    const filtered = trash.filter(item => {
        const name = (item.data.name || item.data.fullName || item.data.full_name || item.type).toLowerCase();
        return name.includes(search.toLowerCase());
    });

    const handleRestore = async (item: TrashItem) => {
        const typeMap: Record<string, { key: string; event: string }> = {
            'student': { key: 'cc_student_data', event: 'cc_student_update' },
            'teacher': { key: 'cc_teachers', event: 'cc_teacher_update' },
            'subscription': { key: 'cc_student_subscriptions', event: 'cc_subscription_update' },
            'group': { key: 'cc_groups', event: 'cc_group_update' }
        };

        const config = typeMap[item.type];
        if (config) {
            const storageKey = getScopedKey(config.key);
            const raw = localStorage.getItem(storageKey);
            
            if (item.type === 'student') {
                const existing = JSON.parse(raw || '{}');
                existing[item.data.id] = item.data;
                localStorage.setItem(storageKey, JSON.stringify(existing));
            } else if (item.type === 'subscription') {
                const existing = JSON.parse(raw || '{}');
                const studentId = item.data.student_id;
                if (studentId) {
                    if (!existing[studentId]) existing[studentId] = [];
                    existing[studentId].push(item.data);
                    localStorage.setItem(storageKey, JSON.stringify(existing));
                }
            } else {
                const existing = JSON.parse(raw || '[]');
                localStorage.setItem(storageKey, JSON.stringify([...existing, item.data]));
            }

            removeFromTrash(item.id);
            window.dispatchEvent(new Event(config.event));
            await alert(lang === 'ka' ? 'აღდგენილია!' : 'Restored!');
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'student': return <User className="w-5 h-5" />;
            case 'teacher': return <Users className="w-5 h-5" />;
            case 'subscription': return <CreditCard className="w-5 h-5" />;
            case 'group': return <Building2 className="w-5 h-5" />;
            default: return <Trash2 className="w-5 h-5" />;
        }
    };

    const getDisplayName = (item: TrashItem) => {
        return item.data.name || item.data.fullName || item.data.full_name || 'Unnamed Item';
    };

    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-surface/30 pb-20">
                <div className="max-w-6xl mx-auto space-y-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-start gap-4">
                            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0 shadow-2xl border border-rose-500/20">
                                <Trash2 className="w-8 h-8" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-primary tracking-tight">
                                    {t.trash}
                                </h1>
                                <p className="text-xs text-muted font-black tracking-widest mt-1 opacity-40 uppercase">
                                    {lang === 'ka' ? '30 დღიანი შენახვის ვადა' : '30-day retention policy'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-[2rem] p-5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <p className="text-[11px] font-black text-amber-500/80 tracking-widest uppercase leading-relaxed">
                            {lang === 'ka'
                                ? 'გაფრთხილება: მონაცემები სამუდამოდ წაიშლება 30 დღის შემდეგ.'
                                : 'Warning: Items will be permanently removed after 30 days.'}
                        </p>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted opacity-40" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t.search}
                            className="w-full bg-card border border-border-subtle rounded-[2.5rem] pl-16 pr-8 py-6 text-base font-black focus:outline-none focus:border-rose-500/50 transition-all shadow-xl placeholder:opacity-20"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {filtered.map(item => (
                            <div key={item.id} className="bg-card border border-border-subtle rounded-[2rem] p-6 hover:border-rose-500/30 transition-all group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-500/20 group-hover:bg-rose-500 transition-all" />
                                
                                <div className="flex items-center gap-5 flex-1 min-w-0">
                                    <div className="w-14 h-14 rounded-2xl bg-surface border border-border-subtle flex items-center justify-center text-muted group-hover:text-rose-500 group-hover:bg-rose-500/5 transition-all flex-shrink-0">
                                        {getTypeIcon(item.type)}
                                    </div>
                                    <div className="min-w-0 space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-black text-rose-500/60 bg-rose-500/5 px-2 py-0.5 rounded-full border border-rose-500/10 uppercase tracking-widest">
                                                {item.type}
                                            </span>
                                            <span className="text-[10px] font-black text-muted opacity-40 uppercase tracking-tighter">
                                                ID: {item.id.split('_').pop()?.substring(0, 8)}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-black text-primary truncate tracking-tight">
                                            {getDisplayName(item)}
                                        </h3>
                                        
                                        {/* Detailed Info Grid */}
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                            {(item.data.phone || item.data.email) && (
                                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted/60">
                                                    {item.data.phone ? <Phone className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                                                    <span>{item.data.phone || item.data.email}</span>
                                                </div>
                                            )}
                                            {item.data.plan_name && (
                                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-500/60">
                                                    <CreditCard className="w-3 h-3" />
                                                    <span>{item.data.plan_name}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-500/40">
                                                <CalendarIcon className="w-3 h-3" />
                                                <span>{lang === 'ka' ? 'წაიშალა' : 'Deleted'}: {new Date(item.deletedAt).toLocaleDateString()}</span>
                                            </div>
                                            
                                            {item.deletedBy && (
                                                <div className="flex items-center gap-1.5 text-[11px] font-black text-primary/40 bg-surface px-2 py-0.5 rounded-lg border border-border-subtle">
                                                    <User className="w-3 h-3" />
                                                    <span>{item.deletedBy}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-row items-center gap-4 w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-border-subtle/30 pt-4 sm:pt-0">
                                    <div className="flex flex-col items-start sm:items-end flex-1 sm:flex-none">
                                        <span className="text-[10px] font-black text-rose-500/40 tracking-widest uppercase">
                                            {lang === 'ka' ? 'ვადა' : 'Expires'}
                                        </span>
                                        <div className="flex items-center gap-1 text-xs font-black text-rose-500/60 tabular-nums">
                                            <Clock className="w-3 h-3" />
                                            {Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} {lang === 'ka' ? 'დღე' : 'days'}
                                        </div>
                                    </div>
                                    
                                    <button
                                        onClick={() => handleRestore(item)}
                                        className="h-12 px-6 sm:h-14 sm:px-8 rounded-2xl bg-indigo-500 text-white flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-500/20 active:scale-95 group/btn shrink-0"
                                    >
                                        <RotateCcw className="w-5 h-5 group-hover/btn:-rotate-45 transition-transform" />
                                        <span className="text-[11px] font-black tracking-widest uppercase">{lang === 'ka' ? 'აღდგენა' : 'Restore'}</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {filtered.length === 0 && (
                            <div className="py-32 bg-surface/10 rounded-[3rem] border-2 border-dashed border-border-subtle/50 flex flex-col items-center justify-center text-muted opacity-20">
                                <Trash2 className="w-20 h-20 mb-6" strokeWidth={1} />
                                <p className="text-sm font-black tracking-[0.2em] uppercase">{t.noData || 'Empty'}</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
