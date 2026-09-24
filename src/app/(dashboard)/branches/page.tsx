'use client';

/**
 * Branches management page — Branches module PRD. The header's own
 * quick-add dropdown (BranchSwitcher) stays exactly as-is per the PRD's
 * explicit "separate, quick-entry territory, unchanged by this page" note —
 * this is the full management surface: cards, hall counts, safe two-step
 * delete, detail view.
 */

import { useEffect, useState } from 'react';
import { FolderPlus, DoorOpen, MapPin, Pencil, Trash2, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/contexts/LanguageContext';
import { useStudio } from '@/contexts/StudioContext';
import { getBranchesAction, createBranchAction, updateBranchAction, deleteBranchAction, getBranchDeletionImpactAction } from '@/app/actions/branches';
import type { BranchDeletionImpact } from '@/lib/logic/branches';
import type { Branch } from '@/types';
import { BranchFormModal, type BranchFormValue } from '@/components/branches/BranchFormModal';
import { BranchDetailModal } from '@/components/branches/BranchDetailModal';
import { DeleteBranchDialog } from '@/components/branches/DeleteBranchDialog';

export default function BranchesPage() {
    const { lang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;
    const { updateSettings } = useStudio();

    const [branches, setBranches] = useState<Branch[] | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [detailBranch, setDetailBranch] = useState<Branch | null>(null);
    const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
    const [deleteImpact, setDeleteImpact] = useState<BranchDeletionImpact | null>(null);
    const [loadingImpact, setLoadingImpact] = useState(false);
    const [reassignTo, setReassignTo] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const load = () => {
        getBranchesAction().then(res => {
            if (res.error) { console.error('❌ [Branches] Failed to load:', res.error.message); return; }
            const list = res.data as unknown as Branch[];
            setBranches(list);
            updateSettings({ branches: list });
        });
    };

    useEffect(() => { load(); }, []);

    function openAdd() {
        setEditingBranch(null);
        setShowForm(true);
    }

    function openEdit(b: Branch) {
        setEditingBranch(b);
        setShowForm(true);
        setDetailBranch(null);
    }

    async function handleSave(data: BranchFormValue) {
        setSaving(true);
        try {
            if (editingBranch) {
                const payload = { ...editingBranch, ...data, id: editingBranch.id };
                const res = await updateBranchAction(payload);
                if (res.error) throw new Error(res.error.message);
            } else {
                const payload = { ...data, id: `br_${Date.now()}` };
                const res = await createBranchAction(payload);
                if (res.error) throw new Error(res.error.message);
            }
            setShowForm(false);
            load();
        } catch (err: any) {
            console.error('❌ [Branches] Save failed:', err);
            alert(err?.message || 'Failed to save branch');
        } finally {
            setSaving(false);
        }
    }

    async function openDelete(b: Branch) {
        setDeletingBranch(b);
        setDetailBranch(null);
        setDeleteImpact(null);
        setLoadingImpact(true);
        try {
            const res = await getBranchDeletionImpactAction({ id: b.id });
            if (res.error) throw new Error(res.error.message);
            setDeleteImpact(res.data);
            const fallback = (branches || []).find(x => x.id !== b.id);
            setReassignTo(fallback?.id || '');
        } catch (err) {
            console.error('❌ [Branches] Failed to load deletion impact:', err);
        } finally {
            setLoadingImpact(false);
        }
    }

    async function confirmDelete() {
        if (!deletingBranch) return;
        setDeleting(true);
        try {
            const res = await deleteBranchAction({ id: deletingBranch.id, reassignToBranchId: reassignTo || undefined });
            if (res.error) throw new Error(res.error.message);
            setDeletingBranch(null);
            load();
        } catch (err: any) {
            console.error('❌ [Branches] Delete failed:', err);
            alert(err?.message || 'Failed to delete branch');
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-10">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-xl font-bold text-primary">{l('ფილიალები', 'Филиалы', 'Branches')}</h1>
                        <p className="text-xs text-muted opacity-60">{l('ყველა ფილიალის მართვა ერთ ადგილიდან', 'Управление всеми филиалами', 'Manage all your branches')}</p>
                    </div>
                </div>
                <button onClick={openAdd}
                    className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-black text-xs px-4 h-11 rounded-xl tracking-wide shadow-lg shadow-indigo-500/25 transition-all flex-shrink-0">
                    <FolderPlus className="w-4 h-4" />
                    <span>{l('დამატება', 'Добавить', 'Add')}</span>
                </button>
            </div>

            {branches === null ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {branches.map(b => (
                        <div key={b.id}
                            onClick={() => setDetailBranch(b)}
                            className={cn('group bg-card border rounded-2xl p-5 transition-all duration-200 cursor-pointer relative',
                                b.is_active ? 'border-border-subtle hover:border-indigo-500/30 shadow-sm' : 'border-border-subtle/40 opacity-60')}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center flex-shrink-0 overflow-hidden font-black">
                                        {b.photo_url ? <img src={b.photo_url} className="w-full h-full object-cover" alt="" /> : b.name[0]}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-primary truncate">{b.name}</p>
                                        <span className={cn('text-[9px] font-black uppercase tracking-wide',
                                            b.is_active ? 'text-emerald-500' : 'text-muted opacity-60')}>
                                            {b.is_active ? l('აქტიური', 'Активен', 'Active') : l('შეჩერებული', 'Приостановлен', 'Suspended')}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button onClick={(e) => { e.stopPropagation(); openEdit(b); }}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface text-muted/40 hover:text-primary transition-colors">
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); openDelete(b); }}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-muted/40 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] font-bold text-muted">
                                <span className="flex items-center gap-1">
                                    <DoorOpen className="w-3.5 h-3.5 text-indigo-500/70" /> {b.hallCount ?? 0}
                                </span>
                                {b.address && (
                                    <span className="flex items-center gap-1 truncate min-w-0">
                                        <MapPin className="w-3.5 h-3.5 text-indigo-500/70 flex-shrink-0" />
                                        <span className="truncate">{b.address}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <BranchFormModal
                open={showForm}
                branch={editingBranch}
                onClose={() => setShowForm(false)}
                onSave={handleSave}
                saving={saving}
                l={l}
            />

            {detailBranch && (
                <BranchDetailModal
                    branch={detailBranch}
                    onClose={() => setDetailBranch(null)}
                    onEdit={() => openEdit(detailBranch)}
                    onDelete={() => openDelete(detailBranch)}
                    l={l}
                />
            )}

            {deletingBranch && (
                <DeleteBranchDialog
                    branch={deletingBranch}
                    impact={deleteImpact}
                    loadingImpact={loadingImpact}
                    otherBranches={(branches || []).filter(b => b.id !== deletingBranch.id)}
                    reassignTo={reassignTo}
                    onReassignChange={setReassignTo}
                    onCancel={() => setDeletingBranch(null)}
                    onConfirm={confirmDelete}
                    deleting={deleting}
                    l={l}
                />
            )}
        </div>
    );
}
