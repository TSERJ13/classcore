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
 * Combines two studio_data objects (usually Cloud and Local) into a single converged state.
 * Uses ID-based matching for arrays and Key-based matching for records.
 * Strictly enforces Tombstones (deletion lists) during the process.
 */
export function mergeStudioData(existing: any, incoming: any): any {
    const finalData = { ...(existing || {}) };

    // Base prefixes for collections and their corresponding tombstones
    const TOMBSTONES: Record<string, string> = {
        'cc_student_data': 'cc_deleted_students',
        'cc_groups': 'cc_deleted_groups',
        'cc_halls': 'cc_deleted_halls',
        'cc_student_subscriptions': 'cc_deleted_subscriptions',
        'cc_checkins': 'cc_deleted_checkins'
    };

    // 1. PRE-EXTRACT ALL TOMBSTONES from both sides to ensure they are available for any collection merge
    const allTombstoneKeys = new Set<string>();
    Object.values(TOMBSTONES).forEach(prefix => {
        // Find all keys in existing or incoming that match this tombstone prefix
        Object.keys(existing || {}).concat(Object.keys(incoming || {})).forEach(k => {
            if (k.startsWith(prefix)) allTombstoneKeys.add(k);
        });
    });

    // Pre-calculate merged tombstones for all found keys
    const mergedTombstones: Record<string, string[]> = {};
    allTombstoneKeys.forEach(tKey => {
        const local = (incoming[tKey] || []) as string[];
        const cloud = (existing[tKey] || []) as string[];
        mergedTombstones[tKey] = Array.from(new Set([...(Array.isArray(local) ? local : []), ...(Array.isArray(cloud) ? cloud : [])]));
        // ALWAYS PERSIST THE MERGED TOMBSTONE
        finalData[tKey] = mergedTombstones[tKey];
    });

    for (const key in incoming) {
        const itemIncoming = incoming[key];
        const itemExisting = existing[key];

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

        if (typeof itemIncoming === 'object' && itemIncoming !== null && !Array.isArray(itemIncoming)) {
            // Record-based merge (e.g. students: Record<string, Student>)
            const merged = { ...((itemExisting || {}) as Record<string, any>), ...itemIncoming };
            
            // Strictly enforce tombstones: Remove any ID present in the deletion registry
            Object.keys(merged).forEach(id => {
                if (deletedIds.has(id)) delete merged[id];
            });
            
            finalData[key] = merged;
        } else if (Array.isArray(itemIncoming)) {
            // Array-based deep merge for collections (groups, halls, etc.)
            const merged = Array.isArray(itemExisting) ? [...itemExisting] : [];
            itemIncoming.forEach((newItem: any) => {
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
            finalData[key] = merged.filter((item: any) => !item?.id || !deletedIds.has(item.id));
        } else {
            // Fallback: Overwrite for primitives
            finalData[key] = itemIncoming;
        }
    }

    return finalData;
}

export async function pushStudioStateToCloud(slug: string, staff: StaffMember[], studioData: any, retryCount = 0, orgId?: string, forceOverwrite = false): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!slug || slug === 'demo.classcore.ge') return;

    try {
        const supabase = createClient();

        // 1. Pull latest cloud state to merge (Optimistic Locking approach)
        let query = supabase.from(SETTINGS_TABLE).select('staff_data, updated_at, studio_slug');
        query = query.eq('studio_slug', slug);
        
        const { data: current, error: pullError } = await query.maybeSingle();

        if (pullError) {
            console.error('❌ [SyncStore] Pull error:', pullError);
            throw pullError;
        }

        let finalStaff: StaffMember[] = staff;
        let finalStudioData: any = studioData;

        // If row exists, perform a symmetric merge to avoid overwriting others' changes
        if (current && !forceOverwrite) {
            const cloudAll = (current.staff_data as any[]) || [];
            const cloudStaff = cloudAll.filter(s => s.id !== '__studio_config__');
            const cloudConfig = cloudAll.find(s => s.id === '__studio_config__')?.studio_data || {};

            // 1. Staff List Convergence
            if (staff && staff.length > 0) {
                finalStaff = staff;
            } else {
                finalStaff = cloudStaff;
            }

            // 2. Studio Data Convergence (Using Symmetric Merge)
            finalStudioData = mergeStudioData(cloudConfig, studioData);
        }

        const consolidatedStaff = [
            ...finalStaff.filter(s => s.id !== '__studio_config__'),
            { id: '__studio_config__', studio_data: finalStudioData } as any
        ];

        const nextUpdatedAt = new Date().toISOString();
        // 1.5. Aggregate teacher emails and phones to allow their logins
        const teacherEmails: string[] = [];
        const teacherPhones: string[] = [];
        
        Object.keys(finalStudioData).forEach(key => {
            if (key.startsWith('cc_teachers')) {
                const teachers = finalStudioData[key];
                if (Array.isArray(teachers)) {
                    teachers.forEach(t => {
                        if (t.email) teacherEmails.push(t.email.toLowerCase().trim());
                        if (t.phone) teacherPhones.push(t.phone.replace(/[^0-9+]/g, ''));
                    });
                }
            }
        });

        const staffEmails = Array.from(new Set([
            ...(finalStaff || []).map(s => s.email?.toLowerCase().trim()).filter(Boolean),
            ...(finalStaff || []).map(s => s.first_name?.toLowerCase().trim()).filter(Boolean),
            ...(finalStaff || []).map(s => s.full_name?.toLowerCase().trim()).filter(Boolean),
            ...(finalStaff || []).map(s => s.phone?.replace(/[^0-9+]/g, '')).filter(Boolean),
            ...(finalStaff || []).map(s => s.phone_number?.replace(/[^0-9+]/g, '')).filter(Boolean),
            ...teacherEmails,
            ...teacherPhones
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
            return pushStudioStateToCloud(slug, staff, studioData, retryCount + 1, orgId, forceOverwrite);
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


