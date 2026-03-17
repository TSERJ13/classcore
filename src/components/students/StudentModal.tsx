'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    X, User, Phone, Mail, Calendar, Trash2, Camera, Zap, QrCode, RefreshCw, Download, CreditCard,
    ShoppingBag, CalendarCheck, PlusCircle, MessageCircle, ChevronRight, ChevronLeft, Wifi, Link, Wallet,
    Check, Plus, AlertTriangle, FileText, Facebook, Instagram, Send
} from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useUser } from '@/hooks/useUser';
import { cn, getInitials, isExpiringSoon, formatCurrency } from '@/lib/utils';
import { generateStudentCode, generateQRDataUrl } from '@/lib/qr';
import { loadSettings } from '@/lib/settings-store';
import { Student } from '@/types';
import { registerUid, unregisterStudentUid, getStudentUid } from '@/lib/student-store';
import { getCustomStyles, addCustomStyle, removeCustomStyle } from '@/lib/style-store';
import { getStudentSales, type ShopSale } from '@/lib/sales-store';
import { getStudentCheckins, type CheckinRecord } from '@/lib/checkin-store';
import { useStudio } from '@/contexts/StudioContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { getGroups } from '@/lib/group-store';
import { IssueSubscriptionModal } from '@/components/subscriptions/IssueSubscriptionModal';
import { SearchSelect } from '@/components/ui/SearchSelect';

/* ─── Balance Card ───────────────────────────────────────────── */

function BalanceCard({ student }: { student: Student }) {
    const { t } = useT();
    const { user, profile } = useUser();
    const { settings } = useStudio();
    const isTeacher = profile?.role === 'teacher';
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [adjustment, setAdjustment] = useState<number | ''>('');
    const [currentBalance, setCurrentBalance] = useState(student.balance ?? 0);

    // Sync with student prop when it changes (e.g. after a sub is issued)
    useEffect(() => {
        setCurrentBalance(student.balance ?? 0);
    }, [student.balance]);

    const handleAdjust = async () => {
        if (adjustment === '') return;
        const newBal = Math.round((currentBalance + adjustment) * 100) / 100;

        // Dynamically import updateStudent to match project patterns
        const { updateStudent } = await import('@/lib/student-store');
        updateStudent(student.id, { balance: newBal });

        setCurrentBalance(newBal);
        setIsAdjusting(false);
        setAdjustment('');

        // Dispatch event so other parts of UI (like the table) refresh
        window.dispatchEvent(new Event('cc_student_update'));
    };

    return (
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-5 space-y-4 mb-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40">{t.clientBalance}</p>
                        <p className="text-xl font-black text-primary tabular-nums">{formatCurrency(currentBalance, settings.currency)}</p>
                    </div>
                </div>
                {!isAdjusting && !isTeacher && (
                    <button
                        onClick={() => setIsAdjusting(true)}
                        className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                        {t.adjust}
                    </button>
                )}
            </div>

            {isAdjusting && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <input
                        type="number"
                        value={adjustment}
                        onChange={e => setAdjustment(parseFloat(e.target.value) || '')}
                        placeholder="+ /- 0.00"
                        className="flex-1 bg-surface border border-emerald-500/20 rounded-xl px-4 py-2 text-sm font-bold text-primary outline-none focus:border-emerald-500/40"
                    />
                    <button
                        onClick={handleAdjust}
                        disabled={adjustment === ''}
                        className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-50"
                    >
                        <Check className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { setIsAdjusting(false); setAdjustment(''); }}
                        className="p-2 bg-surface border border-border-subtle text-muted rounded-xl hover:text-primary transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5 min-w-0">
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

function SubscriptionCard({ student }: { student: Student }) {
    const { t } = useT();
    const { user, profile } = useUser();
    const confirm = useConfirm();
    const { settings } = useStudio();
    const isTeacher = profile?.role === 'teacher';
    const [subs, setSubs] = useState<any[]>([]);

    const refresh = useCallback(() => {
        import('@/lib/subscription-store').then(mod => {
            const all = mod.getStudentSubscriptions(student.id);
            const active = all.filter(s => {
                const today = new Date().toISOString().split('T')[0];
                const notExpired = s.expires_at >= today;
                const hasVisits = s.type === 'monthly' || (s.sessions_total === null || s.sessions_used < s.sessions_total);
                return s.status === 'active' && notExpired && hasVisits;
            });
            setSubs(active);
        });
    }, [student.id]);

    useEffect(() => {
        refresh();
        window.addEventListener('cc_subscription_update', refresh);
        return () => window.removeEventListener('cc_subscription_update', refresh);
    }, [refresh]);

    if (subs.length === 0) return null;

    return (
        <div className="space-y-3 mb-6">
            {subs.map(sub => {
                const expiresAt = new Date(sub.expires_at);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffTime = expiresAt.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                const isSessions = sub.type === 'sessions';
                const sessionsLeft = isSessions ? (sub.sessions_total - (sub.sessions_used || 0)) : null;
                const isExpiring = diffDays <= 7;
                const isLowVisits = isSessions && sessionsLeft !== null && sessionsLeft <= 2;
                const isDefault = sub.is_default;

                return (
                    <div key={sub.id} className={cn(
                        "border rounded-3xl p-5 space-y-3 transition-all relative overflow-hidden",
                        isDefault ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-card" : "",
                        (isExpiring || isLowVisits) ? "bg-amber-500/5 border-amber-500/20" : "bg-indigo-500/5 border-indigo-500/10"
                    )}>
                        {isDefault && (
                            <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg uppercase tracking-tighter">
                                {t.default || 'Default'}
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-10 h-10 rounded-2xl flex items-center justify-center",
                                    (isExpiring || isLowVisits) ? "bg-amber-500/10 text-amber-500" : "bg-indigo-500/10 text-indigo-500"
                                )}>
                                    <Zap className="w-5 h-5 fill-current opacity-20" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40">{t.activeSubscriptions}</p>
                                    <p className="text-sm font-black text-primary truncate max-w-[140px] sm:max-w-[180px]">{sub.plan}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40">{t.remaining}</p>
                                <p className={cn("text-lg font-black tabular-nums", (isExpiring || isLowVisits) ? "text-amber-500" : "text-indigo-500")}>
                                    {isSessions ? `${sessionsLeft} ${t.visits}` : `${diffDays} ${t.day}`}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 pt-1 border-t border-black/5">
                            <div className="flex-1">
                                <p className="text-[8px] font-black text-muted uppercase tracking-widest opacity-40 mb-1">{t.expiryDate}</p>
                                <p className="text-[10px] font-bold text-primary opacity-60">{sub.expires_at}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {!isDefault && (
                                    <button
                                        onClick={async () => {
                                            const mod = await import('@/lib/subscription-store');
                                            mod.setDefaultSubscription(student.id, sub.id);
                                        }}
                                        className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all"
                                        title={t.setAsDefault || "Set as Default"}
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {!isTeacher && (
                                    <button
                                        onClick={async () => {
                                            if (await confirm(t.deleteSubConfirm)) {
                                                const mod = await import('@/lib/subscription-store');
                                                mod.deleteSubscription(student.id, sub.id);
                                            }
                                        }}
                                        className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                                        title={t.delete}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

interface StudentModalProps {
    open: boolean;
    student?: Student | null;
    onClose: () => void;
    onSave: (data: Partial<Student>) => void;
    onDelete?: (id: string) => void;
    centered?: boolean;
}

export function StudentModal({
    open, student, onClose, onSave, onDelete, centered = false
}: StudentModalProps) {
    const { t } = useT();
    const { user, profile } = useUser();
    const { settings } = useStudio();
    const confirm = useConfirm();
    const isEdit = !!student;
    const isTeacher = profile?.role === 'teacher';
    const fileRef = useRef<HTMLInputElement>(null);

    const availableGroups = getGroups();
    const [availableStyles, setAvailableStyles] = useState<string[]>([]);
    const [newStyleInput, setNewStyleInput] = useState('');

    const [form, setForm] = useState({
        id: '',
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
        },
        enrolled_group_ids: [] as string[],
        preferred_language: 'ka' as 'ka' | 'ru' | 'en'
    });

    const [confirmDelete, setConfirmDelete] = useState(false);
    const [saving, setSaving] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [qrLoading, setQrLoading] = useState(false);
    const [photoPreview, setPhotoPreview] = useState('');
    const [nfcScanning, setNfcScanning] = useState(false);
    const [nfcError, setNfcError] = useState('');
    const [activeTab, setActiveTab] = useState<'info' | 'sales' | 'visits'>('info');
    const [sales, setSales] = useState<ShopSale[]>([]);
    const [visits, setVisits] = useState<CheckinRecord[]>([]);
    const [issueModalOpen, setIssueModalOpen] = useState(false);
    const [showCopyToast, setShowCopyToast] = useState(false);
    const nfcReaderRef = useRef<HTMLDivElement | null>(null);
    const rfidBuffer = useRef('');
    const rfidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                    id: student.id,
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
                    passport_url: (student as { passport_url?: string }).passport_url ?? '',
                    passport_expires_at: (student as { passport_expires_at?: string }).passport_expires_at ?? '',
                    social_links: {
                        facebook: student.social_links?.facebook ?? '',
                        instagram: student.social_links?.instagram ?? '',
                        telegram: student.social_links?.telegram ?? '',
                        whatsapp: student.social_links?.whatsapp ?? '',
                    },
                    enrolled_group_ids: student.enrolled_group_ids ?? [],
                    preferred_language: student.preferred_language ?? 'ka'
                });
                setPhotoPreview(student.photo_url ?? '');
            } else {
                const newCode = generateStudentCode();
                setForm({
                    id: '', first_name: '', last_name: '', phone: '', email: '', birth_date: '', notes: '', dance_style: '',
                    medical_cert_expires_at: '', photo_url: '', qr_code: newCode, nfc_uid: '', passport_url: '', passport_expires_at: '',
                    social_links: { facebook: '', instagram: '', telegram: '', whatsapp: '' },
                    enrolled_group_ids: [],
                    preferred_language: 'ka'
                });
                setPhotoPreview('');
            }
            setConfirmDelete(false);
            setQrDataUrl('');
            setNfcScanning(false);
            setNfcError('');
            setActiveTab('info');
            if (student) {
                setSales(getStudentSales(student.id));
                setVisits(getStudentCheckins(student.id));
            }
        }
    }, [student, open]);

    useEffect(() => {
        if (!form.id) return;
        setQrLoading(true);
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const studioSlug = settings.studioSlug || 'studio';
        const portalUrl = `${origin}/${studioSlug}/${form.id}`;
        generateQRDataUrl(portalUrl).then(url => {
            setQrDataUrl(url);
            setQrLoading(false);
        });
    }, [form.id]);

    function handleIdGeneration() {
        if (!form.first_name && !form.last_name) return;
        import('@/lib/student-store').then(({ generateFormattedStudentId }) => {
            const newId = generateFormattedStudentId(form.first_name, form.last_name);
            set('id', newId);
        });
    }

    function set(k: string, v: unknown) {
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
        const newStyle = newStyleInput.trim();
        addCustomStyle(newStyle);
        setAvailableStyles(getCustomStyles());

        const currentStyles = (form.dance_style || '').split(',').map(x => x.trim()).filter(Boolean);
        if (!currentStyles.includes(newStyle)) {
            set('dance_style', [...currentStyles, newStyle].join(', '));
        }
        setNewStyleInput('');
    }

    function handleRemoveStyle(s: string) {
        removeCustomStyle(s);
        setAvailableStyles(getCustomStyles());

        const currentStyles = (form.dance_style || '').split(',').map(x => x.trim()).filter(Boolean);
        if (currentStyles.includes(s)) {
            set('dance_style', currentStyles.filter(x => x !== s).join(', '));
        }
    }

    function toggleStyle(s: string) {
        const currentStyles = (form.dance_style || '').split(',').map(x => x.trim()).filter(Boolean);
        if (currentStyles.includes(s)) {
            set('dance_style', currentStyles.filter(x => x !== s).join(', '));
        } else {
            set('dance_style', [...currentStyles, s].join(', '));
        }
    }

    function regenerateCode() {
        set('qr_code', generateStudentCode());
    }

    function downloadQR() {
        if (!qrDataUrl) return;
        const a = document.createElement('a');
        a.href = qrDataUrl;
        a.download = `ID-card-${form.qr_code}.png`;
        a.click();
    }

    // USB RFID Reader Listener (Keyboard simulation)
    useEffect(() => {
        if (!open) return;

        const onKeyDown = (e: KeyboardEvent) => {
            const active = document.activeElement as HTMLElement | null;
            const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
            const isManualNfc = active?.getAttribute('data-rfid-input') === 'true';

            if (isInput && !isManualNfc) return;

            if (e.key === 'Enter') {
                const val = rfidBuffer.current.trim();
                rfidBuffer.current = '';
                if (rfidTimer.current) { clearTimeout(rfidTimer.current); rfidTimer.current = null; }

                if (val && val.length >= 4) {
                    const normalized = val.replace(/[:\-\s]/g, '').toUpperCase();
                    setForm(p => ({ ...p, nfc_uid: normalized }));
                    const el = document.getElementById('nfc-indicator');
                    if (el) {
                        el.classList.add('bg-emerald-500', 'text-white', 'scale-110');
                        setTimeout(() => el.classList.remove('bg-emerald-500', 'text-white', 'scale-110'), 1000);
                    }
                }
                return;
            }

            if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                rfidBuffer.current += e.key;
                if (rfidTimer.current) clearTimeout(rfidTimer.current);
                rfidTimer.current = setTimeout(() => {
                    rfidBuffer.current = '';
                }, 150);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open]);

    const startNFCScan = useCallback(async () => {
        if (!('NDEFReader' in window)) {
            setNfcError(t.nfcNotAvailable);
            return;
        }
        setNfcScanning(true);
        setNfcError('');
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ndef = new (window as unknown as { NDEFReader: any }).NDEFReader();
            nfcReaderRef.current = ndef;
            await ndef.scan();
            ndef.addEventListener('reading', ({ serialNumber }: { serialNumber: string }) => {
                const uid = (serialNumber || '').replace(/[:\-\s]/g, '').toUpperCase();
                set('nfc_uid', uid);
                setNfcScanning(false);
            }, { once: true });
        } catch {
            setNfcError(t.nfcScanError);
            setNfcScanning(false);
        }
    }, [t.nfcNotAvailable, t.nfcScanError]);

    async function handleSave() {
        if (!form.first_name || !form.phone) return;
        setSaving(true);
        await new Promise(r => setTimeout(r, 400));

        const fullName = `${form.first_name} ${form.last_name}`.trim();
        const finalId = form.id.trim() || student?.id || `new_${Date.now()}`;

        if (form.nfc_uid) {
            registerUid(form.nfc_uid, finalId, fullName);
        } else if (student?.id) {
            unregisterStudentUid(student.id);
        }

        // If ID changed, we might need to handle it, but let onSave handle the bulk
        onSave({
            ...form,
            id: finalId,
            full_name: fullName
        });

        setSaving(false);
        onClose();
    }

    if (!open) return null;

    const passportExpiring = form.passport_expires_at ? isExpiringSoon(form.passport_expires_at, 30) : false;
    const passportExpired = form.passport_expires_at ? new Date(form.passport_expires_at) < new Date() : false;

    const inputCls = 'w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary font-medium placeholder:text-muted/30 outline-none transition-all shadow-sm';


    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className={cn(
                "fixed z-50 flex flex-col bg-card border-border-subtle shadow-2xl duration-300 overflow-hidden",
                centered
                    ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] sm:w-[min(100vw,640px)] max-h-[92dvh] border animate-in fade-in zoom-in-95 rounded-[2rem]"
                    : "inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-[min(100vw,420px)] max-h-[92dvh] sm:max-h-none sm:border-l border-t sm:border-t-0 animate-in slide-in-from-bottom sm:slide-in-from-right rounded-t-3xl sm:rounded-none"
            )}>
                {/* Handle for mobile */}
                <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing">
                    <div className="w-10 h-1.5 rounded-full bg-border-subtle opacity-60" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle flex-shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-primary">
                            {isEdit ? t.edit + ' — ' + form.first_name + ' ' + form.last_name : t.addStudent}
                        </h2>
                        <p className="text-xs text-muted mt-0.5 font-medium opacity-70">
                            {isEdit ? 'ID: ' + (student?.id || '—') : t.addStudentShort}
                        </p>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-primary transition-all active:scale-95">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                {isEdit && (
                    <div className="flex px-5 py-2 border-b border-border-subtle bg-surface/30 gap-2 flex-shrink-0 items-center overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setActiveTab('info')}
                            className={cn(
                                "h-9 px-4 flex items-center justify-center text-[10px] font-black uppercase tracking-widest transition-all rounded-xl border shrink-0",
                                activeTab === 'info'
                                    ? "bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/20"
                                    : "bg-indigo-500/10 text-indigo-400 hover:text-indigo-300 border-indigo-500/20"
                            )}
                        >
                            {t.info}
                        </button>

                        <div className="w-[1px] h-4 bg-border-subtle/30 mx-0.5 shrink-0" />

                        <button
                            onClick={() => setIssueModalOpen(true)}
                            title={t.issueSubscription}
                            className="w-9 h-9 flex items-center justify-center bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 transition-all rounded-xl shadow-sm active:scale-95 shrink-0"
                        >
                            <PlusCircle className="w-5 h-5" strokeWidth={2.5} />
                        </button>

                        <button
                            onClick={() => setActiveTab('visits')}
                            title={t.visits}
                            className={cn(
                                "w-9 h-9 flex items-center justify-center border transition-all rounded-xl shrink-0",
                                activeTab === 'visits'
                                    ? "bg-violet-500 text-white border-violet-500 shadow-lg shadow-violet-500/20"
                                    : "bg-violet-500/10 text-violet-400 hover:text-violet-300 border-violet-500/20"
                            )}
                        >
                            <CalendarCheck className="w-4 h-4" strokeWidth={2.5} />
                        </button>

                        <button
                            onClick={() => setActiveTab('sales')}
                            title={t.purchases}
                            className={cn(
                                "w-9 h-9 flex items-center justify-center border transition-all rounded-xl shrink-0",
                                activeTab === 'sales'
                                    ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20"
                                    : "bg-amber-500/10 text-amber-400 hover:text-amber-300 border-amber-500/20"
                            )}
                        >
                            <ShoppingBag className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 overscroll-contain">
                    {activeTab === 'info' ? (
                        <>
                            {/* Photo Upload */}
                            <section className="space-y-4">
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 flex items-center gap-2">
                                    <Camera className="w-3.5 h-3.5" /> {t.photo}
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
                                                <span className="text-[10px] font-black">{t.upload}</span>
                                            </div>
                                        )}
                                    </button>
                                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                                    <div className="min-w-0">
                                        <p className="text-base font-black text-primary truncate">
                                            {form.first_name || form.last_name ? `${form.first_name} ${form.last_name}` : '...'}
                                        </p>
                                        <p className="text-xs text-muted font-medium opacity-60">{t.maxFileSize}</p>
                                        {photoPreview && (
                                            <button
                                                onClick={() => { setPhotoPreview(''); set('photo_url', ''); if (fileRef.current) fileRef.current.value = ''; }}
                                                className="text-[11px] font-bold text-red-500/70 hover:text-red-500 mt-2 transition-colors flex items-center gap-1"
                                            >
                                                <Trash2 className="w-3 h-3" /> {t.deletePhoto}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* Balance Card */}
                            {student && (
                                <section>
                                    <BalanceCard student={student} />
                                </section>
                            )}

                            {/* Basic info */}
                            <section className="space-y-4">
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40">{t.basicInfo}</p>
                                <div className="space-y-4">
                                    <Field icon={<Zap className="w-4 h-4" />} label="STUDENT ID">
                                        <div className="flex gap-2">
                                            <input
                                                value={form.id}
                                                onChange={e => set('id', e.target.value)}
                                                placeholder="e.g. AE00001"
                                                className={cn(inputCls, "font-mono tracking-widest")}
                                            />
                                            {!form.id && (
                                                <button
                                                    onClick={handleIdGeneration}
                                                    className="px-4 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white border border-indigo-500/20 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0"
                                                >
                                                    GENERATE
                                                </button>
                                            )}
                                        </div>
                                    </Field>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Field icon={<User className="w-4 h-4" />} label={t.firstName + " *"}>
                                            <input value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder={t.firstNamePlaceholder} className={inputCls} />
                                        </Field>
                                        <Field icon={<User className="w-4 h-4" />} label={t.lastName}>
                                            <input value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder={t.lastNamePlaceholder} className={inputCls} />
                                        </Field>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field icon={<Phone className="w-4 h-4" />} label={t.studentPhone + ' *'}>
                                        <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="555 XX XX XX" className={inputCls} />
                                    </Field>
                                    <Field icon={<Mail className="w-4 h-4" />} label={t.email}>
                                        <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@gmail.com" className={inputCls} />
                                    </Field>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field icon={<Calendar className="w-4 h-4" />} label={t.birthDate}>
                                        <input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} className={inputCls} />
                                    </Field>
                                    <Field icon={<MessageCircle className="w-4 h-4" />} label={t.preferredLanguage}>
                                        <SearchSelect
                                            options={[
                                                { value: 'ka', label: t.georgian as string },
                                                { value: 'ru', label: t.russian as string },
                                                { value: 'en', label: t.english as string }
                                            ]}
                                            value={form.preferred_language || 'ka'}
                                            onChange={val => set('preferred_language', val)}
                                        />
                                    </Field>
                                </div>
                            </section>

                            {/* Social Links */}
                            <section className="space-y-4">
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 flex items-center gap-2">
                                    {t.socialNetworks}
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
                                    <FileText className="w-3.5 h-3.5" /> {t.documents}
                                </p>
                                <div className={cn(
                                    "bg-surface border rounded-2xl p-4 space-y-4 shadow-inner transition-colors",
                                    passportExpired ? "border-red-500/30 bg-red-500/5" : passportExpiring ? "border-amber-500/30 bg-amber-500/5" : "border-border-subtle"
                                )}>
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-bold text-muted px-1 uppercase tracking-wider opacity-60">{t.passportCopy}</label>
                                        {form.passport_url && (
                                            <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">{t.uploaded}</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'application/pdf,image/*';
                                            input.onchange = (e: Event) => {
                                                const file = (e.target as HTMLInputElement).files?.[0];
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
                                        <Download className="w-3.5 h-3.5 opacity-60" /> {form.passport_url ? t.change : t.uploadHint}
                                    </button>
                                    <Field icon={<Calendar className="w-4 h-4" />} label={t.passportExpiry}>
                                        <div className="space-y-2">
                                            <input type="date" value={form.passport_expires_at} onChange={e => set('passport_expires_at', e.target.value)} className={inputCls} />
                                            {passportExpired && (
                                                <p className="text-[10px] font-black text-red-500 flex items-center gap-1.5 px-1 animate-pulse">
                                                    <AlertTriangle className="w-3 h-3" /> {t.expired}
                                                </p>
                                            )}
                                            {!passportExpired && passportExpiring && (
                                                <p className="text-[10px] font-black text-amber-600 flex items-center gap-1.5 px-1">
                                                    <AlertTriangle className="w-3 h-3" /> {t.expiringSoon}
                                                </p>
                                            )}
                                        </div>
                                    </Field>
                                </div>
                            </section>

                            {/* Enrolled Groups */}
                            <section className="space-y-4">
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 flex items-center justify-between">
                                    <span>{t.enrolledGroups}</span>
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {availableGroups.length === 0 && <span className="text-[11px] font-bold text-muted">{t.noGroupsFound}</span>}
                                    {availableGroups.map(g => {
                                        const enrolled = form.enrolled_group_ids || [];
                                        const isSelected = enrolled.includes(g.id);
                                        return (
                                            <button key={g.id} onClick={() => {
                                                if (isSelected) {
                                                    set('enrolled_group_ids', enrolled.filter(id => id !== g.id));
                                                } else {
                                                    set('enrolled_group_ids', [...enrolled, g.id]);
                                                }
                                            }}
                                                className={cn(
                                                    'px-3 py-2 text-[11px] font-bold rounded-xl border transition-all shadow-sm',
                                                    isSelected
                                                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 scale-105'
                                                        : 'bg-surface border-border-subtle text-muted hover:text-primary'
                                                )}>
                                                {g.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            </section>

                            {/* Dynamic Styles / Categories */}
                            <section className="space-y-4">
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 flex items-center justify-between">
                                    <span>{t.categories}</span>
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {availableStyles.map(s => {
                                        const currentStyles = (form.dance_style || '').split(',').map(x => x.trim()).filter(Boolean);
                                        const isSelected = currentStyles.includes(s);
                                        return (
                                            <div key={s} className="relative group">
                                                <button onClick={() => toggleStyle(s)}
                                                    className={cn(
                                                        'px-3 py-2 text-[11px] font-bold rounded-xl border transition-all shadow-sm pr-7',
                                                        isSelected
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
                                        )
                                    })}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        value={newStyleInput}
                                        onChange={e => setNewStyleInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddStyle()}
                                        placeholder={t.newStylePlaceholder}
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
                                    <QrCode className="w-3.5 h-3.5" /> {t.studentPortalLink}
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
                                            <p className="text-sm font-black text-primary truncate leading-tight">{(form.first_name || form.last_name) ? `${form.first_name} ${form.last_name}` : t.studentLabel}</p>
                                            <p className="text-[11px] text-indigo-600 font-bold mt-0.5 opacity-80 leading-tight">
                                                {form.dance_style
                                                    ? form.dance_style.split(',').map(s => s.trim()).filter(Boolean).join(' • ')
                                                    : t.noStyleSet}
                                            </p>
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
                                    <div className="flex gap-2 mb-3">
                                        <div className="flex-1 bg-surface border border-border-subtle rounded-xl px-3 py-2 flex items-center justify-between gap-2 group/link cursor-pointer hover:border-indigo-500/30 transition-all overflow-hidden"
                                            onClick={() => {
                                                const origin = window.location.origin;
                                                const studioSlug = settings.studioSlug || 'studio';
                                                const url = `${origin}/${studioSlug}/${form.id}`;
                                                navigator.clipboard.writeText(url);
                                                setShowCopyToast(true);
                                                setTimeout(() => setShowCopyToast(false), 1500);
                                            }}>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[8px] font-black text-muted uppercase tracking-widest opacity-40 leading-none mb-1">PORTAL LINK</span>
                                                <span className="text-[10px] font-bold text-indigo-600 truncate opacity-70 group-hover/link:opacity-100 transition-opacity">
                                                    {(() => {
                                                        if (typeof window === 'undefined') return '';
                                                        const studioSlug = settings.studioSlug || 'studio';
                                                        return `${window.location.host}/${studioSlug}/${form.id}`;
                                                    })()}
                                                </span>
                                            </div>
                                            {showCopyToast ? (
                                                <span className="text-[9px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0 animate-in zoom-in duration-200">
                                                    COPIED!
                                                </span>
                                            ) : (
                                                <Link className="w-3.5 h-3.5 text-muted group-hover/link:text-indigo-500 transition-colors shrink-0" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={regenerateCode} className="flex-1 flex items-center justify-center gap-2 text-[11px] font-bold text-muted hover:text-primary bg-card/40 hover:bg-card border border-border-subtle/50 py-2.5 rounded-xl transition-all">
                                            <RefreshCw className="w-3.5 h-3.5" /> {t.new}
                                        </button>
                                        <button onClick={downloadQR} disabled={!qrDataUrl} className="flex-1 flex items-center justify-center gap-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 py-2.5 rounded-xl transition-all disabled:opacity-30">
                                            <Download className="w-3.5 h-3.5" /> {t.download}
                                        </button>
                                    </div>
                                </div>
                            </section>

                            {/* NFC Card */}
                            <section className="space-y-4">
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 flex items-center justify-between">
                                    <span className="flex items-center gap-2"><CreditCard className="w-3.5 h-3.5" /> {t.nfcCard}</span>
                                    <span id="nfc-indicator" className="text-[8px] font-black px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 transition-all duration-300">
                                        {t.waitingForScan || 'READY TO SCAN'}
                                    </span>
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
                                            {t.noCardAssigned}
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
                                            ? <><Wifi className="w-4 h-4 animate-pulse" /> {t.scanNfcStatus}</>
                                            : <><Wifi className="w-4 h-4" /> {t.scanNfcAction}</>
                                        }
                                    </button>
                                    <div className="space-y-2">
                                        <p className="text-[10px] text-muted font-bold opacity-40 px-1 uppercase tracking-widest">{t.manualInput}</p>
                                        <input
                                            value={form.nfc_uid}
                                            data-rfid-input="true"
                                            onChange={e => set('nfc_uid', e.target.value.toUpperCase())}
                                            placeholder="04A32B1C"
                                            className="w-full bg-card border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-xs text-primary font-mono font-black placeholder:text-muted/20 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                    {nfcError && <p className="text-[10px] text-red-500 font-bold text-center px-1 animate-pulse">{nfcError}</p>}
                                </div>
                            </section>

                            {/* Delete section */}
                            {isEdit && !isTeacher && (
                                <section className="pt-2">
                                    {!confirmDelete ? (
                                        <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 text-red-500/60 hover:text-red-500 text-xs font-bold transition-all px-1">
                                            <Trash2 className="w-4 h-4" /> {t.deleteStudent}
                                        </button>
                                    ) : (
                                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 space-y-4 animate-in slide-in-from-top-4 duration-300 shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <AlertTriangle className="w-5 h-5 text-red-500" />
                                                <p className="text-sm font-black text-red-600">{t.confirmDelete}</p>
                                            </div>
                                            <p className="text-[11px] text-red-600/70 font-medium">{t.deleteWarning}</p>
                                            <div className="flex gap-2">
                                                <button onClick={() => { onDelete?.(student!.id); onClose(); }} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-xs font-black rounded-xl shadow-lg shadow-red-500/20 active:scale-95 transition-all">
                                                    {t.yesDelete}
                                                </button>
                                                <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 bg-card border border-border-subtle text-muted hover:text-primary text-xs font-bold rounded-xl transition-all">
                                                    {t.cancel}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}
                        </>
                    ) : activeTab === 'sales' ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 flex items-center gap-2">
                                <ShoppingBag className="w-4 h-4" /> {t.purchaseHistory}
                            </p>
                            {sales.length > 0 ? (
                                <div className="space-y-3">
                                    {sales.map(sale => (
                                        <div key={sale.id} className="bg-surface border border-border-subtle rounded-2xl p-4 flex items-center justify-between group hover:shadow-lg transition-all">
                                            <div>
                                                <p className="text-sm font-black text-primary">{sale.productName}</p>
                                                <p className="text-[10px] text-muted font-bold opacity-60">{sale.date} · {sale.quantity} {t.unitPcs}</p>
                                            </div>
                                            <p className="text-sm font-black text-emerald-500 tabular-nums">{formatCurrency(sale.price, settings.currency)}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-20 text-center text-muted/30">
                                    <ShoppingBag className="w-10 h-10 mx-auto mb-4 opacity-10" />
                                    <p className="text-xs font-bold">{t.noPurchases}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest opacity-40 flex items-center gap-2">
                                <Zap className="w-4 h-4" /> {t.recentVisits}
                            </p>
                            {visits.length > 0 ? (
                                <div className="space-y-3">
                                    {visits.map((visit, i) => (
                                        <div key={i} className="bg-surface border border-border-subtle rounded-2xl p-4 flex items-center justify-between group hover:shadow-lg transition-all">
                                            <div>
                                                <p className="text-sm font-black text-primary">{visit.date}</p>
                                                <p className="text-[10px] text-muted font-bold opacity-60">{visit.time} · {visit.via.toUpperCase()}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {!isTeacher && (
                                                    <button
                                                        onClick={async () => {
                                                            if (await confirm(t.deleteVisitConfirm)) {
                                                                import('@/lib/checkin-store').then(m => {
                                                                    m.refundCheckin(visit.studentId);
                                                                    setVisits(m.getStudentCheckins(student!.id));
                                                                });
                                                            }
                                                        }}
                                                        className="p-2 text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                                    <Check className="w-4 h-4 text-emerald-500" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-20 text-center text-muted/30">
                                    <Zap className="w-10 h-10 mx-auto mb-4 opacity-10" />
                                    <p className="text-xs font-bold">{t.noVisits}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-5 py-4 border-t border-border-subtle flex-shrink-0 bg-card/80 backdrop-blur-md">
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

            {student && (
                <IssueSubscriptionModal
                    open={issueModalOpen}
                    onClose={() => setIssueModalOpen(false)}
                    initialStudentId={student.id}
                    onIssue={(data) => {
                        import('@/lib/subscription-store').then(mod => {
                            mod.saveSubscription(data.student_id, {
                                ...data,
                                id: `sub_${Date.now()}`
                            } as any);
                            setIssueModalOpen(false);
                            // Refresh sales/visits if needed
                            setSales(getStudentSales(student.id));
                        });
                    }}
                />
            )}
        </>
    );
}
