import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { MobileMenuProvider } from '@/contexts/MobileMenuContext';
import KillSwitchGate from '@/components/KillSwitchGate';
import { DashboardHydrationGuard } from '@/components/layout/DashboardHydrationGuard';

import { GlobalRFIDScanner } from '@/components/layout/GlobalRFIDScanner';

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
                    <GlobalRFIDScanner />
                    <div className="dashboard-root relative flex h-[100dvh] bg-surface overflow-hidden w-full isolation-auto">
                        <Sidebar defaultExpanded={defaultExpanded} defaultRole={defaultRole} />
                        <div className="dashboard-stabilized-view flex-1 flex flex-col min-w-0 transition-all duration-300 relative overflow-hidden h-[100dvh]">
                            <Header />
                            <main className="dashboard-main-lock flex-1 relative w-full overflow-y-auto overflow-x-hidden pb-[env(safe-area-inset-bottom,0px)]">
                                <div className="w-full min-h-full p-2.5 sm:p-4 animate-fade-in pb-28 lg:pb-8">
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
