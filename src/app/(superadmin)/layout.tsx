'use client';

import { useUser } from '@/hooks/useUser';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { ShieldCheck, LogOut, LayoutDashboard, Building2, Users, CreditCard, Wrench, Globe, Search, Megaphone, MonitorSmartphone, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const { user, logout } = useUser();
    const router = useRouter();
    const pathname = usePathname();

    const SUPER_ADMIN_EMAILS = ['support@classcore.ge', 'adminclasscore@gmail.com'];
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user?.email || '');

    useEffect(() => {
        // If not logged in at all, go to login
        if (!user) router.push('/login');
    }, [user, router]);

    if (!isSuperAdmin) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-6">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-10 max-w-md w-full text-center">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
                        <ShieldCheck className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-xl font-black text-white mb-2">Access Denied</h1>
                    <p className="text-sm text-zinc-500 mb-8">This area is reserved for ClassCore Super Admins only.</p>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => router.push('/dashboard')} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-600/20">
                            Return to Dashboard
                        </button>
                        <button onClick={logout} className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-2xl font-bold transition-all">
                            Switch Account
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const navItems = [
        { href: '/superadmin', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/superadmin/studios', label: 'Studios', icon: Building2 },
        { href: '/superadmin/insights', label: 'User Insights', icon: BarChart3 },
        { href: '/superadmin/clients', label: 'Global Clients', icon: Globe },
        { href: '/superadmin/users', label: 'Users & Support', icon: Users },
        { href: '/superadmin/billing', label: 'Global Billing', icon: CreditCard },
        { href: '/superadmin/search', label: 'Universal Search', icon: Search },
        { href: '/superadmin/monitor', label: 'Chat Monitor', icon: MonitorSmartphone },
        { href: '/superadmin/broadcast', label: 'Broadcast', icon: Megaphone },
        { href: '/superadmin/system', label: 'System Tools', icon: Wrench },
    ];

    return (
        <div className="min-h-screen bg-[#09090b] flex flex-col lg:flex-row">
            <aside className="w-full lg:w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col shrink-0">
                <div className="p-6 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span className="font-black text-sm text-white tracking-tight uppercase">ClassCore</span>
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">Super Admin</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map(item => {
                        const isActive = item.href === '/superadmin'
                            ? pathname === '/superadmin'
                            : pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all',
                                    isActive
                                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                        : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
                                )}
                            >
                                <item.icon className={cn('w-4 h-4', isActive ? 'text-indigo-400' : '')} />
                                {item.label}
                                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-zinc-800 space-y-2">
                    <div className="px-4 py-2">
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Logged in as</p>
                        <p className="text-xs font-bold text-zinc-400 truncate mt-0.5">{user?.email}</p>
                    </div>
                    <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/10 transition-all">
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto p-6 lg:p-10">
                {children}
            </main>
        </div>
    );
}
