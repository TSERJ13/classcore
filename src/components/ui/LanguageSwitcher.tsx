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
    onChange,
    className
}: {
    compact?: boolean;
    noFlags?: boolean;
    variant?: 'sidebar' | 'landing';
    align?: 'left' | 'right';
    hideLabel?: boolean;
    mode?: 'persistent' | 'session';
    onChange?: (l: Lang) => void;
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
        timeoutRef.current = setTimeout(() => {
            setOpen(false);
        }, 500); // Increased timeout for easier interaction
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
                        ? "bg-transparent border-none text-white hover:bg-white/5"
                        : "bg-white border-slate-100 text-primary hover:text-indigo-600 hover:border-indigo-100 shadow-xl shadow-slate-200/50",
                    compact || hideLabel ? "w-10 h-10 md:w-12 md:h-12 justify-center rounded-xl md:rounded-2xl" : cn(
                        "px-2 md:px-4 py-2 text-[10px] md:text-[11px] font-black tracking-widest rounded-xl",
                        variant === 'sidebar' ? "min-w-0 flex-1" : "min-w-[120px]",
                        variant === 'landing' && "px-3 py-1 md:px-4 md:py-1.5 h-8 md:h-9 text-[10px] rounded-xl"
                    ),
                    className
                )}
                title={compact ? current.label : undefined}
            >
                {!noFlags && (
                    <span className={cn("shrink-0 transition-transform group-hover:scale-110", variant === 'landing' ? "text-xl md:text-xl" : "text-xl md:text-xl")}>
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
                        ? "bottom-[calc(100%+8px)] bg-[var(--sidebar-bg)] border border-white/10 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden"
                        : cn("top-full mt-1 bg-card border border-border-subtle rounded-xl shadow-xl overflow-hidden", (variant === 'landing' || (!compact && !hideLabel)) && "min-w-[140px]"),
                    (compact || hideLabel) && variant === 'sidebar'
                        ? "w-[44px] left-1/2 -translate-x-1/2"
                        : (hideLabel && variant === 'landing' && !open) // This part was a bit confusing, simplifying
                            ? "w-auto " + (align === 'right' ? "right-0" : "left-0")
                            : (align === 'right' ? "right-0" : "left-0")
                )}>
                    {(Object.entries(LANG_META) as [Lang, typeof LANG_META[Lang]][]).map(([code, meta]) => (
                        <button
                            key={code}
                            onClick={() => { 
                                setLang(code, mode); 
                                setOpen(false); 
                                if (onChange) onChange(code);
                            }}
                            className={cn(
                                "w-full flex items-center transition-all text-left group/item",
                                (compact || hideLabel) && variant === 'sidebar' ? "justify-center py-2 px-2" : cn(
                                    "gap-3 px-4 py-2.5 text-[10px] font-black tracking-widest",
                                    variant === 'landing' && "px-3 py-2 h-9"
                                ),
                                lang === code
                                    ? variant === 'sidebar' ? "bg-white/10 text-white" : "bg-indigo-500/5 text-indigo-600"
                                    : variant === 'sidebar'
                                        ? "text-white/90 hover:bg-white/5 hover:text-white"
                                        : "text-primary/80 hover:bg-surface hover:text-primary"
                            )}
                        >
                            {!noFlags && (
                                <span className={cn("text-xl transition-transform group-hover/item:scale-110", (compact || hideLabel) && variant === 'sidebar' ? "text-xl" : "mr-1")}>
                                    {meta.flag}
                                </span>
                            )}
                            {((!compact && !hideLabel) || variant === 'landing') && (
                                <span className={cn(
                                    "flex-1 ml-2",
                                    variant === 'sidebar' ? "text-white" : "text-slate-900"
                                )}>
                                    {meta.label}
                                </span>
                            )}
                            {(lang === code && ((!compact && !hideLabel) || variant === 'landing')) && (
                                <Check className={cn(
                                    "w-3.5 h-3.5 opacity-60",
                                    variant === 'sidebar' ? "text-white" : "text-indigo-600"
                                )} />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
