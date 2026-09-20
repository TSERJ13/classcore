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
