'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, ChevronLeft, ChevronRight, Loader2, Pencil, Trash2, X, Check } from 'lucide-react';
import {
    useStudentsQuery, useCreateStudentMutation, useUpdateStudentMutation,
    useDeleteStudentMutation, useGroupsQuery, useUpdateStudentGroupsMutation,
} from '@/hooks/useStudentsQuery';
import type { StudentsPageRow } from '@/app/actions/students';

const PAGE_SIZE = 20;

type FormState = {
    full_name: string;
    phone: string;
    email: string;
    parent_name: string;
    notes: string;
    status: 'active' | 'inactive' | 'lead';
};

const EMPTY_FORM: FormState = { full_name: '', phone: '', email: '', parent_name: '', notes: '', status: 'active' };

function toFormState(row: StudentsPageRow): FormState {
    return {
        full_name: row.full_name,
        phone: row.phone,
        email: row.email || '',
        parent_name: row.parent_name || '',
        notes: row.notes || '',
        status: row.status,
    };
}

export default function StudentsV2Client() {
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
        return () => clearTimeout(t);
    }, [searchInput]);

    const { data, isLoading, isFetching, error } = useStudentsQuery({ page, pageSize: PAGE_SIZE, search });
    const { data: groups } = useGroupsQuery();
    const createStudent = useCreateStudentMutation();
    const updateStudent = useUpdateStudentMutation();
    const deleteStudent = useDeleteStudentMutation();
    const updateGroups = useUpdateStudentGroupsMutation();

    const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

    async function handleAdd(e: React.FormEvent) {
        e.preventDefault();
        setFormError(null);
        try {
            await createStudent.mutateAsync(addForm);
            setAddForm(EMPTY_FORM);
            setShowAdd(false);
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Failed to create student');
        }
    }

    function startEdit(row: StudentsPageRow) {
        setEditingId(row.id);
        setEditForm(toFormState(row));
        setFormError(null);
    }

    async function handleSaveEdit(id: string) {
        setFormError(null);
        try {
            await updateStudent.mutateAsync({ ...editForm, id });
            setEditingId(null);
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Failed to save');
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Delete this student? This moves them to trash, same as /students.')) return;
        try {
            await deleteStudent.mutateAsync({ id });
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Failed to delete');
        }
    }

    function toggleGroup(row: StudentsPageRow, groupId: string) {
        const next = row.enrolled_group_ids.includes(groupId)
            ? row.enrolled_group_ids.filter(g => g !== groupId)
            : [...row.enrolled_group_ids, groupId];
        updateGroups.mutate({ id: row.id, enrolled_group_ids: next });
    }

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs font-bold text-amber-600">
                Pilot module — server-paginated, RLS-protected students list with edit/delete/group
                enrollment (see docs/architecture-migration.md). Not linked from navigation; this does
                not replace /students. Photo upload is intentionally not built here yet (needs Storage
                bucket policies — separate scope).
            </div>

            <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        placeholder="Search by name or phone..."
                        className="w-full h-11 pl-10 pr-4 bg-surface border border-border-subtle rounded-xl text-sm outline-none focus:border-indigo-500/40"
                    />
                </div>
                <button
                    onClick={() => setShowAdd(v => !v)}
                    className="h-11 px-4 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700"
                >
                    <Plus className="w-4 h-4" /> Add
                </button>
            </div>

            {formError && <p className="text-xs text-red-500 font-bold">{formError}</p>}

            {showAdd && (
                <form onSubmit={handleAdd} className="bg-card border border-border-subtle rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={addForm.full_name} onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))} required placeholder="Full name"
                        className="h-10 px-3 bg-surface border border-border-subtle rounded-xl text-sm outline-none" />
                    <input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} required placeholder="Phone"
                        className="h-10 px-3 bg-surface border border-border-subtle rounded-xl text-sm outline-none" />
                    <input value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="Email (optional)"
                        className="h-10 px-3 bg-surface border border-border-subtle rounded-xl text-sm outline-none" />
                    <input value={addForm.parent_name} onChange={e => setAddForm(f => ({ ...f, parent_name: e.target.value }))} placeholder="Parent name (optional)"
                        className="h-10 px-3 bg-surface border border-border-subtle rounded-xl text-sm outline-none" />
                    <button type="submit" disabled={createStudent.isPending}
                        className="sm:col-span-2 h-10 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50">
                        {createStudent.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save'}
                    </button>
                </form>
            )}

            <div className="bg-card border border-border-subtle rounded-2xl overflow-hidden">
                {error && <p className="p-6 text-sm text-red-500 font-bold">{error instanceof Error ? error.message : 'Failed to load'}</p>}
                {isLoading && !data && <p className="p-6 text-sm text-muted">Loading...</p>}
                {data && (
                    <div className="divide-y divide-border-subtle">
                        {data.rows.length === 0 && <p className="p-6 text-sm text-muted">No students found.</p>}
                        {data.rows.map(row => (
                            <div key={row.id} className="px-5 py-3">
                                {editingId === row.id ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                                            className="h-9 px-3 bg-surface border border-border-subtle rounded-lg text-sm outline-none" />
                                        <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                                            className="h-9 px-3 bg-surface border border-border-subtle rounded-lg text-sm outline-none" />
                                        <input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="Email"
                                            className="h-9 px-3 bg-surface border border-border-subtle rounded-lg text-sm outline-none" />
                                        <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as FormState['status'] }))}
                                            className="h-9 px-3 bg-surface border border-border-subtle rounded-lg text-sm outline-none">
                                            <option value="active">active</option>
                                            <option value="inactive">inactive</option>
                                            <option value="lead">lead</option>
                                        </select>
                                        <div className="sm:col-span-2 flex gap-2 justify-end">
                                            <button onClick={() => setEditingId(null)} className="w-8 h-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center">
                                                <X className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleSaveEdit(row.id)} disabled={updateStudent.isPending}
                                                className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center disabled:opacity-50">
                                                {updateStudent.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-primary">{row.full_name}</p>
                                            <p className="text-xs text-muted">{row.phone}</p>
                                            {groups && groups.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {groups.map(g => {
                                                        const active = row.enrolled_group_ids.includes(g.id);
                                                        return (
                                                            <button key={g.id} onClick={() => toggleGroup(row, g.id)}
                                                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${active ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-500' : 'bg-surface border-border-subtle text-muted/60'}`}>
                                                                {g.name}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted/60">{row.status}</span>
                                            <button onClick={() => startEdit(row)} className="w-8 h-8 rounded-lg hover:bg-surface flex items-center justify-center text-muted">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleDelete(row.id)} className="w-8 h-8 rounded-lg hover:bg-red-500/10 flex items-center justify-center text-muted hover:text-red-500">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {data && data.total > 0 && (
                <div className="flex items-center justify-between text-xs font-bold text-muted">
                    <span>{data.total} total {isFetching && <Loader2 className="inline w-3 h-3 animate-spin ml-1" />}</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                            className="w-8 h-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center disabled:opacity-30">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span>{page} / {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                            className="w-8 h-8 rounded-lg bg-surface border border-border-subtle flex items-center justify-center disabled:opacity-30">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
