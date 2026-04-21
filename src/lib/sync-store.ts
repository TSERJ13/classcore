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
        const EXCLUDED_FROM_BLOB = ['cc_global_trash', 'cc_global_history', 'cc_audit_log'];
        
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
        const { data: current } = await supabase
            .from(SETTINGS_TABLE)
            .select('org_id, staff_data')
            .eq('studio_slug', slug)
            .maybeSingle();
            
        orgId = orgId || current?.org_id || '';
        
        // 🚨 CRITICAL FIX: Safe Merge & Legacy Migration!
        const staffDataObj = current?.staff_data || {};
        const isLegacy = Array.isArray(staffDataObj);
        
        let existingStaff: StaffMember[] = [];
        let existingOperations: Record<string, any> = {};

        if (isLegacy) {
            // MIGRATION: Convert legacy array format to unified object format
            console.warn(`⚙️ [Sync] Migrating legacy studio format for: ${slug}`);
            existingStaff = staffDataObj.filter((s: any) => s.role !== undefined && s.id !== '__studio_config__');
            const configObj = staffDataObj.find((s: any) => s.id === '__studio_config__');
            if (configObj && configObj.studio_data) {
                Object.entries(configObj.studio_data).forEach(([k, v]) => {
                    let base = k;
                    if (base.endsWith(`_${slug}`)) base = base.slice(0, -(slug.length + 1));
                    if (!EXCLUDED_FROM_BLOB.includes(base)) existingOperations[base] = v;
                });
            }
        } else {
            existingStaff = staffDataObj._staff || [];
            existingOperations = staffDataObj._operations || {};
        }
        
        // Smart merge
        const mergedOperations = { ...existingOperations, ...operations };
        const mergedStaff = (staff && staff.length > 0) ? staff : existingStaff;

        const blob = {
            _staff: mergedStaff,
            _operations: mergedOperations
        };

        // 3. Build staff_emails for quick lookups
        const staffEmails = Array.from(new Set([
            ...(mergedStaff || []).map((s: any) => s.email?.toLowerCase().trim()).filter(Boolean),
            ...(mergedStaff || []).map((s: any) => s.phone?.replace(/[^0-9]/g, '')).filter(Boolean)
        ]));

        // 5. Upsert to database
        const payload: any = {
            studio_slug: slug,
            org_id: orgId,
            staff_data: blob,
            staff_emails: staffEmails,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from(SETTINGS_TABLE)
            .upsert(payload, { onConflict: 'studio_slug' });

        if (error) {
            if (error.code === '42501') {
                console.error('❌ [Sync] Permission Denied (42501). Staff cannot write to studio_settings. Ensure RLS policies allow "anon" role to UPDATE.');
            } else {
                console.error('❌ [Sync] Push failed:', error.message, error.code);
            }
            throw error;
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
                            owner_info: settings.owner_info || undefined,
                            plan: settings.plan || undefined,
                            status: settings.status || undefined
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
 * PULL: Read state from Supabase.
 * Returns staff + operational data (with slug suffix added back to keys).
 */
export async function pullStudioStateFromCloud(
    slug: string,
    scopeId?: string
): Promise<{ staff_data: StaffMember[], studio_data: Record<string, any>, org_id?: string } | null> {
    if (typeof window === 'undefined') return null;
    if (!slug || slug === 'demo.classcore.ge') return null;

    try {
        const supabase = createClient();

        // 1. Fetch from both tables in parallel
        const [settingsRes, masterRes] = await Promise.all([
            supabase.from(SETTINGS_TABLE).select('staff_data, org_id, updated_at').eq('studio_slug', slug).maybeSingle(),
            supabase.from('studios').select('plan, status').eq('studio_slug', slug).maybeSingle()
        ]);

        if (settingsRes.error) {
            console.error('❌ [Sync] Pull from studio_settings failed:', settingsRes.error.message);
            return null;
        }

        const data = settingsRes.data;
        if (!data) {
            console.warn('⚠️ [Sync] No settings record found for slug:', slug);
            return null;
        }

        let staff = unified._staff || (Array.isArray(unified) ? unified : []);
        let operations = unified._operations || {};

        // 🚨 SUPER-RESILIENT RECOVERY: 
        // Even if data.org_id is missing in the blob, we use the one from the master studios table!
        const effectiveOrgId = data.org_id || master?.org_id;

        if ((!staff || staff.length === 0) && effectiveOrgId) {
            console.log('🛡️ [Sync] Settings blob has no staff. Attempting resilient recovery from master tables...');
            const { data: standaloneStaff } = await supabase
                .from('staff')
                .select('*')
                .eq('org_id', effectiveOrgId);
            
            if (standaloneStaff && standaloneStaff.length > 0) {
                console.log(`✅ [Sync] Recovered ${standaloneStaff.length} staff records from master table.`);
                staff = standaloneStaff.map(s => ({
                    id: s.id,
                    org_id: s.org_id,
                    full_name: s.full_name,
                    first_name: s.first_name,
                    last_name: s.last_name,
                    phone: s.phone,
                    email: s.email,
                    role: s.role,
                    permissions: s.permissions,
                    photo_url: s.photo_url,
                    specialty: s.specialty,
                    rate_per_hour: (s.salary_rates as any)?.hourly,
                    rate_per_month: (s.salary_rates as any)?.monthly,
                    salary_percentage: (s.salary_rates as any)?.percentage,
                    assigned_group_ids: s.assigned_group_ids,
                    allowedBranchIds: s.allowed_branch_ids,
                    status: s.status,
                    created_at: s.created_at
                }));
            }
        }

        const settingsKey = `cc_studio_settings_${slug}`;
        let settingsObj = operations[settingsKey] || {};

        if (master) {
            console.log('📡 [Sync] Hydrating identity from master studios table...');
            operations[settingsKey] = {
                ...settingsObj,
                studioName: master.studio_name || settingsObj.studioName,
                logoDataUrl: master.logo_url || settingsObj.logoDataUrl || null,
                plan: master.plan || settingsObj.plan,
                status: master.status || settingsObj.status,
                owner_info: master.owner_info || settingsObj.owner_info,
                orgId: master.org_id || settingsObj.orgId // 🚨 CRITICAL: Restore the orgId to the local settings!
            };
        }

        // Add scope suffix back to operation keys
        // If key already has a branch suffix (e.g. cc_groups_branch1), inject slug in middle: cc_groups_slug_branch1
        const scope = scopeId || slug;
        const scopedData: Record<string, any> = {};
        Object.entries(operations).forEach(([key, value]) => {
            const parts = key.split('_');
            if (parts.length > 2 && !key.startsWith('cc_studio_settings')) {
                // It's likely a branch-scoped key like cc_groups_main
                const base = parts.slice(0, -1).join('_');
                const bId = parts[parts.length - 1];
                scopedData[`${base}_${scope}_${bId}`] = value;
            } else {
                // Global key or settings
                scopedData[`${key}_${scope}`] = value;
            }
        });

        console.log(`✅ [Sync] Pull OK ← ${staff.length} staff, ${Object.keys(operations).length} data keys`);
        return {
            staff_data: staff,
            studio_data: scopedData,
            org_id: data.org_id,
            updated_at: data.updated_at
        };
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
        
        // 🚨 NUCLEAR SEARCH: Search for ALL possible identity variants (email and phone)
        // This ensures that '+995...' and '995...' both find the relevant records.
        const { data, error } = await supabase
            .from(SETTINGS_TABLE)
            .select('studio_slug, staff_data, org_id')
            .or(terms.map(t => `staff_emails.cs.{"${t}"}`).join(',')); 

        if (error) {
            console.error('❌ [Sync] Global staff search failed! Table:', SETTINGS_TABLE, 'Error:', error.message, 'Code:', error.code);
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
