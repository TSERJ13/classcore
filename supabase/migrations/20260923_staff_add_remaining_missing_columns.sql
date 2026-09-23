-- Follow-up to 20260923_staff_add_first_last_name_columns.sql — that fix
-- turned out to be one of five, not one of one. Owner ran
-- `SELECT column_name, data_type FROM information_schema.columns WHERE
-- table_name = 'staff'` and got the ground truth: `staff` has exactly 12
-- real columns (id, org_id, full_name, first_name, last_name, email,
-- phone, role, allowed_branch_ids, data, permissions, created_at) — none
-- of `password`, `salary_percentage`, `rate_per_hour`, `rate_per_month`
-- exist, despite staff.ts's own SCHEMA comment (and its every
-- create/update call) treating all four as real top-level columns. Each
-- one only surfaced as its own separate PostgREST "Could not find the 'X'
-- column" error once the previous one was fixed and the request got
-- further into updateStaffAction's `.update()` — this migration adds all
-- four at once instead of continuing that one-at-a-time cycle.
--
-- Also noting for the record (not acted on here): `permissions` already
-- exists as its own real jsonb column, which nothing in staff.ts
-- currently reads from or writes to directly — permissions today only
-- ever live inside `data.permissions`. Left alone; worth reconciling
-- later if the two are ever expected to be kept in sync.

BEGIN;

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS password text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS salary_percentage numeric;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS rate_per_hour numeric;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS rate_per_month numeric;

-- Backfill from the data JSONB blob for existing rows, same as the
-- first_name/last_name backfill. Guards the numeric casts (regex check
-- before casting, not a bare `::numeric`) because `data` is a
-- hand-written client blob accumulated over a long time — an empty
-- string or other non-numeric junk in any one row's
-- salary_percentage/rate_per_hour/rate_per_month would otherwise abort
-- this entire UPDATE on a bare cast failure.
UPDATE public.staff
SET password = COALESCE(password, data->>'password'),
    salary_percentage = COALESCE(salary_percentage, CASE WHEN data->>'salary_percentage' ~ '^[0-9]+(\.[0-9]+)?$' THEN (data->>'salary_percentage')::numeric END),
    rate_per_hour = COALESCE(rate_per_hour, CASE WHEN data->>'rate_per_hour' ~ '^[0-9]+(\.[0-9]+)?$' THEN (data->>'rate_per_hour')::numeric END),
    rate_per_month = COALESCE(rate_per_month, CASE WHEN data->>'rate_per_month' ~ '^[0-9]+(\.[0-9]+)?$' THEN (data->>'rate_per_month')::numeric END)
WHERE password IS NULL OR salary_percentage IS NULL OR rate_per_hour IS NULL OR rate_per_month IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
