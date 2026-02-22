'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Users, CalendarCheck, BookOpen, Settings,
    Zap, LogOut, CreditCard, Receipt, GraduationCap, BarChart2,
    CalendarDays, Key, DoorOpen, X, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';
import { useMobileMenu } from '@/contexts/MobileMenuContext';
import { useStudio } from '@/contexts/StudioContext';
import { THEMES } from '@/lib/settings-store';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useState, useEffect } from 'react';

type NavItem = {
    href: string;
    labelKey: keyof ReturnType<typeof useT>['t'];
    icon: React.ComponentType<any>;
};

const ALL_ITEMS: NavItem[] = [
    { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
    { href: '/attendance', labelKey: 'attendance', icon: CalendarCheck },
    { href: '/students', labelKey: 'students', icon: Users },
    { href: '/calendar', labelKey: 'calendar', icon: CalendarDays },
    { href: '/groups', labelKey: 'groups', icon: BookOpen },
    { href: '/teachers', labelKey: 'teachers', icon: GraduationCap },
    { href: '/halls', labelKey: 'halls', icon: DoorOpen },
    { href: '/subscriptions', labelKey: 'subscriptions', icon: CreditCard },
    { href: '/hall-rental', labelKey: 'hallRental', icon: Key },
    { href: '/billing', labelKey: 'billing', icon: Receipt },
    { href: '/analytics', labelKey: 'analytics', icon: BarChart2 },
    { href: '/settings', labelKey: 'settings', icon: Settings },
];

const DIVIDER_BEFORE = new Set([4, 7, 10, 11]);

// ─── Main Sidebar Component ──────────────────────────────────────────────────

export function Sidebar() {
    const pathname = usePathname();
    const { t } = useT();
    const { isOpen, close } = useMobileMenu();
    const { settings } = useStudio();
    const theme = THEMES[settings.themeKey];

    const [expanded, setExpanded] = useState(false);
    useEffect(() => {
        const stored = localStorage.getItem('sf_sidebar_expanded');
        if (stored === 'true') setExpanded(true);
    }, []);

    function toggleExpanded() {
        setExpanded(v => {
            localStorage.setItem('sf_sidebar_expanded', String(!v));
            return !v;
        });
    }

    const getInitial = (name: string) => name.trim().charAt(0).toUpperCase();

    // ── Reusable logo block ──
    const LogoBlock = ({ exp }: { exp: boolean }) => (
        <div className={cn('flex items-center border-b border-white/[0.06] flex-shrink-0 py-[18px]', exp ? 'px-4 gap-3' : 'justify-center')}>
            {settings.logoDataUrl ? (
                <Image src={settings.logoDataUrl} alt="Logo" width={36} height={36} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
            ) : (
                <div className={`w-9 h-9 bg-gradient-to-br ${theme.from} ${theme.to} rounded-xl flex items-center justify-center shadow-lg flex-shrink-0`}>
                    {exp ? <Zap className="h-5 w-5 text-white" strokeWidth={2.5} /> : <span className="text-sm font-black text-white">{getInitial(settings.studioName)}</span>}
                </div>
            )}
            {exp && (
                <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-sm font-bold text-white leading-tight truncate">{settings.studioName}</p>
                    <p className="text-[10px] text-white/35 mt-0.5 truncate">{settings.studioSlug}</p>
                </div>
            )}
        </div>
    );

    // ── Reusable nav ──
    const NavItems = ({ exp }: { exp: boolean }) => (
        <nav className={cn('flex-1 py-2 overflow-y-auto no-scrollbar', exp ? 'px-2 space-y-0.5' : 'flex flex-col items-center gap-0.5')}>
            {ALL_ITEMS.map(({ href, labelKey, icon: Icon }, i) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                const label = t[labelKey] as string;

                return (
                    <div key={href} className={cn('w-full', !exp && 'flex flex-col items-center')}>
                        {DIVIDER_BEFORE.has(i) && (
                            exp ? <div className="h-px bg-white/[0.07] my-2 mx-1" />
                                : <div className="w-8 h-px bg-white/[0.07] my-1.5" />
                        )}
                        {exp ? (
                            <Link href={href} onClick={close}
                                className={cn(
                                    'flex items-center gap-3 px-3 min-h-[44px] rounded-xl text-[13px] font-semibold transition-all duration-150',
                                    active
                                        ? `${theme.bg} ${theme.text}`
                                        : 'text-white/55 hover:text-white/90 hover:bg-white/[0.06]'
                                )}>
                                <Icon className={cn('w-5 h-5 flex-shrink-0', active ? theme.text : 'text-white/30')} strokeWidth={active ? 2.5 : 2} />
                                <span className="flex-1 truncate">{label}</span>
                                {active && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme.text.replace('text-', 'bg-')}`} />}
                            </Link>
                        ) : (
                            <div className="relative group">
                                <Link href={href} onClick={close}
                                    className={cn(
                                        'w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-150 relative',
                                        active ? `${theme.bg} ${theme.text}` : 'text-white/35 hover:text-white/80 hover:bg-white/[0.07]'
                                    )}>
                                    {active && <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full ${theme.text.replace('text-', 'bg-')}`} />}
                                    <Icon className={cn('w-5 h-5', active ? theme.text : '')} strokeWidth={active ? 2.5 : 2} />
                                </Link>
                                <div className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-[#1e1e28] border border-white/[0.10] text-white/85 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
                                    {label}
                                    <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1e1e28]" />
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </nav>
    );

    // ── Bottom user block ──
    const UserBlock = ({ exp }: { exp: boolean }) => (
        <div className={cn('flex items-center p-3 border-t border-white/[0.06] flex-shrink-0', exp ? 'gap-3' : 'justify-center')}>
            <div className="relative group flex-shrink-0">
                <button className={`w-9 h-9 rounded-full bg-gradient-to-br ${theme.from} ${theme.to} flex items-center justify-center hover:ring-2 hover:ring-white/20 transition-all`}>
                    <span className="text-[11px] font-bold text-white">AK</span>
                </button>
                {!exp && (
                    <div className="pointer-events-none absolute left-[calc(100%+10px)] bottom-0 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-[#1e1e28] border border-white/[0.10] text-white/85 text-xs font-medium px-3 py-2.5 rounded-lg shadow-xl whitespace-nowrap">
                        <p className="font-semibold">Admin User</p>
                        <p className="text-white/40 text-[10px] mt-0.5">admin@studioflow.ge</p>
                        <div className="flex items-center gap-1.5 mt-2 text-red-400/70 text-[10px] cursor-pointer"><LogOut className="w-3 h-3" /> Logout</div>
                        <span className="absolute right-full bottom-3 border-4 border-transparent border-r-[#1e1e28]" />
                    </div>
                )}
            </div>
            {exp && (
                <>
                    <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="text-[13px] font-semibold text-white/80 truncate">Admin User</p>
                        <p className="text-[10px] text-white/35 truncate">admin@studioflow.ge</p>
                    </div>
                    <LogOut className="w-4 h-4 text-white/20 flex-shrink-0 cursor-pointer hover:text-red-400 transition-colors" />
                </>
            )}
        </div>
    );

    // ── Full sidebar ──
    const SidebarContent = ({ exp, isMobile = false }: { exp: boolean; isMobile?: boolean }) => (
        <aside className={cn(
            'relative h-full flex flex-col bg-base border-r border-white/[0.06] overflow-visible transition-all duration-300',
            exp ? 'w-60' : 'w-[72px]'
        )}>
            <LogoBlock exp={exp} />

            {/* Nav + midpoint toggle */}
            <div className="relative flex-1 overflow-hidden flex flex-col">
                <NavItems exp={exp} />

                {/* Language — compact when collapsed, flag only*/}
                <div className={cn('flex pb-2 flex-shrink-0', exp ? 'px-2' : 'justify-center')}>
                    <LanguageSwitcher compact={!exp} />
                </div>
            </div>

            {/* ── Midpoint toggle pull-tab ── */}
            {!isMobile && (
                <button
                    onClick={toggleExpanded}
                    title={exp ? 'დაკეცვა' : 'გაფართოება'}
                    className={cn(
                        'absolute z-20 top-1/2 -translate-y-1/2 -right-3',
                        'w-6 h-10 rounded-r-xl flex items-center justify-center',
                        'bg-[#1a1a24] border border-white/[0.10] border-l-0',
                        'text-white/30 hover:text-white/80 hover:bg-[#22222e]',
                        'transition-all duration-150 shadow-md',
                    )}
                >
                    <ChevronRight className={cn('w-3.5 h-3.5 transition-transform duration-300', exp && 'rotate-180')} />
                </button>
            )}

            <UserBlock exp={exp} />
        </aside>
    );

    return (
        <>
            {/* Desktop — sticky, width transitions */}
            <div className={cn('hidden md:flex flex-shrink-0 sticky top-0 h-screen transition-all duration-300 overflow-visible', expanded ? 'w-60' : 'w-[72px]')}>
                <SidebarContent exp={expanded} />
            </div>

            {/* Mobile backdrop */}
            <div
                className={cn('md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300', isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')}
                onClick={close}
            />
            {/* Mobile drawer — always expanded */}
            <div className={cn('md:hidden fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-out', isOpen ? 'translate-x-0' : '-translate-x-full')}>
                {/* Mobile close button in header */}
                <div className="absolute top-4 right-[-48px] z-50">
                    <button onClick={close} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.08] border border-white/[0.10] text-white/60 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <SidebarContent exp isMobile />
            </div>
        </>
    );
}
