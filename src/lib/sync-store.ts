
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
