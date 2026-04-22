'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, CheckCircle2, Circle, Clock, StickyNote, Search, Pin } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';
import { THEMES } from '@/lib/settings-store';

interface Note {
    id: string;
    text: string;
    completed: boolean;
    pinned: boolean;
    createdAt: string;
}

interface NotesDrawerProps {
    open: boolean;
    onClose: () => void;
}

export function NotesDrawer({ open, onClose }: NotesDrawerProps) {
    const { t, lang } = useT();
    const { settings } = useStudio();
    const theme = THEMES[settings.themeKey];

    const [notes, setNotes] = useState<Note[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoaded, setIsLoaded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    useEffect(() => {
        const saved = localStorage.getItem(`cc_notes_${settings.studioSlug || 'global'}`);
        if (saved) {
            try {
                setNotes(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse notes", e);
            }
        }
        setIsLoaded(true);
    }, [settings.studioSlug]);

    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem(`cc_notes_${settings.studioSlug || 'global'}`, JSON.stringify(notes));
        }
    }, [notes, settings.studioSlug, isLoaded]);

    const addNote = () => {
        if (!inputValue.trim()) return;
        const newNote: Note = {
            id: Date.now().toString(),
            text: inputValue.trim(),
            completed: false,
            pinned: false,
            createdAt: new Date().toISOString()
        };
        setNotes([newNote, ...notes]);
        setInputValue('');
    };

    const togglePin = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setNotes(notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
    };

    const toggleNote = (id: string) => {
        setNotes(notes.map(n => n.id === id ? { ...n, completed: !n.completed } : n));
    };

    const deleteNote = (id: string) => {
        setNotes(notes.filter(n => n.id !== id));
    };

    const filteredNotes = notes.filter(n =>
        n.text.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sortedNotes = [...filteredNotes].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return 0;
    });

    if (!open) return null;

    return (
        <>
            <div
                className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />
            <div
                ref={containerRef}
                className="fixed inset-y-0 right-0 z-[101] w-full sm:w-[450px] bg-card border-l border-border-subtle shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden"
            >
                {/* Header */}
                <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-card/80 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", theme.bg, theme.text)}>
                            <StickyNote className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-primary">{l('ჩანაწერები', 'Заметки', 'Notes')}</h2>
                            <p className="text-[11px] font-bold text-muted tracking-wider">{notes.length} {l('ჩანაწერი', 'записей', 'items')}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-surface text-muted transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Input Area */}
                <div className="p-6 space-y-4 bg-surface/10">
                    <div className="relative group">
                        <textarea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    addNote();
                                }
                            }}
                            placeholder={l('დაამატეთ ახალი ჩანაწერი...', 'Добавить новую заметку...', 'Add a new note...')}
                            className="w-full h-24 bg-surface border border-border-subtle rounded-2xl p-4 text-sm text-primary placeholder:text-muted/30 focus:outline-none focus:border-indigo-500/40 transition-all resize-none shadow-inner"
                        />
                        <button
                            onClick={addNote}
                            disabled={!inputValue.trim()}
                            className={cn(
                                "absolute bottom-3 right-3 p-2 rounded-xl text-white transition-all active:scale-90 disabled:opacity-30 disabled:grayscale disabled:scale-100",
                                `bg-gradient-to-br ${theme.from} ${theme.to}`
                            )}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative flex items-center">
                        <Search className="absolute left-3 w-3.5 h-3.5 text-muted/50" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={l('ძებნა...', 'Поиск...', 'Search...')}
                            className="w-full bg-surface/50 border border-border-subtle rounded-xl pl-9 pr-4 py-2 text-xs text-primary focus:outline-none focus:border-indigo-500/30 transition-all"
                        />
                    </div>
                </div>

                {/* Notes List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar overscroll-contain">
                    {sortedNotes.length > 0 ? (
                        sortedNotes.map((note) => (
                            <div
                                key={note.id}
                                className={cn(
                                    "group p-4 rounded-2xl border transition-all duration-300 flex items-start gap-4",
                                    note.completed
                                        ? "bg-surface/50 border-border-subtle/30 opacity-60"
                                        : note.pinned
                                            ? "bg-indigo-500/5 border-indigo-500/20"
                                            : "bg-surface border-border-subtle hover:border-indigo-500/30"
                                )}
                            >
                                <button
                                    onClick={() => toggleNote(note.id)}
                                    className={cn(
                                        "mt-1 flex-shrink-0 transition-colors",
                                        note.completed ? "text-emerald-500" : "text-muted hover:text-indigo-500"
                                    )}
                                >
                                    {note.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                </button>

                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <p className={cn(
                                        "text-sm font-medium leading-relaxed break-words transition-all",
                                        note.completed ? "line-through text-muted" : "text-primary"
                                    )}>
                                        {note.text}
                                    </p>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted/40 tracking-tighter">
                                        <Clock className="w-3 h-3" />
                                        {new Date(note.createdAt).toLocaleString(lang === 'ka' ? 'ka-GE' : 'en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 items-center">
                                    <button
                                        onClick={(e) => togglePin(note.id, e)}
                                        className={cn(
                                            "p-2 rounded-lg transition-all",
                                            note.pinned
                                                ? "text-indigo-400 bg-indigo-500/10"
                                                : "opacity-0 group-hover:opacity-100 text-muted hover:text-indigo-400 hover:bg-indigo-500/5"
                                        )}
                                        title={l('ჭიკარტი', 'Закрепить', 'Pin')}
                                    >
                                        <Pin className={cn("w-4 h-4", note.pinned && "fill-indigo-500/50")} strokeWidth={note.pinned ? 2.5 : 2} />
                                    </button>

                                    <button
                                        onClick={() => deleteNote(note.id)}
                                        className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-rose-500/60 hover:text-rose-500 hover:bg-rose-500/10 transition-all flex-shrink-0"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted/30 py-10">
                            <StickyNote className="w-12 h-12 mb-3 opacity-10" />
                            <p className="text-sm font-bold tracking-widest">{searchQuery ? l('ვერ მოიძებნა', 'Не найдено', 'No results') : l('ჩანაწერები ცარიელია', 'Заметок нет', 'No notes found')}</p>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="p-4 border-t border-border-subtle bg-surface/20 text-center pb-safe-offset-2 sticky bottom-0 bg-card/80 backdrop-blur-md">
                    <p className="text-[10px] font-black text-muted/30 tracking-[0.2em]">
                        ClassCore Notes System
                    </p>
                </div>
            </div>
        </>
    );
}
