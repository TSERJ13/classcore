'use client';

import { cn } from '@/lib/utils';
import { DatePickerGrid } from '@/components/ui/DatePickerGrid';

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

/**
 * Previously this rendered a formatted-text pill with a native
 * `<input type="date">` stacked on top at `opacity-0` to catch clicks.
 *
 * That broke in two ways:
 *  1. Typing a day/month/year directly into the native input gave no visual
 *     feedback at all (the input was invisible), so it looked completely
 *     unresponsive even though the browser was tracking keystrokes — and a
 *     native date input only fires `onChange` once all three segments are
 *     filled, making partial input look "discarded".
 *  2. On Safari/WebKit and mobile browsers, a click routed through the
 *     invisible overlay onto a hidden input frequently failed to open the
 *     picker (`showPicker()` requires a direct, trusted user gesture on the
 *     element itself) or didn't focus the underlying field at all.
 *
 * Fix: drop the invisible-input hack entirely and use a real, always-visible
 * three-part Day / Month / Year selector (`DatePickerGrid`) built from plain
 * dropdowns. Every segment is independently visible and clickable, works
 * identically across all browsers (nothing depends on native date-input
 * quirks or `showPicker()`), and never silently drops a partial selection.
 */
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
    return (
        <div className={cn("space-y-1.5 w-full", className)} style={style}>
            {label && (
                <label className="text-[10px] font-black text-muted tracking-widest opacity-40 ml-1 uppercase">
                    {label} {required && '*'}
                </label>
            )}
            <DatePickerGrid
                value={value}
                onChange={onChange}
                disabled={disabled}
                className={inputClassName}
            />
        </div>
    );
}
