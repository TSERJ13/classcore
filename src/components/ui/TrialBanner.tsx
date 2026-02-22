'use client';

import { useState } from 'react';
import { X, Zap, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrialBannerProps {
    trialEndsAt: string; // ISO date string
}

export function TrialBanner({ trialEndsAt }: TrialBannerProps) {
    const [dismissed, setDismissed] = useState(false);

    const now = new Date();
    const end = new Date(trialEndsAt);
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (dismissed || daysLeft > 14) return null;

    const isUrgent = daysLeft <= 3;
    const isWarning = daysLeft <= 7;

    return (
        <div className={cn(
            'flex items-center gap-3 px-4 py-2.5 border-b sticky top-0 z-30 text-sm',
            isUrgent
                ? 'bg-red-500/10 border-red-500/20 text-red-300'
                : isWarning
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                    : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
        )}>
            {isUrgent
                ? <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                : isWarning
                    ? <Clock className="w-4 h-4 flex-shrink-0" />
                    : <Zap className="w-4 h-4 flex-shrink-0" />}

            <p className="flex-1 text-xs font-medium">
                {daysLeft <= 0
                    ? 'საცდელი პერიოდი დასრულდა — '
                    : `ტრიალის ${daysLeft} დღე დარჩა — `}
                <a href="/billing" className="underline underline-offset-2 font-bold hover:opacity-75 transition-opacity">
                    {daysLeft <= 0 ? 'გააქტიურე სააბონემენტო' : 'გადახდის გვერდი →'}
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
