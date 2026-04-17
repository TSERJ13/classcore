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
        const supabase = createClient();
        const { data: current, error: fetchError } = await supabase
            .from(SETTINGS_TABLE)
            .select('staff_data, studio_data, updated_at, org_id')
            .eq('studio_slug', slug)
            .maybeSingle();

        if (fetchError) throw fetchError;

        // 1. Normalize local data (Strip suffixes)
        const incomingNormalized = normalizeData(studioData, slug, orgId || current?.org_id);
        const cloudNormalized = current?.studio_data || {};

        // 2. Converge
        let finalStaff = staff;
        let finalStudioData = incomingNormalized;
        
        if (current && !forceOverwrite) {
            finalStaff = mergeStaff(current.staff_data || [], staff);
            finalStudioData = mergeStudioData(cloudNormalized, incomingNormalized);
        }

        const nextUpdatedAt = new Date().toISOString();
        const staffEmails = Array.from(new Set([
            ...(finalStaff || []).map(s => s.email?.toLowerCase().trim()).filter(Boolean),
            ...(finalStaff || []).map(s => s.phone?.replace(/[^0-9+]/g, '')).filter(Boolean)
        ]));

        const payload: any = {
            studio_slug: slug,
            org_id: orgId || current?.org_id || '',
            staff_data: finalStaff,
            studio_data: finalStudioData, 
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
                .eq('studio_slug', slug)
                .eq('updated_at', current.updated_at);

            if (updateError) throw updateError;
            if (count === 0) throw new Error('Conflict');
        }
        console.log('✅ [SyncStore] Scope-Agnostic Cloud Sync Successful');
    } catch (err: any) {
        if (retryCount < 5) {
            await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 100 + Math.random() * 200));
            return pushStudioStateToCloud(slug, staff, studioData, retryCount + 1, orgId, forceOverwrite);
        }
    }
}

export async function pullStudioStateFromCloud(slug: string, targetScopeId: string): Promise<{ staff_data: StaffMember[], studio_data: any } | null> {
    if (typeof window === 'undefined') return null;
    if (!slug || slug === 'demo.classcore.ge') return null;

    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from(SETTINGS_TABLE)
            .select('staff_data, studio_data, updated_at')
            .eq('studio_slug', slug)
            .maybeSingle();

        if (error || !data) return null;

        // Denormalize cloud data using the device's specific scope ID (Slug or OrgId)
        const scopedData = denormalizeData(data.studio_data || {}, targetScopeId);

        return {
            staff_data: (data.staff_data || []) as StaffMember[],
            studio_data: scopedData
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
    const state = await pullStudioStateFromCloud(slug);
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
            .select('staff_data, studio_slug')
            .eq('studio_slug', slug)
            .maybeSingle();

        if (pullError || !current) throw new Error('Studio not found');

        const allStaff = (current.staff_data as any[]) || [];
        const configEntry = allStaff.find(s => s.id === '__studio_config__');
        if (!configEntry) return;

        const studioData = configEntry.studio_data || {};
        const cleanedData: any = {};

        // Essential framework keys to PRESERVE
        const FRAMEWORK_KEYS = [
            'studioName', 'logoDataUrl', 'themeKey', 'currency', 
            'branches', 'notifications', 'sms_templates', 'orgId', 'org_id'
        ];

        // Operational keys to DELETE (Scorched Earth)
        const OPERATIONAL_PREFIXES = [
            'cc_student_data', 'cc_groups', 'cc_halls', 'cc_teachers',
            'cc_student_subscriptions', 'cc_calendar_events', 'cc_attendance_data',
            'cc_checkins', 'cc_shop_sales', 'cc_shop_products', 'cc_sales',
            'cc_deleted_', 'chat_', 'group_chat_'
        ];

        for (const key in studioData) {
            if (FRAMEWORK_KEYS.includes(key)) {
                cleanedData[key] = studioData[key];
            } else if (OPERATIONAL_PREFIXES.some(p => key.startsWith(p))) {
                // Explicitly omit
                continue;
            } else {
                // Preserve unknown keys for safety
                cleanedData[key] = studioData[key];
            }
        }

        // Construct cleaned staff array
        const nextStaff = [
            ...allStaff.filter(s => s.id !== '__studio_config__'),
            { id: '__studio_config__', studio_data: cleanedData }
        ];

        // Direct database update to bypass local-to-cloud merge logic
        const { error: pushError } = await supabase
            .from(SETTINGS_TABLE)
            .update({
                staff_data: nextStaff,
                updated_at: new Date().toISOString()
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


