'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
    Building2, Bell, Globe, Shield, CreditCard, Palette,
    Check, Camera, Save, Zap, Settings2, Link2, ExternalLink, Copy, Trash2, User, UserCircle, History, MessageCircle, LogOut as LogOutIcon, Plus, Send, RefreshCcw, ChevronDown, X, Pencil, AlertTriangle, Languages, CalendarDays, ShoppingBag, BarChart2, Eye, EyeOff, Download, Upload
} from 'lucide-react';
import { checkCloudConnection, syncStaffToCloud, masterStudioPurge } from '@/lib/sync-store';
import { addNotification } from '@/lib/notification-store';
import { validateImageSize, processProfileImage } from '@/lib/image-utils';
import { useT } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { useConfirm } from '@/contexts/ConfirmContext';
import { THEMES, type ThemeKey, ensureUniqueName, ensureUniqueSlug, convertFinancialData, removeFromRegistry, cleanupRegistry, migrateSlugData, addToRegistry, setActiveSlug } from '@/lib/settings-store';
import { cn, getInitials, compactSlugify, formatCurrency } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Logo } from '@/components/ui/Logo';

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={cn(
                'relative w-9 h-5 rounded-full transition-all duration-300 flex-shrink-0',
                checked ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'bg-muted/10'
            )}
            style={checked ? { background: 'hsl(var(--accent, 239 84% 67%))' } : undefined}
        >
            <div className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300',
                checked ? 'translate-x-4' : 'translate-x-0'
            )} />
        </button>
    );
}

function Section({ title, icon: Icon, children, defaultOpen = false }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; defaultOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="bg-card border border-border-subtle rounded-2xl md:rounded-3xl shadow-sm hover:shadow-md transition-all">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-5 py-4 md:px-6 md:py-5 bg-surface/10 hover:bg-surface/30 transition-colors group"
            >
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-2.5 rounded-xl md:rounded-2xl bg-indigo-500/5 text-indigo-500 group-hover:bg-indigo-500/10 transition-all">
                        <Icon className="w-4 h-4 md:w-5 md:h-5 transition-transform" />
                    </div>
                    <h2 className="text-sm md:text-base font-black text-primary tracking-tight">{title}</h2>
                </div>
                <div className={cn("p-1.5 md:p-2 rounded-lg md:rounded-xl text-muted group-hover:text-primary transition-all duration-300", isOpen ? "rotate-180" : "rotate-0")}>
                    <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
                </div>
            </button>
            <div className={cn(
                "divide-y divide-border-subtle/20 bg-card transition-all duration-300 ease-in-out",
                isOpen ? "max-h-[2000px] opacity-100 border-t border-border-subtle/30 overflow-visible" : "max-h-0 opacity-0 pointer-events-none overflow-hidden"
            )}>
                {children}
            </div>
        </div>
    );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6 px-5 py-4 md:px-6 md:py-5 hover:bg-surface/30 transition-colors group/row">
            <div className="flex-1 min-w-0 max-w-full sm:max-w-[480px]">
                <p className="text-xs md:text-[13px] font-bold text-primary tracking-tight group-hover/row:text-indigo-500 transition-colors">{label}</p>
                {sub && <p className="text-[10px] md:text-[11px] text-muted/70 mt-0.5 md:mt-1 leading-relaxed">{sub}</p>}
            </div>
            <div className="flex justify-end items-center sm:w-auto w-full mt-1 sm:mt-0 shadow-none">
                {children}
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
    const { t, lang, setLang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const { settings, isLoaded, setTheme, setStudioName, setStudioSlug, setLogo, setNotification, setSecurity, setCurrency, setLanguage, setTimezone, setGoogleCalendar, setPausePrice, updateStaff, removeStaff, addBranch, removeBranch, updateBranch, setCustomRoles, addStaff, setOwnerInfo } = useStudio();
    const { profile, user, logout } = useUser();
    const confirm = useConfirm();
    const isAdmin = profile?.role === 'superadmin' || profile?.role === 'owner' || profile?.role === 'admin';
    const isOwner = profile?.role === 'owner' || profile?.role === 'superadmin';
    const isSuperAdmin = profile?.role === 'superadmin';

    const [nameVal, setNameVal] = useState(settings.studioName);
    const [slugVal, setSlugVal] = useState(settings.studioSlug);
    const [copiedRegLink, setCopiedRegLink] = useState(false);
    const [branchModalOpen, setBranchModalOpen] = useState(false);
    const [newBranchName, setNewBranchName] = useState('');
    const [newBranchAddress, setNewBranchAddress] = useState('');
    const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
    const [newRoleName, setNewRoleName] = useState('');
    const [staffModalOpen, setStaffModalOpen] = useState(false);
    const [newStaff, setNewStaff] = useState({
        first_name: '',
        last_name: '',
        role: 'teacher',
        email: '',
        password: '',
        permissions: {
            canViewAttendance: true,
            canViewSubscriptions: false,
            canViewStudents: true,
            canViewCalendar: true,
            canEditCalendar: false,
            canViewGroups: true,
            canViewTeachers: true,
            canViewHalls: false,
            canViewShop: false,
            canViewAnalytics: false,
            canViewSMS: false,
        },
        allowedBranchIds: [] as string[]
    });


    // Use slugVal (live input) so the link preview updates as-you-type
    const registrationUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/${slugVal}/registration`
        : `/${slugVal}/registration`;

    const copyRegLink = () => {
        navigator.clipboard.writeText(registrationUrl).then(() => {
            setCopiedRegLink(true);
            setTimeout(() => setCopiedRegLink(false), 2000);
        });
    };
    const [nameSaved, setNameSaved] = useState(false);
    const [slugSaved, setSlugSaved] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [sessionVal, setSessionVal] = useState(settings.security.sessionTimeout);
    const fileRef = useRef<HTMLInputElement>(null);
    const importFileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (settings.studioName && !nameVal) {
            setNameVal(settings.studioName);
        }
        
        // Auto-fill slug if empty
        if (!slugVal && !settings.studioSlug) {
            if (nameVal && nameVal.toLowerCase() !== 'studio') {
                setSlugVal(compactSlugify(nameVal));
            } else if (settings.studioName && settings.studioName.toLowerCase() !== 'studio') {
                setSlugVal(compactSlugify(settings.studioName));
            }
        } else if (settings.studioSlug && !slugVal) {
            setSlugVal(settings.studioSlug);
        }
    }, [settings.studioName, settings.studioSlug, nameVal]);



    // Password Modal States
    const [showPwdModal, setShowPwdModal] = useState(false);
    const [pwdVal, setPwdVal] = useState('');
    const [pwdConfirmVal, setPwdConfirmVal] = useState('');
    const [pwdLoading, setPwdLoading] = useState(false);
    const [pwdError, setPwdError] = useState('');
    const [pwdSuccess, setPwdSuccess] = useState(false);
    const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
    const [branchToDeleteId, setBranchToDeleteId] = useState<string | null>(null);
    const [branchDeletePass, setBranchDeletePass] = useState('');
    const [branchDeleteError, setBranchDeleteError] = useState('');
    const [isDeletingBranch, setIsDeletingBranch] = useState(false);
    const [editingStaffData, setEditingStaffData] = useState<any>(null);
    const [showStaffPwd, setShowStaffPwd] = useState(false);

    // Sync local state when starting/stopping edit
    useEffect(() => {
        if (editingStaffId) {
            const member = settings.staff?.find((s: any) => s.id === editingStaffId);
            if (member) {
                setEditingStaffData(JSON.parse(JSON.stringify(member))); // Deep clone
            }
        } else {
            setEditingStaffData(null);
        }
    }, [editingStaffId, settings.staff]);





    function saveName() {
        if (!nameVal.trim()) return;
        const uniqueName = nameVal.trim();
        setStudioName(uniqueName);
        setNameVal(uniqueName);

        // Only superadmins can trigger slug changes, and we keep it safe
        if (isSuperAdmin) {
            const uniqueSlug = ensureUniqueSlug(uniqueName, settings.studioSlug);
            if (uniqueSlug !== settings.studioSlug) {
                // We DON'T auto-migrate here to avoid surprising the user
                // They should change the slug input explicitly if they want a URL change
            }
        }

        setNameSaved(true);
        setTimeout(() => setNameSaved(false), 2000);
    }

    async function saveSlug() {
        if (!slugVal || slugVal === settings.studioSlug) return;
        
        const ok = await confirm({
            title: l('მისამა