
import { createClient } from '@/lib/supabase/client';
import { type StaffMember, type Branch, type StudioSettings } from '@/types';

/**
 * MASTER SYNC BRIDGE v3.5 (EXTREME DIAGNOSTICS)
 * Hardened Cloud Anchor resolution with RLS-bypass simulation.
 */

export async function fetchFullStudioState(slug: string, orgId?: string) {
    const supabase = createClient();
    console.log('🔍 [MasterSync] STARTING FULL HYDRATION FOR:', { slug, orgId });
    
    // 1. Get Studio metadata with explicit error logging
    const { data: studio, error: studioError } = await supabase
        .from('studios')
        .select('*')
        .eq('studio_slug', slug)
        .maybeSingle();

    if (studioError) {
        console.error('❌ [MasterSync] Studio lookup error:', studioError.message);
    }

    if (!studio) {
        console.warn('⚠️ [MasterSync] No studio row in Cloud for slug:', slug);
        // If we have an orgId, we might still be able to fetch data
    }

    const targetOrgId = orgId || studio?.org_id;
    if (!targetOrgId) {
        console.error('❌ [MasterSync] Could not resolve OrgID. Aborting fetch.');
        return null;
    }

    console.log('📡 [MasterSync] Fetching collection for OrgID:', targetOrgId);

    // 2. Parallel Fetch of ABSOLUTELY EVERYTHING
    // Note: We use maybeSingle() for settings to avoid 406
    const [
        { data: students, error: e1 },
        { data: staff, error: e2 },
        { data: groups, error: e3 },
        { data: branches, error: e4 },
        { data: halls, error: e5 },
        { data: settingsRecord, error: e6 },
        { data: subs, error: e7 },
        { data: records, error: e8 },
        { data: salesHistory, error: e9 },
        { data: expenseLogs, error: e10 },
        { data: trashBin, error: e11 }
    ] = await Promise.all([
        supabase.from('students').select('*').eq('org_id', targetOrgId),
        supabase.from('staff').select('*').eq('org_id', targetOrgId),
        supabase.from('groups').select('*').eq('org_id', targetOrgId),
        supabase.from('branches').select('*').eq('org_id', targetOrgId),
        supabase.from('halls').select('*').eq('org_id', targetOrgId),
        supabase.from('studio_settings').select('*').eq('org_id', targetOrgId).maybeSingle(),
        supabase.from('subscriptions').select('*').eq('org_id', targetOrgId),
        supabase.from('attendance').select('*').eq('org_id', targetOrgId),
        supabase.from('sales').select('*').eq('org_id', targetOrgId),
        supabase.from('expenses').select('*').eq('org_id', targetOrgId),
        supabase.from('trash').select('*').eq('org_id', targetOrgId)
    ]);

    // Check for major failures
    if (e1) console.error('❌ [MasterSync] Students fetch failed:', e1.message);
    
    console.log('📊 [MasterSync] Cloud Extraction Complete:', {
        students: students?.length || 0,
        staff: staff?.length || 0,
        groups: groups?.length || 0,
        settingsFound: !!settingsRecord
    });

    return {
        studio: studio || { studio_slug: slug, studio_name: 'Recovered Studio', org_id: targetOrgId },
        settingsRecord: settingsRecord || null,
        students: students || [],
        staff: staff || [],
        groups: groups || [],
        branches: branches || [],
        halls: halls || [],
        subscriptions: subs || [],
        attendance: records || [],
        sales: salesHistory || [],
        expenses: expenseLogs || [],
        trash: trashBin || [],
        org_id: targetOrgId
    };
}

export async function syncRecordToCloud(table: string, record: any, orgId: string) {
    const supabase = createClient();
    if (!orgId) return false;

    const payload = { ...record, org_id: orgId };
    const { error } = await supabase
        .from(table)
        .upsert(payload, { onConflict: 'id' });

    if (error) {
        console.error(`❌ [MasterSync] Upsert failed for ${table}:`, error.message);
        return false;
    }
    return true;
}

export async function pushFullStudioMetadata(slug: string, name: string, settings: any) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('studios')
        .upsert({
            studio_slug: slug,
            studio_name: name,
            settings: settings
        }, { onConflict: 'studio_slug' })
        .select('org_id')
        .single();
    
    return data?.org_id;
}

export async function ensureStudioExists(slug: string, name: string) {
    const supabase = createClient();
    console.log('🛡️ [MasterSync] Verifying Cloud Anchor for:', slug);
    
    try {
        // 1. Aggressive Discovery
        const { data: studios, error: findError } = await supabase
            .from('studios')
            .select('org_id')
            .eq('studio_slug', slug);
        
        if (findError) console.warn('⚠️ [MasterSync] Discovery error:', findError.message);

        if (studios && studios.length > 0) {
            console.log('🛡️ [MasterSync] Cloud Anchor Resolved:', studios[0].org_id);
            return studios[0].org_id;
        }

        // 3. Create if missing (Only if we cannot find it anywhere else)

        console.log('🛡️ [MasterSync] Anchor missing. Creating new cloud silo...');
        const { data: created, error: createError } = await supabase
            .from('studios')
            .insert({
                studio_slug: slug,
                studio_name: name || 'S_T Dance Studio'
            })
            .select('org_id')
            .single();
        
        if (createError) throw createError;
        return created.org_id;

    } catch (err) {
        console.error('❌ [MasterSync] Anchor failed:', err);
        return null;
    }
}
