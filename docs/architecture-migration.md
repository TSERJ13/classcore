# ClassCore Architecture Migration — Server-Driven Roadmap

Status: **analysis + first pilot module built**, not yet linked into the live app.
Branch: `claude/youthful-sagan-efyg4i`.

This responds to the "Fat Client / 85% Frontend" critique with an actual audit of
this codebase (not a generic Next.js essay) plus one working pilot module. Every
claim below is backed by a specific file, not assumed.

---

## 1. What's actually true about the current architecture (verified)

**The critique is accurate, and the codebase confirms it more specifically than
the original brief guessed:**

- **`/api/sync/state` (GET and POST) fetches every core table for the whole
  studio in one `Promise.all`** — students, staff, groups, branches, halls,
  settings, subscriptions, attendance, sales, expenses, trash, calendar_events,
  subscription_plans, products — and the client (`StudioContext.tsx`) holds all
  of it in memory. This is the literal bulk-fetch described in the brief.

- **That route runs on the Supabase *service role* client, with the comment
  "Use Service Role to BYPASS all RLS policies!" already in the code.** The only
  tenant boundary on this path is hand-written `.eq('org_id', targetOrgId')` on
  every single query plus an app-level `auth.hasAccessToOrg()` check. RLS exists
  for a few tables (see next point) but is **irrelevant to this route** — it
  never touches the anon-key client that RLS would apply to. One missed
  `.eq()` anywhere in this file (or a new query added later that forgets it) is
  a full cross-tenant leak, with nothing in the database stopping it.

- **`students` has no RLS policy at all.** `supabase/migrations/20260415_security_hardening.sql`
  covers `profiles`, `organizations`, `groups_classes`, `subscriptions`,
  `attendance_logs` — but not `students`, the table holding the most sensitive
  PII in the app (names, phone numbers, birth dates, medical cert expiry).
  Even setting aside the service-role bypass above, this table would leak
  cross-tenant today if *any* other code path queried it with the anon key
  and forgot the org filter.

- **The overwrite/race-condition risk isn't hypothetical — it already happened
  and was already patched defensively, not at the root.** `/api/sync/bulk`'s
  comments describe exactly this: a Supabase query error was silently coerced
  to an empty array, the client's hydration-merge logic read "empty" as "every
  locally-known student was deleted from the cloud," and re-pushed stale local
  data over real edits. The fix added `queryFailed` flags per collection so the
  client can detect a transient error and skip the merge — a targeted patch for
  one specific failure mode, not a structural fix (there's no reason a *second*
  false-positive-empty class of bug couldn't exist elsewhere in the same file).

- **`StudioContext.tsx` is 1,050+ lines** holding parsed copies of every one of
  those collections, and most of the app's other stores
  (`student-store.ts`, `subscription-store.ts`, `event-store.ts`, `plan-store.ts`,
  `hall-store.ts`, `settings-store.ts`, ...) are localStorage-first with a
  "schema-less fallback" cloud sync — every write pushes a full JSON blob of
  studio settings into `studio_settings`, on top of (not instead of) whatever
  relational columns exist.

**Where the brief overstates it:** RLS isn't *entirely* absent from the schema —
five tables already have real policies from the hardening migration. The
problem is narrower and more fixable than "we have zero backend security": the
policies that exist are bypassed by the one code path (`/api/sync/*`) that
actually matters for volume, and a few high-value tables (`students` chief
among them) were simply never covered. That's good news for how the migration
should be sequenced — see §3.

---

## 2. Target architecture (agreed)

- **Auth/session**: `@supabase/ssr` cookie-based sessions — already the pattern
  in `src/lib/supabase/server.ts` / `client.ts` (used by the registration flow
  built earlier this branch). Nothing new to build here, just more callers
  using it instead of the service-role client.
- **RLS as the real boundary**: every table a Server Action touches gets a
  policy scoped by `org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())`
  — the exact shape the hardening migration already uses, kept consistent
  rather than inventing a second pattern (e.g. a JWT `org_id` claim).
- **Server Actions (`'use server'`)** for both paginated reads and mutations,
  Zod-validated, running through the SSR client so RLS actually applies.
- **TanStack Query** on the client for cache/pagination/invalidation, replacing
  the monolithic Context *for migrated modules only* — old modules keep using
  `StudioContext` until they're migrated.
- **Thin client components**: modal open/close, form inputs, tab state — no
  business logic, no bulk data.

---

## 3. Phased roadmap (zero downtime)

**The pilot module for the *code pattern* is Students** (per the request), but
**Students should not be the first module migrated in the live app.** Every
other module built or touched this whole branch (Tariffs, Subscriptions,
Registration, Dashboard) reads from `student-store.ts`/`StudioContext` — cutting
it over first maximizes blast radius for the riskiest, least-tested part of the
transition. Recommended real order:

| Phase | Module | Why this position |
|---|---|---|
| 0 | **RLS gap-fill** (`students` now; `staff`, `branches`, `halls`, `calendar_events`, `sales`, `expenses`, `products` next) | Pure database migrations, zero app code changes, zero behavior change (service-role path is untouched and still works) — closes the actual security hole immediately, independent of everything else. |
| 1 | **Analytics / attendance history (read-only)** | Read-heavy, append-only, no writes to migrate, nothing else depends on its output — the safest possible place to prove the Server Action + TanStack Query pattern against real data volume (this is where the "30,000 attendance rows" problem actually lives). |
| 2 | **Students (this pilot's code pattern)** | Now migrate the module the pattern was built against, once Phase 1 has proven the pattern under load. Both the old `/students` and new `/students-v2` (built here) can run side by side — cut over the nav link only once `/students-v2` has parity (search, sort, edit, photo upload, group enrollment) and has been used in production for a real billing cycle. |
| 3 | **Subscriptions & attendance-marking (the atomic-transaction case)** | This is where "deduct a session atomically" actually matters — do it last, once the Server Action + RLS pattern is proven on two lower-stakes modules, since a bug here directly costs a studio money or a student a lesson. |

**How old and new run side by side during the transition (the brief's actual
question):** every migrated module gets its own route (`/students-v2` here) and
its own Server Actions file, with zero shared state with `StudioContext`. The
old page keeps working, unmodified, importing from the old stores. Cut-over is
a nav-link change and a redirect, not a big-bang deploy — and it's reversible
by reverting that one link if the new page misbehaves.

---

## 4. What's built in this pass (real, working, additive — nothing removed)

- `supabase/migrations/20260915_students_rls_pilot.sql` — RLS for `students`
  (Phase 0, this table only). **Not yet applied to any real database** — same
  constraint as the registration-flow migration: no Supabase credentials in
  this session. Needs to be run via the Supabase SQL Editor before `/students-v2`
  can return any rows (RLS with no matching policy returns nothing, not an error).
- `src/app/actions/students.ts` — `getStudentsPage()` (paginated + searched read)
  and `createStudentAction()` (Zod-validated insert), both running through the
  SSR/RLS client, no service role, no manual org_id filter on the read (RLS
  does it).
- `src/hooks/useStudentsQuery.ts` — `useStudentsQuery` / `useCreateStudentMutation`,
  calling the Server Actions directly as TanStack Query's fetcher/mutator.
- `src/components/providers/QueryProvider.tsx` — a `QueryClientProvider` scoped
  to just this pilot page, not the root layout (so zero risk to any existing
  page — nothing else instantiates a `QueryClient` yet).
- `src/app/(dashboard)/students-v2/` — the demo page: server-paginated list,
  debounced search, an "add student" form using the mutation. **Not linked from
  the sidebar** — reachable only by direct URL, for review before it goes live.

New dependencies added: `zod`, `@tanstack/react-query` (neither existed in
`package.json` before this pass).

---

## 5. Week 1 execution plan

1. **Apply `20260915_students_rls_pilot.sql`** via the Supabase SQL Editor
   (same process as the registration-flow OTP migration). Confirm existing
   pages (`/students`, `/api/sync/state`) still work unchanged afterward — they
   should, since they use the service-role client, which RLS never touches.
2. **Visit `/students-v2` on a real logged-in session** and confirm the
   paginated list actually returns rows for that studio and *only* that
   studio. This is the concrete test that RLS + Server Action is working, not
   just compiling.
3. **Pick 2-3 real studios' worth of test data** (or one studio with several
   hundred students, if one exists) to sanity-check pagination performance and
   search relevance before treating the pattern as proven.
4. **Write the Phase-0 RLS migrations for the remaining uncovered tables**
   (`staff`, `branches`, `halls`, `calendar_events`, `sales`, `expenses`,
   `products`) — mechanical, low-risk, same policy shape as students.
5. **Decide Phase 1's target** (recommended: attendance history for a single
   date range/report) and scaffold its Server Action the same way — `getX`
   paginated read, one Zod schema, no service role.
6. Only after Phase 1 ships and holds up under real usage, start wiring
   `/students-v2` toward feature parity with `/students` (photo upload, group
   enrollment editing, bulk import) as Phase 2.

Everything in §4 was verified with `tsc --noEmit` (clean) and `next lint`
(clean) before being written up here.
