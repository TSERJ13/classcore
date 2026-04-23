
-- 🚀 DISK IO OPTIMIZATION (INDEXING)
-- This script adds indexes to speed up lookups and reduce Disk IO.

-- Indexing org_id across all tables for faster queries
CREATE INDEX IF NOT EXISTS idx_studios_slug ON public.studios(studio_slug);
CREATE INDEX IF NOT EXISTS idx_students_org ON public.students(org_id);
CREATE INDEX IF NOT EXISTS idx_staff_org ON public.staff(org_id);
CREATE INDEX IF NOT EXISTS idx_groups_org ON public.groups(org_id);
CREATE INDEX IF NOT EXISTS idx_branches_org ON public.branches(org_id);
CREATE INDEX IF NOT EXISTS idx_halls_org ON public.halls(org_id);
CREATE INDEX IF NOT EXISTS idx_studio_settings_org ON public.studio_settings(org_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON public.subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_attendance_org ON public.attendance(org_id);
CREATE INDEX IF NOT EXISTS idx_sales_org ON public.sales(org_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org ON public.expenses(org_id);
CREATE INDEX IF NOT EXISTS idx_trash_org ON public.trash(org_id);

-- Speed up primary ID lookups (ID is usually primary key, but index doesn't hurt)
CREATE INDEX IF NOT EXISTS idx_students_id ON public.students(id);
CREATE INDEX IF NOT EXISTS idx_staff_id ON public.staff(id);
