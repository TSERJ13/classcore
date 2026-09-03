
import { createClient } from '@/lib/supabase/client';
import { type StaffMember, type Branch, type StudioSettings } from '@/types';

/**
 * MASTER SYNC BRIDGE v3.5 (EXTREME DIAGNOSTICS)
 * Hardened Cloud Anchor resolution with RLS-bypass simulation.
 */

export async function fetchFullStudioState(slug: string, orgId?: string, token?: string, isClientPortal = false, studentId?: string, chunk?: 'core' | 'heavy') {
    console.log('🔍 [MasterSync] STARTING FULL HYDRATION FOR:', { slug, orgId, hasToken: !!token, isClientPortal, studentId });

    const doFetch = async (attempt: number) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout (was 4s)

        try {
            const response = await fetch('/api/sync/state', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ slug, orgId, isClientPortal, studentId, chunk }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                console.error(`❌ [MasterSync] API fetch failed (attempt ${attempt}):`, response.status, response.statusText);
                return null;
            }

            const data = await response.json();
            
            if (data.error) {
                console.error('❌ [MasterSync] API returned error:', data.error);
                return null;
            }
            
            console.log('📊 [MasterSync] Cloud Extraction Complete:', {
                students: data.students?.length || 0,
                staff: data.staff?.length || 0,
                groups: data.groups?.length || 0,
                events: data.calendar_events?.length || 0,
                settingsFound: !!data.settingsRecord
            });

            return data;
        } catch (e: any) {
            clearTimeout(timeoutId);
            if (e?.name === 'AbortError') {
                console.warn(`⚠️ [MasterSync] Hydration request timed out on attempt ${attempt}`);
            } else {
                console.error('❌ [MasterSync] Collective fetch failed:', e);
            }
            return null;
        }
    };

    // Try up to 2 times
    let result = await doFetch(1);
    if (!result) {
        console.log('🔄 [MasterSync] Retrying hydration (attempt 2)...');
        await new Promise(r => setTimeout(r, 1000)); // wait 1s before retry
        result = await doFetch(2);
    }
    return result;
}

/**
 * Resolves the current Supabase access token (if any) for attaching to
 * `/api/sync/*` requests as `Authorization: Bearer <token>`.
 *
 * These endpoints (`/api/sync/bulk`, `/api/sync/delete`, ...) resolve the
 * caller via `getAuthenticatedOrgId()`, which falls back to reading the
 * Supabase session from cookies when no bearer token is present. That
 * cookie fallback depends on the request actually carrying fresh,
 * server-readable auth cookies — which isn't reliable in every browser
 * context (Safari's cross-site cookie restrictions, a session that just
 * refreshed client-side but hasn't round-tripped through a cookie write
 * yet, etc). Attaching the token explicitly — the same way
 * `fetchFullStudioState` already does — makes auth resolution deterministic
 * instead of depending on cookie propagation.
 */
async function getAuthToken(): Promise<string | undefined> {
    if (typeof window === 'undefined') return undefined;
    try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token;
    } catch {
        return undefined;
    }
}

export async function syncRecordToCloud(table: string, record: any, orgId: string) {
    if (!orgId) return false;

    const payload = { ...record, org_id: orgId };

    // First try via server bulk sync API (admin service role, bypasses RLS)
    try {
        const activeSlug = typeof window !== 'undefined' ? localStorage.getItem('cc_active_studio_slug') : undefined;
        const token = await getAuthToken();
        const res = await fetch('/api/sync/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ table, rows: [payload], slug: activeSlug })
        });
        if (res.ok) return true;
    } catch { /* fallback to direct supabase */ }

    // Fallback: direct Supabase browser client
    const supabase = createClient();
    const conflictCol = table === 'studio_settings' ? 'org_id' : 'id';
    const { error } = await supabase
        .from(table)
        .upsert(payload, { onConflict: conflictCol });

    if (error) {
        console.error(`❌ [MasterSync] Upsert failed for ${table}:`, error.message);
        return false;
    }
    return true;
}
export async function pushFullStudioMetadata(slug: string, name: string, metadata: any, token?: string) {
    if (!slug || slug === 'demo.classcore.ge') return;

    const settingsObj = metadata.settings || metadata;
    const logoUrl = metadata.logo_url || settingsObj.logoDataUrl;
    const orgId = metadata.orgId || settingsObj.orgId || metadata.org_id;

    if (!orgId || orgId === 'demo') {
        console.warn('⚠️ [MasterSync] Skipping push: No OrgID resolved.');
        return;
    }

    console.log(`📤 [MasterSync] Pushing Metadata for ${slug} via API:`, { 
        name, 
        logo: logoUrl ? (logoUrl.startsWith('data:') ? `BASE64 (${Math.round(logoUrl.length/1024)}KB)` : logoUrl) : 'NONE' 
    });

    // 🚀 SCORCHED EARTH v4.1: Strip large collections to prevent payload limit errors
    const sanitizedSettings = { ...settingsObj };
    const collectionsToStrip = ['staff', 'students', 'groups', 'halls', 'calendar_events', 'subscription_plans', 'attendance', 'sales', 'expenses', 'products', 'trash', 'subscriptions'];
    collectionsToStrip.forEach(key => delete sanitizedSettings[key]);

    try {
        // Same deal as syncRecordToCloud/deleteRecordFromCloud: resolve a
        // token ourselves when the caller didn't pass one, instead of
        // relying purely on cookies making it to the server.
        const resolvedToken = token || await getAuthToken();
        const res = await fetch('/api/sync/metadata', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': resolvedToken ? `Bearer ${resolvedToken}` : ''
            },
            body: JSON.stringify({
                slug,
                name,
                logoUrl,
                orgId,
                settings: sanitizedSettings
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Sync failed');
        }

        console.log(`✅ [MasterSync] Metadata Pushed Successfully for ${slug}`);
    } catch (err: any) {
        console.error('❌ [MasterSync] API Metadata Push Failed:', err.message);
    }
}

export async function pushCollectionToCloud(table: string, items: any[], orgId: string, slug?: string) {
    const supabase = createClient();
    if (!orgId || !items || items.length === 0) return false;

    console.log(`📡 [MasterSync] Bulk Pushing ${items.length} records to ${table}...`);
    
    // Chunking to avoid large payload errors
    const chunkSize = 50;
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize).map(item => {
            const row: any = {
                ...item,
                org_id: orgId,
                data: item // 🔥 ALWAYS PRESERVE FULL DATA BLOB FOR HYDRATION PARITY
            };
            
            // 🕒 TIME TRANSFORMATION for calendar_events (Legacy DB Support)
            if (table === 'calendar_events') {
                if (typeof row.start_time === 'string' && row.start_time.includes(':') && row.start_time.length <= 5) {
                    row.start_time = `2024-01-01T${row.start_time}:00Z`;
                }
                if (typeof row.end_time === 'string' && row.end_time.includes(':') && row.end_time.length <= 5) {
                    row.end_time = `2024-01-01T${row.end_time}:00Z`;
                }
            }
            
            if (table === 'staff') {
                delete row.photo_url;
            }
            
            return row;
        });

        // 🚀 BYPASS RLS: Call our secure bulk sync API instead of direct Supabase upsert
        try {
            const token = await getAuthToken();
            const apiRes = await fetch('/api/sync/bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    table,
                    rows: chunk,
                    slug: slug || 'unknown'
                })
            });

            if (!apiRes.ok) {
                const errData = await apiRes.json();
                throw new Error(errData.error || 'API Bulk push failed');
            }
            
            console.log(`✅ [MasterSync] Bulk Pushed ${chunk.length} records to ${table}`);
        } catch (error: any) {
            console.error(`❌ [MasterSync] Bulk push failed for ${table} chunk:`, error.message);
        }
    }
    
    return true;
}

export async function ensureStudioExists(slug: string, name: string) {
    const supabase = createClient();
    console.log('🛡️ [MasterSync] Verifying Cloud Anchor for:', slug);
    
    try {
        // 1. Aggressive Discovery
        const { data: studios } = await supabase.from('studios').select('org_id').eq('studio_slug', slug);
        if (studios && studios.length > 0) {
            console.log('🛡️ [MasterSync] Cloud Anchor Resolved:', studios[0].org_id);
            return studios[0].org_id;
        }

        // 2. Try to fetch again after a short delay if we're authenticated
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
             const { data: retry } = await supabase.from('studios').select('org_id').eq('studio_slug', slug).maybeSingle();
             if (retry) return retry.org_id;
        }

        // 3. Create if missing (Only if we cannot find it anywhere else)

        console.log('🛡️ [MasterSync] Anchor missing. Creating new cloud silo...');
        const { data: created, error: createError } = await supabase
            .from('studios')
            .upsert({
                studio_slug: slug,
                studio_name: name || 'Studio'
            }, { onConflict: 'studio_slug' })
            .select('org_id')
            .maybeSingle();
        
        if (createError) {
            // If it failed due to uniqueness, try one last lookup
            const { data: final } = await supabase.from('studios').select('org_id').eq('studio_slug', slug).maybeSingle();
            if (final) return final.org_id;
            throw createError;
        }
        return created?.org_id;

    } catch (err) {
        console.error('❌ [MasterSync] Anchor failed:', err);
        return null;
    }
}
export async function deleteRecordFromCloud(table: string, id: string, orgId: string) {
    if (!id) return false;

    console.log(`🗑️ [MasterSync] Permanent deletion from ${table}:`, id);
    // Route through the server-side admin endpoint (service role). The browser
    // client is subject to RLS and a blocked DELETE silently removes 0 rows,
    // which is why deleted records used to reappear after a refresh.
    try {
        const token = await getAuthToken();
        const res = await fetch('/api/sync/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ table, id, orgId }),
        });
        if (!res.ok) {
            const info = await res.json().catch(() => ({}));
            console.error(`❌ [MasterSync] Delete failed for ${table}:`, info?.error || res.status);
            return false;
        }
        return true;
    } catch (err: any) {
        console.error(`❌ [MasterSync] Delete request error for ${table}:`, err?.message);
        return false;
    }
}

export async function fetchHeavyStudioState(slug: string, orgId?: string, token?: string, isClientPortal = false, studentId?: string) {
    return fetchFullStudioState(slug, orgId, token, isClientPortal, studentId, 'heavy');
}
