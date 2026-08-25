'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import MainPortal from '@/components/ui/MainPortal';

interface MobileFABProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ReactNode;
    bg?: string;
}

export function MobileFAB({ icon, bg = "bg-[#6d28d9]", className, ...props }: MobileFABProps) {
    return (
        <MainPortal>
            <div className="sm:hidden fixed right-4 z-[9999]" style={{ bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}>
                <button 
                    className={cn("flex items-center justify-center w-14 h-14 text-white rounded-2xl shadow-xl active:scale-95 transition-all", bg, className)}
                    {...props}
                >
                    {icon}
                </button>
            </div>
        </MainPortal>
    );
}
