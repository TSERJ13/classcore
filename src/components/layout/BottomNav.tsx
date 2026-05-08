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
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#121212] border-t border-white/[0.05] isolation-auto safe-p-bottom"
            style={{ 
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                height: 'calc(72px + env(safe-area-inset-bottom, 0px))',
                transform: 'translateZ(10px)',
                WebkitTransform: 'translateZ(10px)',
            }}
        >
            {/* Solid background filler for the safe area below the menu */}
            <div className="absolute inset-0 bg-[#121212]" />

            <div className="flex items-center justify-around w-full max-w-5xl mx-auto px-1 h-[72px] relative z-10">
                {navItems.map(({ href, labelKey, icon: Icon }) => {
                    const active = pathname === href || pathname.startsWith(href + '/');
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                'flex-1 flex flex-col items-center justify-center gap-1 px-1 py-1 transition-all duration-150 touch-manipulation relative',
                                active ? 'text-[#c084fc]' : 'text-white/65'
                            )}
                        >
                            <div className={cn(
                                'relative w-11 h-7 flex items-center justify-center rounded-xl transition-all duration-300',
                                active ? 'bg-[#c084fc]/10' : ''
                            )}>
                                <Icon className={cn("relative w-5 h-5", active ? "opacity-100" : "opacity-90")} strokeWidth={active ? 3 : 2} />
                            </div>
                            <span className={cn("text-[7.5px] font-black uppercase tracking-tight truncate mt-0.5", active ? "opacity-100" : "opacity-65")}>
                                {t[labelKey]}
                            </span>
                        </Link>
                    );
                })}

                {/* "More" opens the full sidebar drawer */}
                <button
                    onClick={open}
                    className="flex-1 flex flex-col items-center justify-center gap-1 px-1 py-1 rounded-xl text-white/65 hover:text-white touch-manipulation transition-colors"
                >
                    <div className="w-11 h-7 flex items-center justify-center">
                        <Menu className="w-5 h-5 opacity-90" strokeWidth={2} />
                    </div>
                    <span className="text-[7.5px] font-black uppercase tracking-tight opacity-65">{t.more}</span>
                </button>
            </div>
        </nav>
    );
}
