'use client';

import { useState, useEffect, useMemo } from 'react';
import { Save, Plus, UserPlus, CreditCard, User, Building2, ChevronRight, ArrowLeft, Percent, Wallet, Banknote, Calendar, Clock, Undo2, X, Tag, ArrowRight, Check, Palette } from 'lucide-react';
import MainPortal from '@/components/ui/MainPortal';
import { useT } from '@/contexts/LanguageContext';
import type { SubscriptionInfo } from '@/lib/subscription-store';
import { getStudents, updateStudent } from '@/lib/student-store';
import { getPlans } from '@/lib/plan-store';
import { getGroups } from '@/lib/group-store';
import { getLocalISODate, cn, formatDate, formatCurrency } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { StandardDatePicker } from '@/components/ui/StandardDatePicker';
interface IssueSubscriptionModalProps {
    open: boolean;
    onClose: () => void;
    onIssue: (data: Omit<SubscriptionInfo, 'id'>) => void;
    initialStudentId?: string;
    defaultType?: 'group' | 'individual' | 'rental';
    centered?: boolean;
}

type PayMethod = 'cash' | 'card' | 'transfer';

export function IssueSubscriptionModal({ open, onClose, onIssue, initialStudentId, defaultType, centered = false }: IssueSubscriptionModalProps) {
    const { t, lang } = useT();
    const { settings, logSubscription } = useStudio();
    const { user, profile } = useUser();

    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const [students, setStudents] = useState(() => {
        const s = getStudents();
        return (Array.isArray(s) ? s : []).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    });
    const [plans, setPlans] = useState(() => {
        const p = getPlans();
        return (Array.isArray(p) ? p : []).filter(p => p.is_active);
    });
    const [groups, setGroups] = useState(() => {
        const g = getGroups();
        return Array.isArray(g) ? g : [];
    });

    useEffect(() => {
        const refresh = () => {
            setStudents(getStudents().sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')));
            setPlans(getPlans().filter(p => p.is_active));
            setGroups(getGroups());
        };
        if (open) {
            refresh();
            window.addEventListener('cc_subscription_update', refresh);
            window.addEventListener('cc_attendance_update', refresh);
            window.addEventListener('cc_subscription_plans_update', refresh);
        }
        return () => {
            window.removeEventListener('cc_subscription_update', refresh);
            window.removeEventListener('cc_attendance_update', refresh);
            window.removeEventListener('cc_subscription_plans_update', refresh);
        };
    }, [open]);

    const [studentId, setStudentId] = useState('');
    const [step, setStep] = useState<'type_selection' | 'form'>('type_selection');
    const [selectedType, setSelectedType] = useState<'group' | 'individual' | 'rental'>('group');
    const [isOneTime, setIsOneTime] = useState(false);

    const availablePlans = plans.filter(p => {
        if (p.type !== selectedType) return false;
        const pOneTime = p.session_count === 1;
        return isOneTime ? pOneTime : !pOneTime;
    });

    const [planId, setPlanId] = useState('');
    const [groupId, setGroupId] = useState('');
    const [price, setPrice] = useState<number | ''>('');
    const [discount, setDiscount] = useState<number | ''>('');
    const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [days, setDays] = useState<number | ''>('');
    const [sessions, setSessions] = useState<number | ''>('');
    const [unlimited, setUnlimited] = useState(false);
    const [neverExpires, setNeverExpires] = useState(false);
    const [teacherId, setTeacherId] = useState('');

    // Payment fields
    const [payMethod, setPayMethod] = useState<PayMethod>('cash');
    const [amountPaid, setAmountPaid] = useState<number | ''>('');
    const [useBalance, setUseBalance] = useState(false);

    // 📅 Scheduling State (for Individual)
    const [schedule, setSchedule] = useState<{ day: number; time: string; hallId: string }[]>([]);
    const [eventColor, setEventColor] = useState('#6d28d9');

    // Current student balance
    const selectedStudent = students.find(s => s.id === studentId);
    const studentBalance = selectedStudent?.balance ?? 0;

    // Derived payment calculations
    const totalDue = useMemo(() => {
        const base = typeof price === 'number' ? price : 0;
        const disc = typeof discount === 'number' ? discount : 0;
        if (discountType === 'percent') {
            return Math.round(base * (1 - disc / 100) * 100) / 100;
        } else {
            return Math.max(0, base - disc);
        }
    }, [price, discount, discountType]);

    const sBalance = typeof studentBalance === 'number' ? studentBalance : 0;
    const appliedBalance = useBalance ? Math.min(sBalance, totalDue) : 0;
    const remaining = Math.max(0, totalDue - appliedBalance);
    const actualPaid = typeof amountPaid === 'number' ? amountPaid : remaining;
    const overpayment = Math.max(0, actualPaid - remaining);
    const newBalance = Math.round((sBalance - appliedBalance + overpayment) * 100) / 100;

    const activeBranchId = settings?.activeBranchId;
    const branches = settings?.branches || [];
    const activeBranch = branches.find(b => b.id === activeBranchId);
    const activeHalls = activeBranch?.halls || [];
    const hallOptions = activeHalls.map(h => ({ value: h.id, label: h.name, color: h.color }));

    // Reset when opened
    useEffect(() => {
        if (open) {
            setStep(defaultType ? 'form' : 'type_selection');
            setSelectedType(defaultType || 'group');
            const currentStudents = getStudents().sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
            setStudentId(initialStudentId || currentStudents[0]?.id || '');
            setStartDate(getLocalISODate());
            setDiscount('');
            setPayMethod('cash');
            setAmountPaid('');
            setUseBalance(false);
            setTeacherId('');
            setPlanId(''); // 🌟 Clear so default-pick effect runs fresh on each open
            setSchedule([]);
            setEventColor('#6d28d9');
        }
    }, [open, initialStudentId]);

    // 🌟 Auto-select default plan when type/oneTime changes or list updates
    useEffect(() => {
        if (!open) return;
        // Pick: default first, then first active, then anything
        const defaultPlan = availablePlans.find(p => p.is_default && p.is_active !== false);
        const firstActive = availablePlans.find(p => p.is_active !== false);
        const auto = defaultPlan || firstActive || availablePlans[0];

        // If current plan is invalid OR this is fresh open (planId empty), pick auto
        const stillValid = planId && availablePlans.find(p => p.id === planId);
        if (!stillValid && auto) {
            setPlanId(auto.id);
        }
    }, [open, selectedType, isOneTime, availablePlans]);

    // Reset balance usage and auto-fill discount when student changes
    useEffect(() => {
        setUseBalance(false);
        setAmountPaid('');
        
        const student = students.find(s => s.id === studentId);
        if (student && student.discount_value && student.discount_value > 0) {
            setDiscount(student.discount_value);
            setDiscountType(student.discount_type || 'percent');
        } else {
            setDiscount('');
            setDiscountType('percent');
        }
    }, [studentId, students]);

    const studentOptions = useMemo(() => students.map(s => ({
        value: s.id,
        label: s.full_name,
        subLabel: s.phone || undefined,
        badge: (s.balance ?? 0) > 0 ? `💰 ${formatCurrency(s.balance || 0, settings?.currency)}` : undefined
    })), [students, settings?.currency]);

    const planOptions = useMemo(() => availablePlans.map(p => ({
        value: p.id,
        label: p.is_default ? `⭐ ${p.name}` : p.name,
        subLabel: `${formatCurrency(p.price, settings?.currency)} (${p.type})`
    })), [availablePlans, settings?.currency]);

    const groupOptions = useMemo(() => groups.map(g => ({
        value: g.id,
        label: g.name,
        subLabel: g.coach || undefined
    })), [groups]);

    const teacherOptions = useMemo(() => {
        const staff = settings?.staff || [];
        const allStaff = staff.map(t => ({
            value: t.id,
            label: `${t.first_name} ${t.last_name || ''}`,
            subLabel: t.specialty?.join(', ') || undefined
        }));

        return [
            { value: '', label: l('არჩეული არ არის', 'Не выбран', 'Not selected') },
            ...allStaff
        ];
    }, [settings?.staff]);

    // Update planId when category changes
    useEffect(() => {
        if (availablePlans.length > 0 && !availablePlans.find(p => p.id === planId)) {
            setPlanId(availablePlans[0].id);
        } else if (availablePlans.length === 0) {
            setPlanId('');
        }
    }, [selectedType, isOneTime, planId]);

    // Auto-fill when plan changes
    useEffect(() => {
        const plan = plans.find(p => p.id === planId);
        if (plan) {
            setPrice(plan.price);
            setUnlimited(plan.period === 'unlimited');
            setSessions(plan.period === 'unlimited' ? '' : (plan.session_count || ''));

            if (plan.validity_days) {
                setDays(plan.validity_days);
                setNeverExpires(false);
            } else {
                setDays('');
                setNeverExpires(true);
            }

            const student = students.find(s => s.id === studentId);
            const studentGroup = student?.enrolled_group_ids?.[0];

            if (plan.group_id && groups.find(g => g.id === plan.group_id)) {
                setGroupId(plan.group_id);
                const g = groups.find(gx => gx.id === plan.group_id);
                if (g?.teacherId) setTeacherId(g.teacherId);
            } else if (studentGroup && groups.find(g => g.id === studentGroup)) {
                setGroupId(studentGroup);
                const g = groups.find(gx => gx.id === studentGroup);
                if (g?.teacherId) setTeacherId(g.teacherId);
            } else if (plan.type === 'group' && groups.length > 0) {
                setGroupId(groups[0].id);
                const g = groups.find(gx => gx.id === groups[0].id);
                if (g?.teacherId) setTeacherId(g.teacherId);
            } else {
                setGroupId('');
            }

            if (plan.coach) {
                const staff = settings?.staff || [];
                const tc = staff.find(s => s.full_name === plan.coach || `${s.first_name} ${s.last_name}` === plan.coach);
                if (tc) setTeacherId(tc.id);
            }
        }
    }, [planId, groups, studentId, settings?.staff]);

    // Sync amountPaid default to remaining when totalDue changes
    useEffect(() => {
        setAmountPaid('');
    }, [totalDue, useBalance]);

    // Auto-calculate end date based on start date and days
    useEffect(() => {
        if (neverExpires) {
            setEndDate('2099-12-31');
            return;
        }
        if (startDate && days && typeof days === 'number') {
            const d = new Date(startDate);
            d.setDate(d.getDate() + days);
            setEndDate(getLocalISODate(d));
        }
    }, [startDate, days, neverExpires]);

    if (!open) return null;

    const handleIssue = () => {
        const studentIds = studentId.split(',').map(id => id.trim()).filter(Boolean);
        const finalEndDate = endDate || '2099-12-31';

        console.log('🚀 [IssueModal] handleIssue START', { studentId, studentIds, planId, startDate, finalEndDate });
        if (studentIds.length === 0 || !planId || !startDate || !finalEndDate) {
            console.error('❌ [IssueModal] Validation failed', { studentIds, planId, startDate, finalEndDate });
            return;
        }

        const plan = plans.find(p => p.id === planId);
        if (!plan) {
            console.error('❌ [IssueModal] Plan not found', planId);
            return;
        }

        const isGroupPlan = plan.type === 'group';
        if (isGroupPlan && !groupId) {
            console.error('❌ [IssueModal] Group plan missing groupId');
            return;
        }

        const subType = plan.period === 'unlimited' ? 'monthly' : 'sessions';
        const sessionsTotal = unlimited ? null : (typeof sessions === 'number' ? sessions : 12);

        // Balance logic: update primary student's balance
        const primaryStudentId = studentIds[0];
        const paidNow = typeof amountPaid === 'number' ? amountPaid : remaining;
        if (newBalance !== studentBalance) {
            updateStudent(primaryStudentId, { balance: newBalance });
        }

        // Enroll all students in the group if it's a group plan
        if (isGroupPlan && groupId) {
            studentIds.forEach(id => {
                const s = students.find(x => x.id === id);
                if (s) {
                    const enrolled = s.enrolled_group_ids || [];
                    if (!enrolled.includes(groupId)) {
                        updateStudent(id, { enrolled_group_ids: [...enrolled, groupId] });
                    }
                }
            });
        }

        const commentParts: string[] = [];
        commentParts.push(`${l('გადახდა', 'Оплата', 'Paid')}: ${formatCurrency(paidNow, settings.currency)} (${payMethod === 'cash' ? l('ნაღდი', 'Наличные', 'Cash') : payMethod === 'card' ? l('ბარათი', 'Карта', 'Card') : l('გადარიცხვა', 'Перевод', 'Transfer')})`);
        if (appliedBalance > 0) commentParts.push(`${l('ბალანსიდან', 'С баланса', 'From Balance')}: ${formatCurrency(appliedBalance, settings.currency)}`);
        if (overpayment > 0) commentParts.push(`${l('ბალანსზე', 'На баланс', 'To Balance')}: +${formatCurrency(overpayment, settings.currency)}`);

        const selectedGroup = isGroupPlan ? groups.find(g => g.id === groupId) : null;

        try {
            if (typeof window !== 'undefined') {
                window.alert(l('აბონემენტი წარმატებით გაფორმდა!', 'Абонемент успешно оформлен!', 'Subscription issued successfully!'));
            }
            onIssue({
                student_id: studentId,
                plan: plan.name,
                sessions_used: 0,
                sessions_total: sessionsTotal,
                status: 'active',
                purchased_at: startDate,
                expires_at: finalEndDate,
                type: subType,
                plan_type: plan.type,
                group_id: isGroupPlan ? groupId : undefined,
                category: plan.type === 'individual' ? 'Individual' : (selectedGroup ? selectedGroup.type : undefined),
                payment_method: payMethod,
                amount_paid: paidNow,
                teacher_id: teacherId || undefined,
                teacher_comment: commentParts.join(' · '),
                schedule: selectedType === 'individual' ? schedule : undefined,
                color: selectedType === 'individual' ? eventColor : undefined,
            });
            console.log('✅ [IssueModal] onIssue called successfully');
        } catch (err) {
            console.error('❌ [IssueModal] onIssue failed:', err);
        }

        // Log to history
        logSubscription({
            studentId,
            studentName: selectedStudent?.full_name || 'Unknown',
            planName: plan.name,
            amount: paidNow,
            issuedBy: user?.id || 'admin',
            issuedByName: profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : 'Admin',
            branchId: settings.activeBranchId || 'main',
            branchName: settings.branches.find(b => b.id === settings.activeBranchId)?.name || 'Main',
            groupName: selectedGroup?.name
        });

        onClose();
    };

    const PAY_METHODS: { id: PayMethod; label: string; icon: React.ReactNode }[] = [
        { id: 'cash', label: t.paymentCash, icon: <Banknote className="w-4 h-4" /> },
        { id: 'card', label: t.paymentCard, icon: <CreditCard className="w-4 h-4" /> },
        { id: 'transfer', label: t.paymentTransfer, icon: <Building2 className="w-4 h-4" /> },
    ];

    return (
        <MainPortal>
            <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className={cn(
                "fixed z-[9999] flex flex-col bg-card shadow-2xl transition-all duration-300 overflow-hidden",
                "inset-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[500px] sm:max-h-none top-0 bottom-0 !top-0",
                "animate-in fade-in duration-300 sm:slide-in-from-right",
                "rounded-none sm:rounded-none overflow-x-hidden max-w-full"
            )}>
                {/* Mobile Drag Handle */}
                <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing">
                    <div className="w-10 h-1.5 rounded-full bg-border-subtle opacity-60" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle flex-shrink-0 bg-white/90 backdrop-blur-md sticky top-0 z-10 transition-all duration-300">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-primary leading-tight">
                                {t.issueSubscription}
                            </h2>
                            <p className="text-xs text-muted mt-0.5 font-medium opacity-70 tracking-tight">
                                {t.newSale}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-primary transition-all active:scale-95">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-5 sm:space-y-6 overscroll-contain pb-32">

                    {step === 'type_selection' ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <p className="text-xs font-bold text-muted text-center mb-1">{t.selectSubType}</p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Group Column */}
                                <div className="flex flex-col border-2 border-emerald-500/20 rounded-3xl overflow-hidden bg-card hover:border-emerald-500/40 transition-all group shadow-sm">
                                    <button
                                        onClick={() => { setSelectedType('group'); setIsOneTime(false); setStep('form'); }}
                                        className="flex-1 p-4 flex flex-col items-center justify-center gap-2 bg-surface hover:bg-emerald-500/5 transition-colors text-primary"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                        </div>
                                        <div className="text-center">
                                            <h3 className="text-xs font-black tracking-tight">{t.groupSubscription}</h3>
                                        </div>
                                    </button>
                                    <div className="h-px bg-border-subtle w-full" />
                                    <button
                                        onClick={() => { setSelectedType('group'); setIsOneTime(true); setStep('form'); }}
                                        className="w-full p-3 lg:p-4 flex items-center justify-center gap-2 text-[9px] lg:text-[10px] font-bold text-muted hover:text-emerald-600 bg-surface/50 hover:bg-emerald-500/10 transition-colors tracking-widest group/btn"
                                    >
                                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover/btn:scale-110 transition-transform">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                        </div>
                                        <span>{t.groupOneTime}</span>
                                    </button>
                                </div>

                                {/* Individual Column */}
                                <div className="flex flex-col border-2 border-indigo-500/20 rounded-3xl overflow-hidden bg-card hover:border-indigo-500/40 transition-all group shadow-sm">
                                    <button
                                        onClick={() => { setSelectedType('individual'); setIsOneTime(false); setStep('form'); }}
                                        className="flex-1 p-4 flex flex-col items-center justify-center gap-2 bg-surface hover:bg-indigo-500/5 transition-colors text-primary"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                        </div>
                                        <div className="text-center">
                                            <h3 className="text-xs font-black tracking-tight">{t.individualSubscription}</h3>
                                        </div>
                                    </button>
                                    <div className="h-px bg-border-subtle w-full" />
                                    <button
                                        onClick={() => { setSelectedType('individual'); setIsOneTime(true); setStep('form'); }}
                                        className="w-full p-3 lg:p-4 flex items-center justify-center gap-2 text-[9px] lg:text-[10px] font-bold text-muted hover:text-indigo-600 bg-surface/50 hover:bg-indigo-500/10 transition-colors tracking-widest group/btn"
                                    >
                                        <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover/btn:scale-110 transition-transform">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                        </div>
                                        <span>{t.individualOneTime}</span>
                                    </button>
                                </div>

                                {/* Rental Column */}
                                <div className="flex flex-col border-2 border-amber-500/20 rounded-3xl overflow-hidden bg-card hover:border-amber-500/40 transition-all group shadow-sm">
                                    <button
                                        onClick={() => { setSelectedType('rental'); setIsOneTime(false); setStep('form'); }}
                                        className="flex-1 p-4 flex flex-col items-center justify-center gap-2 bg-surface hover:bg-amber-500/5 transition-colors text-primary"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                                        </div>
                                        <div className="text-center">
                                            <h3 className="text-xs font-black tracking-tight">{t.rentalSubscription}</h3>
                                        </div>
                                    </button>
                                    <div className="h-px bg-border-subtle w-full" />
                                    <button
                                        onClick={() => { setSelectedType('rental'); setIsOneTime(true); setStep('form'); }}
                                        className="w-full p-3 lg:p-4 flex items-center justify-center gap-2 text-[9px] lg:text-[10px] font-bold text-muted hover:text-amber-600 bg-surface/50 hover:bg-amber-500/10 transition-colors tracking-widest group/btn"
                                    >
                                        <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover/btn:scale-110 transition-transform">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                                        </div>
                                        <span>{t.rentalOneTime}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* Client & Plan */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <button onClick={() => setStep('type_selection')} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 transition-colors flex items-center gap-1">
                                        &larr; {t.backToType}
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-muted tracking-wider px-1 uppercase">{t.selectClient}</label>
                                        <SearchSelect
                                            options={studentOptions}
                                            value={studentId.split(',')[0] || ''}
                                            onChange={val => {
                                                const parts = studentId.split(',').map(id => id.trim()).filter(Boolean);
                                                parts[0] = val;
                                                setStudentId(parts.join(', '));
                                            }}
                                            placeholder={t.selectClient}
                                        />
                                    </div>

                                    {studentId.split(',').length < 2 ? (
                                        <button 
                                            type="button"
                                            onClick={() => setStudentId(prev => prev + ', ')}
                                            className="w-full py-2.5 border-2 border-dashed border-indigo-500/20 rounded-xl text-[10px] font-bold text-indigo-500 hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-2 group"
                                        >
                                            <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <UserPlus className="w-3 h-3" />
                                            </div>
                                            {l('მეორე ადამიანის დამატება', 'Добавить второго человека', 'Add second person')}
                                        </button>
                                    ) : (
                                        <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                                            <div className="flex items-center justify-between px-1">
                                                <label className="text-[9px] font-black text-indigo-500/60 tracking-wider uppercase">{l('მეორე ადამიანი', 'Второй человек', 'Second person')}</label>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const parts = studentId.split(',').map(id => id.trim()).filter(Boolean);
                                                        setStudentId(parts[0] || '');
                                                    }}
                                                    className="text-[9px] font-black text-red-400 hover:text-red-500 uppercase tracking-tighter"
                                                >
                                                    {t.delete || 'X'}
                                                </button>
                                            </div>
                                            <SearchSelect
                                                options={studentOptions.filter(o => o.value !== studentId.split(',')[0].trim())}
                                                value={studentId.split(',')[1]?.trim() || ''}
                                                onChange={val => {
                                                    const parts = studentId.split(',').map(id => id.trim()).filter(Boolean);
                                                    parts[1] = val;
                                                    setStudentId(parts.join(', '));
                                                }}
                                                placeholder={l('აირჩიეთ მეორე სტუდენტი...', 'Выберите второго студента...', 'Select second student...')}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-muted tracking-wider px-1 uppercase">{t.selectPlan}</label>
                                    <SearchSelect
                                        options={planOptions}
                                        value={planId}
                                        onChange={setPlanId}
                                        placeholder={t.selectPlan}
                                    />
                                </div>

                                {plans.find(p => p.id === planId)?.type === 'group' && (
                                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <label className="text-[9px] font-black text-muted tracking-wider px-1 uppercase">{t.addToGroup}</label>
                                        <SearchSelect
                                            options={groupOptions}
                                            value={groupId}
                                            onChange={setGroupId}
                                            placeholder={t.selectGroup}
                                        />
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-muted tracking-wider px-1 uppercase">{t.calTeacher}</label>
                                    <SearchSelect
                                        options={teacherOptions}
                                        value={teacherId}
                                        onChange={setTeacherId}
                                        placeholder={t.selectTeacher}
                                    />
                                </div>
                            </div>

                            {/* Price Block */}
                            <div className="space-y-4 p-3 border border-border-subtle bg-surface/30 rounded-xl">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between px-1 h-5">
                                            <label className="text-[9px] font-black text-muted tracking-wider flex items-center gap-1 uppercase">
                                                <Tag className="w-3 h-3" /> {t.price} ({settings.currency})
                                            </label>
                                        </div>
                                        <input
                                            type="number"
                                            value={price}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => setPrice(parseInt(e.target.value) || '')}
                                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-[13px] sm:text-sm font-bold text-primary outline-none focus:border-indigo-500/40 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5 min-w-0">
                                        <label className="text-[9px] font-black text-muted tracking-wider px-1 flex items-center gap-1 uppercase">
                                            <Percent className="w-3 h-3" /> {t.discount}
                                        </label>
                                        <div className="flex bg-surface border border-border-subtle rounded-xl p-1 gap-1 overflow-hidden min-w-0">
                                            <input
                                                type="number"
                                                value={discount || ''}
                                                onFocus={(e) => e.target.select()}
                                                onChange={(e) => setDiscount(parseFloat(e.target.value) || '')}
                                                placeholder="0"
                                                className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-[13px] sm:text-sm font-bold text-emerald-500 outline-none"
                                            />
                                            <div className="flex bg-indigo-500/5 border border-indigo-500/10 rounded-md p-0.5 shrink-0">
                                                <button
                                                    onClick={() => setDiscountType('percent')}
                                                    className={cn(
                                                        "px-2 py-0.5 text-[10px] font-black rounded-sm transition-all",
                                                        discountType === 'percent' ? "bg-indigo-600 text-white shadow-sm" : "text-muted/60 hover:text-indigo-500"
                                                    )}
                                                >
                                                    %
                                                </button>
                                                <button
                                                    onClick={() => setDiscountType('fixed')}
                                                    className={cn(
                                                        "px-2 py-0.5 text-[10px] font-black rounded-sm transition-all",
                                                        discountType === 'fixed' ? "bg-indigo-600 text-white shadow-sm" : "text-muted/60 hover:text-indigo-500"
                                                    )}
                                                >
                                                    {settings.currency === 'GEL' ? '₾' : settings.currency === 'USD' ? '$' : '€'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Method */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-muted tracking-wider px-1 uppercase">{l('გადახდის მეთოდი', 'Способ оплаты', 'Payment Method')}</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {PAY_METHODS.map(m => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setPayMethod(m.id)}
                                                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold border transition-all ${payMethod === m.id
                                                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                                                    : 'bg-surface border-border-subtle text-muted hover:border-emerald-500/40 hover:text-primary'
                                                    }`}
                                            >
                                                {m.icon}
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Balance row — only if student has balance */}
                                {studentBalance > 0 && (
                                    <div className="flex items-center justify-between bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-2 py-2 animate-in fade-in duration-200">
                                        <div className="flex items-center gap-1.5">
                                            <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                                            <span className="text-[10px] font-bold text-primary">{t.clientBalance}: <span className="text-emerald-500">{formatCurrency(studentBalance, settings.currency)}</span></span>
                                        </div>
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <span className="text-[9px] font-bold text-muted">{t.useBalance}</span>
                                            <div
                                                onClick={() => setUseBalance(v => !v)}
                                                className={`w-8 h-4 rounded-full transition-colors cursor-pointer relative ${useBalance ? 'bg-emerald-500' : 'bg-border-subtle'}`}
                                            >
                                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${useBalance ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                            </div>
                                        </label>
                                    </div>
                                )}

                                {/* Amount paid input */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-muted tracking-wider px-1 uppercase">{t.amountPaid} ({settings.currency})</label>
                                    <input
                                        type="number"
                                        value={amountPaid}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => setAmountPaid(parseFloat(e.target.value) || '')}
                                        placeholder={remaining.toFixed(2)}
                                        className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-[13px] sm:text-sm font-bold text-primary outline-none focus:border-indigo-500/40 transition-all"
                                    />
                                </div>

                                {/* Payment summary */}
                                <div className="space-y-0.5 pt-1 border-t border-border-subtle/60">
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-muted">{t.totalDue}</span>
                                        <span className="font-bold text-primary">{formatCurrency(totalDue, settings.currency)}</span>
                                    </div>
                                    {appliedBalance > 0 && (
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-emerald-500">{t.balanceApplied}</span>
                                            <span className="font-bold text-emerald-500">−{formatCurrency(appliedBalance, settings.currency)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-muted">{t.remainingToPay}</span>
                                        <span className="font-black text-primary">{formatCurrency(remaining, settings.currency)}</span>
                                    </div>
                                    {overpayment > 0 && (
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-amber-500">{t.overpayment} → {t.newBalance}</span>
                                            <span className="font-bold text-amber-500">+{formatCurrency(overpayment, settings.currency)} = {formatCurrency(newBalance, settings.currency)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ─── INDIVIDUAL SPECIFIC: Color, Schedule, Hall ─── */}
                            {selectedType === 'individual' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                    
                                    {/* Group Color Style */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1 flex items-center gap-2 uppercase">
                                            <Palette className="w-3 h-3" /> {l('ჯგუფის ფერი', 'Цвет группы', 'Group Color')}
                                        </label>
                                        <label className="flex items-center gap-3 bg-surface border border-border-subtle rounded-xl p-2 cursor-pointer hover:border-indigo-500/40 transition-colors">
                                            <span className="w-8 h-8 rounded-lg border border-black/10 flex-shrink-0 overflow-hidden relative">
                                                <input type="color" value={eventColor} onChange={e => setEventColor(e.target.value)}
                                                    className="absolute -inset-2 w-12 h-12 cursor-pointer opacity-0" />
                                                <div className="w-full h-full pointer-events-none shadow-inner" style={{ backgroundColor: eventColor }} />
                                            </span>
                                            <span className="text-xs text-muted font-medium select-none truncate">{t.chooseAnotherColor}</span>
                                        </label>
                                    </div>

                                    {/* Schedule Builder Style */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1 flex items-center gap-2 uppercase">
                                            <Calendar className="w-3 h-3" /> {l('განრიგი', 'Расписание', 'Schedule')}
                                        </label>

                                        <div className="bg-surface/50 border border-border-subtle rounded-2xl p-4 space-y-4">
                                            <label className="text-[10px] text-muted block tracking-wider font-black opacity-40">{l('აირჩიეთ დღეები და დროები', 'Выберите дни и время', 'Select days and times')}</label>
                                            
                                            <div className="flex items-center justify-between gap-1">
                                                {[
                                                    { id: 1, label: l('ორ', 'Пн', 'Mon') },
                                                    { id: 2, label: l('სამ', 'Вт', 'Tue') },
                                                    { id: 3, label: l('ოთხ', 'Ср', 'Wed') },
                                                    { id: 4, label: l('ხუთ', 'Чт', 'Thu') },
                                                    { id: 5, label: l('პარ', 'Пт', 'Fri') },
                                                    { id: 6, label: l('შაბ', 'Сб', 'Sat') },
                                                    { id: 0, label: l('კვი', 'Вс', 'Sun') },
                                                ].map(d => {
                                                    const isActive = schedule.some(s => s.day === d.id);
                                                    return (
                                                        <button key={d.id} type="button" 
                                                            onClick={() => {
                                                                if (isActive) {
                                                                    setSchedule(prev => prev.filter(s => s.day !== d.id));
                                                                } else {
                                                                    setSchedule(prev => [...prev, { day: d.id, time: '18:00', hallId: activeHalls[0]?.id || '' }]);
                                                                }
                                                            }}
                                                            className={cn(
                                                                "flex-1 h-9 rounded-lg text-[10px] font-black transition-all border shrink-0",
                                                                isActive ? "text-white shadow-md shadow-indigo-500/20" : "bg-card border-border-subtle text-muted hover:border-indigo-500/40"
                                                            )}
                                                            style={isActive ? { backgroundColor: eventColor, borderColor: eventColor } : {}}>
                                                            {d.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="space-y-2">
                                                {schedule.sort((a, b) => (a.day === 0 ? 7 : a.day) - (b.day === 0 ? 7 : b.day)).map((s, idx) => (
                                                    <div key={idx} className="flex flex-row items-center gap-2 bg-card/30 p-2 rounded-xl border border-border-subtle/20">
                                                        <span className="text-[10px] font-black text-primary w-12 pl-1 truncate">
                                                            {[l('კვი', 'Вს', 'Sun'), l('ორ', 'Пн', 'Mon'), l('სამ', 'Вт', 'Tue'), l('ოთხ', 'Ср', 'Wed'), l('ხუთ', 'Чт', 'Thu'), l('პარ', 'Пт', 'Fri'), l('შაბ', 'Сб', 'Sat')][s.day]}
                                                        </span>
                                                        <div className="flex-1 flex items-center gap-2">
                                                            <input 
                                                                type="time" 
                                                                value={s.time}
                                                                onChange={e => {
                                                                    const next = [...schedule];
                                                                    const i = next.findIndex(n => n.day === s.day);
                                                                    if (i > -1) next[i].time = e.target.value;
                                                                    setSchedule(next);
                                                                }}
                                                                className="flex-1 bg-surface border border-border-subtle rounded-lg px-2 py-1.5 text-[11px] font-bold text-primary outline-none focus:border-indigo-500/40"
                                                            />
                                                            <select
                                                                value={s.hallId}
                                                                onChange={e => {
                                                                    const next = [...schedule];
                                                                    const i = next.findIndex(n => n.day === s.day);
                                                                    if (i > -1) next[i].hallId = e.target.value;
                                                                    setSchedule(next);
                                                                }}
                                                                className="flex-1 bg-surface border border-border-subtle rounded-lg px-2 py-1.5 text-[10px] font-bold text-primary outline-none focus:border-indigo-500/40"
                                                            >
                                                                <option value="">{t.selectHall}</option>
                                                                {activeHalls.map(h => (
                                                                    <option key={h.id} value={h.id}>{h.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {schedule.length === 0 && (
                                                <p className="text-xs text-muted opacity-40 italic text-center py-2">
                                                    {l('აირჩიეთ მინიმუმ ერთი დღე', 'Выберите хотя бы один день', 'Select at least one day')}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Hall Block Style */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1 flex items-center gap-2 uppercase">
                                            <Building2 className="w-3 h-3" /> {l('დარბაზი', 'Зал', 'Hall')}
                                        </label>
                                        <select
                                            value={teacherId || ''} // Reusing teacherId logic if needed, but usually individual has its own hall
                                            onChange={e => {
                                                const val = e.target.value;
                                                const next = schedule.map(s => ({ ...s, hallId: val }));
                                                setSchedule(next);
                                            }}
                                            className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-2xl px-4 py-3 text-[13px] sm:text-sm text-primary outline-none transition-all"
                                        >
                                            <option value="">{l('აირჩიეთ დარბაზი', 'Выберите зал', 'Select Hall')}</option>
                                            {activeHalls.map(h => (
                                                <option key={h.id} value={h.id}>{h.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                </div>
                            )}

                            {/* Validity Period */}
                            <div className="space-y-4">
                                <label className="text-[9px] font-black text-muted tracking-widest px-1 border-b border-border-subtle pb-1.5 block">{t.periodDuration}</label>
                                <div className="space-y-3">
                                    <div className="space-y-1.5 bg-surface/30 p-3 rounded-xl border border-border-subtle">
                                        <StandardDatePicker
                                            label="საწყისი თარიღი"
                                            value={startDate}
                                            onChange={v => setStartDate(v)}
                                        />
                                    </div>
                                    <div className="space-y-1.5 bg-surface/30 p-3 rounded-xl border border-border-subtle relative">
                                        <StandardDatePicker
                                            label="დასრულების თარიღი"
                                            value={endDate}
                                            onChange={v => setEndDate(v)}
                                            disabled={neverExpires}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between px-1">
                                            <label className="text-[9px] font-black text-muted tracking-widest">{t.days}</label>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input type="checkbox" checked={neverExpires} onChange={e => setNeverExpires(e.target.checked)} className="w-3 h-3 accent-indigo-500 rounded" />
                                                <span className="text-[8px] font-bold text-muted">{t.neverExpires}</span>
                                            </label>
                                        </div>
                                        <input
                                            type="number"
                                            value={days}
                                            disabled={neverExpires}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => setDays(parseInt(e.target.value) || '')}
                                            className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-xs font-bold text-primary outline-none focus:border-indigo-500/40 transition-all disabled:opacity-50"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between px-1">
                                            <label className="text-[9px] font-black text-muted tracking-widest">{t.lessons}</label>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} className="w-3 h-3 accent-indigo-500 rounded" />
                                                <span className="text-[8px] font-bold text-muted">{t.unlimited}</span>
                                            </label>
                                        </div>
                                        <input
                                            type="number"
                                            value={sessions}
                                            disabled={unlimited}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => setSessions(parseInt(e.target.value) || '')}
                                            className="w-full bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-xs font-bold text-primary outline-none focus:border-indigo-500/40 transition-all disabled:opacity-50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 📅 SCHEDULE SELECTOR (Only for Individual) */}
                            {selectedType === 'individual' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                    <label className="text-[9px] font-black text-indigo-500 tracking-widest px-1 border-b border-indigo-500/20 pb-1.5 block uppercase">
                                        {l('გაკვეთილების გრაფიკი', 'График занятий', 'Lesson Schedule')}
                                    </label>
                                    
                                    <div className="space-y-4">
                                        {/* Day Selector */}
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { id: 1, label: l('ორშ', 'Пн', 'Mon') },
                                                { id: 2, label: l('სამ', 'Вт', 'Tue') },
                                                { id: 3, label: l('ოთხ', 'Сრ', 'Wed') },
                                                { id: 4, label: l('ხუთ', 'Чт', 'Thu') },
                                                { id: 5, label: l('პარ', 'Пტ', 'Fri') },
                                                { id: 6, label: l('შაბ', 'Сб', 'Sat') },
                                                { id: 0, label: l('კვი', 'Вს', 'Sun') },
                                            ].map(d => {
                                                const isActive = schedule.some(s => s.day === d.id);
                                                return (
                                                    <button
                                                        key={d.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isActive) {
                                                                setSchedule(prev => prev.filter(s => s.day !== d.id));
                                                            } else {
                                                                setSchedule(prev => [...prev, { day: d.id, time: '18:00', hallId: settings.activeBranchId ? (settings.branches.find(b => b.id === settings.activeBranchId)?.halls[0]?.id || '') : '' }]);
                                                            }
                                                        }}
                                                        className={cn(
                                                            "w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black transition-all border",
                                                            isActive 
                                                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md" 
                                                                : "bg-surface border-border-subtle text-muted hover:border-indigo-500/40"
                                                        )}
                                                    >
                                                        {d.label}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Schedule Details */}
                                        {schedule.length > 0 && (
                                            <div className="space-y-3 bg-indigo-500/5 p-3 rounded-2xl border border-indigo-500/10">
                                                {schedule.sort((a, b) => (a.day === 0 ? 7 : a.day) - (b.day === 0 ? 7 : b.day)).map((s, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 animate-in slide-in-from-left-2">
                                                        <div className="w-10 text-[9px] font-black text-indigo-600 uppercase">
                                                            {[l('კვი', 'Вს', 'Sun'), l('ორშ', 'Пн', 'Mon'), l('სამ', 'Вт', 'Tue'), l('ოთხ', 'Сრ', 'Wed'), l('ხუთ', 'Чт', 'Thu'), l('პარ', 'Пტ', 'Fri'), l('შაბ', 'Сბ', 'Sat')][s.day]}
                                                        </div>
                                                        <input 
                                                            type="time" 
                                                            value={s.time}
                                                            onChange={e => {
                                                                const next = [...schedule];
                                                                next[idx].time = e.target.value;
                                                                setSchedule(next);
                                                            }}
                                                            className="bg-white border border-border-subtle rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-indigo-500/40"
                                                        />
                                                        <select
                                                            value={s.hallId}
                                                            onChange={e => {
                                                                const next = [...schedule];
                                                                next[idx].hallId = e.target.value;
                                                                setSchedule(next);
                                                            }}
                                                            className="flex-1 bg-white border border-border-subtle rounded-lg px-2 py-1 text-[10px] font-bold outline-none focus:border-indigo-500/40"
                                                        >
                                                            <option value="">{t.selectHall}</option>
                                                            {settings.branches.find(b => b.id === settings.activeBranchId)?.halls.map(h => (
                                                                <option key={h.id} value={h.id}>{h.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Color Selector */}
                                        <div className="flex items-center gap-3 px-1">
                                            <label className="text-[9px] font-black text-muted tracking-widest uppercase">{l('ფერი კალენდარში', 'Цвет в календаре', 'Calendar Color')}</label>
                                            <div className="flex gap-1.5">
                                                {['#6d28d9', '#db2777', '#dc2626', '#ea580c', '#059669', '#0284c7', '#4f46e5'].map(c => (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        onClick={() => setEventColor(c)}
                                                        className={cn(
                                                            "w-6 h-6 rounded-lg transition-all border-2",
                                                            eventColor === c ? "border-primary scale-110 shadow-sm" : "border-transparent"
                                                        )}
                                                        style={{ backgroundColor: c }}
                                                    />
                                                ))}
                                                <input 
                                                    type="color" 
                                                    value={eventColor} 
                                                    onChange={e => setEventColor(e.target.value)}
                                                    className="w-6 h-6 rounded-lg border-2 border-transparent bg-transparent cursor-pointer p-0 overflow-hidden"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {/* Footer */}
                {step === 'form' && (
                    <div className="px-5 py-4 border-t border-border-subtle bg-white/90 backdrop-blur-md sticky bottom-0 z-10 pb-10 sm:pb-8 flex-shrink-0">
                        <div className="flex gap-3">
                            <button onClick={onClose} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-[11px] sm:text-xs uppercase tracking-widest transition-all text-center">
                                {t.cancel}
                            </button>
                            <button
                                onClick={handleIssue}
                                disabled={!studentId || !planId || (plans.find(p => p.id === planId)?.type === 'group' && !groupId)}
                                className="flex-1 py-3 bg-[#6d28d9] hover:bg-[#5b21b6] disabled:opacity-50 text-white rounded-xl font-black text-[11px] sm:text-xs flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-widest px-2"
                            >
                                <Check className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" /> <span className="truncate">{t.issueAction}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </MainPortal>
    );
}
