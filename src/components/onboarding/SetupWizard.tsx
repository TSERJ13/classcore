'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, CheckCircle2, Building2, UserSquare2, Users2, UserPlus2, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';
import { useStudio } from '@/contexts/StudioContext';
import { saveHalls, getHalls, type HallData } from '@/lib/hall-store';
import { getTeachers } from '@/lib/teacher-store';
import { createGroup, type ScheduleSlot } from '@/lib/group-store';
import { syncGroupScheduleToCalendar } from '@/lib/event-store';
import { updateStudent, generateFormattedStudentId } from '@/lib/student-store';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { generateTimeOptions } from '@/lib/date-utils';

export function SetupWizard() {
    const { t, lang } = useT();
    const { settings, addStaff, setWizardCompleted } = useStudio();
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Form States
    const [hallData, setHallData] = useState({ name: '', capacity: '20', sq_meters: '' });
    const [teacherData, setTeacherData] = useState({ firstName: '', lastName: '', phone: '' });
    const [groupData, setGroupData] = useState({ 
        name: '', 
        slots: [] as ScheduleSlot[] 
    });
    const [studentData, setStudentData] = useState({ firstName: '', lastName: '' });
    
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const timeOptions = generateTimeOptions(30);

    useEffect(() => {
        const done = settings.isWizardCompleted || localStorage.getItem('cc_onboarding_done') === 'true';
        if (!done) {
            const timer = setTimeout(() => setIsOpen(true), 1000);
            return () => clearTimeout(timer);
        }
    }, [settings.isWizardCompleted]);

    const handleClose = () => {
        setWizardCompleted(true);
        setIsOpen(false);
    };

    const nextStep = () => setStep(s => s + 1);

    // Day toggler for Step 3
    const toggleDaySlot = (dayIdx: number) => {
        setGroupData(prev => {
            const existing = prev.slots.find(s => s.dayOfWeek === dayIdx);
            if (existing) {
                return { ...prev, slots: prev.slots.filter(s => s.dayOfWeek !== dayIdx) };
            } else {
                const base = prev.slots[0] || { startTime: '18:00', endTime: '19:00' };
                return { ...prev, slots: [...prev.slots, { dayOfWeek: dayIdx, startTime: base.startTime, endTime: base.endTime }] };
            }
        });
    };

    const updateSlotTime = (dayIdx: number, field: 'startTime' | 'endTime', val: string) => {
        setGroupData(prev => ({
            ...prev,
            slots: prev.slots.map(s => s.dayOfWeek === dayIdx ? { ...s, [field]: val } : s)
        }));
    };

    // Submission Handlers
    const handleAddHall = () => {
        if (!hallData.name) return nextStep();
        const halls = getHalls();
        const newHall: HallData = {
            id: crypto.randomUUID(),
            name: hallData.name,
            capacity: parseInt(hallData.capacity) || 20,
            sq_meters: parseInt(hallData.sq_meters) || 0,
            color: '#6366f1',
            is_active: true
        };
        saveHalls([...halls, newHall]);
        nextStep();
    };

    const handleAddTeacher = () => {
        if (!teacherData.firstName) return nextStep();
        
        addStaff({
            first_name: teacherData.firstName,
            last_name: teacherData.lastName,
            full_name: `${teacherData.firstName} ${teacherData.lastName}`.trim(),
            email: '',
            phone: teacherData.phone,
            role: 'teacher',
            status: 'active',
            org_id: settings.orgId || '',
            permissions: {
                canViewAttendance: true,
                canViewSubscriptions: true,
                canViewStudents: true,
                canViewCalendar: true,
                canEditCalendar: true,
                canViewGroups: true,
                canViewTeachers: true,
                canViewHalls: true,
                canViewShop: true,
                canViewAnalytics: true,
                canViewSMS: true
            }
        });
        
        nextStep();
    };

    const handleAddGroup = () => {
        if (!groupData.name || groupData.slots.length === 0) return nextStep();
        
        const currentTeachers = getTeachers();
        const currentHalls = getHalls();
        const teacher = currentTeachers[currentTeachers.length - 1]; // Use the teacher just added
        const hall = currentHalls[currentHalls.length - 1]; // Use the hall just added
        
        const newGroup = createGroup({
            name: groupData.name,
            capacity: 20,
            type: 'Dance',
            difficulty: 'beginner',
            coach: teacher ? `${teacher.first_name} ${teacher.last_name}` : '',
            teacherId: teacher?.id || '',
            hall_id: hall?.id || '',
            schedule_slots: groupData.slots,
            org_id: settings.orgId || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem(`cc_studio_settings_${localStorage.getItem('cc_active_studio_slug')}`) || '{}').orgId : undefined) || crypto.randomUUID(),
            color: '#6366f1'
        });

        if (newGroup && groupData.slots.length > 0) {
            syncGroupScheduleToCalendar(
                newGroup.id, 
                newGroup.name, 
                newGroup.teacherId || '', 
                newGroup.hall_id || '', 
                groupData.slots,
                '#6366f1'
            );
        }

        nextStep();
    };

    const handleAddStudent = () => {
        if (!studentData.firstName) return nextStep();
        const sid = generateFormattedStudentId(studentData.firstName, studentData.lastName);
        updateStudent(sid, {
            id: sid,
            first_name: studentData.firstName,
            last_name: studentData.lastName,
            full_name: `${studentData.firstName} ${studentData.lastName}`.trim(),
            status: 'active',
            balance: 0,
            created_at: new Date().toISOString()
        });
        nextStep();
    };

    if (!isOpen) return null;

    const inputCls = "w-full h-10 bg-slate-50 border-none rounded-xl px-4 text-sm font-black text-slate-900 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none placeholder:text-slate-300 shadow-xs";
    const labelCls = "text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 mb-2 block opacity-80";
    const btnCls = "w-full h-12 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-sm shadow-xl shadow-slate-900/10 active:scale-95 transition-all flex items-center justify-center gap-2.5";

    const DAY_LABELS_KA = ['ორ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'];
    const DAY_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayLabels = lang === 'ka' ? DAY_LABELS_KA : lang === 'ru' ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] : DAY_LABELS_EN;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-[480px] rounded-[3rem] p-8 sm:p-12 pt-20 relative overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-12 duration-700 max-h-[95dvh] flex flex-col">
                <div className="overflow-y-auto no-scrollbar flex-1 pb-4 scroll-smooth overscroll-contain">
                
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl opacity-60" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl opacity-60" />

                <button onClick={handleClose} className="absolute top-8 right-8 p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-300 hover:text-slate-400 z-10">
                    <X className="w-6 h-6" />
                </button>
                {/* Step 0: Welcome */}
                {step === 0 && (
                    <div className="flex flex-col items-center text-center space-y-10 py-6">
                        <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center animate-bounce shadow-2xl shadow-indigo-500/5">
                            <Sparkles className="w-12 h-12 text-indigo-500" />
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter leading-tight uppercase">
                                {l('კეთილი იყოს თქვენი მობრძანება!', 'Добრო пожаловать!', 'Welcome to Cosmos!')}
                            </h2>
                            <p className="text-sm sm:text-base text-slate-500 font-bold leading-relaxed px-6">
                                {l('სტუდიის მომართვა სულ რამდენიმე წამში. დავიწყოთ ძირითადი მონაცემებით.', 'Настройка студии за несколько секунд. Начнем с основных данных.', 'Setup your studio in seconds. Let\'s start with basics.')}
                            </p>
                        </div>
                        <button onClick={nextStep} className={btnCls}>
                            {l('დავიწყოთ', 'Начать', 'Get Started')}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Step 1: Hall */}
                {step === 1 && (
                    <div className="space-y-8 py-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
                                <Building2 className="w-6 h-6 text-indigo-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">{l('დაამატეთ დარბაზი', 'Добавить зал', 'Add first Hall')}</h3>
                                <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest mt-1">Architecture</p>
                            </div>
                        </div>
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <span className={labelCls}>{t.hallName}</span>
                                <input value={hallData.name} onChange={e => setHallData(prev => ({ ...prev, name: e.target.value }))} placeholder={l('დასახელება...', 'Название...', 'Name...')} className={inputCls} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <span className={labelCls}>{t.capacity}</span>
                                    <input type="number" value={hallData.capacity} onChange={e => setHallData(prev => ({ ...prev, capacity: e.target.value }))} placeholder="0" className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <span className={labelCls}>M²</span>
                                    <input type="number" value={hallData.sq_meters} onChange={e => setHallData(prev => ({ ...prev, sq_meters: e.target.value }))} placeholder="0" className={inputCls} />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4 pt-4">
                            <button onClick={handleAddHall} className={btnCls}>{l('შემდეგი', 'Далее', 'Save & Next')}</button>
                            <button onClick={nextStep} className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-500 transition-colors">{l('გამოტოვება', 'Пропустить', 'Skip Setup')}</button>
                        </div>
                    </div>
                )}

                {/* Step 2: Teacher */}
                {step === 2 && (
                    <div className="space-y-8 py-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center shrink-0">
                                <UserSquare2 className="w-6 h-6 text-violet-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">{l('მასწავლებელი', 'Учитель', 'First Teacher')}</h3>
                                <p className="text-[10px] text-violet-500 font-black uppercase tracking-widest mt-1">Academic Staff</p>
                            </div>
                        </div>
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <span className={labelCls}>{t.firstName}</span>
                                    <input value={teacherData.firstName} onChange={e => setTeacherData(prev => ({ ...prev, firstName: e.target.value }))} placeholder={l('სახელი...', 'Имя...', 'First Name...')} className={inputCls} />
                                </div>
                                <div className="space-y-2">
                                    <span className={labelCls}>{t.lastName}</span>
                                    <input value={teacherData.lastName} onChange={e => setTeacherData(prev => ({ ...prev, lastName: e.target.value }))} placeholder={l('გვარი...', 'Фамилия...', 'Last Name...')} className={inputCls} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <span className={labelCls}>{l('ტელეფონი', 'Телефон', 'Phone')}</span>
                                <input value={teacherData.phone} onChange={e => setTeacherData(prev => ({ ...prev, phone: e.target.value }))} placeholder="5XX XX XX XX" className={inputCls} />
                            </div>
                        </div>
                        <div className="space-y-4 pt-4">
                            <button onClick={handleAddTeacher} className={btnCls}>{l('შემდეგი', 'Далее', 'Save & Next')}</button>
                            <button onClick={nextStep} className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-500 transition-colors">{l('გამოტოვება', 'Пропустить', 'Skip Setup')}</button>
                        </div>
                    </div>
                )}

                {/* Step 3: Group */}
                {step === 3 && (
                    <div className="space-y-8 py-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
                                <Users2 className="w-6 h-6 text-emerald-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">{l('ჯგუფის შექმნა', 'Создать группу', 'Define Group')}</h3>
                                <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mt-1">Scheduling</p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <span className={labelCls}>{t.groupName}</span>
                                <input value={groupData.name} onChange={e => setGroupData(prev => ({ ...prev, name: e.target.value }))} placeholder={l('მაგ: ჰიპ-ჰოპ ბავშვები', 'Напр: Хип-хоп дети', 'e.g. Hip-Hop Kids')} className={inputCls} />
                            </div>

                            <div className="bg-slate-50/50 rounded-[2rem] p-6 space-y-6 border border-slate-100/50">
                                <span className={labelCls}>{l('განრიგი', 'Расписание', 'Weekly Schedule')}</span>
                                <div className="flex gap-2">
                                    {[0, 1, 2, 3, 4, 5, 6].map(d => {
                                        const active = groupData.slots.some(s => s.dayOfWeek === d);
                                        return (
                                            <button key={d} onClick={() => toggleDaySlot(d)}
                                                className={cn(
                                                    "flex-1 h-10 rounded-xl text-[10px] font-black transition-all border shrink-0", 
                                                    active ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200/50" : "bg-white text-slate-400 border-slate-200/60"
                                                )}>
                                                {dayLabels[d]}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="space-y-3">
                                    {groupData.slots.sort((a,b) => a.dayOfWeek - b.dayOfWeek).map((slot) => (
                                        <div key={slot.dayOfWeek} className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm animate-in slide-in-from-left-2 duration-300">
                                            <span className="text-[10px] font-black text-indigo-500 w-10 pl-2 text-center uppercase">{dayLabels[slot.dayOfWeek]}</span>
                                            <div className="flex-1 flex items-center gap-2">
                                                <SearchSelect 
                                                    options={timeOptions}
                                                    value={slot.startTime}
                                                    onChange={val => updateSlotTime(slot.dayOfWeek, 'startTime', val)}
                                                    className="flex-1 !h-10 [&>div]:bg-slate-50/50 [&>div]:border [&>div]:border-transparent [&>div]:rounded-xl [&>div]:px-4 [&>div]:text-sm [&>div]:font-black"
                                                />
                                                <span className="text-slate-300">/</span>
                                                <SearchSelect 
                                                    options={timeOptions}
                                                    value={slot.endTime}
                                                    onChange={val => updateSlotTime(slot.dayOfWeek, 'endTime', val)}
                                                    className="flex-1 !h-10 [&>div]:bg-slate-50/50 [&>div]:border [&>div]:border-transparent [&>div]:rounded-xl [&>div]:px-4 [&>div]:text-sm [&>div]:font-black"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {groupData.slots.length === 0 && (
                                        <p className="text-[11px] text-slate-300 font-bold italic text-center py-2 uppercase tracking-tighter">{l('გთხოვთ აირჩიოთ აქტიური დღეები', 'Пожалуйста, выберите активные дни', 'Please select active days above')}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4">
                            <button onClick={handleAddGroup} className={btnCls}>{l('შემდეგი', 'Далее', 'Save & Next')}</button>
                            <button onClick={nextStep} className="w-full py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-500 transition-colors">{l('გამოტოვება', 'Пропустить', 'Skip Setup')}</button>
                        </div>
                    </div>
                )}

                {/* Step 4: Student */}
                {step === 4 && (
                    <div className="space-y-8 py-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0">
                                <UserPlus2 className="w-6 h-6 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">{l('დაამატეთ სტუდენტი', 'Добавить студента', 'First Student')}</h3>
                                <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest mt-1">Enrolment</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <span className={labelCls}>{t.firstName}</span>
                                <input value={studentData.firstName} onChange={e => setStudentData(prev => ({ ...prev, firstName: e.target.value }))} placeholder={l('სახელი', 'Имя', 'First Name')} className={inputCls} />
                            </div>
                            <div className="space-y-2">
                                <span className={labelCls}>{t.lastName}</span>
                                <input value={studentData.lastName} onChange={e => setStudentData(prev => ({ ...prev, lastName: e.target.value }))} placeholder={l('გვარი', 'Фамилия', 'Last Name')} className={inputCls} />
                            </div>
                        </div>
                        <div className="space-y-4 pt-4">
                            <button onClick={handleAddStudent} className={btnCls}>{l('დასრულება', 'Завершить', 'Save & Finish')}</button>
                            <button onClick={handleClose} className="w-full text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-500 transition-colors">{l('გამოტოვება', 'Пропустить', 'Finish without student')}</button>
                        </div>
                    </div>
                )}

                {/* Step 5: Success */}
                {step === 5 && (
                    <div className="flex flex-col items-center text-center space-y-10 py-8">
                        <div className="w-28 h-28 bg-emerald-50 rounded-[3rem] flex items-center justify-center animate-in zoom-in duration-700 shadow-2xl shadow-emerald-500/10">
                            <CheckCircle2 className="w-14 h-14 text-emerald-500" />
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                                {l('მზად არის!', 'Готово!', 'Cosmos Ready!')}
                            </h2>
                            <p className="text-sm sm:text-base text-slate-500 font-bold leading-relaxed px-8">
                                {l('თქვენი სტუდია წარმატებით მომართულია. შეგიძლიათ დაიწყოთ მუშაობა.', 'Ваша студия успешно настроена. Можете приступать к работе.', 'Studio setup complete. You can now access your control center.')}
                            </p>
                        </div>
                        <button onClick={handleClose} className="w-full h-14 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">
                            {l('დეშბორდზე გადასვლა', 'На панель', 'Explore Dashboard')}
                        </button>
                    </div>
                )}

                {/* Progress Indicators */}
                {step > 0 && step < 5 && (
                    <div className="flex justify-center gap-2 mt-10">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={cn(
                                "h-1.5 rounded-full transition-all duration-300",
                                i === step ? "w-8 bg-slate-900" : i < step ? "w-3 bg-emerald-400" : "w-1.5 bg-slate-100"
                            )} />
                        ))}
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}

