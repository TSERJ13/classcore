
-- 🛡️ MASTER IDENTITY CONSOLIDATION (SAFE VERSION)
-- This script merges all studios associated with the user into one 'Survivor' studio.
-- CRITICAL: This now only affects data linked to the specified email to prevent multi-tenant pollution.

DO $$
DECLARE
    target_org_id UUID;
    v_user_email TEXT := 'stdancegroup@gmail.com';
    v_target_slug TEXT := 'stdancestudio';
    v_source_org_ids UUID[];
BEGIN
    -- 1. Identify the 'Survivor' studio (stdancestudio)
    SELECT org_id INTO target_org_id 
    FROM public.studios 
    WHERE studio_slug = v_target_slug;

    -- 2. Find ALL OrgIDs associated with this email
    SELECT ARRAY_AGG(org_id) INTO v_source_org_ids
    FROM public.studio_settings 
    WHERE staff_emails @> ARRAY[v_user_email];

    -- 3. If target_org_id is missing, pick the first one from sources
    IF target_org_id IS NULL AND v_source_org_ids IS NOT NULL THEN
        target_org_id := v_source_org_ids[1];
    END IF;

    -- 4. If we still have nothing, we can't merge.
    IF target_org_id IS NULL THEN
        RAISE NOTICE 'No studios found for email: %. Aborting.', v_user_email;
        RETURN;
    END IF;

    RAISE NOTICE 'Consolidating user (%) data to OrgID: %', v_user_email, target_org_id;

    -- 5. Ensure the target studio exists or is updated
    INSERT INTO public.studios (studio_slug, studio_name, org_id)
    VALUES (v_target_slug, 'S_T Dance Studio', target_org_id)
    ON CONFLICT (studio_slug) DO UPDATE SET org_id = target_org_id;

    -- 6. RE-ASSIGN DATA ONLY for the OrgIDs found for this user
    -- This prevents affecting other users in a shared database.
    
    UPDATE public.students SET org_id = target_org_id WHERE org_id = ANY(v_source_org_ids) AND org_id != target_org_id;
    UPDATE public.staff SET org_id = target_org_id WHERE org_id = ANY(v_source_org_ids) AND org_id != target_org_id;
    UPDATE public.groups SET org_id = target_org_id WHERE org_id = ANY(v_source_org_ids) AND org_id != target_org_id;
    UPDATE public.branches SET org_id = target_org_id WHERE org_id = ANY(v_source_org_ids) AND org_id != target_org_id;
    UPDATE public.halls SET org_id = target_org_id WHERE org_id = ANY(v_source_org_ids) AND org_id != target_org_id;
    UPDATE public.studio_settings SET org_id = target_org_id WHERE org_id = ANY(v_source_org_ids) AND org_id != target_org_id;
    UPDATE public.subscriptions SET org_id = target_org_id WHERE org_id = ANY(v_source_org_ids) AND org_id != target_org_id;
    UPDATE public.attendance SET org_id = target_org_id WHERE org_id = ANY(v_source_org_ids) AND org_id != target_org_id;
    UPDATE public.sales SET org_id = target_org_id WHERE org_id = ANY(v_source_org_ids) AND org_id != target_org_id;
    UPDATE public.expenses SET org_id = target_org_id WHERE org_id = ANY(v_source_org_ids) AND org_id != target_org_id;

    -- 7. Cleanup only studios that belong to the user's old OrgIDs
    DELETE FROM public.studios 
    WHERE studio_slug != v_target_slug 
    AND org_id = ANY(v_source_org_ids);

    RAISE NOTICE 'Consolidation complete for email: %', v_user_email;
END $$;
