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

export function DatePickerGrid({ value, onChange, minYear, maxYear, className, disabled }: DatePickerGridProps) {
    const { lang } = useT();
    const dayOptions = generateDayOptions();
    const monthOptions = generateMonthOptions(lang);
    
    const currentYear = new Date().getFullYear();
    const yearOptions = generateYearOptions(minYear ?? currentYear - 100, maxYear ?? currentYear + 10);

    const initialDate = value ? new Date(value) : null;
    const [parts, setParts] = useState({
        day: initialDate ? String(initialDate.getDate()).padStart(2, '0') : '',
        month: initialDate ? String(initialDate.getMonth() + 1).padStart(2, '0') : '',
        year: initialDate ? String(initialDate.getFullYear()) : ''
    });

    useEffect(() => {
        if (value) {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                setParts({
                    day: String(d.getDate()).padStart(2, '0'),
                    month: String(d.getMonth() + 1).padStart(2, '0'),
                    year: String(d.getFullYear())
                });
            }
        } else {
            setParts({ day: '', month: '', year: '' });
        }
    }, [value]);

    const update = (newParts: typeof parts) => {
        setParts(newParts);
        if (newParts.day && newParts.month && newParts.year) {
            const d = new Date(`${newParts.year}-${newParts.month}-${newParts.day}T12:00:00`);
            if (!isNaN(d.getTime())) {
                onChange(d.toISOString().split('T')[0]);
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
                placeholder="დღე"
                className="[&>div]:py-2 [&>div]:px-2 [&>div]:text-[11px]"
            />
            <SearchSelect 
                options={monthOptions} 
                value={parts.month} 
                onChange={v => update({ ...parts, month: v })} 
                placeholder="თვე"
                className="[&>div]:py-2 [&>div]:px-2 [&>div]:text-[11px]"
            />
            <SearchSelect 
                options={yearOptions} 
                value={parts.year} 
                onChange={v => update({ ...parts, year: v })} 
                placeholder="წელი"
                className="[&>div]:py-2 [&>div]:px-2 [&>div]:text-[11px]"
            />
        </div>
    );
}
