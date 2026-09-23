-- Applied directly against production via mcp__Supabase__apply_migration
-- (name: enable_rls_gap_fill_round2) after the user connected Supabase MCP
-- access and asked for a general health check. The Supabase security
-- advisor (get_advisors, type=security) found 7 public tables with RLS
-- completely disabled -- any request carrying the anon/publishable key
-- could read (and mostly write) every row, bypassing all org-scoping.
--
-- studios is deliberately left out here: StudioContext.tsx's browser-side
-- "Nuclear Discovery" fallback reads it directly with the anon key under a
-- staff-token session (no auth.uid()), which a naive org-scoped policy
-- would break. The real fix is moving that lookup behind a Server Action
-- first -- tracked separately, not done in this pass.

BEGIN;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING ((select auth.uid()) = id);

-- registration_otps / promo_codes: no client code path reads or writes
-- these directly (service-role only). Enabling RLS with zero policies
-- makes them deny-by-default for anon/authenticated, matching how they're
-- actually used.
ALTER TABLE public.registration_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can select attendance_records" ON public.attendance_records
    FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
CREATE POLICY "Org members can insert attendance_records" ON public.attendance_records
    FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
CREATE POLICY "Org members can update attendance_records" ON public.attendance_records
    FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
CREATE POLICY "Org members can delete attendance_records" ON public.attendance_records
    FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can select inventory_products" ON public.inventory_products
    FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
CREATE POLICY "Org members can insert inventory_products" ON public.inventory_products
    FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
CREATE POLICY "Org members can update inventory_products" ON public.inventory_products
    FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
CREATE POLICY "Org members can delete inventory_products" ON public.inventory_products
    FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

ALTER TABLE public.student_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can select student_subscriptions" ON public.student_subscriptions
    FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
CREATE POLICY "Org members can insert student_subscriptions" ON public.student_subscriptions
    FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
CREATE POLICY "Org members can update student_subscriptions" ON public.student_subscriptions
    FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
CREATE POLICY "Org members can delete student_subscriptions" ON public.student_subscriptions
    FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

COMMIT;
