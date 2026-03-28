'use client';

import React from 'react';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { Building2, ChevronRight, Check, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';

export function BranchSwitcher() {
    const { settings, setActiveBranch } = useStudio();
    const { profile } = useUser();
    const { lang } = useT();
    const [isOpen, setIsOpen] = React.useState(false);
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const l = (ka: string, ru: string, en: string) => {
        if (lang === 'ka') return ka;
        if (lang === 'ru') return ru;
        return en;
    };

    const handleManualRefresh = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsSyncing(true);
        // Force immediate pull from cloud
        window.dispatchEvent(new Event('cc_staff_update'));
        setTimeout(() => setIsSyncing(false), 2000);
    };

    const powerRoles = ['admin', 'owner', 'manager'];
    const isPowerUser = powerRoles.includes(profile?.role || '');
    const allowedBranchIds = profile?.allowedBranchIds || [];

    // Filter branches based on permissions
    // Power users see all. Others only see assigned.
    const isRestricted = !isPowerUser && allowedBranchIds.length > 0;
    const availableBranches = isPowerUser || !isRestricted
        ? settings.branches
        : settings.branches.filter(b => allowedBranchIds.includes(b.id));

    const activeBranch = settings.branches.find(b => b.id === settings.activeBranchId) || settings.branches[0];

    if (!mounted) return null;

    return (
        <div className="relative mt-2">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface border border-border-subtle hover:border-indigo-500/50 transition-all group cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(!isOpen); }}
            >
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                    <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-black text-indigo-500/80 tracking-widest leading-none">
                            {l('ფილიალი', 'Филиали', 'Branch')}
                        </p>
                        <button
                            onClick={handleManualRefresh}
                            className={cn(
                                "p-1 rounded-md hover:bg-indigo-500/10 transition-colors",
                                isSyncing && "animate-spin text-indigo-500"
                            )}
                            title="Sync with cloud"
                        >
                            <RefreshCcw className="w-2.5 h-2.5" />
                        </button>
                    </div>
                    <p className="text-sm font-black text-primary truncate">
                        {activeBranch.name}
                    </p>
                </div>
                <ChevronRight className={cn("w-4 h-4 text-muted transition-transform", isOpen && "rotate-90")} />
            </div>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-[60]"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-surface border border-border-subtle rounded-2xl shadow-2xl z-[70] animate-in fade-in zoom-in duration-200 origin-top">
                        <div className="space-y-1">
                            {availableBranches.map((branch) => (
                                <button
                                    key={branch.id}
                                    onClick={() => {
                                        // Update state without full page reload
                                        setActiveBranch(branch.id);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all",
                                        branch.id === settings.activeBranchId
                                            ? "bg-indigo-500/10 text-indigo-500"
                                            : "hover:bg-card text-muted hover:text-primary"
                                    )}
                                >
                                    <span className="text-xs font-black truncate">{branch.name}</span>
                                    {branch.id === settings.activeBranchId && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
