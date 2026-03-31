'use client';
import { pushStudioStateToCloud } from '@/lib/sync-store';
import { type StaffMember } from '@/types';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Mail, Lock, User, ArrowRight, ShieldCheck, Sparkles, Building2, UserSquare2, Users2, UserPlus2, CheckCircle2, ChevronRight } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { cn, compactSlugify, getScopedKey } from '@/lib/utils';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { generateTimeOptions, generateDayOptions, generateMonthOptions, generateYearOptions } from '@/lib/date-utils';

type Step = 'account' | 'halls' | 'teachers' | 'groups' | 'students' | 'success';

export default function RegisterPage() {
    const { t, lang } = useT();
    const [step, setStep] = useState<Step>('account');
    const [prevSteps, setPrevSteps] = useState<Step[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('male');
    const [regData, setRegData] = useState({
        email: '', password: '', firstName: '', lastName: '', 
        studioName: '', studioSlug: '', phone: '', orgId: '',
        hallId: '', teacherId: '', groupId: '', studentId: ''
    });

    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [groupTimes, setGroupTimes] = useState<Record<string, { start: string, end: string }>>({});
    const [birthDateParts, setBirthDateParts] = useState({ day: '', month: '', year: '' });

    const timeOptions = generateTimeOptions(30);
    const dayOptions = generateDayOptions();
    const monthOptions = generateMonthOptions(lang);
    const yearOptions = generateYearOptions(1950, new Date().getFullYear());

    // Persistence: Load from sessionStorage on mount
    useEffect(() => {
        const saved = sessionStorage.getItem('cc_registration_wizard_state');
        if (saved) {
            try {
                const { step: s, prevSteps: p, regData: r, selectedDays: d, selectedGender: g, groupTimes: gt, birthDateParts: bdp } = JSON.parse(saved);
                if (s) setStep(s);
                if (p) setPrevSteps(p);
                if (r) setRegData(r);
                if (d) setSelectedDays(d);
                if (g) setSelectedGender(g);
                if (gt) setGroupTimes(gt);
                if (bdp) setBirthDateParts(bdp);
            } catch (e) {
                console.error('Failed to restore registration state', e);
            }
        }
    }, []);

    // Persistence: Save to sessionStorage on change
    useEffect(() => {
        if (step !== 'account' && step !== 'success') {
            sessionStorage.setItem('cc_registration_wizard_state', JSON.stringify({ 
                step, prevSteps, regData, selectedDays, selectedGender, groupTimes, birthDateParts 
            }));
        }
        if (step === 'success') {
            sessionStorage.removeItem('cc_registration_wizard_state');
        }
    }, [step, prevSteps, regData, selectedDays, selectedGender, groupTimes, birthDateParts]);

    const l = (ge: string, ru: string, en: string) =>
        lang === 'ka' ? ge : lang === 'ru' ? ru : en;

    const handleInitialRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(e.target as HTMLFormElement);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;
        const firstName = formData.get('firstName') as string;
        const lastName = formData.get('lastName') as string;
        const studioName = formData.get('studioName') as string;
        const phone = formData.get('phone') as string;

        try {
            const { createClient } = await import('@/lib/supabase/client');
            const supabase = createClient();

            // 1. ATOMIC SLUG RESERVATION: Ensure the slug is unique before proceeding
            let studioSlug = compactSlugify(studioName);
            
            const { data: cloudList, error: listError } = await supabase.from('studio_settings').select('studio_slug, owner_email');
            if (!listError && cloudList) {
                const existingSlugs = cloudList.map(s => s.studio_slug);
                let counter = 1;
                const baseSlug = studioSlug;
                
                while (existingSlugs.includes(studioSlug)) {
                    const targetInfo = cloudList.find(s => s.studio_slug === studioSlug);
                    if (targetInfo && targetInfo.owner_email === email) {
                        break; 
                    }
                    studioSlug = `${baseSlug}${counter++}`;
                }
            }

            const orgId = crypto.randomUUID();

            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/confirm`,
                    data: {
                        role: 'owner',
                        first_name: firstName,
                        last_name: lastName,
                        full_name: `${firstName} ${lastName}`.trim(),
                        phone: phone,
                        phone_number: phone,
                        studio_name: studioName,
                        org_id: orgId,
                        studio_slug: studioSlug
                    }
                }
            });

            if (signUpError) {
                if (signUpError.message.includes('already registered')) {
                    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                    if (signInError) throw signInError;
                } else {
                    throw signUpError;
                }
            }

            const userData = {
                email, password, firstName, lastName, 
                studioName, studioSlug, phone, orgId,
                userId: data.user?.id,
                hallId: crypto.randomUUID(),
                teacherId: crypto.randomUUID(),
                groupId: crypto.randomUUID(),
                studentId: `S-${Math.floor(1000 + Math.random() * 9000)}`
            };
            
            if (typeof window !== 'undefined') {
                localStorage.setItem('cc_active_studio_slug', studioSlug);
                localStorage.setItem('cc_studio_name', studioName);
                document.cookie = `cc_active_slug=${studioSlug}; path=/; max-age=31536000; SameSite=Lax`;
                document.cookie = `cc_studio_name=${encodeURIComponent(studioName)}; path=/; max-age=31536000; SameSite=Lax`;

                const key = `cc_studio_settings_${studioSlug}`;
                const basicSettings = {
                    orgId,
                    studioName,
                    studioSlug,
                    language: 'ka',
                    currency: 'GEL',
                    branches: [{ id: 'main', name: 'მთავარი ფილიალი', is_active: true }],
                    owner_info: {
                        first_name: firstName,
                        last_name: lastName,
                        email: email,
                        phone: phone
                    },
                    staff: [{
                        id: data.user?.id || Math.random().toString(36).substring(2, 9),
                        org_id: orgId,
                        first_name: firstName,
                        last_name: lastName,
                        full_name: `${firstName} ${lastName}`.trim(),
                        phone: phone,
                        email: email,
                        role: 'owner',
                        status: 'active',
                        permissions: { 
                            canViewAttendance: true, canViewSubscriptions: true, canViewStudents: true,
                            canViewCalendar: true, canEditCalendar: true, canViewGroups: true,
                            canViewTeachers: true, canViewHalls: true, canViewShop: true,
                            canViewAnalytics: true, canViewSMS: true, canAddStudents: true,
                            canDeleteRecords: true, manageBilling: true, viewFinancials: true,
                            manageInventory: true
                        },
                        created_at: new Date().toISOString()
                    }]
                };
                localStorage.setItem(key, JSON.stringify(basicSettings));

                // Push initial owner info and settings to cloud immediately
                // so Superadmin sees the names right away even if they don't finish the wizard
                pushStudioStateToCloud(studioSlug, basicSettings.staff as StaffMember[], basicSettings, 0, orgId);
            }

            setRegData(userData as any);
            setPrevSteps(['account']);
            setStep('halls');
            setLoading(false);
        } catch (err: any) {
            setError(err.message || t.registerError);
            setLoading(false);
        }
    };

    const saveStepData = async (type: string, data: any) => {
        if (typeof window === 'undefined') return;
        const slug = regData.studioSlug;
        
        let baseType = `cc_${type}`;
        if (type === 'halls') baseType = 'cc_halls';
        if (type === 'groups') baseType = 'cc_groups';
        if (type === 'student_data') baseType = 'cc_student_data';

        // SPECIAL CASE: Teachers are part of studio_settings/staff
        if (type === 'teachers') {
            const settingsKey = `cc_studio_settings_${slug}`;
            try {
                const raw = localStorage.getItem(settingsKey);
                const settings = raw ? JSON.parse(raw) : { staff: [] };
                
                // Use the persistent teacherId
                const tid = regData.teacherId || data.id;
                const finalData = { ...data, id: tid };

                const existingIdx = (settings.staff || []).findIndex((s: any) => s.id === tid);
                if (existingIdx > -1) {
                    settings.staff[existingIdx] = { ...settings.staff[existingIdx], ...finalData };
                } else {
                    settings.staff = [...(settings.staff || []), finalData];
                }
                
                localStorage.setItem(settingsKey, JSON.stringify(settings));
                return;
            } catch (e) {
                console.error('Failed to save teacher to settings', e);
            }
        }

        const key = getScopedKey(baseType, slug, 'main');
        
        if (type === 'student_data') {
            const sid = regData.studentId || data.id || `S-${Math.floor(1000 + Math.random() * 9000)}`;
            let existing: any = {};
            try {
                const raw = localStorage.getItem(key);
                existing = raw ? JSON.parse(raw) : {};
            } catch {}
            localStorage.setItem(key, JSON.stringify({ ...existing, [sid]: { ...data, id: sid } }));
            return;
        }

        // For Halls and Groups: find and update by ID to prevent duplication
        let list: any[] = [];
        try {
            const raw = localStorage.getItem(key);
            list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) list = [];
        } catch {}

        const targetId = data.id;
        const idx = list.findIndex((item: any) => item.id === targetId);
        
        if (idx > -1) {
            list[idx] = { ...list[idx], ...data };
        } else {
            list.push(data);
        }

        localStorage.setItem(key, JSON.stringify(list));
    };

    const nextStep = (next: Step) => {
        setPrevSteps(prev => [...prev, step]);
        setStep(next);
    };

    const performFinalSync = async () => {
        setLoading(true);
        setError(null);
        try {
            const slug = regData.studioSlug;
            // 1. Gather all local setup data
            const categories = [
                { id: 'halls', base: 'cc_halls' },
                { id: 'groups', base: 'cc_groups' },
                { id: 'student_data', base: 'cc_student_data' }
            ];
            const studioData: any = {};
            
            categories.forEach(cat => {
                const key = getScopedKey(cat.base, slug, 'main');
                const raw = localStorage.getItem(key);
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        studioData[cat.id === 'student_data' ? 'students' : cat.id] = parsed;
                    } catch (e) {}
                }
            });

            // 2. Load settings for staff list
            const settingsKey = `cc_studio_settings_${slug}`;
            const settingsRaw = localStorage.getItem(settingsKey);
            const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
            const staff = settings.staff || [];

            // 3. Batch push to cloud
            await pushStudioStateToCloud(slug, staff, studioData, 0, regData.orgId);
            
            setLoading(false);
            return true;
        } catch (err: any) {
            console.error('Final sync failed:', err);
            setError(lang === 'ka' ? 'სინქრონიზაცია ვერ მოხერხდა. სცადეთ თავიდან.' : 'Sync failed. Please try again.');
            setLoading(false);
            return false;
        }
    };

    const goBack = () => {
        if (prevSteps.length > 0) {
            const last = prevSteps[prevSteps.length - 1];
            setStep(last);
            setPrevSteps(prev => prev.slice(0, -1));
        }
    };

    const renderStepHeader = () => {
        const steps = [
            { id: 'account', icon: User, label: t.createAccount },
            { id: 'halls', icon: Building2, label: t.halls },
            { id: 'teachers', icon: UserSquare2, label: t.teachers },
            { id: 'groups', icon: Users2, label: t.groups },
            { id: 'students', icon: UserPlus2, label: t.students }
        ];

        return (
            <div className="flex items-center justify-between w-full max-w-sm mx-auto mb-10 px-2">
                {steps.map((s, i) => {
                    const isActive = step === s.id;
                    const isCompleted = ['halls', 'teachers', 'groups', 'students', 'success'].includes(step) && steps.findIndex(x => x.id === step) > i;
                    
                    return (
                        <div key={s.id} className="flex flex-col items-center gap-2 group">
                            <div className="relative flex items-center justify-center">
                                <div className={cn(
                                    "w-7 h-7 sm:w-9 sm:h-9 rounded-2xl flex items-center justify-center transition-all duration-500 relative z-10",
                                    isActive ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 ring-4 ring-indigo-50" : 
                                    isCompleted ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-slate-100 text-slate-400"
                                )}>
                                    {isCompleted ? <CheckCircle2 className="w-4 h-4 sm:w-5 h-5" /> : <s.icon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", isActive && "animate-pulse")} />}
                                </div>
                                {i < steps.length - 1 && (
                                    <div className={cn(
                                        "absolute left-[100%] w-5 sm:w-8 h-[2px] transition-all duration-1000",
                                        isCompleted ? "bg-emerald-500" : "bg-slate-100"
                                    )} />
                                )}
                            </div>
                            <span className={cn(
                                "text-[9px] font-black tracking-widest uppercase transition-all duration-300",
                                isActive ? "text-indigo-600 opacity-100" : "text-slate-400 opacity-0 group-hover:opacity-40"
                            )}>
                                {s.label.split(' ')[0]}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-y-auto">
            <div className="absolute top-0 left-0 w-[50%] h-full bg-indigo-50/50 blur-[120px] -z-10" />
            <div className="absolute bottom-0 right-0 w-[30%] h-1/2 bg-violet-50/50 blur-[100px] -z-10" />

            <div className="w-full max-w-[480px] space-y-6 sm:space-y-8 animate-fade-up">
                <div className="flex flex-col items-center text-center space-y-4">
                    <Link href="/" className="group flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-600/30 logo-animate-hover logo-large overflow-hidden">
                            <img src="/logo.svg" alt="Logo" className="w-full h-full object-cover" />
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">ClassCore</h1>
                    </Link>
                </div>

                {step !== 'success' && renderStepHeader()}

                <div className="bg-white/50 backdrop-blur-xl border border-slate-100 p-6 sm:p-10 rounded-3xl sm:rounded-[2.5rem] shadow-2xl shadow-indigo-500/5">
                    {step === 'account' && (
                        <form onSubmit={handleInitialRegister} className="space-y-5">
                            <div className="space-y-1 text-center mb-6">
                                <h2 className="text-xl font-black text-slate-800">{t.createStudio}</h2>
                                <p className="text-sm text-slate-500 font-medium">{t.startTrial}</p>
                            </div>
                            {error && <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl text-[11px] font-bold text-red-500 italic text-center animate-fade-up">{error}</div>}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.firstName}</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                        <input name="firstName" required placeholder="Nino" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.lastName}</label>
                                    <input name="lastName" required placeholder="Beridze" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.studioName}</label>
                                <div className="relative group">
                                    <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                    <input name="studioName" required placeholder="e.g. My Dance Academy" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.phoneLabel || 'ტელეფონი'}</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold group-focus-within:text-indigo-600 transition-colors">+995</div>
                                    <input name="phone" required type="tel" placeholder="5xx xx xx xx" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-16 pr-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.email}</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                    <input name="email" type="email" required placeholder="contact@studio.ge" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.password}</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                    <input name="password" type="password" required placeholder="••••••••" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all" />
                                </div>
                            </div>
                            <div className="flex justify-center pt-4">
                                <button type="submit" disabled={loading} className="px-8 sm:px-12 h-10 sm:h-12 bg-indigo-600 text-white rounded-2xl font-black text-[10px] sm:text-[11px] tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 relative z-20">
                                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{t.next} <ArrowRight className="w-5 h-5" /></>}
                                </button>
                            </div>
                        </form>
                    )}

                    {step === 'halls' && (
                        <div className="space-y-6 animate-fade-up">
                            <div className="text-center space-y-2">
                                <h3 className="text-xl font-black text-slate-800">{l('დაამატეთ დარბაზი', 'Добавьте зал', 'Add a Hall')}</h3>
                                <p className="text-sm text-slate-500 font-medium">{l('მიუთითეთ დარბაზის სახელი და ტევადობა', 'Укажите название зала и вместимость', 'Enter hall name and capacity')}</p>
                            </div>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const f = new FormData(e.target as HTMLFormElement);
                                saveStepData('halls', { 
                                    id: regData.hallId || crypto.randomUUID(), 
                                    name: f.get('name'), 
                                    capacity: parseInt(f.get('capacity') as string) || 20, 
                                    sq_meters: parseInt(f.get('sq_meters') as string) || 0,
                                    is_active: true,
                                    status: 'active'
                                });
                                nextStep('teachers');
                            }} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.hallName}</label>
                                    <input name="name" required placeholder="Main Studio" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 rounded-2xl px-5 py-3 text-sm font-bold outline-none shadow-sm transition-all" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.capacity}</label>
                                        <input name="capacity" type="number" placeholder="20" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 rounded-2xl px-5 py-3 text-sm font-bold outline-none shadow-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.sqMetersShort}</label>
                                        <input name="sq_meters" type="number" placeholder="50" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 rounded-2xl px-5 py-3 text-sm font-bold outline-none shadow-sm" />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-4 pt-6">
                                    <div className="flex justify-center w-full">
                                        <button type="submit" className="px-8 sm:px-12 h-10 sm:h-12 bg-indigo-600 text-white rounded-2xl font-black text-[10px] sm:text-[11px] tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-[0.98]">
                                            {t.next} <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button type="button" onClick={goBack} className="flex-1 h-9 sm:h-11 text-slate-400 font-black text-[9px] sm:text-[10px] tracking-widest hover:text-slate-600 transition-colors uppercase border border-slate-100 rounded-2xl">
                                            {t.back}
                                        </button>
                                        <button type="button" onClick={() => nextStep('teachers')} className="flex-1 h-9 sm:h-11 text-slate-400 font-black text-[9px] sm:text-[10px] tracking-widest hover:text-slate-600 transition-colors uppercase border border-slate-100 rounded-2xl">
                                            {t.skip}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}

                    {step === 'teachers' && (
                        <div className="space-y-6 animate-fade-up">
                            <div className="text-center space-y-2">
                                <h3 className="text-xl font-black text-slate-800">{l('დაამატეთ მასწავლებელი', 'Добавьте учителя', 'Add a Teacher')}</h3>
                                <p className="text-sm text-slate-500 font-medium">{l('პირველი ინსტრუქტორი თქვენი სტუდიისთვის', 'Первый инструктор вашей студии', 'The first instructor for your studio')}</p>
                            </div>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const f = new FormData(e.target as HTMLFormElement);
                                const first = f.get('f') as string;
                                const last = f.get('l') as string;
                                const fullName = `${first} ${last}`.trim();
                                
                                saveStepData('teachers', { 
                                    id: regData.teacherId || crypto.randomUUID(), 
                                    first_name: first, 
                                    last_name: last, 
                                    full_name: fullName,
                                    phone: f.get('p'), 
                                    specialty: [f.get('s')], 
                                    role: 'teacher', 
                                    status: 'active',
                                    permissions: { 
                                        canViewAttendance: true, canViewSubscriptions: true, canViewStudents: true,
                                        canViewCalendar: true, canEditCalendar: true, canViewGroups: true,
                                        canViewTeachers: true, canViewHalls: true, canViewShop: true,
                                        canViewAnalytics: true, canViewSMS: true
                                    }
                                });
                                nextStep('groups');
                            }} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.firstName}</label>
                                        <input name="f" required placeholder="Nino" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 rounded-2xl px-5 py-3 text-sm font-bold shadow-sm outline-none transition-all" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.lastName}</label>
                                        <input name="l" required placeholder="Beridze" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 rounded-2xl px-5 py-3 text-sm font-bold shadow-sm outline-none transition-all" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.teacherPhone}</label>
                                    <input name="p" placeholder="5xx xx xx xx" className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold shadow-sm outline-none transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.specialty}</label>
                                    <input name="s" placeholder="Hip-Hop, Ballet..." className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold shadow-sm outline-none transition-all" />
                                </div>
                                <div className="flex flex-col gap-4 pt-6">
                                    <div className="flex justify-center w-full">
                                        <button type="submit" className="px-8 sm:px-12 h-10 sm:h-12 bg-indigo-600 text-white rounded-2xl font-black text-[10px] sm:text-[11px] tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all">
                                            {t.next} <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button type="button" onClick={goBack} className="flex-1 h-9 sm:h-11 text-slate-400 font-black text-[9px] sm:text-[10px] tracking-widest hover:text-slate-600 transition-colors uppercase border border-slate-100 rounded-2xl">
                                            {t.back}
                                        </button>
                                        <button type="button" onClick={() => nextStep('groups')} className="flex-1 h-9 sm:h-11 text-slate-400 font-black text-[9px] sm:text-[10px] tracking-widest hover:text-slate-600 transition-colors uppercase border border-slate-100 rounded-2xl">
                                            {t.skip}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}

                    {step === 'groups' && (
                        <div className="space-y-6 animate-fade-up">
                            <div className="text-center space-y-2">
                                <h3 className="text-xl font-black text-slate-800">{l('შექმენით ჯგუფი', 'Создайте группу', 'Create a Group')}</h3>
                                <p className="text-sm text-slate-500 font-medium">{l('პირველი საცეკვაო ან სპორტული ჯგუფი', 'Первая танцевальная группа', 'Your first group or class')}</p>
                            </div>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const f = new FormData(e.target as HTMLFormElement);
                                const gId = regData.groupId || crypto.randomUUID();
                                const gName = f.get('name') as string;

                                const dayMap: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
                                const slots = selectedDays.map(d => {
                                    const startTime = groupTimes[d]?.start || '18:00';
                                    const endTime = groupTimes[d]?.end || '19:00';
                                    
                                    return {
                                        dayOfWeek: dayMap[d],
                                        startTime,
                                        endTime
                                    };
                                });

                                saveStepData('groups', { 
                                    id: gId, 
                                    name: gName, 
                                    schedule: selectedDays.map(d => d.toUpperCase()).join('/'), 
                                    schedule_slots: slots,
                                    studio_slug: regData.studioSlug,
                                    capacity: 20,
                                    enrolled: 0,
                                    type: 'Dance',
                                    status: 'active'
                                });

                                import('@/lib/event-store').then(mod => {
                                    mod.syncGroupScheduleToCalendar(gId, gName, '', 'main', slots, '#6366f1');
                                });

                                nextStep('students');
                            }} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.groupName}</label>
                                    <input name="name" required placeholder="Hip-Hop Adults" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 rounded-2xl px-5 py-3 text-sm font-bold shadow-sm outline-none" />
                                </div>
                                <div className="space-y-4 bg-slate-50/50 p-4 sm:p-5 rounded-3xl border border-slate-100">
                                    <label className="text-[10px] font-black text-slate-400 tracking-widest block mb-2">{l('აირჩიეთ დღეები', 'Выберите дни', 'Select Days')}</label>
                                    <div className="flex flex-wrap justify-center gap-2 w-full max-w-xs mx-auto">
                                        {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d, i) => (
                                            <label key={d} className="relative cursor-pointer group flex-1 max-w-[40px]">
                                                <input 
                                                    type="checkbox" 
                                                    name={d} 
                                                    checked={selectedDays.includes(d)}
                                                    className="peer sr-only" 
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedDays(prev => [...prev, d]);
                                                        else setSelectedDays(prev => prev.filter(x => x !== d));
                                                    }}
                                                />
                                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-slate-100 bg-white flex items-center justify-center text-[9px] sm:text-[10px] font-black text-slate-400 peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:border-indigo-600 transition-all group-hover:border-indigo-200">
                                                    {lang === 'ka' ? ['ორ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'][i] : d.toUpperCase().slice(0, 3)}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    
                                    {selectedDays.length > 0 && (
                                        <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-[10px] font-black text-slate-400 tracking-widest block">{l('განრიგი', 'Расписание', 'Schedule')}</label>
                                            <div className="space-y-2">
                                                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
                                                    .filter(d => selectedDays.includes(d))
                                                    .map((d) => (
                                                        <div key={d} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-white border border-slate-100 px-3 py-2.5 sm:px-4 rounded-2xl shadow-sm">
                                                            <span className="text-[10px] font-black text-slate-500 tracking-widest uppercase sm:w-20 pl-1">
                                                                {lang === 'ka' ? ['ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი', 'კვირა'][['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(d)] : d}
                                                            </span>
                                                            <div className="flex-1 flex items-center gap-2">
                                                                <SearchSelect 
                                                                    options={timeOptions}
                                                                    value={groupTimes[d]?.start || '13:00'}
                                                                    allowCustom
                                                                    onChange={(val) => {
                                                                        const parts = val.includes(':') ? val.split(':') : [val, '0'];
                                                                        const h = isNaN(Number(parts[0])) ? 13 : Number(parts[0]);
                                                                        const m = isNaN(Number(parts[1])) ? 0 : Number(parts[1]);
                                                                        const endH = (h + 1) % 24;
                                                                        const newEnd = `${endH.toString().padStart(2, '0')}:${(m || 0).toString().padStart(2, '0')}`;
                                                                        setGroupTimes(prev => ({
                                                                            ...prev,
                                                                            [d]: { start: val, end: prev[d]?.end || newEnd }
                                                                        }));
                                                                    }}
                                                                    className="flex-1 bg-slate-50 border border-slate-100 rounded-xl !border-none [&>div]:px-2 [&>div]:py-2 [&>div]:text-[10px] [&>div]:min-h-[36px] sm:[&>div]:min-h-[32px]"
                                                                    placeholder="13:00"
                                                                />
                                                                <span className="text-slate-300 font-black text-[10px]">-</span>
                                                                <SearchSelect 
                                                                    options={timeOptions}
                                                                    value={groupTimes[d]?.end || '14:00'}
                                                                    allowCustom
                                                                    onChange={(val) => setGroupTimes(prev => ({
                                                                        ...prev,
                                                                        [d]: { start: prev[d]?.start || '13:00', end: val }
                                                                    }))}
                                                                    className="flex-1 bg-slate-50 border border-slate-100 rounded-xl !border-none [&>div]:px-2 [&>div]:py-2 [&>div]:text-[10px] [&>div]:min-h-[36px] sm:[&>div]:min-h-[32px]"
                                                                    placeholder="14:00"
                                                                />
                                                            </div>
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col gap-4 pt-4">
                                    <div className="flex justify-center w-full">
                                        <button type="submit" className="px-8 sm:px-12 h-10 sm:h-12 bg-indigo-600 text-white rounded-2xl font-black text-[10px] sm:text-[11px] tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all">
                                            {t.next} <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button type="button" onClick={goBack} className="flex-1 h-9 sm:h-11 text-slate-400 font-black text-[9px] sm:text-[10px] tracking-widest hover:text-slate-600 transition-colors uppercase border border-slate-100 rounded-2xl">
                                            {t.back}
                                        </button>
                                        <button type="button" onClick={() => nextStep('students')} className="flex-1 h-9 sm:h-11 text-slate-400 font-black text-[9px] sm:text-[10px] tracking-widest hover:text-slate-600 transition-colors uppercase border border-slate-100 rounded-2xl">
                                            {t.skip}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}

                    {step === 'students' && (
                        <div className="space-y-6 animate-fade-up">
                            <div className="text-center space-y-2">
                                <h3 className="text-xl font-black text-slate-800">{l('დაამატეთ სტუდენტი', 'Добавьте ученика', 'Add a Student')}</h3>
                                <p className="text-sm text-slate-500 font-medium">{l('პირველი მოსწავლე თქვენს სტუდიაში', 'Первый ученик в вашей студии', 'The first student in your studio')}</p>
                            </div>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                const f = new FormData(e.target as HTMLFormElement);
                                saveStepData('student_data', { 
                                    id: regData.studentId || crypto.randomUUID(),
                                    first_name: f.get('f'), 
                                    last_name: f.get('l'), 
                                    full_name: `${f.get('f')} ${f.get('l')}`.trim(),
                                    phone: f.get('p'), 
                                    birth_date: `${birthDateParts.year}-${birthDateParts.month}-${birthDateParts.day}`,
                                    gender: selectedGender,
                                    status: 'active', 
                                    registered_at: new Date().toISOString()
                                });
                                const syncRes = await performFinalSync();
                                if (syncRes) setStep('success');
                            }} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.firstName}</label>
                                        <input name="f" required placeholder="Luka" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 rounded-2xl px-5 py-3 text-sm font-bold shadow-sm outline-none" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.lastName}</label>
                                        <input name="l" required placeholder="Kvaratskhelia" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 rounded-2xl px-5 py-3 text-sm font-bold shadow-sm outline-none" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.gender}</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { id: 'male', label: t.boy, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
                                            { id: 'female', label: t.girl, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200' }
                                        ].map((g) => {
                                            const isSelected = selectedGender === g.id;
                                            return (
                                                <button
                                                    key={g.id}
                                                    type="button"
                                                    onClick={() => setSelectedGender(g.id as any)}
                                                    className={cn(
                                                        "flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden",
                                                        isSelected ? cn(g.border, g.bg, "scale-[1.02] shadow-xl shadow-indigo-500/5") : "border-slate-100 bg-white hover:border-slate-200"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-500",
                                                        isSelected ? g.bg : "bg-slate-50",
                                                        isSelected && "scale-110"
                                                    )}>
                                                        <User className={cn("w-5 h-5", isSelected ? g.color : "text-slate-400")} />
                                                    </div>
                                                    <span className={cn(
                                                        "text-[9px] font-black uppercase tracking-widest transition-colors",
                                                        isSelected ? g.color : "text-slate-400"
                                                    )}>
                                                        {g.label}
                                                    </span>
                                                    {isSelected && (
                                                        <div className={cn("absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center", g.bg)}>
                                                            <CheckCircle2 className={cn("w-3 h-3", g.color)} />
                                                        </div>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <input type="hidden" name="g" value={selectedGender} />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.studentPhone}</label>
                                    <input name="p" placeholder="5xx xx xx xx" className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold shadow-sm outline-none" />
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.birthDate}</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <SearchSelect 
                                            options={dayOptions}
                                            value={birthDateParts.day}
                                            onChange={val => setBirthDateParts(p => ({ ...p, day: val }))}
                                            placeholder="დღე"
                                        />
                                        <SearchSelect 
                                            options={monthOptions}
                                            value={birthDateParts.month}
                                            onChange={val => setBirthDateParts(p => ({ ...p, month: val }))}
                                            placeholder="თვე"
                                        />
                                        <SearchSelect 
                                            options={yearOptions}
                                            value={birthDateParts.year}
                                            onChange={val => setBirthDateParts(p => ({ ...p, year: val }))}
                                            placeholder="წელი"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4 pt-6">
                                    <div className="flex justify-center w-full">
                                        <button type="submit" className="px-8 sm:px-12 h-10 sm:h-12 bg-indigo-600 text-white rounded-2xl font-black text-[10px] sm:text-[11px] tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all">
                                            {l('დასრულება', 'Завершить', 'Finish')} <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button type="button" onClick={goBack} className="flex-1 h-9 sm:h-11 text-slate-400 font-black text-[9px] sm:text-[10px] tracking-widest hover:text-slate-600 transition-colors uppercase border border-slate-100 rounded-2xl">
                                            {t.back}
                                        </button>
                                        <button type="button" onClick={async () => {
                                            const syncRes = await performFinalSync();
                                            if (syncRes) setStep('success');
                                        }} className="flex-1 h-9 sm:h-11 text-slate-400 font-black text-[9px] sm:text-[10px] tracking-widest hover:text-slate-600 transition-colors uppercase border border-slate-100 rounded-2xl">
                                            {t.skip}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="text-center space-y-6 py-4 animate-fade-up">
                            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-slate-900">{l('რეგისტრაცია დასრულებულია!', 'Регистрация завершена!', 'Registration Complete!')}</h3>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed px-4">
                                    {l('თქვენი სტუდია წარმატებით შეიქმნა. ახლა შეგიძლიათ განაგრძოთ მუშაობა დეშბორდიდან.', 'Ваша студия создана. Теперь вы можете продолжить работу.', 'Your studio is ready. You can now proceed to the dashboard.')}
                                </p>
                            </div>
                            <div className="flex justify-center pt-2">
                                <button
                                    onClick={() => {
                                        sessionStorage.removeItem('cc_registration_wizard_state');
                                        window.location.href = '/dashboard';
                                    }}
                                    className="px-8 h-10 sm:h-12 bg-slate-900 text-white rounded-2xl font-black text-[10px] sm:text-[11px] tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                                >
                                    {l('დეშბორდზე გადასვლა', 'В панель управления', 'Go to Dashboard')}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 pt-8 border-t border-slate-100">
                        <div className="flex items-center justify-center gap-2 text-[10px] font-black text-emerald-600 tracking-widest">
                            <ShieldCheck className="w-4 h-4" /> {t.secureAccount}
                        </div>
                    </div>
                </div>

                <p className="text-center text-sm font-semibold text-slate-500 pb-10">
                    {t.haveAccount} <Link href="/login" className="text-indigo-600 font-black hover:underline underline-offset-4 decoration-2">{t.login}</Link>
                </p>
            </div>
        </div>
    );
}
