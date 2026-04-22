import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { MobileMenuProvider } from '@/contexts/MobileMenuContext';
import KillSwitchGate from '@/components/KillSwitchGate';
import { DashboardHydrationGuard } from '@/components/layout/DashboardHydrationGuard';

export const metadata: Metadata = {
    title: 'ClassCore Dashboard',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = cookies();
    const expandedCookie = cookieStore.get('cc_sidebar_expanded')?.value;
    const defaultExpanded = expandedCookie ? expandedCookie === 'true' : null;
    const roleCookie = cookieStore.get('cc_user_role')?.value;
    const defaultRole = roleCookie || null;
    return (
        <DashboardHydrationGuard>
            <KillSwitchGate>
                <MobileMenuProvider>
                    <div className="dashboard-root relative flex min-h-[100dvh] bg-surface overflow-x-hidden w-full isolation-auto">
                        <Sidebar defaultExpanded={defaultExpanded} defaultRole={defaultRole} />
                        <div className="dashboard-stabilized-view flex-1 flex flex-col min-w-0 transition-all duration-300 relative overflow-x-hidden md:pl-[var(--sidebar-width,0px)]">
                            <Header />
                            <main className="dashboard-main-lock flex-1 relative w-full overflow-x-hidden">
                                <div className="p-4 sm:p-6 md:p-8 pb-32 sm:pb-32 md:pb-12 w-full max-w-full">
                                    {children}
                                </div>
                            </main>
                        </div>
                        <BottomNav />
                    </div>
                </MobileMenuProvider>
            </KillSwitchGate>
        </DashboardHydrationGuard>
    );
}
