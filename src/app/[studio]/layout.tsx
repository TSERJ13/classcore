import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Client Portal',
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-base">
            <main className="p-4 pb-10 max-w-lg mx-auto">
                {children}
            </main>
        </div>
    );
}
