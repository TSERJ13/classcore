-- Architecture migration, Subscriptions + Dashboard phase (see
-- docs/architecture-migration.md §8). Two things this migration does:
--
-- 1. `subscriptions` only ever got a SELECT policy from the original
--    20260415_security_hardening.sql migration — there is no INSERT/UPDATE/
--    DELETE policy for it anywhere, which is why the earlier attendance
--    check-in RPCs (20260916_checkin_session_rpcs.sql) had to do their
--    UPDATE inside a SECURITY DEFINER function instead of relying on a
--    plain RLS-respecting `.update()`. This adds the missing 3 policies,
--    same shape as the students pilot (20260915_students_rls_pilot.sql), so
--    the new Server Actions in src/app/actions/subscriptions.ts can do plain
--    inserts/updates/deletes as the calling user, not just through RPCs.
--
-- 2. `expire_overdue_subscriptions()` + `get_dashboard_stats()`: the
--    dashboard currently recomputes 4 numbers (active students, this
--    month's revenue, today's check-ins, subscriptions expiring within 7
--    days) by pulling the studio's entire subscriptions/students/sales
--    array into the browser and reducing over it — the same "1050-line
--    client fat client" pattern already replaced for students/attendance.
--    This ports that math into one RPC.
--
--    Revenue math is a faithful port of src/lib/studio-stats.ts's
--    `subRevenue`/`isSubInMonth` (that file's own header explains why: a
--    positive `amount_paid` wins, else fall back to the matching Plan's
--    price by name then by id; "in this month" matches on purchased_at,
--    falls back to created_at converted to the studio's local calendar day,
--    and carries one documented legacy shim for a batch of rows backfilled
--    with a literal 2026-08-31 purchase date). created_at is stored as a
--    UTC timestamp but the studio's calendar day is Asia/Tbilisi — ported
--    with that fixed offset since there's no per-org timezone setting today.
--
--    "Active students" = distinct students with at least one subscription
--    that is status='active', not expired by date, and not sessions-
--    exhausted (matches dashboard/page.tsx's `studentsWithActiveSub`).
--    "Expiring soon" = distinct students (not raw subscription count) with
--    a not-yet-expired, not-exhausted subscription whose expires_at falls
--    within the next 7 days — same definition dashboard/page.tsx already
--    uses for its "needs attention" card.

BEGIN;

-- ─── 1. Missing write policies for `subscriptions` ─────────────────────────

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Org members can insert subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Org members can update subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Org members can delete subscriptions" ON public.subscriptions;

CREATE POLICY "Org members can view subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Org members can insert subscriptions"
ON public.subscriptions FOR INSERT TO authenticated
WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Org members can update subscriptions"
ON public.subscriptions FOR UPDATE TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()))
WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Org members can delete subscriptions"
ON public.subscriptions FOR DELETE TO authenticated
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- ─── 2. Small safe-cast helpers (legacy JSONB rows are not guaranteed clean) ─

CREATE OR REPLACE FUNCTION public._safe_numeric(v text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF v IS NULL OR v = '' THEN RETURN NULL; END IF;
    RETURN v::numeric;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Port of studio-stats.ts's isSubInMonth(): true if purchased_at's date part
-- starts with the month, OR created_at (converted to Asia/Tbilisi) does, OR
-- the documented 2026-08-31 legacy-backfill shim applies.
CREATE OR REPLACE FUNCTION public._sub_in_month(p_purchased_at text, p_created_at text, p_expires_at text, p_month_prefix text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_local_month text;
BEGIN
    IF p_purchased_at IS NOT NULL AND left(p_purchased_at, 7) = p_month_prefix THEN RETURN true; END IF;
    IF p_created_at IS NOT NULL AND p_created_at <> '' THEN
        BEGIN
            v_local_month := to_char((p_created_at::timestamptz) AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM');
            IF v_local_month = p_month_prefix THEN RETURN true; END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
    IF p_purchased_at IS NOT NULL AND left(p_purchased_at, 10) = '2026-08-31'
       AND p_expires_at IS NOT NULL AND left(p_expires_at, 7) = p_month_prefix THEN
        RETURN true;
    END IF;
    RETURN false;
END;
$$;

-- ─── 3. Lazy auto-expire sweep ──────────────────────────────────────────────
-- No pg_cron schedule is created here (enabling that extension is a Supabase
-- dashboard action this migration can't verify or perform) — instead this is
-- called at the top of get_dashboard_stats() and can also be called directly
-- before listing subscriptions, so any overdue row gets flipped the next
-- time anyone in the org actually looks at their subscriptions, not just on
-- the specific row a check-in/refund happens to touch (checkin_deduct_session
-- already does its own narrower version of this for the one row it locks).
CREATE OR REPLACE FUNCTION public.expire_overdue_subscriptions()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    caller_org_id uuid;
    v_count integer;
BEGIN
    SELECT org_id INTO caller_org_id FROM public.profiles WHERE id = auth.uid();
    IF caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No org for current user';
    END IF;

    UPDATE public.subscriptions
    SET status = 'expired'
    WHERE org_id = caller_org_id
      AND status = 'active'
      AND expires_at < current_date;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_overdue_subscriptions() FROM public;
GRANT EXECUTE ON FUNCTION public.expire_overdue_subscriptions() TO authenticated;

-- ─── 4. get_dashboard_stats() ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
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
    WITH sub_rows AS (
        SELECT
            s.id, s.student_id, s.status, s.expires_at, s.sessions_total, s.sessions_used,
            s.data->>'purchased_at' AS purchased_at,
            s.data->>'created_at' AS created_at,
            s.data->>'plan' AS plan_name,
            s.data->>'plan_id' AS plan_id,
            public._safe_numeric(s.data->>'amount_paid') AS amount_paid
        FROM public.subscriptions s
        WHERE s.org_id = caller_org_id
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
        (SELECT count(*)::integer FROM public.attendance a WHERE a.org_id = caller_org_id AND a.date = v_today),
        (SELECT count(*)::integer FROM expiring_student_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;

COMMIT;
