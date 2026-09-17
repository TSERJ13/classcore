-- Architecture migration, Staff phase (see docs/architecture-migration.md
-- §10). `staff` was already in 20260915_phase0_rls_gapfill.sql's table
-- array, so it likely already has the 4 org-scoped policies — but that
-- migration only creates them if it finds an `org_id` column at run time,
-- and no CREATE TABLE for `staff` exists anywhere in this repo's migration
-- history (it predates the repo's migrations folder), so this couldn't be
-- verified by reading files alone. This re-applies the same 4 policies
-- idempotently (drop-if-exists + recreate) so the migration itself is the
-- verification — safe to run whether or not they were already there.
--
-- IMPORTANT, read before assuming this closes the gap: `staff` is also
-- written today by several SERVICE-ROLE endpoints (api/auth/staff-login,
-- lib/sync-auth.ts, api/sync/bulk, api/sync/delete) that bypass RLS
-- entirely — those are unaffected by this migration either way, and this
-- migration does not touch them. It only makes the NEW RLS-respecting
-- Server Actions in src/app/actions/staff.ts able to do plain inserts/
-- updates/deletes as the calling (admin/owner/manager) user.
--
-- Also flagging, not fixing here (separate, security-sensitive change):
-- src/app/api/auth/staff-login/route.ts compares `staff.password` in
-- plaintext. This migration and the new Server Actions do not change that
-- — a password-hashing migration is its own piece of work.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff') THEN
        ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Org members can select staff" ON public.staff;
        DROP POLICY IF EXISTS "Org members can insert staff" ON public.staff;
        DROP POLICY IF EXISTS "Org members can update staff" ON public.staff;
        DROP POLICY IF EXISTS "Org members can delete staff" ON public.staff;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'org_id') THEN
            CREATE POLICY "Org members can select staff" ON public.staff FOR SELECT TO authenticated
                USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
            CREATE POLICY "Org members can insert staff" ON public.staff FOR INSERT TO authenticated
                WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
            CREATE POLICY "Org members can update staff" ON public.staff FOR UPDATE TO authenticated
                USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))
                WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
            CREATE POLICY "Org members can delete staff" ON public.staff FOR DELETE TO authenticated
                USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
        ELSE
            RAISE NOTICE 'staff has no org_id column — RLS enabled with no matching policy until reconciled by hand';
        END IF;
    ELSE
        RAISE NOTICE 'staff table does not exist in this database';
    END IF;
END $$;

COMMIT;
