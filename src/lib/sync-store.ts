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

        // 1. Strip slug/orgId suffixes from localStorage keys to get clean base keys
        const operations: Record<string, any> = {};
        Object.entries(studioData).forEach(([key, value]) => {
            let baseKey = key;
            // Remove slug suffix (e.g., cc_student_data_stdancestudio → cc_student_data)
            if (slug && baseKey.endsWith(`_${slug}`)) {
                baseKey = baseKey.slice(0, -(slug.length + 1));
            }
            // Remove orgId suffix if slug didn't match
            if (orgId && baseKey.endsWith(`_${orgId}`)) {
                baseKey = baseKey.slice(0, -(orgId.length + 1));
            }
            operations[baseKey] = value;
        });

        // 2. Build the unified blob
        const blob = {
            _staff: staff || [],
            _operations: operations
        };

        // 3. Build staff_emails for quick lookups
        const staffEmails = Array.from(new Set([
            ...(staff || []).map(s => s.email?.toLowerCase().trim()).filter(Boolean),
            ...(staff || []).map(s => s.phone?.replace(/[^0-9+]/g, '')).filter(Boolean)
        ]));

        // 4. Fetch current record to get org_id if we don't have it
        if (!orgId) {
            const { data: current } = await supabase
                .from(SETTINGS_TABLE)
                .select('org_id')
                .eq('studio_slug', slug)
                .maybeSingle();
            orgId = current?.org_id || '';
        }

        // 5. Upsert to database
        const payload: any = {
            studio_slug: slug,
            org_id: orgId || '',
            staff_data: blob,
            staff_emails: staffEmails,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from(SETTINGS_TABLE)
            .upsert(payload, { onConflict: 'studio_slug' });

        if (error) {
            console.error('❌ [Sync] Push failed:', error.message);
            throw error;
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

        const { data, error } = await supabase
            .from(SETTINGS_TABLE)
            .select('staff_data, org_id')
            .eq('studio_slug', slug)
            .maybeSingle();

        if (error) {
            console.error('❌ [Sync] Pull failed:', error.message);
            return null;
        }
        if (!data) {
            console.warn('⚠️ [Sync] No record found for slug:', slug);
            return null;
        }

        const unified = data.staff_data || {};
        const staff = unified._staff || (Array.isArray(unified) ? unified : []);
        const operations = unified._operations || {};

        // Add scope suffix back to operation keys
        // so they match localStorage format (e.g., cc_student_data → cc_student_data_stdancestudio)
        const scope = scopeId || slug;
        const scopedData: Record<string, any> = {};
        Object.entries(operations).forEach(([key, value]) => {
            scopedData[`${key}_${scope}`] = value;
        });

        console.log(`✅ [Sync] Pull OK ← ${staff.length} staff, ${Object.keys(operations).length} data keys`);
        return {
            staff_data: staff,
            studio_data: scopedData,
            org_id: data.org_id
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

        if (error || !data) return false;

        // Check in unified blob
        const unified = data.staff_data || {};
        const staffList = unified._staff || (Array.isArray(data.staff_data) ? data.staff_data : []);

        return staffList.some((s: any) => {
            if (s.id === '__studio_config__') return false;
            const sEmail = s.email?.toLowerCase().trim();
            const sPhone = (s.phone || s.phone_number || '').replace(/[^0-9]/g, '');
            return terms.some(t => t === sEmail || (sPhone && (sPhone === t || sPhone.endsWith(t))));
        });
    } catch {
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
 * Simple merge utility: Union of two arrays by ID field.
 * Used by applyCloudState for staff merging.
 */
export function mergeStudioData(cloud: Record<string, any>, local: Record<string, any>): Record<string, any> {
    // Cloud wins — simply use cloud data
    return { ...local, ...cloud };
}

// Legacy compat stubs — these are no longer used but keep exports
export async function pushEntityToCloud(_orgId: string, _table: string, _entity: any) { }
export async function deleteEntityFromCloud(_orgId: string, _table: string, _id: string): Promise<boolean> { return true; }
export async function fetchEntitiesFromCloud(_orgId: string, _table: string) { return null; }
