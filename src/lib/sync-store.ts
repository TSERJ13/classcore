
import { createClient } from '@/lib/supabase/client';
import { markLocalUpdate as markUtilsUpdate } from './utils';

/**
 * SYNC STORE v3.2 (RECOVERY)
 * Core Identity Resolution for Universal Hydration.
 */

export function markLocalUpdate() {
    markUtilsUpdate();
}

export function triggerInstantSync() {
    window.dispatchEvent(new Event('cc_instant_sync_request'));
}

/** 
 * Universal Identity Recovery: Find all organizations linked to a specific email.
 * Critical for multi-device sync and cross-slug recovery.
 */
export async function findAllStudiosByStaffEmail(email: string) {
    const supabase = createClient();
    const cleanEmail = email.trim().toLowerCase();

    // 1. Check studio_settings table (normalized source)
    const { data: settingsMatches } = await supabase
        .from('studio_settings')
        .select('org_id, logo_url')
        .contains('staff_emails', [cleanEmail]);

    if (!settingsMatches || settingsMatches.length === 0) {
        // 2. Fallback to direct staff table check
        const { data: staffMatches } = await supabase
            .from('staff')
            .select('org_id')
            .eq('email', cleanEmail);
            
        if (!staffMatches || staffMatches.length === 0) return [];
        
        // Resolve slugs for these orgIds
        const orgIds = staffMatches.map(m => m.org_id);
        const { data: studios } = await supabase
            .from('studios')
            .select('studio_slug, studio_name, org_id')
            .in('org_id', orgIds);
            
        return (studios || []).map(s => ({
            slug: s.studio_slug,
            name: s.studio_name,
            staff: { org_id: s.org_id }
        }));
    }

    // Resolve slugs for recovered org_ids
    const orgIds = settingsMatches.map(m => m.org_id);
    const { data: studios } = await supabase
        .from('studios')
        .select('studio_slug, studio_name, org_id')
        .in('org_id', orgIds);

    return (studios || []).map(s => ({
        slug: s.studio_slug,
        name: s.studio_name,
        staff: { org_id: s.org_id }
    }));
}

/** Legacy placeholder for compatibility */
export async function fetchStaffFromCloud(slug: string) {
    const supabase = createClient();
    const { data } = await supabase.from('studios').select('org_id').eq('studio_slug', slug).single();
    if (data?.org_id) {
        const { data: staff } = await supabase.from('staff').select('*').eq('org_id', data.org_id);
        return staff;
    }
    return null;
}

export async function pullStudioStateFromCloud() { return null; }
export async function pushStudioStateToCloud() { return true; }

/**
 * Targeted verification for session integrity.
 * Used during login and provider initialization to ensure a session remains valid.
 */
export async function verifyUserInStudio(slug: string, email: string) {
    const supabase = createClient();
    const cleanEmail = email.trim().toLowerCase();
    
    // 1. Resolve OrgID for this specific slug
    const { data: studio, error: studioError } = await supabase
        .from('studios')
        .select('org_id')
        .eq('studio_slug', slug)
        .single();
        
    if (studioError || !studio) {
        console.warn(`🚨 [Verify] Studio not found for slug: ${slug}`);
        return false;
    }
    
    // 2. Check staff table for direct matching
    const { data: staff, error: staffError } = await supabase
        .from('staff')
        .select('id')
        .eq('org_id', studio.org_id)
        .eq('email', cleanEmail)
        .maybeSingle();
        
    if (staff) return true;
    
    // 3. Robust Fallback: Check studio_settings staff_emails array (normalized source of truth)
    const { data: settings, error: settingsError } = await supabase
        .from('studio_settings')
        .select('org_id')
        .eq('org_id', studio.org_id)
        .contains('staff_emails', [cleanEmail])
        .maybeSingle();

    if (settings) return true;

    console.warn(`🚨 [Verify] User ${cleanEmail} has no registered access to studio ${slug} (OrgID: ${studio.org_id})`);
    return false;
}

/**
 * Checks if the cloud backend (Supabase) is reachable.
 */
export async function checkCloudConnection(): Promise<boolean> {
    try {
        const supabase = createClient();
        const { error } = await supabase.from('studios').select('count', { count: 'exact', head: true });
        return !error;
    } catch {
        return false;
    }
}

/**
 * Synchronizes staff data to the cloud for a given studio.
 */
export async function syncStaffToCloud(slug: string, staff: any[]) {
    const supabase = createClient();
    const { data: studio } = await supabase.from('studios').select('org_id').eq('studio_slug', slug).single();
    if (!studio?.org_id) return;

    // Upsert staff members to the cloud
    const staffWithOrg = staff.map(s => ({ ...s, org_id: studio.org_id }));
    const { error } = await supabase
        .from('staff')
        .upsert(staffWithOrg, { onConflict: 'email,org_id' });

    if (error) console.error('❌ [Sync] Staff sync failed:', error.message);
}

/**
 * Performs a deep purge of all studio data from the cloud.
 * Danger: This is a destructive operation.
 */
export async function masterStudioPurge(slug: string) {
    const supabase = createClient();
    const { data: studio } = await supabase.from('studios').select('org_id').eq('studio_slug', slug).single();
    if (!studio?.org_id) return;

    const orgId = studio.org_id;
    const tables = ['students', 'staff', 'groups', 'branches', 'halls', 'studio_settings', 'subscriptions', 'attendance', 'sales', 'expenses'];
    
    for (const table of tables) {
        await supabase.from(table).delete().eq('org_id', orgId);
    }
    
    // Finally delete the studio record itself
    await supabase.from('studios').delete().eq('studio_slug', slug);
}


