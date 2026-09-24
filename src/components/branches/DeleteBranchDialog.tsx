'use client';

/**
 * Two-step branch deletion — Branches module PRD §6. Shows live counts of
 * what's attached (halls/students/staff) and offers moving them to another
 * branch before the delete goes through; the branch row is the only thing
 * ever actually deleted, never the attached records themselves.
 */

import { AlertTriangle, Trash2 } from 'lucide-react';
import type { Branch } from '@/types';
import type { BranchDeletionImpact } from '@/lib/logic/branches';

interface DeleteBranchDialogProps {
    branch: Branch;
    impact: BranchDeletionImpact | null;
    loadingImpact: boolean;
    otherBranches: Branch[];
    reassignTo: string;
    onReassignChange: (id: string) => void;
    onCancel: () => void;
    onConfirm: () => void;
    deleting?: boolean;
    l: (ka: string, ru: string, en: string) => string;
}

export function DeleteBranchDialog({
    branch, impact, loadingImpact, otherBranches, reassignTo, onReassignChange, onCancel, onConfirm, deleting, l,
}: DeleteBranchDialogProps) {
    const totalAttached = impact ? impact.halls + impact.students + impact.staff : 0;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onCancel} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-card border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="px-6 py-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-primary">{l('ფილიალის წაშლა', 'Удалить филиал', 'Delete branch')}</h3>
                                <p className="text-xs text-muted opacity-60">{branch.name}</p>
                            </div>
                        </div>

                        {loadingImpact ? (
                            <div className="flex items-center justify-center py-6">
                                <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                            </div>
                        ) : (
                            <>
                                {totalAttached > 0 ? (
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-1.5 text-xs font-bold text-amber-700">
                                        <p>{l('ამ ფილიალს მიბმულია:', 'К этому филиалу привязано:', 'This branch has attached:')}</p>
                                        <ul className="space-y-0.5 list-disc list-inside opacity-80">
                                            {impact!.halls > 0 && <li>{impact!.halls} {l('დარბაზი', 'зал(ов)', 'hall(s)')}</li>}
                                            {impact!.students > 0 && <li>{impact!.students} {l('სტუდენტი', 'студент(ов)', 'student(s)')}</li>}
                                            {impact!.staff > 0 && <li>{impact!.staff} {l('თანამშრომელი', 'сотрудник(ов)', 'staff member(s)')}</li>}
                                        </ul>
                                    </div>
                                ) : (
                                    <p className="text-xs font-bold text-muted opacity-60">{l('ამ ფილიალს არაფერი აქვს მიბმული.', 'К этому филиалу ничего не привязано.', 'Nothing is attached to this branch.')}</p>
                                )}

                                {otherBranches.length > 0 && totalAttached > 0 && (
                                    <div>
                                        <label className="text-xs text-muted mb-1.5 block">
                                            {l('გადავიდეს ფილიალზე:', 'Перенести в филиал:', 'Move attached data to:')}
                                        </label>
                                        <select value={reassignTo} onChange={e => onReassignChange(e.target.value)}
                                            className="w-full bg-surface border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-primary outline-none">
                                            {otherBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                <p className="text-[11px] font-bold text-muted opacity-50">
                                    {l('თავად ფილიალი წაშლილი იქნება — მასზე მიბმული მონაცემები არასდროს არ იშლება.', 'Будет удалён только сам филиал — привязанные данные никогда не удаляются.', 'Only the branch itself is deleted — attached data is never deleted.')}
                                </p>
                            </>
                        )}
                    </div>

                    <div className="flex gap-3 px-6 py-4 border-t border-border-subtle">
                        <button onClick={onCancel} className="flex-1 py-3 border border-border-subtle text-muted text-sm font-medium rounded-xl hover:bg-surface">
                            {l('გაუქმება', 'Отмена', 'Cancel')}
                        </button>
                        <button onClick={onConfirm} disabled={loadingImpact || deleting}
                            className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2">
                            {deleting ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                            {l('წაშლა', 'Удалить', 'Delete')}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
