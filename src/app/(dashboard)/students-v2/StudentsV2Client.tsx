'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useStudentsQuery, useCreateStudentMutation } from '@/hooks/useStudentsQuery';

const PAGE_SIZE = 20;

export default function StudentsV2Client() {
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [showAdd, setShowAdd] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    // Debounce: only fires the actual query 350ms after typing stops, and
    // resets back to page 1 whenever the search term changes.
    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 350);
        return () => clearTimeout(t);
    }, [searchInput]);

    const { data, isLoading, isFetching, error } = useStudentsQuery({ page, pageSize: PAGE_SIZE, search });
    const createStudent = useCreateStudentMutation();

    const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

    async function handleAddStudent(e: React.FormEvent) {
        e.preventDefault();
        setFormError(null);
        try {
            await createStudent.mutateAsync({ full_name: newName, phone: newPhone });
            setNewName('');
            setNewPhone('');
            setShowAdd(false);
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Failed to create student');
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs font-bold text-amber-600">
                Pilot module — server-paginated, RLS-protected students list (see docs/architecture-migration.md).
                Not linked from navigation; this does not replace /students.
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

            {showAdd && (
                <form onSubmit={handleAddStudent} className="bg-card border border-border-subtle rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
                    <input value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Full name"
                        className="flex-1 h-10 px-3 bg-surface border border-border-subtle rounded-xl text-sm outline-none" />
                    <input value={newPhone} onChange={e => setNewPhone(e.target.value)} required placeholder="Phone"
                        className="flex-1 h-10 px-3 bg-surface border border-border-subtle rounded-xl text-sm outline-none" />
                    <button type="submit" disabled={createStudent.isPending}
                        className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest disabled:opacity-50">
                        {createStudent.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                    </button>
                    {formError && <p className="text-xs text-red-500 font-bold self-center">{formError}</p>}
                </form>
            )}

            <div className="bg-card border border-border-subtle rounded-2xl overflow-hidden">
                {error && (
                    <p className="p-6 text-sm text-red-500 font-bold">{error instanceof Error ? error.message : 'Failed to load'}</p>
                )}
                {isLoading && !data && (
                    <p className="p-6 text-sm text-muted">Loading...</p>
                )}
                {data && (
                    <div className="divide-y divide-border-subtle">
                        {data.rows.length === 0 && <p className="p-6 text-sm text-muted">No students found.</p>}
                        {data.rows.map(s => (
                            <div key={s.id} className="flex items-center justify-between px-5 py-3">
                                <div>
                                    <p className="text-sm font-bold text-primary">{s.full_name}</p>
                                    <p className="text-xs text-muted">{s.phone}</p>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted/60">{s.status}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {data && data.total > 0 && (
                <div className="flex items-center justify-between text-xs font-bold text-muted">
                    <span>
                        {data.total} total {isFetching && <Loader2 className="inline w-3 h-3 animate-spin ml-1" />}
                    </span>
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
