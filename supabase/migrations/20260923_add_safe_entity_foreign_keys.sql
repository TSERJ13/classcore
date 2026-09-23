-- Audit found the schema has almost no FK constraints, so a deleted
-- student/group/hall/staff/plan can silently leave dangling references
-- behind (confirmed: deleting a student already left 13 orphaned
-- subscriptions + 5 orphaned attendance rows pointing at nonexistent
-- student ids -- deleteStudentAction hard-deletes the students row but
-- never cleans up its subscriptions/attendance). Adding these FKs with
-- ON DELETE SET NULL fixes that going forward at the DB level for any
-- code path, without deleting or blocking anything -- the referencing
-- row survives, just with its dangling pointer cleared instead of left
-- dangling. Using NOT VALID where orphans already exist so this migration
-- doesn't fail or touch that pre-existing data; new rows are enforced
-- immediately, existing violators are left exactly as they were.
--
-- Deliberately NOT touching org_id -> studios.org_id here: the
-- superadmin "delete studio" route (src/app/api/superadmin/delete-studio/
-- route.ts) already deletes a studios row without cleaning up any of its
-- students/staff/etc. first, so a default (RESTRICT) FK there would start
-- rejecting that flow. Flagged separately for the owner to decide the
-- right fix (clean up children first vs. CASCADE vs. leave as-is) rather
-- than silently changing that tool's behavior in a DB audit pass.

BEGIN;

-- data cleanup: one subscription_plans row had group_id = '' (empty
-- string) instead of NULL for a "One Time" (no group) plan -- fix before
-- adding the FK so it doesn't need NOT VALID.
UPDATE public.subscription_plans SET group_id = NULL WHERE group_id = '';

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;
ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_hall_id_fkey FOREIGN KEY (hall_id) REFERENCES public.halls(id) ON DELETE SET NULL;

ALTER TABLE public.groups
  ADD CONSTRAINT groups_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.staff(id) ON DELETE SET NULL;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE SET NULL;

ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;

COMMIT;
