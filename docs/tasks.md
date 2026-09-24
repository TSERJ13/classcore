# ClassCore Tasks & Implementation Log

## Dashboard Improvements (`dashboard-improvements` branch)

### Scope
Enhance the main dashboard (`src/app/(dashboard)/dashboard/page.tsx`) with accurate metrics, actionable insights, and clean up dead/fake state fields.

### Status: Completed ✅
- [x] **State Cleanup**: Removed unused/dead fields from `liveStats` (`churnThisMonth`, `inactiveSubs`, `newStudents3m`, `leftStudents3m`, `activeChange`).
- [x] **Real Student Change Badge**:
  - Replaced hardcoded `+0%` badge on the Total Students card with dynamic month-over-month calculation (`newStudentsThisMonth` vs `newStudentsLastMonth`).
  - Completely hides badge when change is `null` or 0, preventing misleading fake badges.
- [x] **Today's Attendance Overview**:
  - Surfaced `todayExpected` in JSX as a prominent banner card.
  - Displays `${attendance} / ${todayExpected} დამსწრე` with turnout percentage and progress bar.
  - Direct navigation link to the Attendance Journal (`/attendance`).
- [x] **Pending Bookings in Needs Attention**:
  - Added detection of upcoming calendar bookings with `booking_status === 'pending'` from `getEvents()`.
  - Added pending booking alert card to "Needs Attention" linking to `/calendar`.
- [x] **Outstanding Debt Calculation**:
  - Computes debt across unpaid/partially paid subscriptions (`subPrice - amount_paid` where `amount_paid < subPrice`) and negative student balances (`student.balance < 0`).
  - Secured with `canViewRevenue` permission guard so only authorized roles (owners, admins, managers, billing managers) see financial debt metrics.
  - Displays in "Needs Attention" with student count and total debt amount in studio currency, linking to `/subscriptions`.
- [x] **Birthdays Today Block**:
  - Automatically identifies students whose `birth_date` matches today's `MM-DD` (matching the algorithm in `sms-service.ts`).
  - Displays festive celebratory banner with student photo/initials, name, phone, and quick link to send congratulatory SMS via `/sms-manager`.
  - Stays hidden when no students celebrate birthdays today.
- [x] **Full Suite of Statistics Donut Charts**:
  - Reusable, responsive, lightweight SVG Donut diagram component (`DonutCard`) based on `<circle>` with `strokeDasharray`/`strokeDashoffset` (zero external chart dependencies, pure Tailwind + React).
  - **Today's Attendance Donut**: Visualizes checked-in students vs remaining expected students with real-time turnout % in center, linking to `/attendance`.
  - **Subscription Statuses Donut**: Visualizes breakdown across active, paused, expired, and cancelled subscriptions via `getEffectiveStatus()`, with active count in center, linking to `/subscriptions`.
  - **Students Breakdown Donut**: Visualizes students with active passes vs students without passes vs newly joined students this month, with total student count in center, linking to `/students`.
  - **Monthly Revenue Sources Donut**: Visualizes monthly earnings split between subscriptions and shop sales, with monthly revenue in center, linking to `/analytics` (secured with `canViewRevenue` guard).
  - Formatted in an elegant 2x2 grid (`grid-cols-1 lg:grid-cols-2 gap-4`) directly underneath top KPI stat cards.
- [x] **Type Safety**:
  - Added `booking_status?: 'pending' | 'confirmed' | 'cancelled'` to `CalendarEvent` in `src/types/index.ts`.
  - Exported `getEffectiveStatus` and `SubscriptionEffectiveStatus` in `src/lib/subscription-store.ts`.
  - Verified `npx tsc --noEmit` exits with code 0 (zero errors).

---

## Tariffs & Subscriptions + Registration Flow PRDs (`claude/youthful-sagan-efyg4i` branch)

Source: `Subscriptions Module PRD` (v1.2) and `Tariffs Module PRD` (v1.0), compared against the
codebase in a gap analysis. Phases are ordered by dependency — do not start a later phase before
its dependencies are `completed`, since it builds on their data model / UI.

Branch: `claude/youthful-sagan-efyg4i` (kept separate from `main` until reviewed).

---

### Phase 1: Extend Plan data model

Status: completed

Added optional fields to `Plan` (`src/lib/plan-store.ts`): `teacher_id` (individual tariffs),
`rental_period` (`'hourly'|'monthly'`), `freeze_options` (`{days,price}[]`, per-tariff pause
pricing), `payment_window` (`{startDay,endDay}`). Additive only, no existing fields changed.

Notes:
- Verified with `tsc --noEmit` (clean) before committing.
- Commit: `feat(tariffs): extend Plan model with teacher, rental period, freeze, and payment window fields`.

---

### Phase 2: Split 'group' tariff type into Monthly + Personal

Status: completed

Added `'personal'` as a distinct `PlanType`, separate from `'group'` (now = Monthly only). Legacy
`'group'` tariffs with `period !== 'monthly'` are reclassified as `'personal'` on read
(`plan-store.ts` `getPlans()` normalization) — non-destructive, no manual migration needed.
Widened `plan_type`/`SubscriptionType` unions across `subscription-store.ts`, `checkin-store.ts`,
`attendance/page.tsx`, `IssueSubscriptionModal.tsx`, `types/index.ts` so the new value type-checks
everywhere. Runtime behavior for `'personal'` subscriptions is unchanged from `'group'` (both still
fall into the "not individual, not rental" bucket used by check-in/attendance logic).

Notes:
- Commit: `feat(tariffs): split Monthly/Personal tariff types, require teacher on Individual, add per-tariff freeze + payment window UI` (combined with Phase 2b below — they touch the same UI).

---

### Phase 2b: Build dedicated Tariffs module UI per-type modals

Status: completed

Rebuilt `src/app/(dashboard)/subscriptions/plans/page.tsx`:
- 4 tabs: Monthly / Personal / Individual / Hall rental.
- Individual tariff now requires a teacher (dropdown from `settings.staff`), enforced before save.
- Hall rental gets an Hourly/Monthly `rental_period` toggle + simplified price-only form.
- Per-tariff freeze/pause pricing editor (add/remove `{days, price}` rows) on every type.
- Payment window (start/end day-of-month) field on Monthly tariffs.
- Card display shows teacher name (individual), rental period (rental), and freeze-option count.

Deliberately NOT done in this phase (left as-is to keep the diff safe/reviewable):
- The old studio-wide `settings.pausePrices` panel at the bottom of the page is still there as a
  fallback default — it is not yet wired to actually defer to per-tariff `freeze_options` in the
  subscription pause flow. That cutover is Phase 4.
- `validity_days`/session fields on the Individual tariff form weren't restructured (PRD suggests
  the tariff-level "session" field should be a disabled unit-indicator, not editable) — low risk to
  leave as-is for now; revisit if it causes confusion in practice.

Notes:
- `tsc --noEmit`: clean. Targeted lint on touched files: no new issues (pre-existing unused-import/`any`
  warnings elsewhere in the codebase are untouched, and `next.config.mjs` already documents
  `eslint.ignoreDuringBuilds: true` for that backlog).
- Could not visually verify in a browser end-to-end: the app's root layout blocks on Supabase
  auth/session and there are no real credentials in this environment (a placeholder `.env.local` gets
  the dev server compiling and serving 200s with zero console/page errors, but the app stalls on its
  loading screen without a real backend). Whoever picks up later phases should sanity-check in a
  browser with real credentials before merging to `main`.
- Commit: `feat(tariffs): split Monthly/Personal tariff types, require teacher on Individual, add per-tariff freeze + payment window UI`.

---

### Phase 3: Real subscription status model

Status: completed

Added `'cancelled'` to `SubscriptionInfo.status`. Added a new exported pure helper
`getEffectiveStatus(sub)` in `subscription-store.ts` that derives the PRD's 3-status model
(active/suspended/cancelled) from the stored subscription — suspended covers both self-pause and
2-29 days overdue; cancelled covers 30+ days overdue or an explicit manual cancel. Since this app has
no server-side cron (everything is client-computed from localStorage on load), "automatic transition"
is implemented as a derived/computed status rather than a background job that mutates storage — the
correct status is always shown wherever `getEffectiveStatus` is called, with no explicit write needed.

Wired into:
- `SubscriptionModal.tsx`: status dropdown now offers active/paused/cancelled (dropped the manually-
  selectable 'expired' option — it stays as a legitimate *stored* value written elsewhere by
  `incrementSessionsUsed()`'s auto-renewal/rollover, and `getEffectiveStatus` treats it the same as
  'active' by falling through to the expires_at check). Added the informational note ("Suspended —
  N days left" / "Overdue (N days)") next to the status field.
- `subscriptions/page.tsx`: tab-bucketing now uses `getEffectiveStatus` (kept the sessions-exhausted
  check as a separate, additional signal — the PRD treats that as card info, not part of the status
  model). Renamed the third tab's label from "Expired" to "Cancelled" (kept its internal id `'expired'`
  to avoid touching every reference to that tab state — technical debt, not worth the blast radius
  here). Added the same informational note badge to each subscription card.
- Also fixed a real bug found while touching the pause flow: `SubscriptionModal.tsx`'s pause buttons
  showed the studio a deduction amount in the confirm dialog but never actually passed it to
  `pauseActiveSubscription()`, so the balance was never charged. Now passes `cost` through.
- `pauseActiveSubscription()` now also stores `paused_at`/`pause_days` so the "days left" note is
  computable — previously a pause only extended `expires_at` with no record of the pause's own start/
  length.

Notes:
- `tsc --noEmit`: clean. Lint on touched files: no new issues (all remaining warnings predate this
  change — verified none reference the new identifiers).
- Known limitation carried forward, not fixed here: a self-pause never auto-resumes to 'active' when
  its `pause_days` elapses (nothing currently writes that flip) — `getEffectiveStatus` will keep
  reporting 'suspended' with no `days` left rather than reverting to 'active'. Worth a small follow-up
  when Phase 4 touches this same pause flow.

---

### Phase 4: Wire per-tariff freeze pricing into the pause flow

Status: completed

Depends on: Phase 1, Phase 2b. (both already completed)

Added `SubscriptionInfo.plan_id` (stable reference to the originating `Plan.id`) and
`findTariffForSubscription(sub)` in `subscription-store.ts` — tries `plan_id` first, falls back to
matching by `name+type` for subscriptions issued before this field existed. `IssueSubscriptionModal.tsx`
now stamps `plan_id` on every newly-issued subscription.

`SubscriptionModal.tsx`'s pause section now looks up the subscription's tariff and uses its
`freeze_options` (days+price pairs) when it has any set; falls back to the old studio-wide
`settings.pausePrices` 7/14/30/60 table only when the tariff has none — matching the "enable toggle
against the tariff's own periods" intent from PRD Subscriptions §12 / Tariffs §9, implemented as a
lookup-with-fallback rather than a literal UI toggle (there's nothing to toggle *to* when the tariff
has no freeze_options of its own).

Also, since `getEffectiveStatus()` was already being extended here: fixed the "known limitation" flagged
in Phase 3 — a self-pause whose `pause_days` has fully elapsed no longer reports "suspended" forever;
it now falls through to the normal expiry/overdue check (harmless, since `pauseActiveSubscription()`
already pushes `expires_at` forward by the pause length at pause time).

Notes:
- `tsc --noEmit`: clean. Lint on touched files: no new issues.
- Not done here (still open): an actual UI toggle in the *edit* modal letting an admin pick "use the
  tariff's periods" vs override — right now it's an automatic fallback, not a user-facing choice. The
  PRD's wording ("ერთ ჩართვის toggle-ს") suggests a literal toggle might be expected; revisit if a
  studio actually needs to override a tariff that already has its own `freeze_options` set.

---

### Phase 5: Payment window mechanism

Status: completed (overdue-calc integration only — see below for what's still open)

Depends on: Phase 1, Phase 4.

Scoped down from the original description after checking what's actually wireable in this codebase:

- **Not touched**: how `expires_at` gets set at subscription creation. `IssueSubscriptionModal.tsx`
  already has the admin/self-serve pick start/end dates directly (PRD Subscriptions §5.11 — editable
  dates), there's no "N months from purchase" auto-math to replace there.
- **Not built**: automatic SMS reminder scheduling keyed to the window. There is no server-side cron
  or scheduler anywhere in this app (confirmed while working Phase 3) — the "payment reminder" SMS
  template in `sms-service.ts` is staff-triggered, not automatic, so there was nothing to wire a
  window into. Automating that would need a scheduler to exist first, which is bigger than this ticket.
- **Built**: the one piece that's genuinely about *counting* overdue-ness, per PRD Tariffs §11
  ("'ვადაგადაცილებული' სტატუსი ... აითვლება ამ ფანჯარის დასრულებიდან" — overdue counts from the
  window's end, not the raw date). Added a private `getEffectiveDueDate(sub)` helper in
  `subscription-store.ts`: for a Monthly-type subscription (`plan_type === 'group'`) whose tariff has
  a `payment_window`, the overdue/cancelled day-count in `getEffectiveStatus()` now measures from that
  window's end-day in the month of `expires_at`, instead of from `expires_at` itself. Subscriptions
  without a payment_window tariff are unaffected (falls straight through to `sub.expires_at`, same as
  before).

Notes:
- `tsc --noEmit`: clean. Lint: no new issues.
- If a real SMS scheduler gets built later (own ticket), it should reuse the same window-boundary
  logic — worth extracting `getEffectiveDueDate`'s window math into a shared exported helper at that
  point rather than duplicating it.

---

### Phase 6: Individual lesson 7A/7B rebuild

Status: partially completed — the structurally important pieces are done; two UI surfaces are
explicitly deferred (see "Not done" below). Recommend a follow-up ticket for those, possibly to
Antigravity, rather than treating this phase as fully closed.

**Decision made while implementing**: the existing purchase flow (`IssueSubscriptionModal.tsx`,
individual type) doesn't just sell a credit — it also lets the studio set a *recurring weekly*
schedule at purchase time, generating real calendar events immediately. That's a live, working
feature real studios depend on today. The PRD's "these two are separate and NEVER merge into one
form" is correct for the *target* design, but ripping the scheduler out of purchase in this pass
would have been a breaking UX change with no equivalent replacement ready yet (no open-slot browsing
UI exists). So: the recurring-purchase flow was **left in place, unchanged**, and the new 7A/7B
primitives were added *alongside* it, additively — see below.

**Built**:
- `CalendarEvent` (`types/index.ts`): added `sub_id` (which purchased credit a lesson spends) and
  `booking_status: 'confirmed' | 'pending'`.
- `HallData` (`hall-store.ts`): added `max_parallel_individual` (defaults to 1 when unset).
- `hasIndividualSlotConflict()` (`event-store.ts`) — the real conflict engine: an individual slot can
  never overlap a `group_class` event in the same hall (no override, ever), and can only overlap OTHER
  individual sessions up to the hall's `max_parallel_individual`. Wired into the *existing*
  `generateScheduledIndividualEvents()` — it now skips (rather than blindly double-books) any
  conflicting occurrence and returns `{ events, skippedDates }` instead of a bare array, so a caller
  can eventually surface "N sessions couldn't be auto-scheduled" (the current call site doesn't use
  the return value yet, so nothing regressed — this is a pure safety improvement to a flow that
  previously had zero conflict checking).
- `createIndividualBooking()` (`event-store.ts`) — 7B, direct-assignment path only (see "Not done"):
  books one lesson time against an already-purchased credit (`plan_type === 'individual'` subscription
  ID), rejects with `SLOT_CONFLICT` if it collides, auto-confirms when the creator is a teacher
  (`profile.role === 'teacher'`) and otherwise leaves it `pending`.
- `confirmIndividualBooking()` (`event-store.ts`) — flips a pending booking to confirmed. Both this and
  the auto-confirm path in `createIndividualBooking()` deduct 1 unit from the linked subscription via
  the *existing* `incrementSessionsUsed(studentId, subId)` — deduction happens on booking/confirmation,
  not on check-in, for lessons booked this way (the old recurring-schedule flow still deducts via
  check-in as before, unchanged).
- `BookIndividualLessonModal.tsx` (new component) + a "Book a lesson" button on the subscriptions
  page's individual-credit cards (shown whenever `sessions_used < sessions_total`): hall, date,
  start/end time, calls `createIndividualBooking()`, shows the conflict error inline, and reports
  back whether the booking landed confirmed or pending.

**Not done (flagged as follow-ups, not silently skipped)**:
- **7B, open-slot path**: a teacher pre-publishing available times for students/admins to browse and
  pick from (PRD's other 7B sub-path). What's built only covers "direct assignment" — someone
  picking an arbitrary free time. Needs its own UI surface (teacher-side slot publishing + a
  browsing view) — a good candidate for its own ticket.
- **Teacher-first purchase (7A)**: the purchase modal still asks for tariff before/alongside teacher in
  the existing combined form, rather than the PRD's "teacher cards first, tariff auto-filtered after."
  Not changed, for the same reason the recurring scheduler wasn't removed — reworking the purchase
  step order is entangled with the existing form's layout and validation, and didn't fit safely in
  this pass.
- **SMS confirmation link** for a pending booking: `createIndividualBooking()` correctly sets
  `booking_status: 'pending'`, but nothing sends the teacher an SMS/notification with a confirm link
  yet, and there's no confirmation inbox UI. A teacher can currently only be told about a pending
  booking by looking at the calendar. Needs the SMS template + a confirm action somewhere a teacher
  will actually see it (the calendar's event modal would be the natural place — not touched here,
  that file is 3000+ lines and a change there deserved its own focused pass).

Notes:
- `tsc --noEmit`: clean. Lint: one new issue caught and fixed (an `any` catch clause in the new
  modal); everything else pre-existing.
- Could not browser-test end-to-end (same Supabase-credential limitation as Phase 2b).

---

### Phase 7: Real Hall Rental module

Status: partially completed — made it real (persisted, real halls); the PRD's pending+SMS
confirmation flow is deliberately not built (see below).

**Decision made while implementing**: `HallRental` (`types/index.ts`) already has a richer, more
purpose-built shape than `SubscriptionInfo`'s minimal `'rental'` plan_type stub (deposit, contract
upload, renter contact info for people who aren't students) — the gap analysis read the two as
competing/disconnected implementations of the same PRD feature, but on inspection `HallRental` is
clearly the better home for it. Left `SubscriptionInfo.plan_type === 'rental'` untouched rather than
trying to unify the two data models — that would be a bigger, more speculative change for
questionable benefit versus just making the already-better-designed page real.

**Built**:
- `hall-rental-store.ts` (new): real persistence for `HallRental` records, mirroring `plan-store.ts`'s
  pattern (localStorage + best-effort individual-record cloud sync + schema-less settings-blob
  fallback). Previously `hall-rental/page.tsx` held everything in a bare `useState(MOCK_RENTALS)` —
  nothing survived a page refresh, ever.
- `HallRental` gained `hall_id` (stable reference to `HallData.id`) alongside the existing `hall_name`
  (kept as a denormalized display copy) — same `id`+`name` pattern as `plan_id`+`plan` from Phase 4,
  fixing the "hardcoded `HALLS = ['დარბაზი #1', ...]` string array, no relation to real halls" gap.
- Page now loads/saves through the store and pulls real halls via `getHalls()` instead of the
  hardcoded list, everywhere a hall is picked or filtered.

**Not done (flagged, not silently skipped)**:
- Pending status + SMS-confirmation-to-teacher flow (PRD §8: "ჯავშანი იქმნება 'მოლოდინში' სტატუსით
  ... მასწავლებელს მიდის SMS"). Skipped because this page has no student/self-serve creation path at
  all — it's purely an admin-facing booking form, so there's no caller that would ever produce a
  'pending' booking to confirm. Adding the field without a way to set it to anything but one value
  would be dead code. This gap is really about a missing *student-portal* entry point for hall rental
  requests, which is its own, bigger piece of work (student profile module territory).
- Hall-conflict checking (can't double-book a hall against an existing group/individual/other rental)
  — `hasIndividualSlotConflict()` from Phase 6 is individual-lesson-specific and this page's
  `multiday`/`monthly` rental types don't even have start/end *times*, only dates, so generalizing the
  conflict engine to cover hall rentals needs its own design pass, not a quick reuse.
- Checkout/invoice generation — explicitly out of scope per the Subscriptions PRD itself (§15: invoice
  generation lives in the separate Finance module, not described in that document either).

Notes:
- `tsc --noEmit`: clean. Lint: one new issue caught and fixed (an `any` assignment in the new store,
  same pattern flagged elsewhere in this codebase — used a typed spread instead).
- Playwright smoke-check: page compiles and serves with zero console/page errors (same
  Supabase-credential limitation as previous phases prevents full end-to-end browser verification).

---

### Phase 8: Studio vacation / kill-switch mode

Status: completed

Independent of `src/components/KillSwitchGate.tsx` (ClassCore's own SaaS billing enforcement against
the studio owner — confirmed untouched, a completely different thing).

**Decision made while implementing**: rather than a batch job that walks every subscription and
mutates `expires_at` when a vacation is configured (risky at scale, and this app has no cron to run
it reliably anyway — confirmed back in Phase 3/5), the extension is computed, the same way the
payment-window and pause-remaining-days logic already is. This also quietly satisfies "balance
freeze" for free: session-based subscriptions only ever lose a session on an actual check-in, and a
closed studio has no check-ins happening, so there's nothing separate to freeze once the due-date
extension is in place.

**Built**:
- `StudioSettings.vacationMode?: { active, startDate, endDate }` (`types/index.ts`).
- `isStudioOnVacation(settings, asOfDate?)` and `getVacationExtensionDays(settings)` in
  `settings-store.ts` — pure helpers, the latter returns the configured window's length in days
  (0 if unset/inactive).
- `getEffectiveDueDate()` in `subscription-store.ts` now adds `getVacationExtensionDays()` on top of
  whatever due date it already computed (raw `expires_at`, or the payment-window-adjusted one from
  Phase 5) — flows straight into `getEffectiveStatus()`'s overdue/cancelled check, so a configured
  vacation protects every subscription's status automatically, no per-subscription writes needed.
- `runAutomatedSmsCheck()` in `sms-service.ts`: the subscription-expiring-today SMS loop is now
  skipped while `isStudioOnVacation()` is true. Birthday messages (a separate loop in the same
  function) are unrelated to subscriptions and still send, per the PRD's own scoping ("აბონემენტებთან
  დაკავშირებული SMS" — subscription-*related* SMS specifically).
- Settings UI: a "Studio vacation mode" panel (toggle + start/end date) added to
  `subscriptions/plans/page.tsx`, next to the per-tariff freeze-price panel it's conceptually closest
  to — this repo's ~1700-line general settings page wasn't touched, to avoid navigating unfamiliar
  territory for one small addition.

**Not done**: gating the *other* subscription-related SMS send points (the staff-triggered manual
"payment reminder" template noted in Phase 5, and the not-yet-built individual-booking confirmation
SMS from Phase 6's follow-up) — only the one automatic sweep that actually exists today is gated.
Whoever builds those should add the same `isStudioOnVacation()` check.

Notes:
- `tsc --noEmit`: clean. Lint: no new issues.

---

### Phase 9: Business-type driven feature toggling

Status: completed

**Decision made while implementing**: `types/index.ts` already declares `OrgType =
'dance'|'sports'|'yoga'|'fitness'` and `Organization.org_type`, which looked like the PRD's
"business type chosen at registration" — but grepping the whole `src/app` tree found zero reads or
writes of it anywhere; there is no registration flow that sets it. Building real business-type
gating would mean building that registration step first, which is out of scope for a PRD-alignment
pass. The PRD's own text about Individual lessons specifically says "optional feature, turned on
from settings" — so a plain settings toggle (not tied to a business-type selector that doesn't
exist) is both what's buildable today and what the PRD itself describes for at least that type;
applied the same toggle shape to Hall rental for consistency.

**Built**:
- `StudioSettings.enabledFeatures?: { individualLessons?, hallRental? }` (`types/index.ts`) — missing
  key = enabled, so existing studios see no change.
- `isFeatureEnabled(settings, feature)` in `settings-store.ts`.
- Wired into the two places that decide "which types can be created": `subscriptions/plans/page.tsx`'s
  tariff tabs + its in-modal type-selector grid, and `IssueSubscriptionModal.tsx`'s type-selection
  screen.
- New toggle panel on the tariffs page (instant-apply, matching the existing `toggleActive` pattern
  in that file, rather than the freeze/vacation panels' draft-then-save pattern — there's no
  intermediate state worth drafting for a plain on/off switch).

**Bug found and fixed while touching this screen**: `IssueSubscriptionModal.tsx`'s type-selection step
still only offered 3 tiles (Group/Individual/Rental) — it was never updated when Phase 2 added
`'personal'` as its own tariff type, so a studio could create a Personal *tariff* on the Tariffs page
but could never actually *issue* a Personal subscription from this modal. Added the missing tile, and
also extended the group-binding selector (previously `plan.type === 'group'`-only) to show for
`'personal'` tariffs too, matching the Personal type's "with or without group binding" PRD
description (Subscriptions §3) — the group is optional for Personal either way, only Monthly requires
one.

Notes:
- `tsc --noEmit`: clean. Lint: no new issues.

---

### Post-Phase-9 fix: code review caught a real bug in the Personal group-binding

Status: completed

A `code-review` pass on the full diff (Phase 1 → 9) caught a real correctness bug Phase 9 introduced:
the group-binding selector in `IssueSubscriptionModal.tsx` was extended to show for `'personal'`
plans, but the submit logic that actually *uses* `groupId` (enrollment, `group_id`, `category`,
`selectedGroup`) still gated on `plan.type === 'group'` only — so picking a group for a Personal
subscription was silently dropped, even though the UI implied it saved. Fixed with a separate
`bindsToGroup` flag (group OR personal-with-groupId) for those non-required consumers, keeping the
original group-only flag for the "group plan requires a group" validation (Personal's binding stays
optional). Also fixed a minor layout issue from the same phase: the type-selector grid always jumped
to 4 columns when either optional feature was enabled, leaving an empty cell when only one of
individual/rental was actually on — column count now matches the real tile count.

---

### Follow-up A: 7B open-slot browsing (teacher publishes availability)

Status: completed

The other half of Phase 6's 7B booking system — a teacher pre-publishes free times, and a
student/admin picks from those instead of proposing an arbitrary time (the "direct assignment" path,
already built in Phase 6). Per PRD Subscriptions §7B, confirmation logic is unaffected by which path
was used — it depends only on who does the booking action (teacher = auto-confirmed, else pending) —
so this reuses `createIndividualBooking()`'s existing confirmation logic unchanged.

**Built**:
- `CalendarEvent.is_open_slot?: boolean` (`types/index.ts`) — a published availability window with no
  student/`sub_id` yet.
- `publishOpenSlot()`, `getOpenSlots(teacherId?)`, `deleteOpenSlot()` in `event-store.ts`. Publishing is
  conflict-checked through the same `hasIndividualSlotConflict()` engine from Phase 6 — no point
  opening a slot that already collides with a group lesson.
- New page `src/app/(dashboard)/individual-availability/page.tsx`: a teacher (or an admin picking a
  teacher from `settings.staff`) lists, adds, and deletes their own open slots. Not registered in the
  sidebar/header nav (same as `/hall-rental` already wasn't) — reached via a new small link on the
  subscriptions page header (desktop bar + mobile FAB), shown only when `individualLessons` is enabled.
- `BookIndividualLessonModal.tsx` now fetches `getOpenSlots(subscription.teacher_id)` and shows them as
  quick-pick chips above the manual date/time fields. Picking one pre-fills the form; editing any field
  afterward clears the pick (so a slot only gets consumed if it's actually booked as-published).
  Successful booking deletes the consumed slot via `deleteOpenSlot()`.

Notes:
- `tsc --noEmit`: clean. Lint: no new issues (new files are fully clean).
- Playwright smoke-check on `/individual-availability`: first request threw a transient "Invalid or
  unexpected token" page error — did not reproduce on a second and third run, consistent with a cold
  webpack-compile race in Next dev mode for a brand-new route rather than a real bug (tsc found nothing,
  and the file has no dynamic requires or anything else that would explain a genuine syntax error).
  Worth an extra look in a real browser before relying on this being non-flaky in production.

---

### Follow-up B: SMS confirmation + confirm UI for pending individual bookings

Status: completed

**Built**:
- New SMS template `sms_templates.{ka,ru,en}.individual_booking_pending` (`types/index.ts` +
  defaults in `settings-store.ts`), with `{teacher}`/`{student}`/`{date}`/`{time}`/`{studio}`
  placeholders. Kept separate from the existing `formatSmsTemplate()` helper rather than reusing it —
  that helper's `{name}` resolution is specifically student-vs-parent-by-age logic
  (`resolveSmsRecipientName`), which doesn't fit a teacher-addressed message.
- `sendIndividualBookingConfirmationSms()` in `sms-service.ts` — does its own simple placeholder
  substitution, suppressed during studio vacation mode (`isStudioOnVacation()`, same as the other
  automated subscription SMS from Phase 8).
- `createIndividualBooking()` (`event-store.ts`) now sends this SMS on its `pending` branch (i.e.
  whenever the booking isn't teacher-created), looking the teacher's phone up from
  `settings.staff` since the store itself only carries a bare `teacherId`.
- Confirm UI: found the calendar's actual event-detail component (`EventPopup` in
  `calendar/page.tsx` — the file is 3000+ lines but the relevant component is a self-contained ~500
  lines starting at line 380). Added a `booking_status === 'pending'` note plus a "Confirm booking"
  button in its view-mode render, gated the same way the existing edit/delete buttons already are
  (`canEdit`). Wired a new `onConfirmBooking` prop through to the one call site that renders
  `EventPopup`, calling `confirmIndividualBooking(selectedEv.id)` — which was already fully built in
  Phase 6, just never had a UI trigger. The calendar page already listens for
  `cc_calendar_events_update` (dispatched by `saveEvents()` inside `confirmIndividualBooking()`), so
  its event list refreshes on its own — no extra wiring needed there.

Notes:
- `tsc --noEmit`: clean. Lint: no new categories introduced — the one new line in `calendar/page.tsx`
  (`selectedEv!!.id`) reuses the exact double-non-null-assertion pattern the two adjacent, pre-existing
  lines already use in the same prop list, for local consistency rather than introducing a different
  style.
- This closes out the last item from the original gap analysis and both follow-ups.

---

### Post-Follow-up fix: code review caught 3 more real bugs across A and B

Status: completed

A second `code-review` pass (this time against Follow-up A's base commit, covering both A and B)
caught three more real issues, all fixed:

1. **Booking a picked open slot almost always failed with `SLOT_CONFLICT`.** `createIndividualBooking()`
   ran its conflict check *before* the picked open slot was deleted, so the still-present slot (same
   hall/time, `type: 'individual'`) counted as 1 occupying session against itself — and since
   `max_parallel_individual` defaults to 1, `1 >= 1` was always true. Fixed by adding an optional
   `fromOpenSlotId` param to `createIndividualBooking()`, passed through to
   `hasIndividualSlotConflict()`'s existing (already-built, just never wired) `excludeEventId` param.
   `BookIndividualLessonModal.tsx` now passes `pickedSlotId` through as `fromOpenSlotId`.
2. **A teacher landing directly on `/individual-availability` (e.g. a refresh or deep link) could get
   locked into the wrong `teacherId`.** `useUser()`'s `profile` and `useStudio()`'s `settings.staff`
   both resolve asynchronously; seeding `teacherId` from a one-time `useState` initializer captured
   whatever they were on the very first render (often still empty/null). Replaced with two `useEffect`s
   that sync `teacherId` once each actually resolves, and memoized the `staff` list so the effect's
   dependency array is stable.
3. **Open slots rendered as blank, student-less "individual" chips on the main calendar grid.**
   `calendar/page.tsx`'s central `filtered` memo (the one thing every week/day/month view actually
   renders from) had no `is_open_slot` awareness. Added one line excluding them — they're unclaimed
   availability, not a real booking, and have no title/student to show anyway.

Also deduplicated a small `addOneHour()` helper that had been copy-pasted into both
`BookIndividualLessonModal.tsx` and `individual-availability/page.tsx` — moved into `date-utils.ts`
(both files already imported `generateTimeOptions` from there).

Notes:
- `tsc --noEmit`: clean, no new lint issues (one pre-existing warning in the new page was tightened
  along the way rather than left as `staff.length` in a dependency array).
- Playwright smoke-check across `/individual-availability`, `/subscriptions`, `/calendar`: zero
  console/page errors.
- Deliberately *not* changed: an unbooked open slot still occupies a hall's parallel-individual
  capacity against *other* bookings (e.g. `generateScheduledIndividualEvents()` will skip a
  conflicting date) — treating a published slot as "reserved" the same way a real booking is felt
  like the more defensible interpretation of "this capacity slot is spoken for" than the alternative
  (letting the same hall/time be double-offered to two different students).

---

## Registration Flow PRD (v1.1) alignment

Source: `classcore_registration_flow_prd.pdf` (v1.1, დამტკიცებული). Same branch
(`claude/youthful-sagan-efyg4i`). Rewrites `(auth)/registration/page.tsx` from a single-step form
into the PRD's 5-step wizard, with real inline email+SMS verification (previously: a Supabase
magic-link email, no phone verification at all) and a 14-day Pro trial with an immediate hard lock
at expiry (previously: 30-day trial with a 2-day grace/"overdue" window for everyone).

**Architecture decision (asked the user, since it needed either their Supabase dashboard access or
a build choice I could make alone):** built a fully custom OTP system — a new `registration_otps`
table plus `/api/auth/otp/send` and `/api/auth/otp/verify` — instead of switching Supabase Auth's
own "confirm signup" flow to emit a code. The custom route needs zero Supabase email-template
configuration (which this session can't reach or test — no real Supabase credentials), and reuses
infrastructure already in the repo (`sendEmail`/SMTP from `send-activation-email`, the GOSMS call
from `/api/sms/send`, called directly here since that route requires a logged-in session which
doesn't exist yet mid-registration).

### R1: OTP infrastructure

Status: completed

- `supabase/migrations/20260914_registration_otp.sql` — new `registration_otps` table
  (`session_token, channel, contact, code_hash, code_salt, attempts, verified_at, expires_at`), RLS
  enabled with **no policies** (service-role-only access, matching the existing security-hardening
  migration's posture). **This migration has not been applied to any real database in this
  session** — no Supabase credentials were available to run it; it needs to be run against the
  actual project before this flow works end to end.
- `/api/auth/otp/send`: generates a 6-digit code, hashes it with a random per-row salt (no server
  secret dependency), emails it via the existing SMTP helper or texts it via a direct GOSMS call.
  45s resend cooldown per (session, channel); opportunistic cleanup of rows >24h old on every call
  (no cron exists in this app, so cleanup piggybacks on real traffic instead).
- `/api/auth/otp/verify`: checks the latest row for (session, channel), 10-minute expiry, 5-attempt
  cap, marks `verified_at` on match.

### R2: 5-step registration wizard UI

Status: completed

Rewrote `src/app/(auth)/registration/page.tsx` as the PRD's 5 steps (no progress persisted between
them — an abandoned form restarts from step 1 on return, per PRD §2): business category (4 tiles,
context-only) → free-text specific type → studio name + 5 numeric estimates (students/groups/
teachers/halls/branches, +/- steppers) → service config (lesson type + payment style, button
groups) → account creation with inline email+SMS verification, password, and a Terms/Privacy
checkbox now linking to the real `/terms` and `/privacy` pages (previously plain text).

Account creation flow changed: the client no longer calls `supabase.auth.signUp()` directly.
`register-studio/route.ts` was rewritten to (1) re-verify both OTP rows server-side match the
submitted email/phone exactly — so a client can't skip verification or swap in an unverified contact
at the last second — then (2) create the Supabase user via `admin.createUser({ email_confirm: true,
... })` (pre-confirmed, since we already verified both channels ourselves), then (3) upsert the
`studios`/`profiles` rows as before. The client then calls `signInWithPassword()` itself to get a
real session, and seeds the localStorage settings blob (same "scorched earth" + `initialSettings`
pattern the old flow used) with the new fields from steps 1-4.

### R3: Step-4 answers → enabledFeatures + studio metrics

Status: completed

- Studio metrics (students/groups/teachers/halls/branches) are stored as
  `StudioSettings.onboardingMetrics` — informational only, exactly per PRD §5: does **not**
  auto-create real groups/halls/branches anywhere.
- Lesson type "Individual"/"Both" → `enabledFeatures.individualLessons = true`, same toggle Phase 9
  already built for the Tariffs/Subscriptions PRDs.
- **New toggle added**: `enabledFeatures.personalPlans`. The PRD explicitly says payment style
  "Personal"/"Both" should have "the same [critical system] effect" as the lesson-type answer — but
  no such toggle existed, because Phase 2 built Personal tariffs as an always-on core split (not an
  optional feature like Individual/Rental). Added `personalPlans` mirroring the existing
  `individualLessons`/`hallRental` shape (undefined = enabled, so existing studios see no change),
  and wired it into the same 4 spots those two already gate: the Tariffs page's tab row + in-modal
  type grid, and `IssueSubscriptionModal.tsx`'s type-selection tiles + column-count calculation.
  New studios get explicit `true`/`false` for both toggles based on their actual step-4 answers
  (not left `undefined`) — the PRD's whole point is that the registration answer *is* the initial
  configuration.

### R4: 14-day Pro trial for new studios

Status: completed

**Scope decision (asked the user):** only studios registered through this new wizard get the 14-day
trial with an immediate hard lock; every studio that already exists keeps the current 30-day trial
with its existing 2-day grace window, unchanged.

- `StudioSettings.trialDays?: number` — set to `14` only by the new registration flow;
  undefined for every existing studio.
- `saas-billing.ts`'s `getBillingState()`: reads `settings.trialDays` (falls back to the existing
  `TRIAL_DAYS=30` constant when unset) as `effectiveTrialDays`. When `trialDays` **is** explicitly
  set (a "precision trial"), the trial-expiry branch skips the `overdue`/`GRACE_DAYS` step entirely
  and goes straight to `suspended` — per PRD §8's "access is restricted immediately... does not fall
  back to any limited free tier." The renewal-payment `overdue` grace period (a different scenario —
  someone who already paid once and missed a renewal) is untouched for everyone.
- `KillSwitchGate.tsx` already gates on `billing.status`, so this reaches real access-blocking
  without any changes there.
- "Full Pro access during trial": checked every `plan === 'pro'` gate in the app (only 2 exist,
  both cosmetic billing-banner conditions, not feature gates) — nothing actually restricts trial
  studios today, so no code change was needed for this part; it's already true.

### R5: "Complete your profile" pop-up mechanism

Status: completed

Built only the mechanism, per PRD §9/§10's own note that the exact fields are still TBD:
- `StudioSettings.firstLoginAt` — stamped at the moment the new registration flow's own
  `signInWithPassword()` succeeds (that *is* the first successful login for a wizard signup).
  Existing studios never get this field, so the popup mechanism is inert for them.
- `src/components/ProfileCompletionPopup.tsx` — polls every 5 minutes while mounted; shows once
  `Date.now() - firstLoginAt >= 2.5h` (PRD says "2-3 hours") and `profileCompletedAt` is still unset,
  owner role only. Placeholder fields (IE status toggle, tax ID, legal address) go into
  `StudioSettings.businessProfile` — explicitly a placeholder shape, since PRD §10 defers the real
  field list. "Later" snoozes for the current session only (component-local state); "Save" sets
  `profileCompletedAt` and the popup never shows again.
- Mounted in `(dashboard)/layout.tsx` next to `GlobalRFIDScanner`, inside `MobileMenuProvider`, so it
  applies across every dashboard page rather than just `/dashboard`.

### Not done / explicitly out of scope (per the PRD's own §10 table)

- Exact fields for the "Complete your profile" pop-up — PRD defers this.
- Hall rental inside the registration flow — PRD explicitly excludes it from this version.
- A "space owner" independent account type — PRD marks this as a future update.
- Terms/Privacy page's *menu* placement — the pages (`/terms`, `/privacy`) and the mandatory
  checkbox both already exist; only where they're linked from the app's menu is still open, per PRD.

### Deployment note

**The `registration_otps` migration has not been run against any real database from this session**
— there were no Supabase credentials available to apply it or to smoke-test the OTP send/verify
round-trip end to end. Before this flow can work in a real environment: (1) run
`supabase/migrations/20260914_registration_otp.sql` against the project, (2) confirm `SMTP_HOST` /
`SMTP_USER` / `SMTP_PASS` and `GOSMS_API_KEY` / `NEXT_PUBLIC_GOSMS_SENDER_ID` are set (both are
pre-existing env vars this flow reuses, not new ones), (3) manually walk through the wizard once in
a real environment to confirm the email/SMS codes actually arrive.

Verified in this session: `tsc --noEmit` clean and `next lint` clean on every new/changed file
across R1-R5.

---

## Architecture migration — localStorage/service-role → Server Actions + RLS

Source: no single PRD — an ongoing migration off the old pattern (client writes straight to
localStorage, syncs to Supabase via a service-role API route with no real permission check) onto
real Postgres tables with RLS and Zod-validated Server Actions. Full rationale, phase-by-phase
detail, and the dual-auth pattern (`src/lib/server-actions-auth.ts`) for staff-token sessions are in
`docs/architecture-migration.md` — this tracker only records status, not the detail already there.

### Arch Phase 0: RLS gap-fill migration for remaining tables

Status: completed — see `docs/architecture-migration.md` §0.

### Arch Phase 1: Attendance server-driven pilot

Status: completed — Server Actions + atomic check-in RPC + UI cutover. §1.

### Arch Phase 2: Students full CRUD

Status: completed — edit/delete/groups, then cut `/students` over live (old `-v2` pilot pages
deleted). §2.

### Arch Phase 3: Atomic attendance-marking + session deduction

Status: completed — `SECURITY DEFINER` + `FOR UPDATE` RPC, re-resolves `caller_org_id` from
`auth.uid()` internally rather than trusting RLS alone. §3.

### Arch: Subscriptions, Plans, Dashboard stats, Groups, Staff writes, Calendar (deferred),
### Branches/Halls, Shop (Sales+Products), Expenses

Status: completed (Calendar/Events deliberately NOT migrated — documented risk: no real
per-occurrence identity for recurring events, pervasive teacher-token write reachability with no
admin-only carve-out; SMS templates/general Settings also deferred, low value / nested-JSONB risk).
Each module's own section in `docs/architecture-migration.md` (§4-§15) has the real detail —
notably §13's `requireOrgIdDualAuth()` helper (`src/lib/server-actions-auth.ts`): tries real
Supabase Auth first, falls back to the `cc_staff_token` cookie with a service-role client manually
scoped to `org_id`, used by every module a teacher/staff-token session needs to write to directly.

---

## Permissions/RBAC module

Source: `Roles & Permissions module PRD` (uploaded PDF, transcribed to
`docs/permissions-module-prd.md`) and its dependency, the `Authorization module PRD` (uploaded
later, transcribed to `docs/authorization-module.md` — which also documents the real role
hierarchy/session mechanics this module hooks into).

### Permissions Phase 1: Engine + Administrator role + Permission Locks

Status: completed — `src/lib/permissions/{role-defaults,resolve,registry}.ts` (Role default →
stored Override → Lock precedence), new `staff.role = 'administrator'` tier (staff-token, not a new
auth mechanism), `permission_locks` table + Server Actions + Settings UI. Full design rationale in
`docs/authorization-module.md` §2, §6.

### Permissions Phase 2: Real server-side enforcement + Administrator reachability

Status: completed — `src/lib/permissions/enforce.ts` (`requireEffectivePermission`/
`requireStudioManager`), wired into Staff/Branches/Halls/Groups/Shop/Expenses writes (previously
only checked org_id match, not the caller's actual permission — a Lock had no server-side teeth).
`PermissionGuard`'s `allowAdministrator` prop opens `/settings` to Administrator without loosening
`/billing`. Fixed a real pre-existing bug this surfaced: Teacher's "Add Group" always failed
server-side despite the button being visible (`groups.ts` required real `auth.uid()`, staff-token
never has one). Detail: `docs/authorization-module.md` §6.

### Bug fix: staff-permission grants silently not persisting / bypassing enforcement

Status: completed. Root cause: every staff edit fired two uncoordinated writes to the same `staff`
row — the new permission-checked `updateStaffAction()` (unawaited, error swallowed) and a legacy,
unguarded `settings-store.ts` → `syncRecordToCloud('staff', ...)` push that ran on *every*
`saveSettings()` call, including from `StudioContext.tsx`'s own `hydrate()` cycle reading stale data
and writing it straight back. Fixed: removed the legacy sync path entirely (Server Actions are now
the only write path to `staff`); `updateStaff`/`addStaff`/`removeStaff` now await their Server
Action and surface failures instead of swallowing them; Settings' staff-edit form no longer resets
mid-edit on an unrelated background hydration.

### Authorization PRD alignment: password policy, session TTL, teacher invite-by-email, ownership transfer

Status: completed. Gaps found comparing the real Authorization module PRD against the running app:
- Password policy (min 8 chars, 1 uppercase, 1 digit, 1 special char) — was unenforced everywhere;
  now checked server-side at every password-setting point (`src/lib/password-policy.ts`).
- Session TTL — staff-token default was 7 days; now the PRD's 12 hours (`staff-token.ts`,
  `staff-login`/`staff-select` cookie `maxAge`).
- Teacher invite-by-email (PRD §8 path "(ა) მოწვევა") — previously only "admin fills the fields
  directly" existed. Added: `staff_invites` table + `src/app/actions/staff-invites.ts` + public
  claim page `src/app/[studio]/staff-invite/[token]/page.tsx` (no session — the token is the
  credential) + admin-side invite/confirm UI in `/teachers`.
- Main Administrator status transfer (PRD §7) — `src/app/actions/ownership-transfer.ts`. Confirmed
  with the user: transferring to an existing Administrator mints them a brand-new Supabase Auth
  account under their own staff email (no way to "promote" a staff-token session in place); the
  outgoing owner keeps their existing login, only `role` metadata downgrades to `'administrator'`.
  This required fixing `useUser.tsx`'s real-Auth branch, which previously assumed every Supabase
  Auth session was owner-tier and always bypassed `PermissionGuard` — it now computes real effective
  permissions for a non-owner-tier real-Auth session the same way a staff-token session already did.

### Unified Auth: real Supabase Auth for new Teacher/Administrator accounts

Status: completed

The PRD's core architectural ask (`docs/authorization-module.md` intro / real PRD §2): one login
mechanism for every user type, not two parallel systems. User confirmed "Option A" (do the real
thing) but scoped to the safe path: NOT a mass-migration of every *existing* staff-token account on
every already-live studio (high-risk — a botched migration breaks real logins) — new
teacher/administrator accounts (manual-fill and invite-by-email) now get created as real Supabase
Auth users going forward, while existing staff-token accounts keep working entirely unchanged.
`/login` needed zero changes — it already tried staff-token then Supabase Auth generically.

Landed: `createStaffAction`/`updateStaffAction`/`deleteStaffAction` (staff.ts) branch on a
`data.authType === 'supabase'` marker to use the Supabase admin API instead of the scrypt-hash path;
`staff-invites.ts`'s claim flow creates the real Auth account at submit time WITHOUT a role (so an
unconfirmed invite can log in but has zero access) and only grants role+permissions at confirm; a
real bug this surfaced in `useUser.tsx` (missing role defaulted to the legacy 'admin' bypass tier,
which would've given an unconfirmed invite full owner access) is fixed. `src/lib/permissions/
enforce.ts` was also fixed here — it bypassed unconditionally for any real-Auth caller, which the
ownership-transfer feature had already made wrong (a downgraded ex-owner keeps a real-Auth session
that is NOT owner-tier); now only `role === 'owner'` bypasses, checked for both connection types.

Not done (deliberately out of scope — a separate, later decision if ever needed): migrating
*existing* staff-token accounts to Supabase Auth.

### Student portal: real login + module

Status: completed

Per user: login identity = the parent's email on file (`students.email`, already a real top-level
column); a separate password is set for the student directly by an admin (no self-service invite
step, unlike Teacher). No PRD exists for exact portal *content* — turned out not to matter, because
a full-featured portal page already existed at `src/app/[studio]/[studentId]/page.tsx`
("StudentPortalPage" — subscription, QR check-in code, schedule, attendance/payment history, shop)
with a sub-route at `.../history`. What was actually missing was real access control: the page was
reachable by anyone who had the URL, gated only by a cosmetic phone-suffix prompt that was never
checked server-side and whose "authenticated" flag was never even read back on the next render.

Landed:
- `src/app/actions/student-login.ts` — `createStudentLoginAction`/`revokeStudentLoginAction`, same
  Unified Auth mechanism as Teacher/Administrator (real Supabase Auth account,
  `user_metadata.role: 'student'` + `student_id`). Deliberately does NOT repoint `students.id` at
  the new Auth account id — unlike a brand-new teacher, a student typically already has years of
  subscription/attendance/sales history keyed by their existing id, and that repoint is exactly the
  high-risk mass-migration this whole approach avoids. The link lives in `students.data.authUserId`
  instead; authorization is checked via `user_metadata.student_id` matching the URL, not id equality.
- `src/components/students/StudentModal.tsx` — new "Portal Access" section (password field + Grant
  button), owner/admin/administrator only.
- `src/middleware.ts` — `/[slug]/[studentId]` (and its `/history` sub-route) removed from the
  no-auth bypass list entirely; now requires a real session (staff-token OR Supabase Auth — a
  student's new account satisfies the latter) the same as every dashboard page.
- `src/app/[studio]/[studentId]/page.tsx` + `.../history/page.tsx` — replaced the old cosmetic gate
  with a real one: any staff session in the org may view any student's page (matches the existing
  copy-link/QR-code flow in StudentModal, which assumes staff can open what they share); a student
  session may only view their own (`profile.student_id === studentId`).
- `src/app/(auth)/login/page.tsx` — a signed-in Student is redirected to their own portal URL
  instead of the staff `/dashboard` (which would show them nothing — no `canView*` permissions
  resolve for a `'student'` role, by design, since it isn't a tier the Permissions engine knows).

Not done (deliberately out of scope, no PRD basis to build against): self-service invite-by-email
for students (mirroring Teacher's flow), multi-role linking (a person who is both Teacher and
Student), role-switching UI.

### API contract convention: `{data, error}` shape for a future mobile API

Status: completed

Triggered by a review of an "API response format" standard doc (`{data, error}` envelope,
`/api/{entity}` REST routes, pagination, camelCase-in-JSON/snake_case-in-DB) against this codebase.
Finding: the doc assumes a REST layer that doesn't exist here — every entity (students, groups,
staff, branches, subscriptions, ...) already went through the Arch migration onto Server Actions
(direct function calls, no HTTP boundary), so adopting the doc literally would mean tearing that
migration back out. User confirmed a mobile app *is* planned (manager + staff + client), but only
after the web app is done — so no reason to build `/api/v1/{entity}` routes yet, but good reason to
start shaping Server Actions so that layer is a thin addition later instead of a rewrite.

Landed:
- `src/lib/action-result.ts` — `ActionResult<T>` (`{data,error}` union), `ok`/`fail`/`okList`
  helpers, `clampPagination`.
- `docs/agents/api-contract.md` — the convention: new/touched Server Actions return
  `ActionResult<T>`; list actions return `{items, page, pageSize, totalCount}`; logic worth sharing
  moves to a plain `src/lib/logic/<entity>.ts` function the Server Action wraps, so a future mobile
  API route can call the same function instead of a second implementation. Referenced from
  `AGENTS.md`.

Not done (deliberately deferred until mobile work is actually scoped): any `/api/v1/{entity}` HTTP
route; mobile auth design (bearer token vs. cookie — existing staff-token accounts have no
bearer-token equivalent yet); bulk conversion of the ~15 existing Server Action files in
`src/app/actions/` to the new shape (they keep their current `void`/throw pattern until touched for
another reason).

---

## SMS Module PRD (v1.3) alignment

Source: `classcore_sms_module_prd.pdf` (v1.3, დამტკიცებული). Same branch. Gap analysis found this
module is NOT close to the PRD, unlike Subscriptions/Tariffs — the current `sms-manager/page.tsx` +
`settings-store.ts`'s `sms_templates` is a fixed 7-key hardcoded blob (payment/expiration/birthday/4
holidays), not the PRD's user-created category→template architecture. This is a rebuild, not a
patch, so it's being done in phases like the Subscriptions PRD was, starting with the data model
before touching the UI.

### Phase 1: Category/template data model + Server Actions

Status: completed

**Built**:
- `supabase/migrations/20260919_sms_categories_templates.sql` — new `sms_categories` (id, org_id,
  name, color, icon, module_key, enabled) and `sms_templates` (id, org_id, category_id, name,
  text_ka/ru/en, trigger_type, event_key, recipient_scope, recipient_target_id, status,
  frequency_limit_count/days, is_auto_generated) tables, RLS matching this migration series' dual-auth
  pattern. Also a new `sms_audit_log` table (PRD §9's audit journal). Also backfills `sms_logs` as a
  tracked migration (`CREATE TABLE IF NOT EXISTS`) — that table exists in production from a
  manually-run SQL snippet during an earlier security fix (commit `623d88a`'s era) that was never
  committed as a migration file here; this migration is safe either way and adds the new columns
  (`template_id`, `recipient_student_id`, `delivery_status`, `provider_message_id`) Phase 1 needs for
  per-template log grouping later.
- `src/app/actions/sms-templates.ts` — full CRUD for categories (`listSmsCategoriesAction`,
  `createSmsCategoryAction`, `toggleSmsCategoryAction`, `deleteSmsCategoryAction`) and templates
  (`listSmsTemplatesAction`, `createSmsTemplateAction`, `updateSmsTemplateAction`,
  `deleteSmsTemplateAction`, `duplicateSmsTemplateAction`), gated by the existing `canViewSMS`
  permission (no separate manage permission exists yet — matches how the current page is gated).
  Every mutation writes an `sms_audit_log` row (best-effort — never fails the mutation over a logging
  write). This is the first module written against `docs/agents/api-contract.md`'s `ActionResult<T>`
  convention from the start, not retrofitted.
- Lazy seed: `listSmsCategoriesAction()` seeds one "ზოგადი" category with 3 starter templates
  (payment reminder, subscription expiring, birthday) the first time an org has zero categories —
  mirrors the Tariffs module's "reclassify on read" lazy-migration pattern (Phase 2 of the
  Subscriptions PRD work) rather than a batch data migration.

**Known limitation, not fixed here (flagged, not silently skipped)**: the seed's starter template
text matches `DEFAULT_SETTINGS.sms_templates` (settings-store.ts) — it does NOT read/carry over a
studio's own customized text if they already edited their templates in the old settings-based UI.
Server Actions run server-side and have no access to the client-localStorage-backed settings blob
that holds those per-org edits, and this pass didn't chase down that blob's actual cloud-sync table to
read it safely. Before the old `sms-manager` UI is ever removed, a follow-up should locate that table
and migrate real per-org text into `sms_templates`, not just seed defaults.

**Not done (next phases)**: recipient targeting is stored (`recipient_scope`/`recipient_target_id`)
but nothing enforces it yet at send time; frequency limits and quiet-hours config are stored/planned
but not wired into any send path; AI auto-translation; Master Kill-Switch; SMS balance/billing UI;
per-template log drill-down + retry button; the `sms-manager` page itself still reads the old
hardcoded blob — none of this phase's new tables are wired into the UI yet.

### Phase 2: Categories/templates UI (replaces the fixed "Manage Texts" tab)

Status: completed

**Built**:
- `src/components/sms/CategoryTemplatesTab.tsx` — the new content of the sms-manager page's first tab
  ("text"). Lists categories (expand/collapse, enable/disable toggle, delete with confirm, module-key
  badge for module-linked ones), each showing its templates (status/scope badges, text preview,
  edit/duplicate/delete). "+ ახალი კატეგორია" inline add row; "+ შაბლონი" per category opens
  `TemplateModal`.
- `src/components/sms/TemplateModal.tsx` — create/edit form: name, 3-language text tabs (no AI
  translation yet — admin still writes each language by hand, unchanged from before), recipient
  scope (all/group/branch/person) with a `SearchSelect` picker sourced from `getGroupsAction()`
  (groups), `settings.branches` (branches, passed down from the page), and the page's existing
  `students` list (person) — frequency limit (count + period days, optional). An event-triggered
  template (payment_due/subscription_expiring/birthday) shows its signal as a read-only badge; a new
  template is always `trigger_type: 'manual'` (no UI yet to attach a brand-new template to a system
  event — see Phase 1's notes on why).
- `sms-manager/page.tsx`: wired the new tab in; removed the now-dead fixed-template state/handlers
  (`langTab`, `isSaving`, `handleSave`, `handleTemplateChange`, the `TemplateField` helper, the unused
  `setSmsTemplates`/`Save` import) that only existed to drive the old 7-field editor. Personal/
  Holiday/Stats tabs are untouched — they still read `settings.sms_templates` (the old blob) and still
  work exactly as before.

Notes:
- `tsc --noEmit`: clean. Lint on touched files: clean (verified against a pre-change baseline —
  every remaining warning/`any` in this file predates this change).
- Playwright/dev-server smoke check: `/sms-manager` compiles and returns 200 with no console/build
  errors (same Supabase-credential limitation as every other phase prevents full end-to-end
  browser-testing the actual category/template CRUD in this environment).

**Not done (still open, unchanged from Phase 1)**: nothing sends anything through the new model yet —
recipient targeting, frequency limits, and quiet hours are stored but not enforced by any send path;
AI translation; Master Kill-Switch; balance/billing UI; per-template log drill-down + retry; the old
hardcoded blob still powers Personal/Holiday tabs and all automated sends in `sms-service.ts`.

### Phase 3: Wire the 3 automated signals to the new template model

Status: completed

The first real *send* path through Phase 1/2's model — `runAutomatedSmsCheck()`'s two existing
automated loops (subscription-expiring, birthday) now check `sms_templates` first, enforcing
recipient targeting and the per-template frequency limit, falling back to the old hardcoded/
settings-blob text only when an org has zero matching active templates (so nothing regresses for an
org that never opened `/sms-manager`, i.e. never got Phase 1's lazy seed).

**Built**:
- `src/app/actions/sms-templates.ts`: `getEventTemplatesAction(eventKey)` — active templates whose
  category is enabled, for the caller's org; `checkTemplateFrequencyAction({templateId,
  recipientStudentId, limitCount, limitDays})` — counts matching `sms_logs` rows in the trailing
  window, true when under the limit or when no limit is set.
- `src/lib/sms-service.ts`: `templateMatchesStudent()` (PRD §6's recipient-scope filter — all always
  matches; group/branch/person check the student's own `enrolled_group_ids`/`branch_id`/`id` against
  the template's target) and `sendForEvent()` (resolves matching+eligible templates for an event,
  sends each in the student's `preferred_language`, falls back to the old blob text when nothing
  matches). Both automated loops now call it instead of reading `settings.sms_templates` directly.
- `/api/sms/send/route.ts` + `sendSms()`: now accept and persist optional `templateId`/
  `recipientStudentId` on the `sms_logs` row, so a template-driven send groups into its template (PRD
  §9) and the frequency check has something to count.
- **Bug found and fixed while touching this loop**: the student portal's own "SMS reminders" opt-out
  toggle (`students/[studentId]/page.tsx`'s `sms_reminders` field — a student can flip this off for
  themselves) was stored but never once read by `runAutomatedSmsCheck()` — every automated send
  ignored it completely. Now checked in `sendForEvent()` before either path (new-template or
  fallback) sends anything.

Notes:
- `tsc --noEmit`: clean. Lint: verified against a pre-change baseline — same 10 pre-existing `any`
  warnings in `sms-service.ts`, no new ones (a newly-added helper's `student: any` param was typed as
  a proper `SmsEventStudent` instead, to avoid adding to that backlog).
- `payment_due` isn't wired here — there's no existing automated call site for it (Subscriptions PRD
  Phase 5 already found there's no scheduler in this app, so payment reminders stay staff-triggered
  manually); nothing to modify.
- `individual_booking_pending` (`sendIndividualBookingConfirmationSms`) is unchanged — that sends to
  the *teacher*, not a student, so it doesn't fit `sendForEvent()`'s student-recipient shape without
  a separate design pass.

**Not done (still open)**: quiet hours (still the hardcoded 23:00–10:00 window, not the PRD's
configurable global setting); Master Kill-Switch; AI translation; balance/billing UI; per-template
log drill-down + retry button; Personal/Holiday tabs still don't go through the new model at all
(manual sends, not automated signals — a separate follow-up if the studio wants those tracked
per-template too).

### Phase 4: Configurable quiet hours + Master Kill-Switch

Status: completed

**Built**:
- `types/index.ts`: `StudioSettings.smsManager?: { quietHours?: {startHour,endHour}, killSwitchActive?
  }` — distinct from the *other* "kill-switch" this codebase already has (`vacationMode`, the
  Subscriptions PRD's dated studio-closure mode); this one is a manual, unconditional, undated stop
  for every SMS send.
- `settings-store.ts`: `isSmsKillSwitchActive()`, `isWithinSmsQuietHours()` (defaults to the same
  23:00–10:00 window the old hardcoded check used, when unconfigured).
- `sms-service.ts`: the Kill-Switch check moved into `sendSms()` itself — the one function every send
  path already goes through (automated, template-driven Phase 3 sends, and the still-unmigrated
  Personal/Holiday tabs) — so it stops literally everything without needing a check at each call
  site. `runAutomatedSmsCheck()`'s hardcoded quiet-hours check now calls `isWithinSmsQuietHours()`.
- `sms-manager/page.tsx`: new "პარამეტრები" (Settings) tab — quiet hours (start/end hour, draft +
  Save) and the Kill-Switch (instant-apply toggle, red-highlighted when active, matching an emergency
  control rather than a draft setting).

Notes:
- `tsc --noEmit`: clean. Lint: verified against a pre-change baseline on all 4 touched files — no new
  issues (incidentally fixed one pre-existing unused-import warning in `sms-manager/page.tsx` by
  actually using `Shield`).
- Per the PRD's own wording (§10), turning the Kill-Switch off does *not* need to restore anything —
  it never touches individual category/template `enabled` toggles in the first place, it's purely an
  independent gate checked in addition to them; "restores to the prior state" in the PRD is simply
  describing that non-interaction, not a snapshot/restore mechanism, so none was built.

**Not done (still open)**: AI translation; balance/billing UI; per-template log drill-down + retry
button; Personal/Holiday tabs still don't go through the new model.

### Phase 5: Per-template log drill-down + retry, and a real delivery-status webhook

Status: completed

**Built**:
- `src/components/sms/LogsTab.tsx` — replaces the flat "Recent Messages" table. Groups
  `sms_logs` rows by `template_id` (PRD §9's "დაჯგუფება პერ-შაბლონ"), unlinked sends (Personal/
  Holiday tabs, or an automated send that fell back to the old blob) land in an "სხვა" bucket rather
  than being hidden. Each group expands to a drill-down list (recipient, phone, timestamp, error
  text, delivery status badge) with a **Retry** button on failed sends — resends via the same
  `sendSms()` path, carrying the original `templateId`/`recipientStudentId` through.
- **Real delivery-status webhook**: `/api/webhooks/gosms/route.ts` was still writing every payload to
  a repo-root `.sms-logs.json` file — the exact ephemeral-disk/no-scoping pattern already fixed
  elsewhere (see `/api/sms/send`'s own comments) but missed on this route. Rewritten to update the
  matching `sms_logs.delivery_status` by `provider_message_id` instead. `/api/sms/send/route.ts` now
  captures that id (best-effort field detection — GOSMS's exact response schema isn't documented
  anywhere in this repo) at send time so the webhook has something to match against.
- **Found and fixed, not originally in scope**: `.sms-logs.json` — the file that old webhook route
  was writing to — was itself **committed to the repo**, containing real student names and phone
  numbers from production sends. Removed from the tree and added to `.gitignore`. **This does not
  remove it from git history** — it's still present in every commit from `a6cb2ac` onward, reachable
  by anyone with repo access. Purging it for real needs a history rewrite (e.g. `git filter-repo`)
  and a force-push, which is destructive to any other clones/forks — flagged to the user rather than
  done unprompted.

Notes:
- `tsc --noEmit`: clean. Lint: `LogsTab.tsx` and the rewritten webhook route are fully clean; no new
  issues on touched pre-existing files (verified against a pre-change baseline).
- Playwright/dev-server smoke check: `/sms-manager` compiles and returns 200, no console/build
  errors.
- The webhook's field-name matching (message id, delivery status) is explicitly best-effort per its
  own comments — GOSMS's real webhook payload schema should be checked against actual traffic (or
  their docs, if any) once available, rather than trusted as correct from guesswork alone.

**Not done (still open)**: AI translation; balance/billing UI; Personal/Holiday tabs still don't go
through the new template model; the git-history PII exposure above is flagged, not remediated.

### Phase 6: AI auto-translation (PRD §7)

Status: completed

The one remaining PRD item buildable without a payment-provider decision — AI translation only
needs an LLM API. Balance/billing itself is still deliberately deferred — genuinely no default
provider exists anywhere in this codebase, and picking one is a business decision, not a technical
one.

**Built** (originally implemented against `claude-opus-5` via `@anthropic-ai/sdk`; the user then
asked to use their own Gemini key instead — swapped before this phase was ever pushed, so the repo
never carried the Anthropic version):
- `src/app/actions/sms-translate.ts` — `translateSmsTemplateAction({text, sourceLang})`: calls
  Google's Gemini API (`gemini-flash-latest`, plain `fetch` over the REST `generateContent` endpoint —
  no SDK dependency added, the request shape is simple enough not to need one) with a prompt
  instructing it to preserve every `{placeholder}` used across this app's templates untouched, and to
  respond with a single-line JSON object mapping the two other language codes to their translations.
  Gated entirely behind `GEMINI_API_KEY` — with no key set, returns `fail('not_configured', ...)`
  instead of throwing, matching `/api/sms/send/route.ts`'s existing GOSMS_API_KEY-missing pattern. No
  other part of the SMS module depends on this; every earlier phase works identically with or without
  a key set.
- `src/components/sms/TemplateModal.tsx` — a "თარგმნა" (Translate) button next to the language tabs:
  translates the currently-active language's text into the other two, filling their fields (never
  overwriting the source language itself) — fully editable afterward, same as every other field.

**Security note**: the user pasted a real Gemini API key directly into chat. It was never written
into any file in this repo (verified with a literal-string grep before committing) — it must only
ever live as an environment variable (`GEMINI_API_KEY` in Vercel's project settings for production;
`.env.local`, already gitignored, for local dev). Since it was typed into a chat transcript, treat it
as at higher exposure risk than a key that never left a secrets manager — rotating it in the Google
AI Studio / Cloud console is worth doing regardless of whether this specific conversation is shared
anywhere.

Notes:
- `tsc --noEmit`: clean. Lint: fully clean on both new/touched files.
- Not tested against a live Gemini API key in this environment (none configured here) — the "not
  configured" path was verified; the actual translation call itself should be sanity-checked once
  `GEMINI_API_KEY` is set in the deployment environment.

**Not done (still open)**: balance/billing UI (§11 — needs a payment-provider decision); Personal/
Holiday tabs still don't go through the new template model; the git-history PII exposure (flagged
in Phase 5) is not remediated — Claude Code's own Auto Mode safety classifier blocked the
`git filter-repo` history-rewrite command outright ("Git Destructive"), so this needs to be run by
the repo owner directly; the exact commands are in the conversation, not repeated here.

### Phase 7: Generalize the Holiday tab into a real template broadcast

Status: completed

The old Holiday tab hardcoded exactly 4 holidays (`new_year`/`easter`/`march_8`/`sept_1`) as a
literal array in the page component — directly contradicting the PRD's central §3 principle ("no
fixed predefined categories — the studio creates as many as it needs"). Personal tab is untouched —
it's a genuinely different, template-less concept (ad-hoc free text to one person), matching the
PRD §6 example for "person" scope as-is.

**Built**:
- `src/app/actions/sms-templates.ts`'s lazy seed now also creates a "დღესასწაულები" category with
  the same 4 starter templates as before (same text), but as real, editable, deletable
  `sms_templates` rows (`trigger_type: 'manual'`) instead of code — an admin can now edit their text
  (with the Phase 6 Translate button), retarget them to a specific group/branch/person, add a
  frequency limit, or delete the ones they don't want, all from the Categories tab. They can also add
  a wholly new manual template (e.g. a general announcement) and it shows up here too, automatically.
- `src/lib/sms-service.ts`: exported `templateMatchesStudent()` (previously private to Phase 3's
  automated-signal path) for reuse.
- `src/components/sms/BroadcastTab.tsx` (new) — replaces the Holiday tab's content. Lists every
  active, manual-trigger template in an enabled category, with a live recipient count (computed via
  `templateMatchesStudent()` against the already-loaded student list — respects each template's own
  recipient scope, not just "everyone"). "Send" resolves eligible recipients (phone present,
  `sms_reminders` opt-out respected, frequency limit checked per-recipient the same way the automated
  path does), formats each in the recipient's own `preferred_language`, and sends via `sendSms()`
  with `templateId`/`recipientStudentId` so these broadcasts now show up grouped in the Logs tab too
  — previously they landed in the same flat, ungrouped list as everything else.
- `sms-manager/page.tsx`: removed the now-fully-dead `HOLIDAYS` array, `selectedHoliday` state, and
  `handleSendHoliday()`; the `templates`/`setTemplates` state (only the Holiday tab still read it)
  and the settings-sync effect that fed it are gone too. Tab relabeled "მასობრივი გაგზავნა"
  (Broadcast) since it's no longer holiday-specific.

Notes:
- `tsc --noEmit`: clean. Lint: verified against a pre-change baseline — `BroadcastTab.tsx` and
  `sms-templates.ts` are fully clean; `sms-manager/page.tsx`'s remaining warnings are the same
  pre-existing ones as every prior phase (none newly introduced; one dead-state warning removed).
- Playwright/dev-server smoke check: `/sms-manager` compiles and returns 200, no console/build
  errors.

**Not done (still open)**: balance/billing UI; Personal tab remains untemplated by design (see
above); the git-history PII exposure is still unremediated (see Phase 5/6's notes).

### Phase 8: Real SMS balance indicator (PRD §2/§11, read-only half)

Status: completed

Re-examined PRD §11 and found the balance/purchase UI splits into two genuinely different pieces:
"show the real current balance" (a live read against GOSMS) and "process a purchase" (real money —
explicitly, per the PRD's own text, handled in a separate Billing module that doesn't exist yet).
Only the first is buildable now. No "Buy SMS" button was added — a button with nowhere to send the
user would be a dead end, worse than not having one.

Researched (not guessed) the actual endpoint: GOSMS's actively-maintained Node SDK
(`github.com/gosms-ge/gosmsge-node`, fetched from GitHub — `api.gosms.ge` itself is not reachable
from this environment's network egress policy) calls `POST https://api.gosms.ge/api/sms-balance`
with a JSON body `{api_key}`, returning `{success, balance}` — the same base URL and JSON-body style
this app's existing `/api/sms/send` already uses against `.../api/sendsms`, which corroborates it.
**No live call was made against this endpoint during development** — `GOSMS_API_KEY` isn't set in
this environment, and the user explicitly asked that nothing send/hit GOSMS live while this was
being built (a balance check doesn't send an SMS either way, but the key's absence made the point
moot regardless).

**Built**:
- `src/app/actions/sms-balance.ts` — `getSmsBalanceAction()`: POSTs to the endpoint above, returns
  `ActionResult<{balance: number}>`. `not_configured` when `GOSMS_API_KEY` is unset (same pattern as
  every other GOSMS-gated feature in this module); never fabricates a number on any failure path.
- `sms-manager/page.tsx`: a persistent balance pill in the header (visible across every tab, per PRD
  §2's "constant top bar"), fetched once on mount. Shows nothing but a quiet "unavailable" note on
  any error — no placeholder/fake balance ever rendered.

Notes:
- `tsc --noEmit`: clean. Lint: `sms-balance.ts` fully clean; no new issues on the touched page.
- **Not verified against a live response** — the endpoint and response shape are corroborated from
  two independent GOSMS SDK sources (the actively-maintained Node one, and field names cross-checked
  against the pattern this app's own working `sendsms` integration already uses), but the first real
  call once `GOSMS_API_KEY` is set in the deployment environment should be sanity-checked before
  relying on the number shown.

**Not done (still open)**: the purchase/checkout flow itself (needs the separate Billing module the
PRD describes); auto-continue-on-exhaustion (a real toggle here would be inert without a way to
detect exhaustion, which needs the same billing integration); low-balance in-app warning threshold
(buildable now that a real number exists — natural next step if wanted); Personal tab remains
untemplated by design; the git-history PII exposure is still unremediated.

### Phase 9: Audit log viewer, low-balance warning, CSV export, sender/connection status

Status: completed

Closes out the remaining PRD §9/§10 items that don't need a payment provider — reviewed every
"not done" item across Phases 1-8 and built the ones with no unresolved external dependency.

**Built**:
- `src/app/actions/sms-templates.ts`'s `listSmsAuditLogAction()` — the read side of the audit
  journal every mutation has written to `sms_audit_log` since Phase 1; there was simply never a UI
  to view it back until now.
- `src/components/sms/LogsTab.tsx` — a "შეტყობინებები / აუდიტი" sub-tab switcher; the new
  `AuditLogPanel` lists recent category/template actions (created/edited/deleted/duplicated/
  enabled/disabled) with actor name and timestamp.
- `types/index.ts`'s `smsManager.lowBalanceThreshold` + a new panel in the Settings tab: a number
  input; `checkBalance()` (the same function Phase 8's balance fetch used, now reusable) fires one
  in-app notification per session the first time a fetched balance drops below it — never repeats
  every re-render, and never fires at all if unset.
- CSV export in the Settings tab's new "მონაცემები" panel — client-side, reuses the existing
  `/api/sms/logs` route (no new backend). PRD's own §10 layout puts export under Settings, not Logs.
- Sender name + provider connection status, also new in Settings: displays the *actual* configured
  sender id (`NEXT_PUBLIC_GOSMS_SENDER_ID`, defaulting to `'ClassCore'`) — **not** the studio's own
  `studioName`, which is a real, deliberate divergence from a literal PRD reading. Checked
  `/api/sms/send/route.ts`: every studio on this SaaS sends under the same shared sender id (GOSMS
  sender ids need pre-approval, so this can't be dynamic per-studio without a real registration
  step) — showing `studioName` here as "your sender ID" would have been factually wrong. The text
  says so explicitly rather than implying a per-studio setting that doesn't exist. "Connection
  status" is a live/stateless read too, reusing `checkBalance()`'s success/failure as the signal
  (there's no real persistent connection to a REST API to check) — "Reconnect" just re-runs it.

Notes:
- `tsc --noEmit`: clean. Lint: verified against a pre-change baseline on all touched files —
  `LogsTab.tsx` fully clean; `sms-manager/page.tsx` back to exactly its pre-existing 6 warnings (two
  new ones introduced mid-pass — an untyped CSV row array, a `useCallback` missing a dependency —
  were fixed before committing, not left as new debt).
- No live GOSMS call was made or tested during this phase (`GOSMS_API_KEY` unset here, consistent
  with every other GOSMS-gated phase).

**Not done (still open)**: the purchase/checkout flow and auto-continue toggle (still genuinely
blocked on a real Billing module); log retention *enforcement* (storing the setting would be inert
without a scheduler to act on it — this app has none, confirmed repeatedly across this whole PRD
pass — so it wasn't added); Personal tab remains untemplated by design; the git-history PII
exposure is still unremediated (needs the repo owner to run the commands already given).

### Arch task-board reconciliation + Calendar/Events tombstone/cloud-delete fix

Status: completed (reconciliation) / bug fix built — full module migration still open

A user-shared external task-board screenshot listed several "Arch: X module to Server Actions"
items as still pending, contradicting this doc's own prior "completed" markings. Re-verified every
listed item directly against current code rather than trusting either source blindly:

- **Actually done** (screenshot was stale): attendance/check-in wiring (via `checkin-client.ts`,
  which itself wraps `@/app/actions/checkin.ts` — a first, narrower import grep initially missed
  this indirection and misreported it), `/subscriptions`, `/dashboard` RPC, Groups, Staff/Teachers,
  Branches/Halls, Shop/Sales/Products.
- **Genuinely NOT done** (screenshot was right): **Calendar/Events**. `calendar/page.tsx` (3162
  lines) imports exclusively from `src/lib/event-store.ts` — localStorage + best-effort cloud sync,
  zero Server Actions. `groups.ts`'s own header comment already flagged this as the deliberately
  deferred module.

A full investigation (dedicated Explore pass) into what a real migration would require found this
module far riskier than any module migrated so far: the `calendar_events` schema is described two
different, disagreeing ways in the repo (`master_schema.sql`'s normalized columns vs. the live
`data`-JSONB shape the sync routes actually write, with a fragile bare-`HH:MM`-vs-ISO-timestamp
conversion in between); 9+ other files read/write the store with real cross-module side effects
(Groups `schedule_slots`+color sync, Subscriptions auto-issue + `incrementSessionsUsed`, Halls
conflict checks, SMS confirmations, an AI-chat quick-booking flow in `Header.tsx`); and two
independent, mutually inconsistent conflict-check implementations exist
(`event-store.hasIndividualSlotConflict` vs. `calendar/page.tsx`'s local `checkConflicts`) that
would need reconciling. Given this runs against live production data (real students), a full
migration attempted blind in one pass was judged too high-risk to do without a dedicated scoping
pass of its own — **deferred, not attempted**.

One concrete bug the investigation surfaced *was* fixed, as a small, safe, self-contained step:
`calendar/page.tsx`'s `deleteAllGroupOccurrences` (bulk "delete all occurrences of this recurring
group slot") called `saveEvents(remaining)` directly, skipping the tombstone-set and explicit
`deleteRecordFromCloud` bookkeeping that every other delete path in `event-store.ts`
(`deleteEvent`, `deleteGroupEvents`, `deleteIndividualLessonEvents`) already does — meaning
bulk-deleted recurring occurrences could resurrect on the next cloud hydration. Added
`event-store.ts`'s `deleteEventsByIds(ids)`, a batch variant of the same tombstone+cloud-delete
pattern, and switched `deleteAllGroupOccurrences` to call it instead of the raw `saveEvents`.

Notes:
- `tsc --noEmit`: clean. Lint: no new warnings on either touched file (both files' existing
  unused-import/`any` warnings are pre-existing and unrelated to this change).
- No live GOSMS/Supabase call was made or needed — this was a pure logic fix mirroring an existing,
  already-used pattern in the same file.

**Not done (still open)**: the full Calendar/Events → Server Actions migration itself (needs its
own dedicated design pass: reconcile the two conflict-check implementations, resolve the schema
disagreement against the live DB, and decide whether recurring "weekly" events materialize
server-side or keep the current client-side ±4-week virtual expansion).

### Calendar/Events migration — scoping pass (planning only, no code changed)

Status: scoping complete — migration itself not started

Per the user's explicit choice ("do whichever you think is best" on whether to scope now or stay
fully deferred): this is a **plan**, not an implementation. Nothing in `event-store.ts` or
`calendar/page.tsx` changed in this pass — deliberately, since the risk analysis above is exactly
why a blind start was ruled out. Laying out the open decisions and a phasing strategy now, so
whoever picks this up next (me in a future pass, or someone else) has a concrete plan instead of
re-deriving the same investigation.

**Decision 1 — resolve the schema disagreement, before writing a single Server Action.**
`master_schema.sql` and the live `/api/sync/bulk` code disagree on `calendar_events`'s shape. This
cannot be resolved by reading the repo further — it needs one read-only query against the actual
Supabase project: `select column_name, data_type from information_schema.columns where table_name
= 'calendar_events'`. Until that's run, don't trust either source. (This also settles whether
`start_time`/`end_time` are really `TIME` or `TIMESTAMPTZ` server-side — the bare-`HH:MM`-vs-ISO
conversion currently in `master-sync.ts` is fragile either way and should get a round-trip test
once the real column type is known.)

**Decision 2 — pick one conflict-check implementation, retire the other.** Recommendation:
`event-store.hasIndividualSlotConflict` (the store's version) over `calendar/page.tsx`'s local
`checkConflicts` — it already accounts for `hall.max_parallel_individual`, which the page's local
copy doesn't. Whoever migrates `addEvents`/the drag-drop path should call the store's version (or
its future Server Action equivalent) and delete the page-local one, rather than porting both.

**Decision 3 — recurring "weekly" events: keep client-side expansion, don't materialize server-side.**
Materializing N weeks of real rows server-side would need something to run on a schedule (generate
the next window before it's needed) — this app has no scheduler anywhere (same constraint raised
for SMS log retention, task #37). Recommend keeping `calendar/page.tsx`'s existing ±4-week virtual
expansion (computed client-side over the Server Action's *base* recurring row) rather than taking
on a second "introduce our first cron job" decision inside this migration. Revisit only if a
scheduler gets built for another reason first.

**Suggested phasing** (mirrors how Attendance/Students were migrated — dual-write before cutover,
not a big-bang swap):
1. Build `src/app/actions/calendar.ts` (+ `src/lib/logic/calendar.ts` per the API-contract
   convention) covering the CRUD `event-store.ts` exposes today, once Decision 1 is settled.
2. Cut over the **read-only** consumers first — lowest risk, no write-path coupling to untangle:
   the public student portal, analytics, dashboard's `getTodayEvents()`. These can move
   independently of `calendar/page.tsx` itself.
3. Cut over `calendar/page.tsx`'s reads, keeping its writes on `event-store.ts` a little longer
   (dual-write: write to both the new Server Action and the local store) to catch discrepancies
   before trusting the new path alone.
4. Migrate the cross-module writers one at a time, in order of how contained they are:
   `individual-availability` (open slots — no group/subscription coupling) → `BookIndividualLessonModal`
   (booking — touches subscriptions) → `GroupModal`/`groups/page.tsx`'s `syncGroupScheduleToCalendar`
   call → `calendar/page.tsx`'s own group-editing paths (`updateEventSeries`, `deleteAllGroupOccurrences`)
   last, since they're the most tangled with Groups' `schedule_slots`.
5. Only then remove `event-store.ts`'s write paths (keep `getEvents()` reading from the new source
   until every writer is confirmed migrated, to avoid a window where some data only exists in one
   place).
6. `Header.tsx`'s AI-chat quick-booking (`addIndividualLesson`) and the SMS confirmation flow
   should be re-pointed at whichever step first replaces the function they call, not treated as a
   separate phase — cheaper to fix in place than to schedule around.

**Not done**: the migration itself. This is a plan to execute against, not a completed task —
re-verify Decision 1 against the live DB before writing any code, since everything else here
assumes its answer.

**Update — Decision 1 partially resolved, and a new scope finding**: `supabase/SUBSCRIPTION_PERSISTENCE_FIX.sql`
(a manually-run fix script, not in `migrations/`) does
`ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;` —
confirms the live table really does have the `data` JSONB column the sync code assumes (the
`master_schema.sql` normalized-columns-only version is the outdated one). This is enough to safely
read events (`select('data')` returns the exact same object shape `event-store.ts` already works
with — `start_time`/`end_time` as plain `"HH:MM"` strings inside the JSON, sidestepping the
TIME-vs-timestamp ambiguity entirely for reads). Started building the read-only Server Action on
this basis, per the phasing plan's step 2 (cut over read-only consumers first).

Got as far as reading the two intended first consumers' actual code before writing it, and found a
scope-changing fact: `dashboard/page.tsx`'s `getTodayEvents()` call and `analytics/page.tsx`'s
`getEvents()` call are each one line inside a much larger **synchronous** stats-computation
function that also calls `getStudents()`, `getSales()`, `getSubscriptions()`, etc. — all
synchronous, local-store reads, computed together in one pass. Swapping just the calendar read to
an async Server Action isn't a data-source swap, it's a sync→async restructure of that whole
function (dashboard's touches attendance-rate/expected-today stats; analytics' touches
teacher-payroll/bonus stats) — real, non-trivial code that I can't visually or functionally verify
in this environment (no Supabase credentials here — see the SMS log-retention phase for the same
limitation). Rather than restructure a payroll-adjacent computation blind and unverified, stopped
here rather than push through it.

**Not done**: the Server Action itself was not committed (kept out of the tree rather than half-
build it) — this note exists so the next attempt starts from "read-only is 90% blocked on a
sync→async restructure of two stats functions," not from scratch. The `data`-JSONB read approach
above is still the right one to use once that restructure is scoped and someone can verify the
result against the running app.

### REST API foundation — Phase 0: `branches` logic-layer extraction pilot

Status: completed

First concrete step of the REST-API-foundation initiative discussed earlier (mobile/desktop apps
need real React Native, not a WebView — Server Actions are unreachable from that runtime). Per the
narrowed scope agreed after review (extract the shared logic layer now; defer REST routes and
bearer-auth entirely until native work actually starts, since building them speculatively risks
guessing wrong about what the native client actually needs) — this pass did **only** the
extraction, nothing else.

**Built**: `src/lib/logic/branches.ts` — `createBranch`/`updateBranch`/`deleteBranch`, plain
functions taking an already-authenticated `{ client, orgId }` plus the raw input, with the Zod
validation and Supabase calls moved out of `src/app/actions/branches.ts` verbatim. The Server
Action file is now a thin wrapper: `requireStudioManager()` for auth, call the logic function,
`revalidatePath`. Chose `branches` as the pilot because it was already the smallest/simplest
migrated module (3 actions, no cross-module side effects) — a good template to point at when this
pattern gets applied to a real entity later, with the least risk of the extraction itself
introducing a regression.

Notes:
- `tsc --noEmit`: clean. Lint: no new warnings on either file.
- No REST route, bearer-auth, or access/refresh-token work was built — that remains explicitly
  deferred per the agreed scope, to be picked back up only once native app work actually starts.
- **Self-review correction**: the first version of this pilot still threw raw `Error`s instead of
  returning `ActionResult<T>` — missing the point, since `api-contract.md` uses this exact entity
  (`createBranch`/`listBranches`) as its own worked example of the convention. Fixed:
  `src/lib/logic/branches.ts`'s three functions now return `ActionResult<void>` via `ok()`/`fail()`
  for validation/query failures; `requireStudioManager()`'s auth check still throws (shared infra,
  out of scope here). Existing callers (`StudioContext.tsx`) were already fire-and-forget
  (`.catch(() => {})`) so this needed no caller changes. Also factored the tombstone/cloud-delete
  block this pass's other fix (`deleteAllGroupOccurrences`) had just duplicated a 5th time in
  `event-store.ts` into one `tombstoneAndDeleteFromCloud(ids)` helper, traced against all 4 prior
  call sites to confirm it's behavior-preserving.

### SMS log retention enforcement — the app's first scheduled job

Status: completed

The SMS PRD's "log retention" setting was never built at all (see Phase 9's note) because this app
had no scheduler anywhere. User chose Vercel Cron to fix that ("Vercel is active again, do
whichever you think is right on the mechanism") — this introduces the app's first ever scheduled
job.

**Built**:
- `types/index.ts`: `StudioSettings.smsManager.logRetentionDays?: number` — **opt-in only**. An org
  that never sets this is never touched by the cron; a studio's SMS history is never deleted
  without an admin explicitly choosing a number first.
- `sms-manager/page.tsx`: a "ლოგების ავტომატური წაშლა" panel in Settings (days input, 1-3650 range,
  save button) — same pattern as the existing low-balance-threshold panel.
- `vercel.json`: a daily cron (03:00 UTC) hitting the new route.
- `src/app/api/cron/sms-log-retention/route.ts`: for each studio with `logRetentionDays` set,
  deletes `sms_logs` rows older than that many days for that org. Auth via
  `Authorization: Bearer $CRON_SECRET` (Vercel's own documented convention — refuses to run if
  `CRON_SECRET` isn't set on the project).
- `supabase/migrations/20260920_sms_logs_retention_index.sql`: composite `(org_id, timestamp)`
  index on `sms_logs` (the cron's delete filters on both), dropping the now-redundant
  org_id-only index.

Notes:
- `tsc --noEmit`: clean. Lint: no new warnings on any touched file.
- **Self-review corrections (multiple rounds)**: the schema path for reading `logRetentionDays`
  server-side was wrong on the first *two* attempts before being traced end-to-end through the real
  write path (`updateSettings` → `pushFullStudioMetadata` → `/api/sync/metadata`) and fixed to the
  correct one (`studio_settings.staff_data.smsManager`, not `studio_settings.settings` — that
  column doesn't exist — and not `staff_data._operations.cc_studio_settings`, which is a *different*
  blob only the superadmin panel writes). Also fixed after review: added pagination with a stable
  `.order()` (a plain select caps at 1000 rows), added `maxDuration = 300`, made the route return a
  failing HTTP status if every org's delete errored (so cron-monitoring alerting isn't blind to a
  total failure), clamped `logRetentionDays` to a sane range both client- and server-side (an
  extreme value would otherwise throw an uncaught `Invalid Date` mid-loop), wrapped each org's
  delete in its own try/catch (one org's failure no longer aborts every org after it), and switched
  the settings read to PostgREST's `staff_data->smsManager` JSON-path selection instead of pulling
  the whole `staff_data` blob (which can carry a full base64 studio logo) once a day for every
  studio just to read one nested number.
- **Known limitation, not fixed**: each org's delete is one unbounded statement — an org enabling
  retention for the first time after years of unpurged history could delete a very large number of
  rows in one call, risking the time budget and holding a write lock against the live
  `/api/sms/send` logging path. Not batched (chunked deletes with a loop) because that needs
  verifying against a live Supabase/PostgREST instance this environment doesn't have; documented in
  the route's own comment as something to revisit if ever observed running long.
- No live Supabase call was made or possible to verify this against in this environment (no DB
  credentials here) — every claim about the real schema/write path was verified by reading the
  actual server code that performs those writes, not by testing against a live database.

### Test infrastructure + repo-wide no-unused-vars cleanup

Status: completed

Requested directly ("do 1 and 2 as well" — add tests, clean up the lint debt). Scope corrected
mid-task: the initial estimate ("563 errors, 33 files") was wrong — a `head_limit`-truncated grep —
the real number was ~572 `no-unused-vars` errors across 90+ files, told to the user before
proceeding rather than silently doing a fraction of what was agreed.

**Built**:
- `vitest.config.ts` + `package.json`'s `test` script — this project had zero test tooling.
  Pinned to Vitest v2 (v5 wanted `@types/node` ^22, this project has ^20 — v2 avoids bumping an
  unrelated dependency for no reason).
- `src/lib/action-result.test.ts`, `src/lib/logic/branches.test.ts` — unit tests for the two
  purest pieces of this session's own earlier work (the `ok`/`fail`/`clampPagination` helpers, and
  the branches logic module against a small fake chainable Supabase client, since there's no live
  DB here to test against for real).
- Eliminated every `no-unused-vars` error repo-wide. Split the mechanical bulk across 4 parallel
  Agent batches (unused imports/destructured vars/dead functions/`catch(e)`→`catch{}`), each
  required to verify its own `tsc --noEmit` + a filtered lint re-run before reporting back — this
  was genuinely parallelizable (independent file sets, mechanical, easily verified per-batch) so
  four batches ran concurrently rather than one at a time.

**Self-review found and fixed after the batches finished** (own mistake + a final full-diff pass):
- I gave the batches an incorrect blanket instruction — "removing a trailing unused parameter is
  always safe since JS/TS lets callers pass more args than declared." True for plain JS, false for
  this typed codebase: `tsc` errors the moment a call site still passes the old arg count. Two
  batches independently caught this via their own mandatory `tsc` step and self-corrected (reverted
  the signature, used an `eslint-disable-next-line` instead). Two others still left 2 call sites
  broken (passing an extra arg to a function whose signature had lost that param) — found via a
  cross-batch `tsc --noEmit` and fixed directly (dropped the now-ignored argument at the call site
  in both cases, since neither function actually used that parameter internally either).
- ~26 more `no-unused-vars` instances turned up in files outside the original 90-file list — the
  same `head_limit` truncation that caused the original miscount also missed files whose *first*
  lint error was something other than `no-unused-vars`. Fixed these myself: mostly `catch(e)` →
  `catch{}` and dead locals, plus one genuinely security-relevant case in
  `src/app/api/auth/staff-login/route.ts` (`const { password, data, ...rest } = row` — a
  deliberate exclusion idiom to strip password fields before returning staff data; silenced with
  `eslint-disable-next-line` rather than "fixed" by removing the destructuring, which would have
  put the password back into `rest`).
- A final full-diff code-review (separate from each batch's own self-check) found 3 real leftover
  cases where a batch removed the *consumer* of a value but left the now-pointless computation
  running: `attendance/page.tsx` fetched every shop product on every drawer-open with the result
  now written to a setter nothing reads (its only consumer, quick-sell, was the dead code removed);
  `analytics/page.tsx` had a bare `getExpenses(...)` call left directly in the render body,
  re-reading localStorage every render for a discarded value; `master-sync.ts`'s
  `pushCollectionToCloud` kept a `createClient()` call under the assumption it had a needed side
  effect, but that function never uses any Supabase client — it calls `fetch()` directly. All three
  deleted (not just the flagged unused variable — the whole now-pointless computation).
- Found and fixed one real, unrelated bug while going through calendar/page.tsx by hand:
  `EventChip` received an `onTouchStart` handler from both its callers but never wired it to the
  rendered `<button>` — mobile touch-drag was silently non-functional. Added the one missing prop,
  mirroring the sibling `onMouseDown` that was already wired correctly.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing. Full `next lint`: 0 `no-unused-vars`
  errors remaining anywhere in the repo.
- Deliberately NOT touched: `no-explicit-any` (~690 instances), `react-hooks/exhaustive-deps`
  (~38), `no-img-element` (~48) — each needs a real per-site type or behavior decision, not a
  mechanical fix, and was explicitly out of scope for this pass.

### Production diagnostic follow-up (relayed by a colleague, "Niko") — hydration noise + duplicate POSTs

Status: completed (the 2 items verified as real); the rest still open, needs live-app access

A colleague's network/console audit of the live app (dashboard/students/groups pages) reported:
duplicate POST requests per page (dashboard 4x, students 2x, groups 2x), ~10 sidebar links
prefetched on every load, base64 avatars inline in payloads, MasterSync's background hydration
firing on every nav + ~5min, and — flagged as the most serious finding — 4 console warnings
("Empty cloud result for cc_student_data/cc_student_subscriptions/cc_calendar_events/cc_expenses,
preserving local data") appearing on literally every hydration cycle, read as evidence Supabase
never returns real data for these 4 collections and the app silently runs on stale local copies.

**Investigated each claim against the actual code before acting on any of it** (no live DB/Vercel
logs access in this environment, so verification was via reading the real hydration/API code, not
via reproducing the network trace):

- **"Empty cloud result" — a false alarm, not a data-loss bug.** `StudioContext.tsx`'s hydrate()
  runs two phases: Core (immediate) and Heavy (a `setTimeout` right after, separate API call).
  `/api/sync/state/route.ts`'s `isHeavy` gating means students/subscriptions/calendar_events/
  expenses/sales/products/trash are *always* `Promise.resolve({ data: [] })` in a `'core'`-chunk
  response — by design, not by failure. The warning (`guardedWrite`, only ever called from the Core
  block) is therefore guaranteed to fire for exactly these keys on every single cycle, regardless
  of whether Supabase is healthy. Traced each of the 4 (and 3 more the colleague didn't list —
  `cc_shop_products`/`cc_shop_sales`/`cc_global_trash`, also `isHeavy`-gated) through to the
  *separate* Heavy-phase write path and confirmed each one has its own real write with its own
  `queryFailed` guard (e.g. `calendar_events` at what's now line ~726) — real data does arrive,
  just a beat later than the misleading warning suggests.
- **Duplicate POST /dashboard and /groups — real, and root-caused.** The hydrate() function used to
  dispatch `cc_groups_update`/`cc_halls_update`/`cc_student_update`/`cc_teacher_update`/
  `cc_calendar_events_update` individually *and again* inside a second `forEach` dispatch pass —
  every listener bound to any of those 5 events fired twice per hydration cycle. `dashboard/page.tsx`
  listens to 4 of the events this affects (`cc_subscription_update`/`cc_attendance_update`/
  `cc_sale_update`/`cc_student_update`) to re-run `getDashboardStatsAction()` (a Server Action —
  shows up as `POST /dashboard`); `groups/page.tsx` listens to `cc_groups_update` for
  `getGroupsAction()`. This fully explains the observed duplicate/quadruple POSTs.
- **/students' "one 200, one 503"** is most likely React Query's default automatic retry-on-error
  (`useStudentsListQuery`, `@tanstack/react-query`) reacting to an occasional real 503 — not a
  separate bug of its own. Not fixed directly; should become less frequent as a side effect of the
  fix below (fewer simultaneous requests during a hydration burst → less contention).
- **Sidebar prefetching ~10 links unclicked** — confirmed as plain Next.js `<Link>` default
  behavior (no `prefetch={false}` set anywhere in `Sidebar.tsx`), not a custom bug. Real, and worth
  tuning, but a deliberate scope decision (which links matter enough to prefetch) rather than a
  one-line fix — left open.

**Built**:
- `StudioContext.tsx`: merged the two duplicate-event-dispatch passes into one deduped list (each
  event now fires exactly once per hydration cycle).
- `StudioContext.tsx`: added `HEAVY_ONLY_CORE_KEYS` — `guardedWrite` still skips the write exactly
  as before (unchanged behavior), it just no longer logs the misleading warning for the 7 keys that
  are guaranteed-empty-by-design in a Core-only chunk. Self-review caught that the first pass at
  this list only had 4 of the 7 actual `isHeavy` keys (missed `cc_shop_products`/`cc_shop_sales`/
  `cc_global_trash`) — completed against `/api/sync/state`'s actual gating before committing.
- `dashboard/page.tsx`: debounced the `getDashboardStatsAction()` reload (300ms) so several of its
  4 listened-for events firing together in one hydration burst collapse into one real network call
  instead of one each.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing.
- **Not done (still open, needs the colleague's or someone's live-app/Vercel access to verify or
  finish)**: whether the 503s stop once the request-flood is reduced (can't reproduce/measure
  without a live environment); sidebar prefetch tuning (a product decision on which links are
  worth it, not just a technical fix); moving avatars from base64-in-payload to Storage URLs
  (larger, separate piece of work); `groups/page.tsx`'s own duplicate-listener pattern beyond what
  the StudioContext dedup already fixes wasn't otherwise touched. The broader "two architectures
  coexisting" observation is accurate as a description of the codebase's history (documented
  repeatedly elsewhere in this file) but isn't itself an actionable line item.

### Branches silently failing to save (relayed by a colleague, "Niko") — swallowed-error fix

**Report**: a second, short relayed message — Niko said branches aren't being created, no other
detail.

**Root cause found by reading the code** (no live DB/Vercel access, so verified via the actual
call chain rather than reproduction): `addBranch`/`updateBranch`/`removeBranch` in
`StudioContext.tsx` all followed the same shape — optimistically commit the change to local state
(and localStorage) *first*, then fire the corresponding Server Action
(`createBranchAction`/`updateBranchAction`/`deleteBranchAction`) with `.catch(() => {})`. That
swallows two different failure shapes: a thrown error (e.g. `requireStudioManager()` rejecting an
unauthorized caller) *and*, since this session's earlier `branches` logic-layer extraction, a
resolved `ActionResult` with `error` set (a validation or DB failure that doesn't throw). Either
way the UI had already shown the branch as saved before the Server Action ran, and nothing ever
told it the server rejected the write — so a branch could look present in the browser indefinitely
while never existing server-side, which matches "branches aren't being created" from a user who
only sees the client.

Ruled out an owner-role-assignment bug first (`register-studio/route.ts` correctly sets
`role: 'owner'` in `user_metadata` at creation) before concluding this was the cause. Also found,
but explicitly did not act on: `supabase/FINAL_PERMISSIONS_FIX.sql`, a legacy, not-in-`migrations/`
script that disables RLS and grants broad `anon`/`authenticated` privileges on `branches` and
several other tables — unclear whether/when it actually ran against the live DB relative to later
RLS-enabling migrations, and both confirming and reverting it need live DB access this environment
doesn't have. Flagging it here as an open risk rather than guessing.

**Built**: a shared `runBranchAction(action, failureLabel, rollback)` helper used by all three
functions — checks both failure shapes, shows a failure notification, and rolls back via the
caller's `rollback(prev)`. Two rounds of self-review (`code-review` skill) each found real issues,
fixed before committing:
- **Round 1** — `updateBranch`'s first rollback attempt closed over a stale snapshot captured
  before the async call started, which could clobber a second, already-successful overlapping
  edit to the same branch. Fixed by having `rollback` receive the *latest* state and compare
  against it (`JSON.stringify(current) !== JSON.stringify(updated)` before reverting) instead of
  trusting the snapshot; this is also why `rollback` takes `prev => next` rather than a plain
  object.
- **Round 2** — the rollback only called `setSettings`, never re-persisting through
  `saveSettings`/`pushFullStudioMetadata` the way the original optimistic write had — so the
  *correction* itself didn't survive a hydration cycle, and the bad state would silently reappear.
  Fixed by having `onFailure` persist the rolled-back branches array the same way, gated on
  `orgId` exactly like `updateSettings()` does. Also found in this pass: `addBranch`'s optimistic
  write never pushed to the cloud settings blob at all (only `saveSettings` to localStorage) —
  unlike `updateBranch`/`removeBranch`, which both go through `updateSettings()` and therefore
  push on every edit — so a branch created on one device/session was invisible to any other until
  something else happened to push settings again. Fixed by adding the same conditional
  `pushFullStudioMetadata` call to `addBranch`'s success path. Two smaller bugs from the same pass:
  `addBranch`'s rollback always returned a new spread object even when nothing needed reverting
  (defeating the `next === prev` no-op check other two functions rely on) — fixed with an explicit
  membership check; `removeBranch`'s rollback re-inserted a restored branch at the *end* of the
  array instead of its original index — fixed by capturing the index before the optimistic removal
  and splicing it back in on rollback.
- Toast text for all three (previously Georgian: `ფილიალის დამატება/განახლება/წაშლა ვერ მოხერხდა`,
  `უცნობი შეცდომა`) switched to English to match this file's own established convention for
  sibling staff error messages (`'Failed to save staff changes'`, etc.) — this file has no other
  Georgian-language strings in code, only in user-facing content.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing, both before and after every round of
  fixes above.
- **Not done**: `runBranchAction`'s `onFailure` duplicates the same `saveSettings` +
  `pushFullStudioMetadata` sequence that `updateSettings()` already implements, instead of sharing
  one persistence path — flagged by the final review pass as a maintainability risk (the two
  copies can drift if one is changed without the other) but not refactored, since giving
  `updateSettings()` a functional-updater form to share the logic safely would touch a
  widely-called function with many existing callsites — larger, riskier scope than this fix
  warranted. Also still open, unchanged from the prior entry: whether `FINAL_PERMISSIONS_FIX.sql`
  was ever run against the live DB, and what `branches`' actual current RLS state is — needs live
  DB access to answer.

### Calendar/Events — minimal Server Actions port (docs/architecture-migration.md §12)

Picked up the one item on the board still genuinely blocked on a scope decision. §12 already had a
detailed writeup of why this was deliberately deferred: no real per-occurrence identity for
recurring events (editing/deleting a future week or an individual lesson today either silently
no-ops or wrongly mutates the whole series), pervasive teacher self-service writes across the
module (not just the calendar page — booking their own lessons, publishing their own
availability), and a timestamp-vs-HH:MM schema mismatch. Asked which of 3 scopes to take (leave the
occurrence bug alone and do a minimal port / fix the bug as part of this migration / fix the bug
without touching Server Actions at all) — told to use judgment, picked the minimal port: doesn't
require inventing a per-occurrence exception model as a side effect of what should be an
architecture-only pass.

**Built**: `src/app/actions/calendar.ts` — `createCalendarEventAction`/`updateCalendarEventAction`/
`deleteCalendarEventAction`/`deleteCalendarEventsAction`, `requireEffectivePermission('canEditCalendar')`
-gated, zod-validated, matching the real `calendar_events` schema (`id, org_id, hall_id, group_id,
title, start_time, end_time` as timestamptz + `data` JSONB — confirmed via `/api/sync/bulk`'s
`MINIMAL_COLUMNS`/`sanitizeRow`). Scoped to exactly the 4 operations `calendar/page.tsx` performs on
a REAL, addressable row (create, update, delete-one, delete-a-batch for its own
`deleteAllGroupOccurrences`) — wired in `calendar/page.tsx` to run ADDITIONALLY alongside the
existing `event-store.ts` write, which is completely unchanged. Every read-only consumer (the
calendar page's own reads, attendance's schedule display, dashboard's schedule widget,
individual-availability, `BookIndividualLessonModal`, the public student portal) is unaffected.
What's new: a permission denial or DB error, previously swallowed by the best-effort
service-role `/api/sync/bulk` push (no server-side `canEditCalendar` check at all, no round-trip
confirmation), now surfaces a toast — previously it was 100% silent either way.

**Three review rounds, three real findings, the last one serious**:
- Round 1 caught `updateEvent()` retargeting a recurring occurrence's expanded `_wN` id to the real
  base row (mirroring `deleteEvent()`'s existing suffix-strip) — safe for delete, but for update it
  would have silently overwritten that real row with the occurrence's shifted date/time. Fixed by
  only firing the new action when `updated.id` matched a real row *unchanged* (gated on the same
  `prev` lookup that already decides whether the local store call no-ops), otherwise skipping it —
  same outcome as the pre-existing local no-op, no corruption risk. Also added a `NOT_FOUND` check
  on zero-row-matched update/delete... which round 3 then found was itself wrong (below).
- Round 2 confirmed `deleteAllGroupOccurrences` could call the batch-delete action with an empty
  `ids` array (nothing to delete), which zod rejected as a validation error — fixed with a
  length-guard before the call — and that the create schema's `title.trim().min(1)` was stricter
  than the edit UI actually enforces, so clearing a title (which saves fine locally) would surface a
  spurious server error; fixed to match `sanitizeRow`'s own `row.title || 'Event'` fallback instead
  of rejecting.
- **Round 3, the serious one**: this Server Action runs *alongside* `event-store.ts`'s own
  fire-and-forget write of the same id, which has far fewer round trips (no permission checks) and
  usually lands first — so a plain `.insert()` on create almost always hit a duplicate-key conflict
  on an event that was, in fact, saved, surfacing a false failure on ordinary use. First fix was
  `upsert()` — which turned out to be a real security regression: `requireOrgIdDualAuth()` hands
  staff-token (teacher) sessions a service-role client with **no RLS**, and an `upsert`'s
  `ON CONFLICT DO UPDATE` has no way to be scoped by `org_id` — any org's caller with
  `canEditCalendar` could have overwritten another org's event by supplying its id, a genuine
  tenant-isolation hole. Fixed with insert-then-verify-ownership-on-conflict instead: insert; on a
  `23505` conflict, look up the existing row's `org_id`; treat it as the benign same-org race only
  if it matches, otherwise reject. Two follow-on issues in that same fix, both closed: the lookup's
  own error was being swallowed (a transient DB error on the ownership check would have produced a
  misleading `ID_CONFLICT` instead of `DB_ERROR`); and the rejection message named which org the
  conflicting id belonged to, which would have let any caller enumerate other orgs' event ids by id
  — genericized to not confirm existence either way. This same round also concluded the
  earlier-added `NOT_FOUND` checks on update/delete (round 1) were wrong for the identical reason as
  the upsert bug — they're raced by the same legacy fire-and-forget path and would misfire on a
  benign race — so those were reverted back to plain error-only checks; correctness here now leans
  on the caller-side `prev`/`baseEv` gates instead of a server-side existence check.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing. `next lint` on both touched files: clean
  (pre-existing `no-explicit-any` warnings elsewhere in the 3000-line calendar page are untouched,
  not introduced by this change).
- **Not done, deliberately**: everything §12 already listed as deferred (per-occurrence identity,
  teacher self-service booking/open-slot writes, the timestamp/HH:MM schema split) is exactly as
  unfixed as before — this pass never touches occurrence semantics. Also not done: batching
  (`addEvents()` fires one `createCalendarEventAction` round trip per event in a multi-day recurring
  create instead of one batched insert) — accepted as a background, fire-and-forget cost rather than
  building a 5th Server Action for it now.

### Branch data isolation, Phase 1 (students/staff/groups/halls)

Follow-up to the branches-silent-failure fix: the owner reported branch-switching "does nothing,"
and investigation (3 parallel research passes — schema/stores, Server Actions layer, UI/permissions)
confirmed there was no real branch isolation anywhere in the app — `org_id` was the only enforced
boundary, `activeBranchId` filtered almost nothing, and `staff.allowedBranchIds` only ever gated the
branch-switcher dropdown, never a query. The actual requirement (clarified with the owner): branches
must be genuinely independent, but a student or teacher can belong to more than one at once, with
stats/payments kept separate per branch, enforced through permissions, not just the UI. This is a
large, multi-phase feature — planned via plan mode, with a written plan covering Phase 1 in full
(students/staff/groups/halls — the "identity/location" layer) and Phases 2/3 (subscriptions/
attendance/sales/expenses, then calendar_events) scoped at roadmap level for later.

**Built** (`supabase/migrations/20260921_branch_isolation_phase1.sql` + touched Server Actions):
- Real columns, backfilled so no existing row goes invisible: `students.branch_ids` (`TEXT[]` — a
  student can now belong to multiple branches, replacing the old single `data.branch_id` string that
  was silently overwritten on every edit), `staff.allowed_branch_ids` (`TEXT[]`, promoted from
  `data.allowedBranchIds`), `groups.branch_id` and `halls.branch_id` (`TEXT`, new — neither had any
  branch concept before, defaulted to `'main'`).
- `search_students` RPC gained `p_branch_id` (narrow to one branch — this is what makes switching
  branches actually filter something) and `p_visible_branch_ids` (the security boundary), same dual-
  param shape as the RPC's existing group-visibility params. Had to `DROP FUNCTION` first since
  adding parameters changes a Postgres function's identity — a plain `CREATE OR REPLACE` would have
  left the old signature as a separate, still-callable overload.
- `resolveCallerBranchIds()` (`src/lib/permissions/enforce.ts`) and `applyBranchFilter()`/
  `assertBranchAccess()` (`src/lib/server-actions-auth.ts`) — shared helpers every entity's Server
  Actions use: reads filter by the caller's own permitted branches (empty = unrestricted, matching
  the existing convention) AND by an optional explicit `branchId` param (wired to
  `settings.activeBranchId` from each page); writes validate the caller may actually target the
  branch(es) they're setting. `students.ts` can't reuse these directly (it only supports real
  Supabase Auth sessions via its own `requireOrgId()`, not the dual-auth `DualAuthContext` staff-token
  sessions need) — it has an equivalent local `resolveOwnBranchAccess()`/`assertBranchAccess()` pair.
- UI: `StudentModal` gained a multi-select branch picker (new — none existed before), `GroupModal`
  and the halls create/edit modal gained single-select branch pickers next to their existing hall/
  name fields. All three only render when a studio actually has more than the default one branch.
  `students/groups/halls` pages now pass `settings.activeBranchId` into their read calls and default
  new records to it.

**Four review rounds, each catching something real before it shipped** — this touches
auth/permission logic directly, so it got the same scrutiny as the Calendar Server Actions work:
- Round 1: `updateStaffAction`/`deleteStaffAction` never checked the caller had access to the
  *target* row's branch before mutating it (only `createStaffAction`'s `allowedBranchIds` field was
  guarded) — a branch-A-only Administrator could edit/delete any staff member org-wide. `updateGroupAction`/
  `deleteGroupAction` relied on `applyBranchFilter` silently narrowing the WHERE clause instead of
  erroring on a 0-row match — an out-of-scope edit/delete would silently no-op with no error, the
  exact bug class task #44 (branches) already fixed once this session. `saveHallsAction`'s new
  `halls.length === 0` early-return broke its own documented "empty array deletes everything"
  whole-array-replace contract.
- Round 1 fixes: added `.select('id')` + a real error on 0 rows affected to `updateGroupAction`/
  `deleteGroupAction`/`deleteHallAction` (safe here, unlike Calendar's actions — nothing else writes
  these specific rows concurrently, so a 0-row result is never a benign race). Replaced halls' empty-
  array no-op with a real branch-scoped "delete everything I can see" (org-wide for an unrestricted
  caller, matching the pre-branch-isolation behavior exactly). Added a target-branch check to
  `updateStaffAction`/`deleteStaffAction`, mirroring `assertCanGrantBranches`.
- Round 2 (self-review of round 1's own fix): the new staff target-branch check was itself wrong —
  the migration backfills `allowed_branch_ids` to `[]` (unrestricted) for nearly every existing staff
  row, so "the target's scope must be a subset of the caller's own" rejected almost any ordinary edit
  (renaming someone, changing `assigned_group_ids`) that had nothing to do with branches. **Reverted**
  rather than patched further — properly scoping "can a branch-restricted Administrator manage a
  colleague outside their branch at all" (overlap vs. subset? does role tier matter?) is a real RBAC
  question that deserves its own decision, not a side effect of this migration. Documented as an
  open gap in `staff.ts`'s header instead.
- Also caught: a comment on `updateGroupAction`'s new 0-row check overclaimed safety ("group-store.ts's
  legacy path is used by other pages, not this one") — true for the narrow race-safety point it was
  making, but read as if it meant branch enforcement couldn't be bypassed at all, which isn't true
  (see below). Corrected the comment and added an explicit gap disclosure to the file header instead.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing. `next lint` on every touched file: clean
  (pre-existing `no-explicit-any`/`no-img-element` warnings elsewhere in these files are untouched).
- **Deliberately NOT done, Phase 1 scope**: Phases 2 (subscriptions/attendance/sales/expenses get
  their own `branch_id`, stamped at creation) and 3 (calendar_events, derived from its hall) per the
  written plan — roadmap only, not built. `group-store.ts`'s and `hall-store.ts`'s legacy write paths
  (calendar/page.tsx's `createGroup`/`addSlotToGroup`/`removeSlotFromGroup`, onboarding's
  `SetupWizard`) still write to the same tables with no branch check and no `branch_id` at all —
  inherits the exact same gap this file already had for org_id/permission enforcement before this
  pass (documented in `groups.ts`'s own header both times). Staff management (update/delete) isn't
  branch-scoped at all per Round 2 above — deliberately deferred, not silently missed.
  `resolveCallerBranchIds()` re-runs a full caller resolution (a `staff` table query, sometimes a
  Supabase Auth call too) that `requireEffectivePermission()`/`requireStudioManager()` already just
  did and discarded — every branch-aware write now costs 2 caller-resolution round trips instead of
  1; a real inefficiency, not fixed here since it would mean reshaping `DualAuthContext` across every
  caller, wider scope than this pass. New expected-failure paths (`assertBranchAccess`,
  `assertCanGrantBranches`, the new 0-row "not found" errors) `throw` rather than returning
  `ActionResult` — consistent with these specific files' own pre-existing convention (they already
  threw before this pass), but not the `docs/agents/api-contract.md` convention newer code is meant
  to follow; a full retrofit of `students.ts`/`staff.ts`/`groups.ts`/`halls.ts` to `ActionResult` is
  out of proportion to a branch-isolation pass and left for its own turn.

### Fix: QueryProvider reset its whole cache on every navigation

After deploying, the owner reported that leaving `/students` and coming back always re-fetched from
scratch, however recently they'd just been there. Root cause: `src/components/providers/QueryProvider.tsx`
(TanStack Query's provider) was mounted *inside* `/students/page.tsx` itself — its own header comment
even said so explicitly, calling it a deliberate, temporary scoping ("when a second module migrates,
hoist this into `(dashboard)/layout.tsx`"). Since then, 5 modules moved to Server Actions (students,
groups, halls, staff, calendar), but the hoist was never done. Every time `/students` unmounted (i.e.
every navigation away from it), its `QueryProvider` — and the `QueryClient` instance + cache it
owns — was destroyed with it. Coming back created a brand-new, empty `QueryClient`, so
`useStudentsListQuery` always looked like a first-ever page load: real network round trips to
Supabase every single time, no matter how recently the same data had already been fetched.

**Fix**: moved `QueryProvider` to wrap `{children}` in `src/app/(dashboard)/layout.tsx` — a layout
that Next.js App Router keeps mounted across every navigation within `/dashboard/*` (only `children`,
the actual page, swaps). The `QueryClient` and its cache now survive page-to-page navigation. Removed
the now-redundant wrapper from `/students/page.tsx`. Behavior this restores (per the provider's own
`staleTime: 30_000` default, already correct, just never actually in effect for more than one page
load at a time): a return within 30s shows the cached list instantly, no request at all; a return
after that still shows the last-known list immediately (the page already correctly uses `isLoading`,
not `isFetching`, to gate its skeleton) while a request quietly re-validates it against the database
in the background — never a blocking "start over" reload, but never stops being DB-sourced either.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing. `next lint`: clean on all 3 touched files
  (pre-existing `no-explicit-any` warnings in `students/page.tsx` are untouched). `npm run build`
  compiled and type-checked successfully; it fails past that step in this sandbox only because no
  Supabase env vars are configured here — unrelated to this change.
- Verified directly against the *deployed* `main`/`rebrendig` branches (Antigravity had already
  merged this session's branch-isolation work into both and shipped it) before making this fix, in
  a separate git worktree: no merge conflict markers, all branch-isolation Server Action code intact,
  same clean `tsc`/`vitest` result.
- Any other page migrated to TanStack Query in the future gets this for free — no per-page provider
  needed, just import the hooks.

### Fix: Dashboard ignored branch isolation entirely (Phase 1 follow-up)

The owner reported that switching the active branch (BranchSwitcher) changed nothing on
`/dashboard` — same student count, revenue, subscriptions, attendance, schedule — while the new
`/students` page correctly showed an empty roster for a freshly created branch with no students
assigned yet. The second half was *expected*: real isolation means a branch with zero members
shows zero, which the `/students` Server Action path (`searchStudents`, branch-isolation Phase 1)
already gets right. The first half was a real, separate bug — the Dashboard never adopted Phase 1
at all; it still runs on `getStudents()`/`getGroups()`/`getUniqueSubscriptions()`/`getTodayCheckins()`
(legacy client-side localStorage stores), plus a server-authoritative overlay for 4 numbers via
`get_dashboard_stats()`, none of which had ever been touched to filter by branch.

Root causes found and fixed:
- `student-store.ts`'s `getStudents()` *did* have branch-filtering logic already, but (a) it only
  ever checked the old legacy singular `data.branch_id` field, never the new `branch_ids` array
  Phase 1 added, and (b) worse, it had a "resilience" fallback that showed **every student in the
  org** whenever the branch filter matched zero rows — which is true for every branch other than
  `main`, since nothing had ever populated `branch_ids` beyond the migration's own backfill. This
  bypass is the direct reason the dashboard's student count never changed. Fixed to check
  `branch_ids` first (falling back to the legacy field only when `branch_ids` is empty), and
  removed the bypass entirely — a branch with zero students must render as zero.
- `group-store.ts`'s `getGroups()` tracked `branch_id` on every `Group` object (Phase 1) but never
  actually filtered by it — explicitly documented as a known gap in its own header comment. This
  fed the dashboard's "Today's Groups"/schedule cards, which is why they showed identical classes
  regardless of branch. Now filters the same way, without the show-everyone-on-empty anti-pattern.
- `dashboard/page.tsx`'s `refreshFullDashboard()`: subscriptions and check-ins don't have their own
  `branch_id` yet (a separate, larger item — attributing a transactional record to a branch cleanly
  needs its own migration, deliberately deferred, same as the original Phase 2/3 roadmap). As an
  interim, correct-today fix, a subscription/check-in is now attributed to a branch through the
  student(s) it belongs to (`branchStudentIds`, derived from the now-fixed `getStudents()`). This
  scopes active-subscription count, revenue-from-subscriptions, and today's/monthly attendance.
  Shop sales are left org-wide for now and called out as a known gap in a comment — many are
  walk-in purchases with no `student_id` to key off of, so there's no correct way to attribute them
  without their own branch tagging.
- `get_dashboard_stats()` (the Postgres RPC backing the "4 server-authoritative numbers" overlay in
  the same page) had the identical gap independently — it computed org-wide with no branch
  parameter at all, then **overwrote** the (now-fixed) client-side numbers with the wrong org-wide
  ones on every load. New migration `20260921_dashboard_stats_branch_scope.sql` adds an optional
  `p_branch_id text DEFAULT NULL` parameter (default reproduces the exact old org-wide behavior,
  so it's non-breaking for any other caller), filtering subscriptions/attendance through
  `students.branch_ids` the same way. `getDashboardStatsAction()` (`src/app/actions/dashboard.ts`)
  now resolves the caller's own `allowed_branch_ids` (mirroring `students.ts`'s
  `resolveOwnBranchAccess()`, since this file only supports real Supabase Auth sessions) and
  rejects a `branchId` outside it, then passes it through to the RPC.
- Neither of the two `useEffect`s in `dashboard/page.tsx` that recompute these numbers ever
  listened for `cc_branch_change` (dispatched by `StudioContext.setActiveBranch()`), so switching
  branches didn't even trigger a recompute until some unrelated event happened to fire next. Both
  now listen for it; the server-overlay effect also re-subscribes whenever `activeBranchId` changes
  so its closure always calls the RPC with the currently active branch.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing. `next lint` on the touched files: no new
  errors introduced (pre-existing `no-explicit-any` errors throughout `student-store.ts`,
  `group-store.ts`, and `dashboard/page.tsx` predate this change and are untouched).
- Known, explicitly-documented remaining gap: shop sales and expenses still aren't branch-scoped
  anywhere (client or server) — they have no student/branch attribution mechanism today. Giving
  them their own `branch_id`, stamped at creation, is the original Phase 2 roadmap item and is
  still open.
- Halls (`hall-store.ts`'s `getHalls()`) also don't branch-filter client-side yet, same gap pattern
  as groups had — not fixed here since halls aren't part of the dashboard's stat cards and weren't
  part of what was reported; worth the same treatment in a follow-up if it turns out to matter.

### Fix: 'main' branch disappeared from the switcher and Settings once a real branch existed

Immediate follow-up to the dashboard branch-scoping fix above — after creating a second branch to
test isolation, the owner got stuck: the BranchSwitcher and Settings -> Branch Management both
listed only the branches they'd explicitly created, with no entry for the branch all their
existing (pre-isolation) data actually lives on, and no way to switch back to it.

Root cause: `'main'` is the implicit default every legacy student/group/hall/staff row belongs to
(`student-store.ts`, `group-store.ts`, `server-actions-auth.ts`'s `applyBranchFilter`, the Phase 1
migration's own backfill) — but it has never been a real row in the `branches` table; it only ever
existed as `settings-store.ts`'s local `DEFAULT_SETTINGS.branches` seed (`[{id:'main', name:
'მთავარი ფილიალი', ...}]`), used purely as a placeholder before any real data loads.
`StudioContext.tsx`'s hydration merge replaces `settings.branches` outright with whatever
`state.branches` (the `branches` table) returns the moment that table has any rows at all — which
it now does, once the owner used "Add Branch" — and since `main` was never actually inserted
there, it vanished from both the switcher and the Settings list along with it. Before this
session's branch isolation work this was harmless (nothing actually filtered by branch, so which
one "looked" selected didn't matter); now that filtering is real, it silently locked the owner out
of their own `branch_id='main'` data with no UI path back.

**Fix**: new `ensureMainBranch()` helper in `StudioContext.tsx`, applied everywhere `settings.branches`
gets assigned — the initial `useState` (cold load from `loadSettings()`, which has the exact same
gap once anything's been persisted to localStorage post-hydration) and the hydration merge. Prepends
a synthetic `{id: 'main', name: 'მთავარი ფილიალი', is_active: true}` entry whenever the resolved list
doesn't already contain one, so it's always selectable, everywhere `settings.branches` is read
(BranchSwitcher, Settings' Branch Management list, and anywhere else that iterates it).

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing.
- Not something this session introduced — `main` never had a DB row before branch isolation either
  — but it went from a harmless gap to an active lockout the moment branch filtering became real,
  so it's fixed as part of the same follow-up rather than filed separately.
- Renaming/deleting the synthetic `main` entry through the existing Settings UI isn't specifically
  hardened here (Settings' Branch Management already only shows a delete button for `branch.id !==
  'main'`, so deletion was already blocked) — renaming it goes through the same `updateBranchAction`
  path as any other branch and was out of scope for this specific fix.

### Fix: another customer's studio name/logo could show up on a different org's dashboard

A customer (Fly Life Ballet) reported that logging into their own account, on their own device,
showed a completely different studio's name and logo (S_T Dance Studio) in the sidebar — while
their own actual data (students, etc.) displayed correctly. Not a data leak (the org_id/data
resolution was correct throughout), but a real, and in one case *persisted*, brand-identity bug.

Root cause: four separate places hardcoded the literal string `'S_T Dance Studio'` (one specific
real customer's own name, apparently from early development/testing against that studio) as a
generic "identity not resolved yet" fallback, meant to apply to any studio, not just that one:

- `src/contexts/StudioContext.tsx`'s hydration (`finalName` computation): if a studio's name
  hadn't resolved at that exact hydration tick (a fresh device, a slow settings-blob fetch), the
  displayed name fell back to `'S_T Dance Studio'` instead of a neutral placeholder.
- `src/components/layout/Sidebar.tsx`'s `studioDisplayName` (independently duplicated fallback,
  same pattern) and its `getInitial()` helper (defaulted a nameless studio's avatar initials to
  `'ST'`).
- **`src/app/api/sync/metadata/route.ts` (the serious one — this is server-side and writes to the
  database):** `studio_name: name === 'Studio' ? 'S_T Dance Studio' : name` and the equivalent for
  `staff_data.studioName`. Any studio whose pushed name happened to equal the generic onboarding
  placeholder `'Studio'` (e.g. before finishing setup) got `'S_T Dance Studio'` **persisted** into
  its own `studios.studio_name` / `studio_settings.staff_data.studioName` row — not a transient
  display bug, a wrong value actually written to that org's own database record, which is why it
  kept showing up on a completely fresh device/login rather than clearing on its own.

**Fix**: all four now fall back to that studio's own already-known name/state, or a neutral
`'Studio'` placeholder — never another specific customer's brand. The `route.ts` fix also now reads
the existing stored `studio_name` first, so a partial/placeholder push can no longer clobber a
name that was already correctly set.

**Not yet fully closed — needs one manual step per already-affected org**: this fix stops the bug
from firing again, but does **not** retroactively repair a `studio_name`/`staff_data.studioName`
that was already overwritten with `'S_T Dance Studio'` before this fix shipped. For Fly Life
Ballet specifically (and any other org that may have hit this), that value needs to be corrected
directly in the DB (`studios.studio_name`, `studio_settings.staff_data.studioName` for that org),
or the studio owner can simply re-type and re-save their real name in Settings once this fix is
live — either overwrites the bad stored value with the correct one going forward.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing.
- Separately reported in the same message: the Attendance button didn't work "this morning" — not
  yet investigated (no error detail given, and it may have been a transient symptom of whichever
  deploy was in progress at the time); needs its own reproduction detail before diagnosing.

### Fix: search_students() failed on every single call — "column reference "id" is ambiguous"

The owner reported /students permanently showing "NO DATA FOUND" even on the branch holding all
69 real students, with the browser console showing a genuine `500 (Internal Server Error)` on the
page's POST. Checked and ruled out, in order: browser extension interference (reproduced in
Incognito with extensions off — same 500), and a stale/unapplied branch-isolation migration
(`SELECT pronargs FROM pg_proc WHERE proname = 'search_students'` confirmed 10 — the correct,
already-migrated signature). Vercel's function logs finally gave the real error text:
`Error: column reference "id" is ambiguous`.

Root cause, and it predates this session's branch-isolation work entirely — present verbatim in
`search_students()`'s original creation migration (`20260916_search_students_rpc.sql`), carried
forward unchanged into the Phase 1 rewrite: the function declares `RETURNS TABLE (id text, ...)`,
which makes PL/pgSQL treat `id` as a variable in the function's own scope, and the function body's
very first line —
```sql
SELECT org_id INTO caller_org_id FROM public.profiles WHERE id = auth.uid();
```
— references a bare, unqualified `id`. Postgres can no longer tell whether that means the
function's own `id` output variable or `profiles.id`, so it raises the ambiguity error on
literally every invocation, before the function's logic ever runs. `get_dashboard_stats()` has
this exact same line but was never affected — its `RETURNS TABLE` has no column named `id` to
collide with, which is exactly why the dashboard's server-side numbers kept working throughout
this whole investigation while /students never did. Checked every other function with this same
line (`checkin_deduct_session`, `checkin_refund_session`, `attendance_daily_counts`,
`mark_attendance_and_deduct_session`) — none of them have an `id` output column either, so
`search_students` is the only one actually affected.

**This means /students has likely never actually worked in production** since the Server Actions
cutover (task #22) — not something this session's branch-isolation work broke.

**Fix**: qualify it as `profiles.id` — new migration `20260922_fix_search_students_ambiguous_id.sql`
(`CREATE OR REPLACE`, no signature change, no DROP needed). Also corrected the same line in
`20260921_branch_isolation_phase1.sql` in place, as a documentation/hygiene fix, so a future reader
copying that file forward doesn't reintroduce the same bug.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing (no test covers a live RPC call, so this
  specific regression wouldn't have been caught by the existing suite either way).
- Real lesson for future RPCs: never name a `RETURNS TABLE` output column `id` (or anything else
  likely to appear as a bare column reference elsewhere in the function body) without qualifying
  every reference to a same-named table column throughout the function.

### Fix: search_students() second layer — "structure of query does not match function result type"

Immediate follow-up to the ambiguous-`id` fix above: once that bug stopped short-circuiting every
call before `RETURN QUERY` ever ran, a *second*, previously-unreachable bug surfaced immediately —
same symptom (`/students` 500), different error text, confirmed again via Vercel function logs.
**This means `/students` has likely never actually returned data in production at all** — the
first bug always fired before this second one had any chance to.

Root cause: `subscriptions.expires_at` is `timestamp with time zone` in the live schema (confirmed
via `information_schema.columns`), but the function's `RETURNS TABLE` declares
`sub_expires_at date`. Every other column matched exactly (checked all of them this time, not just
skimmed) — `students.id/full_name/first_name/last_name/phone/email` are `text`, `students.data` is
`jsonb`, `subscriptions.sessions_total`/`sessions_used` are `integer`, `subscriptions.status` is
`text`.

**Fix**: new migration `20260922_fix_search_students_type_mismatch.sql` — casts `expires_at::date`
right where it's selected in the LATERAL subquery, so every downstream reference (the
active/expired comparisons, and the final `RETURN QUERY` column) consistently carries `date`,
matching the declared return type. No signature change, `CREATE OR REPLACE` in place.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 (no coverage of live RPC calls either way).
- Confirmed via the owner directly running both the diagnostic `information_schema.columns` query
  and the fix in Supabase SQL Editor, and via fresh Vercel function logs showing the error message
  itself change from the first bug's text to this one's — real evidence the first fix took effect,
  not just an assumption.
- If `/students` still doesn't return rows after this one, the next thing to check is whether this
  was really the last mismatch — re-run the diagnostic query after this migration and, if the
  error text changes again, there's a third one to chase the same way.

### Fix: Attendance button "delayed 5 seconds", session not deducted, checkmark disappears on return

The owner reported the attendance check-in button on `/attendance` was slow to mark (~5s delay),
didn't deduct a session, and lost its "already marked" state when coming back to the same class on
a later day. Reproduced the exact moment via frame-by-frame analysis of a fresh screen recording:
two different students' checkmarks flipped from unmarked to marked *simultaneously*, even though
only one was actually being clicked at that moment — ruling out a real double-marking bug. The
owner confirmed no second device/session was active during the recording, ruling out a genuine
realtime-sync coincidence too.

Root cause: `attendance/page.tsx`'s `att` state (`Record<studentId, State>`) is reset to `{}` on
every class/date switch, then repopulated asynchronously by the `loadAtt` effect, which awaits a
real `getCheckinsForDate()` Server Action round-trip before calling `setAtt(merged)`. Until that
resolves, every student's button renders as `'none'` ("+") regardless of whether they were
genuinely already checked in — this is the "5 second delay" the owner saw: not a slow click
response, but an honest data fetch that hadn't landed yet. It's not just cosmetic either: a real
tap during that window ran `toggle()`'s "mark present" branch against a student the server already
had marked, because `att[id]` still read `'none'` — explaining "session not deducted" (the second,
now-redundant `recordCheckin` call could fail or no-op depending on timing) and "checkmark
disappears on return" (the same race replaying identically every time the page is revisited).

**Fix**: added an `attReady` boolean (`false` at the top of every `loadAtt` run, `true` once the
real check-in fetch resolves — success or failure path). Both attendance buttons (the single-
student button and the couple/pair button) now render a neutral pulsing placeholder and ignore
clicks while `!attReady`, instead of confidently showing "+" for students who may already be
marked present. No DB/SQL change — this is a pure client-state fix in
`src/app/(dashboard)/attendance/page.tsx`.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing.
- No SQL migration needed for this one — unlike most fixes this session, it needs a code
  deploy (merge to `rebrendig`/`main` + Vercel redeploy) to go live, nothing to run in Supabase.

### Fix: attendance "old marks don't show" — classId matching was too brittle

Follow-up to the `attReady` fix above. The owner reported that previously-marked students still
didn't show as present even once real data had loaded (not just delayed) — a separate bug from
the loading race.

Root cause: `loadAtt()` matched a real check-in to the currently-viewed schedule slot with a single
strict comparison, `rec.classId === selectedClass`. `classId` is a *synthetic, re-computed* string
(`virtual-<groupId>` for a recurring group slot, `sub-ind-<subId>-<date>` for an individual
lesson) — not a stable identifier. It silently stops matching, and the check-in appears to vanish,
whenever: a concrete calendar event later gets created for a date that used to resolve to the
`virtual-<groupId>` fallback; an individual subscription is renewed and gets a new `subId` (its
lessons keep the old subId baked into every already-recorded classId); or date navigation lands on
a different schedule item than the one actually marked (see `getClassIdentity`'s own comment for
why that can happen). None of these change the underlying student/group — only the derived string.

**Fix**: match on the check-in's real, permanent columns first — `group_id` for group classes,
`student_id` for individual/rental lessons (unambiguous since that view only ever shows that
specific person) — falling back to the old `classId` comparison for anything else. `group_id` and
`student_id` are actual `attendance` table columns, not a recomputed string, so they can't drift
the way `classId` can.

**Known limitation, not fixed by this change**: check-ins made before this session's Sept 16
Server-Actions cutover for attendance may have only ever existed in this browser's own
`cc_attendance_archive`/`cc_checkins_<date>` localStorage, never in the real `attendance` table —
if that local cache was cleared, or the owner is now on a different device/browser, that specific
history is genuinely gone and cannot be recovered by any client-side fix. Everything written
through the current Server Actions path (this week onward) is real, durable, and this fix makes it
match reliably regardless of schedule-id churn.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing.
- Code-only, same deploy as the `attReady` fix above — no SQL needed.

### Design decision: initial-load / bootstrap architecture (CRM industry-standard pattern)

The owner separately raised: (1) Students/Attendance/Dashboard all feel slow to load, (2)
Dashboard visibly shows all-zero stats and then "jumps" to real numbers, (3) whether everything
should just be preloaded once at login instead of every page querying the database itself.

Investigated the actual mechanism behind (2) since it's concretely diagnosable: `StudioContext.tsx`
splits hydration into a fast "light" pass (settings/branches — gates `isLoaded`, which is what
unblocks page render) and a slower "heavy" background pass (students/subscriptions/etc., started
in a `setTimeout` inside `hydrate()`, finishing well after `isLoaded` already flipped true and
firing `cc_student_update`/`cc_subscription_update`/etc. when done). `dashboard/page.tsx`'s
`refreshFullDashboard()` runs immediately on mount against whatever local caches exist *right
then* — genuinely empty before the heavy pass finishes — so the "0, then jump" isn't wrong data,
it's a real, honestly-empty read shown before the real data existed locally yet, then corrected
once the heavy pass's events fire. Same family of bug as the attendance `attReady` race above, just
on the dashboard's stat tiles instead of the attendance buttons.

**This is the right split to keep** — a fast light pass + slower background heavy pass is exactly
how CRM/SaaS products (Salesforce, HubSpot, Linear, Intercom, etc.) structure their own login:
a small "bootstrap" payload (session, org/workspace settings, permissions, active-branch context)
gates the loading screen and nothing else; the rest of the app's data loads progressively, per
page, cache-first — never one big blocking fetch of "everything" at login. Preloading literally
everything at login would make login itself slower and stops scaling the moment a studio's
student/attendance history grows past a trivial size; it also doesn't remove the same problem, it
just moves it to before the loading screen instead of after.

What CRM-standard products add on top of a light/heavy split, which this app is only partially
doing yet:
1. **Never render "confirmed empty" before the first real read completes.** A `0` and "no data
   found" must be visually distinct from "still loading" — otherwise every zero is ambiguous.
   Applied this session to Dashboard's stat tiles (new `statsReady` flag, gated on the same
   `cc_student_update`/`cc_subscription_update`/`cc_data_hydrated`/`cc_sync_done` events that
   already signal the heavy pass finishing, with a 4s safety timeout) and to the two Attendance
   buttons (`attReady`, above). `/students` already does this correctly today via
   `useStudentsListQuery`'s own `isLoading` flag — it was never the zero-flash problem, its
   reported slowness was the real `search_students()` bugs fixed earlier this session.
2. **Cache-first + background revalidation ("stale-while-revalidate"), not fetch-then-render.**
   `/students` already has this for free via React Query. Dashboard and Attendance still hand-roll
   their own version of the same idea (local-store read, then a server overlay effect) without a
   shared cache layer — works, but each page reinvents it slightly differently, and slowness on
   these pages is largely this: a real network round-trip to Supabase/Vercel on every visit, with
   no shared cache to serve from while it revalidates.
3. **Real-time push invalidates cache instead of a full reload.** Already have this — the
   `cc_*_update` custom events + `realtime-sync.ts` are exactly this mechanism, just not yet wired
   through a single shared cache the way React Query gives `/students`.

**Recommendation (not built yet, tracked as its own follow-up — session task #46)**: migrate
Dashboard, Attendance, and Groups onto the same `useStudentsListQuery`-style React-Query +
Server-Action pattern `/students` already uses, rather than inventing a new caching layer. That
gets cache-first rendering, background revalidation, and pagination for all three "for free" from
a library already in the codebase, instead of hand-rolling a bespoke ready-flag per page (today's
fix is the same shape of patch, applied twice — a real shared layer means writing it once).
Separately, worth checking for missing DB indexes on the columns these pages filter/sort by most
(`org_id`, the `branch_ids` array overlap, date ranges) — a query getting slower as a studio's data
grows is a different problem than the loading-state one and needs profiling against the real
database to confirm, not guessed at from code alone.

Notes:
- No code changes beyond the `statsReady` dashboard fix (see below) — this section documents the
  investigation and the target architecture for the follow-up phase.

### Fix: Dashboard stat tiles showing 0 before heavy hydration pass completes

Companion fix to the design decision above — the one piece of it that was small, safe, and
directly actionable without a larger refactor. Added `statsReady` to `dashboard/page.tsx`: starts
`false` (unless `sessionStorage` already recorded a prior heavy-sync completion this tab session,
so in-app navigation back to `/dashboard` doesn't re-show the skeleton every time), flips to `true`
the first time any of `cc_student_update`/`cc_subscription_update`/`cc_attendance_update`/
`cc_sale_update`/`cc_data_hydrated`/`cc_sync_done` fires (or after a 4s safety timeout, mirroring
StudioContext's own 3s hydration fallback). While `!statsReady`, each of the 4 stat tiles renders a
pulsing skeleton block instead of `0` and its (also-meaningless) `+0%`/`+0` change badge.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing.
- Code-only — needs the same deploy as the two attendance fixes above, no SQL.
- Deliberately did not touch `/students` (already correct) or attempt the larger React-Query
  migration for Dashboard/Attendance/Groups described above — that's session task #46, scoped
  separately given its size and the fact it touches how 3 pages load their core data on a live
  production app.

### Fix: dashboard's Today's Groups / Calendar cards didn't update on branch switch

Owner reported the dashboard's bottom section (Today's Groups + Calendar Schedule, extracted into
`TodayGroupsCard.tsx`/`CalendarScheduleCard.tsx` since this branch last synced with `main`) kept
showing the previous branch's groups/schedule after switching branches — a branch with no events
still showed another branch's.

Root cause: `getGroups()`/`getEvents()` already read the active branch from `localStorage` at call
time (correctly branch-scoped), but both cards only re-called them on `cc_groups_update`/
`cc_calendar_events_update`/etc. — never on `cc_branch_change` itself, the event the
`BranchSwitcher` actually dispatches. Same class of bug already fixed earlier this session for the
main dashboard stats effect; recurred here because these two cards are new (added directly on
`main` by the other collaborator since this branch's last sync) and didn't carry that fix forward.

**Fix**: added `cc_branch_change` to both cards' event listener lists, so switching branches
reloads them immediately instead of waiting for an unrelated edit to happen to trigger a refresh.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing.
- This branch was 32 commits behind `main` (SMS module rebuild, unified auth, permissions/RBAC,
  the dashboard's Today's Groups/Calendar redesign, etc. — all merged directly to `main` by the
  other collaborator without going through this branch). Fast-forward merged `origin/main` into
  this branch before making this fix, specifically so this fix — and anything else from here on —
  targets the actual current dashboard code instead of a stale copy that would conflict with or
  regress that other work on the next merge.

### Feature: merged, collapsible "Needs Attention" panel + app-wide quick-access button + notification

Owner asked for three related things after the branch-refresh fix above: (1) merge the dashboard's
separate "Needs Attention" strip and "Birthday Today" banner into one collapsible panel instead of
two always-visible blocks, (2) a persistent button in the left sidebar (available on every page,
not just the dashboard) that opens a popup with the same information, and (3) the same information
surfacing in the notification bell — explicitly not as an emoji, using an icon consistent with the
app's own (lucide-react) icon set.

**Shared computation** (`src/lib/needs-attention.ts`, new): extracted the debt/expiring-soon/
one-session-left/pending-bookings/birthday computation that used to live only inline in
`dashboard/page.tsx`'s `refreshFullDashboard()` into `computeNeedsAttention()` (takes the
already-branch/role-scoped student & subscription lists dashboard has on hand) and
`getNeedsAttentionSummary()` (a self-contained variant that fetches those itself, for callers like
the sidebar that don't have dashboard's precomputed context). `dashboard/page.tsx` now calls the
shared function instead of duplicating the logic — the dashboard panel, the sidebar button, and
the notification below are guaranteed to agree on the same numbers instead of three independent
copies that could drift.

**Dashboard**: the two separate sections are now one card with a header (icon + title + total
count badge + chevron) that toggles a collapsed/expanded body holding both the needs-attention
pills and the birthday row. Collapse state persists per-browser via `localStorage`
(`cc_dashboard_attention_collapsed`), defaulting to expanded.

**Sidebar** (`src/components/layout/Sidebar.tsx`, new `NeedsAttentionButton` component): a button
above the regular nav sections — not a page link — showing a `ShieldAlert` icon (the icon already
used for this concept everywhere else in the app) plus a red count badge, refreshing on
`cc_branch_change`/`cc_student_update`/`cc_subscription_update`/`cc_calendar_events_update`/
`cc_data_hydrated`. Clicking it opens a popup listing each category (debt, expiring soon, one
session left, pending bookings, today's birthdays) with lucide icons per row, no emoji.

**Notification** (`src/components/layout/Header.tsx`): once per calendar day per studio (deduped
via a `getScopedKey`'d localStorage flag, same pattern the existing broadcast-notification check
already uses), if `getNeedsAttentionSummary()` has anything, pushes one notification summarizing
all of it (including birthday names) into the existing bell/notification-store system. The
notification list only ever renders a colored dot per item (no icon slot), so "no emoji" is
satisfied by keeping the notification text itself plain — the dot color used is `bg-rose-400` to
match the sidebar/dashboard's rose accent for this concept.

**Also fixed while in this code**: the dashboard's stat-tile `statsReady` skeleton-loading fix from
earlier this session had been silently orphaned by the Today's Groups/Calendar redesign merged
directly to `main` — the state variable still updated correctly, but nothing in the new
`DonutCard`-based stat tiles read it anymore (caught by `next lint`'s `no-unused-vars` flagging
`statsReady` as unused, which is what surfaced it). Added a `loading` prop to `DonutCard`,
wired `loading={!statsReady}` at all 4 call sites — each ring/number now shows a pulsing skeleton
instead of a real "0" until the heavy hydration pass actually has data, same as originally intended.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing. `next lint` on touched files shows only
  pre-existing warnings/errors from before this session's changes (unused `ChevronLeft`/
  `ShoppingBag` imports, `revenueRange`/`liveActivity`/`allEvents` state, scattered `any` types
  from the Today's Groups/Calendar redesign) — none introduced by this change, left alone rather
  than scope-creeping into cleanup of code this branch doesn't own the redesign of.
- Code-only, same deploy path as the other fixes above (merge to `main`/`rebrendig` + Vercel
  redeploy) — no SQL migration.

### Fix: Staff & Access edit modal (Settings) silently failed to save any change

Owner reported that editing a staff member in Settings → Staff & Access (role, feature
permissions, anything) didn't persist — the modal appeared to work but nothing changed after
reopening it.

Root cause: this modal's password field (`src/app/(dashboard)/settings/page.tsx`) was initialized
from the staff member's real, already-stored password (`setEditingStaffData(JSON.parse(...member))`,
no override) and bound directly to it (`value={member.password || ''}`). Every save — regardless
of what was actually being changed — sent that same old password value back to
`updateStaffAction`, which unconditionally runs `assertPasswordPolicy(input.password)` whenever
`password` is present at all. Any staff member whose password predates the current policy (e.g.
`12345678` — no uppercase, no special char, visible in the owner's own screenshot) has every
single edit rejected with a thrown "Password does not meet the minimum requirements" error, which
rolls back the whole update — role and permission changes included, not just the password. The
error was surfaced via `addNotification` inside `updateStaff()`, but easy to miss, so it looked
like the save just silently did nothing.

`src/components/staff/TeacherModal.tsx` already gets this right (blank password field on open,
stripped from the payload entirely when left blank) — this Settings-page modal is a separate,
parallel implementation of the same edit UI that never got the same fix.

**Fix**: initialize this modal's `editingStaffData.password` to `''` instead of the real stored
value, and strip the `password` key from the save payload entirely when left blank (an omitted key
and an explicit empty string aren't the same to `updateStaffAction` — the latter would still count
as "a password was supplied" and, for a legacy non-Supabase-Auth staff row, null out the stored
password hash). Only a password the admin actually types in this session is ever sent now.

**Found but not fixed here** (spawned as its own follow-up task — touches auth/security code that
deserves its own focused pass): `updateStaffAction` can still write a staff member's *new*
password into the `staff.data` JSONB column as plaintext when that row is linked to a real
Supabase Auth account (`data.authType === 'supabase'`) — the hash only overwrites `data.password`
in the branch for legacy, non-Supabase-Auth rows. Unrelated to today's bug (which happened
regardless of whether a new password was ever typed), but a real exposure if an admin changes a
Supabase-Auth-linked staff member's password.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing.
- Code-only — needs the same merge + Vercel redeploy as everything else this session, no SQL.

### Follow-up: inline password-policy validation in the Staff & Access edit modal

After the fix above deployed, the owner tried the modal again and hit the same server-side
"Password does not meet the minimum requirements" rejection — this time because they'd actually
typed a new, weak password, not because the old one was being resent. The modal has never had
any client-side password check, so the request went all the way to the server, which rejected it
with a bare 500 — and Next.js redacts a Server Action's real thrown message in production, so all
that reached the browser was an unhelpful generic failure with no indication of what to fix. The
owner asked, reasonably, why the app doesn't just say "enter a stronger password".

**Fix**: wired `validatePasswordPolicy`/`passwordPolicyMessage` (`src/lib/password-policy.ts` —
already used by registration, reset-password, and the staff-invite flow, just never plugged into
this specific modal) into the Staff & Access edit modal. While the typed password doesn't meet the
policy, the exact unmet requirement shows inline in red under the field (not the generic hint), and
the Save button disables — the request never goes out at all until the password is valid, matching
what the owner asked for.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing.
- Code-only, same deploy path.

### Fix: staff.first_name/last_name were never real columns — updateStaffAction always failed

After the two fixes above deployed, saving a staff edit hit a NEW error: `Could not find the
'first_name' column of 'staff' in the schema cache`. First suspected a stale PostgREST schema
cache (the owner ran `NOTIFY pgrst, 'reload schema';` — harmless, worth trying first, but didn't
fix it). Confirmed with `SELECT column_name FROM information_schema.columns WHERE table_name =
'staff' AND column_name = 'first_name'` returning 0 rows: the column genuinely never existed.

`src/app/actions/staff.ts`'s own header comment asserts `first_name`/`last_name` are real top-level
columns on `staff`, "confirmed by settings-store.ts's existing syncRecordToCloud('staff', ...)
payload shape" — i.e. inferred from the shape of the CLIENT's sync payload, never actually checked
against the live table. `staff` predates this repo's migrations folder (no `CREATE TABLE` for it
exists anywhere in migration history — `20260918_staff_write_rls.sql` flagged the same gap for a
different reason), so this was never verifiable by reading the repo. Every real staff row was
created through the older client-side path (`settings-store.ts` → `syncRecordToCloud`), which only
ever wrote `first_name`/`last_name` into the `data` JSONB blob — meaning `createStaffAction`'s own
insert (which references the same nonexistent columns) has likely never actually succeeded either,
for any staff member created since that Server Action existed.

**Fix**: new migration `20260923_staff_add_first_last_name_columns.sql` — `ALTER TABLE staff ADD
COLUMN IF NOT EXISTS first_name/last_name text`, backfilled from `data->>'first_name'`/
`data->>'last_name'` for existing rows (so staff created before this migration don't show blank
names now that `updateStaffAction`'s `.update()` actually reads/writes the real columns), plus a
schema-cache reload for good measure.

Notes:
- Pure SQL — no code change, no `tsc`/`vitest` run needed. Owner runs this directly in Supabase
  SQL Editor; no separate code deploy required for this one.
- Worth re-checking after this lands whether `createStaffAction` (staff CREATE, not just UPDATE)
  now actually persists correctly too, since it hits the same previously-missing columns.

### Fix: staff table was missing FOUR MORE columns (password, salary_percentage, rate_per_hour, rate_per_month)

The first_name/last_name fix above turned out to be one column pair out of several — after it
deployed, saving a staff edit hit a *new* PostgREST error, `Could not find the 'password' column of
'staff' in the schema cache`, for the exact same reason. Rather than keep discovering these one at
a time (each fix only gets far enough into `updateStaffAction`'s `.update()` to reveal the *next*
missing column), had the owner run the actual ground truth query —
`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'staff'` — which
returned all 12 real columns `staff` actually has: `id, org_id, full_name, first_name, last_name,
email, phone, role, allowed_branch_ids, data, permissions, created_at`.

Comparing that against every column `staff.ts` references as a real top-level field:
`password`, `salary_percentage`, `rate_per_hour`, and `rate_per_month` are ALSO missing — meaning
`createStaffAction`/`updateStaffAction` have likely never successfully written any of these four
fields as real columns for any staff member, ever (they landed in `data` only, via the older
client-side sync path, same as first_name/last_name did).

Also surfaced in that column list, not acted on: `permissions` already exists as its own real
`jsonb` column — nothing in `staff.ts` reads or writes it directly today (permissions only ever
live inside `data.permissions`). Left alone; flagging for whoever eventually reconciles the two.

**Fix**: new migration `20260923_staff_add_remaining_missing_columns.sql` — adds all four missing
columns (`password text`, the three rate fields `numeric`), backfilled from the `data` JSONB blob
for existing rows. The numeric backfill guards each cast behind a regex check first (`data` is a
long-accumulated, hand-written client blob — a single row with an empty string or other
non-numeric junk in one of these fields would otherwise abort the whole `UPDATE` on a bare
`::numeric` cast failure).

Notes:
- Pure SQL, no code change. Same as before — no separate code deploy needed for this one.
- If yet another "Could not find the 'X' column" error surfaces after this, the same
  `information_schema.columns` query is the fastest way to get the complete picture again, rather
  than fixing them one report at a time.

### Fix: updateStaffAction rejected null values for fields the migrations just made real columns

Immediately after the migration above landed, saving a staff edit failed again — this time with a
`ZodError` thrown before the request even reached the database (visible in Vercel logs as a plain
`ZodError: [...]` with no SQL/PostgREST error at all, unlike every fix before this one).

Root cause: `updateStaffAction`'s Zod schema declared `full_name`, `first_name`, `last_name`,
`email`, `phone`, `salary_percentage`, `rate_per_hour`, `rate_per_month`, `password`, and
`allowedBranchIds` as `.optional()` only. `.optional()` in Zod accepts `undefined` but rejects
`null`. The Settings edit modal's form state (`member`) is deep-cloned straight from the real
staff row — and now that `first_name`/`last_name`/`password`/`salary_percentage`/`rate_per_hour`/
`rate_per_month` are real DB columns (the two migrations above), any staff row that never had one
of these set carries a genuine SQL `NULL` for it, which becomes JS `null` once read back — and
resending that unchanged `null` on save failed schema validation outright, blocking the entire
edit again, one layer earlier than the previous two bugs.

**Fix**: added `.nullable()` to all of the fields above in `staff.ts`'s `staffSchema`, and widened
`resolveFullName`/`assertPasswordPolicy`/`assertCanGrantBranches`'s parameter types to accept
`| null` accordingly. `null` for any of these fields is a legitimate "not set" value now that
they're real columns — this isn't loosening validation, it's correcting a mismatch between what
the schema expected and what the data actually looks like now.

Notes:
- `tsc --noEmit`: clean. `npx vitest run`: 15/15 passing.
- Code-only — needs the usual merge + Vercel redeploy, no further SQL.
- This is the third layer of the same underlying issue (columns the code always assumed were real
  and non-null, discovered one report at a time): missing columns (×2 migrations) → now, a schema
  that never accounted for those columns being legitimately empty on existing rows. Worth a closer
  look at whether `createStaffAction`'s insert has the same null-handling gaps, since it references
  the identical fields.

### Security audit: Supabase advisor findings after MCP access connected

Owner connected Supabase MCP access and asked for a general health check (`get_advisors`, both
`security` and `performance` types) against project `pkmofhsbdwulczligyvl`.

**Fixed and verified this pass:**
- **RLS completely disabled on 7 public tables** (ERROR-level finding) — `profiles`,
  `registration_otps`, `promo_codes`, `attendance_records`, `inventory_products`,
  `student_subscriptions`, `studios`. Any request with the anon/publishable key could read (and in
  most cases write) every row in these tables, bypassing all org-scoping entirely. Fixed 6 of 7 via
  migration `20260923_enable_rls_gap_fill_round2.sql` (applied live via
  `mcp__Supabase__apply_migration`, now also committed to the repo for history): `profiles` gets a
  self-only SELECT policy; `registration_otps`/`promo_codes` get RLS enabled with zero policies
  (deny-by-default, matching how they're actually used — service-role only, no client code path
  touches them); `attendance_records`/`inventory_products`/`student_subscriptions` get full
  org-scoped SELECT/INSERT/UPDATE/DELETE policies matching the pattern already used elsewhere in
  this repo. Re-ran `get_advisors(security)` afterward — RLS-disabled count dropped from 7 tables to
  1, confirming the fix. `studios` deliberately left disabled: `StudioContext.tsx`'s browser-side
  "Nuclear Discovery" fallback reads it directly with the anon key under a staff-token session
  (no `auth.uid()`), so a naive org-scoped policy would break staff-token login's org-id
  resolution. Real fix needs that lookup moved behind a Server Action first — not done in this pass.
- **3 functions with mutable `search_path`** (`_safe_numeric`, two overloads of `_sub_in_month`) —
  fixed via `20260923_fix_function_search_path_mutable.sql` (`ALTER FUNCTION ... SET search_path =
  public`), pure hardening, zero behavior change. Re-ran advisor — this finding is now gone.

**Found, not fixed this pass (reported to owner as follow-ups):**
- **7 `SECURITY DEFINER` functions callable directly via PostgREST RPC by `anon`/`authenticated`**
  (`attendance_daily_counts`, `checkin_deduct_session`, `checkin_refund_session`,
  `expire_overdue_subscriptions`, `get_dashboard_stats`, `mark_attendance_and_deduct_session`,
  `search_students`). Lower priority: each internally resolves `auth.uid() -> profiles.org_id` and
  throws if there's no match, so an anon/unauthenticated RPC call should fail inside the function —
  but advisor still flags it as bad practice (better to `REVOKE EXECUTE FROM anon` explicitly where
  not intentional).
- **`auth_leaked_password_protection` disabled** — Supabase Auth's HaveIBeenPwned check is off. This
  is an Auth *setting*, not a SQL migration; needs the Supabase dashboard (Authentication → Policies)
  or the Management API, not `apply_migration`.
- **`auth_rls_initplan` (performance, 75 occurrences)** — RLS policies across nearly every table
  (`students`, `groups`, `branches`, `halls`, `studio_settings`, `attendance`, `sales`, `expenses`,
  `trash`, `calendar_events`, `subscription_plans`, `products`, `subscriptions`, `staff`,
  `permission_locks`, `staff_invites`, `sms_categories`, `sms_templates`, `sms_audit_log`,
  `sms_logs`) call `auth.<fn>()` directly in their `USING`/`WITH CHECK` clauses instead of
  `(select auth.<fn>())`, forcing Postgres to re-evaluate the auth call per-row instead of once per
  query. Real, previously-undiscovered, systemic performance issue directly relevant to this
  session's earlier "why is everything slow" investigation — significant enough in scope (75
  policies) to warrant its own dedicated pass rather than a quick fix here.
- **6 unused indexes**, all on SMS-related tables (`sms_templates_org_idx`,
  `sms_templates_category_idx`, `sms_audit_log_org_idx`, `sms_logs_template_idx`,
  `sms_logs_org_timestamp_idx`, `sms_logs_org_id_idx`) — low priority, dropping them is safe but not
  urgent.
- Auth DB connections not configured as percentage-based — minor operational tuning, not acted on.

Notes:
- Both migrations were applied directly to production via MCP before being written to this repo;
  they're now committed for history consistency with every other migration in this session.
- No code changes needed for the fixed items — pure DB-side hardening, nothing for Vercel to
  redeploy.

### Full DB audit: 100% table/column/policy pass, fixed the 75-occurrence RLS performance issue

Owner asked for a complete, no-stone-unturned pass over the live database (all tables, columns,
constraints, policies) — separate from and beyond the earlier security-advisor pass above.

**Cross-checked every `.from('table')` call in `src/` against `information_schema.columns`** —
all 27 tables the code references exist, all columns the code writes/reads exist as real columns
(no repeat of the `staff` missing-column issue found anywhere else). Confirmed clean.

**Found: 3 orphaned tables never referenced anywhere in `src/`** — `attendance_records`,
`inventory_products`, `student_subscriptions`. These come from `supabase/master_schema.sql`, an
unused normalized schema that predates (and was superseded by) the live `id + org_id + data jsonb`
pattern every real table actually uses. The app reads/writes `attendance`, `products`, and
`subscriptions` instead — the "_records"/"inventory_"/"student_" variants are dead weight with
0 rows each. Not deleted this pass (destructive, and out of scope for an audit) — flagged for the
owner to decide whether to drop them later.

**Found: essentially zero foreign-key constraints in the schema** — only `sms_logs.template_id ->
sms_templates.id` and `sms_templates.category_id -> sms_categories.id` are real FKs; every other
cross-table reference (`students.id` referenced from `subscriptions.student_id`/`attendance.
student_id`/`sales.student_id`, `groups.id` from `calendar_events.group_id`, `staff.id` from
`groups.coach_id`, etc.) is a plain unconstrained column. This matches the app's client-generated
text-ID architecture (IDs are assigned client-side, not by the DB), so it's likely intentional
rather than a bug — but it does mean the database itself will never catch an orphaned reference
(e.g. a subscription left pointing at a deleted student's old id); that integrity is entirely up
to the Server Actions layer. Flagged, not changed — adding FKs retroactively risks failing on
existing orphaned data and would need its own careful pass.

**Fixed: `auth_rls_initplan` performance issue, all 75 occurrences.** Every org-scoped RLS policy
across 20 tables (`students`, `groups`, `branches`, `halls`, `studio_settings`, `attendance`,
`sales`, `expenses`, `trash`, `calendar_events`, `subscription_plans`, `products`, `subscriptions`,
`staff`, `permission_locks`, `staff_invites`, `sms_categories`, `sms_templates`, `sms_audit_log`,
`sms_logs`) used the exact same shape: `org_id IN (SELECT org_id FROM profiles WHERE id =
auth.uid())`. Calling `auth.uid()` bare like this forces Postgres to re-evaluate it once per row
scanned instead of once per query — a real, previously-undiscovered, systemic performance cost on
every single org-scoped read in the app, directly relevant to this session's long-running "why is
everything slow" thread. Fixed via `20260923_fix_auth_rls_initplan_perf.sql`: dropped and recreated
all 75 policy clauses with `auth.uid()` wrapped as `(select auth.uid())`, which Postgres can plan
as a one-time stable subplan. Same access-control semantics, zero behavior change, pure query-plan
win. Verified via direct `pg_policies` query afterward — zero policies left with the unwrapped
pattern.

Notes:
- This migration is large (75 policy clauses) but entirely mechanical/uniform — every table
  followed the identical `org_id IN (SELECT ... WHERE id = auth.uid())` shape, so it was safe to
  script as one pass rather than reviewing each table's policy individually.
- Like the earlier RLS-gap migration, this was applied directly to production via
  `mcp__Supabase__apply_migration` and is now also committed to the repo
  (`supabase/migrations/20260923_fix_auth_rls_initplan_perf.sql`) for history consistency.
- No code changes, no Vercel redeploy needed — DB-side only.
- Remaining lower-priority items from the advisor, still not acted on: `auth_leaked_password_
  protection` (an Auth dashboard setting, not a migration), the 7 anon-callable `SECURITY DEFINER`
  RPCs (low risk — each internally checks `auth.uid()`/`org_id` and rejects unauthenticated calls),
  6 unused SMS-table indexes, and Auth DB connections not being percentage-based.

### Closed out the remaining low-priority advisor items + added missing FKs

Owner asked to finish everything still open from the audit above rather than leave it as "low
priority, not acted on."

- **Revoked `anon` EXECUTE on the 7 SECURITY DEFINER RPCs** (`attendance_daily_counts`,
  `checkin_deduct_session`, `checkin_refund_session`, `expire_overdue_subscriptions`,
  `get_dashboard_stats`, `mark_attendance_and_deduct_session`, `search_students`). Confirmed via
  grep that every real call site goes through a Server Action using either a real authenticated
  session or the service-role client — never the anon key — so this closes an unused door with
  zero effect on the app. `authenticated` keeps EXECUTE (the real-auth Server Action path needs it).
- **Dropped the 6 unused SMS-table indexes** (`sms_templates_org_idx`,
  `sms_templates_category_idx`, `sms_audit_log_org_idx`, `sms_logs_template_idx`,
  `sms_logs_org_timestamp_idx`, `sms_logs_org_id_idx`).
- **`auth_leaked_password_protection`**: could NOT fix this one directly — it's a Supabase Auth
  dashboard toggle (Authentication → Sign In / Providers → Password), not something reachable via
  SQL migration or any MCP tool available in this session. Left for the owner to flip manually.
- **Added missing foreign keys, and in doing so found a real live bug**: checked every
  entity-reference column in the schema for orphaned rows before adding any constraint. Found:
  **13 `subscriptions` rows and 5 `attendance` rows already point at student ids that don't exist
  anymore** — root cause confirmed in `src/app/actions/students.ts`'s `deleteStudentAction`: it
  hard-deletes the `students` row (`.from('students').delete()`) but never cleans up that
  student's subscriptions or attendance history, so they're left as permanent dangling zombie
  rows. Also found several of those `subscriptions.student_id` values are literally two student
  ids joined with a comma (e.g. `"MU7698233, EA8819242"`) — looks like couple/pair subscriptions
  were stuffed into a single-student text column instead of a proper two-student design, which is
  also why they could never have matched a real student id even before either student was
  deleted. One `subscription_plans` row also had `group_id = ''` (empty string) instead of `NULL`
  for a group-less "One Time" plan — corrected as part of this migration.
  - Added FKs with `ON DELETE SET NULL` (never blocks or cascades — the referencing row survives,
    just with the dangling pointer cleared) for: `attendance.student_id`/`attendance.group_id`,
    `sales.student_id`, `calendar_events.group_id`/`calendar_events.hall_id`, `groups.coach_id`,
    `subscriptions.student_id`/`subscriptions.plan_id`, `subscription_plans.group_id`. The two
    columns with pre-existing orphans (`attendance.student_id`, `subscriptions.student_id`) were
    added as `NOT VALID` so the migration doesn't touch or fail on that existing bad data — new
    writes are enforced immediately, the old orphaned rows are simply left as they were.
  - **Deliberately did NOT add `org_id -> studios.org_id` FKs** across the ~20 tables that have
    one, even though those columns are otherwise clean (0 orphans, confirmed by checking every
    single one). Reason: `src/app/api/superadmin/delete-studio/route.ts` deletes a `studios` row
    without cleaning up any of that studio's own data first — a default FK there would start
    rejecting that route's deletes outright. This needs an explicit decision from the owner
    (clean up children first vs. `ON DELETE CASCADE` vs. leave the current silent-ghost-data
    behavior as-is) rather than a decision made silently inside an unrelated DB-hardening pass.
  - The 18 already-orphaned rows (13 subscriptions + 5 attendance) were left untouched — they're
    old zombie data, not actively breaking anything, but the owner may want them cleaned up
    (nulled or deleted) at some point; not done here since deciding that is a data decision, not
    a schema one.

Notes:
- All of the above applied directly to production via `mcp__Supabase__apply_migration`, then
  written into the repo (`20260923_revoke_anon_rpc_and_drop_unused_indexes.sql`,
  `20260923_add_safe_entity_foreign_keys.sql`) for history consistency.
- The couple/pair-subscription comma-joined-student-id pattern is worth a closer look on its own —
  it means any code that does `subscriptions.student_id === someId` for those rows already
  silently fails to match either student. Not investigated further in this pass; flagged here for
  whoever picks up couple-subscription work next.

### Billing page: stop faking payment activation; Tariffs page: fix dual-highlight + failed load

Owner asked to (1) make the ClassCore SaaS billing page (`/billing`) honest about how payment
actually works today, and (2) fix a bug where the sidebar highlights both "Subscriptions" and
"Tariffs" at once and the Tariffs page (`/subscriptions/plans`) sometimes doesn't load its data.

**Billing page (`src/app/(dashboard)/billing/page.tsx`)** — this was flagged earlier in the
session's feature audit as the single most serious "completely non-functional" finding: clicking
"Proceed to Payment" for *either* Credit Card or Bank Transfer instantly called `recordPayment()`
(which only writes to `localStorage`) and showed "Thank you! Payment received." — no real gateway
is integrated, so anyone could "extend" their subscription for free by clicking through, and Card
was never real at all.
- Removed the fake "Credit Card / Instant Activation" method entirely — only Bank Transfer
  remains, since that's the one real channel today.
- `handleProceed` no longer calls `recordPayment()` or shows a fake success alert. It now shows an
  honest confirmation screen: transfer the amount with your Cabinet Code as the payment reference,
  and a ClassCore admin will verify it and activate the plan. This matches how confirmation
  actually works today — the SuperAdmin studios list already displays every studio's Cabinet Code,
  and the admin already has a working "set plan" control there to activate a studio once they see
  a matching transfer in their bank statement. No new pending-request infrastructure was needed;
  the existing manual code-lookup + plan-assignment path already covers this exactly as the owner
  described ("only the bank code needs confirming").
- Renamed the `billingProceed` i18n string (ka/ru/en) from "Go to Payment" to "Confirm Transfer"
  to match what the button now actually does.

**Sidebar dual-highlight (`src/components/layout/Sidebar.tsx`)** — `/subscriptions/plans` is a
sub-route of `/subscriptions`, and the active-link check was a plain prefix test
(`pathname === href || pathname.startsWith(href + '/')`) applied independently per nav item, so
visiting Tariffs matched both its own item AND its parent Subscriptions item, lighting up both.
Fixed by computing the single longest-matching href across the whole nav once (`bestMatchHref`)
and marking only that one item active — the generically correct fix for this exact
prefix-collision class of bug, not just a special case for these two routes.

**Tariffs page not loading (`src/app/actions/plans.ts`)** — root cause: this file's own
`requireOrgId()` helper called `supabase.auth.getUser()` only, with no fallback for staff-token
sessions (the signed `cc_staff_token` cookie used when there's no real Supabase Auth session —
see `src/lib/server-actions-auth.ts`'s dual-auth doc comment). Every other migrated module
(students, groups, staff, subscriptions, halls, etc.) was already switched to the shared
`requireOrgIdDualAuth()` helper earlier in this project's Server Actions migration specifically to
fix this class of bug — `plans.ts` was simply missed. For any session authenticated via the
staff-token path (which is common — it's the fallback used whenever there's no live Supabase Auth
session), `getPlansAction()`/`savePlansAction()`/`deletePlanAction()` all threw `'Not
authenticated'` immediately, caught silently by the page's `.catch(console.error)`, leaving the
Tariffs list empty with no visible error. Fixed by switching all three actions to
`requireOrgIdDualAuth()`, matching the rest of the codebase.

Notes:
- `tsc --noEmit`: clean. `next lint` on all touched files: no new warnings (pre-existing
  `no-explicit-any` findings elsewhere in `Sidebar.tsx` predate this change).
- No DB/migration changes needed for any of these three fixes — all code-only.

### Calendar: center "now" in the auto-scroll, add click-and-drag time-range selection

Owner flagged that the calendar always opens with mostly-empty hours in view, needing a manual
scroll to reach the actual scheduled classes, and asked (a) for the current-time auto-scroll to
land in the middle of the visible viewport (some past, some upcoming, at a glance) instead of near
the top, and (b) for clicking-and-dragging on an empty grid cell to visually select a time range
(Google-Calendar-style highlighted selection box) and open the same "Add" flow already used
elsewhere, with both the start and end time pre-filled from the drag.

**Centering fix** (`src/app/(dashboard)/calendar/page.tsx`'s `scrollToCurrent` effect): the scroll
target was `offsetMins-based position minus a fixed 100px`, which put "now" near the top of the
viewport. Changed to subtract half of the grid container's actual `clientHeight` instead, so "now"
lands in the vertical center of whatever's currently visible.

**Click-and-drag time-range selection**: the grid already had click-to-add (a single click opened
`AddEventModal` with that time as the start, hardcoded to a 1-hour block) — this pass adds a
proper drag interadction on top of it, mirroring the coordinate math (18px per 15 minutes) already
used by the existing drag-to-move-an-event handlers (`startDrag`/`handleDragStart`) rather than
reinventing it:
- New `handleSelectMouseDown` (mousedown on `GridLines`, global `mousemove`/`mouseup` while
  dragging, same idiom as the existing event-drag code) tracks the drag range and calls
  `setAddDate`/`setAddTime`/the new `setAddEndTime` on release.
- `GridLines` now renders a live highlighted selection box (`selection` prop) while dragging, in
  the same purple as the rest of the calendar's accent color — the "same kind of highlight
  Google Calendar has" the owner asked for.
- A plain click with no real drag (movement under ~18px, i.e. less than one 15-minute row) still
  falls back to the original single-click behavior (1-hour block at that time), so quick single
  clicks keep working exactly as before.
- `AddEventModal` gained an optional `defaultEndTime` prop, used for both the plain form and the
  per-day recurring-time defaults, instead of always deriving end time as start+1h.
- No new "Add Group" flow was built — `AddEventModal` already supports picking `group_class` as
  the event type and creating a brand-new group inline (`isNewGroup`/`newGroupName`), which is
  exactly the "same process as adding a group elsewhere, just with the time pre-picked" the owner
  asked for; this pass only had to make sure both ends of that time range come from the drag.

Notes:
- `tsc --noEmit`: clean. `next lint`: no new findings (this file's large pre-existing
  `no-explicit-any` list is untouched by these changes).
- Could not visually test this one in a browser in this sandbox: `/calendar` sits behind the
  dashboard's auth middleware and redirects to `/login` with no real Supabase session available
  here. The logic is a close mirror of the already-proven drag-to-move-event code in the same
  file, but this is worth a real click-through on production before considering it fully verified.
- Desktop-only for the drag gesture (mouse events only, matching this file's existing
  proven-safe touch-drag approach for moving events, which uses a long-press timer to avoid
  fighting with scroll — wiring the same for a brand-new selection gesture on mobile was left out
  of this pass to avoid conflicting with normal touch-scrolling on the grid). Mobile taps still
  fall back to the single-click 1-hour-block behavior.

### Calendar follow-up: scroll to the nearest real event, not literal "now"; clean up the toolbar

Owner reported (with screenshots from production, after the above landed) that the auto-scroll
still opened on a mostly-empty view, and separately that the toolbar row above the grid (hall
filters, teacher filters, PDF/Add buttons) looked cluttered and needed a visual cleanup.

**Auto-scroll root cause**: centering on the literal clock time (the previous fix) breaks down
whenever "now" is close to `START_HOUR` (8am) — there isn't enough grid *above* "now" to fill half
the viewport, so the browser clamps scroll to 0 and the view looks exactly like it did before any
centering existed: starting near the top, mostly empty, until you scroll down to where the actual
classes are in the afternoon/evening. Centering the literal clock time was the wrong target from
the start for a studio whose real activity clusters hours later in the day.

**Fix**: the effect (`src/app/(dashboard)/calendar/page.tsx`'s auto-scroll useEffect) now centers
on the event nearest to "now" among today's events, falling back to the literal clock time only
when today has nothing scheduled at all. Also added a real "is today even visible" guard (day view
must be showing today; week view must include today) — the previous version's only check was
"is the clock time within the displayed hour range," which doesn't actually mean today is on
screen. This is exactly the "only show me the part with active lessons" request from earlier in
this thread, done properly this time instead of the literal-now approximation.

**Toolbar cleanup**: the Hall filter pills and Teacher filter pills previously sat in two separate
bordered boxes at `h-7`/`h-8` with 7–9px text, visually mismatched against the `h-11` view-switcher
and date-nav pills above them and the `h-11` PDF/Add buttons beside them — a real "several
differently-sized floating boxes" look, which is what read as cluttered. Merged both filter groups
into one shared panel (a single background/border), unified every filter pill to `h-9` with legible
`10px` text, and added a thin vertical divider between the hall and teacher groups instead of a
gap between two separate boxes — reads as one coherent toolbar now instead of four.

Notes:
- `tsc --noEmit`: clean. `next lint`: one new (expected, harmless) `exhaustive-deps` warning for
  omitting `dayEvents` from the effect's dependency array — `dayEvents` is redefined fresh every
  render and only reads from `filtered` (already a real dependency), so including it would just
  make the effect re-run on every render for no reason; this file already has several other
  effects following the same accepted pattern.
- Same caveat as the previous entry: could not click-test this in a live logged-in session in this
  sandbox (`/calendar` is behind auth middleware, no real Supabase session available here) —
  needs a real look on production.

### Calendar: fix the broken nav date field (was showing raw "dd.mm.yyyy" placeholder text)

Owner pointed at the date field in the calendar's top nav (`< today [date] >`) — production
screenshots showed it literally rendering the placeholder pattern `dd.mm.yyyy` instead of the real
date, unreadable, and "something in the way" of clicking it.

Root cause: that field used `StandardDatePicker` (a wrapper around a native `<input type="date">`)
with a pile of `!important` Tailwind overrides (`[&_input]:!p-0 [&_input]:!h-auto
[&_input]:!w-24 ...`) to force it into an ultra-compact 24-char-wide slot in the nav bar. A native
date input's displayed text is rendered entirely by the browser/OS itself based on locale — it is
not stylable via CSS, and squeezing its internal width down to `w-24` with zero padding made
Chrome unable to render the actual formatted value, falling back to showing only its empty-state
placeholder pattern (`dd.mm.yyyy`) instead.

**Fix**: replaced it with a small purpose-built widget instead of fighting the native input's
rendering: a plain, fully custom-styled `<span>` displays the date as static text
(`24.09.2026`, numeric, matching this app's existing date convention), with a native
`<input type="date">` absolutely positioned on top at `opacity-0` handling the actual click-to-open
picker interaction. Since the visible label is now ordinary HTML/CSS instead of a native input's
own internal rendering, none of the previous clipping/placeholder issues can happen — the browser's
date-picker dropdown itself still opens exactly as before (that part was never broken, only the
*display* of the current value was). `StandardDatePicker`'s import was removed from this file since
this was its only use here (the component itself is untouched, other pages still use it normally).

Notes:
- `tsc --noEmit` and `next lint`: clean, no new findings.
- Verified the visible label renders correctly (no clipping/placeholder-only rendering) in an
  isolated static-HTML mockup of the same markup, since `/calendar` itself is behind auth in this
  sandbox. Still worth a real look on production once deployed.

---

### Tariffs: fix group-type tariffs silently vanishing from the "ჯგუფური" tab

Owner reported (twice, with production screenshots) that the Tariffs page shows nothing under
the first tab, even after the earlier `plans.ts` dual-auth fix was confirmed live. Checked Vercel
deployment history (fix was live) and the DB directly (the studio's plans exist, correctly
org-scoped) — this was not a deploy or caching issue at all.

Root cause: `getPlansAction()` (`src/app/actions/plans.ts`) and the legacy client fallback
`getPlans()` (`src/lib/plan-store.ts`) both carried a Phase 2 migration rule — any tariff stored
with `type: 'group'` whose `period` wasn't `'monthly'` got silently reclassified to `'personal'`
on every read. This studio's real tariffs ("Minimum", "NEW", "One Time", "Standard") are all
session-count group class packages (`period: 'sessions'`), so all four were being force-relabeled
to "personal" on load and disappeared from the group tab entirely — not a bug in the new
Server Action, but a stale migration rule from before per-type creation modals existed (Phase 2b),
now actively fighting the studio's actual, legitimate use of the `'group'` type.

**Fix**: removed the reclassification in both places — the stored `type` is now trusted as-is,
matching what Phase 2b's dedicated per-type modals already let staff choose explicitly when
creating a tariff. Also relabeled the first tab/modal-title from `monthlyShortLabel`
("ყოველთვიური") to the already-defined-but-unused `groupClass` ("ჯგუფური") string, since the tab
can now correctly contain non-monthly group tariffs and the old label was actively misleading.

Data fix: two orphaned legacy tariffs ("Basic", "Minimal") had `type: null` from before the
`type`/`period` fields existed at all — invisible under every tab regardless of this bug. Backfilled
both to `type: 'group', period: 'sessions'` directly in the DB (matching their existing
`session_count`/`price` shape) so they're visible again.

Notes:
- `tsc --noEmit`: clean.
- Files: `src/app/actions/plans.ts`, `src/lib/plan-store.ts`,
  `src/app/(dashboard)/subscriptions/plans/page.tsx`.

---

### Branches module: dedicated management page (per owner-supplied PRD)

Owner uploaded a Branches module PRD and asked for it to be fully implemented. Before this,
there was no dedicated page for branches — only the header's 2-field quick-add dropdown
(kept exactly as-is per the PRD's own note that it's "separate, unchanged by this page") and a
simple card list on the Profile page's "Branches" tab (no photo/area/comment/hall-count, and its
delete button had no dependency check at all).

**Discovered while building this**: the real `branches` table had **zero rows** for the studio
whose data I'd been auditing all session, even though `students.branch_ids`, `groups.branch_id`,
and `halls.branch_id` (added by the earlier Branch Isolation phase) all default to the string
`'main'` — meaning every org's implicit default branch was a phantom id with no real row to show,
rename, or attach anything to. `listBranches()` (`src/lib/logic/branches.ts`) now lazily seeds a
real `'main'` branch row the first time an org's branch list comes back empty, so that default
finally has something real behind it.

**New Server Actions** (`src/app/actions/branches.ts` / `src/lib/logic/branches.ts`):
- `getBranchesAction()` — real list with a live-computed hall count per branch (never a stored
  number, per PRD §3).
- `getBranchDeletionImpactAction(id)` — counts of halls/students/staff currently attached.
- `deleteBranchAction({id, reassignToBranchId?})` — two-step safe delete per PRD §6: moves
  attached halls/students/staff to the picked branch (or the implicit default if none picked)
  before deleting only the branch row itself. Refuses to delete an org's last remaining branch
  (would otherwise reassign onto the very row being deleted). Validates `reassignToBranchId`
  actually belongs to this org before using it, and the per-row student/staff reassignment updates
  are `org_id`-scoped too — defensive-in-depth since these Server Actions run against a
  service-role client with no RLS for staff-token sessions.

**UI** (`src/app/(dashboard)/branches/page.tsx`, `src/components/branches/*`): card grid (photo,
status badge, live hall count, address, edit/delete), a detail modal (address+"open in map" link,
area, full halls list — editing/deleting a hall redirects to `/halls`, "where the change actually
happens" per PRD §4/§5 — plus a "bind existing hall from another branch" action, which is
genuinely branch-specific and doesn't belong on the halls page), an add/edit form (photo, name,
area in m², address + optional lat/lng with a working Google Maps link, status
active/suspended, comment — halls are deliberately not manageable from this form per PRD §5's own
callout), and the two-step delete dialog with live impact counts + a branch picker.

**Map pin simplification**: no mapping library exists in this project. Rather than fake an
interactive map, this stores optional lat/lng and builds a real, working "open in Google Maps"
link from them (or from the address text if no coordinates are set) — not an embedded map widget.

**Sidebar**: added a new "ფილიალები" nav item between Teachers and Halls (per PRD §2), gated the
same way `/settings` already is — Main Administrator or Administrator-tier only, matching the
Server Actions' own `requireStudioManager()` gate exactly (no dedicated StaffPermissions flag
exists for Branches yet, same honesty-over-invention note the original branches.ts already made).

Notes:
- `tsc --noEmit`: clean. `next dev` compiled `/branches` and `/dashboard` with zero errors.
- Files: `src/lib/logic/branches.ts`, `src/app/actions/branches.ts`,
  `src/app/(dashboard)/branches/page.tsx`, `src/components/branches/BranchFormModal.tsx`,
  `src/components/branches/BranchDetailModal.tsx`, `src/components/branches/DeleteBranchDialog.tsx`,
  `src/types/index.ts` (extended `Branch`), `src/contexts/StudioContext.tsx` (widened `addBranch`),
  `src/components/layout/Sidebar.tsx`.

---

### Dashboard follow-up: fix capacity-ratio bug, real Day/Week/Month, new Events feature

Owner sent production screenshots showing the new "Today's Schedule"/"Group Progress" cards
missing capacity ratios and category pills, and asked for pixel-fidelity to the reference photo,
plus a real (not just cosmetic) Day/Week/Month toggle, plus flagged that individual lessons never
seem to count as "classes".

**Root cause of the missing capacity ratios** (`typeof g.capacity === 'number'` in both
`TodayScheduleTimeline` and the dashboard's Group Progress computation): every one of this
studio's groups DOES have a real `capacity` value in the DB (checked directly) — but it comes back
from the JSONB `data` blob as whatever type was stored, not guaranteed to be a JS `number`. The
strict `typeof` check silently failed and hid the ratio/filtered every group out of Group
Progress. Fixed to a loose `Number(...) > 0` check in both places instead, and to actually coerce
to a number when building `ScheduleItem.capacity`.

**Individual lessons "not counted"**: checked directly in the DB — this studio currently has
**zero** `calendar_events` rows of `type: 'individual'`, only `group_class` (all from
recurring `schedule_slots`). Their individual-lesson subscription plans exist as purchasable
credits, but no actual booking has ever created a real calendar row for one, so there's nothing
for any calendar-based count to include yet — not a filtering bug in the new dashboard code, which
already counts every event type for a non-teacher viewer with no type exclusion. Once an individual
lesson is actually booked onto a specific date (via the 7B booking flow or a manual Calendar entry),
it will show and count the same as any other event.

**Real Day/Week/Month**: `dashboard/page.tsx`'s schedule-refresh block now builds the enriched
event list per date via a shared `buildForDate()` helper, then assembles either one day, the
selected week (Mon–Sun), or every day-with-events in the selected month, passed to
`TodayScheduleTimeline` as `{date, items}[]` groups with a date header per group outside Day view.
Prev/Today/Next now step by the matching unit (day/week/month) instead of always ±1 day. Also
fixed a real bug found while touching this: the schedule_slots virtual-fallback path used to cap
at `.slice(0, 6)` groups, silently dropping the rest of a studio's schedule past 6 concurrent
groups on a day with no explicit calendar rows.

**Category pill**: was rendering the raw event `type` string unstyled (e.g. literally
"group_class"); now translated to a real label (ჯგუფური/ინდივიდუალური/გაქირავება/სხვა) colored by
the event/group's own color — this studio's real data is all `group_class` today so the label
repeats, which is correct (there's no separate "age group" field in this schema to tag classes
with, unlike the reference mockup's invented categories).

**New Events feature** (`src/app/(dashboard)/events/page.tsx`): owner noted there was no way to
create the "Upcoming Events"-style entries (campaigns, term starts, competitions) the dashboard
card is meant to show. Added a dedicated page (title, date, description, color; add/edit/delete),
backed by the same `calendar_events` table/store the Calendar page already writes to
(`event-store.ts` — that module hasn't moved to Server Actions yet), filtered to `type: 'other'`.
New sidebar nav item "ღონისძიებები" in Tools, positioned above Shop per the owner's request. The
dashboard's Upcoming Events card already read this same `type: 'other'` data, so it now has a real
source once the owner adds entries.

Notes:
- `tsc --noEmit`: clean. `next dev` compiled `/dashboard`, `/events`, `/branches` with zero errors.
- Files: `src/app/(dashboard)/dashboard/page.tsx`, `src/components/dashboard/DashboardHomeSections.tsx`,
  `src/app/(dashboard)/events/page.tsx` (new), `src/components/layout/Sidebar.tsx`,
  `src/lib/i18n/{types,ka,ru,en}.ts` (added `events` key).
