'use client';

import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRef } from 'react';

interface StandardDatePickerProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    label?: string;
    disabled?: boolean;
    required?: boolean;
    hideIcon?: boolean;
    inputClassName?: string;
    style?: React.CSSProperties;
}

export function StandardDatePicker({
    value,
    onChange,
    className,
    label,
    disabled = false,
    required = false,
    hideIcon = false,
    inputClassName,
    style
}: StandardDatePickerProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    return (
        <div className={cn("space-y-1.5 w-full", className)} style={style}>
            {label && (
                <label className="text-[10px] font-black text-muted tracking-widest opacity-40 ml-1 uppercase">
                    {label} {required && '*'}
                </label>
            )}
            <div className="relative group/datepicker">
                {!hideIcon && (
                    <Calendar 
                        onClick={() => {
                            try { inputRef.current?.showPicker(); } 
                            catch (e) { inputRef.current?.focus(); }
                        }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within/datepicker:text-[#6d28d9] transition-colors cursor-pointer z-20" 
                    />
                )}
                <input
                    ref={inputRef}
                    type="date"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className={cn(
                        "w-full bg-surface border border-border-subtle focus:border-[#6d28d9]/60 rounded-2xl pl-11 pr-4 py-3 text-[13px] sm:text-sm text-primary transition-all shadow-sm outline-none",
                        disabled && "opacity-50 cursor-not-allowed bg-muted/10",
                        "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-4 [&::-webkit-calendar-picker-indicator]:top-1/2 [&::-webkit-calendar-picker-indicator]:-translate-y-1/2 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:z-10",
                        "[&::-webkit-datetime-edit-fields-wrapper]:p-0",
                        inputClassName
                    )}
                />
            </div>
        </div>
    );
}
