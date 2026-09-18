-- Teacher invite-by-email flow (docs/authorization-module.md §8) — the "(ა)
-- მოწვევა" path: an admin sends an email invite instead of filling the
-- teacher's fields directly ("(ბ) ხელით შევსება", already built via
-- TeacherModal.tsx). The teacher fills their own profile via a public
-- claim link; the record only becomes a real `staff` row once the admin
-- reviews it on the confirmation screen and confirms (§8's "დასადასტურებელი
-- ეკრანი" step) — so this table holds the in-between, not-yet-a-staff-member
-- state.
--
-- token_hash, never the raw token: the claim link's token is itself the
-- bearer credential (like a Supabase magic link) for an otherwise
-- unauthenticated visitor, so it's hashed at rest the same way OTP codes
-- are in `registration_otps`.

BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_invites (
    id text PRIMARY KEY,
    org_id uuid NOT NULL,
    email text NOT NULL,
    token_hash text NOT NULL,
    role text NOT NULL DEFAULT 'teacher',
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed', 'revoked')),
    first_name text,
    last_name text,
    phone text,
    -- Unified Auth (docs/tasks.md): the Supabase Auth user id created at
    -- submit time (public claim page) — deliberately created WITHOUT a
    -- role in its user_metadata until confirmStaffInviteAction grants one,
    -- so a submitted-but-not-yet-confirmed account can authenticate but
    -- has no effective permissions at all. No password hash is ever
    -- stored here — Supabase Auth owns the password from the moment the
    -- teacher sets it.
    staff_id uuid,
    invited_by uuid,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    submitted_at timestamptz,
    confirmed_at timestamptz
);

CREATE INDEX IF NOT EXISTS staff_invites_org_idx ON public.staff_invites (org_id);
CREATE UNIQUE INDEX IF NOT EXISTS staff_invites_token_hash_uq ON public.staff_invites (token_hash);

ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view staff invites" ON public.staff_invites;
DROP POLICY IF EXISTS "Org members can insert staff invites" ON public.staff_invites;
DROP POLICY IF EXISTS "Org members can update staff invites" ON public.staff_invites;
DROP POLICY IF EXISTS "Org members can delete staff invites" ON public.staff_invites;

-- Same auth.uid()-based org-membership check as every other RLS-backed
-- table in this migration series. Administrator/Teacher (staff-token,
-- no auth.uid()) reach this table through the dual-auth Server Actions
-- (src/lib/server-actions-auth.ts) instead, same as Shop/Expenses/
-- Permission Locks. The public claim page (an unauthenticated visitor
-- holding only the emailed token) never touches this table through RLS
-- at all — it goes through a dedicated service-role Server Action that
-- verifies the token itself as the credential.
CREATE POLICY "Org members can view staff invites"
ON public.staff_invites FOR SELECT TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Org members can insert staff invites"
ON public.staff_invites FOR INSERT TO authenticated
WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Org members can update staff invites"
ON public.staff_invites FOR UPDATE TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Org members can delete staff invites"
ON public.staff_invites FOR DELETE TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

COMMIT;
