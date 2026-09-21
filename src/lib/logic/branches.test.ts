import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBranch, updateBranch, deleteBranch } from './branches';

/**
 * A minimal fake of Supabase's chainable query builder: every method
 * (insert/update/delete/eq) returns the same object, and the object itself
 * is awaitable (`.then()`) so `await client.from(x).update(y).eq(z).eq(w)`
 * resolves the same way it would against a real client. `resultError` lets
 * a test simulate a query failure.
 */
function makeFakeClient(resultError: { message: string } | null = null) {
    const calls: { method: string; args: unknown[] }[] = [];
    const builder: any = {
        insert: (...args: unknown[]) => { calls.push({ method: 'insert', args }); return builder; },
        update: (...args: unknown[]) => { calls.push({ method: 'update', args }); return builder; },
        delete: (...args: unknown[]) => { calls.push({ method: 'delete', args }); return builder; },
        eq: (...args: unknown[]) => { calls.push({ method: 'eq', args }); return builder; },
        then: (resolve: (v: { error: typeof resultError }) => void) => resolve({ error: resultError }),
    };
    const from = vi.fn(() => builder);
    return { client: { from } as unknown as SupabaseClient, calls, from };
}

describe('createBranch', () => {
    it('inserts a row scoped to orgId on valid input', async () => {
        const { client, calls, from } = makeFakeClient();
        const result = await createBranch(client, 'org1', { id: 'b1', name: 'Branch One', address: 'Rustaveli 1' });

        expect(result).toEqual({ data: undefined, error: null });
        expect(from).toHaveBeenCalledWith('branches');
        expect(calls[0]).toEqual({
            method: 'insert',
            args: [{ id: 'b1', org_id: 'org1', name: 'Branch One', address: 'Rustaveli 1', data: { id: 'b1', name: 'Branch One', address: 'Rustaveli 1' } }],
        });
    });

    it('returns a validation_failed ActionResult instead of throwing on invalid input', async () => {
        const { client, calls } = makeFakeClient();
        const result = await createBranch(client, 'org1', { id: '', name: '' });

        expect(result.error?.code).toBe('validation_failed');
        expect(result.data).toBeNull();
        expect(calls).toHaveLength(0); // never touched the DB
    });

    it('returns a query_failed ActionResult (not a throw) when the DB errors', async () => {
        const { client } = makeFakeClient({ message: 'duplicate key' });
        const result = await createBranch(client, 'org1', { id: 'b1', name: 'Branch One' });

        expect(result).toEqual({ data: null, error: { code: 'query_failed', message: 'duplicate key' } });
    });

    it('defaults a missing address to null rather than undefined', async () => {
        const { client, calls } = makeFakeClient();
        await createBranch(client, 'org1', { id: 'b1', name: 'Branch One' });

        expect((calls[0].args[0] as { address: unknown }).address).toBeNull();
    });
});

describe('updateBranch', () => {
    it('scopes the update to both id and orgId', async () => {
        const { client, calls } = makeFakeClient();
        await updateBranch(client, 'org1', { id: 'b1', name: 'Renamed' });

        expect(calls[0].method).toBe('update');
        expect(calls[1]).toEqual({ method: 'eq', args: ['id', 'b1'] });
        expect(calls[2]).toEqual({ method: 'eq', args: ['org_id', 'org1'] });
    });
});

describe('deleteBranch', () => {
    it('scopes the delete to both id and orgId', async () => {
        const { client, calls } = makeFakeClient();
        const result = await deleteBranch(client, 'org1', { id: 'b1' });

        expect(result).toEqual({ data: undefined, error: null });
        expect(calls[0].method).toBe('delete');
        expect(calls[1]).toEqual({ method: 'eq', args: ['id', 'b1'] });
        expect(calls[2]).toEqual({ method: 'eq', args: ['org_id', 'org1'] });
    });

    it('rejects a missing id before touching the DB', async () => {
        const { client, calls } = makeFakeClient();
        const result = await deleteBranch(client, 'org1', {});

        expect(result.error?.code).toBe('validation_failed');
        expect(calls).toHaveLength(0);
    });
});
