-- Security Hardening: Enable RLS and define Access Policies
-- Applied to: profiles, organizations, groups_classes, subscriptions, attendance_logs
-- Purpose: Fix "Table publicly accessible" vulnerabilities

BEGIN;

-- 1. Enable RLS on all identified tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any (to ensure clean slate)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own organizations" ON public.organizations;
DROP POLICY IF EXISTS "Org members can view classes" ON public.groups_classes;
DROP POLICY IF EXISTS "Org members can view subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Org members can view attendance" ON public.attendance_logs;

-- 3. Profiles Policies
-- Users can see their own profile data (id matches auth.uid())
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Users can update their own profile data
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- 4. Dynamic Organizations Policies
-- This block dynamically finds the owner column to prevent "owner_id" missing errors
DO $$
DECLARE
    col_name TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'owner_id') THEN
        col_name := 'owner_id';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'user_id') THEN
        col_name := 'user_id';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'created_by') THEN
        col_name := 'created_by';
    END IF;

    IF col_name IS NOT NULL THEN
        EXECUTE format('CREATE POLICY "Users can view own organizations" ON public.organizations FOR SELECT TO authenticated USING (auth.uid() = %I)', col_name);
    ELSE
        -- Fallback: If no owner column is found, allow authenticated users to see their related orgs via profile
        CREATE POLICY "Users can view own organizations" ON public.organizations FOR SELECT TO authenticated 
        USING (id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));
    END IF;
END $$;

-- 5. Secure Relational Tables (Cross-Org Access Prevention)
-- These policies ensure a user can only see data belonging to their organization

-- Groups/Classes access
CREATE POLICY "Org members can view classes" 
ON public.groups_classes FOR SELECT 
TO authenticated 
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- Subscriptions access
CREATE POLICY "Org members can view subscriptions" 
ON public.subscriptions FOR SELECT 
TO authenticated 
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- Attendance logs access
CREATE POLICY "Org members can view attendance" 
ON public.attendance_logs FOR SELECT 
TO authenticated 
USING (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

-- 6. Insert Policies (Allowing creation within own Org)
CREATE POLICY "Org members can insert attendance" 
ON public.attendance_logs FOR INSERT 
TO authenticated 
WITH CHECK (org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid()));

COMMIT;
