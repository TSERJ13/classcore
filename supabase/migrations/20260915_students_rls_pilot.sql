-- Architecture migration pilot (see docs/architecture-migration.md) — the
-- `students` table was the one core table the 20260415 hardening migration
-- did NOT cover (only profiles/organizations/groups_classes/subscriptions/
-- attendance_logs got policies). It holds the most sensitive PII in the app
-- (names, phone numbers, birth dates, medical cert data) and today has ZERO
-- database-level tenant isolation — the only thing stopping cross-studio
-- leakage is every call site manually remembering `.eq('org_id', ...)`.
--
-- This migration is intentionally scoped to `students` only, as the pilot
-- module. Every other table still missing RLS is a separate, follow-up
-- migration (see the roadmap doc) — not bundled here so this one stays small
-- enough to review and apply with confidence.

BEGIN;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view students" ON public.students;
DROP POLICY IF EXISTS "Org members can insert students" ON public.students;
DROP POLICY IF EXISTS "Org members can update students" ON public.students;
DROP POLICY IF EXISTS "Org members can delete students" ON public.students;

-- Same membership check as the existing hardening migration's policies
-- (subscriptions/attendance_logs/groups_classes): org_id must be one this
-- user's profile row belongs to. Keeping the same shape here on purpose —
-- two different membership-check patterns across tables would be its own
-- source of bugs later.
CREATE POLICY "Org members can view students"
ON public.students FOR SELECT
TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Org members can insert students"
ON public.students FOR INSERT
TO authenticated
WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Org members can update students"
ON public.students FOR UPDATE
TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Org members can delete students"
ON public.students FOR DELETE
TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

COMMIT;
