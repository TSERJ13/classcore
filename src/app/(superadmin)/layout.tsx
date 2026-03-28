'use client';

import { useUser } from '@/hooks/useUser';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ShieldCheck, LogOut, LayoutDashboard, Building2, Users, MessageSquare, Bell, X, ChevronRight, Menu, Moon, Sun, Monitor, AlertTriangle, HelpCircle, Wrench, Megaphone, CreditCard, Globe, Search, MonitorSmartphone, BarChart3, Tag, FileText, MessagesSquare, StickyNote } from 'lucide-react';
import SupportChat from '@/components/superadmin/SupportChat';
import GlobalSearch from '@/components/superadmin/GlobalSearch';
import Link from 'next/link';
import { getUnreadSupportCount, loadSettings, getStudioRegistry } from '@/lib/settings-store';
import { getBillingState } from '@/lib/saas-billing';
import { useT } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const { user, loading, logout } = useUser();
    const router = useRouter();
    const pathname = usePathname();
    const [unreadCount, setUnreadCount] = useState(0);
    const [expanded, setExpanded] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>('light'); // Default Light
    const [lang, setLang] = useState<'ka' | 'en'>('ka'); // Default Georgian
    const [mounted, setMounted] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [isNotesOpen, setIsNotesOpen] = useState(false);
    const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);

    const SUPER_ADMIN_EMAILS = [
        'adminclasscore@gmail.com',
        'support@classcore.ge', 
        'admin@classcore.ge',
        'tserj13@classcore.ge',
        'sergi.tsivtsivadze@gmail.com'
    ];
    const isSuperAdmin = user?.email ? SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === user.email?.toLowerCase()) : false;

    useEffect(() => {
        const updateCount = () => {
            setUnreadCount(getUnreadSupportCount());
        };
        updateCount();
        window.addEventListener('storage', updateCount);
        
        setMounted(true);
        const storedExpanded = localStorage.getItem('cc_sa_sidebar_expanded');
        if (storedExpanded !== null) setExpanded(storedExpanded === 'true');
        
        const storedTheme = localStorage.getItem('cc_sa_theme') as 'light' | 'dark';
        if (storedTheme) setTheme(storedTheme);
        
        const storedLang = localStorage.getItem('cc_sa_lang') as 'ka' | 'en';
        if (storedLang) setLang(storedLang);

        return () => window.removeEventListener('storage', updateCount);
    }, []);

    const toggleExpanded = () => {
        setExpanded(prev => {
            localStorage.setItem('cc_sa_sidebar_expanded', String(!prev));
            return !prev;
        });
    };

    const toggleTheme = () => {
        setTheme(prev => {
            const next = prev === 'light' ? 'dark' : 'light';
            localStorage.setItem('cc_sa_theme', next);
            return next;
        });
    };

    const toggleLang = () => {
        setLang(prev => {
            const next = prev === 'ka' ? 'en' : 'ka';
            localStorage.setItem('cc_sa_lang', next);
            return next;
        });
    };

    useEffect(() => {
        const handleDown = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setIsGlobalSearchOpen(prev => !prev);
            }
        };

        const handleOpenSearch = () => setIsGlobalSearchOpen(true);

        window.addEventListener('keydown', handleDown);
        window.addEventListener('cc-open-search', handleOpenSearch);
        return () => {
            window.removeEventListener('keydown', handleDown);
            window.removeEventListener('cc-open-search', handleOpenSearch);
        };
    }, []);

    useEffect(() => {
        // If loading is finished and no user, go to login
        if (!loading && !user) router.push('/sa-login');
    }, [user, loading, router]);
    
    if (!mounted) return null;

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (!isSuperAdmin) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-10 max-w-md w-full text-center">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
                        <ShieldCheck className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-xl font-black text-white mb-2">{lang === 'ka' ? 'წვდომა უარყოფილია' : 'Access Denied'}</h1>
                    <p className="text-sm text-zinc-500 mb-8">{lang === 'ka' ? 'ეს გვერდი ხელმისაწვდომია მხოლოდ ClassCore სუპერ ადმინებისთვის.' : 'This area is reserved for ClassCore Super Admins only.'}</p>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => router.push('/dashboard')} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-600/20">
                            {lang === 'ka' ? 'დაფაზე დაბრუნება' : 'Return to Dashboard'}
                        </button>
                        <button onClick={logout} className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-2xl font-bold transition-all">
                            {lang === 'ka' ? 'ანგარიშის შეცვლა' : 'Switch Account'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const navItems = [
        { href: '/superadmin', label: lang === 'ka' ? 'მთავარი' : 'Dashboard', icon: LayoutDashboard },
        { href: '/superadmin/studios', label: lang === 'ka' ? 'სტუდიები' : 'Studios', icon: Building2 },
        { href: '/superadmin/insights', label: lang === 'ka' ? 'ანალიტიკა' : 'User Insights', icon: BarChart3 },
        { href: '/superadmin/clients', label: lang === 'ka' ? 'კლიენტები' : 'Global Clients', icon: Globe },
        { href: '/superadmin/billing', label: lang === 'ka' ? 'ფინანსები' : 'Global Billing', icon: CreditCard },
        { href: '/superadmin/promos', label: lang === 'ka' ? 'პრომო კოდები' : 'Promo Codes', icon: Tag },
        { href: '/superadmin/monitor', label: lang === 'ka' ? 'ჩატის მონიტორი' : 'Chat Monitor', icon: MonitorSmartphone, showBadge: true },
        { href: '/superadmin/broadcast', label: lang === 'ka' ? 'ნოტიფიკაციები' : 'Notifications', icon: Bell },
        { href: '/superadmin/system', label: lang === 'ka' ? 'სისტემა' : 'System Tools', icon: Wrench },
    ];

    return (
        <div className={cn("min-h-screen flex flex-col lg:flex-row transition-colors duration-300", 
            theme === 'light' ? 'bg-[#f8fafc] light-theme' : 'bg-[#09090b] dark')}>
            
            {/* Mobile Header */}
            <header className={cn("lg:hidden h-16 flex items-center justify-between px-6 z-[100] sticky top-0 border-b",
                theme === 'light' ? 'bg-white border-black/5' : 'bg-[#0c0c0e] border-white/5')}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <span className={cn("font-black text-sm tracking-tight uppercase", theme === 'light' ? 'text-primary' : 'text-white')}>ClassCore SA</span>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsChatOpen(true)}
                        className={cn("p-2 relative", theme === 'light' ? "text-slate-400 hover:text-indigo-600" : "text-zinc-500 hover:text-white", unreadCount > 0 && "text-red-400")}
                    >
                        <MonitorSmartphone className="w-5 h-5" />
                        {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />}
                    </button>
                    <button 
                        onClick={() => setIsGlobalSearchOpen(true)}
                        className={cn("p-2", theme === 'light' ? "text-slate-400 hover:text-indigo-600" : "text-zinc-500 hover:text-white")}
                    >
                        <Search className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className={cn("p-2", theme === 'light' ? "text-slate-400 hover:text-primary" : "text-zinc-500 hover:text-white")}>
                        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </header>

            {/* Mobile Sidebar Overlay */}
            <div className={cn("fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] lg:hidden transition-opacity duration-300", 
                isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none")} 
                onClick={() => setIsMobileMenuOpen(false)} 
            />

            {/* Main Sidebar (Desktop Collapsible / Mobile Slide) */}
            <aside className={cn(
                "fixed lg:sticky top-0 h-screen z-[100] transition-all duration-300 flex flex-col shrink-0 lg:border-r shadow-[4px_0_24px_-4px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_24px_-4px_rgba(0,0,0,0.4)]",
                theme === 'light' ? 'bg-white border-black/5' : 'bg-[#111118] border-white/5',
                expanded ? "w-64" : "w-20",
                isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}>
                {/* Collapse/Expand Toggle (Desktop only) */}
                <button 
                    onClick={toggleExpanded}
                    className={cn(
                        "hidden lg:flex absolute -right-3 top-20 w-6 h-10 rounded-r-xl items-center justify-center border border-l-0 transition-all shadow-xl group z-50",
                        theme === 'light' ? 'bg-white border-black/5 text-slate-400 hover:text-indigo-600' : 'bg-[#111118] border-white/10 text-zinc-600 hover:text-white hover:bg-zinc-900'
                    )}
                >
                    <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")} />
                </button>

                <div className={cn("p-6 border-b flex items-center gap-3", 
                    theme === 'light' ? 'border-black/5 bg-black/[0.02]' : 'border-white/5',
                    !expanded && "justify-center px-0")}>
                    <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
                        <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    {expanded && (
                        <div className="animate-in fade-in duration-500">
                            <span className={cn("font-black text-sm tracking-tight uppercase", theme === 'light' ? 'text-primary' : 'text-white')}>ClassCore</span>
                            <p className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em]">Super Admin</p>
                        </div>
                    )}
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto no-scrollbar">
                    {navItems.map(item => {
                        const isActive = item.href === '/superadmin'
                            ? pathname === '/superadmin'
                            : pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                title={!expanded ? item.label : undefined}
                                className={cn(
                                    'flex items-center rounded-xl text-sm font-bold transition-all relative group h-11',
                                    expanded ? 'px-4 gap-3' : 'justify-center',
                                    isActive
                                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                        : theme === 'light' 
                                            ? 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50' 
                                            : 'text-zinc-500 hover:text-white hover:bg-white/5'
                                )}
                            >
                                <item.icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-indigo-400' : 'group-hover:scale-110 transition-transform')} />
                                {expanded && <span className="truncate">{item.label}</span>}
                                {(item as any).showBadge && unreadCount > 0 && (
                                    <span className={cn(
                                        "rounded-full bg-red-500 text-[10px] font-black text-white flex items-center justify-center animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]",
                                        expanded ? "ml-auto min-w-[1.25rem] h-5 px-1.5" : "absolute top-2 right-2 w-2 h-2"
                                    )}>
                                        {expanded ? unreadCount : null}
                                    </span>
                                )}
                                {isActive && !(item as any).showBadge && expanded && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                            </Link>
                        );
                    })}
                </nav>

                <div className={cn("p-4 border-t space-y-3", theme === 'light' ? 'border-black/5 bg-slate-50/50' : 'border-white/5 bg-white/[0.01]')}>
                    <div className="flex flex-col gap-1.5">
                        {/* Theme Toggle */}
                        <button 
                            onClick={toggleTheme}
                            className={cn("w-full h-10 rounded-xl flex items-center transition-all px-4 gap-3 group border shadow-inner",
                                theme === 'light' ? 'bg-black/5 border-black/5 text-slate-500 hover:text-primary hover:bg-black/10' : 'bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800/30'
                            )}
                        >
                            {theme === 'light' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-400" />}
                            {expanded && <span className="text-[10px] font-black uppercase tracking-[0.1em]">{theme === 'light' ? (lang === 'ka' ? 'დღის რეჟიმი' : 'Light Mode') : (lang === 'ka' ? 'ღამის რეჟიმი' : 'Dark Mode')}</span>}
                        </button>

                        {/* Lang Toggle */}
                        <button 
                            onClick={toggleLang}
                            className={cn("w-full h-10 rounded-xl flex items-center transition-all px-4 gap-3 group border shadow-inner",
                                theme === 'light' ? 'bg-black/5 border-black/5 text-slate-500 hover:text-primary hover:bg-black/10' : 'bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800/30'
                            )}
                        >
                            <Globe className="w-4 h-4 text-emerald-500" />
                            {expanded && <span className="text-[10px] font-black uppercase tracking-[0.1em]">{lang === 'ka' ? 'ქართული' : 'ENGLISH'}</span>}
                        </button>

                        <button onClick={logout} className={cn("w-full flex items-center rounded-xl text-sm font-bold text-red-500/70 hover:text-red-400 hover:bg-red-500/10 transition-all h-10 mt-2",
                            expanded ? "px-4 gap-3" : "justify-center")}>
                            <LogOut className="w-4 h-4" />
                            {expanded && <span className="text-[10px] font-black uppercase tracking-widest">{lang === 'ka' ? 'გამოსვლა' : 'Sign Out'}</span>}
                        </button>
                    </div>

                    {expanded && (
                        <div className="px-4 py-2 opacity-50">
                            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest truncate">{user?.email}</p>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className={cn("flex-1 overflow-y-auto transition-all duration-300 relative", 
                theme === 'light' ? 'text-zinc-900 bg-white' : 'text-zinc-100')}>
                
                {/* Desktop Global Header (Studio-Style Buttons) */}
                <div className="hidden lg:flex sticky top-0 z-40 px-12 py-6 items-center pointer-events-none">
                    <div className="flex-1 flex items-center gap-4 pointer-events-auto">
                         <div className="flex flex-col">
                             <h2 className={cn("text-xl font-black uppercase tracking-tight", theme === 'light' ? 'text-primary' : 'text-white')}>{lang === 'ka' ? 'მხარდაჭერა და კონტროლი' : 'Support & Control'}</h2>
                             <p className="text-[10px] text-muted font-bold uppercase tracking-widest">{lang === 'ka' ? 'პლატფორმის გლობალური მართვა' : 'Global Platform Management'}</p>
                         </div>
                    </div>

                    <div className="flex items-center gap-2 pointer-events-auto bg-white/95 dark:bg-white/[0.02] backdrop-blur-xl border border-black/5 dark:border-white/5 p-1 rounded-2xl shadow-2xl shadow-black/5">
                        {/* Global Search Button */}
                        <button
                            onClick={() => setIsGlobalSearchOpen(true)}
                            className={cn("relative w-10 h-10 flex items-center justify-center rounded-xl transition-all group",
                                theme === 'light' ? "text-slate-400 hover:text-indigo-600 hover:bg-black/5" : "text-muted hover:text-primary hover:bg-surface"
                            )}
                            title={`${lang === 'ka' ? 'უნივერსალური ძიება' : 'Universal Search'} (⌘K)`}
                        >
                            <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        </button>

                        {/* Notes Button */}
                        <button
                            onClick={() => { setIsNotesOpen(true); setIsNotifOpen(false); }}
                            className={cn("relative w-10 h-10 flex items-center justify-center rounded-xl transition-all group",
                                theme === 'light' ? "text-slate-400 hover:text-indigo-600 hover:bg-black/5" : "text-muted hover:text-primary hover:bg-surface"
                            )}
                            aria-label="Notes"
                        >
                            <StickyNote className="w-5 h-5 -rotate-12 group-hover:rotate-0 transition-transform" />
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-amber-500 ring-4 ring-white dark:ring-[#09090b]" />
                        </button>

                        {/* Messenger/Chat Button */}
                        <button
                            onClick={() => setIsChatOpen(true)}
                            className={cn(
                                "relative w-10 h-10 flex items-center justify-center rounded-xl transition-all group",
                                unreadCount > 0 
                                    ? "bg-red-500 text-white animate-bounce shadow-lg shadow-red-500/20" 
                                    : "text-muted hover:text-primary hover:bg-surface"
                            )}
                            aria-label="Support Hub"
                        >
                            <MessagesSquare className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-white text-red-600 px-1.5 py-0.5 rounded-lg text-[9px] font-black shadow-lg">{unreadCount}</span>}
                            {unreadCount === 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-[#09090b] shadow-glow shadow-emerald-500/50 animate-pulse" />}
                        </button>

                        {/* Notifications Button */}
                        <button
                            onClick={() => { setIsNotifOpen(true); setIsNotesOpen(false); }}
                            className={cn("relative w-10 h-10 flex items-center justify-center rounded-xl transition-all group",
                                theme === 'light' ? "text-slate-400 hover:text-indigo-600 hover:bg-black/5" : "text-muted hover:text-primary hover:bg-surface"
                            )}
                            aria-label="Notifications"
                        >
                            <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-[#09090b]" />
                        </button>
                    </div>
                </div>

                <div className="p-6 lg:p-12 max-w-[1600px] mx-auto min-h-screen">
                    {children}
                </div>
            </main>

            {/* Global Chat Overlay */}
            {isChatOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 md:p-6 lg:p-12 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setIsChatOpen(false)} />
                    <div className="relative w-full h-full max-w-7xl bg-white dark:bg-[#0c0c0e]/80 backdrop-blur-3xl border border-black/5 dark:border-white/5 rounded-none md:rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col">
                        <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                    <MonitorSmartphone className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black text-primary dark:text-white uppercase tracking-wider">{lang === 'ka' ? 'სუპერ ადმინის მხარდაჭერის ცენტრი' : 'SuperAdmin Support Hub'}</h2>
                                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest">{lang === 'ka' ? 'გლობალური ჩატის და SMS-ების მართვა' : 'Global Chat & SMS Management'}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsChatOpen(false)} className="p-3 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-2xl transition-all shadow-xl">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                     {/* Support Hub (Clean Single Layer) */}
                    <div className="flex-1 overflow-hidden h-full">
                        <SupportChat />
                    </div>
                    </div>
                </div>
            )}

            {/* Notifications Drawer */}
            {isNotifOpen && (
                <>
                    <div className="fixed inset-0 z-[110] bg-black/20 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsNotifOpen(false)} />
                    <div className="fixed top-0 right-0 h-full w-80 z-[120] bg-white/95 dark:bg-card border-l border-black/5 dark:border-border-subtle shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
                        <div className="p-6 border-b border-black/5 dark:border-border-subtle flex items-center justify-between">
                            <h3 className="text-base font-black text-primary uppercase tracking-wider">{lang === 'ka' ? 'შეტყობინებები' : 'Notifications'}</h3>
                            <button onClick={() => setIsNotifOpen(false)} className="p-2 hover:bg-black/5 dark:hover:bg-surface rounded-xl transition-all"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {(() => {
                                const slugs = getStudioRegistry();
                                const alerts: { title: string, time: string, icon: any, color: string, bg: string }[] = [];
                                slugs.forEach(slug => {
                                    const state = getBillingState(slug);
                                    const name = loadSettings(slug).studioName;
                                    if (state.status === 'overdue') {
                                        alerts.push({
                                            title: lang === 'ka' ? `ვადაგადაცილება: ${name}` : `Overdue: ${name}`,
                                            time: lang === 'ka' ? 'ყურადღება!' : 'Atention!',
                                            icon: AlertTriangle,
                                            color: 'text-rose-500',
                                            bg: 'bg-rose-500/10'
                                        });
                                    } else if (state.status === 'active' && state.daysLeftInTrial <= 7) {
                                        alerts.push({
                                            title: lang === 'ka' ? `ვადა გასდის: ${name}` : `Expiring soon: ${name}`,
                                            time: lang === 'ka' ? `${state.daysLeftInTrial} დღე დარჩა` : `${state.daysLeftInTrial}d left`,
                                            icon: Building2,
                                            color: 'text-amber-500',
                                            bg: 'bg-amber-500/10'
                                        });
                                    }
                                });

                                if (alerts.length === 0) {
                                    return (
                                        <div className="h-full flex flex-col items-center justify-center opacity-40 py-20">
                                            <Bell className="w-12 h-12 mb-4" />
                                            <p className="text-[10px] font-black uppercase tracking-widest">{lang === 'ka' ? 'ნოტიფიკაციები არ არის' : 'No alerts'}</p>
                                        </div>
                                    );
                                }

                                return alerts.map((n, i) => (
                                    <div key={i} className="flex gap-4 p-4 bg-black/[0.02] dark:bg-surface/50 border border-black/5 dark:border-border-subtle rounded-2xl hover:border-indigo-500/20 transition-all group cursor-pointer text-left">
                                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-sm", n.bg, n.color)}><n.icon className="w-5 h-5" /></div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-black text-primary truncate leading-none mb-1">{n.title}</p>
                                            <p className="text-[10px] text-muted font-bold opacity-40">{n.time}</p>
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                </>
            )}

            {/* Notes Drawer */}
            {isNotesOpen && (
                <>
                    <div className="fixed inset-0 z-[110] bg-black/20 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsNotesOpen(false)} />
                    <div className="fixed top-0 right-0 h-full w-80 z-[120] bg-white/95 dark:bg-card border-l border-black/5 dark:border-border-subtle shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
                        <div className="p-6 border-b border-black/5 dark:border-border-subtle flex items-center justify-between">
                            <h3 className="text-base font-black text-primary uppercase tracking-wider">{lang === 'ka' ? 'სისტემის ჩანაწერები' : 'System Notes'}</h3>
                            <button onClick={() => setIsNotesOpen(false)} className="p-2 hover:bg-black/5 dark:hover:bg-surface rounded-xl transition-all"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 p-6 flex flex-col gap-4">
                            <textarea 
                                placeholder={lang === 'ka' ? 'ჩაწერეთ შიდა სისტემური ჩანაწერი...' : "Type a internal system note..."}
                                className="w-full h-40 bg-black/[0.03] dark:bg-surface border border-black/10 dark:border-border-subtle rounded-3xl p-5 text-sm font-bold text-primary dark:text-white outline-none focus:border-amber-500/50 shadow-inner no-scrollbar resize-none"
                            />
                            <div className="space-y-4">
                                <p className="text-[10px] font-black text-muted uppercase tracking-widest pl-1">{lang === 'ka' ? 'ბოლო ჩანაწერები' : 'Recent Notes'}</p>
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                                    <p className="text-xs font-bold text-amber-600/80 dark:text-amber-500/80 leading-relaxed italic">{lang === 'ka' ? 'გადაამოწმეთ გადახდების პროცესორი თვის ბოლოს ვადაგადაცილებული სტუდიებისთვის.' : 'Check billing processor for overdue trial studios at the end of the month.'}</p>
                                    <p className="text-[9px] text-amber-500/40 font-black mt-2 uppercase tracking-tight">Admin • {lang === 'ka' ? '19 მარტი' : 'March 19'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            <GlobalSearch isOpen={isGlobalSearchOpen} onClose={() => setIsGlobalSearchOpen(false)} />
        </div>
    );
}
