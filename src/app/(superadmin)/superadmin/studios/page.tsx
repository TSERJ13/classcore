'use client';

import { useState, useEffect } from 'react';
import { Building2, Power, Search, ChevronDown, ArrowUpRight, LogIn, Trash2, Edit3, Settings, AlertTriangle, Plus, Minus, Wallet, Zap, Smartphone, X, ShieldCheck, RefreshCcw, ShieldAlert, RotateCcw } from 'lucide-react';
import { getBillingState, updateBillingState, recordPayment, getSaasReminderSms, extendSubscriptionByDays } from '@/lib/saas-billing';
import { logAction } from '@/lib/analytics';
import { getStudioRegistry, loadSettings, saveSettings, resetStudioData, migrateSlugData, clearAllStudioData, removeFromRegistry, type ResetCategories } from '@/lib/settings-store';
import { getScopedKey, cn, compactSlugify } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { pushStudioStateToCloud } from '@/lib/sync-store';

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

function loadStudio(slug: string): StudioRecord {
    const s = loadSettings(slug);
    const meta = (() => { try { return JSON.parse(localStorage.getItem(`cc_sa_meta_${slug}`) || '{}'); } catch { return {}; } })();
    const billing = getBillingState(slug);
    
    let studentCount = 0;
    try { 
        const key = getScopedKey('cc_student_data', slug);
        const raw = localStorage.getItem(key);
        if (raw) studentCount = Object.keys(JSON.parse(raw)).length; 
    } catch { }

    let subsCount = 0;
    try { 
        const key = getScopedKey('cc_student_subscriptions', slug);
        const raw = localStorage.getItem(key);
        if (raw) Object.values(JSON.parse(raw)).forEach((subs: unknown) => { if (Array.isArray(subs)) subsCount += subs.filter((s: { status?: string }) => s.status === 'active').length; }); 
    } catch { }
    
    const owner = s.staff.find(m => m.role === 'owner');
    
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
    try { const existing = JSON.parse(localStorage.getItem(`cc_sa_meta_${slug}`) || '{}'); localStorage.setItem(`cc_sa_meta_${slug}`, JSON.stringify({ ...existing, ...patch })); } catch { }
}

const PLAN_COLORS: Record<string, string> = { 
    trial: 'bg-zinc-500/10 text-zinc-500 dark:bg-zinc-700/50 dark:text-zinc-300', 
    pro: 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border-indigo-600', 
    custom: 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 border-amber-500' 
};
const PLAN_LABELS: Record<string, string> = {
    trial: 'ტრიალი (Trial)',
    pro: 'პრო (Pro)',
    custom: 'სპეციალური'
};
const PLAN_OPTIONS = ['trial', 'pro', 'custom'] as const;

export default function StudiosPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [lang, setLang] = useState<'ka' | 'en'>('ka');
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
    const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
    const [isPurging, setIsPurging] = useState(false);

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
            title: lang === 'ka' ? 'ტესტ-მონაცემების გასუფთავება' : 'Purge Test Data',
            message: lang === 'ka' 
                ? 'ნამდვილად გსურთ ყველა "load-test-*" სტუდიის წაშლა ბაზიდან? ეს ქმედება შეუქცევადია!'
                : 'Are you sure you want to delete all "load-test-*" studios from the database? This action is irreversible!',
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
                        
                        setModal({ type: 'alert', title: 'Success', message: `Purged ${data.deleted} test studios.` });
                        loadData();
                    } else {
                        throw new Error(data.error);
                    }
                } catch (err: any) {
                    setModal({ type: 'alert', title: 'Error', message: err.message });
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
    const [cloudStudios, setCloudStudios] = useState<any[]>([]);

    const syncFromCloud = async () => {
        setIsSyncing(true);
        try {
                const res = await fetch('/api/superadmin/studios/list');
                const data = await res.json();
                if (data.studios) {
                    setCloudStudios(data.studios);

                    // 0. Filter against the Blacklist (Ignore purged slugs for 10 min)
                    const blacklistRaw = localStorage.getItem('cc_sa_purge_blacklist') || '[]';
                    const now = Date.now();
                    const tenMinutes = 10 * 60 * 1000;
                    const blacklist = JSON.parse(blacklistRaw).filter((b: any) => now - b.timestamp < tenMinutes);
                    localStorage.setItem('cc_sa_purge_blacklist', JSON.stringify(blacklist)); // Cleanup stale
                    const blacklistedSlugs = blacklist.map((b: any) => b.slug);

                    const cloudSlugs = data.studios
                        .map((s: any) => s.slug)
                        .filter((s: string) => !blacklistedSlugs.includes(s));
                    
                    const existing = getStudioRegistry();
                
                // 1. SMART PRUNING: Remove slugs that were previously synced to cloud but are now missing
                const prunedList = existing.filter(slug => {
                    // Always keep the demo and our primary entry
                    if (slug === 'demo.classcore.ge') return true;
                    
                    // If it's in the cloud, keep it
                    if (cloudSlugs.includes(slug)) return true;
                    
                    // If it's NOT in the cloud, check if it was previously synced
                    const settingsKey = `cc_studio_settings_${slug}`;
                    const localDataExists = !!localStorage.getItem(settingsKey);
                    
                    const settings = loadSettings(slug);
                    const isPreviouslySynced = !!settings.orgId;
                    
                    // If it was synced but now it's gone from cloud list, it was deleted -> Prune it.
                    if (isPreviouslySynced) return false;
                    
                    // If it was never synced (Local Only), KEEP it ONLY if there's actual data.
                    // If there's no data (orphaned from a previous clear), PRUNE it from the registry.
                    return localDataExists;
                });

                // 2. Add new slugs discovered in cloud
                const newSlugs = cloudSlugs.filter((s: string) => !prunedList.includes(s));
                const nextList = [...prunedList, ...newSlugs];
                
                localStorage.setItem('cc_studios_list', JSON.stringify([...new Set(nextList)]));
                
                // Trigger local refresh
                loadData();
            }
        } catch (err) {
            console.error('Failed to sync from cloud:', err);
        } finally {
            setIsSyncing(false);
        }
    };

    const loadData = () => { 
        const registry = getStudioRegistry();
        const loaded: StudioRecord[] = registry.map(slug => {
            const s = loadSettings(slug);
            const meta = (() => { try { return JSON.parse(localStorage.getItem(`cc_sa_meta_${slug}`) || '{}'); } catch { return {}; } })();
            const billing = getBillingState(slug);
            
            let studentCount = 0;
            try { 
                const key = getScopedKey('cc_student_data', slug);
                const raw = localStorage.getItem(key);
                if (raw) studentCount = Object.keys(JSON.parse(raw)).length; 
            } catch { }

            // Find matching cloud data for owner info if local is missing
            const cloud = cloudStudios.find(c => c.slug === slug);
            const owner = s.owner_info || s.staff.find(m => m.role === 'owner');

            return { 
                slug, 
                name: s.studioName || cloud?.name || slug, 
                logoUrl: s.logoDataUrl || cloud?.logoUrl, 
                studentCount, 
                subsCount: 0, 
                suspended: meta.suspended || false, 
                isDeleted: meta.deleted || false, 
                notes: meta.notes || '', 
                plan: meta.plan || 'trial',
                nextDue: billing.nextDueDate, 
                status: billing.status, 
                daysOverdue: billing.daysOverdue,
                ownerPhone: owner?.phone || cloud?.ownerPhone || 'N/A',
                ownerEmail: owner?.email || cloud?.ownerEmail || 'N/A',
                ownerName: owner ? (('first_name' in owner) ? `${owner.first_name} ${owner.last_name}` : (owner as any).full_name) : cloud?.ownerName,
                isLocalOnly: !cloud // Set flag if not found in cloudStudios list
            };
        });
        setStudios(loaded);
    };

    useEffect(() => { 
        setMounted(true);
        const init = async () => {
            await syncFromCloud();
        };
        init();
        const storedLang = localStorage.getItem('cc_sa_lang') as 'ka' | 'en';
        if (storedLang) setLang(storedLang);
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
    };

    const setPlan = (slug: string, plan: string) => {
        const currentMeta = JSON.parse(localStorage.getItem(`cc_sa_meta_${slug}`) || '{}');
        const oldPlan = currentMeta.plan || 'trial';
        
        saveMeta(slug, { plan });
        setStudios(prev => prev.map(s => s.slug === slug ? { ...s, plan: plan as StudioRecord['plan'] } : s));
        setOpenMenu(null);

        // If switching FROM trial TO a paid plan, also trigger a manual activation/payment record
        if (oldPlan === 'trial' && plan !== 'trial') {
            setModal({
                type: 'confirm',
                title: lang === 'ka' ? 'გეგმის შეცვლა' : 'Change Plan',
                message: lang === 'ka' 
                    ? `სტუდია "${slug}" გადადის ფასიან გეგმაზე (${plan.toUpperCase()}). გსურთ საწყისი გადახდის დაფიქსირება და მომსახურების გააქტიურება?`
                    : `Studio "${slug}" is being moved from Trial to ${plan.toUpperCase()}. Record an initial payment and activate subscription?`,
                onConfirm: () => {
                    recordPayment(slug, 'cash', 49, 1);
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
        loadData(); // refresh list
    };

    const manualActivate = (slug: string) => {
        setModal({
            type: 'confirm',
            title: lang === 'ka' ? 'მექანიკური გააქტიურება' : 'Manual Activation',
            message: lang === 'ka'
                ? `ნამდვილად გსურთ 49₾ გადახდის დაფიქსირება სტუდიისთვის "${slug}" და ვადის 30 დღით გაგრძელება?`
                : `Manually record a 49 GEL payment for "${slug}" and extend subscription by 30 days?`,
            onConfirm: () => {
                recordPayment(slug, 'cash', 49, 1);
                loadData();
                setModal({ type: null, title: '', message: '' });
            }
        });
    };

    const sendReminder = (studio: StudioRecord) => {
        if (studio.ownerPhone === 'N/A') {
            setModal({
                type: 'alert',
                title: lang === 'ka' ? 'შეცდომა' : 'Error',
                message: lang === 'ka' ? 'მფლობელის ნომერი არ არის მითითებული.' : 'No owner phone number found.'
            });
            return;
        }

        const text = getSaasReminderSms('ka', 0);
        setModal({
            type: 'sms',
            title: lang === 'ka' ? 'სმს შეხსენება' : 'SMS Reminder',
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
                        setModal({ type: 'alert', title: lang === 'ka' ? 'წარმატება' : 'Success', message: lang === 'ka' ? 'შეხსენება გაიგზავნა!' : 'Reminder sent!' });
                    } else {
                        setModal({ type: 'alert', title: lang === 'ka' ? 'შეცდომა' : 'Error', message: lang === 'ka' ? 'SMS-ის გაგზავნა ვერ მოხერხდა.' : 'Failed to send SMS.' });
                    }
                } catch {
                    setModal({ type: 'alert', title: lang === 'ka' ? 'შეცდომა' : 'Error', message: lang === 'ka' ? 'ქსელური შეცდომა.' : 'Network error.' });
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

    const confirmReset = () => {
        const { slug, categories } = resetModal;
        setModal({
            type: 'confirm',
            title: lang === 'ka' ? 'მონაცემების გასუფთავება' : 'Data Reset',
            message: lang === 'ka' 
                ? `ნამდვილად გსურთ არჩეული კატეგორიების გასუფთავება სტუდიისთვის "${slug}"?`
                : `Are you sure you want to clear the selected categories for studio "${slug}"?`,
            onConfirm: () => {
                resetStudioData(slug, categories);
                setResetModal(prev => ({ ...prev, open: false }));
                setModal({ type: 'alert', title: lang === 'ka' ? 'წარმატება' : 'Success', message: lang === 'ka' ? 'მონაცემები გასუფთავდა!' : 'Data cleared successfully!' });
                loadData();
            }
        });
    };

    const moveToTrash = (slug: string) => {
        setModal({
            type: 'confirm',
            title: lang === 'ka' ? 'სტუდიის სანაგვეში გადატანა' : 'Move to Trash',
            message: lang === 'ka'
                ? `ნამდვილად გსურთ სტუდიის "${slug}" სანაგვეში გადატანა? მისი აღდგენა მოგვიანებით შესაძლებელი იქნება.`
                : `Are you sure you want to move the studio "${slug}" to the trash? You can restore it later.`,
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
            title: lang === 'ka' ? 'აღდგენილია' : 'Restored', 
            message: lang === 'ka' ? 'სტუდია აღდგენილია!' : 'Studio restored successfully!' 
        });
    };

    const purgeStudio = (slug: string) => {
        setModal({
            type: 'confirm',
            title: lang === 'ka' ? 'სამუდამოდ წაშლა' : 'Permanent Delete',
            message: lang === 'ka'
                ? `ყურადღება! სტუდია "${slug}" წაიშლება სამუდამოდ ბაზიდან. ეს ქმედება შეუქცევადია!`
                : `Warning! The studio "${slug}" will be permanently deleted from the database. This action cannot be undone!`,
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
                        title: lang === 'ka' ? 'წარმატება' : 'Success', 
                        message: lang === 'ka' ? 'სტუდია წაიშალა!' : 'Studio deleted successfully!' 
                    });
                } catch (err: any) {
                    console.error('❌ Failed to delete studio:', err);
                    setModal({ 
                        type: 'alert', 
                        title: lang === 'ka' ? 'შეცდომა' : 'Error', 
                        message: lang === 'ka' 
                            ? `წაშლა ვერ მოხერხდა: ${err.message}` 
                            : `Deletion failed: ${err.message}` 
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
                alert(lang === 'ka' ? `სლაგის განახლება ვერ მოხერხდა: ${err.message}` : `Failed to update slug: ${err.message}`);
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
            title: lang === 'ka' ? 'სანაგვის დაცლა' : 'Empty Trash',
            message: lang === 'ka' 
                ? `ნამდვილად გსურთ ყველა (${trashed.length}) წაშლილი სტუდიის სამუდამოდ წაშლა? ეს ქმედება საბოლოოა.`
                : `Are you sure you want to permanently delete all (${trashed.length}) trashed studios? This action is final.`,
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
                        title: lang === 'ka' ? 'წარმატება' : 'Success', 
                        message: lang === 'ka' ? 'სანაგვე გასუფთავდა!' : 'Trash emptied successfully!' 
                    });
                } catch (err: any) {
                    console.error('❌ Failed to empty trash:', err);
                    setModal({ 
                        type: 'alert', 
                        title: lang === 'ka' ? 'შეცდომა' : 'Error', 
                        message: lang === 'ka' ? `სანაგვის დაცლა ვერ მოხერხდა: ${err.message}` : `Failed to empty trash: ${err.message}` 
                    });
                }
            }
        });
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
                        {activeTab === 'active' 
                            ? (lang === 'ka' ? 'აქტიური სტუდიები' : 'Active Studios')
                            : (lang === 'ka' ? 'სანაგვე (Recycle Bin)' : 'Recycle Bin')}
                    </h1>
                    <p className="text-sm text-muted mt-1">
                        {filtered.length} {lang === 'ka' ? 'სტუდია მოიძებნა' : 'studios found'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {activeTab === 'trash' && filtered.length > 0 && (
                        <button 
                            onClick={emptyTrash}
                            className="group flex items-center gap-2 px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border border-rose-500/20 shadow-lg shadow-rose-500/5"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {lang === 'ka' ? 'სანაგვის დაცლა' : 'Empty Trash'}
                        </button>
                    )}

                    <button 
                        onClick={() => {
                            setModal({
                                type: 'confirm',
                                title: lang === 'ka' ? 'სისტემის სრული გასუფთავება' : 'Master System Reset',
                                message: lang === 'ka' 
                                    ? 'ყურადღება: ეს წაშლის ყველა სტუდიას და გაასუფთავებს ყველა მონაცემს. გსურთ გაგრძელება?'
                                    : 'WARNING: This will delete ALL studios and purge all associated data. Proceed?',
                                onConfirm: async () => {
                                    setModal(m => ({ ...m, loading: true }));
                                    try {
                                        const res = await fetch('/api/superadmin/system-reset', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ keepSlug: '___temp___' }) // Use a dummy slug that doesn't exist
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            setModal({ type: 'alert', title: 'Success', message: data.message });
                                            syncFromCloud();
                                        } else {
                                            setModal({ type: 'alert', title: 'Error', message: data.error || 'Reset failed' });
                                        }
                                    } catch (err) {
                                        setModal({ type: 'alert', title: 'Error', message: 'Network error' });
                                    }
                                }
                            });
                        }}
                        className="group flex items-center gap-2 px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border border-rose-500/20 shadow-lg shadow-rose-500/5"
                    >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {lang === 'ka' ? 'Master Reset' : 'Master Reset'}
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
                        {isSyncing ? (lang === 'ka' ? 'სინქრონიზაცია...' : 'Syncing...') : (lang === 'ka' ? 'ქლაუდ სინქრონიზაცია' : 'Cloud Sync')}
                    </button>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted opacity-40" />
                        <input 
                            value={search} 
                            onChange={e => setSearch(e.target.value)} 
                            placeholder={lang === 'ka' ? 'ძიება...' : 'Search studios...'} 
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
                    {lang === 'ka' ? 'აქტიური' : 'Active'}
                </button>
                <button 
                    onClick={() => setActiveTab('trash')}
                    className={cn(
                        "px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2",
                        activeTab === 'trash' ? "bg-white dark:bg-zinc-800 text-rose-500 shadow-sm border border-black/5 dark:border-border-subtle" : "text-muted hover:text-primary"
                    )}
                >
                    <Trash2 className="w-3 h-3" />
                    {lang === 'ka' ? 'სანაგვე' : 'Trash'}
                    {studios.filter(s => s.isDeleted).length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[8px] leading-none">
                            {studios.filter(s => s.isDeleted).length}
                        </span>
                    )}
                </button>
            </div>

            <div className="bg-white/95 border border-black/10 dark:border-border-subtle rounded-[2.5rem] shadow-sm overflow-x-auto no-scrollbar">
                <div className="grid grid-cols-[1.8fr_0.5fr_1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] gap-4 px-8 py-5 border-b border-black/5 dark:border-border-subtle/50 text-[10px] font-black text-muted uppercase tracking-widest bg-black/[0.02] dark:bg-zinc-500/5 items-center min-w-[1000px]">
                    <span>{lang === 'ka' ? 'სტუდია' : 'Studio'}</span>
                    <span className="text-center">{lang === 'ka' ? 'მოსწ.' : 'Stud.'}</span>
                    <span className="text-left px-2">{lang === 'ka' ? 'მფლობელი' : 'Owner'}</span>
                    <span className="text-left px-2">{lang === 'ka' ? 'საკონტაქტო' : 'Contact'}</span>
                    <span className="text-center">{lang === 'ka' ? 'გეგმა' : 'Plan'}</span>
                    <span className="text-center">{lang === 'ka' ? 'ბალანსი' : 'Bal.'}</span>
                    <span className="text-center">{lang === 'ka' ? 'ვადა' : 'Add'}</span>
                    <span className="text-center">{lang === 'ka' ? 'სტატუსი' : 'Status'}</span>
                    <span className="text-right">{lang === 'ka' ? 'მართვა' : 'Actions'}</span>
                </div>
                {filtered.length === 0 ? (
                    <div className="py-24 text-center text-muted">
                        <Building2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="text-sm font-black uppercase tracking-[0.2em]">
                            {activeTab === 'active' 
                                ? (lang === 'ka' ? 'სტუდიები არ მოიძებნა' : 'No studios found')
                                : (lang === 'ka' ? 'სანაგვე ცარიელია' : 'Recycle bin is empty')}
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
                                                            Local Only
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="text-center">
                                            <span className="text-base font-black text-primary dark:text-white tabular-nums">{studio.studentCount}</span>
                                            <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest">{lang === 'ka' ? 'მოსწავლე' : 'stud.'}</p>
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
                                                {PLAN_LABELS[studio.plan]}<ChevronDown className="w-2.5 h-2.5 opacity-50" />
                                            </button>
                                            {openMenu === studio.slug + '_plan' && (
                                                <div className="absolute z-[100] top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-black/10 dark:border-border-subtle rounded-2xl overflow-hidden shadow-2xl min-w-[150px] animate-in slide-in-from-top-2 duration-200">
                                                    {PLAN_OPTIONS.map(p => (
                                                        <button key={p} onClick={() => setPlan(studio.slug, p)} className={cn(
                                                            'w-full px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest hover:bg-black/5 dark:hover:bg-zinc-500/10 transition-colors border-l-2', 
                                                            studio.plan === p ? 'text-indigo-500 border-indigo-500 bg-indigo-500/5' : 'text-muted border-transparent'
                                                        )}>
                                                            {PLAN_LABELS[p]}
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
                                                        title: lang === 'ka' ? 'ბალანსი' : 'Balance',
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
                                                        title: lang === 'ka' ? 'ვადის გაგრძელება' : 'Extend Validity',
                                                        message: lang === 'ka' ? `რამდენი დღით გსურთ ვადის გაგრძელება?` : `How many days to add?`,
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
                                                + {lang === 'ka' ? 'დღე' : 'Days'}
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
                                                    <button onClick={() => sendReminder(studio)} className="p-2 text-zinc-400 hover:text-amber-500 transition-colors" title={lang === 'ka' ? 'შეხსენება' : 'Reminder'}>
                                                        <Smartphone className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => impersonate(studio.slug)} className="p-2 text-zinc-400 hover:text-emerald-500 transition-colors" title={lang === 'ka' ? 'შესვლა' : 'Impersonate'}>
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
                                                        title={lang === 'ka' ? 'მართვა' : 'Control'}
                                                    >
                                                        <Settings className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => moveToTrash(studio.slug)}
                                                        className="p-2 text-zinc-300 hover:text-rose-500 transition-colors"
                                                        title={lang === 'ka' ? 'სანაგვეში გადატანა' : 'Move to Trash'}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <button 
                                                        onClick={() => restoreFromTrash(studio.slug)}
                                                        className="p-2 text-zinc-300 hover:text-emerald-500 transition-colors"
                                                        title={lang === 'ka' ? 'აღდგენა' : 'Restore'}
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => purgeStudio(studio.slug)}
                                                        className="p-2 text-zinc-300 hover:text-rose-600 transition-colors"
                                                        title={lang === 'ka' ? 'სამუდამოდ წაშლა' : 'Purge Forever'}
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
                                                        <input autoFocus value={noteVal} onChange={e => setNoteVal(e.target.value)} placeholder="შიდა ჩანაწერი / შენიშვნა..." className="flex-1 bg-surface border border-border-subtle rounded-2xl px-5 py-3 text-xs text-primary placeholder:text-muted outline-none focus:border-indigo-500/50 shadow-inner" />
                                                        <button onClick={() => saveNote(studio.slug)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20">{lang === 'ka' ? 'შენახვა' : 'Save'}</button>
                                                        <button onClick={() => setEditingNote(null)} className="px-6 py-3 bg-surface hover:bg-muted/10 text-muted text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-border-subtle">{lang === 'ka' ? 'გაუქმება' : 'Cancel'}</button>
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

            {/* Full Control / Edit Profile Modal */}
            {editingProfile && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20" onClick={() => setEditingProfile(null)} />
                    <div className="relative bg-white/95 border border-black/10 dark:border-border-subtle rounded-[2.5rem] w-full max-w-lg p-10 animate-in zoom-in-95 duration-200 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar">
                        <div className="flex items-center justify-between mb-8">
                             <div>
                                <h3 className="text-2xl font-black text-primary tracking-tight">{lang === 'ka' ? 'სტუდიის მართვა' : 'Studio Management'}</h3>
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
                                    <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1">{lang === 'ka' ? 'ლოგო' : 'Studio Logo'}</p>
                                    <p className="text-xs text-muted/60 leading-tight mb-3">{lang === 'ka' ? 'ატვირთეთ ახალი ლოგო ან შეცვალეთ არსებული. რეკომენდებულია კვადრატული ფორმა.' : 'Upload a new logo or replace the existing one. Square format recommended.'}</p>
                                    <button onClick={() => setProfileLogo('')} className="text-[10px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-widest">{lang === 'ka' ? 'ლოგოს წაშლა' : 'Remove Logo'}</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">{lang === 'ka' ? 'სტუდიის დასახელება' : 'Studio Name'}</label>
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
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">{lang === 'ka' ? 'ბმული / Slug' : 'Studio Slug'}</label>
                                    <input 
                                        value={profileSlug} 
                                        onChange={e => setProfileSlug(compactSlugify(e.target.value))} 
                                        className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-primary transition-all shadow-inner" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">{lang === 'ka' ? 'მფლობელის სახელი' : 'Owner First Name'}</label>
                                    <input value={profileFirstName} onChange={e => setProfileFirstName(e.target.value)} className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-primary transition-all shadow-inner" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">{lang === 'ka' ? 'მფლობელის გვარი' : 'Owner Last Name'}</label>
                                    <input value={profileLastName} onChange={e => setProfileLastName(e.target.value)} className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-primary transition-all shadow-inner" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">{lang === 'ka' ? 'მფლობელის მეილი' : 'Owner Email'}</label>
                                    <input value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-primary transition-all shadow-inner" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-muted ml-1">{lang === 'ka' ? 'მფლობელის ნომერი' : 'Owner Phone'}</label>
                                    <input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} className="w-full bg-black/5 dark:bg-surface border border-black/5 dark:border-border-subtle/50 rounded-2xl px-5 py-3.5 outline-none focus:border-indigo-500/50 text-sm font-bold text-primary transition-all shadow-inner" />
                                </div>
                            </div>


                            <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl">
                                <p className="text-[10px] text-rose-600 dark:text-rose-500/70 font-bold leading-relaxed flex gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                    {lang === 'ka' 
                                        ? 'Slug-ის შეცვლა გამოიწვევს ყველა ადგილობრივი მონაცემის მიგრაციას და შეიძლება დაარღვიოს არსებული ლინკები!' 
                                        : 'Changing the slug will migrate all local storage data and break existing admin links!'}
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
                                    {lang === 'ka' ? 'სისტემური რესეტი (მონაცემების გასუფთავება)' : 'System Reset (Clear All Data)'}
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-10">
                            <button onClick={() => setEditingProfile(null)} className="flex-1 py-4 bg-surface hover:bg-zinc-500/10 text-muted text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all border border-border-subtle">{lang === 'ka' ? 'გაუქმება' : 'Cancel'}</button>
                            <button onClick={saveProfile} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-600/30">{lang === 'ka' ? 'შენახვა' : 'Save Changes'}</button>
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
                                        {lang === 'ka' ? 'გაუქმება' : 'Cancel'}
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
                                        {modal.loading ? '...' : (lang === 'ka' ? 'დადასტურება' : 'Confirm')}
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
                            {lang === 'ka' ? 'მონაცემების გასუფთავება' : 'Data Reset'}
                        </h3>
                        <p className="text-xs text-muted font-bold text-center mb-8">
                            {lang === 'ka' ? 'აირჩიეთ კატეგორიები, რომელთა გასუფთავებაც გსურთ:' : 'Select categories you want to clear:'}
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
                                        {cat === 'students' ? (lang === 'ka' ? 'მოსწავლეები' : 'Students') :
                                         cat === 'groups' ? (lang === 'ka' ? 'ჯგუფები' : 'Groups') :
                                         cat === 'halls' ? (lang === 'ka' ? 'დარბაზები' : 'Halls') :
                                         cat === 'plans' ? (lang === 'ka' ? 'ტარიფები' : 'Plans') :
                                         cat === 'teachers' ? (lang === 'ka' ? 'მასწავლებლები' : 'Teachers') :
                                         cat === 'shop' ? (lang === 'ka' ? 'მარაგი / მაღაზია' : 'Shop / Inventory') :
                                         cat === 'analytics' ? (lang === 'ka' ? 'ხარჯები / ანალიტიკა' : 'Analytics / Expenses') :
                                         cat === 'calendar' ? (lang === 'ka' ? 'განრიგი' : 'Calendar Events') :
                                         (lang === 'ka' ? 'შეტყობინებები' : 'Notifications')}
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
                                {lang === 'ka' ? 'გაუქმება' : 'Cancel'}
                            </button>
                            <button 
                                onClick={confirmReset}
                                className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-rose-600/30"
                            >
                                {lang === 'ka' ? 'გასუფთავება' : 'Clear Data'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
