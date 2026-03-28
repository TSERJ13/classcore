'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Users, CalendarCheck, BookOpen, Settings,
    CreditCard, Receipt, GraduationCap, BarChart2,
    CalendarDays, DoorOpen, ChevronRight, LucideIcon, ShoppingBag, MessageSquare, Copy, Zap, Building2, Plus, Check, LogOut, User as UserIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';
import { useMobileMenu } from '@/contexts/MobileMenuContext';
import { useStudio } from '@/contexts/StudioContext';
import { THEMES } from '@/lib/settings-store';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/hooks/useUser';
import { getBillingState } from '@/lib/saas-billing';

type NavItem = {
    href: string;
    labelKey: keyof ReturnType<typeof useT>['t'];
    icon: LucideIcon;
};

const ALL_ITEMS: NavItem[] = [
    { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
    { href: '/attendance', labelKey: 'attendance', icon: CalendarCheck },
    { href: '/subscriptions', labelKey: 'subscriptions', icon: CreditCard },
    { href: '/students', labelKey: 'students', icon: Users },
    { href: '/calendar', labelKey: 'calendar', icon: CalendarDays },
    { href: '/groups', labelKey: 'groups', icon: BookOpen },
    { href: '/teachers', labelKey: 'teachers', icon: GraduationCap },
    { href: '/halls', labelKey: 'halls', icon: DoorOpen },
    { href: '/shop', labelKey: 'shop', icon: ShoppingBag },
    { href: '/history', labelKey: 'history', icon: Receipt },
    { href: '/analytics', labelKey: 'analytics', icon: BarChart2 },
    { href: '/sms-manager', labelKey: 'sms_manager', icon: MessageSquare },
    { href: '/billing', labelKey: 'billing', icon: Zap },
    { href: '/settings', labelKey: 'settings', icon: Settings },
];

export function Sidebar({ defaultExpanded = null, defaultRole = null }: { defaultExpanded?: boolean | null; defaultRole?: string | null }) {
    const pathname = usePathname();
    const { t, lang } = useT();
    const { isOpen, close } = useMobileMenu();
    const { settings, activeBranchId, setActiveBranch, addBranch } = useStudio();
    const { profile, user, logout } = useUser();
    const activeRole = profile?.role || defaultRole;
    const theme = THEMES[settings.themeKey] || THEMES.indigo;

    const [expanded, setExpanded] = useState(defaultExpanded ?? true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Sync to cookie/localStorage for future consistency
        if (defaultExpanded === null) {
            if (typeof window !== 'undefined') {
                const stored = localStorage.getItem('cc_sidebar_expanded');
                if (stored !== null) {
                    setExpanded(stored === 'true');
                } else if (window.innerWidth <= 1024) {
                    setExpanded(false);
                }
            }
        }
    }, [defaultExpanded]);

    const [studioMenuOpen, setStudioMenuOpen] = useState(false);
    const [branchModalOpen, setBranchModalOpen] = useState(false);
    const [newBranchName, setNewBranchName] = useState('');
    const [newBranchAddress, setNewBranchAddress] = useState('');

    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    const toggleExpanded = () => {
        setExpanded(v => {
            const next = !v;
            localStorage.setItem('cc_sidebar_expanded', String(next));
            document.cookie = `cc_sidebar_expanded=${next}; path=/; max-age=31536000`;
            return next;
        });
    };

    const getInitial = (name: string) => name?.trim().charAt(0).toUpperCase() || 'S';

    // ── Studio Header Block with Hover Branch Switcher ──
    const StudioBlock = ({ exp }: { exp: boolean }) => {
        const [isHovered, setIsHovered] = useState(false);

        const allowedBranches = useMemo(() => {
            return settings.branches.filter(b => {
                if (!profile?.allowedBranchIds || profile.allowedBranchIds.length === 0) return true;
                return profile.allowedBranchIds.includes(b.id);
            });
        }, [settings.branches, profile?.allowedBranchIds]);

        const activeBranch = settings.branches.find(b => b.id === activeBranchId) || settings.branches[0];

        return (
            <div
                className="relative border-b border-[var(--sidebar-border)] bg-white/[0.01] px-4 py-6"
                onMouseEnter={() => exp && setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all overflow-hidden shadow-xl border-2 shrink-0",
                        !settings.logoDataUrl ? `bg-gradient-to-br ${theme.from} ${theme.to} border-white/20` : "bg-card border-border-subtle shadow-inner"
                    )} style={settings.logoDataUrl ? { borderColor: theme.accentHex } : {}}>
                        {settings.logoDataUrl ? (
                            <img src={settings.logoDataUrl} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-lg font-black text-white">{getInitial(settings.studioName)}</span>
                        )}
                    </div>

                    <div className={cn(
                        "flex flex-col items-start transition-all duration-300 min-w-0 flex-1",
                        exp ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                    )}>
                        <h1 className="text-[15px] font-black text-white/80 tracking-tight leading-tight truncate w-full">
                            {settings.studioName || 'Studio'}
                        </h1>

                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-black text-white/40 truncate max-w-[120px]">
                                {profile?.first_name} {profile?.last_name}
                            </span>
                            <span className={cn(
                                "px-1.5 py-0.5 rounded-md text-[7px] font-black tracking-wider border shrink-0",
                                (profile?.role || 'admin') === 'owner' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                    (profile?.role || 'admin') === 'manager' ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                                        "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                            )}>
                                {profile?.role || 'Staff'}
                            </span>
                        </div>

                        <button
                            className={cn(
                                "mt-2 flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all group/branch-btn",
                                isHovered && "border-indigo-500/40 bg-indigo-500/10"
                            )}
                        >
                            <Building2 className={cn("w-3 h-3 transition-colors", isHovered ? "text-indigo-400" : "text-white/40")} />
                            <span className={cn("text-[9px] font-black tracking-widest truncate max-w-[140px]", isHovered ? "text-indigo-400" : "text-white/60")}>
                                {activeBranch?.id === 'main' ? t.mainBranch : activeBranch?.name}
                            </span>
                            <ChevronRight className={cn("w-2.5 h-2.5 text-white/20 transition-all", isHovered && "rotate-90 text-indigo-400")} />
                        </button>
                    </div>
                </div>

                {/* Hover Reveal Branch List */}
                {exp && (
                    <div className={cn(
                        "absolute left-4 right-4 top-[94%] z-50 bg-[#1c1c28] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300 origin-top",
                        isHovered ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
                    )}>
                        <div className="p-2 space-y-1">
                            {allowedBranches.length > 0 && (
                                <div className="max-h-48 overflow-y-auto no-scrollbar space-y-1">
                                    {allowedBranches.map(branch => {
                                        const active = branch.id === activeBranchId;
                                        return (
                                            <button
                                                key={branch.id}
                                                onClick={() => {
                                                    setActiveBranch(branch.id);
                                                    setIsHovered(false);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group/branch",
                                                    active
                                                        ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                                                        : "hover:bg-white/5 text-white/60 hover:text-white"
                                                )}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <Building2 className={cn("w-3.5 h-3.5", active ? "text-white" : "opacity-40 group-hover/branch:opacity-100")} />
                                                    <span className="text-[11px] font-bold truncate tracking-tight">
                                                        {branch.id === 'main' ? t.mainBranch : branch.name}
                                                    </span>
                                                </div>
                                                {active && <Check className="w-3 h-3" strokeWidth={3} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {(profile?.role === 'owner' || profile?.role === 'admin') && (
                                <button
                                    onClick={() => {
                                        setBranchModalOpen(true);
                                        setIsHovered(false);
                                    }}
                                    className="w-full py-2 flex items-center justify-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors group/add-branch"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-black tracking-widest">{l('ფილიალის დამატება', 'Добавить филиал', 'Add Branch')}</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ── Reusable nav ──
    const NavItems = ({ exp }: { exp: boolean }) => (
        <nav className="flex-1 py-2 overflow-y-auto no-scrollbar transition-all duration-300 px-2 space-y-1">
            {ALL_ITEMS.filter(item => {
                // Admin/Owner see everything
                const role = profile?.role || defaultRole;
                if (role === 'owner' || role === 'manager' || role === 'admin' || !role) return true;

                // For staff, check granular permissions
                const mapping: Record<string, string> = {
                    '/attendance': 'canViewAttendance',
                    '/subscriptions': 'canViewSubscriptions',
                    '/students': 'canViewStudents',
                    '/calendar': 'canViewCalendar',
                    '/groups': 'canViewGroups',
                    '/teachers': 'canViewTeachers',
                    '/halls': 'canViewHalls',
                    '/shop': 'canViewShop',
                    '/analytics': 'canViewAnalytics',
                    '/sms-manager': 'canViewSMS',
                };

                const permKey = mapping[item.href];
                if (permKey) {
                    return !!(profile as any)?.[permKey];
                }

                // Hide restricted admin-only pages for anyone else
                const adminOnly = ['/billing', '/settings'];
                if (adminOnly.includes(item.href)) {
                    if (profile?.role === 'owner' || profile?.role === 'manager' || profile?.role === 'admin' || !profile?.role) return true;
                    return false;
                }

                return true;
            }).map(({ href, labelKey, icon: Icon }, i) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                    <div key={href} className="relative group w-full">
                        {i > 0 && [5, 8, 11].includes(i) && (
                            <div className="h-px bg-[var(--sidebar-border)] my-1.5 transition-all duration-300 mx-1.5" />
                        )}
                        <Link
                            href={href}
                            onClick={close}
                            className={cn(
                                'flex items-center rounded-xl transition-[background-color,color] duration-200 relative group/link h-11 w-full pl-5 gap-4',
                                active ? `${theme.bg} ${theme.text}` : 'text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]'
                            )}
                        >
                            {!exp && active && (
                                <span className={cn('absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full', theme.text.replace('text-', 'bg-'))} />
                            )}
                            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                                <Icon className={cn('w-5 h-5 transition-transform duration-200', active ? 'scale-110' : 'group-hover/link:scale-110')} strokeWidth={active ? 2.5 : 2} />
                            </div>
                            {exp && (
                                <span className="truncate text-[13px] font-semibold transition-all duration-300 opacity-100 max-w-[160px]">
                                    {t[labelKey]}
                                </span>
                            )}
                            {exp && active && (
                                <span className={cn('absolute right-3 w-1.5 h-1.5 rounded-full flex-shrink-0', theme.text.replace('text-', 'bg-'))} />
                            )}
                        </Link>
                    </div>
                );
            })}
        </nav>
    );

    const SidebarContent = ({ exp, isMobile = false }: { exp: boolean; isMobile?: boolean }) => (
        <aside 
            suppressHydrationWarning
            className={cn(
                'relative h-full flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] overflow-visible transition-[width] duration-300 ease-in-out',
                exp ? 'w-64' : 'w-[76px]'
            )}
        >
            {!mounted && defaultExpanded === null ? (
                <div className="flex-1 flex flex-col animate-in fade-in duration-500">
                    {/* Skeleton Header */}
                    <div className="px-4 py-6 border-b border-[var(--sidebar-border)] bg-white/[0.01]">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 animate-pulse shrink-0" />
                            {exp && (
                                <div className="flex-1 space-y-2">
                                    <div className="w-2/3 h-4 bg-white/5 rounded-md animate-pulse" />
                                    <div className="w-1/2 h-3 bg-white/5 rounded-md animate-pulse opacity-50" />
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Skeleton Nav */}
                    <div className="flex-1 p-2 space-y-2">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="flex items-center gap-3 px-4 h-11">
                                <div className="w-6 h-6 rounded-lg bg-white/5 animate-pulse shrink-0" />
                                {exp && <div className="flex-1 h-3 bg-white/5 rounded-md animate-pulse" />}
                            </div>
                        ))}
                    </div>
                    {/* Skeleton Footer */}
                    <div className="border-t border-[var(--sidebar-border)] bg-white/[0.02] flex items-center h-[60px] px-4">
                        <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
                    </div>
                </div>
            ) : (
                <>
                    <StudioBlock exp={exp} />
                    <div className="relative flex-1 overflow-hidden flex flex-col no-scrollbar">
                        <NavItems exp={exp} />
                    </div>
                    {!isMobile && (
                        <button
                            onClick={toggleExpanded}
                            className={cn(
                                'absolute z-30 top-1/2 -translate-y-1/2 -right-3 w-6 h-10 rounded-r-xl flex items-center justify-center bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)] border-l-0 text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] transition-all duration-150 shadow-md transform active:scale-95'
                            )}
                        >
                            <ChevronRight className={cn('w-3.5 h-3.5 transition-transform duration-300', exp && 'rotate-180')} />
                        </button>
                    )}
                    <div className="border-t border-[var(--sidebar-border)] bg-white/[0.02] flex items-center h-[60px] px-4">
                        <LanguageSwitcher compact={!exp} />
                        <div className={cn("flex-1 flex justify-center", exp ? "pl-4" : "hidden")}>
                            <button
                                onClick={logout}
                                className={cn(
                                    "w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200 text-rose-500 hover:bg-rose-500/10 active:scale-95 shrink-0",
                                    "bg-[var(--sidebar-hover)] border border-[var(--sidebar-border)] shadow-sm"
                                )}
                                title={l('გასვლა', 'Выйти', 'Logout')}
                            >
                                <LogOut className="w-4 h-4" strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </aside>
    );

    return (
        <>
            <div 
                suppressHydrationWarning
                className={cn('hidden md:flex flex-shrink-0 sticky top-0 h-screen transition-[width] duration-300 ease-in-out overflow-visible z-40', expanded ? 'w-64' : 'w-[76px]')}
            >
                <SidebarContent exp={expanded} />
            </div>
            <div className={cn('fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] md:hidden transition-opacity duration-300', isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')} onClick={close} />
            <div 
                suppressHydrationWarning
                className={cn('fixed left-0 top-0 bottom-0 z-[100] md:hidden transition-transform duration-300 ease-in-out w-64', isOpen ? 'translate-x-0' : '-translate-x-full')}
            >
                <SidebarContent exp={true} isMobile={true} />
            </div>

            {branchModalOpen && (profile?.role === 'owner' || profile?.role === 'admin') && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setBranchModalOpen(false)}>
                    <div className="bg-card border border-border-subtle rounded-[2rem] w-full max-w-sm p-8 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-center text-center gap-2">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-2">
                                <Building2 className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-primary tracking-tight">{l('ახალი ფილიალი', 'Новый филиал', 'Add New Branch')}</h3>
                        </div>
                        <div className="flex flex-col gap-3">
                            <input
                                autoFocus
                                value={newBranchName}
                                onChange={e => setNewBranchName(e.target.value)}
                                placeholder={l('ფილიალის სახელი', 'Название филиала', 'Branch Name')}
                                className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                            />
                            <input
                                value={newBranchAddress}
                                onChange={e => setNewBranchAddress(e.target.value)}
                                placeholder={l('მისამართი', 'Адрес', 'Address')}
                                className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                            />
                            <div className="flex gap-3 mt-2">
                                <button onClick={() => setBranchModalOpen(false)} className="flex-1 py-3 bg-surface text-muted text-xs font-black rounded-xl border border-border-subtle hover:bg-surface/80 transition-all tracking-widest">{l('გაუქმება', 'Отмена', 'Cancel')}</button>
                                <button
                                    onClick={() => {
                                        if (!newBranchName.trim()) return;
                                        addBranch(newBranchName.trim(), newBranchAddress.trim());
                                        setBranchModalOpen(false);
                                        setNewBranchName('');
                                        setNewBranchAddress('');
                                    }}
                                    className="flex-2 py-3 bg-indigo-600 text-white text-xs font-black rounded-xl shadow-xl active:scale-95 transition-all tracking-widest"
                                >
                                    {l('შექმნა', 'Создать', 'Create')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
