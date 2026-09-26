-- The previous migration (20260926_checkin_rpcs_accept_org_id.sql) added a
-- new (p_sub_id, p_org_id) overload of checkin_deduct_session/
-- checkin_refund_session via CREATE OR REPLACE. Postgres treats a
-- different parameter list as a genuinely new function object, not a
-- replacement of the old one-arg version — so the old (p_sub_id) overload
-- kept its already-locked-down grants (anon revoked by
-- 20260923_revoke_anon_rpc_and_drop_unused_indexes.sql), while the new
-- two-arg overload was created with Postgres's default grant: EXECUTE to
-- PUBLIC, which includes anon. That reopened exactly the exposure the
-- 20260923 migration closed — and made it strictly worse, since the new
-- overload accepts a caller-supplied org_id with no ownership check, so
-- an anonymous caller who knows any subscription id could deduct/refund
-- a session on *any* org's subscription directly via PostgREST, bypassing
-- the app and its auth entirely.
--
-- checkin.ts (the only caller anywhere in the codebase — confirmed via
-- grep) now always calls the two-arg form. The one-arg form is dead code;
-- drop it rather than keep two grant surfaces to maintain in lockstep.

DROP FUNCTION IF EXISTS public.checkin_deduct_session(text);
DROP FUNCTION IF EXISTS public.checkin_refund_session(text);

-- Supabase grants EXECUTE to anon/authenticated/service_role as individual
-- explicit ACL entries on every new function in this schema, not via the
-- PUBLIC pseudo-role — `REVOKE ... FROM PUBLIC` alone does not remove
-- those (confirmed live: proacl still listed anon=X after a PUBLIC-only
-- revoke). Each role must be revoked by name.
REVOKE EXECUTE ON FUNCTION public.checkin_deduct_session(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.checkin_refund_session(text, uuid) FROM PUBLIC, anon;
