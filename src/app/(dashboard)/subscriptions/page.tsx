'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, Zap, Clock, User, Link as LinkIcon, AlertCircle, Pause, CreditCard, Trash2, Edit2, DollarSign, Search, FolderPlus } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { cn } from '@/lib/utils';
import { getSubscriptions, deleteSubscription, saveSubscription, type SubscriptionInfo } from '@/lib/subscription-store';
import { getStudents } from '@/lib/student-store';
import { SubscriptionModal } from '@/components/subscriptions/SubscriptionModal';
import { IssueSubscriptionModal } from '@/components/subscriptions/IssueSubscriptionModal';

export default function SubscriptionsPage() {
    const { t, lang } = useT();
    const { confirm } = useConfirm();
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
        
        // Robust Status Matching: If status is 'active' or if it looks active by date/sessions
        const todayStr = new Date().toISOString().split('T')[0];
        const isActuallyExpired = s.expires_at < todayStr || (s.type === 'sessions' && s.sessions_total !== null && s.sessions_used >= s.sessions_total);
        const isActuallyPaused = s.status === 'paused';
        
        let effectiveStatus: 'active' | 'paused' | 'expired' = 'active';
        if (isActuallyPaused) effectiveStatus = 'paused';
        else if (isActuallyExpired) effectiveStatus = 'expired';

        const matchesTab = effectiveStatus === tab;
        const matchesCategory = category === 'group' ? s.plan_type !== 'individual' : s.plan_type === 'individual';
        const st = Array.isArray(students) ? students.find(x => x && x.id === s.student_id) : null;

        const searchLower = search?.toLowerCase() || '';
        const nameMatch = st?.full_name?.toLowerCase().includes(searchLower) ||
            st?.first_name?.toLowerCase().includes(searchLower) ||
            st?.last_name?.toLowerCase().includes(searchLower);
        const idMatch = s.student_id?.toLowerCase().includes(searchLower);

        const matchesSearch = !search || nameMatch || idMatch || s.plan?.toLowerCase().includes(searchLower);
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
                    "group bg-card rounded-[1.5rem] lg:rounded-[2.5rem] p-4 lg:p-6 transition-all duration-300 shadow-sm relative overflow-hidden flex flex-col hover:shadow-xl",
                    borderCls
                )}>
                <div className="flex items-center lg:items-start gap-3 lg:gap-4">
                    {st?.photo_url ? (
                        <img src={st.photo_url} alt={studentName} className="w-10 h-10 lg:w-12 lg:h-12 object-cover rounded-xl lg:rounded-2xl border border-border-subtle/50 shadow-sm flex-shrink-0" />
                    ) : (
                        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 font-bold border border-indigo-500/20 text-sm flex-shrink-0 shadow-sm">
                            {initial}
                        </div>
                    )}
                    <div className="flex-1 min-w-0 pr-12 lg:pr-16">
                        <div className="flex flex-wrap items-center gap-1.5 lg:gap-2 mb-0.5 lg:mb-1.5">
                            <h3 className="text-xs lg:text-sm font-black text-primary truncate max-w-full leading-none group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{studentName}</h3>
                        </div>
                        <div className="flex items-center gap-2 mb-1 lg:mb-2.5">
                            <span className={cn(
                                "text-[8px] lg:text-[10px] font-black px-1.5 lg:px-2 py-0.5 border rounded-lg tracking-wider leading-none shadow-sm uppercase",
                                isIndividual ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                            )}>
                                {(s.plan || 'სტანდარტული')}
                            </span>
                        </div>
                        <div className="flex flex-row flex-wrap items-center gap-x-4 lg:gap-x-6 gap-y-1.5 mt-1 lg:mt-2 border-t lg:border-none border-border-subtle/30 pt-1.5 lg:pt-0">
                            <div className="flex items-center gap-1.5 text-[9px] lg:text-xs text-muted font-bold">
                                <Clock className="w-3.5 h-3.5 text-indigo-500 opacity-50" />
                                <span className="opacity-70">{s.purchased_at || '—'}</span>
                                <span className="mx-1 opacity-20">→</span>
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded-md",
                                    (s.expires_at < new Date().toISOString().split('T')[0]) ? "bg-red-500/10 text-red-600" : "bg-indigo-500/5 text-primary"
                                )}>
                                    {(() => {
                                        if (!s.expires_at) return '—';
                                        const exp = new Date(s.expires_at);
                                        const diff = exp.getTime() - new Date().getTime();
                                        const days = Math.max(0, Math.ceil(diff / (1000 * 86400)));
                                        return exp.getFullYear() > 2050 || days > 365 ? '∞' : s.expires_at;
                                    })()}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] lg:text-xs text-muted font-bold">
                                {s.sessions_total === null ? (
                                    <>
                                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                                        <span className="text-amber-600 font-black">∞ {t.visit}</span>
                                    </>
                                ) : (
                                    <>
                                        <Users className="w-3.5 h-3.5 text-indigo-500 opacity-50" />
                                        <span className="opacity-70">{s.sessions_used}/{s.sessions_total}</span>
                                    </>
                                )}
                            </div>
                            {s.amount_paid !== undefined && (
                                <div className="flex items-center gap-1 text-[9px] lg:text-xs text-emerald-600 font-black bg-emerald-500/5 px-2 py-0.5 rounded-lg border border-emerald-500/10">
                                    <DollarSign className="w-3 h-3" />
                                    <span>{s.amount_paid}₾</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="absolute top-4 lg:top-6 right-4 lg:right-6 flex items-center gap-1.5 lg:opacity-0 lg:group-hover:opacity-100 transition-all lg:translate-x-2 lg:group-hover:translate-x-0">
                    <button onClick={(e) => { e.stopPropagation(); setEditing(s); }}
                        className="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center rounded-xl bg-surface border border-border-subtle text-muted hover:text-indigo-600 transition-all shadow-sm active:scale-90">
                        <Edit2 className="w-3 lg:w-3.5 h-3 lg:h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(s.student_id, s.id); }}
                        className="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center rounded-xl bg-surface border border-border-subtle text-muted hover:text-red-500 transition-all shadow-sm active:scale-90">
                        <Trash2 className="w-3 lg:w-3.5 h-3 lg:h-3.5" />
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
        <div className="space-y-8 animate-fade-up max-w-7xl mx-auto pb-20">
            {/* Primary Controls */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-row items-center justify-between gap-4">
                    <div className="flex flex-row items-center gap-3 overflow-x-auto no-scrollbar pb-1">
                        {/* Status Tabs */}
                        <div className="flex bg-surface border border-border-subtle rounded-[1.25rem] p-1 h-12 w-fit">
                            {[
                                { id: 'active', label: { ka: 'აქტ.', en: 'Act.', ru: 'Акт.' }[lang] || 'Act.', icon: Zap, activeColor: 'bg-[#6d28d9]', hoverColor: 'hover:text-indigo-600' },
                                { id: 'paused', label: { ka: 'შეჩ.', en: 'Susp.', ru: 'Приоз.' }[lang] || 'Susp.', icon: Pause, activeColor: 'bg-[#6d28d9]', hoverColor: 'hover:text-amber-600' },
                                { id: 'expired', label: { ka: 'ვად.', en: 'Exp.', ru: 'Ист.' }[lang] || 'Exp.', icon: AlertCircle, activeColor: 'bg-[#6d28d9]', hoverColor: 'hover:text-red-600' },
                            ].map(v => (
                                <button key={v.id} onClick={() => setTab(v.id as typeof tab)}
                                    className={cn(
                                        'flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 h-full rounded-xl text-[8px] sm:text-[10px] font-black tracking-widest transition-all min-w-fit sm:min-w-[100px]',
                                        tab === v.id ? cn(v.activeColor, 'text-white') : cn('text-muted hover:bg-white/50', v.hoverColor)
                                    )}>
                                    <v.icon className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="whitespace-nowrap">{v.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Prices Action */}
                        <button onClick={() => window.location.href = '/subscriptions/plans'}
                            className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-500/20 text-emerald-600 font-black text-[11px] h-12 px-3 sm:px-5 rounded-[1.25rem] tracking-widest transition-all shadow-sm">
                            <DollarSign strokeWidth={3} className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <span className="hidden sm:inline whitespace-nowrap">{lang === 'ka' ? 'ტარიფები' : lang === 'ru' ? 'Тарифы' : 'Prices'}</span>
                        </button>

                        {/* Primary Action Button */}
                        <button onClick={() => setIssuing(true)}
                            className="flex-shrink-0 flex items-center justify-center gap-2 w-12 h-12 sm:w-auto px-0 sm:px-6 bg-[#6d28d9] hover:bg-[#5b21b6] text-white font-black text-[11px] rounded-[1.25rem] tracking-widest transition-all active:scale-95 touch-manipulation">
                            <FolderPlus className="w-5 h-5 flex-shrink-0" />
                            <span className="hidden sm:inline uppercase">{t.issueSubscription}</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row items-stretch justify-between gap-3">

                    {/* Category Tabs (Group / Individual) (Row 3 on Mobile) */}
                    <div className="flex w-full lg:w-fit h-12 bg-surface border border-border-subtle rounded-[1.25rem] p-1 gap-1 shrink-0">
                        <button
                            onClick={() => setCategory('group')}
                            className={cn(
                                'flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 h-full rounded-xl text-[10px] sm:text-xs font-black tracking-widest transition-all truncate',
                                category === 'group' ? 'bg-[#6d28d9] text-white' : 'text-muted hover:text-primary'
                            )}
                        >
                            <Users className="w-4 h-4 shrink-0" />
                            <span className="truncate">{lang === 'ka' ? 'ჯგუფური' : lang === 'ru' ? 'Групповые' : 'Group'}</span>
                        </button>
                        <button
                            onClick={() => setCategory('individual')}
                            className={cn(
                                'flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 h-full rounded-xl text-[10px] sm:text-xs font-black tracking-widest transition-all truncate',
                                category === 'individual' ? 'bg-amber-500 text-white' : 'text-muted hover:text-primary'
                            )}
                        >
                            <User className="w-4 h-4 shrink-0" />
                            <span className="truncate">{lang === 'ka' ? 'ინდივიდუალური' : lang === 'ru' ? 'Индивидуальные' : 'Individual'}</span>
                        </button>
                    </div>

                    {/* Search (Row 4 on Mobile) */}
                    <div className="relative w-full lg:w-auto lg:flex-1 lg:max-w-xs xl:max-w-md h-12 shrink-0">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/50" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={lang === 'ka' ? 'მოძებნეთ სტუდენტი...' : lang === 'ru' ? 'Поиск студента...' : 'Search student...'}
                            className="w-full h-full bg-surface border border-border-subtle rounded-[1.25rem] pl-10 pr-4 text-sm text-primary outline-none focus:border-indigo-500/40 transition-all font-medium"
                        />
                    </div>
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
