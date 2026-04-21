'use client';

import { useState, useEffect, useRef } from 'react';
import { X, User, Phone, Mail, DollarSign, BookOpen, Check, Trash2, AlertTriangle, Users, Camera, Layout, Percent, Calendar, Plus, Eye, EyeOff } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useStudio } from '@/contexts/StudioContext';
import { cn, getCurrencySymbol } from '@/lib/utils';
import type { Teacher, TeacherStatus } from '@/types';
import type { Translations } from '@/lib/i18n';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { generateTimeOptions } from '@/lib/date-utils';
import { validateImageSize, processProfileImage } from '@/lib/image-utils';
import { addNotification } from '@/lib/notification-store';

interface Group { id: string; name: string; }

type RateType = 'hourly' | 'monthly' | 'percentage';

interface TeacherModalProps {
    open: boolean;
    teacher: Teacher | null;
    groups: Group[];
    onClose: () => void;
    onSave: (data: Partial<Teacher>) => void;
    onDelete?: (id: string) => void;
}


const STATUSES: { value: TeacherStatus; labelKey: keyof Translations; icon: string; cls: string }[] = [
    { value: 'active', labelKey: 'active', icon: '✓', cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' },
    { value: 'on_leave', labelKey: 'onLeave', icon: '⏸', cls: 'bg-amber-500/10 border-amber-500/30 text-amber-600' },
    { value: 'inactive', labelKey: 'inactive', icon: '✕', cls: 'bg-surface border-border-subtle text-muted opacity-60' },
];

const EMPTY: Partial<Teacher> = {
    first_name: '', last_name: '', role: 'teacher', phone: '', email: '', specialty: [],
    bio: '', rate_per_hour: undefined, rate_per_month: undefined,
    assigned_group_ids: [], assigned_individual: false, status: 'active',
    photo_url: '', salary_percentage: undefined,
};

export function TeacherModal({ open, teacher, groups, onClose, onSave, onDelete }: TeacherModalProps) {
    const { t } = useT();
    const { settings } = useStudio();
    const { lang } = useT();
    const timeOptions = generateTimeOptions(15);
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const [form, setForm] = useState<Partial<Teacher>>({ ...EMPTY });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeRateType, setActiveRateType] = useState<RateType>('hourly');
    const [showPassword, setShowPassword] = useState(false);
    const [isDeletingConfirm, setIsDeletingConfirm] = useState(false);
    const isEdit = !!teacher;

    useEffect(() => {
        if (open) {
            setForm(teacher ? { ...teacher } : { ...EMPTY, role: 'teacher', email: '', password: '' });
            setShowPassword(false);
            if (teacher) {
                if (teacher.salary_percentage) setActiveRateType('percentage');
                else if (teacher.rate_per_month) setActiveRateType('monthly');
                else setActiveRateType('hourly');
            }
            setIsDeletingConfirm(false);
        }
    }, [open, teacher]);

    function setF(k: keyof Teacher, v: unknown) {
        setForm(p => ({ ...p, [k]: v }));
    }

    function toggleGroup(id: string) {
        const arr = form.assigned_group_ids ?? [];
        setF('assigned_group_ids', arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
    }




    function save() {
        if (!form.first_name?.trim() || !form.last_name?.trim() || !form.phone?.trim()) return;

        const finalForm = { 
            ...form,
            full_name: `${form.first_name.trim()} ${form.last_name.trim()}`
        };
        onSave(finalForm);
        onClose();
    }

    if (!open) return null;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-transparent animate-in fade-in duration-200" onClick={onClose} />

            <div className="fixed inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto z-50 w-full sm:w-[420px] max-w-full max-h-[96dvh] sm:max-h-none flex flex-col bg-card sm:border-l border-t sm:border-t-0 border-border-subtle shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-right duration-300 rounded-t-[2.5rem] sm:rounded-none overflow-hidden">
                {/* Handle for mobile */}
                <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
                    <div className="w-10 h-1 rounded-full bg-border-subtle opacity-60" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center shadow-inner">
                            <User className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-primary">{isEdit ? t.editTeacher : t.newTeacher}</h2>
                            <p className="text-xs text-muted mt-0.5 font-medium opacity-70">{isEdit ? teacher!.full_name : t.staffMember}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-primary transition-all active:scale-95"><X className="w-5 h-5" /></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 overscroll-contain pb-32">
                    {/* Photo Upload */}
                    {/* Photo Upload & Role */}
                    <div className="flex gap-4">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="relative w-20 h-20 rounded-2xl bg-violet-500/5 border-2 border-dashed border-violet-500/20 hover:border-violet-500/50 flex items-center justify-center flex-shrink-0 overflow-hidden group transition-all"
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    if (!validateImageSize(file)) {
                                        addNotification({
                                            type: 'error',
                                            title: t.imageError || 'Error',
                                            message: t.fileTooLarge,
                                            duration: 4000
                                        });
                                        return;
                                    }

                                    try {
                                        const optimizedBase64 = await processProfileImage(file);
                                        setF('photo_url', optimizedBase64);
                                    } catch (err) {
                                        addNotification({
                                            type: 'error',
                                            title: t.imageError || 'Error',
                                            message: t.imageProcessingError,
                                            duration: 4000
                                        });
                                    } finally {
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }
                                }}
                            />
                            {form.photo_url ? (
                                <>
                                    <img src={form.photo_url} alt="" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Camera className="w-5 h-5 text-white" />
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-1 text-violet-500/40 group-hover:text-violet-500 transition-colors">
                                    <Camera className="w-5 h-5" />
                                    <span className="text-[9px] font-black">{t.upload}</span>
                                </div>
                            )}
                        </button>
                        <div className="flex-1 space-y-2">
                            <div className="pt-2">
                                <p className="text-sm font-black text-primary truncate">{(form.first_name || form.last_name) ? `${form.first_name || ''} ${form.last_name || ''}` : '...'}</p>
                                <p className="text-[10px] text-muted font-medium opacity-60 tracking-widest mt-1 uppercase">{t.basicInfo}</p>
                            </div>
                        </div>
                    </div>

                    {/* Basic info */}
                    <section className="space-y-4">
                        <p className="text-[10px] font-black text-muted tracking-widest opacity-40">{t.basicInfo}</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted tracking-widest opacity-40 ml-1 uppercase">{l('სახელი', 'Имя', 'First Name')} *</label>
                                <div className="relative group/input">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within/input:text-indigo-500 transition-colors" />
                                    <input value={form.first_name ?? ''} onChange={e => setF('first_name', e.target.value)}
                                        placeholder={l('სახელი', 'Имя', 'First Name')}
                                        className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-2xl pl-11 pr-4 py-3 text-[13px] sm:text-sm text-primary placeholder:text-muted/30 outline-none transition-all shadow-sm" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted tracking-widest opacity-40 ml-1 uppercase">{l('გვარი', 'Фамилия', 'Last Name')} *</label>
                                <div className="relative group/input">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within/input:text-indigo-500 transition-colors" />
                                    <input value={form.last_name ?? ''} onChange={e => setF('last_name', e.target.value)}
                                        placeholder={l('გვარი', 'Фамилия', 'Last Name')}
                                        className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-2xl pl-11 pr-4 py-3 text-[13px] sm:text-sm text-primary placeholder:text-muted/30 outline-none transition-all shadow-sm" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted tracking-widest opacity-40 ml-1 uppercase">{t.teacherPhone} *</label>
                            <div className="relative group/input">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within/input:text-indigo-500 transition-colors" />
                                <input value={form.phone ?? ''} onChange={e => setF('phone', e.target.value)}
                                    placeholder={t.phonePlaceholder}
                                    className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-2xl pl-11 pr-4 py-3 text-[13px] sm:text-sm text-primary placeholder:text-muted/30 outline-none transition-all shadow-sm" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted tracking-widest opacity-40 ml-1 uppercase">{t.email}</label>
                            <div className="relative group/input">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within/input:text-indigo-500 transition-colors" />
                                <input value={form.email ?? ''} onChange={e => setF('email', e.target.value)}
                                    placeholder={t.emailPlaceholder}
                                    className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-2xl pl-11 pr-4 py-3 text-[13px] sm:text-sm text-primary placeholder:text-muted/30 outline-none transition-all shadow-sm" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted tracking-widest opacity-40 ml-1 uppercase">{l('პაროლი', 'Пароль', 'Password')}</label>
                            <div className="relative group/input">
                                <Layout className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within/input:text-indigo-500 transition-colors" />
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    value={form.password ?? ''} 
                                    onChange={e => setF('password', e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-2xl pl-11 pr-12 py-3 text-[13px] sm:text-sm text-primary placeholder:text-muted/30 outline-none transition-all shadow-sm" 
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-surface text-muted hover:text-primary transition-all"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 opacity-40 shadow-sm" />}
                                </button>
                            </div>
                            <p className="px-1 text-[9px] text-muted opacity-50 italic">{l('მიუთითეთ თუ გსურთ მასწავლებელს ჰქონდეს პირადი წვდომა სისტემაზე', 'Укажите, თუ хотите, чтобы у учителя был личный доступ к системе', 'Set this if you want the teacher to have personal access to the system')}</p>
                        </div>

                    </section>



                    {/* Groups (Compact Labels) */}
                    <section className="space-y-4">
                        <p className="text-[10px] font-black text-muted tracking-widest opacity-40 flex items-center gap-2"><Users className="w-3 h-3" /> {t.groups}</p>
                        <div className="flex flex-wrap gap-2">
                            {groups.map(g => {
                                const assigned = form.assigned_group_ids?.includes(g.id);
                                return (
                                    <button key={g.id} onClick={() => toggleGroup(g.id)}
                                        className={cn('px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1.5',
                                            assigned ? 'bg-indigo-500/10 border-indigo-500/35 text-indigo-600' : 'bg-surface border-border-subtle text-muted')}
                                    >
                                        <BookOpen className="w-3 h-3 opacity-40" />
                                        {g.name}
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {/* Salary Selection */}
                    <div className="space-y-4">
                        <section className="space-y-4">
                            <p className="text-[10px] font-black text-muted tracking-widest opacity-40 mb-2">{l('ხელფასის გაანგარიშება', 'Расчет зарплаты', 'Salary Calculation')}</p>
                            
                            {/* Hourly Rate */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted tracking-widest opacity-40 ml-1">{t.perHourShort}</label>
                                <div className="relative group/input">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-md bg-indigo-500/10 flex items-center justify-center text-[10px] font-bold text-indigo-500">{getCurrencySymbol(settings.currency)}</div>
                                    <input type="number" value={form.rate_per_hour ?? ''}
                                        onChange={e => setF('rate_per_hour', e.target.value ? Number(e.target.value) : undefined)}
                                        className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl pl-10 pr-4 py-2 text-xs text-primary font-black outline-none transition-all shadow-sm" placeholder="0" />
                                </div>
                            </div>

                            {/* Monthly Rate */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted tracking-widest opacity-40 ml-1">{t.perMonthShort}</label>
                                <div className="relative group/input">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-md bg-violet-500/10 flex items-center justify-center text-[10px] font-bold text-violet-500">{getCurrencySymbol(settings.currency)}</div>
                                    <input type="number" value={form.rate_per_month ?? ''}
                                        onChange={e => setF('rate_per_month', e.target.value ? Number(e.target.value) : undefined)}
                                        className="w-full bg-surface border border-border-subtle focus:border-violet-500/60 rounded-xl pl-10 pr-4 py-2 text-xs text-primary font-black outline-none transition-all shadow-sm" placeholder="0" />
                                </div>
                            </div>

                            {/* Percentage Share */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted tracking-widest opacity-40 ml-1">{t.shareShort} (%)</label>
                                <div className="relative group/input">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-md bg-emerald-500/10 flex items-center justify-center"><Percent className="w-2.5 h-2.5 text-emerald-500" /></div>
                                    <input type="number" value={form.salary_percentage ?? ''}
                                        onChange={e => setF('salary_percentage', e.target.value ? Number(e.target.value) : undefined)}
                                        className="w-full bg-surface border border-border-subtle focus:border-emerald-500/60 rounded-xl pl-10 pr-4 py-2 text-xs text-primary font-black outline-none transition-all shadow-sm" placeholder="0" />
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Working Schedule */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-muted tracking-widest opacity-40 flex items-center gap-2">
                                <Calendar className="w-3 h-3" /> {t.workingSchedule}
                            </p>
                            <button 
                                onClick={() => {
                                    const current = form.working_schedule || [];
                                    setF('working_schedule', [...current, { day: 1, start_time: '10:00', end_time: '18:00' }]);
                                }}
                                className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 transition-colors flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" /> {t.add}
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {(form.working_schedule || []).map((sched, idx) => (
                                <div key={idx} className="flex items-center gap-2 p-3 rounded-xl bg-surface border border-border-subtle shadow-sm animate-in slide-in-from-top-1 duration-200">
                                    <select 
                                        value={sched.day}
                                        onChange={e => {
                                            const next = [...(form.working_schedule || [])];
                                            next[idx] = { ...next[idx], day: Number(e.target.value) };
                                            setF('working_schedule', next);
                                        }}
                                        className="bg-transparent text-xs font-bold text-primary outline-none min-w-[100px]"
                                    >
                                        <option value={1}>{t.monday}</option>
                                        <option value={2}>{t.tuesday}</option>
                                        <option value={3}>{t.wednesday}</option>
                                        <option value={4}>{t.thursday}</option>
                                        <option value={5}>{t.friday}</option>
                                        <option value={6}>{t.saturday}</option>
                                        <option value={0}>{t.sunday}</option>
                                    </select>
                                    
                                    <div className="flex items-center gap-1.5 flex-1 select-none">
                                        <SearchSelect 
                                            options={timeOptions}
                                            value={sched.start_time}
                                            onChange={val => {
                                                const next = [...(form.working_schedule || [])];
                                                next[idx] = { ...next[idx], start_time: val };
                                                setF('working_schedule', next);
                                            }}
                                            className="!border-none [&>div]:py-1 [&>div]:px-2 [&>div]:text-[10px] [&>div]:min-h-[28px] !bg-card"
                                            placeholder="10:00"
                                        />
                                        <span className="text-muted opacity-40">—</span>
                                        <SearchSelect 
                                            options={timeOptions}
                                            value={sched.end_time}
                                            onChange={val => {
                                                const next = [...(form.working_schedule || [])];
                                                next[idx] = { ...next[idx], end_time: val };
                                                setF('working_schedule', next);
                                            }}
                                            className="!border-none [&>div]:py-1 [&>div]:px-2 [&>div]:text-[10px] [&>div]:min-h-[28px] !bg-card"
                                            placeholder="18:00"
                                        />
                                    </div>
                                    
                                    <button 
                                        onClick={() => {
                                            const next = (form.working_schedule || []).filter((_, i) => i !== idx);
                                            setF('working_schedule', next);
                                        }}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                            
                            {(!form.working_schedule || form.working_schedule.length === 0) && (
                                <div className="p-4 rounded-xl border border-dashed border-border-subtle flex flex-col items-center justify-center gap-2 opacity-50">
                                    <Calendar className="w-5 h-5 text-muted/40" />
                                    <p className="text-[10px] font-medium text-muted">{t.availability}</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Branch Access */}
                    <section className="space-y-4">
                        <p className="text-[10px] font-black text-muted tracking-widest opacity-40 flex items-center gap-2">
                            <Layout className="w-3 h-3" /> {l('ფილიალები', 'Фილიалы', 'Branches')}
                        </p>
                        <div className="space-y-2">
                            {settings.branches.map(b => {
                                const allowed = !form.allowedBranchIds || form.allowedBranchIds.length === 0 || form.allowedBranchIds.includes(b.id);
                                return (
                                    <label key={b.id}
                                        className={cn('flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all shadow-sm',
                                            allowed ? 'bg-indigo-500/5 border-indigo-500/40 translate-x-1' : 'bg-surface/50 border-border-subtle opacity-60')}>
                                        <input
                                            type="checkbox"
                                            checked={allowed}
                                            onChange={() => {
                                                const current = form.allowedBranchIds || [];
                                                let next: string[];
                                                if (current.includes(b.id)) {
                                                    next = current.filter(id => id !== b.id);
                                                } else {
                                                    next = [...current, b.id];
                                                }
                                                setF('allowedBranchIds', next);
                                            }}
                                            className="sr-only"
                                        />
                                        <div className={cn('w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all',
                                            allowed ? 'bg-indigo-500 border-indigo-500 shadow-md' : 'border-border-subtle bg-card')}>
                                            {allowed && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={cn('text-sm font-bold truncate', allowed ? 'text-primary' : 'text-muted')}>{b.name}</p>
                                            {b.address && <p className="text-[10px] text-muted truncate opacity-60">{b.address}</p>}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </section>

                    {/* Status Selection (Moved to bottom & Compact) */}
                    <section className="space-y-3 pb-4">
                        <p className="text-[10px] font-black text-muted tracking-widest opacity-40">{t.teacherStatus}</p>
                        <div className="grid grid-cols-3 gap-2">
                            {STATUSES.map(s => (
                                <button key={s.value} onClick={() => setF('status', s.value)}
                                    className={cn('w-full py-1.5 rounded-lg text-[9px] font-black border transition-all flex flex-col items-center justify-center gap-1',
                                        form.status === s.value ? s.cls : 'bg-surface border-border-subtle text-muted hover:bg-surface/80')}
                                >
                                    <span className="text-sm">{s.icon}</span>
                                    {(t[s.labelKey] as string)}
                                </button>
                            ))}
                        </div>
                    </section>

                </div>

                {/* Footer */}
                <div className="flex-shrink-0 border-t border-border-subtle px-6 py-5 bg-card/50 backdrop-blur-md">
                    {isEdit && !isDeletingConfirm && (
                        <button onClick={() => setIsDeletingConfirm(true)}
                            className="w-full mb-4 py-2.5 text-red-500/60 hover:text-red-500 text-xs font-bold border border-red-500/10 hover:border-red-500/30 rounded-xl transition-all flex items-center justify-center gap-2">
                            <Trash2 className="w-4 h-4" /> {t.deleteTeacher}
                        </button>
                    )}
                    {isDeletingConfirm && (
                        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2 duration-300">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs font-black text-red-600">{t.deleteQuestion}</p>
                                <p className="text-[10px] text-red-600/60 font-medium">{t.actionIrreversible}</p>
                            </div>
                            <button onClick={() => { onDelete?.(teacher!.id); onClose(); }}
                                className="px-4 py-1.5 bg-red-500 text-white text-[11px] font-bold rounded-lg hover:bg-red-600 active:scale-95 transition-all">{t.delete}</button>
                            <button onClick={() => setIsDeletingConfirm(false)} className="text-[11px] font-bold text-muted hover:text-primary transition-colors">{t.cancel}</button>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button onClick={onClose}
                            className="flex-1 py-3 border border-border-subtle hover:bg-surface text-muted hover:text-primary text-sm font-bold rounded-xl transition-all shadow-sm">
                            {t.cancel}
                        </button>
                        <button onClick={save} disabled={!form.first_name?.trim() || !form.last_name?.trim() || !form.phone?.trim()}
                            className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 active:scale-95">
                            <Check className="w-5 h-5" /> {t.save}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
