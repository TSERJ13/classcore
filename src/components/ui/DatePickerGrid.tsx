'use client';

import { useState, useEffect } from 'react';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { generateDayOptions, generateMonthOptions, generateYearOptions } from '@/lib/date-utils';
import { useT } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface DatePickerGridProps {
    value: string;
    onChange: (value: string) => void;
    minYear?: number;
    maxYear?: number;
    className?: string;
    disabled?: boolean;
}

// Parses a "YYYY-MM-DD" (optionally with a time suffix) string into its parts
// WITHOUT going through `new Date(string)`, which interprets a bare date as
// UTC midnight and then reads it back in the browser's local timezone — for
// any timezone behind UTC that silently rolls the date back by one day.
function parseISODateParts(v?: string | null): { day: string; month: string; year: string } | null {
    if (!v) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (!m) return null;
    return { year: m[1], month: m[2], day: m[3] };
}

const PLACEHOLDERS: Record<string, { day: string; month: string; year: string }> = {
    ka: { day: 'დღე', month: 'თვე', year: 'წელი' },
    ru: { day: 'День', month: 'Месяц', year: 'Год' },
    en: { day: 'Day', month: 'Month', year: 'Year' },
};

export function DatePickerGrid({ value, onChange, minYear, maxYear, className, disabled }: DatePickerGridProps) {
    const { lang } = useT();
    const dayOptions = generateDayOptions();
    const monthOptions = generateMonthOptions(lang);
    const ph = PLACEHOLDERS[lang] || PLACEHOLDERS.en;

    const currentYear = new Date().getFullYear();
    const yearOptions = generateYearOptions(minYear ?? currentYear - 100, maxYear ?? currentYear + 10);

    const initialParts = parseISODateParts(value);
    const [parts, setParts] = useState({
        day: initialParts?.day || '',
        month: initialParts?.month || '',
        year: initialParts?.year || ''
    });

    useEffect(() => {
        const p = parseISODateParts(value);
        setParts({ day: p?.day || '', month: p?.month || '', year: p?.year || '' });
    }, [value]);

    const update = (newParts: typeof parts) => {
        setParts(newParts);
        if (newParts.day && newParts.month && newParts.year) {
            // Validate without timezone conversion — construct the ISO string
            // directly from the selected parts rather than round-tripping
            // through a Date object (which can shift the day near midnight).
            const day = Number(newParts.day);
            const month = Number(newParts.month);
            const daysInMonth = new Date(Number(newParts.year), month, 0).getDate();
            if (day >= 1 && day <= daysInMonth && month >= 1 && month <= 12) {
                onChange(`${newParts.year}-${newParts.month}-${newParts.day}`);
            }
        } else {
            onChange('');
        }
    };

    return (
        <div className={cn("grid grid-cols-3 gap-1.5 w-full", className, disabled && "opacity-50 pointer-events-none")}>
            <SearchSelect
                options={dayOptions}
                value={parts.day}
                onChange={v => update({ ...parts, day: v })}
                placeholder={ph.day}
                disabled={disabled}
                className="[&>div]:py-2 [&>div]:px-2 [&>div]:text-[11px]"
            />
            <SearchSelect
                options={monthOptions}
                value={parts.month}
                onChange={v => update({ ...parts, month: v })}
                placeholder={ph.month}
                disabled={disabled}
                className="[&>div]:py-2 [&>div]:px-2 [&>div]:text-[11px]"
            />
            <SearchSelect
                options={yearOptions}
                value={parts.year}
                onChange={v => update({ ...parts, year: v })}
                placeholder={ph.year}
                disabled={disabled}
                className="[&>div]:py-2 [&>div]:px-2 [&>div]:text-[11px]"
            />
        </div>
    );
}
