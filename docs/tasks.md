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

Status: in_progress

The PRD's core architectural ask (`docs/authorization-module.md` intro / real PRD §2): one login
mechanism for every user type, not two parallel systems. A full mass-migration of every *existing*
staff-token account on every already-live studio is high-risk (a botched migration breaks real
logins) and was explicitly not what was chosen — user confirmed "Option A" (do the real thing, not
an approximation) but the safe path is incremental: NEW teacher/administrator accounts (via the
manual-fill and invite-by-email flows) get created as real Supabase Auth users going forward
(`user_metadata.role`, a `profiles` row) instead of `staff-token` logins, while existing staff-token
accounts keep working unchanged. The ownership-transfer work above already proved this is
load-bearing: `requireOrgIdDualAuth()`'s real-Auth branch and `useUser.tsx`'s effective-permissions
computation already handle "real Supabase Auth, non-owner role" correctly. What's left: point
`createStaffAction`/the invite-claim flow at `supabase.auth.admin.createUser` instead of
`staff-token`'s password hash, and update `/login` to accept teacher/administrator credentials
(today it's owner-only).

### Student portal: real login + module

Status: pending

Per user: login identity = the parent's email on file; a separate password is set for the student.
No PRD exists for this yet — scope (what a logged-in student can see/do) needs to be decided as this
is built, since neither the Permissions PRD nor the Authorization PRD specify it beyond "Student is
one of the three role flags, not yet a real session."
