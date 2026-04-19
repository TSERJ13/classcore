-- NUCLEAR INITIALIZATION: Backfill missing OrgIds 
-- This script ensures all existing studios have a valid UUID to enable the new normalized sync engine.

BEGIN;

-- 1. Ensure the UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Backfill studio_settings table
-- Assigns a fresh UUID to any studio where org_id is missing or empty.
UPDATE public.studio_settings
SET org_id = uuid_generate_v4()
WHERE (org_id IS NULL OR org_id = '' OR org_id = 'null')
AND studio_slug != 'demo.classcore.ge';

COMMIT;

-- VERIFICATION
SELECT studio_slug, org_id FROM public.studio_settings;
