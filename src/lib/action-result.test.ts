import { describe, it, expect } from 'vitest';
import { ok, fail, okList, clampPagination } from './action-result';

describe('ok', () => {
    it('wraps data with a null error', () => {
        expect(ok({ id: '1' })).toEqual({ data: { id: '1' }, error: null });
    });
});

describe('fail', () => {
    it('wraps a code/message with null data', () => {
        expect(fail('not_found', 'no such row')).toEqual({
            data: null,
            error: { code: 'not_found', message: 'no such row' },
        });
    });
});

describe('okList', () => {
    it('wraps items with pagination metadata', () => {
        expect(okList(['a', 'b'], 2, 10, 42)).toEqual({
            data: { items: ['a', 'b'], page: 2, pageSize: 10, totalCount: 42 },
            error: null,
        });
    });
});

describe('clampPagination', () => {
    it('defaults page to 1 and pageSize to 50 when unset', () => {
        expect(clampPagination(undefined, undefined)).toEqual({ page: 1, pageSize: 50 });
    });

    it('floors fractional values', () => {
        expect(clampPagination(2.9, 10.9)).toEqual({ page: 2, pageSize: 10 });
    });

    it('rejects page < 1', () => {
        expect(clampPagination(0, 10)).toEqual({ page: 1, pageSize: 10 });
        expect(clampPagination(-5, 10)).toEqual({ page: 1, pageSize: 10 });
    });

    it('caps pageSize at 100', () => {
        expect(clampPagination(1, 500)).toEqual({ page: 1, pageSize: 100 });
    });

    it('rejects a non-finite page or pageSize', () => {
        expect(clampPagination(NaN, Infinity)).toEqual({ page: 1, pageSize: 50 });
    });
});
