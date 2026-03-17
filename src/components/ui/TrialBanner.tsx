'use client';

import { useState } from 'react';
import { X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';

interface TrialBannerProps {
    trialEndsAt: string; // ISO date string
}

export function TrialBanner({ trialEndsAt }: TrialBannerProps) {
    const { t } = useT();
    const [dismissed, setDismissed] = useState(false);

    const now = new Date();
    const end = new Date(trialEndsAt);
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (dismissed || daysLeft > 14) return null;

    return (
        <div className={cn(
            'flex items-center gap-3 px-4 py-2.5 border-b sticky top-0 z-30 text-sm',
            'bg-surface border-border-subtle text-[var(--text-primary)]'
        )}>
            <Clock className="w-4 h-4 flex-shrink-0 text-indigo-500" />

            <p className="flex-1 text-xs font-bold font-primary">
                {daysLeft <= 0
                    ? `${t.trialVersion} ${t.expired} — `
                    : `${t.trialVersion}: ${daysLeft} ${t.daysLeft} — `}
                <a href="/analytics" className="underline underline-offset-2 font-black hover:opacity-75 transition-opacity">
                    {daysLeft <= 0 ? t.activateSubscription : `${t.paymentPage} →`}
                </a>
            </p>

            {daysLeft > 0 && (
                <button
                    onClick={() => setDismissed(true)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/[0.08] transition-colors flex-shrink-0"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}
