'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface MobileFABProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ReactNode;
    bg?: string;
}

export function MobileFAB({ icon, bg = "bg-[#6d28d9]", className, ...props }: MobileFABProps) {
    return (
        <div className="sm:hidden fixed bottom-20 right-4 z-50">
            <button 
                className={cn("flex items-center justify-center w-14 h-14 text-white rounded-2xl shadow-xl active:scale-95 transition-all", bg, className)}
                {...props}
            >
                {icon}
            </button>
        </div>
    );
}
