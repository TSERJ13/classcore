# ClassCore Architecture Migration — Server-Driven Roadmap

Status: **Live cutover in progress.** There are no real studios on this app
yet, so — per an explicit decision to stop building parallel `-v2` pilot
pages and cut the real pages over directly — `/students` (the actual live
page) now runs entirely on Server Actions + TanStack Query + RLS; the
`student-store.ts`/`StudioContext` data path is gone from that page.
`/attendance`'s check-in write path (mark/unmark present, companion
check-ins, visit history) is server-driven too, via a small atomic RPC pair
for the session count and a TypeScript port of the subscription-selection
logic (§7). `/subscriptions` (issue/edit/pause/delete + tariff Plans CRUD)
and 4 of `/dashboard`'s stat numbers are now server-driven as well (§8). The
`/students-v2` and `/attendance-v2` pilot pages have been deleted (their
job — proving the pattern — is done). Next: everything else `/dashboard`
still computes client-side, then the remaining modules (Groups, Calendar,
Staff, Shop) — see §8's "what's left" list.
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

## 7. Live cutover: `/students` (done) and `/attendance` check-in (done, surgical)

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

**`/attendance` (`src/app/(dashboard)/attendance/page.tsx`, ~2,465 lines) is
the studio's daily-operations screen, not a report** — live check-in
marking, companion check-ins, shop sales made at check-in time, browsing the
day's group schedule, teacher/hall display, and subscription pause/delete,
all from one screen. Converting the whole thing in one pass would mean
touching Subscriptions, Shop, and Calendar's data layers too — undeclared
scope creep on modules nobody has asked to migrate yet. Took the **surgical**
option: only the actual check-in write path (present/absent marking, the
session deduction/refund it triggers, and the per-student visit history
list) moved to the server; schedule browsing, shop sales, and subscription
pause/delete are untouched, still on their original stores, clearly out of
scope for this pass.

What moved:
- `supabase/migrations/20260916_checkin_session_rpcs.sql` — two small,
  atomic, row-locking (`FOR UPDATE`) RPCs, `checkin_deduct_session` /
  `checkin_refund_session`, scoped to *only* the increment/decrement. This
  is deliberately the one part that was previously racy: the old
  `checkin-store.ts` path read a subscription's `sessions_used` into a JS
  variable, incremented it locally, and pushed the whole object back —
  two admins (or two tabs) marking the same student around the same moment
  could both read the same stale count and the loser's `+1` would silently
  overwrite the winner's, under- or over-charging a session with no error
  and no trace. A `FOR UPDATE` lock inside a `SECURITY DEFINER` function
  makes that physically impossible: the second writer blocks until the
  first one's transaction commits, then reads the already-updated row.
- `src/app/actions/checkin.ts` — the "which subscription do we charge/
  refund" resolution is a faithful **TypeScript** port of
  `subscription-store.ts`'s `getSubscription()` / `refundSessionsUsed()`
  candidate-selection tiers (plan-type/group-id fallback, manual-default
  priority, oldest-purchased-for-continuation on charge vs.
  newest-purchased-with-sessions-used on refund) — kept in TS rather than
  PL/pgSQL specifically so it stays line-by-line diffable against the
  original instead of being reimplemented blind in SQL. Exposes
  `markPresentAction`, `refundCheckinAction`, `recordCompanionCheckinAction`,
  `deleteCompanionCheckinAction`, `getCheckinsForDateAction`,
  `getCheckinCountTodayAction`, `getStudentCheckinsAction`,
  `deleteCheckinAction`.
- `src/lib/checkin-client.ts` — a client-side adapter exposing the exact
  same function names/signatures as `checkin-store.ts` (`recordCheckin`,
  `forceCheckin`, `refundCheckin`, `recordCompanionCheckin`,
  `deleteCompanionCheckin`, `getCheckinsForDate`, `getCheckinCountToday`,
  `getStudentCheckins`, `deleteCheckin`) but backed by the Server Actions
  above instead of localStorage — so `attendance/page.tsx`'s call sites
  only needed `await` added, not a rewrite. `getSessionsRemaining` (a pure
  read against the not-yet-migrated subscription cache) stays imported from
  `checkin-store.ts`.
- `attendance/page.tsx`: `toggle()`, `toggleCouple()`, `confirmDouble()`,
  `processCode()` (QR/RFID scan), the bulk "mark all present"/"delete
  attendance" buttons, and the student drawer's visit-history list all now
  go through the adapter. All surrounding logic — the multi-subscription
  choice popup, the "1 visit left" SMS trigger, couple-checkin pairing, the
  historical companion-checkin/date-argument/class-identity bug fixes — is
  unchanged.
- Known limitation, accepted for this pass: `subs` (the schedule/roster's
  subscription display state) is still read from `subscription-store.ts`'s
  localStorage cache, which nothing writes to anymore now that deduction
  happens server-side. To avoid that going stale mid-session, every mutating
  call site patches `subs` locally from the server action's actual returned
  `sessions_used`/`sessions_total` (`patchSubAfterCheckin`) — correct for
  this tab, this session, immediately after a mark/unmark. It does **not**
  fix staleness from another device/tab; that only goes away once
  `/subscriptions` (the next step) moves this whole read path off
  localStorage too.
- Bug found and fixed while building this: `checkin.ts`'s subscription
  lookup used an exact `.eq('student_id', studentId)` match, but a couple/
  individual-pair subscription stores `student_id` as a literal comma-joined
  string ("id1, id2") — same as `subscription-store.ts`'s own
  `getStudentSubscriptions()`. An exact match would silently miss the shared
  subscription for either partner, breaking session deduction/refund for
  couple check-ins specifically. Fixed to fetch by substring and filter by
  comma-split membership, matching the legacy behavior exactly.

## 8. Subscriptions + Dashboard stats

`supabase/migrations/20260917_subscriptions_write_rls_and_stats.sql`:
- **`subscriptions` had no INSERT/UPDATE/DELETE RLS policy at all** — only
  the original SELECT-only policy from `20260415_security_hardening.sql`.
  Added the missing 3, same 4-policy shape as the students pilot. This is
  why the attendance check-in RPCs had to mutate `subscriptions` from inside
  a `SECURITY DEFINER` function instead of a plain RLS-respecting
  `.update()` — that workaround is no longer the only option, but is kept
  as-is for the check-in path since it's already correct and live.
- `expire_overdue_subscriptions()` — flips `status='active'` rows with
  `expires_at < current_date` to `'expired'`, scoped to the caller's org. No
  `pg_cron` schedule is set up (enabling that extension is a Supabase
  dashboard action outside what a migration file can do or verify) — instead
  this runs as a lazy sweep at the top of `get_dashboard_stats()` and before
  `getSubscriptionsAction()`'s read, so the next time anyone in the org
  looks at stats or the subscriptions list, overdue rows are already
  correct. **If true unattended cron is wanted, `pg_cron` needs to be
  enabled from the Supabase dashboard first** — flagging this rather than
  assuming it's already on.
- `get_dashboard_stats()` — one RPC for the 4 numbers requested: active
  students, this month's revenue, today's check-ins, subscriptions expiring
  within 7 days. Revenue is a faithful SQL port of `studio-stats.ts`'s
  `subRevenue`/`isSubInMonth` (positive `amount_paid` wins, else the
  matching Plan's price by name then by id; "in this month" matches
  `purchased_at`, falls back to `created_at` converted to Asia/Tbilisi — no
  per-org timezone setting exists today so this is a fixed offset, worth
  revisiting if the app ever has studios outside Georgia — and carries the
  same documented 2026-08-31 legacy-backfill shim) plus shop `sales`,
  summed together, exactly matching what the current dashboard code sums
  (confirmed: this is *not* subscriptions-only revenue). "Active students"
  and "expiring soon" are both **distinct student counts**, not raw
  subscription counts — matching `dashboard/page.tsx`'s existing
  `studentsWithActiveSub`/`expiringSoonStudents` definitions (there's a
  documented divergence in the original code between "active" by raw
  `status` field vs. `getEffectiveStatus()`'s richer suspended/cancelled
  model — this RPC preserves the simpler one the dashboard already uses,
  not `getEffectiveStatus()`'s).

`src/app/actions/subscriptions.ts` / `src/app/actions/plans.ts`:
- `getSubscriptionsAction`, `issueSubscriptionAction`, `updateSubscriptionAction`,
  `pauseSubscriptionAction`, `deleteSubscriptionAction` — replace
  `subscription-store.ts`'s `getSubscriptions`/`saveSubscription`/
  `deleteSubscription`/`pauseActiveSubscription`. Schema kept minimal (`id,
  org_id, student_id, status, sessions_used, sessions_total, starts_at,
  expires_at, price, data`), same reasoning as `students.ts`'s PGRST204
  note — the full `SubscriptionInfo` object still rides in `data`.
  `issueSubscriptionAction` re-checks the studio's `enabledFeatures`
  (personal/individual/rental plan-type gating) server-side, reading
  `studio_settings.staff_data->'_operations'->'cc_studio_settings'
  ->'enabledFeatures'` — the same nested path the existing superadmin API
  route reads/writes; defaults to **allowed** if that path is missing
  entirely (matching `isFeatureEnabled()`'s "undefined = enabled" rule, and
  erring toward not blocking a studio over a schema assumption that
  couldn't be verified against the live DB in this session).
- `getPlansAction`, `savePlansAction`, `deletePlanAction` — replace
  `plan-store.ts`'s `getPlans`/`savePlans`/`deletePlan`. `savePlansAction`
  keeps the same whole-array-replace contract `plan-store.ts` always had
  (there was never a per-row upsert) rather than inventing a new API the
  existing `/subscriptions/plans` page wasn't built around.
- `src/app/actions/dashboard.ts` — thin wrapper calling `get_dashboard_stats()`.

Page wiring:
- `/subscriptions/page.tsx`: list load, issue, edit/save, delete all go
  through the new actions; `SubscriptionModal`'s inline pause action
  (previously a direct `pauseActiveSubscription()` store call) now calls
  `pauseSubscriptionAction`. Everything else — `IssueSubscriptionModal`'s own
  side effects (student balance deduction, group auto-enrollment, generated
  calendar events for individual-lesson schedules, the `logSubscription`
  audit entry via `StudioContext`), `BookIndividualLessonModal` — is
  untouched, still calling `student-store.ts`/`event-store.ts` directly, out
  of scope for this pass.
- `/subscriptions/plans/page.tsx`: list/create/edit/delete/toggle-active/
  toggle-default all go through `plans.ts`'s actions instead of
  `plan-store.ts`.
- `/dashboard/page.tsx`: a second, small `useEffect` calls
  `getDashboardStatsAction()` and overlays its 4 numbers onto the existing
  `liveStats` state *after* the page's own (unchanged) client-side
  `refreshFullDashboard()` has already run — server values win once they
  arrive, everything else on the page (revenue trend chart, occupancy,
  churn-risk list, AI insights) still comes from the original client-side
  computation. Deliberately not a full dashboard rewrite — out of scope for
  what was asked.

**What's left before `StudioContext`/`/api/sync/state` can actually go
away** (§8 only covered 4 of the dashboard's numbers and Subscriptions'
core CRUD):
- `/dashboard`'s other cards: revenue trend/occupancy/churn-risk/AI insights
  still read `getStudents`/`getUniqueSubscriptions`/`getSales`/`getPlans`
  from local stores.
- `IssueSubscriptionModal`'s own direct `student-store.ts`/`event-store.ts`
  calls (balance, group enrollment, generated calendar events).
- `getPlans()` elsewhere (e.g. inside `IssueSubscriptionModal`,
  `findTariffForSubscription`) still reads the local `plan-store.ts` cache —
  it stays *eventually* correct because `StudioContext`'s background
  `/api/sync/state` hydration still runs and refreshes it independently, but
  it's not instant the way the new Server Actions are.
- Every other module not yet touched: Calendar/Events, Staff,
  Branches/Halls, Shop/Sales, SMS templates, Settings.
  (Groups' own CRUD moved in §9 below — Calendar's group-writing side
  effects did not.)
- `StudioContext.tsx` itself (1042 lines) still runs its full hydration/
  merge engine on every page — nothing has been removed from it yet, since
  other pages still depend on the localStorage state it populates.

## 9. Groups (`/groups`)

`groups` already had full CRUD RLS from `20260915_phase0_rls_gapfill.sql`
(confirmed: `'groups'` — the live table name — is literally in that
migration's table array, unlike `subscriptions` which needed its own
follow-up) — no new migration needed for this module.

`src/app/actions/groups.ts`: `getGroupsAction`, `createGroupAction`,
`updateGroupAction`, `deleteGroupAction`, same `id, org_id, name, data`
schema pattern as everything else. `createGroupAction` persists the
client-supplied id verbatim rather than minting its own — `GroupModal`
already generates a client-side id before calling `onSave` and reuses that
exact id right after to sync the group's `schedule_slots` into real
calendar events (`syncGroupScheduleToCalendar`, `event-store.ts`); minting
a different server-side id would have split a group from its own calendar
events.

**Scoped to the Groups management page's own CRUD only** — 15 files import
`group-store.ts` across the app (attendance, calendar, dashboard, analytics,
teachers, subscriptions/plans, `IssueSubscriptionModal`, `StudentModal`, the
public student page, header search, SMS modal, onboarding — full inventory
in the research this section is based on). Two are explicitly left alone:
- **Calendar** (`calendar/page.tsx`) still writes to `group-store.ts`
  directly — `createGroup()` when an unrecognized group name is typed while
  adding a calendar event, `addSlotToGroup`/`removeSlotFromGroup` to keep
  `schedule_slots` in sync with recurring events, and a direct color patch.
  Calendar/Events is its own not-yet-migrated module; folding its
  group-writing side effects into this pass would be scope creep. Both
  write paths land on the same real `groups` table, so nothing conflicts —
  Calendar's writes still go through the old sync path, the Groups page's
  through RLS-respecting Server Actions.
- **Teachers** (`teachers/page.tsx`) and `StudioContext`'s
  `updateTeacherGroups()` (on teacher deletion) still reconcile a group's
  `teacherId`/`secondaryTeacherId` via `group-store.ts` from the Staff side
  — Staff is also not yet migrated.

Every other, read-only consumer keeps reading `getGroups()`'s local cache,
staying eventually consistent via `StudioContext`'s background hydration —
same reasoning already documented for Plans in §8.

**Pre-existing inconsistency found, not fixed (not asked, and "fixing"
silently would risk changing numbers someone already relies on):**
`groups/page.tsx`'s own enrollment count (now server-driven via
`getSubscriptionsAction`, matching its exact prior behavior:
active+unexpired subscriptions with a matching `group_id`) is a **different
computation** than `analytics/page.tsx`/`dashboard/page.tsx`'s enrollment
count (active students whose `enrolled_group_ids` includes the group). The
two already disagreed before this migration; this pass preserves the
`/groups` page's own definition rather than quietly reconciling it with the
other one.

## 10. Staff — writes only, and why reads stay put

This module is structurally different from everything migrated so far:
**staff/teacher end users don't authenticate through Supabase Auth at
all.** They log in via a completely separate, parallel system — a signed
`cc_staff_token` HMAC cookie (`src/lib/staff-token.ts`), checked server-side
today only by service-role endpoints (`src/lib/sync-auth.ts`,
`src/lib/session-check.ts`) that hand-roll their own `org_id` scoping. A
teacher session has **no Supabase Auth session and no `profiles` row** —
`auth.uid()` is always null for them.

Every already-migrated page that reads teacher/staff data is viewed by
teachers themselves, not just owners/admins: attendance, groups, dashboard,
and students all call `access.ts`'s `getVisibleGroupIds()` or
`teacher-store.ts`'s `getTeachers()`/`getTeacherName()`/`getTeacherPhoto()`
specifically to filter what a *teacher* sees. An `auth.uid()`-gated read
Server Action — the pattern used everywhere else in this migration — would
return "Not authenticated" for every one of those sessions. **So this pass
migrates writes only** (`src/app/actions/staff.ts`:
`createStaffAction`/`updateStaffAction`/`deleteStaffAction`), which are
safe under the same `auth.uid()` pattern because every real call site
(`/teachers`, `/settings`'s "Staff Access" section, `/profile`'s "Team"
tab) is only ever reachable by an owner/admin/manager who did authenticate
through real Supabase Auth. Reads keep coming from `teacher-store.ts`'s
local `settings.staff` cache, unchanged — genuinely fixing this needs
either a `cc_staff_token`-aware branch in these Server Actions (mirroring
`sync-auth.ts`) or a separate decision about migrating staff auth itself,
neither of which was asked for here.

`supabase/migrations/20260918_staff_write_rls.sql`: `staff` was already in
the phase-0 gapfill migration's table array, but no `CREATE TABLE staff`
exists anywhere in this repo's migration history (it predates the repo's
migrations folder) — so whether the 4 policies actually attached couldn't
be confirmed by reading files. This migration re-applies them idempotently
(drop-if-exists + recreate, same "IF org_id column exists" guard as the
phase-0 migration) so running it *is* the verification.

Wired additively into `StudioContext.tsx`'s `addStaff`/`updateStaff`/
`removeStaff` — each now also calls the matching Server Action, alongside
(not instead of) the existing service-role sync path
(`settings-store.ts`'s `saveSettings()` → `syncRecordToCloud('staff', ...)`
/ `deleteRecordFromCloud('staff', ...)`). Kept additive on purpose: the read
side isn't migrating this pass, so the local `settings.staff` cache still
needs to keep getting populated the old way for `teacher-store.ts` and
`useUser.tsx`'s staff-session hydration to keep working.

**Flagged, not fixed — a separate, security-sensitive piece of work:**
`src/app/api/auth/staff-login/route.ts` compares `staff.password` in
plaintext. This migration writes `password` through as given (needed since
the login route reads it as a plain top-level column); it does not hash it
— hashing here without also changing the login route's comparison would
just break every staff login. Worth prioritizing as its own task.

**Not migrated, and out of scope for this pass:** staff CRUD UI is
duplicated across three separate pages with three separate modals
(`/teachers`'s `TeacherModal`, `/settings`'s inline "Staff Access" form,
`/profile`'s inline "Team" tab form) plus a fourth, superadmin-only direct
write path (`superadmin/studios/page.tsx`) that mutates `settings.staff`
out of band from `addStaff`/`updateStaff`. All three UI paths now benefit
from the new Server Actions transparently (they all go through
`StudioContext`'s `addStaff`/`updateStaff`/`removeStaff`), but consolidating
them into one UI, or covering the superadmin path, wasn't asked for and
isn't done here.

## 11. Branches + Halls

**Halls** (`src/app/actions/halls.ts`): a conventional port. `halls` already
had full CRUD RLS and `hall-store.ts` already dual-wrote to the real table
(`pushCollectionToCloud`) — same shape as Groups. `getHallsAction`,
`saveHallsAction` (whole-array replace, matching `hall-store.ts`'s
`saveHalls()` contract — it never had a per-row upsert either),
`deleteHallAction`. Wired into `/halls/page.tsx`; the delete side effect
(`clearHallFromEvents(id)`, detaching the hall from calendar events) stays
client-side, same "keep side effects in the page, swap only the raw
persistence" pattern as Groups' `deleteGroupEvents`.

**Branches** (`src/app/actions/branches.ts`) turned out different from
every other module so far: `branches` already had full CRUD RLS ready (same
migration, same table array) but **nothing had ever written a real row into
it** — branch data has lived entirely inside
`studio_settings.settings.branches`, a JSONB blob (`StudioContext.tsx`'s
`addBranch`/`updateBranch`/`removeBranch` only ever called
`updateSettings()`/`saveSettings()`, no `syncRecordToCloud('branches', ...)`
call exists anywhere, unlike Staff/Halls which already had one). So this
isn't "port an existing real-table path to RLS," it's activating a table
that was previously inert. Decided to activate it rather than leave it
dead weight, wired the same additive way as Staff: `createBranchAction`/
`updateBranchAction`/`deleteBranchAction` now also get called alongside the
existing settings-blob path, not instead of it, since every branch reader
(`BranchSwitcher`, the sidebar, the profile page's own branches tab, staff
`allowedBranchIds` scoping) still reads `settings.branches` and isn't
migrating this pass. **This only takes effect going forward** — branches
created before this change (including the default `"main"` branch every
studio already has) only exist in the settings blob; they aren't
retroactively backfilled into the real table, since that would need
enumerating every org's existing settings blob directly, which isn't
possible from a migration file.

No new RLS migration needed for either — both were already in the phase-0
gapfill migration's table array (confirmed for both: literally present,
with `org_id` columns per `/api/sync/bulk`'s `MINIMAL_COLUMNS` allowlist).

**Confirmed, not changed:** there is no per-entity `branch_id` database
column or RLS boundary anywhere in the schema — "multi-branch" today is
entirely a client-side UI filter over org-wide data (students, expenses,
staff `allowedBranchIds`), never a security boundary. `org_id` stays the
only real tenant boundary, same as every other module in this migration.

## 12. Calendar/Events — researched, deliberately NOT migrated this pass

This is the one module in this migration where I stopped short of writing
code, on purpose. `calendar_events` already has full CRUD RLS (confirmed:
in the phase-0 gapfill migration's table array, with a real `org_id`
column per `/api/sync/bulk`'s `MINIMAL_COLUMNS` map) — no new RLS migration
is even needed. What stopped me is `event-store.ts`'s actual write model,
which is unsafe to port faithfully *or* to quietly fix:

1. **There is no real per-occurrence identity for recurring events.** Only
   the *current calendar week's* row for a recurring group class is ever a
   concrete, addressable `calendar_events` row (`syncGroupScheduleToCalendar`
   wipes and regenerates it every time groups load); every other week, and
   every individual lesson derived from a subscription's own weekly
   schedule, is recomputed fresh on every render with a synthetic id
   (`_wN` suffixes, `sub-ind-{subId}-{date}`) that has no row behind it.
   "Edit" or "delete" on one of those synthetic ids is, today, either a
   silent no-op (`updateEvent`/`deleteEvent` against an id nothing in the
   real array matches — confirmed in the store's own code, no error
   surfaces) or it mutates the *whole recurring template* instead of just
   the one occurrence someone clicked. Porting this 1:1 means faithfully
   reproducing UI actions that silently do nothing or do the wrong thing;
   fixing it under this migration would be a real product decision (a
   proper per-occurrence exception model), not "move the write to a
   Server Action."
2. **Teacher/staff-token reachability is pervasive here, not incidental —
   across writes, not just reads.** Staff's migration could stay safe by
   moving writes only, because every Staff write is admin-only in
   practice. Calendar doesn't have that clean split: teachers routinely
   call `event-store.ts` directly today to book their own individual
   lessons (`BookIndividualLessonModal`, `createIndividualBooking`),
   publish/withdraw their own open availability
   (`individual-availability/page.tsx`, `publishOpenSlot`/`deleteOpenSlot`),
   and edit/drag their own calendar (gated only by a `canEditCalendar` flag
   on their own staff record, never by `auth.uid()` — confirmed via
   `useUser.tsx`'s staff-token branch, which populates `profile` from the
   local `settings.staff[]` record with no server round-trip). An
   `auth.uid()`-gated Server Action would lock teachers out of exactly the
   self-service actions this module exists for.
3. `start_time`/`end_time` are stored as full timestamps in the DB (not the
   `HH:MM` strings the `CalendarEvent` type and every consumer use in
   memory) with no separate `date` column — every read already does a
   timestamp→date+HH:MM split; any Server Action needs to either keep
   doing that split or introduce a real `date` column, another decision
   with knock-on effects across ~19 files that import `event-store.ts`.

None of this makes Calendar un-migratable — it means it needs its own
explicit scoping conversation (which occurrence-editing bugs to fix vs.
preserve, how to handle teacher-token writes) before code gets written,
the same way Attendance's real size forced a decision before that
migration started. Left on `event-store.ts`/localStorage for now; every
consumer (`calendar/page.tsx`, `attendance/page.tsx`'s schedule display,
`dashboard/page.tsx`'s schedule widget, `individual-availability/page.tsx`,
`BookIndividualLessonModal`, the public student portal) is unaffected by
everything else in this migration and keeps working exactly as before.

## 13. Shop (Sales + Products) — and a reusable dual-auth path for Server Actions

Same teacher-token reachability problem as Calendar (attendance's quick-sell
drawer lets a teacher record a sale during their own class, with no
Supabase Auth session), but none of Calendar's virtual-occurrence
complexity — so this was safe to actually close, by finally answering the
question the Staff/Calendar research kept surfacing: **what does a Server
Action do when the caller is a staff-token session with no `auth.uid()`?**

`src/lib/server-actions-auth.ts`'s `requireOrgIdDualAuth()`: try real
Supabase Auth first (RLS-respecting client — safest, used for every owner/
admin call); if that comes back empty, fall back to the `cc_staff_token`
cookie (`verifyStaffToken()`) and hand back a **service-role** client
manually scoped to that token's `orgId`. This isn't a new pattern — it's
`src/lib/sync-auth.ts`'s existing `getAuthenticatedOrgId()` (already used
by every `/api/sync/*` route), rehomed as a reusable Server Action helper
instead of a per-route copy. Every query made with the service-role branch
of this client has to be manually `.eq('org_id', ...)`-scoped by the
caller — there's no RLS backstop on that branch, same as the existing
service-role endpoints.

`src/app/actions/sales.ts` / `src/app/actions/products.ts`: both tables
already had full CRUD RLS (in the phase-0 gapfill migration's array) — no
new RLS migration needed. `getSalesAction`/`getStudentSalesAction`/
`recordSaleAction`/`updateSaleAction`/`deleteSaleAction` replace
`sales-store.ts`; `getProductsAction`/`saveProductsAction` (whole-array
replace, matching `product-store.ts`'s existing contract)/
`deleteProductAction` replace `product-store.ts`. Both kept to confirmed-
real columns only (`sales`: `id, org_id, student_id, data` — despite
`/api/sync/bulk`'s column map listing `product_id`/`amount`/`date` too,
the app's actual write path has never populated them, so this matches
current behavior rather than starting to; `products`: `id, org_id, name,
price, category, data`).

Wired into `/shop/page.tsx` (the main Shop management page) and
`attendance/page.tsx`'s quick-sell drawer, including a bug fix found along
the way: the drawer's inventory decrement wrote directly to the
`cc_shop_products` localStorage key, bypassing `product-store.ts` (and,
now, the new action) entirely — a sale recorded from the attendance drawer
never actually persisted its inventory change anywhere durable. Now both
the sale and the inventory update go through the same Server Actions the
Shop page uses.

**This dual-auth pattern is now available for any future module** that
needs the same thing Calendar was blocked on — it doesn't resolve
Calendar's own virtual-occurrence problem, but it removes the auth half of
that module's blocker for whenever the occurrence-model decision gets made.

## 14. Expenses (Analytics' monthly expense entry)

`src/app/actions/expenses.ts`'s `saveExpensesAction`, using the dual-auth
helper (Analytics is gated by `canViewAnalytics`, a flag a teacher's staff
record can carry, even though entering rent/utilities figures is a
practically owner/admin task). `expenses` already had full CRUD RLS
(phase-0 gapfill) — no new migration. One upserted row per category, keyed
`exp_${branchId}_${month}_${category}` — matches `expense-store.ts`'s own
existing id scheme exactly, so it updates the same rows the legacy path
already created rather than duplicating them. Kept to confirmed-real
columns (`id, org_id, category, amount, date, description, data`) — the
old write also sent `branch_id` as a top-level key, which isn't a
confirmed column; moved it into `data` instead.

Wired additively into `analytics/page.tsx`'s `ExpenseModal`'s save button
— calls both the existing `expense-store.ts` write (local cache + legacy
sync) and the new action, same reasoning as Staff/Branches: `getExpenses()`
reads (several of them synchronous `useState` initializers) aren't
migrating this pass, so the local cache still needs to stay populated the
old way.

## 15. Explicitly deferred: SMS templates and general Settings

`settings.sms_templates` (edited via `/sms-manager`) and the rest of
`StudioSettings` have never had a dedicated real-table write path at
all — unlike Branches (which at least got activated this pass), they live
purely inside the `studio_settings.staff_data` JSONB blob, nested under a
path (`staff_data._operations.cc_studio_settings.*`) whose exact shape
could only be partially confirmed during the Staff module's research (see
§10) and never against a live database. Writing to a nested JSON path I
can't verify, for a low-value/low-risk feature like message templates,
isn't worth the chance of a malformed patch silently corrupting unrelated
settings — unlike Branches (two flat fields, an insert into an otherwise-
empty table) or Expenses (a handful of confirmed top-level columns), there
is no safe, defensible move here without a live schema check. Left
entirely on `StudioContext`'s existing `setSmsTemplates`/`updateSettings`
path. Same reasoning applies to the rest of Settings not already covered
by an earlier phase (Staff, Branches, Plans' pause-price/vacation-mode
fields) — theme, currency, language, notifications, security, custom
roles, SMS templates all stay on the settings blob.
