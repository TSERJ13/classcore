'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Users, Zap, Clock, User, Link as LinkIcon, AlertCircle, Pause, CreditCard, Trash2, Edit2, DollarSign, Search, FolderPlus } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { getSubscriptions, deleteSubscription, saveSubscription, type SubscriptionInfo } from '@/lib/subscription-store';
import { getStudents } from '@/lib/student-store';
import { useStudio } from '@/contexts/StudioContext';
import { SubscriptionModal } from '@/components/subscriptions/SubscriptionModal';
import { IssueSubscriptionModal } from '@/components/subscriptions/IssueSubscriptionModal';

export default function SubscriptionsPage() {
    const { t, lang } = useT();
    const { confirm } = useConfirm();
    const { settings } = useStudio();
    const students = getStudents();
    const [tab, setTab] = useState<'active' | 'paused' | 'expired'>('active');
    const [category, setCategory] = useState<'group' | 'individual'>('group');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<SubscriptionInfo | null>(null);
    const [issuing, setIssuing] = useState(false);
    const [fabOpen, setFabOpen] = useState(false);
    const [subsData, setSubsData] = useState<Record<string, SubscriptionInfo[]>>({});

    useEffect(() => {
        function load() { setSubsData(getSubscriptions() || {}); }
        load();
        window.addEventListener('cc_subscription_update', load);
        window.addEventListener('cc_student_update', load);
        return () => {
            window.removeEventListener('cc_subscription_update', load);
            window.removeEventListener('cc_student_update', load);
        };
    }, []);

    // Flatten and sort subscriptions (newest first)
    const subMap = new Map<string, SubscriptionInfo>();
    if (subsData && typeof subsData === 'object') {
        Object.keys(subsData).forEach(key => {
            const subsArray = subsData[key];
            if (Array.isArray(subsArray)) {
                subsArray.forEach(sub => {
                    if (sub && typeof sub === 'object') {
                        const sid = sub.id || `temp_${Math.random()}`;
                        if (!subMap.has(sid)) {
                            subMap.set(sid, { ...sub, student_id: sub.student_id || key });
                        }
                    }
                });
            }
        });
    }
    const allSubs = Array.from(subMap.values());

    const sortedSubs = [...allSubs].sort((a, b) => {
        const dateA = new Date(a?.purchased_at || 0).getTime();
        const dateB = new Date(b?.purchased_at || 0).getTime();
        return dateB - dateA;
    });

    if (typeof window !== 'undefined' && sortedSubs.length > 0) {
        console.log('📊 [SubscriptionsPage] Total Subs:', sortedSubs.length, sortedSubs);
    }

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
        
        // Robust Category Matching: Check both plan_type and category fields
        const isInd = s.plan_type === 'individual' || s.category?.toLowerCase() === 'individual';
        const matchesCategory = category === 'individual' ? isInd : !isInd;
        
        // Handle shared student search
        const sIds = (s.student_id || '').split(',').map(id => id.trim()).filter(Boolean);
        const matchedStudents = sIds.map(id => students.find(x => x.id === id)).filter((s): s is NonNullable<typeof s> => s != null);
        
        const searchLower = search?.toLowerCase() || '';
        const nameMatch = matchedStudents.some(st => 
            st.full_name?.toLowerCase().includes(searchLower) ||
            st.first_name?.toLowerCase().includes(searchLower) ||
            st.last_name?.toLowerCase().includes(searchLower)
        );
        const idMatch = sIds.some(id => id.toLowerCase().includes(searchLower));

        const matchesSearch = !search || nameMatch || idMatch || s.plan?.toLowerCase().includes(searchLower);
        return matchesTab && matchesCategory && matchesSearch;
    });

    const renderEmpty = () => {
        let emptyText = lang === 'ka' ? 'აბონემენტი არ არის' : lang === 'ru' ? 'Нет абонемента' : 'No Subscriptions';
        if (tab === 'active') emptyText = lang === 'ka' ? 'აქტიური აბონემენტი არ არის' : 'Нет активных абонементов';
        if (tab === 'paused') emptyText = lang === 'ka' ? 'შეჩერებული აბონემენტი არ არის' : 'Нет приостановленных абонементов';
        if (tab === 'expired') emptyText = lang === 'ka' ? 'ვადაგასული აბონემენტი არ არის' : 'Нет истекших абонементов';
        return (
            <div className="p-16 text-center border-2 border-dashed border-border-subtle/50 rounded-3xl space-y-3">
                <div className="w-12 h-12 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-2">
                    <CreditCard className="w-6 h-6 text-muted/30" />
                </div>
                <p className="text-sm font-medium text-muted">{emptyText}</p>
            </div>
        );
    };

    const renderSub = (s: SubscriptionInfo) => {
        const sIds = (s.student_id || '').split(',').map(id => id.trim()).filter(Boolean);
        const matchedStudents = sIds.map(id => students.find(x => x.id === id)).filter((s): s is NonNullable<typeof s> => s != null);
        const studentName = matchedStudents.length > 0 
            ? matchedStudents.map(st => st.full_name).join(' & ') 
            : 'უცნობი სტუდენტი';
        const firstStudent = matchedStudents[0];
        const initial = studentName.charAt(0);

        const getPlanTheme = (plan: string) => {
            const p = (plan || '').toLowerCase();
            if (p.includes('minimum') || p.includes('მინიმუმ')) return { badge: 'bg-slate-500/10 text-slate-600 border-slate-500/20', border: 'border-2 border-slate-500/30 hover:border-slate-500/60 shadow-slate-500/5' };
            if (p.includes('premium') || p.includes('პრემიუმ')) return { badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20', border: 'border-2 border-amber-500/30 hover:border-amber-500/60 shadow-amber-500/5' };
            if (p.includes('pro') || p.includes('პრო')) return { badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', border: 'border-2 border-emerald-500/30 hover:border-emerald-500/60 shadow-emerald-500/5' };
            if (p.includes('vip') || p.includes('ვიპ')) return { badge: 'bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20', border: 'border-2 border-fuchsia-500/30 hover:border-fuchsia-500/60 shadow-fuchsia-500/5' };
            if (p.includes('individual') || p.includes('ინდივიდუალური')) return { badge: 'bg-rose-500/10 text-rose-600 border-rose-500/20', border: 'border-2 border-rose-500/30 hover:border-rose-500/60 shadow-rose-500/5' };
            return { badge: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20', border: 'border-2 border-indigo-500/30 hover:border-indigo-500/60 shadow-indigo-500/5' };
        };
        const theme = getPlanTheme(s.plan || '');

        return (
            <div key={s.id}
                className={cn(
                    "group bg-card rounded-[1.5rem] lg:rounded-[2.5rem] p-4 lg:p-6 transition-all duration-300 shadow-sm relative overflow-hidden flex flex-col hover:shadow-xl",
                    theme.border
                )}>
                <div className="flex items-center lg:items-start gap-3 lg:gap-4">
                    <div className="flex -space-x-3 lg:-space-x-4">
                        {matchedStudents.map((st, i) => (
                            <div key={st.id} className="relative z-[1]" style={{ zIndex: matchedStudents.length - i }}>
                                {st.photo_url ? (
                                    <img src={st.photo_url} alt={st.full_name} className="w-10 h-10 lg:w-12 lg:h-12 object-cover rounded-xl lg:rounded-2xl border-2 border-card shadow-sm flex-shrink-0" />
                                ) : (
                                    <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 font-bold border-2 border-card text-sm flex-shrink-0 shadow-sm">
                                        {st.full_name?.charAt(0) || '?'}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex-1 min-w-0 pr-12 lg:pr-16">
                        <div className="flex flex-wrap items-center gap-2 mb-1 lg:mb-2.5 pr-8">
                            <h3 className="text-xs lg:text-sm font-black text-primary truncate max-w-full leading-none group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{studentName}</h3>
                            <span className={cn(
                                "text-[8px] lg:text-[10px] font-black px-1.5 lg:px-2 py-0.5 border rounded-lg tracking-wider leading-none shadow-sm uppercase shrink-0",
                                theme.badge
                            )}>
                                {(s.plan || 'სტანდარტული')}
                            </span>
                        </div>
                        <div className="flex flex-row flex-wrap items-center gap-x-4 lg:gap-x-6 gap-y-1.5 mt-1 lg:mt-2 border-t lg:border-none border-border-subtle/30 pt-1.5 lg:pt-0">
                            <div className="flex items-center gap-1.5 text-[9px] lg:text-xs text-muted font-bold">
                                <Clock className="w-3.5 h-3.5 text-indigo-500 opacity-50" />
                                <span className="opacity-70">{s.purchased_at ? formatDate(s.purchased_at) : '—'}</span>
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
                                        return exp.getFullYear() > 2050 || days > 365 ? '∞' : formatDate(s.expires_at);
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
                                    <span>{formatCurrency(s.amount_paid, settings.currency)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="absolute top-3 lg:top-4 right-3 lg:right-4 flex flex-col items-center gap-1.5 lg:opacity-0 lg:group-hover:opacity-100 transition-all lg:translate-x-2 lg:group-hover:translate-x-0">
                    <button onClick={(e) => { e.stopPropagation(); setEditing(s); }}
                        className="w-10 h-10 lg:w-9 lg:h-9 flex items-center justify-center rounded-xl bg-surface border border-border-subtle text-muted hover:text-indigo-600 transition-all shadow-sm active:scale-90">
                        <Edit2 className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
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
            // Optimistic Update: Hide immediately in UI
            setSubsData(prev => {
                const next = { ...prev };
                if (next[studentId]) {
                    next[studentId] = next[studentId].filter(s => s.id !== id);
                    if (next[studentId].length === 0) delete next[studentId];
                }
                return next;
            });
            
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
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                    <div className="w-full">
                        {/* Status Tabs Segmented Control */}
                        <div className="flex w-full bg-surface border border-border-subtle rounded-[1.25rem] p-1 h-12">
                        {[
                                { id: 'active', label: { ka: 'აქტიური', en: 'Active', ru: 'Активные' }[lang] || 'Active', icon: Zap, activeColor: 'bg-emerald-500', hoverColor: 'hover:text-emerald-600' },
                                { id: 'paused', label: { ka: 'შეჩერებული', en: 'Suspended', ru: 'Приостановлен.' }[lang] || 'Suspended', icon: Pause, activeColor: 'bg-amber-500', hoverColor: 'hover:text-amber-600' },
                                { id: 'expired', label: { ka: 'ვადაგასული', en: 'Expired', ru: 'Истекшие' }[lang] || 'Expired', icon: AlertCircle, activeColor: 'bg-red-500', hoverColor: 'hover:text-red-600' },
                            ].map(v => (
                                <button key={v.id} onClick={() => setTab(v.id as typeof tab)}
                                    className={cn(
                                        'flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 h-full rounded-xl text-[10px] font-black tracking-widest transition-all',
                                        tab === v.id ? cn(v.activeColor, 'text-white shadow-sm') : cn('text-muted hover:bg-black/5 dark:hover:bg-white/5', v.hoverColor)
                                    )}>
                                    <v.icon className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="whitespace-nowrap">{v.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Floating Action Buttons */}
                    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 flex flex-col items-end gap-3 z-50">
                        
                        {/* FAB Overlay (Mobile only, shown when open) */}
                        {fabOpen && (
                            <div 
                                className="fixed inset-0 z-[-1] sm:hidden" 
                                onClick={() => setFabOpen(false)}
                            />
                        )}

                        {/* Speed Dial Menu (Mobile) / Independent Buttons (Desktop) */}
                        <div className={cn(
                            "flex flex-col items-center sm:items-start gap-3 transition-all duration-300 origin-bottom sm:flex-row sm:opacity-100 sm:scale-100 sm:translate-y-0 sm:pointer-events-auto",
                            fabOpen ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-90 translate-y-10 pointer-events-none sm:pointer-events-auto"
                        )}>
                            {/* Prices Action */}
                            <Link href="/subscriptions/plans"
                                onClick={() => setFabOpen(false)}
                                className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-500/20 text-emerald-600 font-black text-[11px] h-14 w-14 sm:h-12 sm:w-auto sm:px-5 rounded-2xl sm:rounded-[1.25rem] tracking-widest transition-all shadow-lg hover:shadow-xl active:scale-95 group">
                                <DollarSign strokeWidth={3} className="w-6 h-6 sm:w-4 sm:h-4 text-emerald-500 flex-shrink-0" />
                                <span className="hidden sm:inline whitespace-nowrap">{lang === 'ka' ? 'ტარიფები' : lang === 'ru' ? 'Тарифы' : 'Prices'}</span>
                            </Link>

                            {/* Primary Action Button */}
                            <button onClick={() => { setIssuing(true); setFabOpen(false); }}
                                className="flex-shrink-0 flex items-center justify-center gap-2 h-14 w-14 sm:h-12 sm:w-auto px-0 sm:px-6 bg-[#6d28d9] hover:bg-[#5b21b6] text-white font-black text-[11px] rounded-2xl sm:rounded-[1.25rem] tracking-widest transition-all shadow-lg hover:shadow-xl active:scale-95 touch-manipulation group">
                                <FolderPlus className="w-6 h-6 sm:w-5 sm:h-5 flex-shrink-0" />
                                <span className="hidden sm:inline uppercase">{t.issueSubscription}</span>
                            </button>
                        </div>

                        {/* Mobile Speed Dial Trigger */}
                        <button onClick={() => setFabOpen(!fabOpen)} 
                            className="sm:hidden flex items-center justify-center w-14 h-14 bg-primary text-white rounded-2xl shadow-xl active:scale-95 transition-all">
                            <Plus className={cn("w-6 h-6 transition-transform duration-300", fabOpen && "rotate-45")} />
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
