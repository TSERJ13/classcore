import { createClient } from './supabase/client';
import { type StaffMember } from '@/types';

const SETTINGS_TABLE = 'studio_settings';

/** 
 * SCORCHED EARTH v2.1 Integrity Whitelist
 * Keys here are exempt from the global purge to preserve session and preferences.
 */
export const INTEGRITY_WHITELIST = [
    'cc_auth_token', 
    'cc_active_slug', 
    'cc_active_branch_',
    'cc_last_local_update',
    'cc_onboarding_done',
    'cc_theme',
    'cc_studio_name'
];

/**
 * Consolidates all studio state into a single push to prevent race conditions or overwrites.
 */
export function scrubLocalStorage(activeSlug: string, orgId?: string) {
    if (typeof window === 'undefined' || !activeSlug) return;
    
    console.log(`🛡️ [ScorchedEarth] Scrubbing localStorage for [Slug: ${activeSlug}] [OrgId: ${orgId || 'None'}]`);
    
    Object.keys(localStorage).forEach(key => {
        if (!key.startsWith('cc_')) return;
        
        // 1. Whitelist Check
        if (INTEGRITY_WHITELIST.some(p => key.startsWith(p))) return;
        
        // 2. Ownership Check
        const belongsToCurrent = key.endsWith(`_${activeSlug}`) || (orgId && key.endsWith(`_${orgId}`));
        if (belongsToCurrent) return;

        // 3. NUCLEAR PURGE: This is a legacy or orphaned artifact from a different studio.
        console.warn(`🧹 [ScorchedEarth] Purging alien artifact: ${key}`);
        localStorage.removeItem(key);
    });
}
/**
 * Consolidates all studio state into a single push with Optimistic Locking and Retry logic.
 * Ensures that concurrent updates from multiple clients do not overwrite each other.
 */
/**
 * SYMMETRIC MERGE UTILITY:
 * Combines two studio_data objects into a single converged state.
 * Rule 1: ID-based matching for arrays.
 * Rule 2: Absolute Tombstone Priority (If ID is in cc_deleted_*, it is PURGED).
 * AGNOSTIC: This function expects NORMALIZED keys (no suffixes).
 */
export function mergeStudioData(existing: any, incoming: any): any {
    const finalData = { 
        ...(existing || {}),
        ...(incoming || {}) 
    };

    const allTombstones: Record<string, Set<string>> = {};
    const allKeys = new Set([...Object.keys(existing || {}), ...Object.keys(incoming || {})]);
    
    allKeys.forEach(k => {
        if (k.startsWith('cc_deleted_')) {
            const idsCloud = Array.isArray(existing?.[k]) ? existing[k] : [];
            const idsLocal = Array.isArray(incoming?.[k]) ? incoming[k] : [];
            allTombstones[k] = new Set([...idsCloud, ...idsLocal]);
            finalData[k] = Array.from(allTombstones[k]);
        }
    });

    const keys = Object.keys(finalData);
    keys.forEach(key => {
        if (key.startsWith('cc_deleted_')) return;

        let tKey = `cc_deleted_${key.replace(/^cc_/, '').replace(/_data$/, '')}`;
        if (key.startsWith('cc_student_data')) tKey = `cc_deleted_students`;
        if (key.startsWith('cc_groups')) tKey = `cc_deleted_groups`;
        if (key.startsWith('cc_halls')) tKey = `cc_deleted_halls`;
        if (key.startsWith('cc_checkins')) tKey = `cc_deleted_checkins`;
        if (key.startsWith('cc_student_subscriptions')) tKey = `cc_deleted_subscriptions`;

        const deletedIds = allTombstones[tKey] || new Set();
        const local = incoming[key];
        const cloud = existing[key];

        if (Array.isArray(local) || Array.isArray(cloud)) {
            const map = new Map<string, any>();
            [...(Array.isArray(local) ? local : []), ...(Array.isArray(cloud) ? cloud : [])].forEach(item => {
                if (item && item.id) {
                    if (deletedIds.has(item.id)) return;
                    map.set(item.id, { ...(map.get(item.id) || {}), ...item });
                }
            });
            finalData[key] = Array.from(map.values());
        } else if (typeof local === 'object' && local !== null) {
            const map = { ...(cloud || {}), ...(local || {}) };
            Object.keys(map).forEach(id => {
                if (deletedIds.has(id)) delete map[id];
            });
            finalData[key] = map;
        }
    });

    return finalData;
}

/** HELPER: Strips studio-specific suffixes (_slug or _uuid) for cloud storage */
function normalizeData(data: Record<string, any>, slug: string, orgId?: string): Record<string, any> {
    const clean: Record<string, any> = {};
    Object.keys(data).forEach(k => {
        let cleanKey = k;
        if (slug) cleanKey = cleanKey.replace(`_${slug}`, '');
        if (orgId) cleanKey = cleanKey.replace(`_${orgId}`, '');
        clean[cleanKey] = data[k];
    });
    return clean;
}

/** HELPER: Re-applies studio-specific suffixes for local storage */
function denormalizeData(data: Record<string, any>, targetScopeId: string): Record<string, any> {
    const scoped: Record<string, any> = {};
    Object.keys(data).forEach(k => {
        scoped[`${k}_${targetScopeId}`] = data[k];
    });
    return scoped;
}

function mergeStaff(existing: StaffMember[], incoming: StaffMember[]): StaffMember[] {
    const map = new Map<string, StaffMember>();
    [...existing, ...incoming].forEach(s => {
        if (s && s.id) {
            map.set(s.id, { ...(map.get(s.id) || {}), ...s } as StaffMember);
        }
    });
    return Array.from(map.values());
}

/**
 * SCOPE-AGNOSTIC PUSH:
 * Normalizes all keys before pushing to ensure PC and Phone talk to the same silos.
 */
export async function pushStudioStateToCloud(
    slug: string, 
    staff: StaffMember[], 
    studioData: any, 
    retryCount = 0,
    orgId?: string,
    forceOverwrite = false
) {
    if (typeof window === 'undefined') return;
    if (!slug || slug === 'demo.classcore.ge') return;

    try {
        // SCORCHED EARTH v2.1: Purge alien artifacts BEFORE normalization
        scrubLocalStorage(slug, orgId);

        const supabase = createClient();
        const { data: current, error: fetchError } = await supabase
            .from(SETTINGS_TABLE)
            .select('staff_data, studio_data, org_id')
            .eq('studio_slug', slug)
            .maybeSingle();

        if (fetchError) throw fetchError;

        // 1. Normalize local data (Strip suffixes)
        const incomingNormalized = normalizeData(studioData, slug, orgId || current?.org_id);
        // CRITICAL: Normalize the EXISTING cloud state too before merging.
        // This prevents old suffixed keys from "re-merging" into the clean keys.
        const cloudNormalized = normalizeData(current?.studio_data || {}, slug, current?.org_id);

        // 2. Converge
        let finalStaff = staff;
        let finalStudioData = incomingNormalized;
        
        if (current && !forceOverwrite) {
            finalStaff = mergeStaff(current.staff_data || [], staff);
            finalStudioData = mergeStudioData(cloudNormalized, incomingNormalized);
        }

        // 3. CLOUD SCRUBBING: Permanently remove any legacy suffixed keys from the cloud JSON
        // to prevent them from resurrecting on devices with missing OrgIds.
        const cleanedStudioData: Record<string, any> = {};
        Object.keys(finalStudioData).forEach(k => {
            // SCORCHED EARTH: If the key contains a suffix of THIS studio, discard it.
            // We only keep the CLEAN, normalized keys (e.g. 'cc_groups').
            const hasSlugSuffix = slug && k.includes(`_${slug}`);
            const hasIdSuffix = current?.org_id && k.includes(`_${current.org_id}`);
            
            if (!hasSlugSuffix && !hasIdSuffix) {
                cleanedStudioData[k] = finalStudioData[k];
            } else {
                console.warn(`🧹 [SyncStore] Scrubbed legacy cloud artifact: ${k}`);
            }
        });
        
        // Ensure even the cleanedStudioData is truly clean of artifacts
        const finalCleaned = cleanedStudioData;

        const nextUpdatedAt = new Date().toISOString();
        const staffEmails = Array.from(new Set([
            ...(finalStaff || []).map(s => s.email?.toLowerCase().trim()).filter(Boolean),
            ...(finalStaff || []).map(s => s.phone?.replace(/[^0-9+]/g, '')).filter(Boolean)
        ]));

        const payload: any = {
            studio_slug: slug,
            org_id: orgId || current?.org_id || '',
            staff_data: finalStaff,
            studio_data: finalCleaned, 
            staff_emails: staffEmails,
            updated_at: nextUpdatedAt
        };

        if (!current) {
            const { error: insertError } = await supabase.from(SETTINGS_TABLE).insert(payload);
            if (insertError && insertError.code === '23505') throw new Error('Conflict');
            if (insertError) throw insertError;
        } else {
            const { error: updateError, count } = await supabase
                .from(SETTINGS_TABLE)
                .update(payload, { count: 'exact' })
                .eq('studio_slug', slug);
                // REMOVED: .eq('updated_at', current.updated_at) 
                // This was too strict and causing silent update failures 
                // due to timestamp precision mismatches in Postgres.

            if (updateError) {
                console.error('❌ [SyncStore] DB Update Error:', updateError);
                throw updateError;
            }
            if (count === 0) {
                 console.warn('⚠️ [SyncStore] DB Update failed: Studio not found or restricted');
                 throw new Error('No record updated');
            }
        }
        console.log('💾 [SQL] Data committed to Supabase successfully!');
    } catch (err: any) {
        if (retryCount < 5) {
            await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 100 + Math.random() * 200));
            return pushStudioStateToCloud(slug, staff, studioData, retryCount + 1, orgId, forceOverwrite);
        }
    }
}

export async function pullStudioStateFromCloud(slug: string, targetScopeId?: string): Promise<{ staff_data: StaffMember[], studio_data: any, org_id?: string } | null> {
    if (typeof window === 'undefined') return null;
    if (!slug || slug === 'demo.classcore.ge') return null;

    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from(SETTINGS_TABLE)
            .select('staff_data, studio_data, updated_at, org_id')
            .eq('studio_slug', slug)
            .maybeSingle();

        if (error || !data) return null;

        // Denormalize cloud data using the device's specific scope ID (Slug or OrgId)
        const scopedData = denormalizeData(data.studio_data || {}, targetScopeId);

        return {
            staff_data: (data.staff_data || []) as StaffMember[],
            studio_data: scopedData,
            org_id: data.org_id
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
    const state = await pullStudioStateFromCloud(slug, slug);
    return state?.staff_data || null;
}

export async function findAllStudiosByStaffEmail(query: string): Promise<{ staff: StaffMember, slug: string }[]> {
    if (typeof window === 'undefined') return [];
    
    // Clean up query variations
    const cleanQuery = query.trim().toLowerCase();
    const digitsOnly = query.replace(/[^0-9]/g, '');
    
    // Create a set of potential matches to check in the DB
    const searchTerms = Array.from(new Set([
        cleanQuery,
        digitsOnly,
        // If it starts with +995 or 5, try variations
        digitsOnly.startsWith('995') ? digitsOnly.slice(3) : digitsOnly,
    ].filter(t => t.length > 2)));

    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('QUERY_TIMEOUT')), 12000)
    );

    try {
        const supabase = createClient();
        console.log('📡 [SyncStore] Searching cloud with terms:', searchTerms);
        
        const task = (async () => {
            const { data, error } = await supabase
                .from(SETTINGS_TABLE)
                .select('studio_slug, staff_data, updated_at')
                .contains('staff_emails', searchTerms) // Match ANY of the terms
                .order('updated_at', { ascending: false })
                .limit(10);

            if (error) {
                console.error('❌ [SyncStore] Cloud Search Error:', error);
                throw error;
            }
            return data || [];
        })();

        // Race the search task against the 12s timeout
        const data = await Promise.race([task, timeoutPromise]) as any[];
        
        if (!data || data.length === 0) {
            console.warn('⚠️ [SyncStore] Cloud Search: No studios found for terms:', searchTerms);
            return [];
        }

        const results: { staff: StaffMember, slug: string }[] = [];
        
        data.forEach(row => {
            const staffMatch = (row.staff_data as StaffMember[]).find(s => {
                const sEmail = s.email?.toLowerCase().trim();
                const sFirstName = s.first_name?.toLowerCase().trim();
                const sFullName = s.full_name?.toLowerCase().trim();
                const sPhone = (s.phone || s.phone_number || '').replace(/[^0-9]/g, '');

                return searchTerms.some(t => 
                    t === sEmail || 
                    t === sFirstName || 
                    t === sFullName || 
                    (sPhone && (sPhone === t || sPhone.endsWith(t) || t.endsWith(sPhone)))
                );
            });
            
            if (staffMatch) {
                results.push({ staff: staffMatch, slug: row.studio_slug });
            }
        });

        return results.sort((a, b) => {
            const aIsDemo = a.slug.includes('demo');
            const bIsDemo = b.slug.includes('demo');
            if (aIsDemo && !bIsDemo) return 1;
            if (!aIsDemo && bIsDemo) return -1;
            return 0;
        });

    } catch (err: any) {
        console.error('❌ [SyncStore] Cloud Search Critical Error:', err);
        return [];
    }
}

/**
 * Fast targeted verification: Checks if a specific query (email/phone) exists in a specific studio.
 */
export async function verifyUserInStudio(slug: string, query: string): Promise<boolean> {
    if (typeof window === 'undefined' || !slug || !query) return false;
    const cleanQuery = query.trim().toLowerCase();
    const digitsOnly = query.replace(/[^0-9]/g, '');

    const terms = Array.from(new Set([cleanQuery, digitsOnly].filter(t => t.length > 2)));

    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from(SETTINGS_TABLE)
            .select('staff_emails, staff_data')
            .eq('studio_slug', slug)
            .single();

        if (error || !data) return false;
        
        // 1. Raw JSON check (Definitive source for role-based logic)
        const staffData = (data.staff_data || []) as any[];
        
        // 1a. Check top-level staff (owners/admins)
        // Owners and Admins are managed via Supabase Auth and always have access if they exist in staff_data
        const foundInStaff = staffData.some(s => {
            if (s.id === '__studio_config__') return false;
            const sEmail = s.email?.toLowerCase().trim();
            const sPhone = (s.phone || s.phone_number || '').replace(/[^0-9]/g, '');
            return terms.some(t => t === sEmail || (sPhone && (sPhone === t || sPhone.endsWith(t))));
        });
        if (foundInStaff) return true;

        // 1b. Deep check inside teacher collections (Strict: require password for teachers)
        // The user requested that teachers ONLY have access if they were added with a password.
        const configItem = staffData.find(s => s.id === '__studio_config__');
        if (configItem?.studio_data) {
            const studioData = configItem.studio_data;
            const foundInTeachers = Object.keys(studioData).some(key => {
                if (!key.startsWith('cc_teachers')) return false;
                const teachers = studioData[key];
                if (!Array.isArray(teachers)) return false;
                return teachers.some(t => {
                    const tEmail = t.email?.toLowerCase().trim();
                    const tPhone = (t.phone || '').replace(/[^0-9]/g, '');
                    const matches = terms.some(term => term === tEmail || (tPhone && (tPhone === term || tPhone.endsWith(term))));
                    
                    // IMPORTANT: Only grant access if the teacher has a password set.
                    // This fulfills the "Strict Personal Access" requirement.
                    return matches && !!t.password;
                });
            });
            if (foundInTeachers) return true;
        }

        return false;
    } catch {
        return false;
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
    const state = await pullStudioStateFromCloud(slug, slug);
    return state?.studio_data || null;
}

/**
 * PURGE UTILITY: Wipes all operational data (students, groups, subs, etc.) 
 * while keeping the "framework" (name, logo, theme, branches, staff).
 */
export async function masterStudioPurge(slug: string): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!slug || slug === 'demo.classcore.ge') return;

    try {
        const supabase = createClient();
        const { data: current, error: pullError } = await supabase
            .from(SETTINGS_TABLE)
            .select('staff_data, studio_slug, studio_data') // Added studio_data
            .eq('studio_slug', slug)
            .maybeSingle();

        if (pullError || !current) throw new Error('Studio not found');

        const allStaff = (current.staff_data as any[]) || [];
        const configEntry = allStaff.find(s => s.id === '__studio_config__');
        if (!configEntry) return;

        // 1. Scrub actual studio_data JSON
        const dbStudioData = current.studio_data || {};
        const cleanedStudioData: any = {};
        
        // Essential framework keys to PRESERVE
        const FRAMEWORK_KEYS = [
            'studioName', 'logoDataUrl', 'themeKey', 'currency', 
            'branches', 'notifications', 'sms_templates', 'orgId', 'org_id'
        ];

        Object.keys(dbStudioData).forEach(k => {
            // Essential framework keys to PRESERVE
            if (FRAMEWORK_KEYS.includes(k)) {
                cleanedStudioData[k] = dbStudioData[k];
            }
            // CRITICAL: We EXPLICITLY do NOT preserve 'cc_deleted_*' keys here
            // to ensure a truly clean slate without old tombstones.
        });

        // 2. Scrub Staff Data (Destroy Shadows)
        const nextStaff = allStaff.map(s => {
            // If it's the config placeholder, clean its internal studio_data too
            if (s.id === '__studio_config__') {
                return { id: '__studio_config__', studio_data: cleanedStudioData };
            }
            // Keep actual staff members (roles/names) but we could also clear their personal data if needed.
            // For now, preservation of staff is intentional framework support.
            return s;
        });

        const nextUpdatedAt = new Date().toISOString();
        
        // 3. NUCLEAR UPDATE: Wipe studio_data AND staff_data AND emails registry
        const { error: pushError } = await supabase
            .from(SETTINGS_TABLE)
            .update({
                studio_data: cleanedStudioData,
                staff_data: nextStaff,
                staff_emails: [], // Nuclear: Force cold lookup for next sync
                updated_at: nextUpdatedAt
            })
            .eq('studio_slug', slug);

        if (pushError) throw pushError;

        // ─── Local Storage Cleanup ───
        // We also clear local browser data to ensure the UI updates immediately for the person performing the purge
        Object.keys(localStorage).forEach(key => {
            if (
                key.startsWith(`chat_${slug}_`) || 
                key.startsWith(`group_chat_${slug}_`) || 
                key.startsWith(`cc_notifications_${slug}`) ||
                key === `cc_notifications_history`
            ) {
                localStorage.removeItem(key);
            }
        });

        console.log(`✅ [SyncStore] Purge complete for ${slug}`);
    } catch (err) {
        console.error('❌ [SyncStore] Purge error:', err);
        throw err;
    }
}


/**
 * INSTANT SYNC TRIGGER:
 * Dispatches a global event that StudioContext listens to for immediate cloud commitment.
 */
export function triggerInstantSync() {
    if (typeof window !== 'undefined') {
        console.log('🚀 [SyncStore] Instant Sync Triggered');
        window.dispatchEvent(new Event('cc_instant_sync_request'));
    }
}

/**
 * Consolidates all studio state into a single push with Optimistic Locking and Retry logic.
 */
// ... (rest of the file)
