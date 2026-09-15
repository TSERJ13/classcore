# ClassCore Architecture Migration — Server-Driven Roadmap

Status: **Phase 0 (RLS gap-fill) + Phase 1 (Attendance) + the Students pattern
pilot are built.** None of this is linked into the live app yet — see §6.
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

| Phase | Module | Status | Why this position |
|---|---|---|---|
| 0 | **RLS gap-fill** — every remaining core table | ✅ built (`20260915_phase0_rls_gapfill.sql`, dynamic per-table so it skips anything not present) | Pure database migrations, zero app code changes, zero behavior change (service-role path is untouched and still works) — closes the actual security hole immediately, independent of everything else. |
| 1 | **Attendance history (read-only)** | ✅ built (`src/app/actions/attendance.ts`, `/attendance-v2`, `attendance_daily_counts` RPC) | Read-heavy, append-only, no writes to migrate, nothing else depends on its output — the safest possible place to prove the Server Action + TanStack Query pattern against real data volume (this is where the "30,000 attendance rows" problem actually lives). Daily counts now come from one grouped Postgres query, not a client-side reduce. |
| 2 | **Students (this pilot's code pattern)** | ✅ pattern built (`/students-v2`), not yet feature-complete | Migrate the module the pattern was built against, now that Phase 1 has proven the pattern against real read volume. Both `/students` and `/students-v2` run side by side — cut over the nav link only once `/students-v2` has parity (sort, edit, photo upload, group enrollment) and has been used in production for a real billing cycle. |
| 3 | **Subscriptions & attendance-marking (the atomic-transaction case)** | not started | This is where "deduct a session atomically" actually matters — do it last, once the Server Action + RLS pattern is proven on two lower-stakes modules, since a bug here directly costs a studio money or a student a lesson. |

**One finding from writing Phase 0:** the 20260415 hardening migration's
policies sit on tables named `groups_classes` and `attendance_logs`, but the
live sync routes (`/api/sync/state`, `/api/sync/bulk`) query tables named
`groups` and `attendance` — different names. Phase 0's migration targets the
names the app actually queries, so `groups`/`attendance` are covered
regardless of what the other two turn out to be, but this naming split is
worth reconciling with whoever has direct database access.

**How old and new run side by side during the transition (the brief's actual
question):** every migrated module gets its own route (`/students-v2` here) and
its own Server Actions file, with zero shared state with `StudioContext`. The
old page keeps working, unmodified, importing from the old stores. Cut-over is
a nav-link change and a redirect, not a big-bang deploy — and it's reversible
by reverting that one link if the new page misbehaves.

---

## 4. What's built in this pass (real, working, additive — nothing removed)

**Phase 0 — RLS gap-fill:**
- `supabase/migrations/20260915_students_rls_pilot.sql` — RLS for `students`.
- `supabase/migrations/20260915_phase0_rls_gapfill.sql` — RLS for every other
  core table the sync routes touch: `staff`, `groups`, `branches`, `halls`,
  `studio_settings`, `attendance`, `sales`, `expenses`, `trash`,
  `calendar_events`, `subscription_plans`, `products`. Written defensively
  (checks `information_schema` before touching a table/column) since this
  session has no way to confirm the live schema first.

**Neither migration above has been applied to any real database** — same
constraint as the registration-flow migration: no Supabase credentials in
this session. Both need to be run via the Supabase SQL Editor before
`/students-v2` or `/attendance-v2` can return any rows (RLS with no matching
policy returns nothing, not an error — so this fails silently, not loudly,
if skipped).

**Phase 1 — Attendance (read-only pilot):**
- `supabase/migrations/20260915_attendance_stats_rpc.sql` — `attendance_daily_counts(date, date)`,
  a `SECURITY DEFINER` Postgres function that re-checks the caller's own
  org membership and returns one grouped count per day — the "index in the
  database at 0.01s" the brief asked for, instead of fetching every row.
- `src/app/actions/attendance.ts` — `getAttendancePage()` (paginated, date-range
  + student filter) and `getAttendanceDailyCounts()` (calls the RPC above).
- `src/hooks/useAttendanceQuery.ts`, `src/app/(dashboard)/attendance-v2/` — the
  demo page: a date-range picker, a daily bar chart driven entirely by the
  RPC's output, and the paginated row list. **Not linked from the sidebar.**

**Students pattern pilot (built previously, unchanged this pass):**
- `src/app/actions/students.ts` — `getStudentsPage()` (paginated + searched read)
  and `createStudentAction()` (Zod-validated insert), both running through the
  SSR/RLS client, no service role, no manual org_id filter on the read (RLS
  does it).
- `src/hooks/useStudentsQuery.ts` — `useStudentsQuery` / `useCreateStudentMutation`,
  calling the Server Actions directly as TanStack Query's fetcher/mutator.
- `src/components/providers/QueryProvider.tsx` — a `QueryClientProvider` scoped
  to just these pilot pages, not the root layout (so zero risk to any existing
  page — nothing else instantiates a `QueryClient` yet; both `/students-v2` and
  `/attendance-v2` reuse this same provider component).
- `src/app/(dashboard)/students-v2/` — the demo page: server-paginated list,
  debounced search, an "add student" form using the mutation. **Not linked from
  the sidebar** — reachable only by direct URL, for review before it goes live.

New dependencies added: `zod`, `@tanstack/react-query` (neither existed in
`package.json` before this pass).

---

## 5. Week 1 execution plan

**Steps 4-5 below (Phase 0's remaining tables, Phase 1's target module) are
already done** — see §4. What's left is applying and proving them:

1. **Apply all three new migrations** via the Supabase SQL Editor, in this
   order: `20260915_students_rls_pilot.sql`, `20260915_phase0_rls_gapfill.sql`,
   `20260915_attendance_stats_rpc.sql`. Confirm existing pages (`/students`,
   `/attendance`, `/api/sync/state`) still work unchanged afterward — they
   should, since they use the service-role client, which RLS never touches.
2. **Visit `/students-v2` and `/attendance-v2` on a real logged-in session**
   and confirm both actually return rows for that studio and *only* that
   studio. This is the concrete test that RLS + Server Actions are working,
   not just compiling.
3. **Pick 2-3 real studios' worth of test data** (or one studio with several
   hundred students / thousands of attendance rows, if one exists) to
   sanity-check pagination and the daily-count RPC's performance before
   treating either pattern as proven at real scale.
4. ~~Write the Phase-0 RLS migrations for the remaining uncovered tables~~ —
   done (`20260915_phase0_rls_gapfill.sql`). Reconcile the
   `groups`/`groups_classes` and `attendance`/`attendance_logs` naming split
   noted in §3 with whoever has direct database access.
5. ~~Decide Phase 1's target~~ — done (attendance history + the daily-count RPC).
6. Once steps 1-3 hold up under real usage, start wiring `/students-v2` and
   `/attendance-v2` toward feature parity with their `/students` and
   `/attendance` counterparts (photo upload, group enrollment editing, bulk
   import, marking attendance itself as a Server Action) as Phase 2.
7. Phase 3 (Subscriptions + atomic session deduction) is still un-scaffolded
   by design — see §3's reasoning for doing it last.

Everything in §4 was verified with `tsc --noEmit` (clean) and `next lint`
(clean) before being written up here.
