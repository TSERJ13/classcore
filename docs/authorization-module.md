# ClassCore — Authorization Module

Companion document to `docs/permissions-module-prd.md`'s "როლებისა და
უფლებების მოდული" PRD (v1.0, 13 Sept 2026), which references an
"ავტორიზაციის მოდულის PRD" for role strings, session mechanics, Main
Administrator uniqueness, and role-switching UX — that document never
existed. This is it, written from the **real, already-running auth code**
(not invented from scratch), so the Permissions PRD's Role/Scope/Override/
Lock model has something concrete to attach to.

## 1. The two session systems (already built, not changing)

ClassCore already runs two completely separate authentication systems.
The Permissions module has to work across both, not replace either:

1. **Supabase Auth** — real `auth.users` rows, `auth.uid()` resolvable,
   RLS-visible. Used today by exactly one role: the studio's registrant
   (`role: 'owner'` in `user_metadata`, set once at
   `/api/auth/register-studio`). No other flow creates a Supabase Auth
   user for a studio today.
2. **Staff-token sessions** (`cc_staff_token`, `src/lib/staff-token.ts`) —
   a signed HMAC cookie minted by `/api/auth/staff-login`, checked against
   the real `staff` table (`id, org_id, ..., role, password, data`).
   **No `auth.uid()`, no `profiles` row, invisible to RLS** — every
   server-side check of this session has to go through
   `sync-auth.ts`/`session-check.ts`-style code (or, for Server Actions,
   the new `requireOrgIdDualAuth()` helper added this session,
   `src/lib/server-actions-auth.ts`), never plain `auth.uid()`.

`src/hooks/useUser.tsx` already normalizes both into one `profile` object
components read from — that doesn't change either.

## 2. Role hierarchy — mapped to what actually exists

| PRD role | Real mechanism today | Status |
|---|---|---|
| **Super Admin** | `isSuperAdminEmail()` (`src/lib/superadmin-emails.ts`) — a hardcoded email allowlist, entirely separate from `staff`/`profiles`. `useUser.tsx` maps a matching email to `profile.role = 'owner'` with every permission forced `true`. | Exists, but not modeled as a "role" the Permissions engine can see — it's a bypass, not a Scope=platform row. |
| **Main Administrator** | Supabase Auth, `user_metadata.role === 'owner'`. Created exactly once per studio, only by `/api/auth/register-studio` — there is no second code path that mints another `role: 'owner'` user for the same studio, so uniqueness is a natural consequence of "only registration creates one," not an enforced constraint anywhere. | Exists and is already effectively unique. |
| **Administrator** | `staff.role === 'administrator'` (staff-token session, same mechanism as Teacher). Default permission set = every `StaffPermissions` flag true except `canViewBilling`/`manageBilling`/`viewFinancials` (`role-defaults.ts`'s `ADMINISTRATOR_DEFAULTS`). | **Built** — see §6 for what's actually wired vs. still coarse. |
| **Teacher** | Staff-token session, `staff.role` (default `'teacher'`). Added via the Staff Server Actions built this session (`src/app/actions/staff.ts`), through `/teachers`, `/settings`'s Staff Access section, or `/profile`'s Team tab. | Exists and already has real invite/CRUD infrastructure. |
| **Student** | Not a system-authenticated role at all. The public `/[studio]/[studentId]` page is a different, unauthenticated-ish lookup, not a login. | Confirmed by the PRD itself (§8/§10): the student portal isn't built. Out of scope until it is. |

**The one real design decision this document makes, since nothing forced
it before:** build **Administrator as a `staff.role` value** (like
`'teacher'`), not as a second Supabase-Auth-user tier. Reasoning:

- The PRD's own description — "Main Administrator-ის მიერ დამატებული
  დამხმარე ადმინისტრაციული პერსონალი" (assistant admin staff, added *by*
  the Main Administrator) — is exactly how Teacher already works: added by
  an admin, staff-token session, per-person permissions.
- `settings.customRoles` (`['manager', 'teacher', 'receptionist',
  'accountant']`) already anticipates exactly this: free-form staff role
  strings beyond `'teacher'`. `'manager'` is today's closest stand-in for
  "Administrator" — this module formalizes it as a first-class tier with
  its own default permission set, rather than inventing a new auth
  mechanism.
- Building a second real-Supabase-Auth tier would mean a whole new
  invite-and-signup flow (email verification, password set, session
  minting) duplicating what registration already does for Main
  Administrator, for no capability the staff-token path doesn't already
  provide (per-person permissions, revocable, no `auth.uid()` needed).

**Net new role strings**: `staff.role = 'administrator'` joins
`'teacher'` as a formal tier with a defined default permission set (§3 of
the Permissions engine below); everything else in `customRoles`
(`receptionist`, `accountant`, any studio-defined custom string) keeps
working exactly as before — a custom role, no default permission set of
its own, permissions set entirely by hand per person (this was already
true for every role before this module; nothing regresses).

## 3. Main Administrator uniqueness

No new enforcement needed. Registration is the only code path that can
mint a `role: 'owner'` Supabase-Auth user, and it runs once per studio
signup. If a genuine "transfer ownership" or "second owner" feature is
ever wanted, that's new product scope, not something this module needs to
guard against today.

## 4. Role-switching UX ("Active Role Only")

**No multi-role UI exists today, and this phase does not build one.**
Today, a person's role is fixed by *which system they logged in through* —
a Supabase-Auth session is always Main Administrator (or Super Admin), a
staff-token session is always whatever `staff.role` says. Nothing links
one person's Auth account to a `staff` row as "the same human, two hats."

The Permissions PRD's example (someone who is both Teacher and Student)
needs that link to exist before "switch role" can mean anything — and
Student isn't a real session yet either. Building real multi-role support
now, for a role (Student) that can't log in yet, is scope the PRD itself
doesn't ask for urgently (§10 defers the student portal to its own future
PRD). **This phase implements Scope/Override/Lock for the singular-role
case** (which covers 100% of today's real usage — Super Admin, Main
Administrator, Administrator, Teacher all already have exactly one role
each) and leaves multi-role/role-switching as an explicit follow-up once
Student is a real, separate PRD.

## 5. Session/password mechanics

Unchanged by this module. Supabase Auth's own session handling for Main
Administrator/Super Admin; `staff-token.ts`'s signed cookie + `scrypt`
password hashing (added this session, see
`docs/architecture-migration.md` §10) for Administrator/Teacher. No new
auth surface.

## 6. Enforcement status (what actually stops an unauthorized write)

Introducing the Administrator role tier exposed two real gaps beyond just
"does the role exist": (1) whether Administrator can reach the pages that
manage staff/branches/halls, and (2) whether anything server-side actually
stops a caller from doing something their effective permissions (role
default → stored Override → Lock) say they can't — client-side hiding a
button is not enforcement.

**Reachability.** Most modules were already fine: `PermissionGuard
permKey="canView…"` reads the effective permission object directly
(`useUser.tsx`), so `/teachers`, `/shop`, `/analytics`, `/halls`,
`/groups`, etc. already worked for Administrator once its defaults were
true. The one exception was `/settings`, gated by a blanket
`PermissionGuard adminOnly={true}` — `isOwnerOrAdmin()` (`access.ts`)
deliberately never bypasses for `'administrator'` (its access is meant to
come from the Permissions engine, not a role-string bypass), so
Administrator was silently locked out of Settings entirely, Staff Access
and Permission Locks included. Fixed with an opt-in
`allowAdministrator` prop on `PermissionGuard`, used only on `/settings`
— `/billing` (and `/finance`, `/invoices`, `/payments`) deliberately keep
the plain `adminOnly` gate, since `ADMINISTRATOR_DEFAULTS` excludes
billing on purpose. `Sidebar.tsx`'s nav-item visibility got the matching
fix for `/settings` only.

**Server-side enforcement.** `src/lib/permissions/enforce.ts` adds
`requireEffectivePermission(permKey)` — resolves the caller's role tier +
stored permissions + Locks the same way `useUser.tsx` does, and throws if
the effective flag is false. Wired into the write actions that previously
only checked "is this org_id right": `staff.ts` (`canViewTeachers`),
`halls.ts` (`canViewHalls`), `groups.ts` (`canViewGroups`), `sales.ts` /
`products.ts` (`canViewShop`), `expenses.ts` (`canViewAnalytics` — see
that file's own comment for why not the more aspirational
`viewFinancials`: nothing in the UI ever sets that flag, so gating on it
would make expense-saving unreachable for everyone). `branches.ts` has no
dedicated `StaffPermissions` flag yet, so it uses `requireStudioManager()`
instead — role-tier check only (Main Administrator or Administrator).
Also fixed a real pre-existing bug this surfaced: `groups.ts`'s writes
required real Supabase Auth, so a Teacher clicking "Add Group" (a button
their own `canViewGroups: true` default already showed them) always
failed server-side — now works.

**Still not enforced**: the registry's (`registry.ts`) finer
`backedBy: null` entries (`students.update`, `subscriptions.create`,
etc.) — those actions still only check the module's coarse `.view` flag
or nothing at all, unchanged by this pass.
