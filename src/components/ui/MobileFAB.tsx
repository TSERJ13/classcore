'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface MobileFABProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ReactNode;
    bg?: string;
}

export function MobileFAB({ icon, bg = "bg-[#6d28d9]", className, ...props }: MobileFABProps) {
    return (
        <div 
            className="sm:hidden sticky z-50 flex justify-end pointer-events-none" 
            style={{ bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))', marginTop: 'auto', right: '1rem', transform: 'translateY(-1rem)' }}
        >
            <button 
                className={cn("flex items-center justify-center w-14 h-14 text-white rounded-2xl shadow-xl active:scale-95 pointer-events-auto", bg, className)}
                {...props}
            >
                {icon}
            </button>
        </div>
    );
}
