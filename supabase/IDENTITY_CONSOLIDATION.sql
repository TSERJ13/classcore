
-- 🛡️ MASTER IDENTITY CONSOLIDATION
-- This script merges all studios associated with the user into stdancestudio.

DO $$
DECLARE
    target_org_id UUID;
    v_user_email TEXT := 'stdancegroup@gmail.com';
    v_target_slug TEXT := 'stdancestudio';
BEGIN
    -- 1. Identify the 'Survivor' studio (stdancestudio)
    SELECT org_id INTO target_org_id 
    FROM public.studios 
    WHERE studio_slug = v_target_slug;

    -- 2. If it doesn't exist, pick the first one from this email
    IF target_org_id IS NULL THEN
        SELECT org_id INTO target_org_id 
        FROM public.studio_settings 
        WHERE staff_emails @> ARRAY[v_user_email] 
        LIMIT 1;
    END IF;

    -- 3. If we still have nothing, we can't merge.
    IF target_org_id IS NULL THEN
        RAISE NOTICE 'No studios found for this email. Please create one first.';
        RETURN;
    END IF;

    RAISE NOTICE 'Consolidating all data to OrgID: %', target_org_id;

    -- 4. Update the 'studios' table to ensure stdancestudio has this OrgID
    INSERT INTO public.studios (studio_slug, studio_name, org_id)
    VALUES (v_target_slug, 'S_T Dance Studio', target_org_id)
    ON CONFLICT (studio_slug) DO UPDATE SET org_id = target_org_id;

    -- 5. RE-ASSIGN ALL ORPHANED DATA to the target OrgID
    -- (This fixes the 'Data not found' on other devices)
    UPDATE public.students SET org_id = target_org_id WHERE org_id != target_org_id;
    UPDATE public.staff SET org_id = target_org_id WHERE org_id != target_org_id;
    UPDATE public.groups SET org_id = target_org_id WHERE org_id != target_org_id;
    UPDATE public.branches SET org_id = target_org_id WHERE org_id != target_org_id;
    UPDATE public.halls SET org_id = target_org_id WHERE org_id != target_org_id;
    UPDATE public.studio_settings SET org_id = target_org_id WHERE org_id != target_org_id;
    UPDATE public.subscriptions SET org_id = target_org_id WHERE org_id != target_org_id;
    UPDATE public.attendance SET org_id = target_org_id WHERE org_id != target_org_id;
    UPDATE public.sales SET org_id = target_org_id WHERE org_id != target_org_id;
    UPDATE public.expenses SET org_id = target_org_id WHERE org_id != target_org_id;

    -- 6. Cleanup duplicate studios that are NOT our target
    DELETE FROM public.studios WHERE studio_slug != v_target_slug AND org_id = target_org_id;
END $$;
