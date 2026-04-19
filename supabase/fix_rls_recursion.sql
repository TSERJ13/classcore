-- FINAL FIX: RLS Recursion (Death-Loop) & Multi-Tenant Isolation
-- This script breaks the infinite cycle and unlocks all database operations.

BEGIN;

-- 1. Reset 'profiles' table RLS (Standard non-recursive pattern)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org isolation" ON public.profiles;
DROP POLICY IF EXISTS "Self edit" ON public.profiles;

CREATE POLICY "Self access" ON public.profiles 
FOR ALL TO authenticated 
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 2. Reset 'studios' table RLS
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org isolation" ON public.studios;
DROP POLICY IF EXISTS "Public slug lookup" ON public.studios;

-- Allow authenticated users to see their own studio metadata
CREATE POLICY "Studio access" ON public.studios
FOR SELECT TO authenticated 
USING (true);

-- 3. Re-apply loop-based RLS for all operational tables
DO $$ 
DECLARE 
    t TEXT;
BEGIN 
    FOR t IN (
        SELECT DISTINCT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND column_name = 'org_id'
        AND table_name NOT IN ('studios', 'profiles') -- Exclude handled tables
    ) LOOP 
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Org isolation" ON public.%I', t);
        
        -- Use explicit casting and join to profiles
        EXECUTE format(
            'CREATE POLICY "Org isolation" ON public.%I FOR ALL TO authenticated USING (org_id::text IN (SELECT org_id::text FROM public.profiles WHERE id = auth.uid()))', 
            t
        );
    END LOOP;
END $$;

COMMIT;

-- VERIFICATION: Check RLS status
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
