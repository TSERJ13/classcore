'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
    Sparkles, Mail, Lock, User, Building2, ArrowRight, ArrowLeft, ChevronRight,
    Shield, Globe, CheckCircle2, Eye, EyeOff, AlertCircle, Phone,
    Palette, Dumbbell, GraduationCap, MoreHorizontal, Plus, Minus,
    Users, Layers, UserSquare2, Home, GitBranch, Send, Loader2,
    type LucideIcon,
} from 'lucide-react';
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { AppLogo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { validatePasswordPolicy, passwordPolicyMessage } from "@/lib/password-policy";

const COUNTRIES = [
    { code: 'GE', dial: '+995', flag: '🇬🇪' },
    { code: 'RU', dial: '+7', flag: '🇷🇺' },
    { code: 'US', dial: '+1', flag: '🇺🇸' },
];

type BusinessCategory = 'arts' | 'sports' | 'education' | 'other';
type LessonType = 'group' | 'individual' | 'both';
type PaymentStyle = 'monthly' | 'personal' | 'both';

const inputCls = "w-full h-11 bg-slate-50/50 border border-slate-100 rounded-2xl px-5 text-sm font-black text-slate-900 focus:ring-0 focus:border-indigo-500/30 transition-all outline-none placeholder:text-slate-300 shadow-xs";
const labelCls = "text-[10px] font-black text-slate-500/80 uppercase tracking-widest ml-1 flex items-center gap-3 opacity-90";
const iconBoxCls = "w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm";

function Counter({ label, icon: Icon, value, onChange }: { label: string; icon: LucideIcon; value: number; onChange: (v: number) => void }) {
    return (
        <div className="flex items-center justify-between bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-2.5">
            <div className="flex items-center gap-3">
                <div className={iconBoxCls}><Icon className="w-3.5 h-3.5" /></div>
                <span className="text-xs font-bold text-slate-600">{label}</span>
            </div>
            <div className="flex items-center gap-3">
                <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-90 transition-all">
                    <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center text-sm font-black text-slate-900 tabular-nums">{value}</span>
                <button type="button" onClick={() => onChange(value + 1)} className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white hover:bg-indigo-700 active:scale-90 transition-all">
                    <Plus className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

export default function RegistrationPage() {
    const { l, lang } = useLanguage();
    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 'success'>(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [agreed, setAgreed] = useState(false);

    const sessionTokenRef = useRef<string>('');
    if (!sessionTokenRef.current) {
        sessionTokenRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    }

    // Step 1-2
    const [category, setCategory] = useState<BusinessCategory | null>(null);
    const [specificType, setSpecificType] = useState('');

    // Step 3
    const [studioName, setStudioName] = useState('');
    const [metrics, setMetrics] = useState({ students: 10, groups: 1, teachers: 1, halls: 1, branches: 1 });

    // Step 4
    const [lessonType, setLessonType] = useState<LessonType | null>(null);
    const [paymentStyle, setPaymentStyle] = useState<PaymentStyle | null>(null);

    // Step 5 — account
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [emailCode, setEmailCode] = useState('');
    const [emailSent, setEmailSent] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [emailBusy, setEmailBusy] = useState<'send' | 'verify' | null>(null);
    const [emailError, setEmailError] = useState<string | null>(null);

    const [dialCode, setDialCode] = useState('+995');
    const [phone, setPhone] = useState('');
    const [phoneCode, setPhoneCode] = useState('');
    const [phoneSent, setPhoneSent] = useState(false);
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [phoneBusy, setPhoneBusy] = useState<'send' | 'verify' | null>(null);
    const [phoneError, setPhoneError] = useState<string | null>(null);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        sessionStorage.removeItem('cc_lang_session');
    }, []);

    // docs/authorization-module.md §5: min 8 chars, 1 uppercase, 1 digit, 1
    // special char — this used to only require 2 of length/uppercase/digit
    // (no special-char check at all), so a password server-side registration
    // would now reject could still pass this client-side gate.
    const passwordPolicy = validatePasswordPolicy(password);

    const fullPhone = dialCode + phone.replace(/\s/g, '');

    async function sendOtp(channel: 'email' | 'sms') {
        const contact = channel === 'email' ? email : fullPhone;
        const setBusy = channel === 'email' ? setEmailBusy : setPhoneBusy;
        const setSent = channel === 'email' ? setEmailSent : setPhoneSent;
        const setErr = channel === 'email' ? setEmailError : setPhoneError;
        setErr(null);
        setBusy('send');
        try {
            const res = await fetch('/api/auth/otp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken: sessionTokenRef.current, channel, contact, lang }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                setErr(data.error === 'cooldown'
                    ? l('გთხოვთ მოიცადოთ და სცადოთ ხელახლა', 'Пожалуйста, подождите и попробуйте снова', 'Please wait before retrying')
                    : l('კოდის გაგზავნა ვერ მოხერხდა', 'Не удалось отправить код', 'Failed to send code'));
                return;
            }
            setSent(true);
        } catch {
            setErr(l('ქსელის შეცდომა', 'Ошибка сети', 'Network error'));
        } finally {
            setBusy(null);
        }
    }

    async function verifyOtpCode(channel: 'email' | 'sms') {
        const code = channel === 'email' ? emailCode : phoneCode;
        const setBusy = channel === 'email' ? setEmailBusy : setPhoneBusy;
        const setVerified = channel === 'email' ? setEmailVerified : setPhoneVerified;
        const setErr = channel === 'email' ? setEmailError : setPhoneError;
        setErr(null);
        setBusy('verify');
        try {
            const res = await fetch('/api/auth/otp/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken: sessionTokenRef.current, channel, code }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                setErr(
                    data.error === 'expired' ? l('კოდი ვადაგასულია, გამოაგზავნეთ ახალი', 'Код просрочен, отправьте новый', 'Code expired, resend it')
                    : data.error === 'too_many_attempts' ? l('ცდების ლიმიტი ამოწურულია', 'Превышен лимит попыток', 'Too many attempts')
                    : l('კოდი არასწორია', 'Неверный код', 'Invalid code')
                );
                return;
            }
            setVerified(true);
        } catch {
            setErr(l('ქსელის შეცდომა', 'Ошибка сети', 'Network error'));
        } finally {
            setBusy(null);
        }
    }

    const canNext1 = !!category;
    const canNext2 = specificType.trim().length > 1;
    const canNext3 = studioName.trim().length >= 2;
    const canNext4 = !!lessonType && !!paymentStyle;
    const canSubmit = emailVerified && phoneVerified && agreed && passwordPolicy.valid && password === confirmPassword && firstName.trim() && lastName.trim();

    async function handleFinalSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/auth/register-studio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionToken: sessionTokenRef.current,
                    studioName, email, phone: fullPhone, password, firstName, lastName, lang,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(
                    data.error === 'email_taken'
                        ? l('ეს ელფოსტა უკვე გამოყენებულია', 'Эта почта уже используется', 'This email is already registered')
                        : data.error === 'not_verified'
                            ? l('გთხოვთ დაადასტუროთ ელფოსტა და ტელეფონი', 'Подтвердите почту и телефон', 'Please verify email and phone first')
                            : data.error === 'weak_password'
                                ? passwordPolicyMessage(data.reason, l)
                                : (data.error || 'Registration failed')
                );
            }

            const supabase = createClient();
            const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
            if (signInErr) throw signInErr;

            const studioSlug = data.studioSlug;
            if (typeof window !== 'undefined') {
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('cc_') && !key.includes('lang')) localStorage.removeItem(key);
                });

                const enabledFeatures = {
                    individualLessons: lessonType === 'individual' || lessonType === 'both',
                    personalPlans: paymentStyle === 'personal' || paymentStyle === 'both',
                };

                const initialSettings = {
                    studioSlug,
                    studioName,
                    language: lang,
                    plan: 'trial',
                    trialDays: 14,
                    trialStartDate: new Date().toISOString(),
                    businessCategory: category,
                    specificType: specificType.trim(),
                    onboardingMetrics: metrics,
                    enabledFeatures,
                    owner_info: { first_name: firstName, last_name: lastName, email, phone: fullPhone },
                    staff: [{
                        id: Math.random().toString(36).substring(2, 9),
                        first_name: firstName, last_name: lastName,
                        full_name: `${firstName} ${lastName}`.trim(),
                        email, phone: fullPhone, role: 'owner', status: 'active',
                        created_at: new Date().toISOString(),
                    }],
                };
                localStorage.setItem(`cc_studio_settings_${studioSlug}`, JSON.stringify(initialSettings));
                localStorage.setItem(`cc_is_fresh_${studioSlug}`, 'true');
                localStorage.setItem('cc_onboarding_in_progress', 'true');
            }

            setStep('success');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
        } finally {
            setLoading(false);
        }
    }

    const STEP_TITLES = [
        l('ბიზნესის კატეგორია', 'Категория бизнеса', 'Business category'),
        l('კონკრეტული სახეობა', 'Конкретный вид', 'Specific type'),
        l('სტუდიის მონაცემები', 'Данные студии', 'Studio data'),
        l('სერვისის კონფიგურაცია', 'Конфигурация сервиса', 'Service configuration'),
        l('ანგარიშის შექმნა', 'Создание аккаунта', 'Create account'),
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden relative animate-fade-up">
            <div className="fixed top-0 right-0 w-[50%] h-full bg-indigo-500/5 blur-[120px] -z-10" />
            <div className="fixed bottom-0 left-0 w-[30%] h-1/2 bg-violet-500/5 blur-[100px] -z-10" />

            <div className="w-full max-w-2xl relative z-10 flex flex-col gap-8 pt-0 pb-8 duration-700">
                <div className="flex flex-col items-center gap-6">
                    <Link href="/" className="group transition-all duration-500 hover:scale-110 active:scale-95">
                        <AppLogo size={90} transparent />
                    </Link>
                </div>

                <div className="bg-white p-8 sm:p-10 rounded-[3rem] border border-slate-100 shadow-2xl shadow-indigo-500/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>

                    {step !== 'success' && (
                        <div className="mb-8 relative">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">{l('ნაბიჯი', 'Шаг', 'Step')} {step}/5</p>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{STEP_TITLES[step - 1]}</p>
                            </div>
                            <div className="flex gap-1.5">
                                {[1, 2, 3, 4, 5].map(s => (
                                    <div key={s} className={cn("h-1.5 flex-1 rounded-full transition-all duration-500", s <= step ? "bg-indigo-500" : "bg-slate-100")} />
                                ))}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-100/50 p-4 rounded-2xl flex items-start gap-3 mb-6">
                            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-red-600 font-bold leading-tight">{error}</p>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="text-center space-y-2">
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter uppercase">{l('რას მართავთ?', 'Чем вы управляете?', "What do you run?")}</h2>
                                <p className="text-xs text-slate-400 font-bold">{l('აირჩიეთ ერთი კატეგორია', 'Выберите одну категорию', 'Pick one category')}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {([
                                    ['arts', l('ხელოვნება', 'Искусство', 'Arts'), Palette],
                                    ['sports', l('სპორტი', 'Спорт', 'Sport'), Dumbbell],
                                    ['education', l('განათლება', 'Образование', 'Education'), GraduationCap],
                                    ['other', l('სხვა', 'Другое', 'Other'), MoreHorizontal],
                                ] as const).map(([val, label, Icon]) => (
                                    <button key={val} type="button" onClick={() => setCategory(val)}
                                        className={cn(
                                            "flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all",
                                            category === val ? "border-indigo-500 bg-indigo-50/50 shadow-lg shadow-indigo-500/10" : "border-slate-100 bg-slate-50/30 hover:border-slate-200"
                                        )}>
                                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", category === val ? "bg-indigo-600 text-white" : "bg-white text-slate-400 border border-slate-100")}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <span className={cn("text-xs font-black uppercase tracking-wide", category === val ? "text-indigo-600" : "text-slate-500")}>{label}</span>
                                    </button>
                                ))}
                            </div>
                            <button type="button" disabled={!canNext1} onClick={() => setStep(2)}
                                className={cn("w-full h-12 rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3",
                                    canNext1 ? "bg-slate-900 text-white shadow-xl active:scale-[0.98] hover:bg-slate-800" : "bg-slate-100 text-slate-400 cursor-not-allowed")}>
                                {l('შემდეგი', 'Далее', 'Next')} <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="text-center space-y-2">
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter uppercase">{l('რას ასწავლით ან აწყობთ?', 'Что вы преподаёте?', 'What do you teach?')}</h2>
                                <p className="text-xs text-slate-400 font-bold">{l('მაგ: ცეკვა, ხატვა, ჭიდაობა', 'Напр: танцы, рисование', 'e.g. Dance, Painting, Wrestling')}</p>
                            </div>
                            <input value={specificType} onChange={e => setSpecificType(e.target.value)} autoFocus
                                className={cn(inputCls, "h-14 text-center text-base")}
                                placeholder={l('ცეკვა...', 'Танцы...', 'Dance...')} />
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setStep(1)} className="h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-xs bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center gap-2">
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                                <button type="button" disabled={!canNext2} onClick={() => setStep(3)}
                                    className={cn("flex-1 h-12 rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3",
                                        canNext2 ? "bg-slate-900 text-white shadow-xl active:scale-[0.98] hover:bg-slate-800" : "bg-slate-100 text-slate-400 cursor-not-allowed")}>
                                    {l('შემდეგი', 'Далее', 'Next')} <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="text-center space-y-2 mb-2">
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter uppercase">{l('სტუდიის მონაცემები', 'Данные студии', 'Studio data')}</h2>
                                <p className="text-xs text-slate-400 font-bold">{l('სავარაუდო რაოდენობები — ზუსტად მოგვიანებით მოვარგებთ', 'Примерные цифры — уточним позже', "Rough estimates — you'll refine these later")}</p>
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelCls}><div className={iconBoxCls}><Building2 className="w-3.5 h-3.5" /></div>{l('სტუდიის სახელი', 'Название студии', 'Studio name')}</label>
                                <input value={studioName} onChange={e => setStudioName(e.target.value)} className={inputCls} placeholder={l('სტუდიის სახელი...', 'Название студии...', 'Cosmos Dance Studio')} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <Counter label={l('მოსწავლეები', 'Ученики', 'Students')} icon={Users} value={metrics.students} onChange={v => setMetrics(m => ({ ...m, students: v }))} />
                                <Counter label={l('ჯგუფები', 'Группы', 'Groups')} icon={Layers} value={metrics.groups} onChange={v => setMetrics(m => ({ ...m, groups: v }))} />
                                <Counter label={l('მასწავლებლები', 'Преподаватели', 'Teachers')} icon={UserSquare2} value={metrics.teachers} onChange={v => setMetrics(m => ({ ...m, teachers: v }))} />
                                <Counter label={l('დარბაზები', 'Залы', 'Halls')} icon={Home} value={metrics.halls} onChange={v => setMetrics(m => ({ ...m, halls: v }))} />
                                <Counter label={l('ფილიალები', 'Филиалы', 'Branches')} icon={GitBranch} value={metrics.branches} onChange={v => setMetrics(m => ({ ...m, branches: v }))} />
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setStep(2)} className="h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-xs bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center gap-2">
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                                <button type="button" disabled={!canNext3} onClick={() => setStep(4)}
                                    className={cn("flex-1 h-12 rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3",
                                        canNext3 ? "bg-slate-900 text-white shadow-xl active:scale-[0.98] hover:bg-slate-800" : "bg-slate-100 text-slate-400 cursor-not-allowed")}>
                                    {l('შემდეგი', 'Далее', 'Next')} <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="text-center space-y-2">
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter uppercase">{l('სერვისის კონფიგურაცია', 'Конфигурация сервиса', 'Service configuration')}</h2>
                            </div>
                            <div className="space-y-3">
                                <p className={labelCls}>{l('გაკვეთილის ტიპი', 'Тип занятий', 'Lesson type')}</p>
                                <div className="grid grid-cols-3 gap-2.5">
                                    {([['group', l('ჯგუფური', 'Групповые', 'Group')], ['individual', l('ინდივიდუალური', 'Индивидуальные', 'Individual')], ['both', l('ორივე', 'Оба', 'Both')]] as const).map(([val, label]) => (
                                        <button key={val} type="button" onClick={() => setLessonType(val)}
                                            className={cn("h-14 rounded-2xl border-2 text-xs font-black uppercase tracking-wide transition-all",
                                                lessonType === val ? "border-indigo-500 bg-indigo-50/50 text-indigo-600" : "border-slate-100 bg-slate-50/30 text-slate-500 hover:border-slate-200")}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <p className={labelCls}>{l('გადახდის სტილი', 'Стиль оплаты', 'Payment style')}</p>
                                <div className="grid grid-cols-3 gap-2.5">
                                    {([['monthly', l('ყოველთვიური', 'Ежемесячный', 'Monthly')], ['personal', l('პერსონალური', 'Персональный', 'Personal')], ['both', l('ორივე', 'Оба', 'Both')]] as const).map(([val, label]) => (
                                        <button key={val} type="button" onClick={() => setPaymentStyle(val)}
                                            className={cn("h-14 rounded-2xl border-2 text-xs font-black uppercase tracking-wide transition-all",
                                                paymentStyle === val ? "border-indigo-500 bg-indigo-50/50 text-indigo-600" : "border-slate-100 bg-slate-50/30 text-slate-500 hover:border-slate-200")}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {(lessonType === 'individual' || lessonType === 'both' || paymentStyle === 'personal' || paymentStyle === 'both') && (
                                <p className="text-[10px] text-indigo-500/80 font-bold text-center px-4">
                                    {l('შესაბამისი ფუნქციები ავტომატურად ჩაირთვება პარამეტრებში', 'Соответствующие функции включатся автоматически в настройках', 'The matching features will be turned on automatically in your settings')}
                                </p>
                            )}
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setStep(3)} className="h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-xs bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center gap-2">
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                                <button type="button" disabled={!canNext4} onClick={() => setStep(5)}
                                    className={cn("flex-1 h-12 rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3",
                                        canNext4 ? "bg-slate-900 text-white shadow-xl active:scale-[0.98] hover:bg-slate-800" : "bg-slate-100 text-slate-400 cursor-not-allowed")}>
                                    {l('შემდეგი', 'Далее', 'Next')} <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        <form onSubmit={handleFinalSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="text-center space-y-2 mb-2">
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter uppercase">{l('ანგარიშის შექმნა', 'Создание аккаунта', 'Create your account')}</h2>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className={labelCls}><div className={iconBoxCls}><User className="w-3.5 h-3.5" /></div>{l('სახელი', 'Имя', 'First Name')}</label>
                                    <input value={firstName} onChange={e => setFirstName(e.target.value)} required className={inputCls} placeholder={l('სახელი...', 'Имя...', 'Jane')} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className={labelCls}><div className={iconBoxCls}><User className="w-3.5 h-3.5" /></div>{l('გვარი', 'Фамилия', 'Last Name')}</label>
                                    <input value={lastName} onChange={e => setLastName(e.target.value)} required className={inputCls} placeholder={l('გვარი...', 'Фамилия...', 'Doe')} />
                                </div>
                            </div>

                            {/* Email + OTP */}
                            <div className="space-y-1.5">
                                <label className={labelCls}><div className={iconBoxCls}><Mail className="w-3.5 h-3.5" /></div>{l('ფოსტა', 'Почта', 'Email')}</label>
                                <div className="flex gap-2">
                                    <input value={email} onChange={e => { setEmail(e.target.value); setEmailVerified(false); setEmailSent(false); }} required type="email" disabled={emailVerified}
                                        className={cn(inputCls, "flex-1", emailVerified && "opacity-60")} placeholder="jane@studio.ge" />
                                    {!emailVerified && (
                                        <button type="button" disabled={!email || emailBusy === 'send'} onClick={() => sendOtp('email')}
                                            className="h-11 px-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5 disabled:opacity-40 shrink-0">
                                            {emailBusy === 'send' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                            {emailSent ? l('ხელახლა', 'Ещё раз', 'Resend') : l('კოდი', 'Код', 'Code')}
                                        </button>
                                    )}
                                    {emailVerified && <div className="h-11 px-3 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center"><CheckCircle2 className="w-4 h-4" /></div>}
                                </div>
                                {emailSent && !emailVerified && (
                                    <div className="flex gap-2 pt-1">
                                        <input value={emailCode} onChange={e => setEmailCode(e.target.value)} maxLength={6}
                                            className={cn(inputCls, "flex-1 text-center tracking-widest font-mono font-black text-base")} placeholder="1234" />
                                        <button type="button" disabled={emailCode.length < 4 || emailBusy === 'verify'} onClick={() => verifyOtpCode('email')}
                                            className="h-11 px-4 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wide disabled:opacity-40 shrink-0">
                                            {emailBusy === 'verify' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : l('დადასტურება', 'Подтвердить', 'Verify')}
                                        </button>
                                    </div>
                                )}
                                {emailError && <p className="text-[10px] text-red-500 font-bold ml-1">{emailError}</p>}
                            </div>

                            {/* Phone + OTP */}
                            <div className="space-y-1.5">
                                <label className={labelCls}><div className={iconBoxCls}><Phone className="w-3.5 h-3.5" /></div>{l('ტელეფონი', 'Телефон', 'Phone')}</label>
                                <div className="flex gap-2">
                                    <div className="relative shrink-0 w-[64px]">
                                        <select value={dialCode} onChange={e => setDialCode(e.target.value)} disabled={phoneVerified}
                                            className="appearance-none w-full h-11 bg-slate-50/50 border border-slate-100 rounded-2xl px-0 text-center text-lg focus:ring-0 focus:border-indigo-500/30 transition-all outline-none shadow-xs cursor-pointer">
                                            {COUNTRIES.map(c => <option key={c.code} value={c.dial}>{c.flag}</option>)}
                                        </select>
                                    </div>
                                    <input value={phone} onChange={e => { setPhone(e.target.value); setPhoneVerified(false); setPhoneSent(false); }} required type="tel" disabled={phoneVerified}
                                        className={cn(inputCls, "flex-1 min-w-0", phoneVerified && "opacity-60")} placeholder="555..." />
                                    {!phoneVerified && (
                                        <button type="button" disabled={!phone || phoneBusy === 'send'} onClick={() => sendOtp('sms')}
                                            className="h-11 px-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5 disabled:opacity-40 shrink-0">
                                            {phoneBusy === 'send' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                            {phoneSent ? l('ხელახლა', 'Ещё раз', 'Resend') : l('კოდი', 'Код', 'Code')}
                                        </button>
                                    )}
                                    {phoneVerified && <div className="h-11 px-3 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center"><CheckCircle2 className="w-4 h-4" /></div>}
                                </div>
                                {phoneSent && !phoneVerified && (
                                    <div className="flex gap-2 pt-1">
                                        <input value={phoneCode} onChange={e => setPhoneCode(e.target.value)} maxLength={6}
                                            className={cn(inputCls, "flex-1 text-center tracking-widest font-mono font-black text-base")} placeholder="1234" />
                                        <button type="button" disabled={phoneCode.length < 4 || phoneBusy === 'verify'} onClick={() => verifyOtpCode('sms')}
                                            className="h-11 px-4 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wide disabled:opacity-40 shrink-0">
                                            {phoneBusy === 'verify' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : l('დადასტურება', 'Подтвердить', 'Verify')}
                                        </button>
                                    </div>
                                )}
                                {phoneError && <p className="text-[10px] text-red-500 font-bold ml-1">{phoneError}</p>}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className={labelCls}><div className={iconBoxCls}><Lock className="w-3.5 h-3.5" /></div>{l('პაროლი', 'Пароль', 'Password')}</label>
                                    <div className="relative">
                                        <input value={password} onChange={e => setPassword(e.target.value)} required type={showPassword ? "text" : "password"} className={inputCls} placeholder="••••••••" />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className={labelCls}><div className={iconBoxCls}><Lock className="w-3.5 h-3.5" /></div>{l('გაიმეორეთ', 'Повторите', 'Confirm')}</label>
                                    <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required type={showPassword ? "text" : "password"} className={inputCls} placeholder="••••••••" />
                                </div>
                            </div>
                            {password && !passwordPolicy.valid && (
                                <p className="text-[10px] text-red-500 font-bold text-center">{passwordPolicyMessage(passwordPolicy.reason, l)}</p>
                            )}
                            {password && confirmPassword && password !== confirmPassword && (
                                <p className="text-[10px] text-red-500 font-bold text-center">{l('პაროლები არ ემთხვევა', 'Пароли не совпадают', "Passwords don't match")}</p>
                            )}

                            <label className="flex items-center justify-center gap-4 cursor-pointer group pt-2">
                                <div className="relative">
                                    <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="sr-only" />
                                    <div className={cn("w-6 h-6 rounded-xl border-2 transition-all duration-300 flex items-center justify-center",
                                        agreed ? "bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-500/30" : "border-slate-200 bg-slate-50/50 group-hover:border-slate-300")}>
                                        {agreed && <CheckCircle2 className="w-4 h-4 text-white" />}
                                    </div>
                                </div>
                                <p className="text-[11px] font-bold text-slate-500 leading-tight">
                                    {l('ვეთანხმები', 'Я согласен с', 'I agree to the')}{' '}
                                    <Link href="/terms" target="_blank" className="text-indigo-600 hover:text-indigo-700 underline decoration-indigo-200 underline-offset-4">{l('წესებსა', 'правилами', 'Terms')}</Link>
                                    {' '}{l('და', 'и', 'and')}{' '}
                                    <Link href="/privacy" target="_blank" className="text-indigo-600 hover:text-indigo-700 underline decoration-indigo-200 underline-offset-4">{l('კონფიდენციალურობას', 'политикой конфиденциальности', 'Privacy Policy')}</Link>
                                </p>
                            </label>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setStep(4)} className="h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-xs bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center gap-2">
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                                <button type="submit" disabled={loading || !canSubmit}
                                    className={cn("flex-1 h-12 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all duration-300 flex items-center justify-center gap-3",
                                        loading || !canSubmit ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-900 text-white shadow-2xl shadow-indigo-500/20 active:scale-[0.98] hover:bg-slate-800")}>
                                    {loading ? l('გთხოვთ მოიცადოთ...', 'Загрузка...', 'Connecting...') : (
                                        <>{l('შენახვა', 'Сохранить', 'Save')} <ArrowRight className="w-4 h-4" /></>
                                    )}
                                </button>
                            </div>
                            <p className="text-center text-sm font-black text-slate-400 tracking-tight">
                                {l('უკვე გაქვთ ანგარიში?', 'Уже есть аккаунт?', 'Already have an account?')} <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-black hover:underline underline-offset-4">{l('შესვლა', 'Войти', 'Login')}</Link>
                            </p>
                        </form>
                    )}

                    {step === 'success' && (
                        <div className="text-center py-6 animate-fade-up">
                            <div className="flex flex-col items-center gap-6 mb-8">
                                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
                                    <Sparkles className="w-10 h-10 text-white" />
                                </div>
                            </div>
                            <div className="space-y-5">
                                <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-none uppercase">{l('კეთილი იყოს დაბრუნება!', 'Добро пожаловать!', 'Welcome!')}</h2>
                                <div className="bg-indigo-50/60 p-6 rounded-[2rem] border border-indigo-100/50 space-y-2 shadow-sm">
                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">{l('საჩუქარია თქვენთვის', 'Подарок для вас', 'A gift for you')}</p>
                                    <p className="text-sm font-bold text-slate-600 leading-relaxed">
                                        {l('თქვენ მიღებული გაქვთ „პრო" პაკეტის სრული წვდომა — 14 დღით, სრულიად უფასოდ. გადახდა არ არის საჭირო.', 'Вы получили полный доступ к пакету «Про» на 14 дней — совершенно бесплатно. Оплата не требуется.', "You've got full Pro-tier access — free for 14 days. No payment needed.")}
                                    </p>
                                </div>
                                <Link href="/dashboard" className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-sm shadow-xl shadow-slate-900/10 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-6 hover:bg-slate-800">
                                    {l('დაშბორდზე გადასვლა', 'Перейти в дашборд', 'Go to dashboard')}
                                    <ChevronRight className="w-5 h-5" />
                                </Link>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-center">
                            <LanguageSwitcher variant="landing" mode="persistent" align="left" className="h-9 px-4 bg-slate-50/50 border-slate-100 rounded-xl flex items-center gap-2" />
                        </div>
                    )}
                </div>

                <div className="text-center space-y-4 opacity-40 pt-2">
                    <div className="flex items-center justify-center gap-4">
                        <Shield className="w-4 h-4 text-slate-400" />
                        <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
                        <Globe className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 tracking-[0.5em] uppercase leading-none">Clascore.ge</p>
                </div>
            </div>
        </div>
    );
}
