
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
    let responses: any[] = [];
    try {
        responses = await Promise.all([
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
            supabase.from('trash').select('*').eq('org_id', targetOrgId),
            supabase.from('calendar_events').select('*').eq('org_id', targetOrgId)
        ]);
    } catch (e) {
        console.error('❌ [MasterSync] Collective fetch failed:', e);
        // Fallback to empty responses to allow partial hydration
        responses = Array(12).fill({ data: [], error: { message: 'Timeout/Network Error' } });
    }

    const data = responses.map(r => r?.data || []);
    const errors = responses.map(r => r?.error);

    const data = responses.map(r => r.data);
    const errors = responses.map(r => r.error);

    if (errors[0]) console.error('❌ [MasterSync] Students fetch failed:', errors[0].message);
    if (errors[2]) console.error('❌ [MasterSync] Groups fetch failed:', errors[2].message);

    console.log('📊 [MasterSync] Cloud Extraction Complete:', {
        students: data[0]?.length || 0,
        staff: data[1]?.length || 0,
        groups: data[2]?.length || 0,
        events: data[11]?.length || 0,
        settingsFound: !!data[5]
    });

    return {
        studio: studio || { studio_slug: slug, studio_name: 'Recovered Studio', org_id: targetOrgId },
        settingsRecord: data[5] || null,
        students: data[0] || [],
        staff: data[1] || [],
        groups: data[2] || [],
        branches: data[3] || [],
        halls: data[4] || [],
        subscriptions: data[6] || [],
        attendance: data[7] || [],
        sales: data[8] || [],
        expenses: data[9] || [],
        trash: data[10] || [],
        calendar_events: data[11] || [],
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
export async function deleteRecordFromCloud(table: string, id: string, orgId: string) {
    const supabase = createClient();
    if (!orgId || !id) return false;

    console.log(`🗑️ [MasterSync] Permanent deletion from ${table}:`, id);
    const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)
        .eq('org_id', orgId);

    if (error) {
        console.error(`❌ [MasterSync] Delete failed for ${table}:`, error.message);
        return false;
    }
    return true;
}
