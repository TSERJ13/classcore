-- get_dashboard_stats() ignored branch isolation entirely (it predates
-- 20260921_branch_isolation_phase1.sql), so the dashboard's server-computed
-- overlay (active students / monthly revenue / today's check-ins / expiring
-- soon) always showed the same org-wide numbers no matter which branch was
-- selected — the dashboard half of "switching branches does nothing".
-- Adds an optional p_branch_id filter, scoped through students.branch_ids
-- (the real column Phase 1 added): a subscription/check-in is attributed to
-- a branch through the student(s) it belongs to, since subscriptions and
-- attendance don't carry their own branch_id yet (a separate, deliberately
-- deferred item). Sales stay org-wide here too, matching the same
-- known-gap tradeoff made in dashboard/page.tsx's client-side computation
-- (many shop sales are walk-in purchases with no student_id to key off of).
-- p_branch_id IS NULL (the default) reproduces the exact old org-wide
-- behavior, so this is non-breaking for any other caller.

DROP FUNCTION IF EXISTS public.get_dashboard_stats();

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_branch_id text DEFAULT NULL)
RETURNS TABLE (
    active_students integer,
    monthly_revenue numeric,
    today_checkins integer,
    expiring_soon_students integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    caller_org_id uuid;
    v_today date := current_date;
    v_month_prefix text := to_char(current_date, 'YYYY-MM');
    v_next_week date := current_date + 7;
BEGIN
    SELECT org_id INTO caller_org_id FROM public.profiles WHERE id = auth.uid();
    IF caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No org for current user';
    END IF;

    PERFORM public.expire_overdue_subscriptions();

    RETURN QUERY
    WITH branch_students AS (
        SELECT s.id
        FROM public.students s
        WHERE s.org_id = caller_org_id
          AND (p_branch_id IS NULL OR p_branch_id = ANY(s.branch_ids))
    ),
    sub_rows AS (
        SELECT
            s.id, s.student_id, s.status, s.expires_at, s.sessions_total, s.sessions_used,
            s.data->>'purchased_at' AS purchased_at,
            s.data->>'created_at' AS created_at,
            s.data->>'plan' AS plan_name,
            s.data->>'plan_id' AS plan_id,
            public._safe_numeric(s.data->>'amount_paid') AS amount_paid
        FROM public.subscriptions s
        WHERE s.org_id = caller_org_id
          AND (p_branch_id IS NULL OR EXISTS (
              SELECT 1 FROM unnest(string_to_array(s.student_id, ',')) x
              JOIN branch_students bs ON bs.id = trim(x)
          ))
    ),
    sub_flags AS (
        SELECT
            sr.*,
            (sr.sessions_total IS NULL) AS is_unlimited,
            CASE WHEN sr.sessions_total IS NULL THEN NULL
                 ELSE GREATEST(0, sr.sessions_total - COALESCE(sr.sessions_used, 0)) END AS remaining,
            (sr.expires_at < v_today) AS expired_by_date
        FROM sub_rows sr
    ),
    sub_valid AS (
        -- not expired by date, not sessions-exhausted (mirrors
        -- dashboard/page.tsx's shared hasExpiredByDate/hasUsedAllSessions guard)
        SELECT sf.*
        FROM sub_flags sf
        WHERE NOT sf.expired_by_date
          AND (sf.is_unlimited OR sf.remaining > 0)
    ),
    active_student_ids AS (
        SELECT DISTINCT trim(x) AS student_id
        FROM sub_valid sv, unnest(string_to_array(sv.student_id, ',')) AS x
        WHERE sv.status = 'active'
    ),
    expiring_student_ids AS (
        SELECT DISTINCT trim(x) AS student_id
        FROM sub_valid sv, unnest(string_to_array(sv.student_id, ',')) AS x
        WHERE sv.expires_at <= v_next_week
    ),
    plan_prices AS (
        SELECT
            p.data->>'name' AS pname,
            p.id::text AS pid,
            public._safe_numeric(p.data->>'price') AS price
        FROM public.subscription_plans p
        WHERE p.org_id = caller_org_id
    ),
    sub_revenue_month AS (
        SELECT
            CASE
                WHEN sr.amount_paid IS NOT NULL AND sr.amount_paid > 0 THEN sr.amount_paid
                ELSE COALESCE(
                    (SELECT pp.price FROM plan_prices pp WHERE pp.pname = sr.plan_name LIMIT 1),
                    (SELECT pp.price FROM plan_prices pp WHERE pp.pid = sr.plan_id LIMIT 1),
                    0
                )
            END AS revenue
        FROM sub_rows sr
        WHERE public._sub_in_month(sr.purchased_at, sr.created_at, sr.expires_at, v_month_prefix)
    ),
    sale_rows AS (
        SELECT
            public._safe_numeric(sa.data->>'price') AS price,
            public._safe_numeric(sa.data->>'quantity') AS quantity,
            sa.data->>'date' AS sale_date
        FROM public.sales sa
        WHERE sa.org_id = caller_org_id
    ),
    sale_revenue_month AS (
        SELECT COALESCE(sr.price, 0) * COALESCE(sr.quantity, 1) AS revenue
        FROM sale_rows sr
        WHERE sr.sale_date IS NOT NULL AND left(sr.sale_date, 7) = v_month_prefix
    )
    SELECT
        (SELECT count(*)::integer FROM active_student_ids),
        (COALESCE((SELECT sum(revenue) FROM sub_revenue_month), 0)
            + COALESCE((SELECT sum(revenue) FROM sale_revenue_month), 0))::numeric,
        (SELECT count(*)::integer FROM public.attendance a
            WHERE a.org_id = caller_org_id AND a.date = v_today
              AND (p_branch_id IS NULL OR a.student_id IN (SELECT id FROM branch_students))),
        (SELECT count(*)::integer FROM expiring_student_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(text) TO authenticated;
