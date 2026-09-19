-- Backend port of the attendance check-in write path (checkin-store.ts's
-- recordCheckin/refundCheckin/incrementSessionsUsed/refundSessionsUsed) —
-- see docs/architecture-migration.md §7. This is deliberately scoped to
-- just the atomic, hard-to-get-right-under-concurrency part: locking a
-- subscription row and moving its session count by exactly one. Which
-- subscription to target is resolved in TypeScript
-- (src/app/actions/checkin.ts), by porting getSubscription()'s tiered
-- matching logic 1:1 from subscription-store.ts, rather than reimplementing
-- that fallback chain blind in PL/pgSQL — a straight read of business logic
-- this specific (plan-type/group-id fallback tiers, "prioritize manual
-- default", "oldest purchased for auto-continuation") is far easier to get
-- right, and to review against the original, as TypeScript than as SQL.

BEGIN;

CREATE OR REPLACE FUNCTION public.checkin_deduct_session(p_sub_id text)
RETURNS TABLE (sessions_used int, sessions_total int, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_org_id uuid;
    v_used int;
    v_total int;
    v_status text;
BEGIN
    SELECT org_id INTO caller_org_id FROM public.profiles WHERE id = auth.uid();
    IF caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No org for current user';
    END IF;

    SELECT s.sessions_used, s.sessions_total, s.status
    INTO v_used, v_total, v_status
    FROM public.subscriptions s
    WHERE s.id = p_sub_id AND s.org_id = caller_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription not found for this studio';
    END IF;

    v_used := v_used + 1;
    IF v_total IS NOT NULL AND v_used >= v_total THEN
        v_status := 'expired';
    END IF;

    UPDATE public.subscriptions SET sessions_used = v_used, status = v_status WHERE id = p_sub_id;

    RETURN QUERY SELECT v_used, v_total, v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.checkin_refund_session(p_sub_id text)
RETURNS TABLE (sessions_used int, sessions_total int, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_org_id uuid;
    v_used int;
    v_total int;
    v_status text;
    v_expires date;
BEGIN
    SELECT org_id INTO caller_org_id FROM public.profiles WHERE id = auth.uid();
    IF caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No org for current user';
    END IF;

    SELECT s.sessions_used, s.sessions_total, s.status, s.expires_at
    INTO v_used, v_total, v_status, v_expires
    FROM public.subscriptions s
    WHERE s.id = p_sub_id AND s.org_id = caller_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription not found for this studio';
    END IF;

    v_used := GREATEST(0, v_used - 1);
    -- Mirrors refundSessionsUsed()'s un-expire rule: only flip back to
    -- active if it was expired for the sessions-exhausted reason (still
    -- within its date window), not if it was expired by date.
    IF v_status = 'expired' AND v_expires >= current_date THEN
        v_status := 'active';
    END IF;

    UPDATE public.subscriptions SET sessions_used = v_used, status = v_status WHERE id = p_sub_id;

    RETURN QUERY SELECT v_used, v_total, v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.checkin_deduct_session(text) FROM public;
REVOKE ALL ON FUNCTION public.checkin_refund_session(text) FROM public;
GRANT EXECUTE ON FUNCTION public.checkin_deduct_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_refund_session(text) TO authenticated;

COMMIT;
