'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, User, Phone, Mail, Calendar, FileText, Trash2, Check, Camera, QrCode, Download, RefreshCw, CreditCard, Wifi, AlertTriangle, Facebook, Instagram, Send, MessageCircle, Plus } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { cn, getInitials, isExpiringSoon } from '@/lib/utils';
import { generateStudentCode, generateQRDataUrl } from '@/lib/qr';
import type { Student, OrgType } from '@/types';
import { registerUid, unregisterStudentUid, getStudentUid } from '@/lib/student-store';
import { getCustomStyles, addCustomStyle, removeCustomStyle } from '@/lib/style-store';

interface StudentModalProps {
    open: boolean;
    student?: Student | null;
    orgType?: OrgType;
    groups?: { id: string; name: string }[];
    onClose: () => void;
    onSave: (data: Partial<Student>) => void;
    onDelete?: (id: string) => void;
}

export function StudentModal({
    open, student, orgType = 'dance', groups = [], onClose, onSave, onDelete,
}: StudentModalProps) {
    const { t } = useT();
    const isEdit = !!student;
    const fileRef = useRef<HTMLInputElement>(null);

    const [availableStyles, setAvailableStyles] = useState<string[]>([]);
    const [newStyleInput, setNewStyleInput] = useState('');

    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        birth_date: '',
        notes: '',
        dance_style: '',
        medical_cert_expires_at: '',
        photo_url: '',
        qr_code: '',
        nfc_uid: '',
        passport_url: '',
        passport_expires_at: '',
        social_links: {
            facebook: '',
            instagram: '',
            telegram: '',
            whatsapp: '',
        }
    });

    const [confirmDelete, setConfirmDelete] = useState(false);
    const [saving, setSaving] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [qrLoading, setQrLoading] = useState(false);
    const [photoPreview, setPhotoPreview] = useState('');
    const [nfcScanning, setNfcScanning] = useState(false);
    const [nfcError, setNfcError] = useState('');
    const nfcReaderRef = useRef<unknown>(null);

    useEffect(() => {
        if (open) {
            setAvailableStyles(getCustomStyles());
            if (student) {
                const persistedUid = getStudentUid(student.id);
                // Attempt to split full_name if first_name/last_name are missing
                let fName = student.first_name || '';
                let lName = student.last_name || '';
                if (!fName && student.full_name) {
                    const parts = student.full_name.trim().split(/\s+/);
                    fName = parts[0] || '';
                    lName = parts.slice(1).join(' ') || '';
                }

                setForm({
                    first_name: fName,
                    last_name: lName,
                    phone: student.phone ?? '',
                    email: student.email ?? '',
                    birth_date: student.birth_date ?? '',
                    notes: student.notes ?? '',
                    dance_style: student.dance_style ?? '',
                    medical_cert_expires_at: student.medical_cert_expires_at ?? '',
                    photo_url: student.photo_url ?? '',
                    qr_code: student.qr_code ?? generateStudentCode(),
                    nfc_uid: persistedUid || student.nfc_uid || '',
                    passport_url: (student as any).passport_url ?? '',
                    passport_expires_at: (student as any).passport_expires_at ?? '',
                    social_links: {
                        facebook: student.social_links?.facebook ?? '',
                        instagram: student.social_links?.instagram ?? '',
                        telegram: student.social_links?.telegram ?? '',
                        whatsapp: student.social_links?.whatsapp ?? '',
                    }
                });
                setPhotoPreview(student.photo_url ?? '');
            } else {
                const newCode = generateStudentCode();
                setForm({
                    first_name: '', last_name: '', phone: '', email: '', birth_date: '', notes: '', dance_style: '',
                    medical_cert_expires_at: '', photo_url: '', qr_code: newCode, nfc_uid: '', passport_url: '', passport_expires_at: '',
                    social_links: { facebook: '', instagram: '', telegram: '', whatsapp: '' }
                });
                setPhotoPreview('');
            }
            setConfirmDelete(false);
            setQrDataUrl('');
            setNfcScanning(false);
            setNfcError('');
        }
    }, [student, open]);

    useEffect(() => {
        if (!form.qr_code) return;
        setQrLoading(true);
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        generateQRDataUrl(form.qr_code, origin).then(url => {
            setQrDataUrl(url);
            setQrLoading(false);
        });
    }, [form.qr_code]);

    function set(k: string, v: any) {
        setForm(p => ({ ...p, [k]: v }));
    }

    function setSocial(k: keyof typeof form.social_links, v: string) {
        setForm(p => ({ ...p, social_links: { ...p.social_links, [k]: v } }));
    }

    function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const result = ev.target?.result as string;
            setPhotoPreview(result);
            set('photo_url', result);
        };
        reader.readAsDataURL(file);
    }

    function handleAddStyle() {
        if (!newStyleInput.trim()) return;
        addCustomStyle(newStyleInput.trim());
        setAvailableStyles(getCustomStyles());
        set('dance_style', newStyleInput.trim());
        setNewStyleInput('');
    }

    function handleRemoveStyle(s: string) {
        removeCustomStyle(s);
        setAvailableStyles(getCustomStyles());
        if (form.dance_style === s) set('dance_style', '');
    }

    function regenerateCode() {
        set('qr_code', generateStudentCode());
    }

    function downloadQR() {
        if (!qrDataUrl) return;
        const a = document.createElement('a');
        a.href = qrDataUrl;
        a.download = `SF-card-${form.qr_code}.png`;
        a.click();
    }

    const startNFCScan = useCallback(async () => {
        if (!('NDEFReader' in window)) {
            setNfcError('NFC ხელმიუწვდომელია — Android Chrome საჭიროა');
            return;
        }
        setNfcScanning(true);
        setNfcError('');
        try {
            const ndef = new (window as any).NDEFReader();
            nfcReaderRef.current = ndef;
            await ndef.scan();
            ndef.addEventListener('reading', ({ serialNumber }: any) => {
                const uid = (serialNumber || '').replace(/[:\-\s]/g, '').toUpperCase();
                set('nfc_uid', uid);
                setNfcScanning(false);
            }, { once: true });
        } catch {
            setNfcError('სკანირება ვერ დაიწყო. NFC ჩართულია?');
            setNfcScanning(false);
        }
    }, []);

    async function handleSave() {
        if (!form.first_name || !form.phone) return;
        setSaving(true);
        await new Promise(r => setTimeout(r, 400));
        const fullName = `${form.first_name} ${form.last_name}`.trim();
        const studentId = student?.id ?? `new_${Date.now()}`;

        if (form.nfc_uid) {
            registerUid(form.nfc_uid, studentId, fullName);
        } else if (student?.id) {
            unregisterStudentUid(student.id);
        }

        // Persist to store so other pages (like Attendance) can see updates
        const { saveStudentPatch } = await import('@/lib/student-store');
        saveStudentPatch(studentId, {
            ...form,
            full_name: fullName
        } as any);

        onSave({ ...form, full_name: fullName });
        setSaving(false);
        onClose();
    }

    if (!open) return null;

    const passportExpiring = form.passport_expires_at ? isExpiringSoon(form.passport_expires_at, 30) : false;
    const passportExpired = form.passport_expires_at ? new Date(form.passport_expires_at) < new Date() : false;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col bg-card border-l border-border-subtle shadow-2xl animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle flex-shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-primary">
                            {isEdit ? t.edit + ' — ' + form.first_name + ' ' + form.last_name : t.addStudent}
                        </h2>
                        <p className="text-xs text-muted mt-0.5 font-medium opacity-70">
                            {isEdit ? 'ID: ' + student!.id.slice(0, 8) : 'ახალი სტუდენტის დამატება'}
                        </p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-primary transition-all active:scale-95">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-thin scrollbar-thumb-border-subtle">
                    {/* Photo Upload */}
                    <section className="space-y-4">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 flex items-center gap-2">
                            <Camera className="w-3.5 h-3.5" /> ფოტო
                        </p>
                        <div className="flex items-center gap-5">
                            <button
                                onClick={() => fileRef.current?.click()}
                                className="relative w-24 h-24 rounded-2xl bg-indigo-500/5 border-2 border-dashed border-indigo-500/20 hover:border-indigo-500/50 flex items-center justify-center flex-shrink-0 overflow-hidden group transition-all"
                            >
                                {photoPreview ? (
                                    <>
                                        <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Camera className="w-6 h-6 text-white" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-1.5 text-indigo-500/40 group-hover:text-indigo-500 transition-colors">
                                        <Camera className="w-6 h-6" />
                                        <span className="text-[10px] font-black">ატვირთვა</span>
                                    </div>
                                )}
                            </button>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                            <div className="min-w-0">
                                <p className="text-base font-black text-primary truncate">
                                    {form.first_name || form.last_name ? `${form.first_name} ${form.last_name}` : '...'}
                                </p>
                                <p className="text-xs text-muted font-medium opacity-60">JPG, PNG · მაქს 5MB</p>
                                {photoPreview && (
                                    <button
                                        onClick={() => { setPhotoPreview(''); set('photo_url', ''); if (fileRef.current) fileRef.current.value = ''; }}
                                        className="text-[11px] font-bold text-red-500/70 hover:text-red-500 mt-2 transition-colors flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3 h-3" /> ფოტოს წაშლა
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Basic info */}
                    <section className="space-y-4">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40">ძირითადი ინფო</p>
                        <div className="grid grid-cols-2 gap-4">
                            <Field icon={<User className="w-4 h-4" />} label="სახელი *">
                                <input value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="მაგ: ნინო" className={inputCls} />
                            </Field>
                            <Field icon={<User className="w-4 h-4" />} label="გვარი">
                                <input value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="ბერიძე" className={inputCls} />
                            </Field>
                        </div>
                        <Field icon={<Phone className="w-4 h-4" />} label={t.studentPhone + ' *'}>
                            <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="555 XX XX XX" className={inputCls} />
                        </Field>
                        <Field icon={<Mail className="w-4 h-4" />} label={t.email}>
                            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@gmail.com" className={inputCls} />
                        </Field>
                        <Field icon={<Calendar className="w-4 h-4" />} label="დაბადების თარიღი">
                            <input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} className={inputCls} />
                        </Field>
                    </section>

                    {/* Social Links */}
                    <section className="space-y-4">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 flex items-center gap-2">
                            სოციალური ქსელები
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="relative">
                                <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-600" />
                                <input value={form.social_links.facebook} onChange={e => setSocial('facebook', e.target.value)} placeholder="Facebook" className={cn(inputCls, 'pl-9 text-[11px]')} />
                            </div>
                            <div className="relative">
                                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-pink-600" />
                                <input value={form.social_links.instagram} onChange={e => setSocial('instagram', e.target.value)} placeholder="Instagram" className={cn(inputCls, 'pl-9 text-[11px]')} />
                            </div>
                            <div className="relative">
                                <Send className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sky-500" />
                                <input value={form.social_links.telegram} onChange={e => setSocial('telegram', e.target.value)} placeholder="@username" className={cn(inputCls, 'pl-9 text-[11px]')} />
                            </div>
                            <div className="relative">
                                <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />
                                <input value={form.social_links.whatsapp} onChange={e => setSocial('whatsapp', e.target.value)} placeholder="WhatsApp" className={cn(inputCls, 'pl-9 text-[11px]')} />
                            </div>
                        </div>
                    </section>

                    {/* Passport / Documents */}
                    <section className="space-y-4">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5" /> საბუთები
                        </p>
                        <div className={cn(
                            "bg-surface border rounded-2xl p-4 space-y-4 shadow-inner transition-colors",
                            passportExpired ? "border-red-500/30 bg-red-500/5" : passportExpiring ? "border-amber-500/30 bg-amber-500/5" : "border-border-subtle"
                        )}>
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-muted px-1 uppercase tracking-wider opacity-60">პასპორტის ასლი</label>
                                {form.passport_url && (
                                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">ატვირთულია</span>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'application/pdf,image/*';
                                    input.onchange = (e: any) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (ev) => set('passport_url', ev.target?.result as string);
                                            reader.readAsDataURL(file);
                                        }
                                    };
                                    input.click();
                                }}
                                className="w-full py-2.5 bg-card border border-border-subtle hover:border-indigo-500/40 text-xs font-bold text-muted hover:text-indigo-500 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                                <Download className="w-3.5 h-3.5 opacity-60" /> {form.passport_url ? 'შეცვლა' : 'ატვირთვა (PDF, JPG)'}
                            </button>
                            <Field icon={<Calendar className="w-4 h-4" />} label="პასპორტის ვადა">
                                <div className="space-y-2">
                                    <input type="date" value={form.passport_expires_at} onChange={e => set('passport_expires_at', e.target.value)} className={inputCls} />
                                    {passportExpired && (
                                        <p className="text-[10px] font-black text-red-500 flex items-center gap-1.5 px-1 animate-pulse">
                                            <AlertTriangle className="w-3 h-3" /> ვადა გაუვიდა!
                                        </p>
                                    )}
                                    {!passportExpired && passportExpiring && (
                                        <p className="text-[10px] font-black text-amber-600 flex items-center gap-1.5 px-1">
                                            <AlertTriangle className="w-3 h-3" /> მალე გადის ვადა!
                                        </p>
                                    )}
                                </div>
                            </Field>
                        </div>
                    </section>

                    {/* Dynamic Styles / Categories */}
                    <section className="space-y-4">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 flex items-center justify-between">
                            <span>{t.categories}</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {availableStyles.map(s => (
                                <div key={s} className="relative group">
                                    <button onClick={() => set('dance_style', form.dance_style === s ? '' : s)}
                                        className={cn(
                                            'px-3 py-2 text-[11px] font-bold rounded-xl border transition-all shadow-sm pr-7',
                                            form.dance_style === s
                                                ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 scale-105'
                                                : 'bg-surface border-border-subtle text-muted hover:text-primary'
                                        )}>
                                        {s}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRemoveStyle(s); }}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500 hover:text-white"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={newStyleInput}
                                onChange={e => setNewStyleInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddStyle()}
                                placeholder="ახალი სტილი..."
                                className={cn(inputCls, 'py-2 text-[11px]')}
                            />
                            <button onClick={handleAddStyle} className="px-3 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </section>

                    {/* QR Card */}
                    <section className="space-y-4">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 flex items-center gap-2">
                            <QrCode className="w-3.5 h-3.5" /> სტუდენტის QR ბარათი
                        </p>
                        <div className="bg-surface border border-border-subtle rounded-2xl p-4 shadow-inner">
                            <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 border border-indigo-500/20 rounded-2xl p-4 flex items-center gap-4 mb-4 shadow-sm">
                                <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-indigo-500 flex items-center justify-center text-white text-base font-black shadow-lg">
                                    {photoPreview
                                        ? <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                                        : getInitials(`${form.first_name} ${form.last_name}` || '??')
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-primary truncate leading-tight">{(form.first_name || form.last_name) ? `${form.first_name} ${form.last_name}` : 'სტუდენტი'}</p>
                                    <p className="text-[11px] text-indigo-600 font-bold mt-0.5 opacity-80">{form.dance_style || 'StudioFlow'}</p>
                                    <p className="text-xs font-mono font-black text-primary/40 mt-1.5 tracking-widest">{form.qr_code}</p>
                                </div>
                                <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center bg-white rounded-xl overflow-hidden shadow-inner p-1">
                                    {qrLoading ? (
                                        <div className="w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                                    ) : qrDataUrl ? (
                                        <img src={qrDataUrl} alt="QR" className="w-full h-full object-contain" />
                                    ) : null}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={regenerateCode} className="flex-1 flex items-center justify-center gap-2 text-[11px] font-bold text-muted hover:text-primary bg-card/40 hover:bg-card border border-border-subtle/50 py-2.5 rounded-xl transition-all">
                                    <RefreshCw className="w-3.5 h-3.5" /> ახალი
                                </button>
                                <button onClick={downloadQR} disabled={!qrDataUrl} className="flex-1 flex items-center justify-center gap-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 py-2.5 rounded-xl transition-all disabled:opacity-30">
                                    <Download className="w-3.5 h-3.5" /> გადმოწერა
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* NFC Card */}
                    <section className="space-y-4">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 flex items-center gap-2">
                            <CreditCard className="w-3.5 h-3.5" /> NFC / RFID ბარათი
                        </p>
                        <div className="bg-surface border border-border-subtle rounded-2xl p-4 space-y-4 shadow-inner">
                            {form.nfc_uid ? (
                                <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 shadow-sm animate-in zoom-in-95 duration-200">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                    <span className="text-xs font-mono font-black text-emerald-700 flex-1 truncate tracking-widest">{form.nfc_uid}</span>
                                    <button onClick={() => set('nfc_uid', '')} className="text-muted hover:text-red-500 transition-colors p-1">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-card/40 border border-border-subtle/50 rounded-xl px-4 py-3 text-xs text-muted/40 font-bold italic text-center">
                                    ბარათი არ არის მინიჭებული
                                </div>
                            )}
                            <button
                                onClick={startNFCScan}
                                disabled={nfcScanning}
                                className={cn(
                                    'w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-xs font-black border transition-all shadow-sm',
                                    nfcScanning
                                        ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/20 active:scale-95'
                                )}
                            >
                                {nfcScanning
                                    ? <><Wifi className="w-4 h-4 animate-pulse" /> მიათხოვე ბარათი...</>
                                    : <><Wifi className="w-4 h-4" /> სკანირება (Android)</>
                                }
                            </button>
                            <div className="space-y-2">
                                <p className="text-[10px] text-muted font-bold opacity-40 px-1 uppercase tracking-widest">ხელით შეყვანა:</p>
                                <input
                                    value={form.nfc_uid}
                                    onChange={e => set('nfc_uid', e.target.value.toUpperCase())}
                                    placeholder="04A32B1C"
                                    className="w-full bg-card border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-xs text-primary font-mono font-black placeholder:text-muted/20 outline-none transition-all shadow-sm"
                                />
                            </div>
                            {nfcError && <p className="text-[10px] text-red-500 font-bold text-center px-1 animate-pulse">{nfcError}</p>}
                        </div>
                    </section>

                    {/* Delete section */}
                    {isEdit && (
                        <section className="pt-2">
                            {!confirmDelete ? (
                                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 text-red-500/60 hover:text-red-500 text-xs font-bold transition-all px-1">
                                    <Trash2 className="w-4 h-4" /> სტუდენტის წაშლა
                                </button>
                            ) : (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 space-y-4 animate-in slide-in-from-top-4 duration-300 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-500" />
                                        <p className="text-sm font-black text-red-600">დარწმუნებული ხარ?</p>
                                    </div>
                                    <p className="text-[11px] text-red-600/70 font-medium">ყველა მონაცემი (აბონემენტები, დასწრება) წაიშლება შეუქცევადად.</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => { onDelete?.(student!.id); onClose(); }} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-xs font-black rounded-xl shadow-lg shadow-red-500/20 active:scale-95 transition-all">
                                            დიახ, წაშლა
                                        </button>
                                        <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 bg-card border border-border-subtle text-muted hover:text-primary text-xs font-bold rounded-xl transition-all">
                                            გაუქმება
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 py-5 border-t border-border-subtle flex-shrink-0 bg-card/80 backdrop-blur-md">
                    <button onClick={onClose} className="flex-1 py-3 border border-border-subtle hover:bg-surface text-muted hover:text-primary text-sm font-bold rounded-xl transition-all shadow-sm">
                        {t.cancel}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!form.first_name || !form.phone || saving}
                        className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:scale-100 text-white text-sm font-black rounded-xl shadow-lg shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-5 h-5" strokeWidth={3} />}
                        {saving ? t.loading : t.save}
                    </button>
                </div>
            </div>
        </>
    );
}

const inputCls = 'w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary font-medium placeholder:text-muted/30 outline-none transition-all shadow-sm';

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            {label && (
                <label className="flex items-center gap-2 text-xs font-bold text-muted opacity-70 px-1">
                    <span className="opacity-40">{icon}</span>
                    {label}
                </label>
            )}
            {children}
        </div>
    );
}
