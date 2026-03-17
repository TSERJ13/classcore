'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Users, CalendarCheck, CalendarDays,
    BookOpen, Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobileMenu } from '@/contexts/MobileMenuContext';
import { useT } from '@/contexts/LanguageContext';

export function BottomNav() {
    const pathname = usePathname();
    const { open } = useMobileMenu();
    const { t } = useT();

    // 4 most common pages + "More" button that opens full sidebar
    const navItems = [
        { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
        { href: '/students', labelKey: 'students', icon: Users },
        { href: '/attendance', labelKey: 'attendance', icon: CalendarCheck },
        { href: '/calendar', labelKey: 'calendar', icon: CalendarDays },
    ] as const;

    return (
        <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#111114]/95 backdrop-blur-xl border-t border-white/[0.08]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="flex items-center justify-around px-1 py-1.5 h-16">
                {navItems.map(({ href, labelKey, icon: Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + '/');
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                'flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-150 min-w-[64px] touch-manipulation',
                                active ? 'text-indigo-400' : 'text-white/35'
                            )}
                        >
                            <div className={cn('relative w-6 h-6 flex items-center justify-center', active && 'scale-110')}>
                                {active && <span className="absolute inset-0 scale-150 rounded-xl bg-indigo-500/15" />}
                                <Icon className="relative w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
                            </div>
                            <span className="text-[9px] font-semibold truncate">{t[labelKey]}</span>
                        </Link>
                    );
                })}

                {/* "More" opens the full sidebar drawer */}
                <button
                    onClick={open}
                    className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl text-white/35 hover:text-white/60 min-w-[48px] touch-manipulation transition-colors"
                >
                    <div className="w-6 h-6 flex items-center justify-center">
                        <Menu className="w-5 h-5" strokeWidth={1.8} />
                    </div>
                    <span className="text-[9px] font-semibold">{t.more}</span>
                </button>
            </div>
        </nav>
    );
}
