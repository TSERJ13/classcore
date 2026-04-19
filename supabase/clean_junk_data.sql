-- 🧹 FINAL DATABASE CLEANUP: Scorched Earth v2.4 (Performance Edition)
-- This script safely removes legacy JSON blobs to reclaim storage and optimize sync.

BEGIN;

-- 1. Clear legacy blobs from the MASTER table
-- We keep 'studio_slug' and 'org_id' as they are the primary keys for sync.
UPDATE public.studios
SET 
    settings = NULL,
    owner_info = NULL,
    updated_at = now()
WHERE studio_slug NOT IN ('demo.classcore.ge', 'superadmin');

-- 2. Clear legacy blobs from the SEARCH table
-- We keep 'staff_emails' so the "Search for my studio" feature still works,
-- but we remove the giant 'staff_data' JSON blob which is redundant.
UPDATE public.studio_settings
SET 
    staff_data = NULL,
    updated_at = now()
WHERE studio_slug NOT IN ('demo.classcore.ge', 'superadmin');

COMMIT;

-- ✅ Cloud cleaned. Storage reclaimed.
