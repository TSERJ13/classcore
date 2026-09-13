# Tasks — Tariffs & Subscriptions PRD alignment

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
