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
- [x] **Subscription Status Breakdown (Donut Chart)**:
  - Added lightweight custom SVG Donut (ring) diagram based on `<circle>` and `strokeDasharray`/`strokeDashoffset` (zero external dependencies).
  - Derived statuses from `getUniqueSubscriptions()` via `getEffectiveStatus()` (`active`, `paused`, `expired`, `cancelled`).
  - Rendered total active subscriptions count as the central hero metric.
  - Interactive legend with color-coded badges matching the studio color palette (`emerald` for active, `amber` for paused, `rose` for expired, `indigo` for cancelled).
  - Balanced 2-column layout alongside Today's Attendance Overview with responsive mobile wrap.
- [x] **Type Safety**:
  - Added `booking_status?: 'pending' | 'confirmed' | 'cancelled'` to `CalendarEvent` in `src/types/index.ts`.
  - Exported `getEffectiveStatus` and `SubscriptionEffectiveStatus` in `src/lib/subscription-store.ts`.
  - Verified `npx tsc --noEmit` exits with code 0 (zero errors).
