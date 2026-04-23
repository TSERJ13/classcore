
import { createClient } from '@/lib/supabase/client';
import { type StaffMember, type Branch, type StudioSettings } from '@/types';

/**
 * MASTER SYNC BRIDGE v3.0
 * This library handles the transition from Blob-based sync to Normalized Table-based sync.
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
        { data: records }, -- attendance
        { data: salesHistory },
        { data: expenseLogs },
        { data: trashBin }
    ] = await Promise.all([
        supabase.from('students').select('*').eq('org_id', targetOrgId),
        supabase.from('staff').select('*').eq('org_id', targetOrgId),
        supabase.from('groups').select('*').eq('org_id', targetOrgId),
        supabase.from('branches').select('*').eq('org_id', targetOrgId),
        supabase.from('halls').select('*').eq('org_id', targetOrgId),
        supabase.from('studio_settings').select('*').eq('org_id', targetOrgId).single(),
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

    // Ensure org_id is present
    const payload = { ...record, org_id: orgId };
    
    // Some tables use 'id' as primary, others might vary.
    // For our master schema, students/staff/groups all use 'id' as primary TEXT.
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
        // Check if exists
        console.log('🛡️ [MasterSync] Checking existence...');
        const { data: existing, error: checkError } = await supabase
            .from('studios')
            .select('org_id')
            .eq('studio_slug', slug)
            .single();
        
        if (checkError && checkError.code !== 'PGRST116') {
            console.error('🛡️ [MasterSync] Check failed:', checkError.message);
        }

        if (existing?.org_id) {
            console.log('🛡️ [MasterSync] Anchor found:', existing.org_id);
            return existing.org_id;
        }

        // Create it
        console.log('🛡️ [MasterSync] Creating new cloud anchor for studio...');
        const newOrgId = uuidv4();
        const { data: created, error } = await supabase
            .from('studios')
            .insert({
                studio_slug: slug,
                studio_name: name || slug,
                org_id: newOrgId
            })
            .select('org_id')
            .single();

        if (error) {
            console.error('❌ [MasterSync] Failed to bootstrap studio:', error.message);
            // If it failed because it already exists (race condition), try fetching again
            if (error.code === '23505') {
                const { data: retry } = await supabase.from('studios').select('org_id').eq('studio_slug', slug).single();
                return retry?.org_id;
            }
        }
        
        console.log('🛡️ [MasterSync] Anchor created successfully:', created?.org_id || newOrgId);
        return created?.org_id || newOrgId;
    } catch (err) {
        console.error('🛡️ [MasterSync] Critical anchor failure:', err);
        return null;
    }
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
