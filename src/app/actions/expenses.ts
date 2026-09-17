'use server';

/**
 * Server Action for monthly Expenses — replaces expense-store.ts's
 * saveExpenses() write path (analytics/page.tsx's ExpenseModal). See
 * docs/architecture-migration.md §14.
 *
 * Uses the dual-auth helper (src/lib/server-actions-auth.ts) — Analytics
 * is gated by `canViewAnalytics`, a flag a teacher's staff record can
 * carry, so this doesn't assume an owner/admin-only caller even though
 * that's the practical common case.
 *
 * `expenses` already had full CRUD RLS (phase-0 gapfill migration) — no
 * new migration needed. SCHEMA: `id, org_id, category, amount, date,
 * description, data` per /api/sync/bulk's MINIMAL_COLUMNS map —
 * `branch_id` (sent by the old expense-store.ts write) is NOT a confirmed
 * column, kept inside `data` here instead of risking it as a top-level key.
 * One row per category, keyed deterministically
 * (`exp_${branchId}_${month}_${category}`) so re-saving the same month/
 * branch/category updates the existing row — matches the old write's own
 * id scheme exactly, so this doesn't orphan/duplicate rows already written
 * by the legacy path.
 */

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireOrgIdDualAuth } from '@/lib/server-actions-auth';

const expensesSchema = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    branchId: z.string().min(1),
    expenses: z.record(z.string(), z.number()),
});

export async function saveExpensesAction(rawInput: unknown): Promise<void> {
    const input = expensesSchema.parse(rawInput);
    const { orgId, client } = await requireOrgIdDualAuth();

    const date = `${input.month}-01`;
    const rows = Object.entries(input.expenses).map(([category, amount]) => ({
        id: `exp_${input.branchId}_${input.month}_${category}`,
        org_id: orgId,
        category,
        amount: amount || 0,
        date,
        description: category,
        data: { branch_id: input.branchId },
    }));

    const { error } = await client.from('expenses').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(error.message);

    revalidatePath('/analytics');
}
