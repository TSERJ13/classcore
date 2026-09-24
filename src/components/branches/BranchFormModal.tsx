'use client';

/**
 * Add/Edit branch modal — Branches module PRD §5. Deliberately does NOT
 * manage halls here (that's the detail modal's job, only once the branch
 * already exists — see the PRD's own callout on why).
 *
 * Map pin: no mapping library exists in this project yet (checked before
 * building this), so instead of a fake/broken interactive map this offers
 * optional lat/lng fields plus an "open in Google Maps" link built from
 * them (or from the address text if no coordinates are set) — real,
 * working, just not an embedded map widget.
 */

import { useEffect, useState } from 'react';
import { X, Camera, MapPin, Ruler, MessageSquareText, ExternalLink, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Branch } from '@/types';

export type BranchFormValue = Partial<Branch> & { lat?: number; lng?: number };

interface BranchFormModalProps {
    open: boolean;
    branch: Branch | null;
    onClose: () => void;
    onSave: (data: BranchFormValue) => void;
    saving?: boolean;
    l: (ka: string, ru: string, en: string) => string;
}

const EMPTY: BranchFormValue = { name: '', address: '', is_active: true, sq_meters: undefined, comment: '', photo_url: '' };

export function BranchFormModal({ open, branch, onClose, onSave, saving, l }: BranchFormModalProps) {
    const [form, setForm] = useState<BranchFormValue>(EMPTY);

    useEffect(() => {
        if (open) setForm(branch ? { ...branch } : { ...EMPTY });
    }, [open, branch]);

    if (!open) return null;

    function setF<K extends keyof BranchFormValue>(k: K, v: BranchFormValue[K]) {
        setForm(p => ({ ...p, [k]: v }));
    }

    const mapsUrl = form.lat && form.lng
        ? `https://www.google.com/maps/search/?api=1&query=${form.lat},${form.lng}`
        : form.address
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.address)}`
            : null;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-card border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle flex-shrink-0">
                        <h3 className="text-base font-bold text-primary">
                            {branch ? (branch.name || l('ფილიალის რედაქტირება', 'Редактировать филиал', 'Edit branch')) : l('ახალი ფილიალის დამატება', 'Новый филиал', 'Add new branch')}
                        </h3>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface text-muted transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = (e: Event) => {
                                        const file = (e.target as HTMLInputElement).files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = (ev) => setF('photo_url', ev.target?.result as string);
                                        reader.readAsDataURL(file);
                                    };
                                    input.click();
                                }}
                                className="relative w-16 h-16 rounded-2xl bg-indigo-500/5 border-2 border-dashed border-indigo-500/20 hover:border-indigo-500/50 flex items-center justify-center flex-shrink-0 overflow-hidden group transition-all"
                            >
                                {form.photo_url ? (
                                    <img src={form.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <Camera className="w-5 h-5 text-indigo-500/40 group-hover:text-indigo-500 transition-colors" />
                                )}
                            </button>
                            <div>
                                <p className="text-xs font-bold text-primary">{l('ფოტო', 'Фото', 'Photo')}</p>
                                <p className="text-[10px] text-muted opacity-60">{l('დაწკაპუნეთ ატვირთვისთვის', 'Нажмите, чтобы загрузить', 'Click to upload')}</p>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-muted mb-1.5 block">{l('ფილიალის სახელი', 'Название филиала', 'Branch name')} *</label>
                            <input value={form.name || ''} onChange={e => setF('name', e.target.value)}
                                className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary outline-none" />
                        </div>

                        <div>
                            <label className="text-xs text-muted mb-1.5 block flex items-center gap-1.5"><Ruler className="w-3 h-3" /> {l('ფართობი (მ²)', 'Площадь (м²)', 'Area (sq. m)')}</label>
                            <input type="number" min="1" value={form.sq_meters ?? ''} onChange={e => setF('sq_meters', e.target.value ? Number(e.target.value) : undefined)}
                                placeholder="150"
                                className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary outline-none" />
                        </div>

                        <div>
                            <label className="text-xs text-muted mb-1.5 block flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {l('მისამართი', 'Адрес', 'Address')}</label>
                            <input value={form.address || ''} onChange={e => setF('address', e.target.value)}
                                placeholder={l('ქუჩა, ქალაქი...', 'Улица, город...', 'Street, city...')}
                                className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary outline-none" />
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <input type="number" step="any" value={form.lat ?? ''} onChange={e => setF('lat', e.target.value ? Number(e.target.value) : undefined)}
                                    placeholder={l('განედი (არჩევითი)', 'Широта (необязательно)', 'Latitude (optional)')}
                                    className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2 text-xs text-primary outline-none" />
                                <input type="number" step="any" value={form.lng ?? ''} onChange={e => setF('lng', e.target.value ? Number(e.target.value) : undefined)}
                                    placeholder={l('გრძედი (არჩევითი)', 'Долгота (необязательно)', 'Longitude (optional)')}
                                    className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2 text-xs text-primary outline-none" />
                            </div>
                            {mapsUrl && (
                                <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-indigo-500 hover:underline">
                                    <ExternalLink className="w-3 h-3" /> {l('რუკაზე გახსნა', 'Открыть на карте', 'Open on map')}
                                </a>
                            )}
                        </div>

                        <div>
                            <label className="text-xs text-muted mb-1.5 block">{l('სტატუსი', 'Статус', 'Status')}</label>
                            <button onClick={() => setF('is_active', !form.is_active)}
                                className={cn('w-full py-2.5 px-4 rounded-xl text-[10px] font-black tracking-widest border transition-all uppercase',
                                    form.is_active ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600' : 'bg-surface border-border-subtle text-muted opacity-70')}>
                                {form.is_active
                                    ? `✓ ${l('აქტიური', 'Активен', 'Active')}`
                                    : `✕ ${l('შეჩერებული (დროებით დახურული)', 'Приостановлен (временно закрыт)', 'Suspended (temporarily closed)')}`}
                            </button>
                        </div>

                        <div>
                            <label className="text-xs text-muted mb-1.5 block flex items-center gap-1.5"><MessageSquareText className="w-3 h-3" /> {l('კომენტარი', 'Комментарий', 'Comment')}</label>
                            <textarea value={form.comment || ''} onChange={e => setF('comment', e.target.value)}
                                rows={2}
                                className="w-full bg-surface border border-border-subtle focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-sm text-primary outline-none resize-none" />
                        </div>
                    </div>

                    <div className="flex gap-3 px-6 py-4 border-t border-border-subtle flex-shrink-0">
                        <button onClick={onClose} className="flex-1 py-3 border border-border-subtle text-muted text-sm font-medium rounded-xl hover:bg-surface">
                            {l('გაუქმება', 'Отмена', 'Cancel')}
                        </button>
                        <button onClick={() => onSave(form)} disabled={!form.name?.trim() || saving}
                            className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
                            {saving ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Check className="w-4 h-4" />
                            )}
                            {branch ? l('შენახვა', 'Сохранить', 'Save') : l('დამატება', 'Добавить', 'Add')}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
