import { createClient } from './supabase/client';
import { type StaffMember } from '@/types';

const SETTINGS_TABLE = 'studio_settings';

/**
 * Consolidates all studio state into a single push to prevent race conditions or overwrites.
 * Updates staff_data, staff_emails, and studio_data in one UPSERT.
 */
/**
 * Consolidates all studio state into a single push with Optimistic Locking and Retry logic.
 * Ensures that concurrent updates from multiple clients do not overwrite each other.
 */
export async function pushStudioStateToCloud(slug: string, staff: StaffMember[], studioData: any, retryCount = 0, orgId?: string): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!slug || slug === 'demo.classcore.ge') return;

    try {
        const supabase = createClient();

        // 1. Pull latest cloud state to merge (Optimistic Locking approach)
        // Prefer orgId for lookup if available, fallback to slug
        let query = supabase.from(SETTINGS_TABLE).select('staff_data, updated_at, studio_slug');
        query = query.eq('studio_slug', slug);
        
        const { data: current, error: pullError } = await query.maybeSingle();

        if (pullError) throw pullError;

        let finalStaff: StaffMember[] = staff;
        let finalStudioData: any = studioData;

        // If row exists, perform a merge to avoid overwriting others' changes
        if (current) {
            const cloudAll = (current.staff_data as any[]) || [];
            const cloudStaff = cloudAll.filter(s => s.id !== '__studio_config__');
            const cloudConfig = cloudAll.find(s => s.id === '__studio_config__')?.studio_data || {};

            // 1. Staff List: Local version is the source of truth for membership (handles deletes/adds/updates)
            // The optimistic lock (updated_at) ensures we have recently pulled the latest cloud staff if we are pushing.
            finalStaff = staff;

            // 2. Studio Data: Overwrite specific keys provided by local client
            // This ensures deletions within collections (groups, halls, etc) are correctly persisted.
            finalStudioData = { ...cloudConfig };
            for (const key in studioData) {
                finalStudioData[key] = studioData[key];
            }
        }

        const consolidatedStaff = [
            ...finalStaff.filter(s => s.id !== '__studio_config__'),
            { id: '__studio_config__', studio_data: finalStudioData } as any
        ];

        const nextUpdatedAt = new Date().toISOString();
        const staffEmails = finalStaff.filter(s => s.email).map(s => s.email!.toLowerCase().trim());

        // Resolve orgId: prioritize the passed argument, then the setting inside finalStudioData
        const finalOrgId = orgId || finalStudioData.orgId || finalStudioData.org_id || '';

        if (!current) {
            // First time: Use insert to fail on conflict, triggering retry + pull/merge
            const { error: insertError } = await supabase
                .from(SETTINGS_TABLE)
                .insert({
                    studio_slug: slug,
                    org_id: finalOrgId, // PERSIST ORG_ID EXPLICITLY
                    staff_data: consolidatedStaff,
                    staff_emails: staffEmails,
                    updated_at: nextUpdatedAt
                });
            
            if (insertError) {
                // If it failed because it already exists (Postgres code 23505), it's fine, the retry will pull it.
                if (insertError.code === '23505') {
                    throw new Error('Conflict: Row already exists');
                }
                throw insertError;
            }
        } else {
            // Optimistic Update: Only update if updated_at matches what we just pulled
            const updatePayload: any = {
                staff_data: consolidatedStaff,
                staff_emails: staffEmails,
                updated_at: nextUpdatedAt,
                studio_slug: slug, // Keep slug in sync if it changed
            };

            // Only update org_id if it's currently missing or we have a more authoritative one
            if (finalOrgId) {
                updatePayload.org_id = finalOrgId;
            }

            let updateQuery = supabase.from(SETTINGS_TABLE).update(updatePayload, { count: 'exact' });

            updateQuery = updateQuery.eq('studio_slug', current.studio_slug);

            const { error: updateError, count } = await updateQuery.eq('updated_at', current.updated_at);

            if (updateError) throw updateError;
            
            // Conflict check: If count is 0, someone else updated it. Throw to retry.
            if (count === 0) {
                throw new Error('Conflict: Record updated by another client');
            }
        }

        console.log('✅ Cloud Sync Consolidated Push Successful for:', slug, finalOrgId ? `(ID: ${finalOrgId})` : '');
    } catch (err: any) {
        if (retryCount < 5) {
            console.warn(`🔄 Cloud Sync Conflict detected, retrying (${retryCount + 1}/5)...`, err.message);
            // Exponential backoff with jitter
            const delay = Math.pow(2, retryCount) * 100 + Math.random() * 200;
            await new Promise(r => setTimeout(r, delay));
            return pushStudioStateToCloud(slug, staff, studioData, retryCount + 1, orgId);
        }
        console.error('❌ Consolidated Sync Critical Error:', err);
    }
}

/** 
 * Fetches the entire studio row from Supabase.
 */
export async function pullStudioStateFromCloud(slug: string, orgId?: string): Promise<{ staff_data: StaffMember[], studio_data: any } | null> {
    if (typeof window === 'undefined') return null;
    if (!slug || slug === 'demo.classcore.ge') return null;

    try {
        const supabase = createClient();
        let query = supabase.from(SETTINGS_TABLE).select('staff_data, updated_at');
        query = query.eq('studio_slug', slug);

        const { data, error } = await query.maybeSingle();

        if (error || !data) return null;

        const allData = data.staff_data as any[];
        const configEntry = allData.find(item => item.id === '__studio_config__');
        const realStaff = allData.filter(item => item.id !== '__studio_config__');

        return {
            staff_data: realStaff as StaffMember[],
            studio_data: configEntry?.studio_data || {}
        };
    } catch {
        return null;
    }
}

// Keep legacy functions for backward compatibility or simple leaf calls if needed, 
// but preferred use is the consolidated ones above.

export async function syncStaffToCloud(slug: string, staff: StaffMember[], orgId?: string) {
    return pushStudioStateToCloud(slug, staff, {}, 0, orgId); // Pass orgId
}

export async function fetchStaffFromCloud(slug: string): Promise<StaffMember[] | null> {
    const state = await pullStudioStateFromCloud(slug);
    return state?.staff_data || null;
}

export async function findAllStudiosByStaffEmail(email: string): Promise<{ staff: StaffMember, slug: string }[]> {
    if (typeof window === 'undefined') return [];
    const cleanEmail = email.trim().toLowerCase();

    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from(SETTINGS_TABLE)
            .select('studio_slug, staff_data, staff_emails')
            .contains('staff_emails', [cleanEmail]);

        if (error || !data) return [];

        const results: { staff: StaffMember, slug: string }[] = [];
        
        data.forEach(row => {
            const staff = (row.staff_data as StaffMember[]).find(s =>
                s.email?.toLowerCase().trim() === cleanEmail
            );
            if (staff) {
                results.push({ staff, slug: row.studio_slug });
            }
        });

        return results;
    } catch (err) {
        return [];
    }
}

export async function checkCloudConnection(slug: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!slug || slug === 'demo.classcore.ge') return false;

    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from(SETTINGS_TABLE)
            .select('studio_slug')
            .eq('studio_slug', slug)
            .maybeSingle();

        return !error && !!data;
    } catch {
        return false;
    }
}

export async function syncStudioDataToCloud(slug: string, data: any, orgId?: string) {
    // Redirection to consolidated push to maintain backward compatibility safely
    // Note: We don't have the staff list here, so we load it from local first
    const { loadSettings } = await import('./settings-store');
    const settings = loadSettings(slug);
    return pushStudioStateToCloud(slug, settings.staff, data, 0, orgId || settings.orgId);
}

export async function fetchStudioDataFromCloud(slug: string): Promise<any | null> {
    const state = await pullStudioStateFromCloud(slug);
    return state?.studio_data || null;
}
