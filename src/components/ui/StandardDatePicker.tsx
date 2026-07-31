'use client';

import { Calendar } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
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
                <div 
                    className={cn(
                        "w-full flex items-center bg-surface border border-border-subtle group-focus-within/datepicker:border-[#6d28d9]/60 rounded-2xl pl-11 pr-4 h-[46px] text-[13px] sm:text-sm text-primary transition-all shadow-sm cursor-pointer",
                        disabled && "opacity-50 cursor-not-allowed bg-muted/10",
                        inputClassName
                    )}
                    onClick={() => {
                        try { inputRef.current?.showPicker(); } 
                        catch (e) { inputRef.current?.focus(); }
                    }}
                >
                    {!hideIcon && (
                        <Calendar className="absolute left-4 w-4 h-4 text-muted group-focus-within/datepicker:text-[#6d28d9] transition-colors" />
                    )}
                    <span className={cn("truncate font-medium", !value && "text-muted opacity-50")}>
                        {value ? formatDate(value) : '—'}
                    </span>
                </div>
                <input
                    ref={inputRef}
                    type="date"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
            </div>
        </div>
    );
}
