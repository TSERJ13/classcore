'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Lock, User, ArrowRight, ShieldCheck, Sparkles, Building2, UserSquare2, Users2, UserPlus2, CheckCircle2, ChevronRight } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

type Step = 'account' | 'halls' | 'teachers' | 'groups' | 'students' | 'success';

export default function RegisterPage() {
    const { t, lang } = useT();
    const [step, setStep] = useState<Step>('account');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Registration Info
    const [regData, setRegData] = useState({
        email: '', password: '', firstName: '', lastName: '', 
        studioName: '', studioSlug: '', phone: '', orgId: ''
    });

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

            const studioSlug = studioName.toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');

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

            if (signUpError) throw signUpError;

            const userData = {
                email, password, firstName, lastName, 
                studioName, studioSlug, phone, orgId,
                userId: data.user?.id
            };
            setRegData(userData as any);

            // Initialize Basic Settings
            if (typeof window !== 'undefined') {
                localStorage.setItem('cc_active_studio_slug', studioSlug);
                localStorage.setItem('cc_studio_name', studioName);
                document.cookie = `cc_active_slug=${studioSlug}; path=/; max-age=31536000; SameSite=Lax`;
                document.cookie = `cc_studio_name=${encodeURIComponent(studioName)}; path=/; max-age=31536000; SameSite=Lax`;

                const key = `cc_studio_settings_${studioSlug}`;
                const basicSettings = {
                    studioName,
                    studioSlug,
                    language: 'ka',
                    currency: 'GEL',
                    branches: [{ id: 'main', name: 'მთავარი ფილიალი', is_active: true }],
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
            }

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
        const key = `cc_${type}_${slug}`;
        let existing = [];
        try {
            const raw = localStorage.getItem(key);
            existing = raw ? JSON.parse(raw) : [];
        } catch {}
        
        // Handle Map-based stores (like student_data)
        if (type === 'student_data') {
            const studentMap = existing || {};
            const id = `S-${Math.floor(1000 + Math.random() * 9000)}`;
            localStorage.setItem(key, JSON.stringify({ ...studentMap, [id]: data }));
            return;
        }

        localStorage.setItem(key, JSON.stringify([...existing, data]));
    };

    const renderStepHeader = () => {
        const steps = [
            { id: 'account', icon: User, label: t.createAccount },
            { id: 'halls', icon: Building2, label: l('დარბაზი', 'Зал', 'Hall') },
            { id: 'teachers', icon: UserSquare2, label: l('მასწავლებელი', 'Учитель', 'Teacher') },
            { id: 'groups', icon: Users2, label: l('ჯგუფი', 'Группа', 'Group') },
            { id: 'students', icon: UserPlus2, label: l('მოსწავლე', 'Ученик', 'Student') }
        ];

        return (
            <div className="flex items-center justify-between w-full max-w-sm mx-auto mb-8">
                {steps.map((s, i) => {
                    const isActive = step === s.id;
                    const isCompleted = ['halls', 'teachers', 'groups', 'students', 'success'].includes(step) && steps.findIndex(x => x.id === step) > i;
                    return (
                        <div key={s.id} className="flex items-center">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                                isActive ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-110" : 
                                isCompleted ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                            )}>
                                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-4 h-4" />}
                            </div>
                            {i < steps.length - 1 && (
                                <div className={cn("w-4 h-px mx-1", isCompleted ? "bg-emerald-500" : "bg-slate-100")} />
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-[50%] h-full bg-indigo-50/50 blur-[120px] -z-10" />
            <div className="absolute bottom-0 right-0 w-[30%] h-1/2 bg-violet-50/50 blur-[100px] -z-10" />

            <div className="w-full max-w-[480px] space-y-8 animate-fade-up">
                <div className="flex flex-col items-center text-center space-y-4">
                    <Link href="/" className="group flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-600/30 logo-animate-hover logo-large overflow-hidden">
                            <img src="/logo.svg" alt="Logo" className="w-full h-full object-cover" />
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">ClassCore</h1>
                    </Link>
                </div>

                {step !== 'success' && renderStepHeader()}

                <div className="bg-white/50 backdrop-blur-xl border border-slate-100 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-500/5">
                    {step === 'account' && (
                        <form onSubmit={handleInitialRegister} className="space-y-5">
                            <div className="space-y-1 text-center mb-6">
                                <h2 className="text-xl font-black text-slate-800">{t.createStudio}</h2>
                                <p className="text-sm text-slate-500 font-medium">{t.startTrial}</p>
                            </div>
                            {error && <div className="p-4 bg-red-50/50 border border-red-100 rounded-2xl text-[11px] font-bold text-red-500 italic text-center animate-fade-up">{error}</div>}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.firstName}</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                        <input name="firstName" required placeholder="Nino" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.lastName}</label>
                                    <input name="lastName" required placeholder="Beridze" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.studioName}</label>
                                <div className="relative group">
                                    <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                    <input name="studioName" required placeholder="e.g. My Dance Academy" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.phoneLabel || 'ტელეფონი'}</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold group-focus-within:text-indigo-600 transition-colors">+995</div>
                                    <input name="phone" required type="tel" placeholder="5xx xx xx xx" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-16 pr-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.email}</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                    <input name="email" type="email" required placeholder="contact@studio.ge" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">{t.password}</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                    <input name="password" type="password" required placeholder="••••••••" className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-900 outline-none transition-all" />
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50">
                                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{t.createAccount} <ArrowRight className="w-5 h-5" /></>}
                            </button>
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
                                saveStepData('halls', { id: crypto.randomUUID(), name: f.get('name'), capacity: f.get('capacity'), is_active: true });
                                setStep('teachers');
                            }} className="space-y-4">
                                <input name="name" required placeholder={l('დარბაზის სახელი (მაგ. დიდი დარბაზი)', 'Название зала', 'Hall Name')} className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 rounded-2xl px-5 py-4 text-sm font-bold outline-none shadow-sm" />
                                <input name="capacity" type="number" placeholder={l('ტევადობა (მაგ. 20)', 'Вместимость', 'Capacity')} className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 rounded-2xl px-5 py-4 text-sm font-bold outline-none shadow-sm" />
                                <div className="flex flex-col gap-3 pt-4">
                                    <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-indigo-700 transition-all">
                                        {l('შემდეგი', 'Далее', 'Next')} <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => setStep('teachers')} className="w-full py-4 text-slate-400 font-black text-[10px] tracking-widest hover:text-slate-600 transition-colors uppercase">
                                        {l('გამოტოვება', 'Пропустить', 'Skip Step')}
                                    </button>
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
                                saveStepData('teachers', { id: crypto.randomUUID(), first_name: f.get('f'), last_name: f.get('l'), phone: f.get('p'), specialty: [f.get('s')], role: 'teacher', status: 'active' });
                                setStep('groups');
                            }} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <input name="f" required placeholder={l('სახელი', 'Имя', 'First Name')} className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold" />
                                    <input name="l" required placeholder={l('გვარი', 'Фамилия', 'Last Name')} className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold" />
                                </div>
                                <input name="p" placeholder={l('ტელეფონი', 'Телефон', 'Phone')} className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold" />
                                <input name="s" placeholder={l('სპეციალობა (მაგ. ჰიპ-ჰოპი)', 'Специальность', 'Specialty')} className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold" />
                                <div className="flex flex-col gap-3 pt-4">
                                    <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm tracking-widest flex items-center justify-center gap-2 shadow-xl">
                                        {l('შემდეგი', 'Далее', 'Next')} <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => setStep('groups')} className="w-full py-4 text-slate-400 font-black text-[10px] tracking-widest uppercase">
                                        {l('გამოტოვება', 'Пропустить', 'Skip Step')}
                                    </button>
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
                                saveStepData('groups', { id: crypto.randomUUID(), name: f.get('name'), schedule: f.get('schedule'), studio_slug: regData.studioSlug });
                                setStep('students');
                            }} className="space-y-4">
                                <input name="name" required placeholder={l('ჯგუფის სახელი', 'Название группы', 'Group Name')} className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold" />
                                <input name="schedule" placeholder={l('განრიგი (მაგ. ორშ-ოთხ-პარ 18:00)', 'Расписание', 'Schedule')} className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold" />
                                <div className="flex flex-col gap-3 pt-4">
                                    <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm tracking-widest flex items-center justify-center gap-2 shadow-xl">
                                        {l('შემდეგი', 'Далее', 'Next')} <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => setStep('students')} className="w-full py-4 text-slate-400 font-black text-[10px] tracking-widest uppercase">
                                        {l('გამოტოვება', 'Пропустить', 'Skip Step')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {step === 'students' && (
                        <div className="space-y-6 animate-fade-up">
                            <div className="text-center space-y-2">
                                <h3 className="text-xl font-black text-slate-800">{l('დაამატეთ მოსწავლე', 'Добавьте ученика', 'Add a Student')}</h3>
                                <p className="text-sm text-slate-500 font-medium">{l('თქვენი პირველი მოსწავლის რეგისტრაცია', 'Регистрация первого ученика', 'Register your first student')}</p>
                            </div>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const f = new FormData(e.target as HTMLFormElement);
                                saveStepData('student_data', { first_name: f.get('f'), last_name: f.get('l'), phone: f.get('p'), status: 'active', registered_at: new Date().toISOString() });
                                setStep('success');
                            }} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <input name="f" required placeholder={l('სახელი', 'Имя', 'First Name')} className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold" />
                                    <input name="l" required placeholder={l('გვარი', 'Фамилия', 'Last Name')} className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold" />
                                </div>
                                <input name="p" placeholder={l('ტელეფონი', 'Телефон', 'Phone')} className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold" />
                                <div className="flex flex-col gap-3 pt-4">
                                    <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm tracking-widest flex items-center justify-center gap-2 shadow-xl">
                                        {l('დარულება', 'Завершить', 'Finish')} <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => setStep('success')} className="w-full py-4 text-slate-400 font-black text-[10px] tracking-widest uppercase">
                                        {l('გამოტოვება', 'Пропустить', 'Skip Step')}
                                    </button>
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
                            <button
                                onClick={() => window.location.href = '/dashboard'}
                                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                            >
                                {l('დეშბორდზე გადასვლა', 'В панель управления', 'Go to Dashboard')}
                            </button>
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
