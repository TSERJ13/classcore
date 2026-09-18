-- Permissions module (see docs/permissions-module-prd.md §7,
-- docs/authorization-module.md) — storage for Permission Lock: a
-- higher-tier role (Super Admin over Main Administrator; Main
-- Administrator over Administrator/Teacher within their own studio)
-- fixing one permission so it can no longer be changed below that level,
-- even via Override. Genuinely new — nothing in the codebase persisted
-- this concept before.
--
-- Deliberately its own real table rather than folded into the
-- studio_settings JSONB blob: it needs the same real-column query shape
-- (by org, by permission_id, by target) every other migrated table in
-- this codebase already uses.
--
-- SCOPED TO PER-STUDIO LOCKS ONLY FOR THIS PHASE (Main Administrator
-- locking an Administrator/Teacher permission within their own studio).
-- The PRD also describes Super Admin locking Main Administrator
-- platform-wide (§7) — deliberately deferred: making a platform-wide lock
-- visible to an ordinary org member's RLS-respecting read would need a
-- SECURITY DEFINER bridge (a plain `org_id IN (...)` policy can't expose
-- a NULL-org row to anyone), and Super Admin already bypasses every
-- permission check via `isSuperAdminEmail` today, so there's no urgent
-- need to build that bridge yet. `org_id` is NOT NULL here on purpose;
-- add platform-wide support as its own follow-up if/when it's needed.

BEGIN;

CREATE TABLE IF NOT EXISTS public.permission_locks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL,
    permission_id text NOT NULL,
    locked_value boolean NOT NULL,
    -- Exactly one of target_role / target_staff_id must be set — a lock
    -- applies to everyone on a role tier, or to one specific staff member,
    -- never both/neither (mirrors resolve.ts's PermissionLock shape).
    target_role text,
    target_staff_id text,
    locked_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT permission_locks_exactly_one_target CHECK (
        (target_role IS NOT NULL AND target_staff_id IS NULL)
        OR (target_role IS NULL AND target_staff_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS permission_locks_org_idx ON public.permission_locks (org_id);

-- Two partial unique indexes rather than one plain UNIQUE(...) constraint
-- covering both target columns: Postgres treats each NULL as distinct, so
-- a single constraint spanning the nullable target_role/target_staff_id
-- pair would never actually catch a duplicate lock on the same target —
-- these also double as the lookup indexes for resolve.ts's per-role/
-- per-staff queries.
CREATE UNIQUE INDEX IF NOT EXISTS permission_locks_role_target_uq
    ON public.permission_locks (org_id, permission_id, target_role) WHERE target_role IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS permission_locks_staff_target_uq
    ON public.permission_locks (org_id, permission_id, target_staff_id) WHERE target_staff_id IS NOT NULL;

ALTER TABLE public.permission_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view permission locks" ON public.permission_locks;
DROP POLICY IF EXISTS "Org members can insert permission locks" ON public.permission_locks;
DROP POLICY IF EXISTS "Org members can update permission locks" ON public.permission_locks;
DROP POLICY IF EXISTS "Org members can delete permission locks" ON public.permission_locks;

-- Same auth.uid()-based org-membership check as everywhere else in this
-- migration series. Note this only ever protects the Main-Administrator
-- (Supabase Auth) path — Administrator/Teacher staff-token sessions have
-- no auth.uid() and read locks through the dual-auth Server Action
-- instead (src/lib/server-actions-auth.ts), same as Shop/Expenses.
CREATE POLICY "Org members can view permission locks"
ON public.permission_locks FOR SELECT TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Org members can insert permission locks"
ON public.permission_locks FOR INSERT TO authenticated
WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Org members can update permission locks"
ON public.permission_locks FOR UPDATE TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Org members can delete permission locks"
ON public.permission_locks FOR DELETE TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

COMMIT;
