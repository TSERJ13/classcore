'use client';

import { useState, useRef, useEffect } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { LANG_META, type Lang } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ChevronDown, Check } from 'lucide-react';

export function LanguageSwitcher({
    compact = false,
    noFlags = false,
    variant = 'sidebar',
    align = 'left',
    hideLabel = false,
    mode = 'session',
    className
}: {
    compact?: boolean;
    noFlags?: boolean;
    variant?: 'sidebar' | 'landing';
    align?: 'left' | 'right';
    hideLabel?: boolean;
    mode?: 'persistent' | 'session';
    className?: string;
}) {
    const { lang, setLang } = useT();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setOpen(true);
    };

    const handleLeave = () => {
        timeoutRef.current = setTimeout(() => setOpen(false), 150);
    };

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', onClickOutside);
        return () => {
            document.removeEventListener('mousedown', onClickOutside);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const current = LANG_META[lang];

    return (
        <div
            ref={ref}
            className="relative"
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
        >
            <button
                onClick={() => setOpen(o => !o)}
                className={cn(
                    "flex items-center gap-2 rounded-xl transition-all duration-200 border group",
                    variant === 'sidebar'
                        ? "bg-surface/50 border-border-subtle text-primary hover:bg-surface"
                        : "bg-white border-slate-100 text-slate-600 hover:text-indigo-600 hover:border-indigo-100 shadow-xl shadow-slate-200/50",
                    compact || hideLabel ? "w-10 h-10 md:w-12 md:h-12 justify-center rounded-xl md:rounded-2xl" : cn(
                        "px-4 py-2.5 text-[11px] font-black tracking-widest rounded-xl min-w-[120px]",
                        variant === 'landing' && "px-3 py-2.5 md:px-5 md:py-3 h-10 md:h-12 text-[10px] md:text-[11px] rounded-xl md:rounded-2xl"
                    ),
                    className
                )}
                title={compact ? current.label : undefined}
            >
                {!noFlags && (
                    <span className={cn("shrink-0", variant === 'landing' ? "text-lg md:text-xl" : "text-sm")}>
                        {current.flag}
                    </span>
                )}
                {!compact && !hideLabel && (
                    <>
                        <span className="flex-1 text-left truncate ml-2 font-black tracking-widest uppercase">{current.label}</span>
                        <ChevronDown className={cn(
                            "w-3 h-3 opacity-40 transition-transform duration-200 shrink-0",
                            open && "rotate-180"
                        )} />
                    </>
                )}
            </button>

            {open && (
                <div className={cn(
                    "absolute z-50 animate-in fade-in slide-in-from-bottom-2 duration-200",
                    variant === 'sidebar'
                        ? "bottom-[calc(100%+4px)] bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)] rounded-2xl shadow-2xl overflow-hidden"
                        : cn("top-full mt-2 bg-card border border-border-subtle rounded-2xl shadow-xl overflow-hidden", (variant === 'landing' || (!compact && !hideLabel)) && "min-w-[160px]"),
                    (compact || hideLabel) && variant === 'sidebar'
                        ? "w-[44px] left-1/2 -translate-x-1/2"
                        : (hideLabel && variant === 'landing' && !open) // This part was a bit confusing, simplifying
                            ? "w-auto " + (align === 'right' ? "right-0" : "left-0")
                            : (align === 'right' ? "right-0" : "left-0")
                )}>
                    {(Object.entries(LANG_META) as [Lang, typeof LANG_META[Lang]][]).map(([code, meta]) => (
                        <button
                            key={code}
                            onClick={() => { setLang(code, mode); setOpen(false); }}
                            className={cn(
                                "w-full flex items-center transition-all text-left group/item",
                                (compact || hideLabel) && variant === 'sidebar' ? "justify-center py-2 px-2" : "gap-3 px-4 py-3 text-[10px] font-black tracking-widest",
                                lang === code
                                    ? variant === 'sidebar' ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-500/5 text-indigo-600"
                                    : variant === 'sidebar'
                                        ? "text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]"
                                        : "text-muted hover:bg-surface hover:text-primary"
                            )}
                        >
                            {!noFlags && (
                                <span className={cn("text-base transition-transform group-hover/item:scale-110", (compact || hideLabel) && variant === 'sidebar' ? "text-xl" : "mr-1")}>
                                    {meta.flag}
                                </span>
                            )}
                            {((!compact && !hideLabel) || variant === 'landing') && <span className="flex-1 ml-2">{meta.label}</span>}
                            {(lang === code && ((!compact && !hideLabel) || variant === 'landing')) && (
                                <Check className="w-3.5 h-3.5 opacity-60" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
