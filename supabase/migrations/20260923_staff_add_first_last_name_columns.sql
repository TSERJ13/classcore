-- src/app/actions/staff.ts's createStaffAction/updateStaffAction have always
-- written/read `first_name`/`last_name` as real top-level columns on
-- `staff` (per that file's own SCHEMA comment) — but that was inferred
-- from settings-store.ts's client-side sync payload shape, never verified
-- against the live table (staff predates this repo's migrations folder,
-- so there's no CREATE TABLE here to check against — see
-- 20260918_staff_write_rls.sql's own note on this). Confirmed missing via
-- `SELECT column_name FROM information_schema.columns WHERE table_name =
-- 'staff' AND column_name = 'first_name'` returning 0 rows: PostgREST's
-- "Could not find the 'first_name' column of 'staff' in the schema cache"
-- error on every updateStaffAction call is a real missing column, not a
-- stale schema cache.
--
-- Every existing staff row was created through the OLDER client-side path
-- (settings-store.ts -> syncRecordToCloud('staff', ...)), which only ever
-- wrote these into the `data` JSONB blob — so backfill from there instead
-- of leaving existing staff with blank names now that the real columns
-- exist and updateStaffAction's `.update()` will start relying on them.

BEGIN;

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS last_name text;

UPDATE public.staff
SET first_name = COALESCE(first_name, data->>'first_name'),
    last_name = COALESCE(last_name, data->>'last_name')
WHERE first_name IS NULL OR last_name IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
