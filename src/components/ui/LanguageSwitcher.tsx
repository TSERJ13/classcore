'use client';

import { useState, useRef, useEffect } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { LANG_META, type Lang } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
    const { lang, setLang } = useT();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const current = LANG_META[lang];

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className={cn(
                    "flex items-center gap-2 rounded-xl transition-all duration-200 border",
                    "bg-[var(--sidebar-hover)] border-[var(--sidebar-border)]",
                    "text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)]",
                    compact ? "w-11 h-11 justify-center" : "px-3 py-2 text-xs font-semibold"
                )}
                title={compact ? current.label : undefined}
            >
                <span className={cn("leading-none transition-transform", compact ? "text-2xl hover:scale-110" : "text-base")}>
                    {current.flag}
                </span>
                {!compact && (
                    <>
                        <span>{current.label}</span>
                        <svg className="w-3.5 h-3.5 opacity-40 ml-1" viewBox="0 0 12 12" fill="none">
                            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </>
                )}
            </button>

            {open && (
                <div className={cn(
                    "absolute bottom-full mb-3 left-0 bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)] rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200",
                    compact ? "w-14" : "w-40"
                )}>
                    {(Object.entries(LANG_META) as [Lang, typeof LANG_META[Lang]][]).map(([code, meta]) => (
                        <button
                            key={code}
                            onClick={() => { setLang(code); setOpen(false); }}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 text-sm transition-all text-left",
                                lang === code
                                    ? "bg-indigo-500/20 text-indigo-300 font-bold"
                                    : "text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]"
                            )}
                        >
                            <span className={cn("text-lg", compact && "text-xl")}>{meta.flag}</span>
                            {!compact && <span className="flex-1">{meta.label}</span>}
                            {lang === code && !compact && (
                                <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 14 14" fill="none">
                                    <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
