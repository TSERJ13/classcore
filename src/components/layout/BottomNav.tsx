'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Users, CalendarCheck, CalendarDays,
    BookOpen, Menu, CreditCard,
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
        { href: '/subscriptions', labelKey: 'subscriptions', icon: CreditCard },
    ] as const;

    return (
        <nav
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--sidebar-bg)] border-t border-white/[0.08] shadow-[0_-8px_30px_rgba(0,0,0,0.4)]"
            style={{ 
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
                transform: 'translateZ(0)',
                WebkitTransform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden'
            }}
        >
            <div className="flex items-center justify-around md:justify-evenly w-full max-w-5xl mx-auto px-1 h-[64px]">
                {navItems.map(({ href, labelKey, icon: Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + '/');
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                'flex flex-col items-center gap-1.5 px-1.5 py-1 rounded-xl transition-all duration-150 min-w-[64px] md:min-w-[100px] touch-manipulation',
                                active ? 'text-indigo-400' : 'text-white/35'
                            )}
                        >
                            <div className={cn('relative w-6 h-6 md:w-10 md:h-10 flex items-center justify-center', active && 'scale-110')}>
                                {active && <span className="absolute inset-0 scale-125 rounded-2xl bg-indigo-500/15" />}
                                <Icon className={cn("relative w-5 h-5 md:w-8 md:h-8", active ? "opacity-100" : "opacity-70")} strokeWidth={active ? 2.5 : 2} />
                            </div>
                            <span className={cn("text-[8px] md:text-[11px] font-black uppercase tracking-widest truncate", active ? "opacity-100" : "opacity-40")}>{t[labelKey]}</span>
                        </Link>
                    );
                })}

                {/* "More" opens the full sidebar drawer */}
                <button
                    onClick={open}
                    className="flex flex-col items-center gap-1.5 px-1.5 py-1 rounded-xl text-white/35 hover:text-white/60 min-w-[64px] md:min-w-[100px] touch-manipulation transition-colors"
                >
                    <div className="w-6 h-6 md:w-10 md:h-10 flex items-center justify-center">
                        <Menu className="w-5 h-5 md:w-8 md:h-8 opacity-70" strokeWidth={2} />
                    </div>
                    <span className="text-[8px] md:text-[11px] font-black uppercase tracking-widest opacity-40">{t.more}</span>
                </button>
            </div>
        </nav>
    );
}
