import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';

export interface SearchSelectOption {
    value: string;
    label: string;
    subLabel?: string;
    badge?: string;
}

interface SearchSelectProps {
    options: SearchSelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    className?: string;
    disabled?: boolean;
}

export function SearchSelect({
    options,
    value,
    onChange,
    placeholder,
    searchPlaceholder,
    emptyText,
    className,
    disabled = false
}: SearchSelectProps) {
    const { lang } = useT();
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const translatedSearchPlaceholder = searchPlaceholder || (lang === 'ka' ? 'მოძებნეთ...' : 'Поиск...');
    const translatedEmptyText = emptyText || (lang === 'ka' ? 'მონაცემები ვერ მოიძებნა' : 'Ничего не найдено');
    const translatedPlaceholder = placeholder || (lang === 'ka' ? 'აირჩიეთ' : 'Выберите');

    const selectedOption = options.find(o => o.value === value);

    const filteredOptions = useMemo(() => {
        const query = search.toLowerCase().trim();
        if (!query) return options;
        return options.filter(o =>
            (o.label || '').toLowerCase().includes(query) ||
            (o.subLabel || '').toLowerCase().includes(query)
        );
    }, [options, search]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className={cn("relative w-full", className)}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={cn(
                    "w-full bg-surface border border-border-subtle rounded-xl px-4 py-2 min-h-[38px] flex items-center justify-between transition-all select-none",
                    disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-indigo-500/40 focus:border-indigo-500/40"
                )}
            >
                <div className="flex flex-col min-w-0 flex-1 truncate pr-2">
                    {selectedOption ? (
                        <span className="text-xs font-bold text-primary truncate leading-tight">
                            {selectedOption.label}
                            {selectedOption.subLabel && <span className="text-muted/70 font-normal ml-1">({selectedOption.subLabel})</span>}
                        </span>
                    ) : (
                        <span className="text-xs font-bold text-muted/60 truncate leading-tight">
                            {translatedPlaceholder}
                        </span>
                    )}
                </div>
                <ArrowRight className={cn("w-3.5 h-3.5 opacity-40 transition-transform duration-200 shrink-0", isOpen ? "rotate-90 text-indigo-500 opacity-100" : "rotate-0")} />
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 z-50 w-full mt-2 bg-card border border-border-subtle rounded-xl shadow-xl overflow-hidden flex flex-col animate-in slide-in-from-top-2 duration-200" style={{ maxHeight: '240px' }}>
                    <div className="p-2 border-b border-border-subtle relative">
                        <Search className="w-3.5 h-3.5 text-muted absolute left-4 top-1/2 -translate-y-1/2 opacity-50" />
                        <input
                            type="text"
                            placeholder={translatedSearchPlaceholder}
                            autoFocus
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-surface border border-border-subtle rounded-lg pl-8 pr-8 py-1.5 text-xs text-primary outline-none focus:border-indigo-500/50 transition-all font-medium"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100 transition-opacity">
                                <X className="w-3.5 h-3.5 text-primary" />
                            </button>
                        )}
                    </div>

                    <div className="overflow-y-auto flex-1 p-1 no-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="py-6 text-center text-[10px] font-bold text-muted uppercase opacity-40 select-none">
                                {translatedEmptyText}
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {filteredOptions.map((o) => {
                                    const isSelected = value === o.value;
                                    return (
                                        <button
                                            key={o.value}
                                            onClick={() => {
                                                onChange(o.value);
                                                setIsOpen(false);
                                                setSearch('');
                                            }}
                                            className={cn(
                                                "w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-between group",
                                                isSelected ? "bg-indigo-500/10 text-indigo-500" : "text-primary hover:bg-surface"
                                            )}
                                        >
                                            <span className="truncate pr-2">
                                                {o.label}
                                                {o.subLabel && <span className={cn("text-[10px] font-normal ml-1", isSelected ? "opacity-70" : "opacity-50 group-hover:opacity-70")}>({o.subLabel})</span>}
                                            </span>
                                            {o.badge && (
                                                <span className={cn(
                                                    "text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0",
                                                    isSelected ? "text-indigo-600 bg-indigo-500/20" : "text-emerald-500 bg-emerald-500/10 group-hover:bg-emerald-500/20"
                                                )}>
                                                    {o.badge}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
