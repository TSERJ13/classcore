-- 🧹 TOTAL DATABASE CLEANUP: Scorched Earth v2.6 (Zero Exceptions)
-- This script removes ALL legacy JSON blobs ('junk data') from ALL studios.
-- Run this to reclaim max storage and move entirely to granular SQL truth.

BEGIN;

-- 1. Clear legacy blobs from the MASTER table (studios)
-- Wipes 'settings' and 'owner_info' for EVERY studio in the system.
UPDATE public.studios
SET 
    settings = NULL,
    owner_info = NULL,
    updated_at = now();

-- 2. Clear legacy blobs from the SEARCH table (studio_settings)
-- Setting staff_data to an empty array [] to avoid NOT NULL violation.
-- Wipes EVERY record's giant JSON blob.
UPDATE public.studio_settings
SET 
    staff_data = '[]'::jsonb,
    updated_at = now();

COMMIT;

-- ✅ Total cleanup complete. No exceptions.
