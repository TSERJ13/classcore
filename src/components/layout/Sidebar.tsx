'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Users, CalendarCheck, BookOpen, Settings,
    CreditCard, Receipt, GraduationCap, BarChart2,
    CalendarDays, DoorOpen, ChevronRight, LucideIcon, ShoppingBag, MessageSquare,
    Building2, Plus, Check, LogOut, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';
import { useMobileMenu } from '@/contexts/MobileMenuContext';
import { useStudio } from '@/contexts/StudioContext';
import { THEMES } from '@/lib/settings-store';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@/hooks/useUser';

type NavItem = {
    href: string;
    labelKey: keyof ReturnType<typeof useT>['t'];
    icon: LucideIcon;
};

const ALL_ITEMS: (NavItem & { color: string })[] = [
    { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard, color: 'text-emerald-500' },
    { href: '/attendance', labelKey: 'attendance', icon: CalendarCheck, color: 'text-blue-500' },
    { href: '/subscriptions', labelKey: 'subscriptions', icon: CreditCard, color: 'text-indigo-500' },
    { href: '/students', labelKey: 'students', icon: Users, color: 'text-sky-500' },
    { href: '/calendar', labelKey: 'calendar', icon: CalendarDays, color: 'text-violet-500' },
    { href: '/groups', labelKey: 'groups', icon: BookOpen, color: 'text-purple-500' },
    { href: '/teachers', labelKey: 'teachers', icon: GraduationCap, color: 'text-amber-500' },
    { href: '/halls', labelKey: 'halls', icon: DoorOpen, color: 'text-rose-500' },
    { href: '/shop', labelKey: 'shop', icon: ShoppingBag, color: 'text-pink-500' },
    { href: '/history', labelKey: 'history', icon: Receipt, color: 'text-zinc-400' },
    { href: '/analytics', labelKey: 'analytics', icon: BarChart2, color: 'text-orange-500' },
    { href: '/sms-manager', labelKey: 'sms_manager', icon: MessageSquare, color: 'text-cyan-500' },
    { href: '/billing', labelKey: 'billing', icon: Zap, color: 'text-yellow-500' },
    { href: '/settings', labelKey: 'settings', icon: Settings, color: 'text-slate-400' },
];

// ── Studio Header Block with Hover Branch Switcher ──
function StudioBlock({ exp, isMobile, settings, activeBranchId, setActiveBranch, t, lang, profile, user, theme, setBranchModalOpen }: any) {
    const [isHovered, setIsHovered] = useState(false);

    const allowedBranches = useMemo(() => {
        return settings.branches.filter((b: any) => {
            if (!profile?.allowedBranchIds || profile.allowedBranchIds.length === 0) return true;
            return profile.allowedBranchIds.includes(b.id);
        });
    }, [settings.branches, profile?.allowedBranchIds]);

    const activeBranch = settings.branches.find((b: any) => b.id === activeBranchId) || settings.branches[0];
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const getInitial = (name: string) => name?.trim().charAt(0).toUpperCase() || 'S';

    return (
        <div className={cn("relative border-b border-[var(--sidebar-border)] bg-white/[0.01] px-4", isMobile ? "py-2.5" : "py-3 md:py-6")}>
            <div className="flex items-center gap-3">
                <div
                    className={cn(
                        "rounded-2xl flex items-center justify-center transition-all overflow-hidden shadow-xl border-2 shrink-0 group-hover:scale-105",
                        isMobile ? "w-16 h-16" : (exp ? "w-16 h-16" : "w-10 h-10"),
                        !settings?.logoDataUrl ? "bg-accent/10 border-accent/20" : "bg-card border-border-subtle shadow-inner"
                    )}
                    style={settings?.logoDataUrl ? { borderColor: theme.accentHex, borderWidth: isMobile ? '2px' : '3px' } : { backgroundColor: `${theme.accentHex}1a`, borderColor: `${theme.accentHex}33` }}
                >
                    {settings?.logoDataUrl ? (
                        <img src={settings.logoDataUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-lg font-black" style={{ color: theme.accentHex }}>{getInitial(settings?.studioName || '')}</span>
                    )}
                </div>

                <div className={cn(
                    "flex flex-col justify-center h-12 transition-all duration-300 min-w-0 flex-1 py-0.5",
                    exp ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                )}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={cn("font-black text-white truncate tracking-tight leading-tight", isMobile ? "text-[12.5px]" : "text-[16px]")}>
                            {settings?.studioName || profile?.studio_name || 'Studio'}
                        </span>
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation(); e.preventDefault();
                            if (exp) setIsHovered(!isHovered);
                        }}
                        className={cn(
                            "flex items-center gap-1.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all group/branch-btn w-fit max-w-full",
                            isMobile ? "py-0.5 px-2" : "py-1.5",
                            isHovered && "border-indigo-500/40 bg-indigo-500/10"
                        )}
                    >
                        <Building2 className={cn("transition-colors", isMobile ? "w-2.5 h-2.5" : "w-3.5 h-3.5", isHovered ? "text-indigo-400" : "text-white/40")} />
                        <span className={cn("font-black tracking-tight truncate max-w-[120px]", isHovered ? "text-indigo-400" : "text-white/60", isMobile ? "text-[9px]" : "text-[11px]")}>
                            {activeBranch?.id === 'main' ? t.mainBranch : activeBranch?.name}
                        </span>
                        <ChevronRight className={cn("transition-all text-white/20", isMobile ? "w-1.5 h-1.5" : "w-3 h-3", isHovered && "rotate-90 text-indigo-400")} />
                    </button>
                </div>
            </div>

            {/* Click/Toggle Reveal Branch List */}
            {exp && (
                <div className={cn(
                    "absolute left-4 right-4 top-[94%] z-50 bg-[#1c1c28] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300 origin-top",
                    isHovered ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
                )}>
                    <div className="p-2 space-y-1">
                        {allowedBranches.map((branch: any) => (
                            <button
                                key={branch.id}
                                onClick={() => {
                                    setActiveBranch(branch.id);
                                    setIsHovered(false);
                                }}
                                className={cn(
                                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all",
                                    branch.id === activeBranchId
                                        ? "bg-indigo-500/10 text-indigo-400"
                                        : "hover:bg-white/5 text-white/50 hover:text-white"
                                )}
                            >
                                <span className="text-[11px] font-black truncate">{branch.name}</span>
                                {branch.id === activeBranchId && <Check className="w-3 h-3" strokeWidth={3} />}
                            </button>
                        ))}

                        {(profile?.role === 'owner' || profile?.role === 'admin') && (
                            <button
                                onClick={() => {
                                    setBranchModalOpen(true);
                                    setIsHovered(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-all border border-indigo-500/20 mt-1"
                            >
                                <Plus className="w-3 h-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest">{t.newBranch || 'New Branch'}</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Nav Items ──
function NavItems({ exp, isMobile, profile, pathname, theme, t, close, defaultRole }: any) {
    return (
        <nav className="flex-1 py-1 overflow-y-auto no-scrollbar transition-all duration-300 px-2 space-y-0.5">
            {ALL_ITEMS.filter(item => {
                const role = profile?.role || defaultRole;
                if (role === 'owner' || role === 'manager' || role === 'admin' || !role) return true;

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
                    '/billing': 'canViewBilling',
                };

                const permKey = mapping[item.href];
                if (permKey) return !!(profile as any)?.[permKey];

                const adminOnly = ['/billing', '/settings'];
                if (adminOnly.includes(item.href)) {
                    return (profile?.role === 'owner' || profile?.role === 'manager' || profile?.role === 'admin' || !profile?.role);
                }

                if (isMobile || (typeof window !== 'undefined' && window.innerWidth < 1024)) {
                    const ESSENTIAL_MOBILE = ['/dashboard', '/attendance', '/students', '/settings'];
                    return ESSENTIAL_MOBILE.includes(item.href);
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
                                'flex items-center rounded-xl transition-[background-color,color] duration-200 relative group/link w-full nav-item-dynamic',
                                isMobile ? 'h-8 pl-2 gap-1.5' : 'h-10 lg:h-11 pl-3 lg:pl-4 gap-3 lg:gap-3.5',
                                active ? `${theme.bg} ${theme.text}` : 'text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]'
                            )}
                        >
                            {!exp && active && (
                                <span className={cn('absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.5)]', theme.text.replace('text-', 'bg-'))} />
                            )}
                            <div className={cn(
                                "flex-shrink-0 flex items-center justify-center rounded-lg transition-all duration-300",
                                isMobile ? "w-6 h-6" : "w-7 h-7 lg:w-8 h-8",
                                !active && "group-hover/link:bg-white/5",
                                active && "bg-white/10"
                            )}>
                                <Icon className={cn('transition-all duration-200', isMobile ? "w-3.5 h-3.5" : "w-[21px] h-[21px]", active ? 'scale-110' : 'group-hover/link:scale-110 opacity-70 group-hover/link:opacity-100', !active && (ALL_ITEMS[i] as any).color)} strokeWidth={active ? 3 : 2} />
                            </div>
                            {exp && (
                                <span className={cn(
                                    "truncate font-black transition-all duration-300 opacity-100 max-w-[170px] tracking-tight nav-item-text-dynamic", 
                                    isMobile ? "text-[8.1px]" : href === '/dashboard' ? "text-[16px]" : "text-[14.5px]"
                                )}>
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
}

// ── Sidebar Content Wrapper ──
function SidebarContent({ exp, isMobile, mounted, defaultExpanded, settings, activeBranchId, setActiveBranch, t, lang, profile, user, theme, setBranchModalOpen, pathname, close, defaultRole, logout, toggleExpanded }: any) {
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    return (
        <aside
            suppressHydrationWarning
            className={cn(
                'relative h-full flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] transition-[width] duration-300 ease-in-out shadow-2xl',
                isMobile ? 'pt-4 pb-safe' : 'pt-0',
                exp ? (isMobile ? 'w-[230px]' : 'w-[280px]') : 'w-[72px]'
            )}
        >
            {!mounted && defaultExpanded === null ? (
                <div className="flex-1 flex flex-col animate-in fade-in duration-500">
                    <div className="px-4 py-6 border-b border-[var(--sidebar-border)] bg-white/[0.01]">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 shrink-0" />
                            {exp && (
                                <div className="flex-1 space-y-2">
                                    <div className="w-2/3 h-4 bg-white/5 rounded-md" />
                                    <div className="w-1/2 h-3 bg-white/5 rounded-md opacity-50" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <StudioBlock
                        exp={exp} isMobile={isMobile} settings={settings} activeBranchId={activeBranchId}
                        setActiveBranch={setActiveBranch} t={t} lang={lang}
                        profile={profile} user={user} theme={theme} setBranchModalOpen={setBranchModalOpen}
                    />

                    <div className="relative flex-1 overflow-hidden flex flex-col no-scrollbar">
                        <NavItems exp={exp} isMobile={isMobile} profile={profile} pathname={pathname} theme={theme} t={t} close={close} defaultRole={defaultRole} />
                    </div>

                    <div className={cn(
                        "mt-auto border-t border-[var(--sidebar-border)] bg-black/10 transition-all shadow-[0_-4px_12px_rgba(0,0,0,0.1)]",
                        exp ? (isMobile ? "p-3 pb-20" : "p-4 pb-6") : (isMobile ? "py-4 pb-20" : "py-4")
                    )}>
                        <div className={cn(
                            "flex items-center bg-white/[0.03] border border-white/5 rounded-2xl p-0.5",
                            !exp && "flex-col bg-transparent border-none"
                        )}>
                            <LanguageSwitcher 
                                compact={!exp} 
                                mode="session" 
                                align="left" 
                                className={cn(
                                    exp ? "flex-1 hover:bg-white/[0.05] h-9 px-3" : "w-8.5 h-8.5 bg-white/5 rounded-xl",
                                    isMobile && "scale-[0.80] origin-left"
                                )} 
                            />
                            

                             {exp && <div className="w-px h-5 bg-white/10 shrink-0 mx-1" />}

                            <button
                                onClick={logout}
                                className={cn(
                                    "flex items-center justify-center transition-all duration-200 text-rose-500 hover:bg-rose-500/10 active:scale-95 group/logout shrink-0",
                                    exp ? (isMobile ? "w-9 h-9" : "w-10 h-9") : "w-8.5 h-8.5 rounded-xl bg-white/5 mt-2"
                                )}
                                title={l('გასვლა', 'Выйти', 'Logout')}
                            >
                                <LogOut className="w-3.5 h-3.5 transition-transform duration-300 group-hover/logout:-translate-x-0.5" strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </aside>
    );
}

export function Sidebar({ defaultExpanded = null, defaultRole = null }: { defaultExpanded?: boolean | null; defaultRole?: string | null }) {
    const pathname = usePathname();
    const { t, lang } = useT();
    const { isOpen, close } = useMobileMenu();
    const { settings, activeBranchId, setActiveBranch, addBranch } = useStudio();
    const { profile, user, logout } = useUser();
    const theme = THEMES[settings.themeKey] || THEMES.indigo;

    const [expanded, setExpanded] = useState(defaultExpanded ?? true);
    const [mounted, setMounted] = useState(false);
    const [branchModalOpen, setBranchModalOpen] = useState(false);
    const [newBranchName, setNewBranchName] = useState('');
    const [newBranchAddress, setNewBranchAddress] = useState('');

    useEffect(() => {
        setMounted(true);
        if (defaultExpanded === null && typeof window !== 'undefined') {
            const stored = localStorage.getItem('cc_sidebar_expanded');
            if (stored !== null) setExpanded(stored === 'true');
            else if (window.innerWidth <= 1024) setExpanded(false);
        }
    }, [defaultExpanded]);

    const toggleExpanded = () => {
        setExpanded(v => {
            const next = !v;
            localStorage.setItem('cc_sidebar_expanded', String(next));
            document.cookie = `cc_sidebar_expanded=${next}; path=/; max-age=31536000`;
            return next;
        });
    };

    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    return (
        <>
            <div className={cn('hidden md:block transition-[width] duration-300 ease-in-out flex-shrink-0', expanded ? 'w-[280px]' : 'w-[72px]')}>
                <div className={cn('fixed left-0 top-0 bottom-0 z-40 h-full overflow-visible transition-[width] duration-300 ease-in-out', expanded ? 'w-[280px]' : 'w-[72px]')}>
                    <SidebarContent
                        exp={expanded} isMobile={false} mounted={mounted} defaultExpanded={defaultExpanded} settings={settings}
                        activeBranchId={activeBranchId} setActiveBranch={setActiveBranch} t={t} lang={lang}
                        profile={profile} user={user} theme={theme} setBranchModalOpen={setBranchModalOpen}
                        pathname={pathname} close={close} defaultRole={defaultRole} logout={logout} toggleExpanded={toggleExpanded}
                    />
                    {mounted && (
                        <button
                            onClick={toggleExpanded}
                            className={cn(
                                'absolute z-50 top-1/2 -translate-y-1/2 -right-3.5 w-7 h-11 rounded-r-xl flex items-center justify-center bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)] border-l-0 text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] transition-all duration-150 shadow-[4px_0_10px_rgba(0,0,0,0.2)] transform active:scale-95'
                            )}
                        >
                            <ChevronRight className={cn('w-4 h-4 transition-transform duration-300', expanded && 'rotate-180')} />
                        </button>
                    )}
                </div>
            </div>

            <div className={cn('fixed inset-0 bg-black/20 z-[90] md:hidden transition-opacity duration-300', isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')} onClick={close} />

            <div className={cn('fixed left-0 top-0 bottom-0 z-[100] md:hidden transition-transform duration-300 ease-in-out w-[230px]', isOpen ? 'translate-x-0' : '-translate-x-full')}>
                <SidebarContent
                    exp={true} isMobile={true} mounted={mounted} defaultExpanded={defaultExpanded} settings={settings}
                    activeBranchId={activeBranchId} setActiveBranch={setActiveBranch} t={t} lang={lang}
                    profile={profile} user={user} theme={theme} setBranchModalOpen={setBranchModalOpen}
                    pathname={pathname} close={close} defaultRole={defaultRole} logout={logout} toggleExpanded={toggleExpanded}
                />
            </div>

            {branchModalOpen && (profile?.role === 'owner' || profile?.role === 'admin') && (
                <>
                    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setBranchModalOpen(false)} />
                    <div className={cn(
                        "fixed z-[101] flex flex-col bg-card shadow-2xl transition-all duration-300 overflow-hidden",
                        "inset-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-[2.5rem]",
                        "animate-in zoom-in-95 sm:zoom-in-95"
                    )}>
                        {/* Header */}
                        <div className="p-6 border-b border-border-subtle bg-card/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between sm:hidden">
                            <h2 className="text-sm font-black text-primary uppercase tracking-widest">{l('ახალი ფილიალი', 'Новый филиал', 'Add New Branch')}</h2>
                            <button onClick={() => setBranchModalOpen(false)} className="p-2 text-muted"><Plus className="w-5 h-5 rotate-45" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-6 overscroll-contain">
                            <div className="flex flex-col items-center text-center gap-2">
                                <Building2 className="w-8 h-8 text-indigo-500 mb-2" />
                                <h3 className="text-xl font-black text-primary">{l('ახალი ფილიალი', 'Новый филиალ', 'Add New Branch')}</h3>
                            </div>
                            <div className="space-y-4 text-left">
                                <div>
                                    <label className="text-[10px] font-black text-muted tracking-widest block mb-2 opacity-50 uppercase">{l('სახელი', 'Имя', 'Name')}</label>
                                    <input autoFocus value={newBranchName} onChange={e => setNewBranchName(e.target.value)} placeholder={l('სახელი', 'Имя', 'Name')} className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-[12px] sm:text-sm font-bold focus:outline-none focus:border-indigo-500/50" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-muted tracking-widest block mb-2 opacity-50 uppercase">{l('მისამართი', 'Адрес', 'Address')}</label>
                                    <input value={newBranchAddress} onChange={e => setNewBranchAddress(e.target.value)} placeholder={l('მისამართი', 'Адрес', 'Address')} className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-3 text-[12px] sm:text-sm font-bold focus:outline-none focus:border-indigo-500/50" />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-card/80 backdrop-blur-md border-t border-border-subtle flex gap-3 sticky bottom-0 z-10 pb-safe-offset-2">
                            <button onClick={() => setBranchModalOpen(false)} className="flex-1 py-3 bg-surface text-muted rounded-xl border border-border-subtle text-xs font-black uppercase tracking-widest">{l('გაუქმება', 'Отмена', 'Cancel')}</button>
                            <button
                                onClick={() => {
                                    if (newBranchName.trim()) {
                                        addBranch(newBranchName.trim(), newBranchAddress.trim());
                                        setBranchModalOpen(false);
                                        setNewBranchName('');
                                        setNewBranchAddress('');
                                    }
                                }}
                                className="flex-2 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase shadow-xl shadow-indigo-600/20 active:scale-95 transition-all tracking-widest"
                            >
                                {l('შექმნა', 'Создать', 'Create')}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}

