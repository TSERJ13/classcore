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
    hideLabel = false
}: {
    compact?: boolean;
    noFlags?: boolean;
    variant?: 'sidebar' | 'landing';
    align?: 'left' | 'right';
    hideLabel?: boolean;
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
                        ? "bg-[var(--sidebar-hover)] border-[var(--sidebar-border)] text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)]"
                        : "bg-surface border-border-subtle text-muted hover:text-primary hover:border-border-subtle/80 shadow-sm",
                    compact || hideLabel ? "w-10 h-10 justify-center" : cn(
                        "px-4 py-2 text-[11px] font-black uppercase tracking-widest",
                        variant === 'landing' && "px-1.5 py-1.5 md:px-4 md:py-2 text-[9px] md:text-[11px]"
                    )
                )}
                title={compact ? current.label : undefined}
            >
                {!noFlags && (
                    <span className="text-sm shrink-0">
                        {current.flag}
                    </span>
                )}
                {!compact && !hideLabel && (
                    <>
                        <span className="flex-1 text-left truncate ml-2 font-black uppercase tracking-widest">{current.label}</span>
                        <ChevronDown className={cn(
                            "w-3 h-3 opacity-40 transition-transform duration-200 shrink-0",
                            open && "rotate-180",
                            variant === 'landing' && "hidden md:block"
                        )} />
                    </>
                )}
            </button>

            {open && (
                <div className={cn(
                    "absolute z-50 animate-in fade-in slide-in-from-bottom-2 duration-200",
                    variant === 'sidebar'
                        ? "bottom-[calc(100%+4px)] bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)] rounded-2xl shadow-2xl overflow-hidden"
                        : cn("top-full mt-2 bg-card border border-border-subtle rounded-2xl shadow-xl overflow-hidden", !compact && !hideLabel && "min-w-[140px]"),
                    (compact || hideLabel) && variant === 'sidebar'
                        ? "w-[44px] left-1/2 -translate-x-1/2"
                        : hideLabel && variant === 'landing'
                            ? "w-[40px] " + (align === 'right' ? "right-0" : "left-0")
                            : (variant === 'landing' && align === 'right' ? "right-0" : "left-0")
                )}>
                    {(Object.entries(LANG_META) as [Lang, typeof LANG_META[Lang]][]).map(([code, meta]) => (
                        <button
                            key={code}
                            onClick={() => { setLang(code); setOpen(false); }}
                            className={cn(
                                "w-full flex items-center transition-all text-left group/item",
                                (compact || hideLabel) ? "justify-center py-2" : "gap-3 px-4 py-3 text-[10px] font-black uppercase tracking-widest",
                                lang === code
                                    ? variant === 'sidebar' ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-500/5 text-indigo-600"
                                    : variant === 'sidebar'
                                        ? "text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]"
                                        : "text-muted hover:bg-surface hover:text-primary"
                            )}
                        >
                            {!noFlags && (
                                <span className={cn("text-base transition-transform group-hover/item:scale-110", (compact || hideLabel) ? "text-xl" : "mr-3")}>
                                    {meta.flag}
                                </span>
                            )}
                            {(!compact && !hideLabel) && <span className="flex-1">{meta.label}</span>}
                            {(lang === code && !compact && !hideLabel) && (
                                <Check className="w-3.5 h-3.5 opacity-60" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
