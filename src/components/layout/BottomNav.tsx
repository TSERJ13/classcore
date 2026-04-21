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
            className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#111114]/98 backdrop-blur-2xl border-t border-white/[0.05]"
            style={{ 
                paddingBottom: 'env(safe-area-inset-bottom, 6px)',
                transform: 'translateZ(0)',
                WebkitTransform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden'
            }}
        >
            <div className="flex items-center justify-around md:justify-evenly w-full max-w-5xl mx-auto px-1 pt-0.5 pb-0 h-[54px]">
                {navItems.map(({ href, labelKey, icon: Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + '/');
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                'flex flex-col items-center gap-1 px-1.5 py-0.5 rounded-xl transition-all duration-150 min-w-[60px] md:min-w-[100px] touch-manipulation',
                                active ? 'text-indigo-400' : 'text-white/35'
                            )}
                        >
                            <div className={cn('relative w-5 h-5 md:w-10 md:h-10 flex items-center justify-center', active && 'scale-110')}>
                                {active && <span className="absolute inset-0 scale-125 rounded-2xl bg-indigo-500/15" />}
                                <Icon className="relative w-5 h-5 md:w-8 md:h-8" strokeWidth={active ? 2.5 : 2} />
                            </div>
                            <span className="text-[7.5px] md:text-[11px] font-black uppercase tracking-widest truncate">{t[labelKey]}</span>
                        </Link>
                    );
                })}

                {/* "More" opens the full sidebar drawer */}
                <button
                    onClick={open}
                    className="flex flex-col items-center gap-1 px-1.5 py-0.5 rounded-xl text-white/35 hover:text-white/60 min-w-[60px] md:min-w-[100px] touch-manipulation transition-colors"
                >
                    <div className="w-5 h-5 md:w-10 md:h-10 flex items-center justify-center">
                        <Menu className="w-5 h-5 md:w-8 md:h-8" strokeWidth={2} />
                    </div>
                    <span className="text-[7.5px] md:text-[11px] font-black uppercase tracking-widest">{t.more}</span>
                </button>
            </div>
        </nav>
    );
}
