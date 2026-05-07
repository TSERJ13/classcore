'use client';

import { useState, useEffect, useMemo } from 'react';
import { Save, Plus, CreditCard, User, Building2, ChevronRight, ArrowLeft, Percent, Wallet, Banknote, Calendar, Clock, Undo2, X, Tag, ArrowRight, Check, Palette, Trash2, LayoutGrid, DoorOpen } from 'lucide-react';
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
import { getHalls } from '@/lib/hall-store';
import { addEvent, getEvents, saveEvents } from '@/lib/event-store';
import { generateTimeOptions } from '@/lib/date-utils';
interface IssueSubscriptionModalProps {
    open: boolean;
    onClose: () => void;
    onIssue: (data: Omit<SubscriptionInfo, 'id'>) => void;
    initialStudentId?: string;
    defaultType?: 'group' | 'individual' | 'rental';
    centered?: boolean;
}

type PayMethod = 'cash' | 'card' | 'transfer';

const addHour = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return time;
    const nh = (h + 1) % 24;
    return `${nh.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

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
    const [selectedColor, setSelectedColor] = useState('#6366f1');
    const [selectedHallId, setSelectedHallId] = useState('');
    const [secondaryStudentId, setSecondaryStudentId] = useState('');
    const [isCouple, setIsCouple] = useState(false);
    const [couplePartnerName, setCouplePartnerName] = useState(''); // Manual name fallback
    const [selectedPartnerId, setSelectedPartnerId] = useState('');
    const [slots, setSlots] = useState<Array<{ dayOfWeek: number, startTime: string, endTime: string }>>([]);

    const halls = useMemo(() => getHalls(), []);

    // Payment fields
    const [payMethod, setPayMethod] = useState<PayMethod>('cash');
    const [amountPaid, setAmountPaid] = useState<number | ''>('');
    const [useBalance, setUseBalance] = useState(false);

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

    const appliedBalance = useBalance ? Math.min(studentBalance, totalDue) : 0;
    const remaining = Math.max(0, totalDue - appliedBalance);
    const actualPaid = typeof amountPaid === 'number' ? amountPaid : remaining;
    const overpayment = Math.max(0, actualPaid - remaining);
    const newBalance = Math.round((studentBalance - appliedBalance + overpayment) * 100) / 100;

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
            setPlanId(''); 
            setSelectedColor('#6366f1');
            setSelectedHallId(getHalls()[0]?.id || 'main');
            setSlots([]);
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
        badge: (s.balance ?? 0) > 0 ? `💰 ${formatCurrency(s.balance || 0, settings.currency)}` : undefined
    })), [students, settings.currency]);

    const planOptions = useMemo(() => availablePlans.map(p => ({
        value: p.id,
        label: p.is_default ? `⭐ ${p.name}` : p.name,
        subLabel: `${formatCurrency(p.price, settings.currency)} (${p.type})`
    })), [availablePlans, settings.currency]);

    const groupOptions = useMemo(() => groups.map(g => ({
        value: g.id,
        label: g.name,
        subLabel: g.coach || undefined
    })), [groups]);

    const teacherOptions = useMemo(() => [
        { value: '', label: l('არჩეული არ არის', 'Не выбран', 'Not selected') },
        ...settings.staff.filter(s => s.status === 'active' && (s.role === 'teacher' || s.role === 'coach' || s.assigned_individual || s.role === 'staff')).map(t => ({
            value: t.id,
            label: `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.full_name,
            subLabel: t.specialty?.join(', ')
        }))
    ], [settings.staff]);

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

            if (plan.type === 'group') {
                if (plan.group_id && groups.find(g => g.id === plan.group_id)) {
                    setGroupId(plan.group_id);
                    const g = groups.find(gx => gx.id === plan.group_id);
                    if (g?.teacherId) setTeacherId(g.teacherId);
                } else if (studentGroup && groups.find(g => g.id === studentGroup)) {
                    setGroupId(studentGroup);
                    const g = groups.find(gx => gx.id === studentGroup);
                    if (g?.teacherId) setTeacherId(g.teacherId);
                } else if (groups.length > 0) {
                    setGroupId(groups[0].id);
                    const g = groups.find(gx => gx.id === groups[0].id);
                    if (g?.teacherId) setTeacherId(g.teacherId);
                } else {
                    setGroupId('');
                }
            } else {
                // Individual or Rental
                setGroupId('');
                // If it's individual, we might want to default to the coach from the plan
                if (plan.teacher_id) {
                    setTeacherId(plan.teacher_id);
                }
            }

            if (plan.coach) {
                const tc = settings.staff.find(s => s.full_name === plan.coach || `${s.first_name} ${s.last_name}` === plan.coach);
                if (tc) setTeacherId(tc.id);
            }
        }
    }, [planId, groups, studentId, settings.staff]);

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
        if (!studentId || !planId || !startDate || !endDate) return;

        const plan = plans.find(p => p.id === planId);
        if (!plan) return;

        const isGroupPlan = plan.type === 'group';
        if (isGroupPlan && !groupId) return;

        const subType = plan.period === 'unlimited' ? 'monthly' : 'sessions';
        const sessionsTotal = unlimited ? null : (typeof sessions === 'number' ? sessions : 12);

        // Balance logic: update student balance
        const paidNow = typeof amountPaid === 'number' ? amountPaid : remaining;
        if (newBalance !== studentBalance) {
            updateStudent(studentId, { balance: newBalance });
        }

        if (isGroupPlan && groupId) {
            const student = students.find(s => s.id === studentId);
            if (student) {
                const enrolled = student.enrolled_group_ids || [];
                if (!enrolled.includes(groupId)) {
                    updateStudent(studentId, { enrolled_group_ids: [...enrolled, groupId] });
                }
            }
        }

        const commentParts: string[] = [];
        commentParts.push(`${l('გადახდა', 'Оплата', 'Paid')}: ${formatCurrency(paidNow, settings.currency)} (${payMethod === 'cash' ? l('ნაღდი', 'Наличные', 'Cash') : payMethod === 'card' ? l('ბარათი', 'Карта', 'Card') : l('გადარიცხვა', 'Перевод', 'Transfer')})`);
        if (appliedBalance > 0) commentParts.push(`${l('ბალანსიდან', 'С баланса', 'From Balance')}: ${formatCurrency(appliedBalance, settings.currency)}`);
        if (overpayment > 0) commentParts.push(`${l('ბალანსზე', 'На баланс', 'To Balance')}: +${formatCurrency(overpayment, settings.currency)}`);

        const selectedGroup = isGroupPlan ? groups.find(g => g.id === groupId) : null;

        const partner = isCouple && secondaryStudentId ? students.find(s => s.id === secondaryStudentId) : null;
        const coupleId = isCouple ? `cpl-${Date.now()}` : undefined;

        const baseSubData = {
            plan: plan.name,
            sessions_used: 0,
            sessions_total: sessionsTotal,
            status: 'active',
            purchased_at: startDate,
            expires_at: endDate,
            type: subType,
            plan_type: plan.type,
            group_id: isGroupPlan ? groupId : undefined,
            category: selectedGroup ? selectedGroup.type : (plan.type === 'individual' ? 'Individual' : undefined),
            payment_method: payMethod,
            teacher_id: teacherId || undefined,
            teacher_comment: commentParts.join(' · '),
            schedule_slots: plan.type === 'individual' ? slots : undefined,
            couple_id: coupleId,
        };

        // 1. Issue Primary Subscription
        onIssue({
            ...baseSubData,
            student_id: studentId,
            amount_paid: paidNow,
            couple_partner_id: secondaryStudentId || undefined,
            couple_partner_name: partner?.full_name || couplePartnerName || undefined,
        });

        // 2. Issue Secondary Subscription (if couple)
        if (isCouple && secondaryStudentId) {
            onIssue({
                ...baseSubData,
                student_id: secondaryStudentId,
                amount_paid: 0, // Paid by primary
                couple_partner_id: studentId,
                couple_partner_name: selectedStudent?.full_name || undefined,
                teacher_comment: `${l('მეწყვილის აბონემენტი', 'Абонемент напарника', 'Partner subscription')} · ${commentParts.join(' · ')}`,
            });
        }

        // 📅 Create Calendar Events for Individual Slots
        if ((selectedType === 'individual' || plan.type === 'individual') && slots.length > 0) {
            let lessonsCreated = 0;
            const maxLessons = sessionsTotal || 999;
            let checkDate = new Date(startDate + 'T00:00:00');
            const endD = new Date(endDate + 'T00:00:00');
            
            const newEvents: any[] = [];
            let safetyLimit = 365;

            // Generate events within the validity period or until max lessons reached
            while (lessonsCreated < maxLessons && checkDate <= endD && safetyLimit > 0) {
                const jsDay = checkDate.getDay();
                const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // Mon=0 ... Sun=6
                
                const slot = slots.find(s => s.dayOfWeek === dayOfWeek);
                if (slot) {
                    const eventTitle = isCouple && partner 
                        ? `${selectedStudent?.full_name} & ${partner.full_name}`
                        : `${selectedStudent?.full_name || 'Student'}`;

                    newEvents.push({
                        id: `ind-${studentId}-${Date.now()}-${lessonsCreated}`,
                        org_id: settings.studioSlug,
                        title: eventTitle,
                        type: 'individual',
                        hall_id: selectedHallId || 'main',
                        teacher_id: teacherId || undefined,
                        student_id: studentId,
                        date: getLocalISODate(checkDate),
                        start_time: slot.startTime,
                        end_time: slot.endTime,
                        color: selectedColor,
                        couple_partner_id: secondaryStudentId || undefined,
                        couple_partner_name: partner?.full_name || couplePartnerName || undefined,
                        recurring: 'none',
                        reminder_30m: false,
                        created_at: new Date().toISOString()
                    });
                    lessonsCreated++;
                }
                checkDate.setDate(checkDate.getDate() + 1);
                safetyLimit--;
            }

            if (newEvents.length > 0) {
                const current = getEvents();
                saveEvents([...current, ...newEvents]);
            }
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
                                <div className="space-y-1.5 relative">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[9px] font-black text-muted tracking-wider px-1 uppercase">{t.selectClient}</label>
                                        {selectedType === 'individual' && (
                                            <button 
                                                type="button"
                                                onClick={() => setIsCouple(!isCouple)}
                                                className={cn(
                                                    "text-[9px] font-black px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1.5 uppercase tracking-wider",
                                                    isCouple ? "bg-indigo-500 text-white border-indigo-500 shadow-sm" : "text-indigo-500 border-indigo-500/30 hover:bg-indigo-50"
                                                )}
                                            >
                                                {isCouple ? <Minus className="w-2.5 h-2.5 stroke-[3]" /> : <Plus className="w-2.5 h-2.5 stroke-[3]" />}
                                                {isCouple ? l('წაშლა', 'Удалить', 'Remove') : l('დამატება', 'Добавить', 'Add Partner')}
                                            </button>
                                        )}
                                    </div>
                                    <SearchSelect
                                        options={studentOptions}
                                        value={studentId}
                                        onChange={setStudentId}
                                        placeholder={t.selectClient}
                                    />
                                </div>

                                {isCouple && selectedType === 'individual' && (
                                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <label className="text-[9px] font-black text-muted tracking-wider px-1 uppercase">{l('მეწყვილე / პარტნიორი (სტუდენტი)', 'Напарник / Партнер (Студент)', 'Partner (Student)')}</label>
                                        <SearchSelect
                                            options={studentOptions.filter(o => o.value !== studentId)}
                                            value={secondaryStudentId}
                                            onChange={setSecondaryStudentId}
                                            placeholder={l('აირჩიეთ მეწყვილე...', 'Выберите напарника...', 'Select partner...')}
                                        />
                                    </div>
                                )}

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

                                {selectedType === 'individual' && (
                                    <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
                                        {/* Color Selector */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1 flex items-center gap-2 uppercase">
                                                <Palette className="w-3 h-3" /> {t.groupColor}
                                            </label>
                                            <label className="flex items-center gap-3 bg-surface border border-border-subtle rounded-xl p-2 cursor-pointer hover:border-indigo-500/40 transition-colors">
                                                <span className="w-8 h-8 rounded-lg border border-black/10 flex-shrink-0 overflow-hidden relative">
                                                    <input type="color" value={selectedColor} onChange={e => setSelectedColor(e.target.value)}
                                                        className="absolute -inset-2 w-12 h-12 cursor-pointer opacity-0" />
                                                    <div className="w-full h-full pointer-events-none" style={{ backgroundColor: selectedColor }} />
                                                </span>
                                                <span className="text-xs text-muted font-medium select-none truncate">{t.chooseAnotherColor}</span>
                                            </label>
                                        </div>

                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1 flex items-center gap-2 uppercase">
                                                    <User className="w-3 h-3" /> {l('მეწყვილე / პარტნიორი (სტუდენტი)', 'Партнер / Второй чел. (Студент)', 'Partner / Second Person (Student)')}
                                                </label>
                                                <SearchSelect
                                                    options={students.map(s => ({ id: s.id, name: s.full_name || s.id }))}
                                                    value={selectedPartnerId}
                                                    onChange={id => {
                                                        setSelectedPartnerId(id);
                                                        const s = students.find(x => x.id === id);
                                                        if (s) setCouplePartnerName(s.full_name || '');
                                                    }}
                                                    placeholder={l('აირჩიეთ მეწყვილე...', 'Выберите партнера...', 'Select partner student...')}
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1 flex items-center gap-2 uppercase">
                                                    <Tag className="w-3 h-3" /> {l('პარტნიორის სახელი (ხელით)', 'Имя партнера (вручную)', 'Partner Name (Manual)')}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={couplePartnerName}
                                                    onChange={e => setCouplePartnerName(e.target.value)}
                                                    placeholder={l('მაგ: ნინო ბერიძე', 'Напр: Нино Беридзе', 'e.g. Nino Beridze')}
                                                    className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm font-bold text-primary outline-none focus:border-indigo-500/40 transition-all shadow-sm"
                                                />
                                            </div>
                                        </div>

                                        {/* Group-style Schedule Builder */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1 flex items-center gap-2 uppercase">
                                                    <Calendar className="w-3.5 h-3.5" /> {t.schedule}
                                                </label>
                                            </div>

                                            <div className="bg-surface/50 border border-border-subtle rounded-2xl p-4 space-y-4">
                                                <label className="text-[10px] text-muted block tracking-wider font-black opacity-40">{t.selectDaysAndTimes}</label>
                                                <div className="flex items-center justify-between gap-1">
                                                    {[0, 1, 2, 3, 4, 5, 6].map(d => {
                                                        const isActive = slots.some(s => s.dayOfWeek === d);
                                                        const DAY_LABELS = lang === 'ka' ? ['ორ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'] : lang === 'ru' ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вს'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                                                        return (
                                                            <button key={d} 
                                                                onClick={() => {
                                                                    setSlots(prev => {
                                                                        const existing = prev.find(s => s.dayOfWeek === d);
                                                                        if (existing) return prev.filter(s => s.dayOfWeek !== d);
                                                                        const base = prev[0] || { startTime: '13:00', endTime: '14:00' };
                                                                        return [...prev, { dayOfWeek: d, startTime: base.startTime, endTime: base.endTime }];
                                                                    });
                                                                }}
                                                                className={cn(
                                                                    "flex-1 h-9 rounded-lg text-[10px] font-black transition-all border shrink-0",
                                                                    isActive ? "text-white" : "bg-card border-border-subtle text-muted hover:border-indigo-500/40"
                                                                )}
                                                                style={isActive ? { backgroundColor: selectedColor, borderColor: selectedColor } : {}}>
                                                                {DAY_LABELS[d]}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                <div className="space-y-2">
                                                    {slots.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((slot) => {
                                                        const DAY_LABELS = lang === 'ka' ? ['ორ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'] : lang === 'ru' ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вს'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                                                        const timeOptions = generateTimeOptions(15);
                                                        return (
                                                            <div key={slot.dayOfWeek} className="flex flex-row items-center gap-2 bg-card/30 p-2 rounded-xl border border-border-subtle/20">
                                                                <span className="text-[10px] font-black text-primary w-12 pl-1 truncate">{DAY_LABELS[slot.dayOfWeek]}</span>
                                                                <div className="flex-1 flex items-center gap-1.5">
                                                                    <SearchSelect 
                                                                        options={timeOptions}
                                                                        value={slot.startTime}
                                                                        allowCustom
                                                                        onChange={val => setSlots(slots.map(s => s.dayOfWeek === slot.dayOfWeek ? { ...s, startTime: val, endTime: addHour(val) } : s))}
                                                                        className="flex-1 !border-none [&>div]:bg-surface/50 [&>div]:px-2 [&>div]:py-1 [&>div]:text-[10px] [&>div]:min-h-[28px]"
                                                                    />
                                                                    <span className="text-muted/20 font-black text-[10px]">-</span>
                                                                    <SearchSelect 
                                                                        options={timeOptions}
                                                                        value={slot.endTime}
                                                                        allowCustom
                                                                        onChange={val => setSlots(slots.map(s => s.dayOfWeek === slot.dayOfWeek ? { ...s, endTime: val } : s))}
                                                                        className="flex-1 !border-none [&>div]:bg-surface/50 [&>div]:px-2 [&>div]:py-1 [&>div]:text-[10px] [&>div]:min-h-[28px]"
                                                                    />
                                                                </div>
                                                                <button onClick={() => setSlots(slots.filter(s => s.dayOfWeek !== slot.dayOfWeek))} className="p-1.5 text-red-400 hover:text-red-500 transition-colors">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {slots.length === 0 && (
                                                    <p className="text-xs text-muted opacity-40 italic text-center py-2">
                                                        {t.atLeastOneDay}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Calendar update notice */}
                                            {slots.length > 0 && (
                                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl animate-in fade-in slide-in-from-top-2"
                                                     style={{ backgroundColor: `${selectedColor}08`, border: `1px solid ${selectedColor}20` }}>
                                                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: selectedColor }} />
                                                    <p className="text-[10px] font-bold opacity-80" style={{ color: selectedColor }}>
                                                        {t.calendarUpdateNotice}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Global Hall Selector */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-muted tracking-widest opacity-40 px-1 flex items-center gap-2 uppercase">
                                                <DoorOpen className="w-3 h-3" /> {lang === 'ka' ? 'დარბაზი' : 'Hall'}
                                            </label>
                                            <SearchSelect
                                                options={halls.map(h => ({ value: h.id, label: h.name }))}
                                                value={selectedHallId}
                                                onChange={setSelectedHallId}
                                                placeholder={lang === 'ka' ? 'აირჩიეთ დარბაზი' : 'Select Hall'}
                                                className="!border-border-subtle hover:!border-indigo-500/40 [&>div]:py-3.5 [&>div]:px-4 shadow-sm"
                                            />
                                        </div>
                                    </div>
                                )}
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
