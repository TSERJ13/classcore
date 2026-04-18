'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
    Menu, X, Trash2, Building2, 
    ExternalLink, LogOut, Plus, ChevronRight, Check
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useMobileMenu } from '@/contexts/MobileMenuContext';
import { useT } from '@/contexts/LanguageContext';
import { useUser } from '@/hooks/useUser';
import { useStudio } from '@/contexts/StudioContext';
import { getLocalISODate } from '@/lib/utils';
import { THEMES } from '@/lib/settings-store';


export function Header() {
    const pathname = usePathname();
    const { toggle } = useMobileMenu();
    const { user, profile, loading, logout } = useUser();
    const { settings, activeBranchId, addBranch, setActiveBranch } = useStudio();
    const { t, lang } = useT();
    const [profileOpen, setProfileOpen] = useState(false);
    const [branchModalOpen, setBranchModalOpen] = useState(false);
    const [newBranchName, setNewBranchName] = useState('');

    const [calLabel, setCalLabel] = useState('');












    // Read calendar label from localStorage (written by CalendarPage)
    useEffect(() => {
        const readLabel = () => setCalLabel(localStorage.getItem('cc_cal_header_label') ?? '');
        readLabel();
        window.addEventListener('storage', readLabel);
        return () => window.removeEventListener('storage', readLabel);
    }, [pathname]);

    const unreadCount = 0;

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
        '/shop': t.shop,
        '/sms-manager': t.smsManager || 'SMS მენეჯერი',
        '/history': t.history,
        '/trash': t.trash,
    };

    const rawTitle = Object.entries(PAGE_TITLES).find(([key]) =>
        pathname.startsWith(key)
    )?.[1] ?? t.dashboard;

    const isDashboard = pathname === '/dashboard' || pathname === '/';
    const isCalendar = pathname.startsWith('/calendar');
    const displayTitle = isDashboard ? null : isCalendar && calLabel ? calLabel : rawTitle;

    useEffect(() => {
        if (typeof document !== 'undefined') {
            const pageName = displayTitle || rawTitle;
            const studioName = settings?.studioName || 'ClassCore';
            document.title = pageName ? `${pageName} | ${studioName}` : studioName;
        }
    }, [displayTitle, rawTitle, settings?.studioName]);


    const activeBranchName = settings.branches.find(b => b.id === activeBranchId)?.name || 'Main Branch';

    return (
        <>
            <header className="sticky top-0 z-30 bg-card/90 backdrop-blur-xl border-b border-border-subtle">
                <div className="max-w-6xl mx-auto w-full grid grid-cols-3 items-center px-4 md:px-8 h-12 md:h-14 relative">
                    {/* Left Column: Sidebar Toggle (Mobile) */}
                    <div className="flex items-center">
                        <button
                            onClick={toggle}
                            className="md:hidden p-2 -ml-2 text-primary/80 hover:text-primary transition-colors bg-surface/50 rounded-xl"
                            aria-label="Menu"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Center Column: Page Title (Perfectly Centered) */}
                    <div className="flex justify-center items-center pointer-events-none">
                        <h1 className="text-[11px] xs:text-[12px] md:text-sm font-extrabold text-primary tracking-tight md:tracking-wide truncate max-w-[100px] xs:max-w-[140px] md:max-w-[240px] text-center">
                            {displayTitle || rawTitle}
                        </h1>
                    </div>

                    {/* Right Column: Actions */}
                    <div className="flex items-center justify-end gap-2">
                        {!loading && !user && (
                            <Link href="/login" className="md:hidden px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg tracking-wider">{t.login}</Link>
                        )}
                        <div className="h-6 w-px bg-border-subtle/50 mx-1 hidden md:block" />
                    </div>
                </div>
            </header>

            {/* New Branch Modal */}
            {branchModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 animate-in fade-in duration-300">
                    <div className="bg-card border border-border-subtle rounded-[2rem] w-full max-w-sm p-8 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center text-center gap-2">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-2">
                                <Building2 className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-primary tracking-tight">{t.newBranch}</h3>
                            <p className="text-xs font-bold text-muted px-4 leading-relaxed opacity-60">
                                {t.enterBranchName}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="relative group">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-indigo-500 transition-colors" />
                                <input
                                    autoFocus
                                    value={newBranchName}
                                    onChange={e => setNewBranchName(e.target.value)}
                                    placeholder={t.branchNamePlaceholder}
                                    className="w-full bg-surface border border-border-subtle rounded-2xl pl-11 pr-4 py-4 text-sm font-black focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setBranchModalOpen(false);
                                    setNewBranchName('');
                                }}
                                className="flex-1 py-4 text-xs font-black text-muted hover:bg-surface rounded-2xl transition-colors"
                            >
                                {t.cancel}
                            </button>
                            <button
                                onClick={() => {
                                    if (!newBranchName.trim()) return;
                                    addBranch(newBranchName.trim());
                                    setBranchModalOpen(false);
                                    setNewBranchName('');
                                }}
                                className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl shadow-xl shadow-indigo-600/20 active:scale-95 transition-all tracking-widest"
                            >
                                {t.add}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
}
