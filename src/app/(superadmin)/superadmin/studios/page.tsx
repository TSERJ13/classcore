'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { Building2, Power, Search, ChevronDown, ArrowUpRight, LogIn, Trash2, Edit3, Settings, AlertTriangle, Plus, Minus, Wallet, Zap, Smartphone, X, ShieldCheck, RefreshCcw, ShieldAlert, RotateCcw, Eraser } from 'lucide-react';
import { getBillingState, updateBillingState, recordPayment, getSaasReminderSms, extendSubscriptionByDays } from '@/lib/saas-billing';
import { logAction } from '@/lib/analytics';
import { getStudioRegistry, loadSettings, saveSettings, resetStudioData, migrateSlugData, clearAllStudioData, removeFromRegistry, type ResetCategories } from '@/lib/settings-store';
import { getScopedKey, cn, compactSlugify } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { pushStudioStateToCloud, masterStudioPurge } from '@/lib/sync-store';
import { syncGlobalAdminRegistry } from '@/lib/admin-sync';


interface StudioRecord {
    slug: string; name: string; logoUrl: string | null;
    studentCount: number; subsCount: number; suspended: boolean;
    isDeleted: boolean; // Flag for Recycle Bin
    notes: string; plan: 'trial' | 'pro' | 'custom';
    nextDue: string | null; status: string; daysOverdue: number;
    ownerPhone: string; ownerEmail: string; ownerName?: string;
    isCloudOnly?: boolean;
    isLocalOnly?: boolean;
    updatedAt?: string | null;
}

interface AuditUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    studioName: string;
    requestedSlug: string;
    createdAt: string;
    confirmedAt: string | null;
    isConfirmed: boolean;
    hasStudioRow: boolean;
    isStale: boolean;
    lastSignIn: string | null;
}


function loadStudio(slug: string): StudioRecord {
    const s = loadSettings(slug);
    const meta = (() => { 
        try { 
            const raw = localStorage.getItem(`cc_sa_meta_${slug}`);
            return raw ? JSON.parse(raw) : {}; 
        } catch { return {}; } 
    })();
    const billing = getBillingState(slug);
    
    let studentCount = 0;
    try { 
        const key = getScopedKey('cc_student_data', slug);
        const raw = localStorage.getItem(key);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') studentCount = Object.keys(parsed).length;
        }
    } catch { }

    let subsCount = 0;
    try { 
        const key = getScopedKey('cc_student_subscriptions', slug);
        const raw = localStorage.getItem(key);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                Object.values(parsed).forEach((subs: any) => { 
                    if (Array.isArray(subs)) subsCount += subs.filter((s: any) => s && s.status === 'active').length; 
                });
            }
        }
    } catch { }
    
    const staffList = Array.isArray(s?.staff) ? s.staff : [];
    const owner = staffList.find((m: any) => m && m.role === 'owner');
    
    return { 
        slug, name: s.studioName, logoUrl: s.logoDataUrl, studentCount, subsCount, 
        suspended: meta.suspended || false, 
        isDeleted: meta.deleted || false, 
        notes: meta.notes || '', plan: meta.plan || 'trial',
        nextDue: billing.nextDueDate, status: billing.status, daysOverdue: billing.daysOverdue,
        ownerPhone: owner?.phone || 'N/A',
        ownerEmail: owner?.email || 'N/A',
        updatedAt: s.updatedAt || null
    };
}

function saveMeta(slug: string, patch: object) {
    try { 
        const existing = JSON.parse(localStorage.getItem(`cc_sa_meta_${slug}`) || '{}'); 
        localStorage.setItem(`cc_sa_meta_${slug}`, JSON.stringify({ ...existing, ...patch }));
        window.dispatchEvent(new Event('cc_sa_meta_update'));
    } catch { }
}

const PLAN_COLORS: Record<string, string> = { 
    trial: 'bg-zinc-500/10 text-zinc-500 dark:bg-zinc-700/50 dark:text-zinc-300', 
    pro: 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border-indigo-600', 
    custom: 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 border-amber-500' 
};
const PLAN_LABELS_KEYS: Record<string, string> = {
    trial: 'sa_studios_planTrial',
    pro: 'sa_studios_planPro',
    custom: 'sa_studios_planCustom'
};
const PLAN_OPTIONS = ['trial', 'pro', 'custom'] as const;

// Helper to push meta updates directly to cloud to ensure Superadmin actions are reflected everywhere
async function pushMetaToCloud(slug: string, patch: object) {
    try {
        const existing = JSON.parse(localStorage.getItem(`cc_sa_meta_${slug}`) || '{}');
        const next = { ...existing, ...patch };
        localStorage.setItem(`cc_sa_meta_${slug}`, JSON.stringify(next));
        
        // Find orgId to ensure scoped update
        const settings = loadSettings(slug);
        const studioData: Record<string, any> = {};
        studioData[`cc_sa_meta_${slug}`] = next;
        
        await pushStudioStateToCloud(slug, settings.staff || [], studioData, 0, settings.orgId);
    } catch (e) {
        console.error('❌ pushMetaToCloud failed:', e);
    }
}

export default function StudiosPage() {
    const router = useRouter();
    const { lang, t } = useT();
    const [mounted, setMounted] = useState(false);
    const [studios, setStudios] = useState<StudioRecord[]>([]);
    const [search, setSearch] = useState('');
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [editingNote, setEditingNote] = useState<string | null>(null);
    const [noteVal, setNoteVal] = useState('');
    const [editingProfile, setEditingProfile] = useState<StudioRecord | null>(null);
    const [profileName, setProfileName] = useState('');
    const [profileSlug, setProfileSlug] = useState('');
    const [profileEmail, setProfileEmail] = useState('');
    const [profilePhone, setProfilePhone] = useState('');
    const [profileFirstName, setProfileFirstName] = useState('');
    const [profileLastName, setProfileLastName] = useState('');
    const [profileLogo, setProfileLogo] = useState('');
    const [activeTab, setActiveTab] = useState<'active' | 'trash' | 'audit'>('active');
    const [isPurging, setIsPurging] = useState(false);
    const [auditUsers, setAuditUsers] = useState<AuditUser[]>([]);
    const [isAuditing, setIsAuditing] = useState(false);


    // Custom Modal State
    const [modal, setModal] = useState<{
        type: 'confirm' | 'input' | 'alert' | 'sms' | null,
        title: string,
        message: string,
        inputVal?: string,
        onConfirm?: (val?: string) => void,
        loading?: boolean
    }>({ type: null, title: '', message: '' });

    const handlePurgeTestData = () => {
        setModal({
            type: 'confirm',
            title: t.sa_studios_purgeTestBtn,
            message: t.sa_studios_purgeTestConfirm,
            onConfirm: async () => {
                setIsPurging(true);
                try {
                    const res = await fetch('/api/superadmin/global-purge', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ pattern: 'load-test-' })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        // Clean local registry for matching pattern to avoid "revert" flash
                        const list = getStudioRegistry();
                        const nextList = list.filter(s => !s.startsWith('load-test-'));
                        localStorage.setItem('cc_studios_list', JSON.stringify(nextList));
                        
                        setModal({ type: 'alert', title: t.sa_studios_successTitle, message: t.sa_studios_purgedMsg.replace('{0}', data.deleted.toString()) });
                        loadData();
                    } else {
                        throw new Error(data.error);
                    }
                } catch (err: any) {
                    setModal({ type: 'alert', title: t.sa_studios_errorTitle, message: err.message });
                } finally {
                    setIsPurging(false);
                }
            }
        });
    };

    // Reset Modal State
    const [resetModal, setResetModal] = useState<{
        open: boolean,
        slug: string,
        categories: ResetCategories
    }>({ 
        open: false, 
        slug: '', 
        categories: { 
            students: true, groups: true, halls: true, plans: true,
            teachers: false, shop: false, analytics: false, calendar: false, notifications: false
        } 
    });

    const [isSyncing, setIsSyncing] = useState(false);
    const [isInitialSyncDone, setIsInitialSyncDone] = useState(false);
    const [cloudStudios, setCloudStudios] = useState<any[]>([]);

    const syncFromCloud = async () => {
        setIsSyncing(true);
        const data = await syncGlobalAdminRegistry();
        if (data && Array.isArray(data)) {
            setCloudStudios(data);
        }
        setIsInitialSyncDone(true);
        setIsSyncing(false);
    };

    const loadData = () => { 
        if (!isInitialSyncDone || !Array.isArray(cloudStudios)) return;
        
        const loaded: StudioRecord[] = cloudStudios.map(cloud => {
            if (!cloud || !cloud.slug) return null;
            const slug = cloud.slug;
            const s = loadSettings(slug);
            const meta = (() => { 
                try { 
                    const raw = localStorage.getItem(`cc_sa_meta_${slug}`);
                    return raw ? JSON.parse(raw) : {}; 
                } catch { return {}; } 
            })();
            const billing = getBillingState(slug);
            
            const studentCount = (cloud?.studentCount !== undefined) ? cloud.studentCount : 0;
            const subsCount = (cloud?.groupCount !== undefined) ? cloud.groupCount : 0;

            const staffList = Array.isArray(s?.staff) ? s.staff : [];
            const owner = staffList.find((m: any) => m && m.role === 'owner');

            const ownerEmail = cloud?.ownerEmail || s?.owner_info?.email || owner?.email || 'N/A';
            const ownerPhone = cloud?.ownerPhone || s?.owner_info?.phone || owner?.phone || 'N/A';
            
            let ownerName = cloud?.ownerName || 'N/A';
            if (ownerName === 'N/A') {
                if (s?.owner_info?.first_name) {
                    ownerName = `${s.owner_info.first_name} ${s.owner_info.last_name || ''}`.trim();
                } else if (owner?.full_name) {
                    ownerName = owner.full_name;
                }
            }

            return { 
                slug, 
                name: cloud?.name || s?.studioName || slug, 
                logoUrl: cloud?.logoUrl || s?.logoDataUrl, 
                studentCount, 
                subsCount, 
                suspended: cloud?.suspended || meta.suspended || false, 
                isDeleted: meta.deleted || false, 
                notes: meta.notes || cloud?.notes || '', 
                plan: (cloud?.plan || meta.plan || 'trial') as any,
                nextDue: cloud?.nextDueDate || billing.nextDueDate, 
                status: cloud?.status || billing.status, 
                daysOverdue: cloud?.daysOverdue || billing.daysOverdue,
                ownerPhone,
                ownerEmail,
                ownerName,
                isLocalOnly: false
            };
        }).filter(Boolean) as StudioRecord[];

        // 🚨 STRICT CLOUD TRUTH: We ignore local storage orphans. 
        // Only the Demo studio is allowed to be local-only.
        if (getStudioRegistry().includes('demo.classcore.ge') && !cloudStudios.find(c => c.slug === 'demo.classcore.ge')) {
            loaded.unshift(loadStudio('demo.classcore.ge'));
        }

        setStudios(loaded.filter(Boolean) as StudioRecord[]);
    };

    useEffect(() => { 
        setMounted(true);
        const init = async () => {
            await syncFromCloud();
            // Automatically fix any malformed slugs (containing dashes) on load
            const currentRegistry = getStudioRegistry();
            const malformed = currentRegistry.filter(s => s.includes('-'));
            if (malformed.length > 0) {
                console.log('🧹 Malformed slugs detected:', malformed);
                for (const oldSlug of malformed) {
                    const newSlug = compactSlugify(oldSlug);
                    if (oldSlug === newSlug) continue;

                    // Strategy: If mystudio already exists, we should only append a suffix 
                    // if it belongs to a DIFFERENT owner. If it's the SAME owner, the migration 
                    // should just happen (or skip if already matched).
                    const existingList = getStudioRegistry();
                    const cloudOriginal = cloudStudios.find(s => s.slug === oldSlug);
                    
                    let finalNewSlug = newSlug;
                    let counter = 1;
                    
                    // IF Target exists but has a DIFFERENT owner email/ID, then we suffix.
                    while (existingList.includes(finalNewSlug)) {
                        const targetInfo = cloudStudios.find(s => s.slug === finalNewSlug);
                        if (targetInfo && cloudOriginal && targetInfo.ownerEmail === cloudOriginal.ownerEmail) {
                            // Same owner - don't create a suffix, just use the exists one or skip
                            break; 
                        }
                        finalNewSlug = `${newSlug}${counter++}`;
                    }

                    if (oldSlug === finalNewSlug) continue;

                    try {
                        const res = await fetch('/api/superadmin/studios/update-slug', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ oldSlug, newSlug: finalNewSlug })
                        });
                        if (res.ok) {
                            migrateSlugData(oldSlug, finalNewSlug);
                            console.log(`✅ Migrated malformed slug: ${oldSlug} -> ${finalNewSlug}`);
                        }
                    } catch (e) {
                        console.error('❌ Migration failed:', e);
                    }
                }
                await syncFromCloud();
                loadData();
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (mounted) loadData();
    }, [cloudStudios, mounted]);

    const toggleSuspend = (slug: string) => {
        const studio = studios.find(s => s.slug === slug);
        if (!studio) return;
        const next = !studio.suspended;
        saveMeta(slug, { suspended: next });
        setStudios(prev => prev.map(s => s.slug === slug ? { ...s, suspended: next } : s));
        syncStudio(slug);
    };

    const syncStudio = async (slug: string) => {
        try {
            const s = loadSettings(slug);
            const allKeys = Object.keys(localStorage);
            const studioData: Record<string, any> = {};
            const prefixes = [
                'cc_student_data', 'cc_student_subscriptions', 'cc_groups', 'cc_halls',
                'cc_calendar_events', 'cc_subscription_plans', 'cc_shop_sales',
                'cc_checkins', 'cc_studio_settings', 'cc_teachers', 'cc_notifications',
                'cc_deleted_students', 'cc_deleted_subscriptions', 'cc_hall_rental',
                'cc_uid_registry', 'cc_attendance_archive', 'cc_expenses',
                'cc_audit_logs', 'cc_salary_status', 'cc_trash_bin',
                'cc_sa_meta', 'cc_saas_billing', 'cc_saas_payments'
            ];

            allKeys.forEach(k => {
                if (prefixes.some(p => k.startsWith(p)) && k.includes(`_${slug}`)) {
                    try { studioData[k] = JSON.parse(localStorage.getItem(k) || 'null'); } catch { }
                }
            });

            await pushStudioStateToCloud(slug, s.staff || [], studioData, 0, s.orgId);
            console.log('📡 [Superadmin] Immediate sync successful for:', slug);
        } catch (err) {
            console.error('📡 [Superadmin] Sync failed:', err);
        }
    };

    const setPlan = async (slug: string, plan: string) => {
        const studio = studios.find(s => s.slug === slug);
        if (!studio) return;
        const oldPlan = studio.plan;
        
        setStudios(prev => prev.map(s => s.slug === slug ? { ...s, plan: plan as StudioRecord['plan'] } : s));
        await pushMetaToCloud(slug, { plan });
        setOpenMenu(null);

        // If switching FROM trial TO a paid plan, also trigger a manual activation/payment record
        if (oldPlan === 'trial' && plan !== 'trial') {
            setModal({
                type: 'confirm',
                title: t.sa_studios_colPlan,
                message: `${t.sa_studios_colStudio} "${slug}" -> ${plan.toUpperCase()}. ${t.sa_studios_successTitle}?`,
                onConfirm: () => {
                    recordPayment(slug, 'cash', 49, 1);
                    syncStudio(slug);
                    loadData();
                    setModal({ type: null, title: '', message: '' });
                }
            });
        }
    };

    const saveNote = (slug: string) => {
        saveMeta(slug, { notes: noteVal });
        setStudios(prev => prev.map(s => s.slug === slug ? { ...s, notes: noteVal } : s));
        setEditingNote(null);
    };

    const impersonate = (slug: string) => {
        logAction('studio_impersonate', slug);
        localStorage.setItem('cc_sa_impersonate', slug);
        localStorage.setItem('cc_active_studio_slug', slug);
        
        // Also set org_id hint for the session if available
        const s = loadSettings(slug);
        if (s.orgId) {
            localStorage.setItem('cc_sa_impersonate_org_id', s.orgId);
        } else {
            localStorage.removeItem('cc_sa_impersonate_org_id');
        }
        
        router.push('/dashboard');
    };

    const updateBalance = (slug: string, delta: number) => {
        const state = getBillingState(slug);
        const current = state.accountBalance || 0;
        updateBillingState(slug, { accountBalance: Math.max(0, current + delta) });
        syncStudio(slug);
        loadData(); // refresh list
    };

    const manualActivate = (slug: string) => {
        setModal({
            type: 'confirm',
            title: t.sa_studios_colActions,
            message: `${t.sa_studios_colStudio} "${slug}" -> 49 GEL?`,
            onConfirm: () => {
                recordPayment(slug, 'cash', 49, 1);
                syncStudio(slug);
                loadData();
                setModal({ type: null, title: '', message: '' });
            }
        });
    };

    const sendReminder = (studio: StudioRecord) => {
        if (studio.ownerPhone === 'N/A') {
            setModal({
                type: 'alert',
                title: t.sa_studios_errorTitle,
                message: t.sa_studios_ownerPhoneLabel + ' N/A'
            });
            return;
        }

        const text = getSaasReminderSms('ka', 0);
        setModal({
            type: 'sms',
            title: t.sa_studios_smsTitle,
            message: studio.ownerPhone,
            inputVal: text,
            onConfirm: async (composedText) => {
                setModal(m => ({ ...m, loading: true }));
                try {
                    const res = await fetch('/api/sms/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ to: studio.ownerPhone.replace(/\s/g, ''), text: composedText, studentName: 'Admin' })
                    });
                    if (res.ok) {
                        setModal({ type: 'alert', title: t.sa_studios_successTitle, message: t.sa_studios_found });
                    } else {
                        setModal({ type: 'alert', title: t.sa_studios_errorTitle, message: t.sa_studios_smsFailed });
                    }
                } catch {
                    setModal({ type: 'alert', title: t.sa_studios_errorTitle, message: t.sa_studios_networkError });
                }
            }
        });
    };

    const handleResetStudio = (slug: string) => {
        setResetModal({
            open: true,
            slug,
            categories: { 
                students: true, groups: true, halls: true, plans: true,
                teachers: false, shop: false, analytics: false, calendar: false, notifications: false
            }
        });
    };

    const handleMasterReset = () => {
        const confirmMsg = t.sa_purgeWarning;
        
        if (confirm(confirmMsg)) {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('cc_')) localStorage.removeItem(key);
            });
            Object.keys(sessionStorage).forEach(key => {
                if (key.startsWith('cc_')) sessionStorage.removeItem(key);
            });
            window.location.reload();
        }
    };

    const confirmReset = () => {
        const { slug, categories } = resetModal;
        setModal({
            type: 'confirm',
            title: t.sa_studios_reset,
            message: `${t.sa_studios_reset} "${slug}"?`,
            onConfirm: () => {
                resetStudioData(slug, categories);
                setResetModal(prev => ({ ...prev, open: false }));
                setModal({ type: 'alert', title: t.sa_studios_successTitle, message: t.sa_studios_successTitle });
                loadData();
            }
        });
    };

    const moveToTrash = (slug: string) => {
        setModal({
            type: 'confirm',
            title: t.sa_studios_tabTrash,
            message: `${t.sa_studios_tabTrash} "${slug}"?`,
            onConfirm: () => {
                saveMeta(slug, { deleted: true });
                loadData();
                setModal({ type: null, title: '', message: '' });
            }
        });
    };

    const restoreFromTrash = (slug: string) => {
        saveMeta(slug, { deleted: false });
        loadData();
        setModal({ 
            type: 'alert', 
            title: t.sa_studios_restore, 
            message: t.sa_studios_successTitle 
        });
    };

    const handleDeepPurge = (slug: string) => {
        setModal({
            type: 'confirm',
            title: t.sa_studios_reset,
            message: `${t.sa_studios_reset} "${slug}"?`,
            onConfirm: async () => {
                setModal(m => ({ ...m, loading: true }));
                try {
                    await masterStudioPurge(slug);
                    setModal({ type: 'alert', title: t.sa_studios_successTitle, message: t.sa_studios_successTitle });
                    loadData();
                } catch (err: any) {
                    setModal({ type: 'alert', title: t.sa_studios_errorTitle, message: err.message });
                }
            }
        });
    };


    const purgeStudio = (slug: string) => {
        setModal({
            type: 'confirm',
            title: t.sa_studios_purgeForever,
            message: `${t.sa_studios_purgeForever} "${slug}"?`,
            onConfirm: async () => {
                setModal(m => ({ ...m, loading: true }));
                
                const s = loadSettings(slug);
                const owner = s.staff?.find(m => m.role === 'owner');
                
                try {
                    const res = await fetch('/api/superadmin/delete-studio', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: owner?.email, userId: owner?.id, slug: slug })
                    });
                    
                    const data = await res.json();
                    
                    if (!res.ok) {
                        throw new Error(data.error || 'API deletion failed');
                    }

                    // 1. Clear local data first
                    clearAllStudioData(slug);
                    
                    // 2. Remove from registry immediately to prevent re-addition
                    removeFromRegistry(slug);

                    // 4. Add to Blacklist to prevent re-addition during cloud-sync latency
                    const blacklist = JSON.parse(localStorage.getItem('cc_sa_purge_blacklist') || '[]');
                    blacklist.push({ slug, timestamp: Date.now() });
                    localStorage.setItem('cc_sa_purge_blacklist', JSON.stringify(blacklist));

                    // 5. Update cloud state
                    await syncFromCloud();
                    
                    setModal({ 
                        type: 'alert', 
                        title: t.sa_studios_successTitle, 
                        message: t.sa_studios_successTitle 
                    });
                } catch (err: any) {
                    console.error('❌ Failed to delete studio:', err);
                    setModal({ 
                        type: 'alert', 
                        title: t.sa_studios_errorTitle, 
                        message: err.message
                    });
                }
            }
        });
    };

    const saveProfile = async () => {
        if (!editingProfile) return;
        const oldSlug = editingProfile.slug;
        const cleanSlug = compactSlugify(profileSlug);

        // Show loading if slug changed as it's a heavier operation
        if (oldSlug !== cleanSlug) {
            setModal(m => ({ ...m, loading: true }));
            try {
                // 1. Update Cloud first
                const updateRes = await fetch('/api/superadmin/studios/update-slug', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oldSlug, newSlug: cleanSlug })
                });
                const updateData = await updateRes.json();
                if (!updateData.success) throw new Error(updateData.error || 'Unknown error');

                // 2. Migrate local data
                migrateSlugData(oldSlug, cleanSlug);

                // 3. Update local registry list immediately to prevent "revert" flash
                const list = getStudioRegistry();
                const newList = list.map(s => s === oldSlug ? cleanSlug : s);
                localStorage.setItem('cc_studios_list', JSON.stringify([...new Set(newList)]));
                
            } catch (err: any) {
                console.error('❌ Slug update failed:', err);
                alert(err.message);
                setModal(m => ({ ...m, loading: false }));
                return;
            }
        }
        // Update settings record
        const settingsRaw = localStorage.getItem(`cc_studio_settings_${cleanSlug}`);
        try {
            const settings = settingsRaw ? JSON.parse(settingsRaw) : { staff: [], studioSlug: cleanSlug, studioName: profileName };
            settings.studioName = profileName;
            settings.studioSlug = cleanSlug;
            settings.logoDataUrl = profileLogo;
            
            // New persistent owner info
            settings.owner_info = {
                first_name: profileFirstName,
                last_name: profileLastName,
                email: profileEmail,
                phone: profilePhone
            };

            // Also sync to staff for compatibility
            if (!settings.staff) settings.staff = [];
            let owner = settings.staff.find((m: any) => m.role === 'owner');
            if (owner) {
                owner.email = profileEmail;
                owner.phone = profilePhone;
                owner.first_name = profileFirstName;
                owner.last_name = profileLastName;
                owner.full_name = `${profileFirstName} ${profileLastName}`.trim();
            }
            
            localStorage.setItem(`cc_studio_settings_${cleanSlug}`, JSON.stringify(settings));

            // CRITICAL: Push updated state to cloud so it's no longer "Local Only"
            await pushStudioStateToCloud(cleanSlug, settings.staff || [], settings);

        } catch (e) {
            console.error('❌ Error updating local settings:', e);
        }

        setEditingProfile(null);
        setModal(m => ({ ...m, loading: false }));
        await syncFromCloud(); // Refresh to catch all changes
        loadData();
    };

    const emptyTrash = () => {
        const trashed = studios.filter(s => s.isDeleted);
        if (trashed.length === 0) return;
        
        setModal({
            type: 'confirm',
            title: t.sa_studios_emptyTrash,
            message: `${t.sa_studios_emptyTrash} (${trashed.length})?`,
            onConfirm: async () => {
                setModal(m => ({ ...m, loading: true }));
                try {
                    const slugs = trashed.map(s => s.slug);
                    
                    // 1. Cloud Batch Deletion
                    const res = await fetch('/api/superadmin/global-purge', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ slugs })
                    });
                    
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Batch deletion failed');
                    
                    // 2. Local Cleanup
                    slugs.forEach(slug => {
                        clearAllStudioData(slug);
                        removeFromRegistry(slug);
                    });
                    
                    // 3. Sync & Inform
                    await syncFromCloud();
                    setModal({ 
                        type: 'alert', 
                        title: t.sa_studios_successTitle, 
                        message: t.sa_studios_successTitle 
                    });
                } catch (err: any) {
                    console.error('❌ Failed to empty trash:', err);
                    setModal({ 
                        type: 'alert', 
                        title: t.sa_studios_errorTitle, 
                        message: err.message 
                    });
                }
            }
        });
    };

    const fetchAuditList = async () => {
        setIsAuditing(true);
        try {
            const res = await fetch('/api/superadmin/audit/list');
            const data = await res.json();
            if (data.users) setAuditUsers(data.users);
        } catch (err) {
            console.error('Failed to fetch audit list:', err);
        } finally {
            setIsAuditing(false);
        }
    };

    const purgeAuditUser = async (userId: string, slug?: string) => {
        if (!confirm(t.sa_purgeWarning)) return;
        
        try {
            const res = await fetch('/api/superadmin/audit/delete-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, slug })
            });
            if (res.ok) {
                setAuditUsers(prev => prev.filter(u => u.id !== userId));
                if (slug) removeFromRegistry(slug);
            } else {
                const data = await res.json();
                alert(`${t.sa_studios_errorTitle}: ${data.error}`);
            }
        } catch (err: any) {
            alert(`${t.sa_studios_errorTitle}: ${err.message}`);
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {

        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setProfileLogo(reader.result as string);
        reader.readAsDataURL(file);
    };

    const filtered = studios
        .filter(s => activeTab === 'active' ? !s.isDeleted : s.isDeleted)
        .filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.slug.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-6 animate-fade-up">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black text-primary tracking-tight">
                        {activeTab === 'active' ? t.sa_studios_title : t.sa_studios_recycleBin}
                    </h1>
                    <p className="text-sm text-muted mt-1">
                        {filtered.length} {t.sa_studios_found}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {activeTab === 'trash' && filtered.length > 0 && (
                        <button 
                            onClick={emptyTrash}
                            className="group flex items-center gap-2 px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border border-rose-500/20 shadow-lg shadow-rose-500/5"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t.sa_studios_emptyTrash}
                        </button>
                    )}

                    <button 
                        onClick={handleMasterReset}
                        className="group flex items-center gap-2 px-4 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border border-amber-500/20 shadow-lg shadow-amber-500/5"
                    >
                        <Eraser className="w-3.5 h-3.5" />
                        {t.sa_studios_clearCache}
                    </button>

                    <button 
                        onClick={syncFromCloud}
                        disabled={isSyncing}
                        className={cn(
                            "group flex items-center gap-2 px-4 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border border-indigo-500/20 shadow-lg shadow-indigo-500/5",
                            isSyncing && "opacity-50"
                        )}
                    >
                        <RefreshCcw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
                        {isSyncing ? t.sa_studios_syncing : t.sa_studios_cloudSync}
                    </button>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted opacity-40" />
                        <input 
                            value={search} 
                            onChange={e => setSearch(e.target.value)} 
                            placeholder={t.sa_studios_searchPlaceholder} 
                            className="bg-black/5 border border-black/5 dark:border-border-subtle rounded-2xl pl-10 pr-4 py-3 text-sm text-primary dark:text-white placeholder:text-muted outline-none focus:border-indigo-500/50 w-72 shadow-sm transition-all" 
                        />
                    </div>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-2 p-1.5 bg-black/5 dark:bg-zinc-500/5 border border-black/5 dark:border-border-subtle rounded-3xl w-fit">
                <button 
                    onClick={() => setActiveTab('active')}
                    className={cn(
                        "px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all",
                        activeTab === 'active' ? "bg-white dark:bg-zinc-800 text-indigo-500 shadow-sm border border-black/5 dark:border-border-subtle" : "text-muted hover:text-primary"
                    )}
                >
                    {t.sa_studios_tabActive}
                </button>
                <button 
                    onClick={() => setActiveTab('trash')}
                    className={cn(
                        "px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2",
                        activeTab === 'trash' ? "bg-white dark:bg-zinc-800 text-rose-500 shadow-sm border border-black/5 dark:border-border-subtle" : "text-muted hover:text-primary"
                    )}
                >
                    <Trash2 className="w-3 h-3" />
                    {t.sa_studios_tabTrash}
                    {studios.filter(s => s.isDeleted).length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[8px] leading-none">
                            {studios.filter(s => s.isDeleted).length}
                        </span>
                    )}
                </button>
                <button 
                    onClick={() => { setActiveTab('audit'); fetchAuditList(); }}
                    className={cn(
                        "px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2",
                        activeTab === 'audit' ? "bg-white dark:bg-zinc-800 text-indigo-600 shadow-sm border border-black/5 dark:border-border-subtle" : "text-muted hover:text-primary"
                    )}
                >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {t.sa_studios_tabAudit}
                </button>
            </div>

            <div className="bg-white/95 border border-black/10 dark:border-border-subtle rounded-[2.5rem] shadow-sm overflow-x-auto no-scrollbar">
                <div className="grid grid-cols-[1.8fr_0.5fr_1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] gap-4 px-8 py-5 border-b border-black/5 dark:border-border-subtle/50 text-[10px] font-black text-muted uppercase tracking-widest bg-black/[0.02] dark:bg-zinc-500/5 items-center min-w-[1000px]">
                    <span>{t.sa_studios_colStudio}</span>
                    <span className="text-center">{t.sa_studios_colStud}</span>
                    <span className="text-left px-2">{t.sa_studios_colOwner}</span>
                    <span className="text-left px-2">{t.sa_studios_colContact}</span>
                    <span className="text-center">{t.sa_studios_colPlan}</span>
                    <span className="text-center">{t.sa_studios_colBal}</span>
                    <span className="text-center">{t.sa_studios_colAdd}</span>
                    <span className="text-center">{t.sa_studios_colStatus}</span>
                    <span className="text-right">{t.sa_studios_colActions}</span>
                </div>
                {filtered.length === 0 ? (
                    <div className="py-24 text-center text-muted">
                        <Building2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="text-sm font-black uppercase tracking-[0.2em]">
                            {activeTab === 'active' ? t.sa_studios_noStudiosFound : t.sa_studios_trashEmpty}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border-subtle/50">
                        {filtered.map(studio => {
                            const diffDays = studio.nextDue ? Math.ceil((new Date(studio.nextDue).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : 0;
                            return (
                                <div key={studio.slug} className={cn(
                                    "group border-b border-black/5 dark:border-border-subtle/30 last:border-0 hover:bg-black/[0.01] dark:hover:bg-zinc-500/2 transition-colors",
                                    studio.isLocalOnly && "border-l-4 border-l-amber-500 bg-amber-500/[0.02]"
                                )}>
                                    <div className="grid grid-cols-[1.8fr_0.5fr_1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] gap-4 items-center px-8 py-6 min-w-[1000px]">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 bg-black/5 dark:bg-surface flex items-center justify-center border border-black/5 dark:border-border-subtle shadow-inner group-hover:border-indigo-500/30 transition-all">
                                                {studio.logoUrl ? <img src={studio.logoUrl} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-6 h-6 text-zinc-300 opacity-40" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[15px] font-black text-primary dark:text-white truncate flex items-center gap-2 leading-none">
                                                    {studio.name}
                                                    {studio.studentCount > 150 && <span title="High Activity"><AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" /></span>}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <p className="text-[10px] text-muted font-mono uppercase tracking-tighter opacity-60">/{studio.slug}</p>
                                                    {studio.isLocalOnly && (
                                                        <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[8px] font-black uppercase tracking-widest">
                                                            {t.sa_studios_localOnly}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="text-center">
                                            <span className="text-base font-black text-primary dark:text-white tabular-nums">{studio.studentCount}</span>
                                            <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest">{t.sa_studios_studentCountLabel}</p>
                                        </div>

                                        <div className="px-2 min-w-0">
                                            <p className="text-xs font-black text-primary dark:text-white truncate leading-tight">{studio.ownerName || 'N/A'}</p>
                                            <p className="text-[10px] font-bold text-zinc-400 truncate opacity-70">{studio.ownerEmail}</p>
                                        </div>

                                        <div className="px-2 min-w-0">
                                            <p className="text-xs font-black text-primary dark:text-white leading-tight">{studio.ownerPhone || 'N/A'}</p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.3)]" />
                                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter">Verified</p>
                                            </div>
                                        </div>

                                        <div className="relative text-center">
                                            <button onClick={() => setOpenMenu(openMenu === studio.slug + '_plan' ? null : studio.slug + '_plan')} className={cn('px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 mx-auto border transition-all hover:scale-105 active:scale-95', PLAN_COLORS[studio.plan], openMenu === studio.slug + '_plan' ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : 'border-black/5')}>
                                                {(t as any)[PLAN_LABELS_KEYS[studio.plan]]}<ChevronDown className="w-2.5 h-2.5 opacity-50" />
                                            </button>
                                            {openMenu === studio.slug + '_plan' && (
                                                <div className="absolute z-[100] top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-black/10 dark:border-border-subtle rounded-2xl overflow-hidden shadow-2xl min-w-[150px] animate-in slide-in-from-top-2 duration-200">
                                                    {PLAN_OPTIONS.map(p => (
                                                        <button key={p} onClick={() => setPlan(studio.slug, p)} className={cn(
                                                            'w-full px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest hover:bg-black/5 dark:hover:bg-zinc-500/10 transition-colors border-l-2', 
                                                            studio.plan === p ? 'text-indigo-500 border-indigo-500 bg-indigo-500/5' : 'text-muted border-transparent'
                                                        )}>
                                                            {(t as any)[PLAN_LABELS_KEYS[p]]}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-center">
                                            <button 
                                                onClick={() => {
                                                    const currentBal = Math.round(getBillingState(studio.slug).accountBalance || 0);
                                                    setModal({
                                                        type: 'input',
                                                        title: t.sa_studios_colBal,
                                                        message: 'GEL',
                                                        inputVal: String(currentBal),
                                                        onConfirm: (val) => {
                                                            const num = Number(val);
                                                            if (!isNaN(num)) {
                                                                updateBillingState(studio.slug, { accountBalance: num });
                                                                loadData();
                                                            }
                                                            setModal({ type: null, title: '', message: '' });
                                                        }
                                                    });
                                                }}
                                                className="px-2 py-1 bg-black/5 dark:bg-zinc-500/5 border border-black/5 dark:border-border-subtle/50 rounded-lg hover:border-indigo-500/30 transition-all group/bal"
                                            >
                                                <span className="text-xs font-black text-primary dark:text-white tabular-nums">
                                                    {Math.round(getBillingState(studio.slug).accountBalance || 0)}₾
                                                </span>
                                            </button>
                                        </div>

                                        <div className="text-center">
                                            <button 
                                                onClick={() => {
                                                    setModal({
                                                        type: 'input',
                                                        title: t.sa_studios_colAdd,
                                                        message: t.sa_studios_colAdd,
                                                        inputVal: '30',
                                                        onConfirm: (val) => {
                                                            const days = Number(val);
                                                            if (!isNaN(days) && days !== 0) {
                                                                extendSubscriptionByDays(studio.slug, days);
                                                                loadData();
                                                            }
                                                            setModal({ type: null, title: '', message: '' });
                                                        }
                                                    });
                                                }}
                                                className="px-2.5 py-1 bg-black/5 dark:bg-zinc-500/5 border border-black/5 dark:border-border-subtle/50 rounded-lg hover:border-indigo-500/30 transition-all font-black text-[9px] uppercase tracking-widest text-muted"
                                            >
                                                + {t.day}
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-center">
                                            <button onClick={() => toggleSuspend(studio.slug)} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border', studio.suspended ? 'bg-rose-500/5 text-rose-500 border-rose-500/20' : 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20')}>
                                                <Power className="w-3 h-3" />{studio.suspended ? 'Locked' : 'Active'}
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-end gap-1.5 pr-4">
                                            {activeTab === 'active' ? (
                                                <>
                                                    <button onClick={() => sendReminder(studio)} className="p-2 text-zinc-400 hover:text-amber-500 transition-colors" title={t.sa_studios_smsTitle}>
                                                        <Smartphone className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => impersonate(studio.slug)} className="p-2 text-zinc-400 hover:text-emerald-500 transition-colors" title={t.sa_studios_impersonate}>
                                                        <LogIn className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => { 
                                                            const s = loadSettings(studio.slug);
                                                            setEditingProfile(studio); 
                                                            setProfileName(s.studioName || studio.name); 
                                                            setProfileSlug(studio.slug);
                                                            setProfileEmail(s.owner_info?.email || studio.ownerEmail);
                                                            setProfilePhone(s.owner_info?.phone || studio.ownerPhone || 'N/A');
                                                            setProfileFirstName(s.owner_info?.first_name || '');
                                                            setProfileLastName(s.owner_info?.last_name || '');
                                                            setProfileLogo(s.logoDataUrl || studio.logoUrl || '');
                                                        }} 
                                                        className="p-2 text-zinc-400 hover:text-indigo-500 transition-colors"
                                                        title={t.sa_studios_control}
                                                    >
                                                        <Settings className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeepPurge(studio.slug)}
                                                        className="p-2 text-zinc-300 hover:text-amber-500 transition-colors"
                                                        title={t.sa_studios_reset}
                                                    >
                                                        <Eraser className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => purgeStudio(studio.slug)}
                                                        className="p-2 text-zinc-300 hover:text-rose-600 transition-colors"
                                                        title={t.sa_studios_nuclear}
                                                    >
                                                        <ShieldAlert className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => moveToTrash(studio.slug)}
                                                        className="p-2 text-zinc-300 hover:text-rose-400 transition-colors"
                                                        title={t.sa_studios_tabTrash}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (

                                                <div className="flex items-center gap-1">
                                                    <button 
                                                        onClick={() => restoreFromTrash(studio.slug)}
                                                        className="p-2 text-zinc-300 hover:text-emerald-500 transition-colors"
                                                        title={t.sa_studios_restore}
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => purgeStudio(studio.slug)}
                                                        className="p-2 text-zinc-300 hover:text-rose-600 transition-colors"
                                                        title={t.sa_studios_purgeForever}
                                                    >
                                                        <ShieldAlert className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {(editingNote === studio.slug || studio.notes) && (
                                        <div className="px-8 pb-5 flex items-start gap-3">
                                            <div className="flex-1">
                                                {editingNote === studio.slug ? (
                                                    <div className="flex gap-2 items-center">
                                                        <input autoFocus value={noteVal} onChange={e => setNoteVal(e.target.value)} placeholder={t.sa_studios_editNoteDesc} className="flex-1 bg-surface border border-border-subtle rounded-2xl px-5 py-3 text-xs text-primary placeholder:text-muted outline-none focus:border-indigo-500/50 shadow-inner" />
                                                        <button onClick={() => saveNote(studio.slug)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20">{t.sa_studios_save}</button>
                                                        <button onClick={() => setEditingNote(null)} className="px-6 py-3 bg-surface hover:bg-muted/10 text-muted text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-border-subtle">{t.sa_studios_cancel}</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3 group/note cursor-pointer" onClick={() => { setEditingNote(studio.slug); setNoteVal(studio.notes); }}>
                                                        <div className="px-4 py-2 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                                                            <p className="text-[10px] text-amber-600 font-bold italic flex items-center gap-2">
                                                                <Edit3 className="w-3 h-3 opacity-40" />
                                                                {studio.notes}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {activeTab === 'audit' && (
                <div className="bg-white/95 border border-black/10 dark:border-border-subtle rounded-[2.5rem] shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_auto] gap-4 px-8 py-5 border-b border-black/5 dark:border-border-subtle/50 text-[10px] font-black text-muted uppercase tracking-widest bg-indigo-50/30 dark:bg-indigo-500/5 items-center">
                        <span>{t.sa_studios_auditUserCol}</span>
                        <span>{t.sa_studios_auditEmailCol}</span>
                        <span className="text-center">{t.sa_studios_auditRegCol}</span>
                        <span className="text-center">{t.sa_studios_auditConfCol}</span>
                        <span className="text-center">{t.sa_studios_auditStatusCol}</span>
                        <span className="text-right pr-2">{t.sa_studios_auditActionCol}</span>
                    </div>
                    {isAuditing ? (
                        <div className="py-32 text-center">
                            <RefreshCcw className="w-10 h-10 mx-auto animate-spin text-indigo-500 opacity-20 mb-4" />
                            <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Loading global audit list...</p>
                        </div>
                    ) : auditUsers.length === 0 ? (
                        <div className="py-32 text-center text-muted">
                            <ShieldAlert className="w-16 h-16 mx-auto mb-4 opacity-10" />
                            <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">{lang === 'ka' ? 'აუდიტის მონაცემები არ არის' : 'No audit records found'}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-black/5 dark:divide-border-subtle/30 max-h-[600px] overflow-y-auto no-scrollbar">
                            {auditUsers
                                .filter(u => u.email.toLowerCase().includes(search.toLowerCase()) || u.studioName.toLowerCase().includes(search.toLowerCase()))
                                .map((user, idx, arr) => {
                                    const isDuplicate = arr.filter(u => u.studioName.toLowerCase() === user.studioName.toLowerCase() && u.studioName !== 'N/A').length > 1;
                                    return (
                                        <div key={user.id} className={cn(
                                            "grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_auto] gap-4 items-center px-8 py-5 hover:bg-black/[0.01] transition-colors",
                                            isDuplicate && "bg-amber-500/[0.03]"
                                        )}>
                                            <div className="min-w-0">
                                                <p className="text-[13px] font-black text-primary dark:text-white truncate flex items-center gap-2">
                                                    {user.studioName}
                                                    {isDuplicate && <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[8px] font-black uppercase tracking-widest">Duplicate</span>}
                                                </p>
                                                <p className="text-[9px] font-bold text-muted truncate opacity-60">/{user.requestedSlug}</p>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[12px] font-bold text-primary dark:text-white truncate">{user.email}</p>
                                                <p className="text-[9px] font-black text-muted uppercase opacity-40">{user.firstName} {user.lastName}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-primary/70 tabular-nums">{new Date(user.createdAt).toLocaleDateString()}</p>
                                                <p className="text-[8px] font-bold text-muted uppercase opacity-50">{new Date(user.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                            <div className="text-center">
                                                {user.isConfirmed ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none">Confirmed</span>
                                                        <span className="text-[8px] text-muted opacity-40 mt-1">{user.confirmedAt ? new Date(user.confirmedAt).toLocaleDateString() : ''}</span>
                                                    </div>
                                                ) : (
                                                    <span className={cn("text-[9px] font-black uppercase tracking-widest", user.isStale ? "text-rose-500 animate-pulse" : "text-amber-500")}>
                                                        Pending {(user as any).isStale && '(Stale)'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-center">
                                                {user.hasStudioRow ? (
                                                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest">Active DB Row</span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-zinc-500/10 text-zinc-500 border border-zinc-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest">Auth Only</span>
                                                )}
                                            </div>
                                            <div className="text-right pr-2">
                                                <button 
                                                    onClick={() => purgeAuditUser(user.id, user.requestedSlug)}
                                                    className="p-2.5 bg-black/5 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-600 rounded-xl transition-all active:scale-95 group/purge"
                                                    title={t.sa_studios_purgeForever}
                                                >
                                                    <Trash2 className="w-4 h-4 transition-transform group-hover/purge:rotate-12" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                    <div className="px-8 py-4 bg-indigo-500/[0.02] border-t border-black/5 dark:border-border-subtle/50 flex items-center justify-between">
                            {t.sa_studios_auditTotal}: {auditUsers.length} • {t.sa_studios_auditPending}: {auditUsers.filter(u => !u.isConfirmed).length}
                        <button onClick={fetchAuditList} className="flex items-center gap-2 text-[9px] font-black text-indigo-600 hover:text-indigo-500 uppercase tracking-widest">
                            <RefreshCcw className={cn("w-3 h-3", isAuditing && "animate-spin")} />
                            {t.sa_studios_refreshList}
                        </button>
                    </div>
                </div>
            )}

            {/* Full Control / Edit Profile Modal */}
            {editingProfile && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20" onClick={() => setEditingProfile(null)} />
                    <div className="relative bg-white/95 border border-black/10 dark:border-border-subtle rounded-[2.5rem] w-full max-w-lg p-10 animate-in zoom-in-95 duration-200 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar">
                        <div className="flex items-center justify-between mb-8">
                             <div>
                                <h3 className="text-2xl font-black text-primary tracking-tight">{t.sa_studios_mgmtTitle}</h3>
                                <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-1">Full Control Panel</p>
                             </div>
                             <button onClick={() => setEditingProfile(null)} className="p-3 bg-zinc-500/10 hover:bg-zinc-500/20 text-muted rounded-2xl transition-all"><X className="w-5 h-5" /></button>
                        </div>
                        
                        <div className="space-y-6">
                            {/* Logo Section */}
                            <div className="flex items-center gap-6 p-6 bg-zinc-500/5 rounded-3xl border border-border-subtle/50">
                                <div className="w-24 h-24 rounded-[2rem] overflow-hidden bg-card border border-border-subtle shadow-xl flex-shrink-0 relative group/logo">
                                    {profileLogo ? <img src={profileLogo} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-500 font-black text-2xl">?</div>}
                                    <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 cursor-pointer transition-all">
                                        <Plus className="w-8 h-8 text-white" />
                                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                                    </label>
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1">{t.sa_studios_logoLabel}</p>
                                    <p className="text-xs text-muted/60 leading-tight mb-3">{t.sa_studios_logoDesc}</p>
                                    <button onClick={() => setProfileLogo('')} className="text-[10px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-widest">{t.sa_studios_removeLogo}</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">{t.sa_studios_nameLabel}</label>
                                    <input 
                                        value={profileName} 
                                        onChange={e => {
                                            const nextName = e.target.value;
                                            setProfileName(nextName);
                                            // Real-time sync to slug
                                            if (!profileSlug || profileSlug === compactSlugify(profileName)) {
                                                setProfileSlug(compactSlugify(nextName));
                                            }
                                        }} 
                                        className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-primary transition-all shadow-inner" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">{t.sa_studios_slugLabel}</label>
                                    <input 
                                        value={profileSlug} 
                                        onChange={e => {
                                            const clean = compactSlugify(e.target.value);
                                            setProfileSlug(clean);
                                        }} 
                                        className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-primary transition-all shadow-inner" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">{t.sa_studios_ownerFirstName}</label>
                                    <input value={profileFirstName} onChange={e => setProfileFirstName(e.target.value)} className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-primary transition-all shadow-inner" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">{t.sa_studios_ownerLastName}</label>
                                    <input value={profileLastName} onChange={e => setProfileLastName(e.target.value)} className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-primary transition-all shadow-inner" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">{t.sa_studios_ownerEmailLabel}</label>
                                    <input value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-primary transition-all shadow-inner" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">{t.sa_studios_ownerPhoneLabel}</label>
                                    <input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-primary transition-all shadow-inner" />
                                </div>
                            </div>


                            <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl">
                                <p className="text-[10px] text-rose-600 dark:text-rose-500/70 font-bold leading-relaxed flex gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                    {t.sa_studios_slugWarning}
                                </p>
                            </div>

                            <div className="pt-6 border-t border-border-subtle/30">
                                <button 
                                    onClick={() => {
                                        setEditingProfile(null);
                                        handleResetStudio(profileSlug);
                                    }}
                                    className="w-full py-4 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-2"
                                >
                                    <RefreshCcw className="w-4 h-4" />
                                    {t.sa_studios_systemReset}
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-10">
                            <button onClick={() => setEditingProfile(null)} className="flex-1 py-4 bg-surface hover:bg-zinc-500/10 text-muted text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all border border-border-subtle">{t.sa_studios_cancel}</button>
                            <button onClick={saveProfile} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-600/30">{t.sa_studios_saveChanges}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Global Modal */}
            {modal.type && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20 animate-in fade-in duration-300" onClick={() => !modal.loading && setModal({ type: null, title: '', message: '' })} />
                    <div className="relative bg-white/95 border border-black/10 dark:border-border-subtle rounded-[2.5rem] w-full max-w-md p-10 animate-in zoom-in-95 duration-200 shadow-2xl text-center">
                        <div className={cn(
                            "w-16 h-16 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-xl",
                            modal.type === 'confirm' ? "bg-indigo-500/10 text-indigo-500" :
                            modal.type === 'sms' ? "bg-amber-500/10 text-amber-500" :
                            modal.type === 'alert' && modal.title === 'Error' ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"
                        )}>
                            {modal.type === 'sms' ? <Smartphone className="w-8 h-8" /> : 
                             modal.type === 'confirm' ? <Zap className="w-8 h-8" /> :
                             modal.type === 'alert' && modal.title === 'Error' ? <X className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
                        </div>
                        
                        <h3 className="text-xl font-black text-primary mb-2 tracking-tight uppercase tracking-widest">{modal.title}</h3>
                        
                        {modal.type === 'sms' ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 justify-center text-[10px] font-black text-muted uppercase tracking-widest mb-2">
                                    <Smartphone className="w-3 h-3" /> {modal.message}
                                </div>
                                <textarea 
                                    value={modal.inputVal} 
                                    onChange={e => setModal(m => ({ ...m, inputVal: e.target.value }))}
                                    className="w-full h-32 bg-black/5 dark:bg-surface border border-black/10 dark:border-border-subtle rounded-3xl p-5 text-sm font-bold text-primary outline-none focus:border-indigo-500/50 shadow-inner no-scrollbar"
                                />
                            </div>
                        ) : modal.type === 'input' ? (
                            <div className="space-y-4">
                                <p className="text-sm text-zinc-500 font-medium mb-4">{modal.message}</p>
                                <input 
                                    autoFocus
                                    value={modal.inputVal} 
                                    onChange={e => setModal(m => ({ ...m, inputVal: e.target.value }))}
                                    className="w-full bg-black/5 dark:bg-surface border border-black/10 dark:border-border-subtle rounded-2xl px-6 py-4 text-center text-xl font-black text-primary outline-none focus:border-indigo-500/50 shadow-inner"
                                />
                            </div>
                        ) : (
                            <p className="text-sm text-zinc-500 font-medium mb-8 leading-relaxed px-4">{modal.message}</p>
                        )}

                        <div className="flex gap-4 mt-8">
                            {modal.type === 'alert' ? (
                                <button onClick={() => setModal({ type: null, title: '', message: '' })} className="flex-1 py-4 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl">OK</button>
                            ) : (
                                <>
                                    <button disabled={modal.loading} onClick={() => setModal({ type: null, title: '', message: '' })} className="flex-1 py-4 bg-zinc-500/10 hover:bg-zinc-500/20 text-muted text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all">
                                        {t.sa_studios_cancel}
                                    </button>
                                    <button 
                                        disabled={modal.loading}
                                        onClick={() => modal.onConfirm?.(modal.inputVal)} 
                                        className={cn(
                                            "flex-1 py-4 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl",
                                            modal.type === 'sms' ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30" : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30",
                                            modal.loading && "opacity-50 cursor-wait"
                                        )}
                                    >
                                        {modal.loading ? '...' : t.sa_studios_confirmTitle}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Granular Reset Modal */}
            {resetModal.open && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20 animate-in fade-in duration-300" onClick={() => setResetModal(prev => ({ ...prev, open: false }))} />
                    <div className="relative bg-white/95 border border-black/10 dark:border-border-subtle rounded-[2.5rem] w-full max-w-md p-10 animate-in zoom-in-95 duration-200 shadow-2xl">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-6 shadow-xl">
                            <RefreshCcw className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-primary mb-2 tracking-tight uppercase tracking-widest text-center">
                            {t.sa_studios_reset}
                        </h3>
                        <p className="text-xs text-muted font-bold text-center mb-8">
                            {t.sa_studios_logoDesc}
                        </p>

                        <div className="space-y-3 mb-8">
                            {(Object.keys(resetModal.categories) as Array<keyof ResetCategories>).map(cat => (
                                <button 
                                    key={String(cat)}
                                    onClick={() => setResetModal(prev => ({ 
                                        ...prev, 
                                        categories: { ...prev.categories, [cat]: !prev.categories[cat] } 
                                    }))}
                                    className={cn(
                                        "w-full flex items-center justify-between px-6 py-4 rounded-2xl border transition-all font-black uppercase tracking-widest text-[11px]",
                                        resetModal.categories[cat] 
                                            ? "bg-rose-500/10 border-rose-500 text-rose-600 shadow-lg shadow-rose-500/5" 
                                            : "bg-black/5 border-transparent text-muted opacity-60"
                                    )}
                                >
                                    <span>
                                        {cat === 'students' ? t.students :
                                         cat === 'groups' ? t.groups :
                                         cat === 'halls' ? t.halls :
                                         cat === 'plans' ? t.navSectionBilling :
                                         cat === 'teachers' ? t.teachers :
                                         cat === 'shop' ? t.navSectionShop :
                                         cat === 'analytics' ? t.navSectionAnalytics :
                                         cat === 'calendar' ? t.navSectionSchedule :
                                         t.navSectionNotifications}
                                    </span>
                                    <div className={cn(
                                        "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all",
                                        resetModal.categories[cat] ? "border-rose-600 bg-rose-600" : "border-muted"
                                    )}>
                                        {resetModal.categories[cat] && <ShieldCheck className="w-3 h-3 text-white" />}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setResetModal(prev => ({ ...prev, open: false }))} className="flex-1 py-4 bg-zinc-500/10 hover:bg-zinc-500/20 text-muted text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all">
                                {t.sa_studios_cancel}
                            </button>
                            <button 
                                onClick={confirmReset}
                                className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-rose-600/30"
                            >
                                {t.sa_studios_reset}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
