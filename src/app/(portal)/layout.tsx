import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Client Portal — StudioFlow',
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-base">
            {/* Minimal header */}
            <header className="border-b border-white/[0.07] px-4 py-3 flex items-center gap-3">
                <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-xs font-bold">SF</span>
                </div>
                <span className="text-sm font-bold text-white">StudioFlow</span>
                <span className="text-white/30 text-xs ml-auto">კლიენტის პორტალი</span>
            </header>
            <main className="p-4 pb-10 max-w-lg mx-auto">
                {children}
            </main>
        </div>
    );
}
