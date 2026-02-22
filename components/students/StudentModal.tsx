'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, User, Phone, Mail, Calendar, FileText, Trash2, Check, Camera, QrCode, Download, RefreshCw, CreditCard, Wifi, WifiOff } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { cn, getInitials } from '@/lib/utils';
import { generateStudentCode, generateQRDataUrl } from '@/lib/qr';
import type { Student, OrgType } from '@/types';
import { registerUid, unregisterStudentUid, getStudentUid } from '@/lib/student-store';

interface StudentModalProps {
    open: boolean;
    student?: Student | null;
    orgType?: OrgType;
    groups?: { id: string; name: string }[];
    onClose: () => void;
    onSave: (data: Partial<Student>) => void;
    onDelete?: (id: string) => void;
}

const DANCE_STYLES = ['Contemporary', 'Ballet', 'Hip-Hop', 'Salsa', 'Bachata', 'Tango', 'Jazz', 'Modern'];

export function StudentModal({
    open, student, orgType = 'dance', groups = [], onClose, onSave, onDelete,
}: StudentModalProps) {
    const { t } = useT();
    const isEdit = !!student;
    const fileRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        full_name: '',
        phone: '',
        email: '',
        birth_date: '',
        notes: '',
        dance_style: '',
        partner_name: '',
        medical_cert_expires_at: '',
        photo_url: '',
        qr_code: '',
        nfc_uid: '',
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
            if (student) {
                // Load persisted UID from localStorage (overrides the student object which may be stale)
                const persistedUid = getStudentUid(student.id);
                setForm({
                    full_name: student.full_name ?? '',
                    phone: student.phone ?? '',
                    email: student.email ?? '',
                    birth_date: student.birth_date ?? '',
                    notes: student.notes ?? '',
                    dance_style: student.dance_style ?? '',
                    partner_name: student.partner_name ?? '',
                    medical_cert_expires_at: student.medical_cert_expires_at ?? '',
                    photo_url: student.photo_url ?? '',
                    qr_code: student.qr_code ?? generateStudentCode(),
                    nfc_uid: persistedUid || student.nfc_uid || '',
                });
                setPhotoPreview(student.photo_url ?? '');
            } else {
                const newCode = generateStudentCode();
                setForm({ full_name: '', phone: '', email: '', birth_date: '', notes: '', dance_style: '', partner_name: '', medical_cert_expires_at: '', photo_url: '', qr_code: newCode, nfc_uid: '' });
                setPhotoPreview('');
            }
            setConfirmDelete(false);
            setQrDataUrl('');
            setNfcScanning(false);
            setNfcError('');
        }
    }, [student, open]);

    // Generate QR whenever qr_code changes
    useEffect(() => {
        if (!form.qr_code) return;
        setQrLoading(true);
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        generateQRDataUrl(form.qr_code, origin).then(url => {
            setQrDataUrl(url);
            setQrLoading(false);
        });
    }, [form.qr_code]);

    function set(k: string, v: string) {
        setForm(p => ({ ...p, [k]: v }));
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!('NDEFReader' in window)) {
            setNfcError('NFC ხელმიუწვდომელია — Android Chrome საჭიროა');
            return;
        }
        setNfcScanning(true);
        setNfcError('');
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ndef = new (window as any).NDEFReader();
            nfcReaderRef.current = ndef;
            await ndef.scan();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        if (!form.full_name || !form.phone) return;
        setSaving(true);
        await new Promise(r => setTimeout(r, 400));

        // Persist UID to localStorage registry so it survives page refresh
        const studentId = student?.id ?? `new_${Date.now()}`;
        if (form.nfc_uid) {
            registerUid(form.nfc_uid, studentId, form.full_name);
        } else if (student?.id) {
            // If UID was cleared, unregister
            unregisterStudentUid(student.id);
        }

        onSave({ ...form });
        setSaving(false);
        onClose();
    }

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Slide-over panel */}
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col bg-[#13131a] border-l border-white/[0.08] shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08] flex-shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-white">
                            {isEdit ? t.edit + ' — ' + student!.full_name : t.addStudent}
                        </h2>
                        <p className="text-xs text-white/40 mt-0.5">
                            {isEdit ? 'ID: ' + student!.id.slice(0, 8) : 'ახალი სტუდენტის დამატება'}
                        </p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/[0.07] text-white/40 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                    {/* ─── Photo Upload ─── */}
                    <section className="space-y-3">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-1.5">
                            <Camera className="w-3 h-3" /> ფოტო
                        </p>
                        <div className="flex items-center gap-4">
                            {/* Preview */}
                            <button
                                onClick={() => fileRef.current?.click()}
                                className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-600/20 border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 flex items-center justify-center flex-shrink-0 overflow-hidden group transition-all"
                            >
                                {photoPreview ? (
                                    <>
                                        <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Camera className="w-5 h-5 text-white" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-1 text-indigo-400/60 group-hover:text-indigo-400 transition-colors">
                                        <Camera className="w-6 h-6" />
                                        <span className="text-[9px] font-bold">ფოტო</span>
                                    </div>
                                )}
                            </button>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-white/70">
                                    {form.full_name || 'სახელი...'}
                                </p>
                                <p className="text-xs text-white/30 mt-0.5">JPG, PNG · მაქს 5MB</p>
                                {photoPreview && (
                                    <button
                                        onClick={() => { setPhotoPreview(''); set('photo_url', ''); if (fileRef.current) fileRef.current.value = ''; }}
                                        className="text-[10px] text-red-400/70 hover:text-red-400 mt-1 transition-colors"
                                    >
                                        ფოტოს წაშლა
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* ─── Basic info ─── */}
                    <section className="space-y-3">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">ძირითადი ინფო</p>

                        <Field icon={<User className="w-4 h-4" />} label={t.studentName + ' *'}>
                            <input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="მაგ: ნინო ბერიძე" className={inputCls} />
                        </Field>

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

                    {/* ─── Group ─── */}
                    {groups.length > 0 && (
                        <section className="space-y-3">
                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{t.studentGroup}</p>
                            <div className="grid grid-cols-2 gap-2">
                                {groups.map(g => (
                                    <button key={g.id} className="px-3 py-2.5 text-xs font-medium rounded-xl border border-white/[0.08] text-white/60 hover:border-indigo-500/50 hover:text-indigo-300 hover:bg-indigo-500/[0.07] transition-all text-left truncate">
                                        {g.name}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ─── Dance style ─── */}
                    {orgType === 'dance' && (
                        <section className="space-y-3">
                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{t.danceStyle}</p>
                            <div className="grid grid-cols-3 gap-2">
                                {DANCE_STYLES.map(s => (
                                    <button key={s} onClick={() => set('dance_style', form.dance_style === s ? '' : s)}
                                        className={cn(
                                            'px-2 py-2 text-xs font-medium rounded-xl border transition-all',
                                            form.dance_style === s
                                                ? 'bg-violet-500/15 border-violet-500/40 text-violet-300'
                                                : 'border-white/[0.08] text-white/50 hover:border-white/[0.15]'
                                        )}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                            <Field icon={<User className="w-4 h-4" />} label={t.partner}>
                                <input value={form.partner_name} onChange={e => set('partner_name', e.target.value)} placeholder="პარტნიორის სახელი" className={inputCls} />
                            </Field>
                        </section>
                    )}

                    {/* ─── Sports niche ─── */}
                    {orgType === 'sports' && (
                        <section className="space-y-3">
                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{t.medicalCert}</p>
                            <Field icon={<Calendar className="w-4 h-4" />} label="ცნობის ვადა">
                                <input type="date" value={form.medical_cert_expires_at} onChange={e => set('medical_cert_expires_at', e.target.value)} className={inputCls} />
                            </Field>
                        </section>
                    )}

                    {/* ─── Notes ─── */}
                    <section className="space-y-2">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{t.notes}</p>
                        <Field icon={<FileText className="w-4 h-4" />} label="">
                            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="შენიშვნები..." rows={3} className={cn(inputCls, 'resize-none')} />
                        </Field>
                    </section>

                    {/* ─── QR Card ─── */}
                    <section className="space-y-3">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-1.5">
                            <QrCode className="w-3 h-3" /> სტუდენტის QR ბარათი
                        </p>
                        <div className="bg-[#0e0e18] border border-white/[0.07] rounded-2xl p-4">
                            {/* Card preview */}
                            <div className="bg-gradient-to-br from-indigo-600/20 to-violet-700/20 border border-indigo-500/20 rounded-xl p-4 flex items-center gap-4 mb-3">
                                {/* Photo or initials */}
                                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold">
                                    {photoPreview
                                        ? <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                                        : getInitials(form.full_name || '??')
                                    }
                                </div>
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{form.full_name || 'სტუდენტი'}</p>
                                    <p className="text-[10px] text-indigo-300/70 mt-0.5">{form.dance_style || 'StudioFlow'}</p>
                                    <p className="text-xs font-mono font-bold text-white/60 mt-1 tracking-widest">{form.qr_code}</p>
                                </div>
                                {/* QR */}
                                <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center bg-white/[0.05] rounded-lg overflow-hidden">
                                    {qrLoading ? (
                                        <div className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                                    ) : qrDataUrl ? (
                                        <img src={qrDataUrl} alt="QR" className="w-full h-full object-contain p-1" />
                                    ) : null}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button
                                    onClick={regenerateCode}
                                    className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] px-3 py-2 rounded-xl transition-all"
                                >
                                    <RefreshCw className="w-3 h-3" /> ახალი კოდი
                                </button>
                                <button
                                    onClick={downloadQR}
                                    disabled={!qrDataUrl}
                                    className="flex items-center gap-1.5 text-[11px] text-indigo-300/70 hover:text-indigo-300 bg-indigo-500/[0.08] hover:bg-indigo-500/[0.14] border border-indigo-500/20 px-3 py-2 rounded-xl transition-all disabled:opacity-30"
                                >
                                    <Download className="w-3 h-3" /> QR გადმოტვირთვა
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* ─── NFC Card ─── */}
                    <section className="space-y-3">
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-1.5">
                            <CreditCard className="w-3 h-3" /> NFC / RFID ბარათი
                        </p>
                        <div className="bg-[#0e0e18] border border-white/[0.07] rounded-2xl p-4 space-y-3">

                            {/* Registered UID */}
                            {form.nfc_uid ? (
                                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                                    <CreditCard className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                    <span className="text-xs font-mono font-bold text-emerald-300 flex-1 truncate">{form.nfc_uid}</span>
                                    <button
                                        onClick={() => set('nfc_uid', '')}
                                        className="text-white/30 hover:text-red-400 transition-colors text-[10px]"
                                    >✕</button>
                                </div>
                            ) : (
                                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-xs text-white/25 font-mono">
                                    UID არ არის მინიჭებული
                                </div>
                            )}

                            {/* Android NFC tap button */}
                            <button
                                onClick={startNFCScan}
                                disabled={nfcScanning}
                                className={cn(
                                    'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border transition-all',
                                    nfcScanning
                                        ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300 cursor-wait'
                                        : 'bg-indigo-500/[0.08] hover:bg-indigo-500/[0.14] border-indigo-500/20 text-indigo-300/80 hover:text-indigo-300'
                                )}
                            >
                                {nfcScanning
                                    ? <><Wifi className="w-3.5 h-3.5 animate-pulse" /> ბარათი მიათხოვე reader-ს...</>
                                    : <><CreditCard className="w-3.5 h-3.5" /> NFC ბარათი წაიკითხე (Android)</>
                                }
                            </button>

                            {/* Manual UID input (USB RFID scanner) */}
                            <div className="space-y-1">
                                <p className="text-[10px] text-white/25">ან UID ხელით / USB reader:</p>
                                <div className="flex gap-2">
                                    <input
                                        value={form.nfc_uid}
                                        onChange={e => set('nfc_uid', e.target.value.toUpperCase())}
                                        placeholder="04A32B1C"
                                        maxLength={32}
                                        className="flex-1 bg-[#1c1c26] border border-white/[0.08] focus:border-indigo-500/60 rounded-xl px-3 py-2 text-xs text-white/85 placeholder:text-white/20 outline-none transition-colors font-mono"
                                    />
                                    {form.nfc_uid && (
                                        <button
                                            onClick={() => set('nfc_uid', '')}
                                            className="px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.07] rounded-xl text-white/30 hover:text-red-400 transition-colors"
                                        >
                                            <WifiOff className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Error */}
                            {nfcError && (
                                <p className="text-[10px] text-red-400/70">{nfcError}</p>
                            )}

                            {/* Kiosk link */}
                            <a
                                href="/nfc-checkin"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-[10px] text-indigo-400/50 hover:text-indigo-400 transition-colors"
                            >
                                <Wifi className="w-3 h-3" /> NFC კიოსკი გახსნა ↗
                            </a>
                        </div>
                    </section>

                    {/* ─── Delete section ─── */}
                    {isEdit && (
                        <section className="pt-2 border-t border-white/[0.06]">
                            {!confirmDelete ? (
                                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 text-red-400/70 hover:text-red-400 text-xs font-medium transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" /> სტუდენტის წაშლა
                                </button>
                            ) : (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-3">
                                    <p className="text-sm font-semibold text-red-400">დარწმუნებული ხარ?</p>
                                    <p className="text-xs text-white/50">ეს ქმედება შეუქცევადია. ყველა მონაცემი წაიშლება.</p>
                                    <div className="flex gap-2">
                                        <button onClick={() => { onDelete?.(student!.id); onClose(); }} className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-colors">
                                            წაშლა
                                        </button>
                                        <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 bg-white/[0.06] text-white/60 hover:text-white text-xs font-medium rounded-xl transition-colors">
                                            {t.cancel}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 py-4 border-t border-white/[0.08] flex-shrink-0 bg-[#13131a]">
                    <button onClick={onClose} className="flex-1 py-3 border border-white/[0.10] text-white/60 hover:text-white hover:border-white/[0.18] text-sm font-medium rounded-xl transition-all">
                        {t.cancel}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!form.full_name || !form.phone || saving}
                        className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                    >
                        {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                        {saving ? t.loading : t.save}
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── Helpers ────────────────────────────────────────────────────
const inputCls = 'w-full bg-[#1c1c26] border border-white/[0.08] focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-white/85 placeholder:text-white/25 outline-none transition-colors';

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            {label && (
                <label className="flex items-center gap-1.5 text-xs font-medium text-white/45">
                    <span className="text-white/25">{icon}</span>
                    {label}
                </label>
            )}
            {children}
        </div>
    );
}
