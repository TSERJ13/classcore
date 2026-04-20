-- 🚀 SYNC RECOVERY FIX: Grant write access to staff (non-logged-in admin users)
-- This allows administrative changes to save even when not using Supabase Auth.

BEGIN;

-- 1. studios table: Ensure master metadata columns exist
ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS owner_info JSONB;
ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE public.studios ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

DROP POLICY IF EXISTS "Public write access" ON public.studios;
CREATE POLICY "Public write access" ON public.studios 
    FOR ALL TO anon, authenticated 
    USING (true)
    WITH CHECK (true);

-- 2. studio_settings table
DROP POLICY IF EXISTS "Public settings management" ON public.studio_settings;
CREATE POLICY "Public settings management" ON public.studio_settings 
    FOR ALL TO anon, authenticated 
    USING (true)
    WITH CHECK (true);

-- 3. staff table (for propagation)
DROP POLICY IF EXISTS "Public staff management" ON public.staff;
CREATE POLICY "Public staff management" ON public.staff 
    FOR ALL TO anon, authenticated 
    USING (true)
    WITH CHECK (true);

COMMIT;

-- ✅ Database permissions fully granted for both anonymous and authenticated users.
-- Sync functionality restored for all staff.
