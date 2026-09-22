-- Branch data isolation, Phase 1 (see docs/architecture-migration.md and the
-- branch-isolation plan discussed in docs/tasks.md's matching entry).
--
-- Today there is NO real branch-level data boundary anywhere in the schema —
-- confirmed by a full investigation before this migration was written.
-- `org_id` is the only enforced tenant boundary; branch attribution today is
-- either a single `branch_id` string buried inside a table's `data` JSONB
-- blob (students) or a UI-only filter (`staff.data.allowedBranchIds`, which
-- only ever gates the branch-switcher dropdown, never a query). Groups and
-- halls have no branch concept in the live schema at all — the FK columns
-- `master_schema.sql` declares for them were never actually applied; that
-- file is an unused, aspirational rewrite target, not what's live.
--
-- This migration adds real, queryable columns for the 4 "identity/location"
-- entities Phase 1 wires up (students, staff, groups, halls), backfilling
-- from whatever branch data already exists so no existing row goes
-- invisible once Server Actions start filtering by these columns. Every
-- other table (subscriptions, attendance, sales, expenses, calendar_events)
-- is explicitly Phase 2/3 — not touched here.
--
-- RLS is deliberately NOT extended to branch_id/branch_ids here: RLS never
-- applies to staff-token sessions anyway (they use a service-role client —
-- see src/lib/server-actions-auth.ts's own docstring), so branch
-- enforcement has to happen as a manual query filter in the Server Action
-- layer regardless. Adding a second, narrower RLS layer on top of the
-- existing org_id policies would be redundant for the client that matters
-- and could only mislead about what's actually enforced. The org_id RLS
-- policies from 20260915_phase0_rls_gapfill.sql are untouched.

BEGIN;

-- students: branch_id (singular, inside `data`) -> branch_ids (real TEXT[] column).
-- A student can now belong to multiple branches; existing single-branch data
-- becomes a one-element array so no student goes unfiltered/invisible.
ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS branch_ids TEXT[] NOT NULL DEFAULT ARRAY['main'];

UPDATE public.students
SET branch_ids = ARRAY[COALESCE(NULLIF(data->>'branch_id', ''), 'main')]
WHERE branch_ids = ARRAY['main']::TEXT[]
  AND data ? 'branch_id';

-- staff: allowedBranchIds (inside `data`, already a real UI concept — the
-- branch-switcher/sidebar dropdown already reads it) -> allowed_branch_ids,
-- a real column Server Actions can now actually filter/validate against.
-- Empty array keeps its existing meaning: unrestricted (all branches).
ALTER TABLE public.staff
    ADD COLUMN IF NOT EXISTS allowed_branch_ids TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.staff
SET allowed_branch_ids = ARRAY(SELECT jsonb_array_elements_text(data->'allowedBranchIds'))
WHERE allowed_branch_ids = '{}'::TEXT[]
  AND jsonb_typeof(data->'allowedBranchIds') = 'array';

-- groups: no branch concept existed anywhere before this (neither in `data`
-- nor as a column) — every existing group defaults to 'main', same as a
-- freshly-created single-branch studio would expect.
ALTER TABLE public.groups
    ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT 'main';

-- halls: same situation as groups — no prior branch data to recover.
ALTER TABLE public.halls
    ADD COLUMN IF NOT EXISTS branch_id TEXT NOT NULL DEFAULT 'main';

-- search_students (20260916_search_students_rpc.sql) is the real read path
-- for /students — a plain Server Action query can't add branch filtering to
-- it, since the RPC does its own pagination/count internally (filtering its
-- output in JS afterward would desync `total_count` from what's actually
-- returned). Adding two new params, same shape as the existing
-- p_group_id/p_visible_group_ids pair: p_branch_id narrows to one branch
-- (the "switch branch and actually see less" behavior this whole migration
-- exists for), p_visible_branch_ids is the security boundary (a restricted
-- caller's own allowed branches — empty/NULL means unrestricted, checked
-- server-side by the Server Action before this is ever called, same as
-- p_visible_group_ids already is). DROP first: adding parameters changes
-- the function's identity in Postgres, so a plain CREATE OR REPLACE would
-- leave the old 8-arg overload sitting alongside this one instead of
-- actually replacing it.
DROP FUNCTION IF EXISTS public.search_students(text, text, text, text, text[], text, int, int);

CREATE OR REPLACE FUNCTION public.search_students(
    p_search text DEFAULT NULL,
    p_status text DEFAULT 'all',
    p_gender text DEFAULT 'all',
    p_group_id text DEFAULT NULL,
    p_visible_group_ids text[] DEFAULT NULL,
    p_sort_by text DEFAULT 'none',
    p_page int DEFAULT 1,
    p_page_size int DEFAULT 24,
    p_branch_id text DEFAULT NULL,
    p_visible_branch_ids text[] DEFAULT NULL
)
RETURNS TABLE (
    id text, full_name text, first_name text, last_name text, phone text, email text, data jsonb,
    sub_status text, sub_sessions_total int, sub_sessions_used int, sub_expires_at date,
    total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_org_id uuid;
    v_offset int;
BEGIN
    -- NOTE: fixed to `profiles.id` by 20260922_fix_search_students_ambiguous_id.sql —
    -- left unqualified here (as in the original 20260916 migration) caused
    -- "column reference "id" is ambiguous" on every call, since this
    -- function's own `RETURNS TABLE (id text, ...)` declares `id` as a
    -- PL/pgSQL variable that collides with the bare column reference.
    SELECT org_id INTO caller_org_id FROM public.profiles WHERE profiles.id = auth.uid();
    IF caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No org for current user';
    END IF;
    v_offset := GREATEST(0, (p_page - 1) * p_page_size);

    RETURN QUERY
    WITH matched AS (
        SELECT
            s.id, s.full_name, s.first_name, s.last_name, s.phone, s.email, s.data,
            sub.status AS m_sub_status, sub.sessions_total AS m_sessions_total,
            sub.sessions_used AS m_sessions_used, sub.expires_at AS m_expires_at
        FROM public.students s
        LEFT JOIN LATERAL (
            SELECT status, sessions_total, sessions_used, expires_at
            FROM public.subscriptions sub2
            WHERE sub2.student_id = s.id AND sub2.org_id = caller_org_id
            ORDER BY (sub2.status = 'active' AND sub2.expires_at >= current_date) DESC, sub2.expires_at DESC NULLS LAST
            LIMIT 1
        ) sub ON true
        WHERE s.org_id = caller_org_id
            AND (p_search IS NULL OR p_search = '' OR s.full_name ILIKE '%' || p_search || '%' OR s.phone ILIKE '%' || p_search || '%')
            AND (p_gender = 'all' OR s.data ->> 'gender' = p_gender)
            AND (p_group_id IS NULL OR s.data -> 'enrolled_group_ids' ? p_group_id)
            AND (p_visible_group_ids IS NULL OR s.data -> 'enrolled_group_ids' ?| p_visible_group_ids)
            AND (p_branch_id IS NULL OR p_branch_id = ANY(s.branch_ids))
            AND (p_visible_branch_ids IS NULL OR s.branch_ids && p_visible_branch_ids)
            AND (
                p_status = 'all'
                OR (p_status = 'active' AND sub.status = 'active' AND sub.expires_at >= current_date)
                OR (p_status = 'inactive' AND NOT (sub.status = 'active' AND sub.expires_at >= current_date))
            )
    )
    SELECT
        m.id, m.full_name, m.first_name, m.last_name, m.phone, m.email, m.data,
        m.m_sub_status, m.m_sessions_total, m.m_sessions_used, m.m_expires_at,
        count(*) OVER() AS total_count
    FROM matched m
    ORDER BY
        CASE WHEN p_sort_by = 'first_name' THEN lower(COALESCE(m.first_name, m.full_name)) END ASC,
        CASE WHEN p_sort_by = 'last_name' THEN lower(COALESCE(m.last_name, m.full_name)) END ASC,
        CASE WHEN p_sort_by = 'gender' THEN m.data ->> 'gender' END ASC,
        lower(m.full_name) ASC
    LIMIT p_page_size OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.search_students(text, text, text, text, text[], text, int, int, text, text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.search_students(text, text, text, text, text[], text, int, int, text, text[]) TO authenticated;

COMMIT;
