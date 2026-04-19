-- 🚨 FINAL PERSISTENCE INTEGRITY FIX
-- Ensures profiles exist and RLS is synced correctly.
BEGIN;

-- 1. Create Profiles table if missing
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID,
    full_name TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Policy: User can always manage their own profile
DROP POLICY IF EXISTS "Self manage" ON public.profiles;
CREATE POLICY "Self manage" ON public.profiles FOR ALL TO authenticated 
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 4. Re-apply global Isolation for ALL operational tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN (
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('students', 'groups', 'halls', 'staff', 'student_subscriptions', 'subscription_plans', 'calendar_events', 'attendance_records')
    ) LOOP
        -- Wipe old policies
        EXECUTE format('DROP POLICY IF EXISTS "Org isolation" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access for authenticated" ON public.%I', t);
        
        -- Apply THE truth: User can only see/edit data if their Profile OrgId matches the Table OrgId
        EXECUTE format('CREATE POLICY "Org isolation" ON public.%I FOR ALL TO authenticated 
            USING (org_id::text IN (SELECT org_id::text FROM public.profiles WHERE id = auth.uid()))', t);
            
        -- Ensure RLS is enabled
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

COMMIT;
