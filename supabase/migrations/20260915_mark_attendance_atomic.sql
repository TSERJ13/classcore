-- Architecture migration Phase 3 (see docs/architecture-migration.md) — the
-- brief's actual example of business logic that belongs in the database:
-- marking attendance against a subscription must deduct one session
-- atomically. Doing this as two separate client-issued writes (insert
-- attendance, then update sessions_used) is exactly the race the brief
-- warned about — two admins marking the same student's attendance around
-- the same time could both read sessions_used=4, both write 5, and the
-- student keeps a session they shouldn't. A single function call is one
-- Postgres transaction: if anything inside raises, nothing committed —
-- including the attendance insert.
--
-- SECURITY DEFINER + an explicit org check (rather than relying on RLS
-- alone) because this function needs to SELECT ... FOR UPDATE the
-- subscription row to lock it against a concurrent second call — that lock
-- needs to hold regardless of which policy path got it there.

BEGIN;

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS notes text;

CREATE OR REPLACE FUNCTION public.mark_attendance_and_deduct_session(
    p_student_id text,
    p_group_id text,
    p_subscription_id text,
    p_status text DEFAULT 'present',
    p_notes text DEFAULT NULL
)
RETURNS TABLE (attendance_id text, sessions_used int, sessions_total int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_org_id uuid;
    v_status text;
    v_sessions_used int;
    v_sessions_total int;
    new_attendance_id text;
    new_sessions_used int := NULL;
    v_sessions_total_out int := NULL;
BEGIN
    SELECT org_id INTO caller_org_id FROM public.profiles WHERE id = auth.uid();
    IF caller_org_id IS NULL THEN
        RAISE EXCEPTION 'No org for current user';
    END IF;

    new_attendance_id := 'att_' || replace(gen_random_uuid()::text, '-', '');

    IF p_subscription_id IS NOT NULL THEN
        -- Lock the row so a second concurrent call for the same subscription
        -- has to wait for this transaction to finish, instead of both
        -- reading the same stale sessions_used.
        SELECT status, sessions_used, sessions_total
        INTO v_status, v_sessions_used, v_sessions_total
        FROM public.subscriptions
        WHERE id = p_subscription_id AND org_id = caller_org_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Subscription not found for this studio';
        END IF;
        IF v_status <> 'active' THEN
            RAISE EXCEPTION 'Subscription is not active (status: %)', v_status;
        END IF;
        IF v_sessions_total IS NOT NULL AND v_sessions_used >= v_sessions_total THEN
            RAISE EXCEPTION 'No sessions remaining on this subscription';
        END IF;

        UPDATE public.subscriptions
        SET sessions_used = sessions_used + 1
        WHERE id = p_subscription_id
        RETURNING sessions_used INTO new_sessions_used;

        v_sessions_total_out := v_sessions_total;
    END IF;

    INSERT INTO public.attendance (id, org_id, student_id, group_id, date, status, notes, data)
    VALUES (
        new_attendance_id, caller_org_id, p_student_id, p_group_id, current_date, p_status, p_notes,
        jsonb_build_object('student_id', p_student_id, 'group_id', p_group_id, 'sub_id', p_subscription_id, 'status', p_status)
    );

    RETURN QUERY SELECT new_attendance_id, new_sessions_used, v_sessions_total_out;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_attendance_and_deduct_session(text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_attendance_and_deduct_session(text, text, text, text, text) TO authenticated;

COMMIT;
