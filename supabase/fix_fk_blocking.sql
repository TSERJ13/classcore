-- 🚀 NUCLEAR PERSISTENCE FIX: FK RELAXATION (v2 - Robust)
-- This script removes strict Foreign Key dependencies on org_id to prevent race conditions.
BEGIN;

DO $$
DECLARE
    r RECORD;
BEGIN
    -- This query finds all Foreign Key constraints on 'org_id' columns in the public schema
    -- and drops them one by one.
    FOR r IN (
        SELECT 
            tc.table_name, 
            tc.constraint_name
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
        WHERE 
            tc.constraint_type = 'FOREIGN KEY' 
            AND kcu.column_name = 'org_id'
            AND tc.table_schema = 'public'
            AND tc.table_name IN ('students', 'groups', 'halls', 'staff', 'student_subscriptions', 'subscription_plans', 'calendar_events', 'attendance_records', 'branches')
    ) LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT ' || quote_ident(r.constraint_name);
        RAISE NOTICE '✅ Dropped constraint % from table %', r.constraint_name, r.table_name;
    END LOOP;
END $$;

-- Re-apply RLS Isolation
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
        EXECUTE format('DROP POLICY IF EXISTS "Org isolation" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Org isolation" ON public.%I FOR ALL TO authenticated 
            USING (org_id::text IN (SELECT org_id::text FROM public.profiles WHERE id = auth.uid()))', t);
    END LOOP;
END $$;

COMMIT;
