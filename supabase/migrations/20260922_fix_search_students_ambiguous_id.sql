-- Real, confirmed production bug (Vercel function logs): every call to
-- search_students() — the sole read path for /students — failed with
-- "column reference "id" is ambiguous". Root cause predates this session's
-- branch-isolation work entirely (present verbatim in the function's
-- original 20260916_search_students_rpc.sql): `RETURNS TABLE (id text, ...)`
-- implicitly declares `id` as a PL/pgSQL variable in the function's own
-- scope, and the line
--     SELECT org_id INTO caller_org_id FROM public.profiles WHERE id = auth.uid();
-- references a bare, unqualified `id` — which Postgres can no longer tell
-- apart from that variable vs. profiles.id, so it raises the ambiguity
-- error on every single invocation. get_dashboard_stats() has this same
-- line but was never affected, because its RETURNS TABLE has no column
-- named `id` to collide with. Confirmed search_students is the only other
-- function in the schema with both this line and an `id` output column
-- (checkin_deduct_session, checkin_refund_session, attendance_daily_counts,
-- mark_attendance_and_deduct_session all have the same line but no `id`
-- output column, so none of them are affected).
--
-- Fix: qualify it as `profiles.id`, removing the ambiguity. No signature
-- change, so no DROP needed — CREATE OR REPLACE in place.

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
