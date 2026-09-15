'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useAttendancePageQuery, useAttendanceDailyCountsQuery } from '@/hooks/useAttendanceQuery';

const PAGE_SIZE = 20;

function toISODate(d: Date) { return d.toISOString().split('T')[0]; }

function defaultRange() {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 29);
    return { dateFrom: toISODate(from), dateTo: toISODate(to) };
}

export default function AttendanceV2Client() {
    const [{ dateFrom, dateTo }, setRange] = useState(defaultRange());
    const [page, setPage] = useState(1);

    const { data: dailyCounts, isLoading: statsLoading } = useAttendanceDailyCountsQuery({ dateFrom, dateTo });
    const { data, isLoading, isFetching, error } = useAttendancePageQuery({ page, pageSize: PAGE_SIZE, dateFrom, dateTo });

    const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
    const maxDaily = dailyCounts && dailyCounts.length > 0 ? Math.max(...dailyCounts.map(d => d.count)) : 0;

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs font-bold text-amber-600">
                Pilot module — server-aggregated attendance history (see docs/architecture-migration.md).
                Not linked from navigation; marking attendance still happens on /attendance.
            </div>

            <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-muted">From</label>
                <input type="date" value={dateFrom} onChange={e => { setRange(r => ({ ...r, dateFrom: e.target.value })); setPage(1); }}
                    className="h-10 px-3 bg-surface border border-border-subtle rounded-xl text-sm outline-none" />
                <label className="text-xs font-bold text-muted">To</label>
                <input type="date" value={dateTo} onChange={e => { setRange(r => ({ ...r, dateTo: e.target.value })); setPage(1); }}
                    className="h-10 px-3 bg-surface border border-border-subtle rounded-xl text-sm outline-none" />
            </div>

            <div className="bg-card border border-border-subtle rounded-2xl p-4">
                <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-3">
                    Daily check-ins (computed in Postgres, not in the browser)
                </p>
                {statsLoading && <p className="text-xs text-muted">Loading...</p>}
                {dailyCounts && dailyCounts.length === 0 && <p className="text-xs text-muted">No check-ins in this range.</p>}
                {dailyCounts && dailyCounts.length > 0 && (
                    <div className="flex items-end gap-1 h-24">
                        {dailyCounts.map(d => (
                            <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1 group relative" title={`${d.day}: ${d.count}`}>
                                <div
                                    className="w-full bg-indigo-500/70 rounded-t-sm min-h-[2px]"
                                    style={{ height: `${maxDaily > 0 ? Math.max((d.count / maxDaily) * 100, 4) : 4}%` }}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-card border border-border-subtle rounded-2xl overflow-hidden">
                {error && <p className="p-6 text-sm text-red-500 font-bold">{error instanceof Error ? error.message : 'Failed to load'}</p>}
                {isLoading && !data && <p className="p-6 text-sm text-muted">Loading...</p>}
                {data && (
                    <div className="divide-y divide-border-subtle">
                        {data.rows.length === 0 && <p className="p-6 text-sm text-muted">No records found.</p>}
                        {data.rows.map(r => (
                            <div key={r.id} className="flex items-center justify-between px-5 py-3">
                                <div>
                                    <p className="text-sm font-bold text-primary">{r.student_id}</p>
                                    <p className="text-xs text-muted">{r.date} · {r.notes}</p>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{r.status}</span>
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
