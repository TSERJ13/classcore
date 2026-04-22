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
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#121212] border-t border-white/[0.05] shadow-[0_-8px_30px_rgba(0,0,0,0.4)] isolation-auto"
            style={{ 
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                height: 'calc(72px + env(safe-area-inset-bottom, 0px))',
                transform: 'translateZ(10px)',
                WebkitTransform: 'translateZ(10px)',
            }}
        >
            {/* Grounding Filler: Ensures no gap during scrolling/rubber-banding */}
            <div className="absolute top-[99%] left-0 right-0 h-[300px] bg-[#121212]" />

            <div className="flex items-center justify-around w-full max-w-5xl mx-auto px-1 h-[72px] relative z-10">
                {navItems.map(({ href, labelKey, icon: Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + '/');
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                'flex flex-col items-center justify-center gap-1 px-1 py-1 rounded-xl transition-all duration-150 min-w-[64px] touch-manipulation',
                                active ? 'text-indigo-400' : 'text-white/40'
                            )}
                        >
                            <div className={cn('relative w-8 h-8 flex items-center justify-center', active && 'scale-110')}>
                                {active && <span className="absolute inset-0 scale-110 rounded-xl bg-indigo-500/10" />}
                                <Icon className={cn("relative w-5 h-5", active ? "opacity-100" : "opacity-80")} strokeWidth={active ? 2.5 : 2} />
                            </div>
                            <span className={cn("text-[8px] font-black uppercase tracking-widest truncate mt-0.5", active ? "opacity-100" : "opacity-40")}>
                                {t[labelKey]}
                            </span>
                        </Link>
                    );
                })}

                {/* "More" opens the full sidebar drawer */}
                <button
                    onClick={open}
                    className="flex flex-col items-center justify-center gap-1 px-1 py-1 rounded-xl text-white/40 hover:text-white min-w-[64px] touch-manipulation transition-colors"
                >
                    <div className="w-8 h-8 flex items-center justify-center">
                        <Menu className="w-5 h-5 opacity-80" strokeWidth={2} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40">{t.more}</span>
                </button>
            </div>
        </nav>
    );
}
