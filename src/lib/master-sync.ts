
import { createClient } from '@/lib/supabase/client';
import { type StaffMember, type Branch, type StudioSettings } from '@/types';

/**
 * MASTER SYNC BRIDGE v3.1
 * Normalized Table-based sync with global hydration and identity consolidation.
 */

export async function fetchFullStudioState(slug: string, orgId?: string) {
    const supabase = createClient();
    
    // 1. Get Studio metadata first
    const { data: studio, error: studioError } = await supabase
        .from('studios')
        .select('*')
        .eq('studio_slug', slug)
        .single();

    if (studioError || !studio) {
        console.error('❌ [MasterSync] Studio not found:', slug);
        return null;
    }

    const targetOrgId = studio.org_id;

    // 2. Parallel Fetch of ABSOLUTELY EVERYTHING
    const [
        { data: students },
        { data: staff },
        { data: groups },
        { data: branches },
        { data: halls },
        { data: settingsRecord },
        { data: subs },
        { data: records },
        { data: salesHistory },
        { data: expenseLogs },
        { data: trashBin }
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

    return {
        studio,
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
    console.log('🛡️ [MasterSync] Testing Cloud Anchor for:', slug);
    const supabase = createClient();
    
    try {
        // 1. Aggressive Cloud Anchor Lookup
        const { data: studios } = await supabase
            .from('studios')
            .select('org_id')
            .eq('studio_slug', slug);
        
        if (studios && studios.length > 0) {
            console.log('🛡️ [MasterSync] Verified Cloud Anchor (Aggressive):', studios[0].org_id);
            return studios[0].org_id;
        }

        // 2. Create if missing
        console.log('🛡️ [MasterSync] Creating new Cloud Anchor...');
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
        console.error('❌ [MasterSync] Anchor resolution failed:', err);
        return null;
    }
}
