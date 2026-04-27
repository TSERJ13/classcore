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
                        <div className="dashboard-stabilized-view flex-1 flex flex-col min-w-0 transition-all duration-300 relative overflow-x-hidden">
                            <Header />
                            <main className="dashboard-main-lock flex-1 relative w-full overflow-x-hidden max-w-full">
                                <div className="w-full h-full p-2.5 sm:p-4">
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
