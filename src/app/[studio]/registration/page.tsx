'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Camera, User, Phone, Calendar, CheckCircle, ArrowRight, Loader2, Mail, MapPin } from 'lucide-react';
import { loadSettings, DEFAULT_SETTINGS, type Branch } from '@/lib/settings-store';
import { updateStudent, generateFormattedStudentId, getStudents } from '@/lib/student-store';
import { pushStudioStateToCloud } from '@/lib/sync-store';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { StandardDatePicker } from '@/components/ui/StandardDatePicker';
import { validateImageSize, processProfileImage } from '@/lib/image-utils';

export default function StudentRegistrationPage() {
    const params = useParams() as { studio: string };
    const studio = (params?.studio || '').toLowerCase();
    const { t, lang } = useT();
    const [isMounted, setIsMounted] = useState(false);
    const [settings, setSettings] = useState<any>(DEFAULT_SETTINGS);

    useEffect(() => {
        setIsMounted(true);
        const initBranding = async () => {
            try {
                // 1. Try local cache first
                const loaded = loadSettings(studio);
                if (loaded && loaded.studioName) {
                    setSettings(loaded);
                    return;
                }

                // 2. Cloud Fallback for public visitors
                console.log('📡 [Registration] Branding missing locally. Fetching from cloud for:', studio);
                const { fetchStudioDataFromCloud } = await import('@/lib/sync-store');
                const cloudData = await fetchStudioDataFromCloud(studio);
                
                if (cloudData && cloudData.cc_studio_settings) {
                    const branding = cloudData.cc_studio_settings;
                    setSettings((prev: any) => ({
                        ...prev,
                        studioName: branding.studioName || studio,
                        logoDataUrl: branding.logoDataUrl || null,
                        branches: branding.branches || prev.branches
                    }));
                }
            } catch (e) {
                console.warn('⚠️ [Registration] Branding fetch failed:', e);
            }
        };
        initBranding();
    }, [studio]);

    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.title = `${t.registerNow} | ${settings.studioName}`;
        }
    }, [settings.studioName, t.registerNow]);

    const fileRef = useRef<HTMLInputElement>(null);
    const [photoPreview, setPhotoPreview] = useState<string>('');
    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        birth_date: '',
        branch_id: '',
    });

    useEffect(() => {
        if (settings.branches?.[0]?.id) {
            setForm(prev => ({ ...prev, branch_id: settings.branches[0].id }));
        }
    }, [settings.branches]);

    const [saving, setSaving] = useState(false);
    const [savedId, setSavedId] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    if (!isMounted) return null;

    const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!validateImageSize(file)) {
            setErrors(prev => ({ ...prev, photo: t.fileTooLarge }));
            return;
        }

        try {
            setErrors(prev => ({ ...prev, photo: '' }));
            const optimizedBase64 = await processProfileImage(file);
            setPhotoPreview(optimizedBase64);
        } catch (err) {
            setErrors(prev => ({ ...prev, photo: t.imageProcessingError }));
        } finally {
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.first_name.trim()) errs.first_name = t.requiredField;
        if (!form.last_name.trim()) errs.last_name = t.requiredField;
        if (!form.phone.trim()) errs.phone = t.requiredField;
        if (!form.branch_id) errs.branch_id = t.requiredField;
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };
    const handleSubmit = async () => {
        if (!validate()) return;
        setSaving(true);
        await new Promise(r => setTimeout(r, 400));

        const id = generateFormattedStudentId(form.first_name, form.last_name);
        const full_name = `${form.first_name} ${form.last_name}`.trim();

        const student = {
            id,
            org_id: studio,
            full_name,
            first_name: form.first_name,
            last_name: form.last_name,
            phone: form.phone,
            email: form.email || undefined,
            birth_date: form.birth_date || undefined,
            photo_url: photoPreview || undefined,
            status: 'active' as const,
            enrolled_group_ids: [],
            created_at: new Date().toISOString(),
            branch_id: form.branch_id,
        };

        // 1. Update local storage for immediate feedback (though user is redirected)
        updateStudent(id, student);
        
        // 2. Push to cloud via specialized public API to ensure atomic append
        try {
            console.log('📡 [Registration] Registering student via API:', id);
            const res = await fetch('/api/public/register-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studio, student })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save to cloud');
            console.log('✅ [Registration] Cloud registration successful');
        } catch (e) {
            console.error('❌ [Registration] Cloud registration failed:', e);
        }

        setSavedId(id);
        setSaving(false);
    };

    const portalUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/${studio}/${savedId}`
        : '';

    if (savedId) {
        return (
            <div className="min-h-screen bg-card flex flex-col items-center justify-center p-6 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-xl shadow-emerald-500/10">
                    <CheckCircle className="w-12 h-12" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-black text-primary tracking-tight">
                        {form.first_name} {form.last_name}
                    </h1>
                    <p className="text-sm text-muted font-medium opacity-70">
                        {t.registrationSuccess} {settings.studioName}
                    </p>
                </div>
                <div className="bg-surface border border-border-subtle rounded-2xl p-4 w-full max-w-sm space-y-2">
                    <p className="text-[10px] font-black text-muted tracking-widest opacity-40">{t.yourId}</p>
                    <p className="text-2xl font-mono font-black text-primary tracking-widest">{savedId}</p>
                </div>
                <a
                    href={portalUrl}
                    className="flex items-center gap-2 w-full max-w-sm py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/20 active:scale-95 transition-all justify-center group"
                >
                    {t.viewProfile}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-card max-w-lg mx-auto pt-8 pb-24 px-4 relative">
            <div className="absolute top-4 right-4 z-50">
                <LanguageSwitcher variant="landing" align="right" hideLabel={true} />
            </div>

            {/* Header */}
            <div className="flex flex-col items-center justify-center mb-6 mt-2 pt-2">
                {settings.logoDataUrl ? (
                    <div className="relative group p-1">
                        <div className="absolute inset-0 bg-indigo-500/5 rounded-xl blur-lg opacity-0 transition-opacity" />
                        <img src={settings.logoDataUrl} alt={settings.studioName} className="w-10 h-10 rounded-xl object-contain shadow-md relative z-10" />
                    </div>
                ) : (
                    <div className="w-10 h-10 bg-card border border-border-subtle rounded-xl flex items-center justify-center shadow-md shadow-black/5 mb-2">
                        <div className="w-full h-full bg-indigo-500 flex items-center justify-center rounded-xl">
                            <User className="text-white w-5 h-5" />
                        </div>
                    </div>
                )}
                <div className="text-center mt-1.5">
                    <h1 className="text-sm font-black text-primary tracking-tight mb-0">{settings.studioName}</h1>
                    <div className="flex items-center justify-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                        <span className="text-[9px] font-bold text-muted tracking-[0.2em] opacity-40">{t.addStudentShort}</span>
                    </div>
                </div>
            </div>

            <div className="space-y-5">
                {/* Photo */}
                <div className="flex flex-col items-center">
                    <button
                        onClick={() => fileRef.current?.click()}
                        className="relative w-24 h-24 rounded-2xl bg-indigo-500/5 border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 flex items-center justify-center flex-shrink-0 overflow-hidden group transition-all"
                    >
                        {photoPreview ? (
                            <>
                                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Camera className="w-6 h-6 text-white" />
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-1 text-indigo-400 opacity-60 group-hover:opacity-100 transition-opacity">
                                <Camera className="w-6 h-6" />
                                <span className="text-[9px] font-black tracking-wider">{t.photo}</span>
                            </div>
                        )}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                    {errors.photo ? (
                        <p className="text-[10px] font-black text-red-500 mt-2">{errors.photo}</p>
                    ) : (
                        <p className="text-[10px] text-muted opacity-40 font-bold mt-2 tracking-wider">{t.photoOptional}</p>
                    )}
                </div>

                {/* Fields */}
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs font-bold text-muted opacity-70 px-1">
                        <span className="opacity-40"><User className="w-4 h-4" /></span>
                        {t.firstName} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={form.first_name}
                        onChange={e => {
                            setForm(prev => ({ ...prev, first_name: e.target.value }));
                            setErrors(prev => ({ ...prev, first_name: '' }));
                        }}
                        placeholder={t.firstNamePlaceholder}
                        className={cn(
                            'w-full bg-surface border rounded-xl px-3 py-3 text-sm text-primary font-medium placeholder:text-muted/30 outline-none transition-all shadow-sm',
                            errors.first_name ? 'border-red-500/50 focus:border-red-500/80 bg-red-500/5' : 'border-border-subtle focus:border-indigo-500/60'
                        )}
                    />
                    {errors.first_name && <p className="text-[10px] font-black text-red-500 px-1">{errors.first_name}</p>}
                </div>

                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs font-bold text-muted opacity-70 px-1">
                        <span className="opacity-40"><User className="w-4 h-4" /></span>
                        {t.lastName} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={form.last_name}
                        onChange={e => {
                            setForm(prev => ({ ...prev, last_name: e.target.value }));
                            setErrors(prev => ({ ...prev, last_name: '' }));
                        }}
                        placeholder={t.lastNamePlaceholder}
                        className={cn(
                            'w-full bg-surface border rounded-xl px-3 py-3 text-sm text-primary font-medium placeholder:text-muted/30 outline-none transition-all shadow-sm',
                            errors.last_name ? 'border-red-500/50 focus:border-red-500/80 bg-red-500/5' : 'border-border-subtle focus:border-indigo-500/60'
                        )}
                    />
                    {errors.last_name && <p className="text-[10px] font-black text-red-500 px-1">{errors.last_name}</p>}
                </div>

                <div className="space-y-1.5">
                    <StandardDatePicker
                        label={t.birthDate}
                        value={form.birth_date}
                        onChange={v => setForm(prev => ({ ...prev, birth_date: v }))}
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs font-bold text-muted opacity-70 px-1">
                        <span className="opacity-40"><Phone className="w-4 h-4" /></span>
                        {t.studentPhone} <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="tel"
                        value={form.phone}
                        onChange={e => {
                            setForm(prev => ({ ...prev, phone: e.target.value }));
                            setErrors(prev => ({ ...prev, phone: '' }));
                        }}
                        placeholder="5XX XX XX XX"
                        className={cn(
                            'w-full bg-surface border rounded-xl px-3 py-3 text-sm text-primary font-medium placeholder:text-muted/30 outline-none transition-all shadow-sm',
                            errors.phone ? 'border-red-500/50 focus:border-red-500/80 bg-red-500/5' : 'border-border-subtle focus:border-indigo-500/60'
                        )}
                    />
                    {errors.phone && <p className="text-[10px] font-black text-red-500 px-1">{errors.phone}</p>}
                </div>

                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs font-bold text-muted opacity-70 px-1">
                        <span className="opacity-40"><Mail className="w-4 h-4" /></span>
                        {t.email}
                    </label>
                    <input
                        type="email"
                        value={form.email}
                        onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="name@example.com"
                        className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-3 text-sm text-primary font-medium placeholder:text-muted/30 outline-none focus:border-indigo-500/60 transition-all shadow-sm"
                    />
                </div>

                {/* Branch Selection */}
                <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs font-bold text-muted opacity-70 px-1">
                        <span className="opacity-40"><MapPin className="w-4 h-4" /></span>
                        {t.branchLabel} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group">
                        <select
                            value={form.branch_id}
                            onChange={e => {
                                setForm(prev => ({ ...prev, branch_id: e.target.value }));
                                setErrors(prev => ({ ...prev, branch_id: '' }));
                            }}
                            className={cn(
                                'w-full bg-surface border rounded-xl px-3 py-3 text-sm text-primary font-medium outline-none transition-all shadow-sm appearance-none',
                                errors.branch_id ? 'border-red-500/50 focus:border-red-500/80 bg-red-500/5' : 'border-border-subtle focus:border-indigo-500/60'
                            )}
                        >
                            {settings.branches?.map((branch: Branch) => (
                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none opacity-40">
                            <ArrowRight className="w-4 h-4 rotate-90" />
                        </div>
                    </div>
                    {errors.branch_id && <p className="text-[10px] font-black text-red-500 px-1">{errors.branch_id}</p>}
                </div>

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
                >
                    {saving ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />{t.registering}</>
                    ) : (
                        <>{t.registerNow} <ArrowRight className="w-4 h-4" /></>
                    )}
                </button>

                <p className="text-center text-[9px] font-bold text-muted tracking-[0.2em] opacity-20 pt-2">
                    {settings.studioName} · ClassCore
                </p>
            </div>
        </div>
    );
}
