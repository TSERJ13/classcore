'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, Zap, Clock, User, Link as LinkIcon, AlertCircle, Pause, CreditCard, Trash2, Edit2 } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { cn } from '@/lib/utils';
import { getSubscriptions, deleteSubscription, saveSubscription, type SubscriptionInfo } from '@/lib/subscription-store';
import { getStudents } from '@/lib/student-store';
import { SubscriptionModal } from '@/components/subscriptions/SubscriptionModal';
import { IssueSubscriptionModal } from '@/components/subscriptions/IssueSubscriptionModal';

export default function SubscriptionsPage() {
    const { t, lang } = useT();
    const confirm = useConfirm();
    const students = getStudents();
    const [tab, setTab] = useState<'active' | 'paused' | 'expired'>('active');
    const [category, setCategory] = useState<'group' | 'individual'>('group');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<SubscriptionInfo | null>(null);
    const [issuing, setIssuing] = useState(false);
    const [subsData, setSubsData] = useState<Record<string, SubscriptionInfo[]>>({});

    useEffect(() => {
        function load() { setSubsData(getSubscriptions() || {}); }
        load();
        window.addEventListener('cc_subscription_update', load);
        return () => window.removeEventListener('cc_subscription_update', load);
    }, []);

    // Flatten and sort subscriptions (newest first)
    const allSubs: SubscriptionInfo[] = [];
    if (subsData && typeof subsData === 'object') {
        Object.keys(subsData).forEach(studentId => {
            const subsArray = subsData[studentId];
            if (Array.isArray(subsArray)) {
                subsArray.forEach(sub => {
                    if (sub && typeof sub === 'object') {
                        allSubs.push({ ...sub, student_id: studentId });
                    }
                });
            }
        });
    }

    const sortedSubs = [...allSubs].sort((a, b) => {
        const dateA = new Date(a?.purchased_at || 0).getTime();
        const dateB = new Date(b?.purchased_at || 0).getTime();
        return dateB - dateA;
    });

    const filtered = sortedSubs.filter(s => {
        if (!s) return false;
        const matchesTab = s.status === tab;
        const matchesCategory = category === 'group' ? s.plan_type !== 'individual' : s.plan_type === 'individual';
        const st = Array.isArray(students) ? students.find(x => x && x.id === s.student_id) : null;
        
        const searchLower = search?.toLowerCase() || '';
        const nameMatch = st?.full_name?.toLowerCase().includes(searchLower) ||
            st?.first_name?.toLowerCase().includes(searchLower) ||
            st?.last_name?.toLowerCase().includes(searchLower);
        const idMatch = s.student_id?.toLowerCase().includes(searchLower);
            
        const matchesSearch = !search || nameMatch || idMatch;
        return matchesTab && matchesCategory && matchesSearch;
    });

    const renderEmpty = () => (
        <div className="p-16 text-center border-2 border-dashed border-border-subtle/50 rounded-3xl space-y-3">
            <div className="w-12 h-12 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-2">
                <CreditCard className="w-6 h-6 text-muted/30" />
            </div>
            <p className="text-sm font-medium text-muted">{lang === 'ka' ? 'აბონემენტი არ არის' : lang === 'ru' ? 'Нет абонемента' : 'No Subscriptions'}</p>
        </div>
    );

    const renderSub = (s: SubscriptionInfo) => {
        const st = students.find(x => x.id === s.student_id);
        const studentName = st?.full_name || `${st?.first_name || ''} ${st?.last_name || ''}`.trim() || 'უცნობი სტუდენტი';
        const initial = studentName.charAt(0);

        const isIndividual = s.plan_type === 'individual';
        const borderCls = isIndividual
            ? 'border-2 border-amber-500/30 hover:border-amber-500/60 shadow-amber-500/5'
            : 'border-2 border-indigo-500/30 hover:border-indigo-500/60 shadow-indigo-500/5';

        return (
            <div key={s.id}
                className={cn(
                    "group bg-card rounded-[2rem] p-5 transition-all duration-300 shadow-sm relative overflow-hidden flex flex-col hover:shadow-xl",
                    borderCls
                )}>
                <div className="flex items-start gap-4">
                    {st?.photo_url ? (
                        <img src={st.photo_url} alt={studentName} className="w-12 h-12 object-cover rounded-2xl border border-border-subtle/50 shadow-sm flex-shrink-0" />
                    ) : (
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 font-bold border border-indigo-500/20 text-sm flex-shrink-0 shadow-sm">
                            {initial}
                        </div>
                    )}
                    <div className="flex-1 min-w-0 pr-16 mt-0.5">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <h3 className="text-sm font-black text-primary truncate max-w-full leading-none group-hover:text-indigo-600 transition-colors">{studentName}</h3>
                            <span className="text-[10px] bg-surface px-1.5 py-0.5 rounded-md text-muted whitespace-nowrap hidden sm:inline-block border border-border-subtle/50">({s.student_id})</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-2.5">
                            <span className={cn(
                                "text-[10px] font-black px-2 py-0.5 border rounded-lg tracking-wider leading-none shadow-sm",
                                isIndividual ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                            )}>
                                {(s.plan || 'სტანდარტული').toUpperCase()}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
                                <Clock className="w-3.5 h-3.5 opacity-60" />
                                <span>ვადა: <b className="text-primary">{s.expires_at}</b></span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
                                {s.type === 'sessions' ? (
                                    <>
                                        <Users className="w-3.5 h-3.5 opacity-60" />
                                        <span><b className="text-primary">{s.sessions_used}</b>/{s.sessions_total} ვიზიტი</span>
                                    </>
                                ) : (
                                    <>
                                        <Clock className="w-3.5 h-3.5 opacity-60" />
                                        <span><b className="text-primary">{s.sessions_used}</b> ვიზიტი (თვიური)</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                    <button onClick={(e) => { e.stopPropagation(); setEditing(s); }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-surface border border-border-subtle text-muted hover:text-indigo-600 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all shadow-sm">
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(s.student_id, s.id); }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-surface border border-border-subtle text-muted hover:text-red-500 hover:border-red-500/40 hover:bg-red-500/5 transition-all shadow-sm">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        );
    };

    const handleSave = (form: SubscriptionInfo) => {
        saveSubscription(form.student_id, form);
        setEditing(null);
    };
    const handleDelete = async (studentId: string, id: string) => {
        if (await confirm(t.deleteSubConfirm || 'ნამდვილად გსურთ წაშლა?')) {
            deleteSubscription(studentId, id);
            setEditing(null);
        }
    };
    const handleIssue = (data: Omit<SubscriptionInfo, 'id'>) => {
        const newSub: SubscriptionInfo = {
            ...data,
            id: `sub_${Date.now()}`
        };
        saveSubscription(data.student_id, newSub);
        setIssuing(false);
    };

    return (
        <div className="space-y-6 animate-fade-up max-w-[1200px] mx-auto pb-20">
            {/* Primary Controls Row */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex flex-wrap bg-surface border border-border-subtle rounded-xl p-1 gap-1">
                    {[
                        { id: 'active', label: t.statsActive, icon: Zap, activeColor: 'bg-indigo-500', hoverColor: 'hover:text-indigo-600' },
                        { id: 'paused', label: t.paused, icon: Pause, activeColor: 'bg-amber-500', hoverColor: 'hover:text-amber-600' },
                        { id: 'expired', label: t.expired, icon: AlertCircle, activeColor: 'bg-red-500', hoverColor: 'hover:text-red-600' },
                    ].map(v => (
                        <button key={v.id} onClick={() => setTab(v.id as typeof tab)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all',
                                tab === v.id ? cn(v.activeColor, 'text-white shadow-md') : cn('text-muted', v.hoverColor)
                            )}>
                            <v.icon className="w-3.5 h-3.5" />
                            {v.label}
                        </button>
                    ))}
                </div>

                <div className="relative flex-1 w-full max-w-md">
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={lang === 'ka' ? 'მოძებნეთ სტუდენტით...' : lang === 'ru' ? 'Поиск студента...' : 'Search student...'}
                        className="w-full bg-surface border border-border-subtle rounded-xl pl-10 pr-4 py-2.5 text-xs text-primary outline-none focus:border-indigo-500/40 transition-all font-medium"
                    />
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto">
                    <button onClick={() => window.location.href = '/subscriptions/plans'}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-surface hover:bg-surface-hover border border-border-subtle text-primary text-xs font-semibold px-4 py-2.5 rounded-xl transition-all">
                        <Zap className="w-4 h-4 text-amber-500" />
                        {lang === 'ka' ? 'ფასების მართვა' : lang === 'ru' ? 'Управление ценами' : 'Price Management'}
                    </button>
                    <button onClick={() => setIssuing(true)}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 transition-all">
                        <Plus className="w-4 h-4" />
                        {lang === 'ka' ? 'ახალი' : lang === 'ru' ? 'Новый' : 'New'}
                    </button>
                </div>
            </div>

            {/* Category Toggle Row */}
            <div className="flex justify-center sm:justify-start">
                <div className="flex bg-surface border border-border-subtle rounded-xl p-1 gap-1 w-full sm:w-fit">
                    <button
                        onClick={() => setCategory('group')}
                        className={cn(
                            'flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all',
                            category === 'group' ? 'bg-indigo-500 text-white shadow-md' : 'text-muted hover:text-primary'
                        )}
                    >
                        <Users className="w-4 h-4" />
                        {lang === 'ka' ? 'ჯგუფური' : lang === 'ru' ? 'Групповые' : 'Group'}
                    </button>
                    <button
                        onClick={() => setCategory('individual')}
                        className={cn(
                            'flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all',
                            category === 'individual' ? 'bg-amber-500 text-white shadow-md' : 'text-muted hover:text-primary'
                        )}
                    >
                        <Zap className="w-4 h-4" />
                        {lang === 'ka' ? 'ინდივიდუალური' : lang === 'ru' ? 'Индивидуальные' : 'Individual'}
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.length > 0 ? filtered.map(renderSub) : (
                    <div className="col-span-full">
                        {renderEmpty()}
                    </div>
                )}
            </div>

            <SubscriptionModal
                open={!!editing}
                subscription={editing}
                onClose={() => setEditing(null)}
                onSave={handleSave}
                onDelete={handleDelete}
            />

            <IssueSubscriptionModal
                open={issuing}
                onClose={() => setIssuing(false)}
                onIssue={handleIssue}
            />
        </div>
    );
}
