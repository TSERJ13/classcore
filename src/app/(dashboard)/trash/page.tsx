'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/contexts/LanguageContext';
import { getTrash, removeFromTrash, TrashItem } from '@/lib/trash-store';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Trash2, Search, RotateCcw, AlertCircle, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudio } from '@/contexts/StudioContext';

export default function TrashPage() {
    const { t, lang } = useT();
    const { settings } = useStudio();
    const [trash, setTrash] = useState<TrashItem[]>([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setTrash(getTrash());
        const handler = () => setTrash(getTrash());
        window.addEventListener('cc_trash_update', handler);
        return () => window.removeEventListener('cc_trash_update', handler);
    }, []);

    const filtered = trash.filter(item => {
        const name = (item.data.name || item.data.fullName || item.type).toLowerCase();
        return name.includes(search.toLowerCase());
    });

    const handleRestore = (item: TrashItem) => {
        // Logic to restore based on type
        // This usually involves pushing the data back to its respective collection
        // For simplicity in this demo, we just remove from trash and show a message
        // Real implementation should insert into localStorage/Supabase

        const keyMap: Record<string, string> = {
            'student': 'cc_students',
            'teacher': 'cc_teachers',
            'subscription': 'cc_subscriptions',
            'group': 'cc_groups'
        };

        const prefix = keyMap[item.type];
        if (prefix) {
            // Restore logic...
            const branchSlug = settings.studioSlug;
            const storageKey = `${prefix}_${branchSlug}_${item.branchId}`;
            const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
            localStorage.setItem(storageKey, JSON.stringify([...existing, item.data]));

            // Remove from trash
            removeFromTrash(item.id);
            window.dispatchEvent(new Event(`cc_${item.type}s_update`));
            alert(lang === 'ka' ? 'აღდგენილია!' : 'Restored!');
        }
    };

    return (
        <div className="flex flex-col h-screen">
            <Header />
            <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-surface/30">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0 shadow-2xl border border-rose-500/20">
                            <Trash2 className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-primary uppercase tracking-tight">
                                {t.trash}
                            </h1>
                            <p className="text-sm text-muted font-bold uppercase tracking-widest mt-1 opacity-60">
                                {lang === 'ka' ? 'წაშლილი მონაცემების შენახვა (30 დღე)' : 'Deleted items storage (30 days)'}
                            </p>
                        </div>
                    </div>

                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                        <p className="text-xs font-bold text-amber-200/80 uppercase tracking-wider">
                            {lang === 'ka'
                                ? 'მონაცემები ავტომატურად წაიშლება 30 დღის შემდეგ.'
                                : 'Data will be permanently deleted after 30 days.'}
                        </p>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t.search}
                            className="w-full bg-card border border-border-subtle rounded-[2rem] pl-14 pr-6 py-5 text-sm font-black focus:outline-none focus:border-rose-500/50 transition-all shadow-xl"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filtered.map(item => (
                            <Card key={item.id} className="p-6 rounded-[2rem] border-border-subtle hover:border-rose-500/30 transition-all group relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4">
                                    <span className="text-[10px] font-black text-rose-500/40 uppercase tracking-widest">
                                        Expires in 30 days
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-surface/50 border border-border-subtle flex items-center justify-center text-muted group-hover:text-rose-500 group-hover:bg-rose-500/5 transition-all">
                                        {/* Dynamic Icon based on type */}
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-base font-black text-primary truncate uppercase tracking-tight">
                                            {item.data.name || item.data.fullName || 'Unnamed Item'}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-black text-indigo-400 uppercase bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                                                {item.type}
                                            </span>
                                            <span className="text-[10px] font-bold text-muted uppercase">
                                                Deleted {new Date(item.deletedAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRestore(item)}
                                        className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all shadow-lg active:scale-95"
                                        title="Restore"
                                    >
                                        <RotateCcw className="w-5 h-5" />
                                    </button>
                                </div>
                            </Card>
                        ))}
                        {filtered.length === 0 && (
                            <div className="col-span-full py-20 bg-surface/10 rounded-[3rem] border-2 border-dashed border-border-subtle flex flex-col items-center justify-center text-muted opacity-20">
                                <Trash2 className="w-16 h-16 mb-4" />
                                <p className="text-sm font-black uppercase tracking-widest">{t.noData}</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
