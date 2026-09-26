-- checkin_deduct_session / checkin_refund_session resolved the calling
-- org via `SELECT org_id FROM profiles WHERE id = auth.uid()`. That only
-- works for a real Supabase Auth session — auth.uid() is always NULL for
-- a service-role client, which is exactly what every staff-token (PIN)
-- login uses (src/lib/server-actions-auth.ts's requireOrgIdDualAuth()).
-- So even after fixing the outer Server Action auth check (checkin.ts),
-- a staff-token session would still get "No org for current user" raised
-- from inside these RPCs themselves. Add an explicit p_org_id parameter,
-- resolved and passed by the caller (already trusted — it comes from
-- requireOrgIdDualAuth(), never directly from client input), falling back
-- to the old auth.uid() lookup when omitted so any other existing caller
-- keeps working unchanged.

CREATE OR REPLACE FUNCTION public.checkin_deduct_session(p_sub_id text, p_org_id uuid DEFAULT NULL)
 RETURNS TABLE(sessions_used integer, sessions_total integer, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    caller_org_id uuid;
    v_used int;
    v_total int;
    v_status text;
BEGIN
    caller_org_id := p_org_id;
    IF caller_org_id IS NULL THEN
        SELECT org_id INTO caller_org_id FROM public.profiles WHERE id = auth.uid();
    END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.checkin_refund_session(p_sub_id text, p_org_id uuid DEFAULT NULL)
 RETURNS TABLE(sessions_used integer, sessions_total integer, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    caller_org_id uuid;
    v_used int;
    v_total int;
    v_status text;
    v_expires date;
BEGIN
    caller_org_id := p_org_id;
    IF caller_org_id IS NULL THEN
        SELECT org_id INTO caller_org_id FROM public.profiles WHERE id = auth.uid();
    END IF;
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
    IF v_status = 'expired' AND v_expires >= current_date THEN
        v_status := 'active';
    END IF;

    UPDATE public.subscriptions SET sessions_used = v_used, status = v_status WHERE id = p_sub_id;

    RETURN QUERY SELECT v_used, v_total, v_status;
END;
$function$;
