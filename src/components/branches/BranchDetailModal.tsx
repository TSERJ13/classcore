'use client';

/**
 * Branch detail view — Branches module PRD §4. Halls editing/deleting is
 * deliberately delegated to /halls ("redirects directly to the halls page,
 * where the change actually happens" per the PRD) — this only lists them
 * plus offers binding an existing hall from another branch into this one,
 * which is genuinely branch-specific and doesn't belong on the halls page.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Pencil, Trash2, MapPin, Ruler, DoorOpen, Plus, ExternalLink, MessageSquareText, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Branch } from '@/types';
import { getHallsAction, saveHallsAction, type HallRow } from '@/app/actions/halls';

interface BranchDetailModalProps {
    branch: Branch;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    l: (ka: string, ru: string, en: string) => string;
}

export function BranchDetailModal({ branch, onClose, onEdit, onDelete, l }: BranchDetailModalProps) {
    const [halls, setHalls] = useState<HallRow[] | null>(null);
    const [otherHalls, setOtherHalls] = useState<HallRow[]>([]);
    const [bindTarget, setBindTarget] = useState('');
    const [binding, setBinding] = useState(false);

    const load = () => {
        getHallsAction().then(all => {
            setHalls(all.filter(h => h.branch_id === branch.id));
            const rest = all.filter(h => h.branch_id !== branch.id);
            setOtherHalls(rest);
            setBindTarget(rest[0]?.id || '');
        }).catch(err => console.error('❌ [BranchDetail] Failed to load halls:', err));
    };

    useEffect(() => { load(); }, [branch.id]);

    async function bindExistingHall() {
        if (!bindTarget) return;
        setBinding(true);
        try {
            const all = await getHallsAction();
            const next = all.map(h => h.id === bindTarget ? { ...h, branch_id: branch.id } : h);
            await saveHallsAction(next);
            load();
        } catch (err) {
            console.error('❌ [BranchDetail] Failed to bind hall:', err);
        } finally {
            setBinding(false);
        }
    }

    const mapsUrl = branch.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.address)}` : null;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-card border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[88vh] flex flex-col">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle flex-shrink-0">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {branch.photo_url ? <img src={branch.photo_url} className="w-full h-full object-cover" alt="" /> : branch.name[0]}
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-base font-bold text-primary truncate">{branch.name}</h3>
                                <span className={cn('text-[10px] font-black uppercase tracking-wide',
                                    branch.is_active ? 'text-emerald-500' : 'text-muted opacity-60')}>
                                    {branch.is_active ? l('აქტიური', 'Активен', 'Active') : l('შეჩერებული', 'Приостановлен', 'Suspended')}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={onEdit} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface text-muted hover:text-primary transition-colors">
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={onDelete} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface text-muted transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                        <div className="flex items-center gap-4 flex-wrap">
                            {branch.address && (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
                                    <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                                    {branch.address}
                                    {mapsUrl && (
                                        <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline flex items-center gap-0.5">
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            )}
                            {typeof branch.sq_meters === 'number' && (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
                                    <Ruler className="w-3.5 h-3.5 text-indigo-500" /> {branch.sq_meters} {l('მ²', 'м²', 'm²')}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-2">
                                    <DoorOpen className="w-4 h-4 text-indigo-500" />
                                    <h4 className="text-sm font-bold text-primary">
                                        {l('დარბაზები', 'Залы', 'Halls')} ({halls?.length ?? 0})
                                    </h4>
                                </div>
                                <Link href="/halls" className="flex items-center gap-1 text-[11px] font-bold text-indigo-500 hover:underline">
                                    <Plus className="w-3.5 h-3.5" /> {l('ახალი დარბაზი', 'Новый зал', 'New hall')}
                                </Link>
                            </div>

                            {halls === null ? (
                                <div className="flex items-center justify-center py-4">
                                    <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                                </div>
                            ) : halls.length === 0 ? (
                                <p className="text-[11px] font-bold text-muted opacity-50 py-2">{l('დარბაზები არ არის', 'Залов нет', 'No halls yet')}</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {halls.map(h => (
                                        <Link key={h.id} href="/halls"
                                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface/60 hover:bg-surface border border-border-subtle transition-colors">
                                            <span className="text-xs font-bold text-primary truncate">{h.name as string}</span>
                                            <Pencil className="w-3.5 h-3.5 text-muted opacity-40 flex-shrink-0" />
                                        </Link>
                                    ))}
                                </div>
                            )}

                            {otherHalls.length > 0 && (
                                <div className="flex items-center gap-2 mt-3">
                                    <select value={bindTarget} onChange={e => setBindTarget(e.target.value)}
                                        className="flex-1 bg-surface border border-border-subtle rounded-xl px-3 py-2 text-xs text-primary outline-none">
                                        {otherHalls.map(h => <option key={h.id} value={h.id}>{h.name as string}</option>)}
                                    </select>
                                    <button onClick={bindExistingHall} disabled={binding}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/10 text-indigo-600 text-[11px] font-bold hover:bg-indigo-500/20 transition-colors disabled:opacity-50 flex-shrink-0">
                                        <ArrowRightLeft className="w-3.5 h-3.5" />
                                        {l('მიბმა', 'Привязать', 'Bind')}
                                    </button>
                                </div>
                            )}
                        </div>

                        {branch.comment && (
                            <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <MessageSquareText className="w-4 h-4 text-muted" />
                                    <h4 className="text-sm font-bold text-primary">{l('კომენტარი', 'Комментарий', 'Comment')}</h4>
                                </div>
                                <p className="text-xs text-muted opacity-80 leading-relaxed">{branch.comment}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
