-- Two more low-priority advisor findings from the full DB audit.

-- 1) 7 SECURITY DEFINER functions were callable via PostgREST RPC by the
-- anon role. Every real call site (grep across src/) goes through a
-- Server Action using either a real authenticated session or a
-- service-role client -- never the anon key -- so revoking anon's
-- EXECUTE grant closes an unused door with zero effect on the app.
-- `authenticated` keeps EXECUTE: the real-auth Server Action path calls
-- these as the logged-in user's own role.
REVOKE EXECUTE ON FUNCTION public.attendance_daily_counts(date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.checkin_deduct_session(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.checkin_refund_session(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_overdue_subscriptions() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_attendance_and_deduct_session(text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_students(text, text, text, text, text[], text, integer, integer, text, text[]) FROM anon;

-- 2) 6 indexes on SMS tables had zero scans recorded (idx_scan = 0).
-- Small tables, nothing in the codebase relies on them for a query plan;
-- dropping removes write-time overhead with no read-side cost.
DROP INDEX IF EXISTS public.sms_templates_org_idx;
DROP INDEX IF EXISTS public.sms_templates_category_idx;
DROP INDEX IF EXISTS public.sms_audit_log_org_idx;
DROP INDEX IF EXISTS public.sms_logs_template_idx;
DROP INDEX IF EXISTS public.sms_logs_org_timestamp_idx;
DROP INDEX IF EXISTS public.sms_logs_org_id_idx;
