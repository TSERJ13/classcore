-- Architecture migration Phase 0 (see docs/architecture-migration.md) —
-- closes the RLS gap on every remaining table `/api/sync/state` and
-- `/api/sync/bulk` read/write, using the same org-membership policy shape
-- the 20260415 hardening migration already established.
--
-- IMPORTANT NAMING NOTE, found while writing this: the 20260415 migration
-- put policies on tables named `groups_classes` and `attendance_logs`, but
-- the app's actual sync routes (src/app/api/sync/state/route.ts,
-- src/app/api/sync/bulk/route.ts) query tables named `groups` and
-- `attendance` — NOT the names the hardening migration covered. Either
-- those two policies are sitting on tables the app doesn't use, or there's
-- a second set of tables nobody read from since. This migration targets the
-- table names actually queried by the live sync routes (`groups`,
-- `attendance`), so the app gets real coverage regardless of what
-- `groups_classes`/`attendance_logs` turn out to be. Worth reconciling with
-- whoever has DB access to confirm which of the four names are live.
--
-- As with the students-only pilot: this closes the hole in the schema, but
-- `/api/sync/*` still runs on the service-role client and will keep
-- bypassing all of it until those routes are migrated to Server Actions
-- (Phase 2/3 of the roadmap) — that cutover, not this migration, is what
-- makes the boundary actually enforced end to end.

BEGIN;

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'staff', 'groups', 'branches', 'halls', 'studio_settings',
        'attendance', 'sales', 'expenses', 'trash', 'calendar_events',
        'subscription_plans', 'products'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

            EXECUTE format('DROP POLICY IF EXISTS "Org members can select %I" ON public.%I', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "Org members can insert %I" ON public.%I', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "Org members can update %I" ON public.%I', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "Org members can delete %I" ON public.%I', t, t);

            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'org_id') THEN
                EXECUTE format(
                    'CREATE POLICY "Org members can select %I" ON public.%I FOR SELECT TO authenticated USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))',
                    t, t
                );
                EXECUTE format(
                    'CREATE POLICY "Org members can insert %I" ON public.%I FOR INSERT TO authenticated WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))',
                    t, t
                );
                EXECUTE format(
                    'CREATE POLICY "Org members can update %I" ON public.%I FOR UPDATE TO authenticated USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid())) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))',
                    t, t
                );
                EXECUTE format(
                    'CREATE POLICY "Org members can delete %I" ON public.%I FOR DELETE TO authenticated USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))',
                    t, t
                );
            ELSE
                RAISE NOTICE 'Skipped policy creation for %: no org_id column found (RLS is still enabled — table is locked to authenticated with no matching policy until this is reconciled by hand)', t;
            END IF;
        ELSE
            RAISE NOTICE 'Skipped %: table does not exist in this database', t;
        END IF;
    END LOOP;
END $$;

COMMIT;
