# API / data contract convention

Why this exists: a mobile app is planned for everyone (manager, staff, client), starting after the
web app is done. Mobile can't call a Next.js Server Action directly — it needs real HTTP endpoints
(`/api/v1/{entity}`). Rather than build that layer now (premature — no consumer exists yet) or wait
and do a big-bang rewrite later, new/touched code follows a shape today that a future API route can
reuse without duplicating logic.

This is **not** a mandate to retrofit every existing Server Action. Apply it to new actions, and to
an existing one when you're already touching it for another reason. See `docs/tasks.md`'s "API
contract convention" phase for status.

## The shape

Every Server Action returns `ActionResult<T>` (`src/lib/action-result.ts`) instead of throwing for
*expected* failures (validation, not-found, permission-denied):

```ts
export type ActionResult<T> =
    | { data: T; error: null }
    | { data: null; error: { code: string; message: string } };
```

Use the `ok()` / `fail()` helpers. Reserve `throw` for genuinely unexpected failures (a Supabase
connection error, a bug) — those still surface as a generic error to the caller, same as today.

A list-returning action returns `ok({ items, page, pageSize, totalCount })` — never the bare array.
Use `clampPagination()` to normalize client-supplied `page`/`pageSize` before querying, and Supabase's
`{ count: 'exact' }` to get `totalCount` in the same query.

```ts
// list
export async function listBranchesAction(rawInput: unknown): Promise<ActionResult<ListResult<Branch>>> {
    const { page, pageSize } = clampPagination(input.page, input.pageSize);
    const { data, error, count } = await supabase.from('branches')
        .select('id, name, address', { count: 'exact' })
        .eq('org_id', orgId)
        .range((page - 1) * pageSize, page * pageSize - 1);
    if (error) return fail('query_failed', error.message);
    return okList(data, page, pageSize, count ?? 0);
}
```

## Logic separated from the Server Action wrapper

Put the actual query/business logic in a plain async function under `src/lib/logic/<entity>.ts`,
returning `ActionResult<T>`. The `'use server'` action file becomes a thin wrapper: parse input with
zod, resolve the caller via `requireStudioManager()`/`requireEffectivePermission()`, delegate.

This is the part that pays off later: when the mobile API is built, a `/api/v1/{entity}/route.ts`
resolves the caller from a bearer token instead of a cookie, then calls the *same* logic function —
no second implementation to keep in sync.

```ts
// src/lib/logic/branches.ts — plain function, no 'use server'
export async function listBranches(orgId: string, supabase: SupabaseClient, page: number, pageSize: number): Promise<ActionResult<ListResult<Branch>>> { ... }

// src/app/actions/branches.ts — Server Action wrapper
'use server';
export async function listBranchesAction(rawInput: unknown) {
    const input = listSchema.parse(rawInput);
    const { orgId, client } = await requireStudioManager();
    const { page, pageSize } = clampPagination(input.page, input.pageSize);
    return listBranches(orgId, client, page, pageSize);
}
```

Don't force this split on a trivial single-query action — it earns its keep once there's real logic
worth sharing, or once the mobile API actually needs that entity.

## Naming

- Returned `data` is camelCase (`fullName`, `paidAt`), even though DB columns are snake_case
  (`full_name`, `paid_at`). Map at the boundary — inside the logic function, not in the UI.
- `id` is always a string in the returned shape, whatever the DB column type is.
- On a detail fetch, return full nested relations (`group`, `branch`, `teacher`, …). On a list, only
  the fields actually rendered in that list — never a full nested history on every row.

## What this deliberately does not do (yet)

- No `/api/v1/{entity}` HTTP routes — build those when mobile work actually starts, reusing the
  `src/lib/logic/*` functions built under this convention.
- No auth-for-mobile design (bearer tokens vs. the current staff-token cookie / Supabase Auth
  session) — that's a real open question (existing staff-token accounts have no bearer-token
  equivalent yet) to resolve when the mobile work is scoped, not before.
- No bulk conversion of existing Server Actions that return `void` / throw on error.
