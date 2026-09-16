# ClassCore Architecture Migration — Server-Driven Roadmap

Status: **Live cutover in progress.** There are no real studios on this app
yet, so — per an explicit decision to stop building parallel `-v2` pilot
pages and cut the real pages over directly — `/students` (the actual live
page) now runs entirely on Server Actions + TanStack Query + RLS; the
`student-store.ts`/`StudioContext` data path is gone from that page. The
`/students-v2` and `/attendance-v2` pilot pages have been deleted (their
job — proving the pattern — is done). `/attendance` has **not** been
converted yet — see the note at the end of this doc; it turned out to be a
much larger page than the pilot assumed. `/subscriptions` is next.
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
| 2 | **Students (this pilot's code pattern)** | ✅ full CRUD built: edit, soft-delete-to-trash, group enrollment (`/students-v2`). Photo upload still deferred (needs Storage bucket policies — separate scope, not skipped by accident) | Migrate the module the pattern was built against, now that Phase 1 proved the pattern against real read volume. Both `/students` and `/students-v2` run side by side — cut over the nav link only once photo upload lands and `/students-v2` has been used in production for a real billing cycle. |
| 3 | **Attendance-marking + subscription deduction (the atomic-transaction case)** | ✅ built: `mark_attendance_and_deduct_session` RPC + `markAttendanceAction`, demoed on `/attendance-v2` | This is where "deduct a session atomically" actually matters. Built last, after the Server Action + RLS pattern was proven on two lower-stakes modules, since a bug here directly costs a studio money or a student a lesson. |

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

**Schema correction made while building this:** the first Students pass
guessed that `parent_name`, `notes`, and `status` were top-level `students`
columns. `student-store.ts` already carries a comment describing a real
production bug from that exact assumption for `birth_date`
(`PGRST204: Could not find the 'birth_date' column`) — the live table only
has `id, org_id, first_name, last_name, full_name, phone, email` as real
columns, everything else lives in the `data` JSONB column. Fixed to match:
`getStudentsPage`/`createStudentAction`/`updateStudentAction` now read/write
those three fields inside `data`, merging rather than overwriting so fields
this pilot doesn't know about (e.g. `birth_date`) survive an edit.

**Phase 2 additions — Students full CRUD:**
- `updateStudentAction`, `deleteStudentAction` (soft-delete to `trash`,
  mirroring legacy `deleteStudent()`'s behavior instead of hard-deleting),
  `getGroupsForOrg`, `updateStudentGroupsAction` — all in
  `src/app/actions/students.ts`.
- `/students-v2` UI: inline edit, delete-with-confirm, and toggleable group
  chips per student.
- **Explicitly not built:** photo upload. That needs a Supabase Storage
  bucket + its own access policy, which is a different kind of change than
  everything else here (no bucket exists to point at yet) — flagged rather
  than half-built.

**Phase 3 additions — atomic attendance-marking:**
- `supabase/migrations/20260915_mark_attendance_atomic.sql` —
  `mark_attendance_and_deduct_session(student_id, group_id, subscription_id,
  status, notes)`, a single Postgres function that locks the subscription
  row (`FOR UPDATE`), checks it's active and has sessions left, deducts one,
  and inserts the attendance row — all as one transaction. Any failure
  (inactive subscription, zero sessions left) rolls back the whole thing,
  including the attendance insert, instead of leaving a "checked in but not
  charged" row.
- `markAttendanceAction` + `getActiveSubscriptionsForStudent`
  (`src/app/actions/attendance.ts`), demoed on `/attendance-v2` via a "mark
  attendance" panel that shows the subscription's live session count and
  surfaces the RPC's error text directly (e.g. "No sessions remaining on
  this subscription") when it refuses.

New dependencies added: `zod`, `@tanstack/react-query` (neither existed in
`package.json` before this pass).

---

## 5. Status vs. this doc's original Week 1 plan

All of Phases 0-3 from §3 are now built (code + migrations). What's left is
applying/proving them, not writing more of them:

1. ~~Apply `20260915_students_rls_pilot.sql` / `_phase0_rls_gapfill.sql` /
   `_attendance_stats_rpc.sql`~~ — **done**, confirmed applied to the real
   Frankfurt Supabase project (per the message this doc was updated from).
2. **`20260915_mark_attendance_atomic.sql` still needs to be applied** the
   same way (Supabase SQL Editor) — it wasn't part of the earlier batch.
3. **Visit `/students-v2` and `/attendance-v2` on a real logged-in session**
   and confirm both return rows for that studio and *only* that studio —
   the concrete test that RLS + Server Actions work, not just compile.
   Specifically exercise: editing a student, deleting one (check it lands in
   `trash`), toggling group membership, and marking attendance against a
   subscription twice in a row to confirm the second call correctly refuses
   once sessions are exhausted.
4. **Pick 2-3 real studios' worth of test data** to sanity-check pagination
   and the daily-count RPC's performance at real scale.
5. Reconcile the `groups`/`groups_classes` and `attendance`/`attendance_logs`
   naming split noted in §3 with whoever has direct database access.
6. Photo upload for Students (needs a Storage bucket + policy) is the one
   piece of Phase 2 still open before `/students-v2` could realistically
   replace `/students`.

## 6. Deployment status

This branch (`claude/youthful-sagan-efyg4i`) has been merged into the team's
`rebrendig`/`rebranding` branches, built with `npm run build` (0 errors), and
deployed to `classcore-rebrendig.vercel.app`. `/students-v2` and
`/attendance-v2` are live there but unlinked from navigation, as designed —
visiting them directly is how to do the verification in §5 step 3.

Everything in §4 was verified with `tsc --noEmit` (clean) and `next lint`
(clean) before being written up here.

---

## 7. Live cutover: `/students` (done) and `/attendance` (not yet — see why)

**`/students` (`src/app/(dashboard)/students/page.tsx`) is now the real,
only version of this page** — no more `/students-v2`. It reuses everything
built for the pilot (Server Actions, RLS, TanStack Query) but had to grow to
match the live page's actual surface:

- New `search_students` RPC (`20260916_search_students_rpc.sql`) — the live
  page needs search + status/gender/group filters + sort + pagination + each
  row's current subscription summary, all at once. Doing that as several
  Server Action round trips (fetch a page, then fetch subscriptions, then
  filter by status in JS) would either break the pagination count or turn
  into an N+1, so it's one RPC with a `LATERAL` join instead, same reasoning
  as `attendance_daily_counts`.
- `saveStudentAction` replaces `student-store.ts`'s `updateStudent()` (full
  upsert, server-side id generation, merges into the existing `data` JSONB
  rather than overwriting it) and `checkDuplicateStudentAction` replaces the
  client-side `checkDuplicateStudent()` duplicate-name/phone/birthdate check
  — same UX (a confirm dialog before creating a likely-duplicate), same
  match rule, just server-resolved.
- `deleteStudentAction` moves the record to `trash` and then deletes it,
  matching legacy `deleteStudent()`'s soft-delete behavior.
- The card grid switched from "load everything, filter/sort in the browser"
  to server-side pagination with a "load more" button (`useInfiniteQuery`) —
  this is the actual fix for the brief's "500 students crashes the browser"
  concern, not just RLS.
- **`StudentModal` itself was left untouched.** It already only produces a
  plain `Partial<Student>` object and hands it to the page's `onSave`
  callback — persistence was always the page's job, not the modal's — so
  swapping what `onSave`/`onDelete` call underneath didn't require touching
  the modal. Its own internal reads (shop purchase history, checkin
  history, custom style presets, the embedded `IssueSubscriptionModal`) are
  still on their original stores, which is correct: those belong to Shop,
  Attendance, and Subscriptions respectively, not to this pass.

**`/attendance` (`src/app/(dashboard)/attendance/page.tsx`) has deliberately
not been converted yet.** The pilot's assumption — that this is an
attendance *list* — undersold it badly: the real page is ~2,465 lines and is
the studio's daily-operations screen, not a report. It handles live
check-in marking, companion check-ins, shop sales made at check-in time,
browsing the day's group schedule, teacher/hall display, and — notably —
subscription pause/delete actions, all from one screen, importing from
`checkin-store`, `student-store`, `subscription-store` (including
`saveSubscription`/`pauseActiveSubscription`/`deleteSubscription`),
`event-store`, `teacher-store`, `group-store`, `sales-store`, and
`sms-service`, plus the same embedded `StudentModal`/`IssueSubscriptionModal`.
Converting the whole thing in the same pass as Students would mean touching
Subscriptions, Shop, and Calendar's data layers too — undeclared scope
creep on modules nobody has asked to migrate yet, and enough surface area
that doing it carelessly risks actually breaking daily check-in, which
`mark_attendance_and_deduct_session` was specifically built to make safer,
not riskier. Two honest options for how to proceed, not yet decided:
1. **Surgical**: wire only the actual check-in action (present/absent
   marking + the session deduction it triggers) to
   `mark_attendance_and_deduct_session`, leaving the rest of the page
   (schedule browsing, sales, subscription pause/delete) on its current
   stores for now, clearly marked as such.
2. **Full page migration**: its own dedicated pass, likely comparable in
   size to everything done so far combined, given how many other modules'
   data it touches.
