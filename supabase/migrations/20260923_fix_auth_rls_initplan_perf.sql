-- Advisor (auth_rls_initplan, 75 occurrences) found that every org-scoped
-- RLS policy in this schema calls auth.uid() directly inside a subquery
-- ("... WHERE profiles.id = auth.uid()"), which Postgres re-evaluates per
-- row scanned instead of once per query. Wrapping it as (select auth.uid())
-- lets Postgres treat it as a stable subplan evaluated once. Same policy
-- semantics, no access-control change -- pure query-plan optimization.
-- Directly relevant to this app's "why is everything slow" history since
-- every org-scoped table read goes through one of these policies.

BEGIN;

-- attendance
DROP POLICY IF EXISTS "Org members can select attendance" ON public.attendance;
CREATE POLICY "Org members can select attendance" ON public.attendance FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert attendance" ON public.attendance;
CREATE POLICY "Org members can insert attendance" ON public.attendance FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update attendance" ON public.attendance;
CREATE POLICY "Org members can update attendance" ON public.attendance FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete attendance" ON public.attendance;
CREATE POLICY "Org members can delete attendance" ON public.attendance FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- branches
DROP POLICY IF EXISTS "Org members can select branches" ON public.branches;
CREATE POLICY "Org members can select branches" ON public.branches FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert branches" ON public.branches;
CREATE POLICY "Org members can insert branches" ON public.branches FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update branches" ON public.branches;
CREATE POLICY "Org members can update branches" ON public.branches FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete branches" ON public.branches;
CREATE POLICY "Org members can delete branches" ON public.branches FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- calendar_events
DROP POLICY IF EXISTS "Org members can select calendar_events" ON public.calendar_events;
CREATE POLICY "Org members can select calendar_events" ON public.calendar_events FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert calendar_events" ON public.calendar_events;
CREATE POLICY "Org members can insert calendar_events" ON public.calendar_events FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update calendar_events" ON public.calendar_events;
CREATE POLICY "Org members can update calendar_events" ON public.calendar_events FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete calendar_events" ON public.calendar_events;
CREATE POLICY "Org members can delete calendar_events" ON public.calendar_events FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- expenses
DROP POLICY IF EXISTS "Org members can select expenses" ON public.expenses;
CREATE POLICY "Org members can select expenses" ON public.expenses FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert expenses" ON public.expenses;
CREATE POLICY "Org members can insert expenses" ON public.expenses FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update expenses" ON public.expenses;
CREATE POLICY "Org members can update expenses" ON public.expenses FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete expenses" ON public.expenses;
CREATE POLICY "Org members can delete expenses" ON public.expenses FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- groups
DROP POLICY IF EXISTS "Org members can select groups" ON public.groups;
CREATE POLICY "Org members can select groups" ON public.groups FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert groups" ON public.groups;
CREATE POLICY "Org members can insert groups" ON public.groups FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update groups" ON public.groups;
CREATE POLICY "Org members can update groups" ON public.groups FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete groups" ON public.groups;
CREATE POLICY "Org members can delete groups" ON public.groups FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- halls
DROP POLICY IF EXISTS "Org members can select halls" ON public.halls;
CREATE POLICY "Org members can select halls" ON public.halls FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert halls" ON public.halls;
CREATE POLICY "Org members can insert halls" ON public.halls FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update halls" ON public.halls;
CREATE POLICY "Org members can update halls" ON public.halls FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete halls" ON public.halls;
CREATE POLICY "Org members can delete halls" ON public.halls FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- permission_locks
DROP POLICY IF EXISTS "Org members can view permission locks" ON public.permission_locks;
CREATE POLICY "Org members can view permission locks" ON public.permission_locks FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert permission locks" ON public.permission_locks;
CREATE POLICY "Org members can insert permission locks" ON public.permission_locks FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update permission locks" ON public.permission_locks;
CREATE POLICY "Org members can update permission locks" ON public.permission_locks FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete permission locks" ON public.permission_locks;
CREATE POLICY "Org members can delete permission locks" ON public.permission_locks FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- products
DROP POLICY IF EXISTS "Org members can select products" ON public.products;
CREATE POLICY "Org members can select products" ON public.products FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert products" ON public.products;
CREATE POLICY "Org members can insert products" ON public.products FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update products" ON public.products;
CREATE POLICY "Org members can update products" ON public.products FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete products" ON public.products;
CREATE POLICY "Org members can delete products" ON public.products FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- sales
DROP POLICY IF EXISTS "Org members can select sales" ON public.sales;
CREATE POLICY "Org members can select sales" ON public.sales FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert sales" ON public.sales;
CREATE POLICY "Org members can insert sales" ON public.sales FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update sales" ON public.sales;
CREATE POLICY "Org members can update sales" ON public.sales FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete sales" ON public.sales;
CREATE POLICY "Org members can delete sales" ON public.sales FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- sms_audit_log (SELECT + INSERT only)
DROP POLICY IF EXISTS "Org members can view sms audit log" ON public.sms_audit_log;
CREATE POLICY "Org members can view sms audit log" ON public.sms_audit_log FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert sms audit log" ON public.sms_audit_log;
CREATE POLICY "Org members can insert sms audit log" ON public.sms_audit_log FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- sms_categories
DROP POLICY IF EXISTS "Org members can view sms categories" ON public.sms_categories;
CREATE POLICY "Org members can view sms categories" ON public.sms_categories FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert sms categories" ON public.sms_categories;
CREATE POLICY "Org members can insert sms categories" ON public.sms_categories FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update sms categories" ON public.sms_categories;
CREATE POLICY "Org members can update sms categories" ON public.sms_categories FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete sms categories" ON public.sms_categories;
CREATE POLICY "Org members can delete sms categories" ON public.sms_categories FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- sms_logs (SELECT only)
DROP POLICY IF EXISTS "Org members can view sms logs" ON public.sms_logs;
CREATE POLICY "Org members can view sms logs" ON public.sms_logs FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- sms_templates
DROP POLICY IF EXISTS "Org members can view sms templates" ON public.sms_templates;
CREATE POLICY "Org members can view sms templates" ON public.sms_templates FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert sms templates" ON public.sms_templates;
CREATE POLICY "Org members can insert sms templates" ON public.sms_templates FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update sms templates" ON public.sms_templates;
CREATE POLICY "Org members can update sms templates" ON public.sms_templates FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete sms templates" ON public.sms_templates;
CREATE POLICY "Org members can delete sms templates" ON public.sms_templates FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- staff
DROP POLICY IF EXISTS "Org members can select staff" ON public.staff;
CREATE POLICY "Org members can select staff" ON public.staff FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert staff" ON public.staff;
CREATE POLICY "Org members can insert staff" ON public.staff FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update staff" ON public.staff;
CREATE POLICY "Org members can update staff" ON public.staff FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete staff" ON public.staff;
CREATE POLICY "Org members can delete staff" ON public.staff FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- staff_invites
DROP POLICY IF EXISTS "Org members can view staff invites" ON public.staff_invites;
CREATE POLICY "Org members can view staff invites" ON public.staff_invites FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert staff invites" ON public.staff_invites;
CREATE POLICY "Org members can insert staff invites" ON public.staff_invites FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update staff invites" ON public.staff_invites;
CREATE POLICY "Org members can update staff invites" ON public.staff_invites FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete staff invites" ON public.staff_invites;
CREATE POLICY "Org members can delete staff invites" ON public.staff_invites FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- students
DROP POLICY IF EXISTS "Org members can view students" ON public.students;
CREATE POLICY "Org members can view students" ON public.students FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert students" ON public.students;
CREATE POLICY "Org members can insert students" ON public.students FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update students" ON public.students;
CREATE POLICY "Org members can update students" ON public.students FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete students" ON public.students;
CREATE POLICY "Org members can delete students" ON public.students FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- studio_settings
DROP POLICY IF EXISTS "Org members can select studio_settings" ON public.studio_settings;
CREATE POLICY "Org members can select studio_settings" ON public.studio_settings FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert studio_settings" ON public.studio_settings;
CREATE POLICY "Org members can insert studio_settings" ON public.studio_settings FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update studio_settings" ON public.studio_settings;
CREATE POLICY "Org members can update studio_settings" ON public.studio_settings FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete studio_settings" ON public.studio_settings;
CREATE POLICY "Org members can delete studio_settings" ON public.studio_settings FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- subscription_plans
DROP POLICY IF EXISTS "Org members can select subscription_plans" ON public.subscription_plans;
CREATE POLICY "Org members can select subscription_plans" ON public.subscription_plans FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert subscription_plans" ON public.subscription_plans;
CREATE POLICY "Org members can insert subscription_plans" ON public.subscription_plans FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update subscription_plans" ON public.subscription_plans;
CREATE POLICY "Org members can update subscription_plans" ON public.subscription_plans FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete subscription_plans" ON public.subscription_plans;
CREATE POLICY "Org members can delete subscription_plans" ON public.subscription_plans FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- subscriptions
DROP POLICY IF EXISTS "Org members can view subscriptions" ON public.subscriptions;
CREATE POLICY "Org members can view subscriptions" ON public.subscriptions FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert subscriptions" ON public.subscriptions;
CREATE POLICY "Org members can insert subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update subscriptions" ON public.subscriptions;
CREATE POLICY "Org members can update subscriptions" ON public.subscriptions FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete subscriptions" ON public.subscriptions;
CREATE POLICY "Org members can delete subscriptions" ON public.subscriptions FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

-- trash
DROP POLICY IF EXISTS "Org members can select trash" ON public.trash;
CREATE POLICY "Org members can select trash" ON public.trash FOR SELECT USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can insert trash" ON public.trash;
CREATE POLICY "Org members can insert trash" ON public.trash FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can update trash" ON public.trash;
CREATE POLICY "Org members can update trash" ON public.trash FOR UPDATE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid()))) WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));
DROP POLICY IF EXISTS "Org members can delete trash" ON public.trash;
CREATE POLICY "Org members can delete trash" ON public.trash FOR DELETE USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = (select auth.uid())));

COMMIT;
