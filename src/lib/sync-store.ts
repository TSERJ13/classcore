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

        if (pullError) {
            console.error('❌ [SyncStore] Pull error:', pullError);
            throw pullError;
        }

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

            // 2. Studio Data: Deep Merge specific collections instead of overwriting whole arrays
            finalStudioData = { ...cloudConfig };
            
            // Base prefixes for collections and their corresponding tombstones
            const TOMBSTONES: Record<string, string> = {
                'cc_student_data': 'cc_deleted_students',
                'cc_groups': 'cc_deleted_groups',
                'cc_halls': 'cc_deleted_halls',
                'cc_student_subscriptions': 'cc_deleted_subscriptions'
            };

            // 1. PRE-EXTRACT ALL TOMBSTONES from both sides to ensure they are available for any collection merge
            const allTombstoneKeys = new Set<string>();
            Object.values(TOMBSTONES).forEach(prefix => {
                // Find all keys in cloud or local that match this tombstone prefix
                Object.keys(cloudConfig).concat(Object.keys(studioData)).forEach(k => {
                    if (k.startsWith(prefix)) allTombstoneKeys.add(k);
                });
            });

            // Pre-calculate merged tombstones for all found keys
            const mergedTombstones: Record<string, string[]> = {};
            allTombstoneKeys.forEach(tKey => {
                const local = (studioData[tKey] || []) as string[];
                const cloud = (cloudConfig[tKey] || []) as string[];
                mergedTombstones[tKey] = Array.from(new Set([...local, ...cloud]));
                // ALWAYS PERSIST THE MERGED TOMBSTONE BACK TO CLOUD
                finalStudioData[tKey] = mergedTombstones[tKey];
            });

            for (const key in studioData) {
                const incoming = studioData[key];
                const existing = cloudConfig[key];

                // Skip if this key is ALREADY a tombstone (handled in pre-extraction above)
                const isTombstone = Object.values(TOMBSTONES).some(p => key.startsWith(p));
                if (isTombstone) continue;

                // Identify if this key corresponds to any tombstone
                let tKey: string | undefined;
                for (const [prefix, tPrefix] of Object.entries(TOMBSTONES)) {
                    if (key.startsWith(prefix)) {
                        tKey = tPrefix + key.replace(prefix, '');
                        break;
                    }
                }
                
                const deletedIds = new Set(tKey ? (mergedTombstones[tKey] || []) : []);

                if (typeof incoming === 'object' && incoming !== null && !Array.isArray(incoming)) {
                    // Record-based merge (e.g. students: Record<string, Student>)
                    const merged = { ...((existing || {}) as Record<string, any>), ...incoming };
                    
                    // Strictly enforce tombstones: Remove any ID present in the deletion registry
                    Object.keys(merged).forEach(id => {
                        if (deletedIds.has(id)) delete merged[id];
                    });
                    
                    finalStudioData[key] = merged;
                } else if (Array.isArray(incoming)) {
                    // Array-based deep merge for collections (groups, halls, etc.)
                    const merged = Array.isArray(existing) ? [...existing] : [];
                    incoming.forEach((newItem: any) => {
                        if (newItem && newItem.id) {
                            const idx = merged.findIndex((oldItem: any) => oldItem.id === newItem.id);
                            if (idx !== -1) {
                                merged[idx] = { ...merged[idx], ...newItem };
                            } else {
                                merged.push(newItem);
                            }
                        }
                    });
                    
                    // Strictly enforce tombstones: Filter out items in deletion registry
                    finalStudioData[key] = merged.filter((item: any) => !item?.id || !deletedIds.has(item.id));
                } else {
                    // Fallback: Overwrite for primitives or single-client fields
                    finalStudioData[key] = incoming;
                }
            }
        }

        const consolidatedStaff = [
            ...finalStaff.filter(s => s.id !== '__studio_config__'),
            { id: '__studio_config__', studio_data: finalStudioData } as any
        ];

        const nextUpdatedAt = new Date().toISOString();
        const staffEmails = Array.from(new Set([
            ...(finalStaff || []).map(s => s.email?.toLowerCase().trim()).filter(Boolean),
            ...(finalStaff || []).map(s => s.first_name?.toLowerCase().trim()).filter(Boolean),
            ...(finalStaff || []).map(s => s.full_name?.toLowerCase().trim()).filter(Boolean)
        ] as string[]));

        // Resolve orgId: prioritize the passed argument, then the setting inside finalStudioData
        const finalOrgId = orgId || finalStudioData.orgId || finalStudioData.org_id || '';

        // Optimization: If finalOrgId is found, cache it locally to ensure consistent scoping on next page load
        if (typeof window !== 'undefined' && finalOrgId && slug) {
            localStorage.setItem(`cc_org_id_override_${slug}`, finalOrgId);
        }

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
                console.error('❌ [SyncStore] Insert error:', insertError);
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

            if (updateError) {
                console.error('❌ [SyncStore] Update error:', updateError);
                throw updateError;
            }
            
            // Conflict check: If count is 0, someone else updated it. Throw to retry.
            if (count === 0) {
                console.warn('🔄 [SyncStore] Update conflict (count 0).');
                throw new Error('Conflict: Record updated by another client');
            }
        }

        console.log('✅ [SyncStore] Cloud Sync Successful for:', slug, finalOrgId ? `(ID: ${finalOrgId})` : '');
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

    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('QUERY_TIMEOUT')), 5000)
    );

    try {
        const supabase = createClient();
        console.log('📡 [SyncStore] Searching cloud for:', cleanEmail);
        
        const task = (async () => {
            const { data, error } = await supabase
                .from(SETTINGS_TABLE)
                .select('studio_slug, staff_data, updated_at')
                .contains('staff_emails', [cleanEmail])
                .order('updated_at', { ascending: false })
                .limit(5);

            if (error) throw error;
            return data || [];
        })();

        // Race the search task against the 5s timeout
        const data = await Promise.race([task, timeoutPromise]) as any[];
        
        if (!data || data.length === 0) return [];

        const results: { staff: StaffMember, slug: string }[] = [];
        
        data.forEach(row => {
            const staffMatch = (row.staff_data as StaffMember[]).find(s =>
                s.email?.toLowerCase().trim() === cleanEmail ||
                s.full_name?.toLowerCase().trim() === cleanEmail ||
                s.first_name?.toLowerCase().trim() === cleanEmail
            );
            if (staffMatch) {
                // Ensure org_id from staff object is used
                const staff = { ...staffMatch };
                results.push({ staff, slug: row.studio_slug });
            }

        });

        // Smart Sort: Prefer slugs that look like "real" production slugs (non-demo)
        return results.sort((a, b) => {
            const aIsDemo = a.slug.includes('demo');
            const bIsDemo = b.slug.includes('demo');
            if (aIsDemo && !bIsDemo) return 1;
            if (!aIsDemo && bIsDemo) return -1;
            return 0; // Keep the 'updated_at' order from DB as secondary
        });
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

export async function fetchStudioDataFromCloud(slug: string): Promise<any | null> {
    const state = await pullStudioStateFromCloud(slug);
    return state?.studio_data || null;
}

