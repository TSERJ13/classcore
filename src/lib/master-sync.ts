
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

    // 2. Parallel Fetch of all collections
    const [
        { data: students },
        { data: staff },
        { data: groups },
        { data: branches },
        { data: halls }
    ] = await Promise.all([
        supabase.from('students').select('*').eq('org_id', targetOrgId),
        supabase.from('staff').select('*').eq('org_id', targetOrgId),
        supabase.from('groups').select('*').eq('org_id', targetOrgId),
        supabase.from('branches').select('*').eq('org_id', targetOrgId),
        supabase.from('halls').select('*').eq('org_id', targetOrgId)
    ]);

    return {
        studio,
        students: students || [],
        staff: staff || [],
        groups: groups || [],
        branches: branches || [],
        halls: halls || [],
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
    const supabase = createClient();
    
    // Check if exists
    const { data: existing } = await supabase
        .from('studios')
        .select('org_id')
        .eq('studio_slug', slug)
        .single();
    
    if (existing?.org_id) return existing.org_id;

    // Create it
    const { data: created, error } = await supabase
        .from('studios')
        .insert({
            studio_slug: slug,
            studio_name: name,
            org_id: uuidv4() // We need a way to generate UUID, I'll use crypto.randomUUID()
        })
        .select('org_id')
        .single();

    if (error) console.error('❌ [MasterSync] Failed to bootstrap studio:', error.message);
    return created?.org_id;
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
