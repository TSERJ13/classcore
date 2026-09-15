-- Architecture migration Phase 1 (see docs/architecture-migration.md) —
-- attendance is the module with real data-volume problems (the brief's
-- "20,000+ attendance records" concern), so counting-by-day belongs in
-- Postgres, not in a client-side reduce over a bulk-fetched array.
--
-- SECURITY DEFINER is required so the function can run the aggregate query
-- once and still respect the caller's own RLS visibility (it re-checks
-- org membership itself below, rather than relying on the RLS policies on
-- `attendance` being invoked implicitly the way a plain SELECT would).

BEGIN;

CREATE OR REPLACE FUNCTION public.attendance_daily_counts(
    p_date_from date,
    p_date_to date
)
RETURNS TABLE (day date, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_org_id uuid;
BEGIN
    SELECT org_id INTO caller_org_id FROM public.profiles WHERE id = auth.uid();
    IF caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No org for current user';
    END IF;

    RETURN QUERY
    SELECT a.date::date AS day, count(*)::bigint
    FROM public.attendance a
    WHERE a.org_id = caller_org_id
      AND a.date >= p_date_from
      AND a.date <= p_date_to
    GROUP BY a.date
    ORDER BY a.date;
END;
$$;

REVOKE ALL ON FUNCTION public.attendance_daily_counts(date, date) FROM public;
GRANT EXECUTE ON FUNCTION public.attendance_daily_counts(date, date) TO authenticated;

COMMIT;
