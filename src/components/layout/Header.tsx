'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Bell, X } from 'lucide-react';
import { useState } from 'react';
import { useMobileMenu } from '@/contexts/MobileMenuContext';
import { useT } from '@/contexts/LanguageContext';
import { useUser } from '@/hooks/useUser';
import { useStudio } from '@/contexts/StudioContext';
import { Zap } from 'lucide-react';

export function Header() {
    const pathname = usePathname();
    const { toggle } = useMobileMenu();
    const { t } = useT();
    const { profile } = useUser();
    const { settings } = useStudio();
    const [notifOpen, setNotifOpen] = useState(false);

    // Derive page title from t.* translations using pathname
    const PAGE_TITLES: Record<string, string> = {
        '/dashboard': t.dashboard,
        '/students': t.students,
        '/attendance': t.attendance,
        '/groups': t.groups,
        '/settings': t.settings,
        '/calendar': t.calendar,
        '/teachers': t.teachers,
        '/halls': t.halls,
        '/hall-rental': t.hallRental,
        '/subscriptions': t.subscriptions,
        '/analytics': t.analytics,
        '/billing': t.billing,
    };

    const title = Object.entries(PAGE_TITLES).find(([key]) =>
        pathname.startsWith(key)
    )?.[1] ?? t.dashboard;

    const NOTIFICATIONS = [
        { id: 1, text: 'ნინო ბერიძეს ივსება აბონიმენტი 3 დღეში', time: '5 წ. წ.', dot: 'bg-amber-400' },
        { id: 2, text: 'ახალი ჯავშანი — დარბ. A, 14:00', time: '12 წ. წ.', dot: 'bg-indigo-400' },
        { id: 3, text: 'გიორგი კვ. გამოტოვა 3 გაკვ.', time: '1 სთ. წ.', dot: 'bg-rose-400' },
    ];

    return (
        <>
            {/* Header bar (Handles mobile and desktop) */}
            <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-card/90 backdrop-blur-xl border-b border-border-subtle">
                {/* Hamburger */}
                <button
                    onClick={toggle}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-primary/60 hover:text-primary hover:bg-surface active:bg-surface transition-colors touch-manipulation"
                    aria-label="Menu"
                >
                    <Menu className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center gap-2 pr-4">
                        {/* Empty on desktop as per user request to remove studio name & page title */}
                    </div>
                    <h1 className="text-sm font-black text-primary tracking-tight md:hidden">{title}</h1>
                </div>

                <div className="flex items-center gap-2">
                    <Link href="/login" className="md:hidden px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg uppercase tracking-wider">შესვლა</Link>
                    {/* Bell */}
                    <button
                        onClick={() => setNotifOpen(v => !v)}
                        className="relative w-10 h-10 flex items-center justify-center rounded-xl text-primary/60 hover:text-primary hover:bg-surface active:bg-surface transition-colors touch-manipulation"
                        aria-label="Notifications"
                    >
                        <Bell className="w-5 h-5" />
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-card" />
                    </button>
                </div>
            </header>

            {/* Notification drawer */}
            {notifOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                        onClick={() => setNotifOpen(false)}
                    />
                    {/* Panel */}
                    <div className="fixed top-0 right-0 h-full w-80 max-w-[90vw] z-50 bg-card border-l border-border-subtle shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="flex items-center justify-between px-5 py-5 border-b border-border-subtle">
                            <p className="text-sm font-black text-primary">შეტყობინებები</p>
                            <button onClick={() => setNotifOpen(false)}
                                className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-primary hover:bg-surface transition-colors touch-manipulation">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto divide-y divide-border-subtle/50">
                            {NOTIFICATIONS.map(n => (
                                <div key={n.id} className="flex items-start gap-4 px-5 py-5 hover:bg-surface/50 transition-colors">
                                    <span className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.dot}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-primary/80 font-medium leading-snug">{n.text}</p>
                                        <p className="text-[11px] text-muted font-bold mt-1 opacity-60">{n.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="px-5 py-5 border-t border-border-subtle bg-surface/30">
                            <button className="w-full py-3 rounded-xl bg-card border border-border-subtle text-xs font-bold text-muted hover:text-primary hover:bg-card shadow-sm transition-all">
                                ყველა ნახვა
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
