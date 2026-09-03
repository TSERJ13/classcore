'use client';

import { Calendar, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRef } from 'react';

interface StandardDatePickerProps {
    value?: string;
    onChange: (value: string) => void;
    className?: string;
    label?: string;
    disabled?: boolean;
    required?: boolean;
    hideIcon?: boolean;
    inputClassName?: string;
    style?: React.CSSProperties;
    placeholder?: string;
    variant?: string;
}

export function StandardDatePicker({
    value = '',
    onChange,
    className,
    label,
    disabled = false,
    required = false,
    hideIcon = false,
    inputClassName,
    style,
    placeholder
}: StandardDatePickerProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const cleanValue = value ? value.split('T')[0] : '';

    const handleOpenPicker = () => {
        if (disabled) return;
        try {
            inputRef.current?.showPicker();
        } catch {
            inputRef.current?.focus();
        }
    };

    return (
        <div className={cn("space-y-1.5 w-full", className)} style={style}>
            {label && (
                <label 
                    onClick={handleOpenPicker}
                    className="text-[10px] font-black text-muted tracking-widest opacity-60 ml-1 uppercase cursor-pointer select-none"
                >
                    {label} {required && '*'}
                </label>
            )}
            <div 
                onClick={handleOpenPicker}
                className="relative group/datepicker flex items-center w-full cursor-pointer"
            >
                {!hideIcon && (
                    <div className="absolute left-3.5 flex items-center pointer-events-none z-10 text-muted group-focus-within/datepicker:text-[#6d28d9] transition-colors">
                        <Calendar className="w-4 h-4" />
                    </div>
                )}
                <input
                    ref={inputRef}
                    type="date"
                    value={cleanValue}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    placeholder={placeholder}
                    onClick={(e) => {
                        e.stopPropagation();
                        try {
                            (e.target as any).showPicker?.();
                        } catch {}
                    }}
                    className={cn(
                        "w-full bg-surface border border-border-subtle rounded-xl text-xs sm:text-sm font-bold text-primary shadow-sm outline-none transition-all cursor-pointer dark:[color-scheme:dark]",
                        hideIcon ? "pl-3.5" : "pl-10",
                        cleanValue ? "pr-8" : "pr-3",
                        "h-[48px]",
                        "focus:border-[#6d28d9]/60 focus:ring-2 focus:ring-[#6d28d9]/10 hover:border-border-subtle/80",
                        "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:scale-110",
                        disabled && "opacity-50 cursor-not-allowed bg-muted/10",
                        inputClassName
                    )}
                />
                {cleanValue && !disabled && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange('');
                            if (inputRef.current) inputRef.current.value = '';
                        }}
                        className="absolute right-8 p-1 rounded-full text-muted/50 hover:text-muted hover:bg-black/5 dark:hover:bg-white/5 transition-all z-10"
                        title="გასუფთავება"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}
