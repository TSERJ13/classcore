import type { Metadata } from 'next';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { TrialBanner } from '@/components/ui/TrialBanner';
import { MobileMenuProvider } from '@/contexts/MobileMenuContext';

export const metadata: Metadata = {
    title: 'ClassCore Dashboard',
};

// Demo: trial ends in 5 days from now
const trialEnd = new Date();
trialEnd.setDate(trialEnd.getDate() + 5);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <MobileMenuProvider>
            <div className="flex min-h-screen bg-base">
                {/* Sidebar — handles both desktop sticky & mobile drawer internally */}
                <Sidebar />

                {/* Main area */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {/* Trial banner */}
                    <TrialBanner trialEndsAt={trialEnd.toISOString()} />
                    {/* Mobile header with hamburger + notifications */}
                    <Header />

                    {/* Page content */}
                    <main className="flex-1 overflow-y-auto">
                        <div className="p-4 pb-24 md:p-8 md:pb-8">
                            {children}
                        </div>
                    </main>
                </div>

                {/* Mobile bottom nav */}
                <BottomNav />
            </div>
        </MobileMenuProvider>
    );
}
