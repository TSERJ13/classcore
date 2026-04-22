'use client';

import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StandardDatePickerProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    label?: string;
    disabled?: boolean;
    required?: boolean;
    hideIcon?: boolean;
}

export function StandardDatePicker({
    value,
    onChange,
    className,
    label,
    disabled = false,
    required = false,
    hideIcon = false
}: StandardDatePickerProps) {
    return (
        <div className={cn("space-y-1.5 w-full", className)}>
            {label && (
                <label className="text-[10px] font-black text-muted tracking-widest opacity-40 ml-1 uppercase">
                    {label} {required && '*'}
                </label>
            )}
            <div className="relative group/datepicker overflow-hidden rounded-2xl">
                {!hideIcon && <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within/datepicker:text-[#6d28d9] transition-colors pointer-events-none z-10" />}
                <input
                    type="date"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className={cn(
                        "w-full bg-surface border border-border-subtle focus:border-[#6d28d9]/60 rounded-2xl pl-11 pr-4 py-3 text-[13px] sm:text-sm text-primary transition-all shadow-sm outline-none cursor-pointer",
                        "appearance-none", // Remove default arrows
                        "[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer", // Hidden indicator covering entire input
                        disabled && "opacity-50 cursor-not-allowed bg-muted/10"
                    )}
                />
            </div>
        </div>
    );
}
