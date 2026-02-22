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
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] transition-colors text-xs font-medium text-white/70 hover:text-white"
            >
                <span className="text-base leading-none">{current.flag}</span>
                <span>{current.label}</span>
                <svg className="w-3 h-3 text-white/30" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {open && (
                <div className="absolute bottom-full mb-2 left-0 w-40 bg-surface border border-white/[0.10] rounded-xl shadow-xl overflow-hidden z-50">
                    {(Object.entries(LANG_META) as [Lang, typeof LANG_META[Lang]][]).map(([code, meta]) => (
                        <button
                            key={code}
                            onClick={() => { setLang(code); setOpen(false); }}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm transition-colors text-left
                ${lang === code
                                    ? 'bg-indigo-500/15 text-indigo-300 font-semibold'
                                    : 'text-white/65 hover:bg-white/[0.06] hover:text-white'
                                }`}
                        >
                            <span className="text-base">{meta.flag}</span>
                            <span>{meta.label}</span>
                            {lang === code && (
                                <svg className="ml-auto w-3.5 h-3.5 text-indigo-400" viewBox="0 0 14 14" fill="none">
                                    <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
