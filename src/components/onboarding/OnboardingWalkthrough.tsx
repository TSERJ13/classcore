'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, CheckCircle2, Building2, UserSquare2, Users2, UserPlus2, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';

export function OnboardingWalkthrough() {
    const { t, lang } = useT();
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState(0);

    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    useEffect(() => {
        const done = localStorage.getItem('cc_onboarding_done');
        if (!done) {
            // Delay slightly for smooth appearance
            const timer = setTimeout(() => setIsOpen(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const steps = [
        {
            title: l('მოგესალმებით ClassCore-ში!', 'Добро пожаловать в ClassCore!', 'Welcome to ClassCore!'),
            desc: l('თქვენი რეგისტრაცია წარმატებით დასრულდა. მოდით მოკლედ მიმოვიხილოთ, როგორ მუშაობს სისტემა.', 'Ваша регистрация завершена. Давайте кратко рассмотрим, как работает система.', 'Your registration is complete. Let\'s briefly review how the system works.'),
            icon: CheckCircle2,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10'
        },
        {
            title: l('1. დარბაზები', '1. Залы', '1. Halls'),
            desc: l('პირველ რიგში, დაამატეთ თქვენი სტუდიის დარბაზები, სადაც ჩატარდება გაკვეთილები.', 'Прежде всего, добавьте залы вашей студии, где будут проходить занятия.', 'First, add your studio halls where classes will take place.'),
            icon: Building2,
            color: 'text-indigo-500',
            bg: 'bg-indigo-500/10'
        },
        {
            title: l('2. მასწავლებლები', '2. Преподаватели', '2. Teachers'),
            desc: l('შემდეგ დაამატეთ მასწავლებლები და მიუთითეთ მათი სამუშაო განრიგი.', 'Затем добавьте преподавателей и укажите их рабочий график.', 'Then add teachers and specify their working schedules.'),
            icon: UserSquare2,
            color: 'text-violet-500',
            bg: 'bg-violet-500/10'
        },
        {
            title: l('3. ჯგუფები', '3. Группы', '3. Groups'),
            desc: l('შექმენით ჯგუფები, დაუკავშირეთ ისინი შესაბამის დარბაზებსა და მასწავლებლებს.', 'Создайте группы, свяжите их с соответствующими залами и преподавателями.', 'Create groups and link them to the appropriate halls and teachers.'),
            icon: Users2,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10'
        },
        {
            title: l('4. სტუდენტები', '4. Студенты', '4. Students'),
            desc: l('დაარეგისტრირეთ სტუდენტები და გაანაწილეთ ისინი სასურველ ჯგუფებში.', 'Зарегистрируйте студентов и распределите их по нужным группам.', 'Register students and assign them to the desired groups.'),
            icon: UserPlus2,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10'
        },
        {
            title: l('5. აბონემენტები', '5. Абонементы', '5. Subscriptions'),
            desc: l('და ბოლოს, გამოუწერეთ აბონემენტები სტუდენტებს გაკვეთილებზე დასასწრებად.', 'И наконец, выпишите абонементы студентам для посещения занятий.', 'Finally, issue subscriptions to students for attending classes.'),
            icon: CreditCard,
            color: 'text-rose-500',
            bg: 'bg-rose-500/10'
        }
    ];

    const handleNext = () => {
        if (step < steps.length - 1) {
            setStep(step + 1);
        } else {
            handleClose();
        }
    };

    const handleClose = () => {
        localStorage.setItem('cc_onboarding_done', 'true');
        setIsOpen(false);
    };

    if (!isOpen) return null;

    const current = steps[step];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-[440px] rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
                <div className="flex justify-end mb-2">
                    <button onClick={handleClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col items-center text-center space-y-6">
                    <div className={cn("w-20 h-20 rounded-[1.5rem] flex items-center justify-center transition-all duration-500", current.bg)}>
                        <current.icon className={cn("w-10 h-10", current.color)} />
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{current.title}</h2>
                        <p className="text-slate-500 font-medium leading-relaxed">
                            {current.desc}
                        </p>
                    </div>

                    {/* Progress dots */}
                    <div className="flex gap-1.5 pt-2">
                        {steps.map((_, i) => (
                            <div key={i} className={cn(
                                "h-1.5 rounded-full transition-all duration-300",
                                i === step ? "w-6 bg-indigo-500" : "w-1.5 bg-slate-100"
                            )} />
                        ))}
                    </div>

                    <div className="w-full pt-4">
                        <button 
                            onClick={handleNext}
                            className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xl shadow-slate-900/10"
                        >
                            {step === steps.length - 1 ? l('გასაგებია', 'Понятно', 'Got it') : l('შემდეგი', 'Далее', 'Next')} 
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
