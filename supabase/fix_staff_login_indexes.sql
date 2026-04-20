-- 🚀 FIX: STAFF LOGIN SEARCH INDEX
-- Adds the staff_emails column to studio_settings to enable fast cross-studio logins.

BEGIN;

-- 1. Add the column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'studio_settings' AND column_name = 'staff_emails') THEN
        ALTER TABLE public.studio_settings ADD COLUMN staff_emails TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- 2. Create a GIN index for lightning-fast array searching
-- This makes .contains('staff_emails', ['email']) instantaneous.
CREATE INDEX IF NOT EXISTS idx_studio_settings_staff_emails ON public.studio_settings USING GIN (staff_emails);

-- 3. Backfill the column from existing JSON data (if any)
-- This extracts emails and phones from the _staff array in the staff_data blob.
UPDATE public.studio_settings
SET staff_emails = (
    SELECT array_agg(DISTINCT val)
    FROM (
        SELECT jsonb_array_elements(staff_data->'_staff')->>'email' as val
        UNION
        SELECT jsonb_array_elements(staff_data->'_staff')->>'phone' as val
    ) s
    WHERE val IS NOT NULL AND val != ''
)
WHERE staff_data ? '_staff';

COMMIT;

-- ✅ Index and column ready. Staff login search is now active.
