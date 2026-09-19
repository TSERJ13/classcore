/**
 * Shared `{ data, error }` shape for Server Actions (docs/agents/api-contract.md).
 * Written now, adopted incrementally as modules are touched — not a mass
 * retrofit of every existing action (see docs/tasks.md's "API contract
 * convention" phase). The reason to standardize on this now, ahead of the
 * mobile app: the plain functions built to return this shape are what a
 * future `/api/v1/{entity}` route will call too (mobile can't call a
 * Server Action directly), so getting the shape right here avoids a
 * separate rewrite later.
 */

export type ActionError = { code: string; message: string };

export type ActionResult<T> =
    | { data: T; error: null }
    | { data: null; error: ActionError };

export type ListResult<T> = {
    items: T[];
    page: number;
    pageSize: number;
    totalCount: number;
};

export function ok<T>(data: T): ActionResult<T> {
    return { data, error: null };
}

export function fail<T = never>(code: string, message: string): ActionResult<T> {
    return { data: null, error: { code, message } };
}

export function okList<T>(items: T[], page: number, pageSize: number, totalCount: number): ActionResult<ListResult<T>> {
    return ok({ items, page, pageSize, totalCount });
}

/** Clamps page/pageSize query params to sane bounds; never trust client-supplied values directly. */
export function clampPagination(page?: number, pageSize?: number): { page: number; pageSize: number } {
    return {
        page: Number.isFinite(page) && (page as number) >= 1 ? Math.floor(page as number) : 1,
        pageSize: Number.isFinite(pageSize) && (pageSize as number) >= 1 ? Math.min(Math.floor(pageSize as number), 100) : 50,
    };
}
