
import { createClient } from '@/lib/supabase/client';
import { type StaffMember, type Branch, type StudioSettings } from '@/types';

/**
 * MASTER SYNC BRIDGE v4.0 (IO-OPTIMIZED)
 * - Debounced writes: max 1 write per 1 second per record
 * - Batched upserts: multiple changes grouped into single DB call
 */

// ─── Debounce Registry ────────────────────────────────────────────────────────
const pendingWrites: Map<string, { table: string; record: any; orgId: string; timer: ReturnType<typeof setTimeout> }> = new Map();
const DEBOUNCE_MS = 1000; // 1 second - responsive but avoids rapid-fire IO

export async function fetchFullStudioState(slug: string, orgId?: string, token?: string, isClientPortal = false, studentId?: string) {
    console.log('🔍 [MasterSync] STARTING FULL HYDRATION FOR:', { slug, orgId, hasToken: !!token });
    try {
        const response = await fetch('/api/sync/state', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ slug, orgId, isClientPortal, studentId })
        });
        if (!response.ok) {
            if (typeof window !== 'undefined') {
                (window as any)._portalDebug = { 
                    ...((window as any)._portalDebug || {}),
                    status: 'CloudFetchError',
                    httpStatus: response.status
                };
            }
            console.error('❌ [MasterSync] API fetch failed:', response.statusText); return null; 
        }
        const data = await response.json();
        if (data.error) { console.error('❌ [MasterSync] API error:', data.error); return null; }
        console.log('📊 [MasterSync] Hydration Complete:', { students: data.students?.length || 0, staff: data.staff?.length || 0 });
        return data;
    } catch (e) {
        console.error('❌ [MasterSync] Fetch failed:', e);
        return null;
    }
}

/**
 * DEBOUNCED sync — queues a write and only executes after a delay.
 */
export async function syncRecordToCloud(table: string, record: any, orgId: string): Promise<boolean> {
    if (!orgId || !record?.id) return false;
    const key = `${table}:${record.id}`;
    const existing = pendingWrites.get(key);
    if (existing) clearTimeout(existing.timer);

    const timer = setTimeout(async () => {
        pendingWrites.delete(key);
        await _flushRecord(table, record, orgId);
    }, DEBOUNCE_MS);

    pendingWrites.set(key, { table, record, orgId, timer });
    return true; // Optimistically return true
}

async function _flushRecord(table: string, record: any, orgId: string): Promise<boolean> {
    const supabase = createClient();
    const payload = { ...record, org_id: orgId };
    const conflictCol = table === 'studio_settings' ? 'org_id' : 'id';
    
    // ATTEMPT 1: Full payload
    let { error } = await supabase.from(table).upsert(payload, { onConflict: conflictCol });
    
    // ATTEMPT 2: Fallback for missing columns or type mismatches (e.g. UUID)
    const isTypeError = error && (error.message?.includes('invalid input syntax') || error.message?.includes('type uuid'));
    const isMissingColumn = error && error.message?.includes('column');

    if (isTypeError || isMissingColumn) {
        if (isTypeError) {
            console.warn(`⚠️ [MasterSync] '${table}' type mismatch (likely UUID). Retrying with minimal fields.`);
        } else {
            const colMatch = error.message?.match(/'([^']+)' column/);
            console.warn(`⚠️ [MasterSync] '${table}' missing column '${colMatch?.[1]}' — retrying with minimal fields`);
        }
        
        // Minimal payload: id, org_id, and stuff everything else into data
        const minimal: any = {
            id: record.id,
            org_id: orgId,
            data: { ...record }
        };
        
        // Only keep fields if they are simple strings and likely to exist
        ['name', 'title', 'date'].forEach(field => {
            if (record[field] !== undefined && typeof record[field] === 'string') {
                minimal[field] = record[field];
            }
        });

        // 🚨 IMPORTANT: If student_id contains a comma, it's a shared ID. 
        // If the DB expects a UUID, it will fail. So we only include it if it looks like a single ID.
        if (record.student_id && typeof record.student_id === 'string' && !record.student_id.includes(',')) {
            minimal.student_id = record.student_id;
        }
        
        const retry = await supabase.from(table).upsert(minimal, { onConflict: conflictCol });
        if (retry.error) {
            console.error(`❌ [MasterSync] Retry failed for ${table}: ${retry.error.message}`);
            return false;
        }
        console.log(`✅ [MasterSync] Flushed ${table}:${record.id} (minimal fallback successful)`);
        return true;
    }
    
    if (error) { console.error(`❌ [MasterSync] Upsert failed for ${table}:`, error.message); return false; }
    console.log(`✅ [MasterSync] Flushed ${table}:${record.id}`);
    return true;
}

export async function flushAllPending(): Promise<void> {
    const promises: Promise<boolean>[] = [];
    for (const [key, pending] of pendingWrites.entries()) {
        clearTimeout(pending.timer);
        pendingWrites.delete(key);
        promises.push(_flushRecord(pending.table, pending.record, pending.orgId));
    }
    await Promise.all(promises);
}

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => { flushAllPending(); });
}

export async function pushFullStudioMetadata(slug: string, name: string, metadata: any, token?: string) {
    if (!slug || slug === 'demo.classcore.ge') return;
    const settingsObj = metadata.settings || metadata;
    const logoUrl = metadata.logo_url || settingsObj.logoDataUrl;
    const orgId = metadata.orgId || settingsObj.orgId || metadata.org_id;
    if (!orgId || orgId === 'demo') { console.warn('⚠️ [MasterSync] Skipping push: No OrgID.'); return; }
    const sanitizedSettings = { ...settingsObj };
    ['staff','students','groups','halls','calendar_events','subscription_plans','attendance','sales','expenses','products','trash','subscriptions'].forEach(k => delete sanitizedSettings[k]);
    try {
        const res = await fetch('/api/sync/metadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
            body: JSON.stringify({ slug, name, logoUrl, orgId, settings: sanitizedSettings })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Sync failed');
        console.log(`✅ [MasterSync] Metadata Pushed for ${slug}`);
    } catch (err: any) {
        console.error('❌ [MasterSync] Metadata Push Failed:', err.message);
    }
}

export async function pushCollectionToCloud(table: string, items: any[], orgId: string, slug?: string) {
    const supabase = createClient();
    if (!orgId || !items || items.length === 0) return false;
    const chunkSize = 50;
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize).map(item => {
            const row: any = { ...item, org_id: orgId, data: item };
            if (table === 'calendar_events') {
                if (typeof row.start_time === 'string' && row.start_time.includes(':') && row.start_time.length <= 5) row.start_time = `2024-01-01T${row.start_time}:00Z`;
                if (typeof row.end_time === 'string' && row.end_time.includes(':') && row.end_time.length <= 5) row.end_time = `2024-01-01T${row.end_time}:00Z`;
            }
            if (table === 'staff') delete row.photo_url;
            return row;
        });
        try {
            const apiRes = await fetch('/api/sync/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ table, rows: chunk, slug: slug || 'unknown' })
            });
            if (!apiRes.ok) throw new Error((await apiRes.json()).error || 'Bulk push failed');
            console.log(`✅ [MasterSync] Bulk Pushed ${chunk.length} to ${table}`);
        } catch (error: any) {
            console.error(`❌ [MasterSync] Bulk push failed for ${table}:`, error.message);
        }
    }
    return true;
}

export async function ensureStudioExists(slug: string, name: string) {
    const supabase = createClient();
    try {
        const { data: studios } = await supabase.from('studios').select('org_id').eq('studio_slug', slug);
        if (studios && studios.length > 0) return studios[0].org_id;
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: retry } = await supabase.from('studios').select('org_id').eq('studio_slug', slug).maybeSingle();
            if (retry) return retry.org_id;
        }
        const { data: created, error: createError } = await supabase.from('studios').upsert({ studio_slug: slug, studio_name: name || 'Studio' }, { onConflict: 'studio_slug' }).select('org_id').maybeSingle();
        if (createError) {
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
    if (!orgId || !id) return false;
    const key = `${table}:${id}`;
    const existing = pendingWrites.get(key);
    if (existing) { clearTimeout(existing.timer); pendingWrites.delete(key); }
    try {
        const res = await fetch('/api/sync/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table, id, orgId })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Delete failed');
        console.log(`✅ [MasterSync] Deleted ${id} from ${table}`);
        return true;
    } catch (error: any) {
        console.error(`❌ [MasterSync] Delete failed for ${table}:`, error.message);
        return false;
    }
}
