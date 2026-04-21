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
                    <div className="flex min-h-[100dvh] bg-base">
                        {/* Sidebar — handles both desktop sticky & mobile drawer internally */}
                        <Sidebar defaultExpanded={defaultExpanded} defaultRole={defaultRole} />

                        {/* Main area */}
                        <div className="flex-1 flex flex-col min-w-0">
                            {/* Mobile header with hamburger + notifications */}
                            <Header />

                            {/* Page content */}
                            <main className="flex-1">
                                <div className="p-4 pb-40 md:p-8 md:pb-12 pb-safe">
                                    {children}
                                </div>
                            </main>
                        </div>

                        {/* Mobile bottom nav */}
                        <BottomNav />
                    </div>
                </MobileMenuProvider>
            </KillSwitchGate>
        </DashboardHydrationGuard>
    );
}
