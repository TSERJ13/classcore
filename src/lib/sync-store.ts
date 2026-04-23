import { createClient } from './supabase/client';
import { type StaffMember } from '@/types';

const SETTINGS_TABLE = 'studio_settings';

/**
 * =============================================================
 * SYNC-STORE v3.0 — Cloud-First Architecture
 * =============================================================
 * 
 * PRINCIPLE: Supabase is the SINGLE SOURCE OF TRUTH.
 * localStorage is just a fast cache for instant page loads.
 * 
 * DATA FORMAT in studio_settings.staff_data:
 * {
 *   _staff: StaffMember[],
 *   _operations: {
 *     cc_student_data: [...],
 *     cc_groups: [...],
 *     cc_halls: [...],
 *     cc_calendar_events: [...],
 *     cc_subscription_plans: [...],
 *     cc_student_subscriptions: [...],
 *     cc_attendance_data: [...],
 *     cc_global_history: [...],
 *     cc_global_trash: [...],
 *     cc_studio_settings: {...},
 *     ...
 *   }
 * }
 * =============================================================
 */

// Kept for backward compatibility
export const INTEGRITY_WHITELIST = [
    'cc_auth_token', 'cc_active_slug', 'cc_active_branch_',
    'cc_last_local_update', 'cc_onboarding_done', 'cc_theme', 'cc_studio_name'
];

// No-op: scrubbing is no longer needed in cloud-first model
export function scrubLocalStorage(_activeSlug: string, _orgId?: string) {
    // Intentionally empty — cloud is truth, we don't purge local cache
}

/**
 * SMART MERGE: Intelligently merges two operational blobs.
 * Principle: Union arrays by ID (newest wins on collision), shallow-merge objects.
 * 🛡️ DELETION AWARE: Respects 'cc_deleted_' registries to prevent resurrection.
 */
function smartMergeCollections(existing: Record<string, any>, incoming: Record<string, any>, deletedRegistry: Record<string, string[]> = {}): Record<string, any> {
    const result = { ...existing };

    Object.entries(incoming).forEach(([key, incomingVal]) => {
        const existingVal = result[key];
        const deletedIds = deletedRegistry[key] || [];

        if (!existingVal) {
            // New key entirely - but don't bring back deleted items
            if (Array.isArray(incomingVal)) {
                result[key] = incomingVal.filter(item => {
                    const id = item?.id || item?.student_id || JSON.stringify(item);
                    return !deletedIds.includes(String(id));
                });
            } else {
                result[key] = incomingVal;
            }
            return;
        }

        // 1. Array Merge (Collection of Records)
        if (Array.isArray(incomingVal) && Array.isArray(existingVal)) {
            const map = new Map();
            // Load existing items
            existingVal.forEach(item => {
                const id = item?.id || item?.student_id || JSON.stringify(item);
                map.set(String(id), item);
            });
            // Overwrite with incoming items (newer)
            incomingVal.forEach(item => {
                const id = item?.id || item?.student_id || JSON.stringify(item);
                map.set(String(id), { ...(map.get(String(id)) || {}), ...item });
            });

            // 🛡️ PRUNE DELETED: Filter out anything in the deletion registry
            result[key] = Array.from(map.values()).filter(item => {
                const id = item?.id || item?.student_id || JSON.stringify(item);
                return !deletedIds.includes(String(id));
            });
        } 
        // 2. Object Merge (Settings/Config)
        else if (typeof incomingVal === 'object' && incomingVal !== null &&
                 typeof existingVal === 'object' && existingVal !== null) {
            // Special case: don't let empty objects overwrite populated ones
            if (Object.keys(incomingVal).length === 0 && Object.keys(existingVal).length > 0) {
                return; 
            }
            result[key] = { ...existingVal, ...incomingVal };
        } 
        // 3. Primitive Override
        else {
            // Don't let null/undefined overwrite existing values unless explicitly allowed
            if ((incomingVal === null || incomingVal === undefined) && existingVal !== null) {
                return;
            }
            result[key] = incomingVal;
        }
    });

    return result;
}

/**
 * PUSH: Send local state to Supabase.
 * Reads staff from settings + operational data from localStorage,
 * packs them into a blob, and writes to studio_settings.staff_data.
 */
export async function pushStudioStateToCloud(
    slug: string,
    staff: StaffMember[],
    studioData: Record<string, any>,
    retryCount = 0,
    orgId?: string,
    _forceOverwrite = false
) {
    if (typeof window === 'undefined') return;
    if (!slug || slug === 'demo.classcore.ge' || slug === 'superadmin') return;

    try {
        const supabase = createClient();

        // EMPTY PUSH PROTECTION: Never overwrite cloud with empty data
        // This prevents new devices / incognito from wiping the database
        if ((!staff || staff.length === 0) && Object.keys(studioData).length === 0) {
            console.warn('⚠️ [Sync] Push blocked: refusing to overwrite cloud with empty data');
            return;
        }

        // 1. Strip slug/orgId suffixes from localStorage keys to get clean base keys
        // 🚨 OPTIMIZATION: Exclude heavy, standalone-synced data from the main blob
        // 🚨 NO EXCLUSIONS: The user wants EVERYTHING saved (including Trash and History)
        const EXCLUDED_FROM_BLOB: string[] = [];
        
        const operations: Record<string, any> = {};
        Object.entries(studioData).forEach(([key, value]) => {
            let baseKey = key;
            
            // 1. Identification: if key contains both slug and branchId, strip SLUG but KEEP branchId suffix for the cloud blob
            // Example: cc_groups_stdance_branch1 -> cc_groups_branch1
            if (slug && baseKey.includes(`_${slug}_`)) {
                baseKey = baseKey.replace(`_${slug}_`, '_');
            } else if (slug && baseKey.endsWith(`_${slug}`)) {
                baseKey = baseKey.slice(0, -(slug.length + 1));
            }

            if (orgId && baseKey.includes(`_${orgId}_`)) {
                baseKey = baseKey.replace(`_${orgId}_`, '_');
            } else if (orgId && baseKey.endsWith(`_${orgId}`)) {
                baseKey = baseKey.slice(0, -(orgId.length + 1));
            }
            
            // Only include if NOT in exclusion list
            if (!EXCLUDED_FROM_BLOB.includes(baseKey)) {
                operations[baseKey] = value;
            }
        });

        // 4. Fetch current record to get existing state and org_id
        const { data: current, error: readError } = await supabase
            .from(SETTINGS_TABLE)
            .select('org_id, staff_data')
            .eq('studio_slug', slug)
            .maybeSingle();
            
        // 🛡️ PROTECTION 1: If we can't read from the cloud (e.g. RLS block or network), 
        // DO NOT PUSH. Overwriting blindly is how data gets lost.
        if (readError) {
            console.error('❌ [Sync] Read failed before push. Aborting to protect data integrity.');
            return;
        }

        // 🛡️ PROTECTION 2: If the local state is EMPTY (Default) and the cloud ALREADY HAS DATA,
        // DO NOT PUSH. This prevents a fresh browser session from wiping out the cloud.
        orgId = orgId || current?.org_id || '';
        if (!orgId) {
             console.warn('⚠️ [Sync] No Org ID found for slug:', slug, '. Aborting push.');
             return;
        }

        const cloudBlob = current?.staff_data || {};
        const isLegacy = Array.isArray(cloudBlob);
        
        let cloudStaff: StaffMember[] = [];
        let cloudOps: Record<string, any> = {};
        let cloudDeleted: Record<string, string[]> = {};

        if (isLegacy) {
            cloudStaff = (cloudBlob as any[]).filter((s: any) => s.role !== undefined && s.id !== '__studio_config__');
            const configObj = (cloudBlob as any[]).find((s: any) => s.id === '__studio_config__');
            cloudOps = configObj?.studio_data || {};
        } else {
            cloudStaff = cloudBlob._staff || [];
            cloudOps = cloudBlob._operations || {};
            cloudDeleted = cloudBlob._deleted_registry || {};
        }

        // Merge Staff logic
        const staffMap = new Map();
        cloudStaff.forEach((s: any) => staffMap.set(s.id, s));
        const localStaffMap = new Map();
        staff.forEach(s => localStaffMap.set(s.id, s));
        
        localStaffMap.forEach((s, id) => {
            const existing = staffMap.get(id);
            if (!existing || (new Date(s.updated_at || 0) > new Date(existing.updated_at || 0))) {
                staffMap.set(id, s);
            }
        });

        const mergedStaff = Array.from(staffMap.values());
        
        // --- DELETION REGISTRY MERGE ---
        const localDeletedKey = `cc_deleted_registry_${slug}`;
        const localDeleted = JSON.parse(localStorage.getItem(localDeletedKey) || '{}');
        const combinedDeleted: Record<string, string[]> = { ...cloudDeleted };
        Object.entries(localDeleted).forEach(([col, ids]) => {
            const arr = Array.isArray(ids) ? ids : [];
            combinedDeleted[col] = [...new Set([...(combinedDeleted[col] || []), ...arr])];
        });

        const mergedOps = smartMergeCollections(cloudOps, operations, combinedDeleted);

        // --- FINAL BUNDLE ---
        const blob = {
            _staff: mergedStaff,
            _operations: mergedOps,
            _deleted_registry: combinedDeleted,
            _sync_meta: {
                pusher_id: staff[0]?.id || 'unknown',
                ts: new Date().toISOString(),
                device: typeof window !== 'undefined' ? window.navigator.userAgent : 'server'
            }
        };

        // 3. Build staff_emails for quick lookups
        const staffEmails = Array.from(new Set([
            ...(mergedStaff || []).map((s: any) => s.email?.toLowerCase().trim()).filter(Boolean),
            ...(mergedStaff || []).map((s: any) => s.phone?.replace(/[^0-9]/g, '')).filter(Boolean)
        ]));

        // 5. Upsert to database
        const finalOrgId = (orgId && orgId.length > 5) ? orgId : null;
        
        const payload: any = {
            studio_slug: slug,
            org_id: finalOrgId,
            staff_data: blob,
            staff_emails: staffEmails,
            updated_at: new Date().toISOString()
        };

        console.log('📡 [Sync] Attempting cloud push...', { 
            slug, 
            orgId: finalOrgId, 
            payloadSize: JSON.stringify(payload).length 
        });

        const { data: pushData, error } = await supabase
            .from(SETTINGS_TABLE)
            .upsert(payload, { onConflict: 'studio_slug' })
            .select('updated_at')
            .single();

        if (error) {
            console.error('❌ [Sync] Upsert failed deeply:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw error;
        }

        // --- UPDATE HANDSHAKE ---
        // We set our local handshake to match the server's update timestamp
        if (pushData?.updated_at) {
            const ts = new Date(pushData.updated_at).getTime();
            localStorage.setItem('cc_last_sync_handshake', ts.toString());
            console.log('✅ [Sync] Push successful. Handshake updated to:', new Date(ts).toLocaleTimeString());
        }

        // 🚀 MASTER PROPAGATION: Ensure vital metadata is synced to top-level tables
        // 1. Update 'studios' metadata
        if (operations.cc_studio_settings) {
            const settings = operations.cc_studio_settings;
            if (settings.logoDataUrl || settings.owner_info || settings.studioName || settings.plan) {
                try {
                    console.log('📡 [Sync] Propagating master metadata for:', slug);
                    const { error: propError } = await supabase
                        .from('studios')
                        .update({
                            logo_url: settings.logoDataUrl || undefined,
                            studio_name: settings.studioName || undefined,
                            owner_info: settings.owner_info || undefined
                        })
                        .eq('studio_slug', slug);

                    if (propError) {
                        console.warn('⚠️ [Sync] Studios master update failed (likely missing columns):', propError.message, propError.details);
                    }
                } catch (propErr) {
                    console.error('❌ [Sync] Master propagation crash:', propErr);
                }
            }
        }

        // 2. Propagate 'staff' members to standalone table
        if (mergedStaff && mergedStaff.length > 0) {
            console.log('📡 [Sync] Propagating staff records for:', slug);
            const staffPayload = mergedStaff.map(s => ({
                id: s.id,
                org_id: orgId,
                first_name: s.first_name || '',
                last_name: s.last_name || '',
                full_name: s.full_name || `${s.first_name} ${s.last_name}`.trim(),
                email: s.email,
                phone: s.phone || s.phone_number,
                password: s.password,
                role: s.role,
                status: s.status || 'active',
                photo_url: s.photo_url,
                permissions: s.permissions,
                specialty: s.specialty || [],
                salary_rates: {
                    hourly: s.rate_per_hour,
                    monthly: s.rate_per_month,
                    percentage: s.salary_percentage
                },
                assigned_group_ids: s.assigned_group_ids || [],
                allowed_branch_ids: s.allowedBranchIds || []
            }));

            const { error: staffError } = await supabase
                .from('staff')
                .upsert(staffPayload, { onConflict: 'id' });
            
            if (staffError) {
                console.warn('⚠️ [Sync] Staff propagation failed (non-critical):', staffError.message);
            }
        }

        console.log(`✅ [Sync] Push OK → ${staff.length} staff, ${Object.keys(operations).length} data keys`);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cc_sync_push_ok', { detail: { time: new Date().toISOString() } }));
        }
    } catch (err: any) {
        if (retryCount < 3) {
            console.warn(`⚠️ [Sync] Push retry ${retryCount + 1}/3...`);
            await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
            return pushStudioStateToCloud(slug, staff, studioData, retryCount + 1, orgId, _forceOverwrite);
        }
        console.error('❌ [Sync] Push failed after 3 retries:', err);
    }
}

/**
 * CORE TRANSFORMATION: Converts a raw cloud blob into scoped local state.
 */
export function transformCloudBlobToLocalState(blob: any, scope: string, orgId?: string, updatedAt?: string) {
    if (!blob) return null;

    let staffArr = blob._staff || (Array.isArray(blob) ? blob : []);
    const operations = blob._operations || {};

    // Standard normalization for all staff records - Ensure photo_url and profile fields always map correctly
    if (staffArr.length > 0) {
        staffArr = staffArr.map((s: any) => ({
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            full_name: s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim(),
            email: s.email,
            phone: s.phone,
            role: s.role,
            password: s.password,
            photo_url: s.photo_url,
            specialty: s.specialty,
            rate_per_hour: s.salary_rates?.hourly ?? s.rate_per_hour,
            rate_per_month: s.salary_rates?.monthly ?? s.rate_per_month,
            salary_percentage: s.salary_rates?.percentage ?? s.salary_percentage,
            assigned_group_ids: s.assigned_group_ids,
            allowedBranchIds: s.allowed_branch_ids || s.allowedBranchIds,
            permissions: s.permissions,
            status: s.status,
            created_at: s.created_at
        }));
    }

    const scopedData: Record<string, any> = {};
    
    Object.entries(operations).forEach(([key, value]) => {
        const parts = key.split('_');
        const isSyncable = [
            'cc_student_data', 'cc_groups', 'cc_halls', 'cc_teachers',
            'cc_attendance_archive', 'cc_attendance_data', 'cc_checkins',
            'cc_subscription_plans', 'cc_student_subscriptions', 'cc_shop_products', 
            'cc_shop_sales', 'cc_audit_log', 'cc_security_log', 'cc_salary_update',
            'cc_notifications', 'cc_calendar_events', 'cc_global_history', 
            'cc_global_trash', 'cc_studio_settings', 'cc_deleted_'
        ].some(p => key.startsWith(p));

        if (!isSyncable) {
            scopedData[key] = value;
            return;
        }

        if (parts.length > 2 && !key.startsWith('cc_studio_settings')) {
            const base = parts.slice(0, -1).join('_');
            const bId = parts[parts.length - 1];
            scopedData[`${base}_${scope}_${bId}`] = value;
        } else {
            scopedData[`${key}_${scope}`] = value;
        }
    });

    return {
        staff_data: staffArr,
        studio_data: scopedData,
        org_id: orgId,
        updated_at: updatedAt
    };
}

/**
 * PULL: Read state from Supabase.
 */
export async function pullStudioStateFromCloud(
    slug: string,
    scopeId?: string
): Promise<{ staff_data: StaffMember[], studio_data: Record<string, any>, org_id?: string, updated_at?: string } | null> {
    if (typeof window === 'undefined') return null;
    if (!slug || slug === 'demo.classcore.ge') return null;

    try {
        const supabase = createClient();

        // 1. Fetch from both tables in parallel
        const [settingsRes, masterRes] = await Promise.all([
            supabase.from(SETTINGS_TABLE).select('staff_data, org_id, updated_at').eq('studio_slug', slug).maybeSingle(),
            supabase.from('studios').select('studio_name, logo_url, plan, status, owner_info, org_id').eq('studio_slug', slug).maybeSingle()
        ]);

        if (settingsRes.error) {
            console.error('❌ [Sync] Pull from studio_settings failed:', settingsRes.error.message);
            return null;
        }

        const { data: data, error } = settingsRes;
        if (!data || !data.staff_data) return null;

        const scope = scopeId || slug;
        const state = transformCloudBlobToLocalState(data.staff_data, scope, data.org_id, data.updated_at);
        const master = masterRes.data;

        if (state && master) {
            const settingsKey = `cc_studio_settings_${scope}`;
            const settingsObj = state.studio_data[settingsKey] || {};
            
            // 🛡️ BLOB IS TRUTH: Prioritize values from the sync blob (settingsObj)
            // Only use 'master' (standalone table) as a fallback if the blob is missing the field.
            // This prevents an old/failed 'studios' table update from overwriting fresh local changes.
            state.studio_data[settingsKey] = {
                ...settingsObj,
                studioName: settingsObj.studioName || master.studio_name,
                logoDataUrl: settingsObj.logoDataUrl || master.logo_url || null,
                plan: settingsObj.plan || master.plan,
                status: settingsObj.status || master.status,
                owner_info: settingsObj.owner_info || master.owner_info,
                orgId: settingsObj.orgId || master.org_id
            };
        }

        console.log(`✅ [Sync] Pull OK ← ${state?.staff_data?.length || 0} staff`);
        return state as any;
    } catch (err) {
        console.error('❌ [Sync] Pull error:', err);
        return null;
    }
}

/**
 * INSTANT SYNC TRIGGER:
 * Dispatches a global event that StudioContext listens to for immediate cloud commitment.
 */
export function triggerInstantSync() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('cc_instant_sync_request'));
    }
}

/**
 * Helper: Sync just staff (wrapper for backward compat)
 */
export async function syncStaffToCloud(slug: string, staff: StaffMember[], orgId?: string) {
    return pushStudioStateToCloud(slug, staff, {}, 0, orgId);
}

/**
 * Helper: Check if cloud connection works for a slug
 */
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

/**
 * Helper: Fetch studio data for public pages
 */
export async function fetchStudioDataFromCloud(slug: string): Promise<any | null> {
    const state = await pullStudioStateFromCloud(slug, slug);
    return state?.studio_data || null;
}

/**
 * Helper: Verify user belongs to a studio (for auth)
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

        if (error) {
            console.error('❌ [Sync] verifyUserInStudio DB Error:', error.message, error.details);
            return false;
        }

        if (!data) {
            console.warn('🔍 [Sync] No studio settings found for slug:', slug);
            return false;
        }

        console.log(`📡 [Sync] verifyUserInStudio context: slug=${slug}, query=${query}, terms=${JSON.stringify(terms)}`);

        // 1. FAST PATH: Check the staff_emails array column
        if (Array.isArray(data.staff_emails)) {
            const hasMatch = terms.some(t => data.staff_emails.includes(t));
            if (hasMatch) {
                console.log(`✅ [Sync] Fast-path verification successful in staff_emails array for: ${query}`);
                return true;
            }
            console.log(`🔍 [Sync] No match in staff_emails array. Indexed array contents:`, data.staff_emails);
        }

        // 2. FALLBACK: Check in unified blob (for latest/un-indexed data)
        const unified = data.staff_data || {};
        const staffList = unified._staff || (Array.isArray(data.staff_data) ? data.staff_data : []);
        console.log(`🔍 [Sync] Falling back to raw staff_data search. List size: ${staffList.length}`);

        const hasFallbackMatch = staffList.some((s: any) => {
            if (s.id === '__studio_config__') return false;
            const sEmail = s.email?.toLowerCase().trim();
            const sPhone = (s.phone || s.phone_number || '').replace(/[^0-9]/g, '');
            const matchStatus = terms.some(t => t === sEmail || (sPhone && (sPhone === t || sPhone.endsWith(t))));
            if (matchStatus) console.log(`✅ [Sync] Fallback match found in staff_data:`, s);
            return matchStatus;
        });

        if (!hasFallbackMatch) {
            console.warn(`🚫 [Sync] Access DENIED for ${query} in ${slug}. Not found in staff_emails or staff_data.`);
        }

        return hasFallbackMatch;
    } catch (err: any) {
        console.error('❌ [Sync] verifyUserInStudio unexpected error:', err.message);
        return false;
    }
}

/**
 * Fetch all studios from cloud (for superadmin)
 */
export async function fetchAllStudios(): Promise<any[]> {
    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from(SETTINGS_TABLE)
            .select('studio_slug, staff_data, staff_emails, updated_at, org_id');
        if (error) throw error;
        return data || [];
    } catch {
        return [];
    }
}

/**
 * PURGE: Wipe all operational data while keeping framework (name, logo, theme, staff).
 */
export async function masterStudioPurge(slug: string): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!slug || slug === 'demo.classcore.ge') return;

    try {
        const supabase = createClient();
        const { data: current, error: pullError } = await supabase
            .from(SETTINGS_TABLE)
            .select('staff_data')
            .eq('studio_slug', slug)
            .maybeSingle();

        if (pullError || !current) throw new Error('Studio not found');

        const unified = current.staff_data || {};
        const staff = unified._staff || [];

        // Keep staff, wipe operations
        const { error: pushError } = await supabase
            .from(SETTINGS_TABLE)
            .update({
                staff_data: { _staff: staff, _operations: {} },
                updated_at: new Date().toISOString()
            })
            .eq('studio_slug', slug);

        if (pushError) throw pushError;

        // Clean local cache
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('cc_') && key.endsWith(`_${slug}`) && !key.startsWith('cc_studio_config')) {
                localStorage.removeItem(key);
            }
        });

        console.log(`✅ [Sync] Purge complete for ${slug}`);
    } catch (err) {
        console.error('❌ [Sync] Purge error:', err);
        throw err;
    }
}

/**
 * CLOUD LOGIN FALLBACK:
 * Finds all studios where a staff member with this email/phone exists.
 * Returns { slug, staff } pairs for authentication.
 */
export async function findAllStudiosByStaffEmail(query: string): Promise<Array<{ slug: string, staff: StaffMember }>> {
    if (typeof window === 'undefined' || !query) return [];
    
    const cleanQuery = query.trim().toLowerCase();
    const digitsOnly = query.replace(/[^0-9]/g, '');
    const terms = Array.from(new Set([cleanQuery, digitsOnly].filter(t => t.length > 2)));

    try {
        const supabase = createClient();
        
        // 1. Optimized Fast Path: Direct contains check for the principal term
        // This is significantly faster than a complex multi-term .or query
        const { data, error } = await supabase
            .from(SETTINGS_TABLE)
            .select('studio_slug, staff_data, org_id')
            .contains('staff_emails', [cleanQuery]);

        if (error) {
            console.error('❌ [Sync] Global staff search failed:', error.message);
            return [];
        }

        const results: Array<{ slug: string, staff: StaffMember }> = [];

        (data || []).forEach(row => {
            const unified = row.staff_data || {};
            const staffList: StaffMember[] = unified._staff || (Array.isArray(row.staff_data) ? row.staff_data : []);
            
            // Find the specific staff member in this studio's blob
            const member = staffList.find(s => {
                const sEmail = s.email?.toLowerCase().trim();
                const sPhone = (s.phone || s.phone_number || '').replace(/[^0-9]/g, '');
                return terms.some(t => t === sEmail || (sPhone && (sPhone === t || sPhone.endsWith(t))));
            });

            if (member) {
                results.push({
                    slug: row.studio_slug,
                    staff: { ...member, org_id: row.org_id } // Inject org_id for correct scoping
                });
            }
        });

        return results;
    } catch (err) {
        console.error('❌ [Sync] Global staff lookup error:', err);
        return [];
    }
}

/**
 * Partial Hydration: Fetch ONLY staff list for a slug
 */
export async function fetchStaffFromCloud(slug: string): Promise<StaffMember[] | null> {
    const state = await pullStudioStateFromCloud(slug, slug);
    return state?.staff_data || null;
}

// Legacy compat stubs — these are no longer used but keep exports
export async function pushEntityToCloud(_orgId: string, _table: string, _entity: any) { }
export async function deleteEntityFromCloud(_orgId: string, _table: string, _id: string): Promise<boolean> { return true; }
export async function fetchEntitiesFromCloud(_orgId: string, _table: string) { return null; }
