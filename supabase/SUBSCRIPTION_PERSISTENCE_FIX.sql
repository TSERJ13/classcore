-- 🚀 SUBSCRIPTION PERSISTENCE FIX: ENSURE COMPLEX DATA IS SAVED
-- This script adds missing columns and a 'data' JSONB blob for flexibility.

BEGIN;

-- 1. Update 'subscriptions' table
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_type TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS group_id TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS couple_partner_id TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS couple_partner_name TEXT;

-- 2. Update 'attendance' table
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS end_time TIME;

-- 3. Update 'calendar_events' table
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS couple_partner_id TEXT;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS couple_partner_name TEXT;

-- 4. Grant access (Ensuring sync works)
GRANT ALL ON public.subscriptions TO anon, authenticated;
GRANT ALL ON public.attendance TO anon, authenticated;
GRANT ALL ON public.calendar_events TO anon, authenticated;

COMMIT;
