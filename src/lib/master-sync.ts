
import { createClient } from '@/lib/supabase/client';
import { type StaffMember, type Branch, type StudioSettings } from '@/types';

/**
 * MASTER SYNC BRIDGE v3.5 (EXTREME DIAGNOSTICS)
 * Hardened Cloud Anchor resolution with RLS-bypass simulation.
 */

export async function fetchFullStudioState(slug: string, orgId?: string) {
    console.log('🔍 [MasterSync] STARTING FULL HYDRATION FOR:', { slug, orgId });
    
    try {
        const response = await fetch('/api/sync/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, orgId })
        });
        
        if (!response.ok) {
            console.error('❌ [MasterSync] API fetch failed:', response.statusText);
            return null;
        }

        const data = await response.json();
        
        if (data.error) {
            console.error('❌ [MasterSync] API returned error:', data.error);
            return null;
        }
        
        console.log('📊 [MasterSync] Cloud Extraction Complete (Admin Bypass):', {
            students: data.students?.length || 0,
            staff: data.staff?.length || 0,
            groups: data.groups?.length || 0,
            events: data.calendar_events?.length || 0,
            settingsFound: !!data.settingsRecord
        });

        return data;
    } catch (e) {
        console.error('❌ [MasterSync] Collective fetch failed:', e);
        return null;
    }
}

export async function syncRecordToCloud(table: string, record: any, orgId: string) {
    const supabase = createClient();
    if (!orgId) return false;

    const payload = { ...record, org_id: orgId };
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
export async function pushFullStudioMetadata(slug: string, name: string, metadata: any) {
    const supabase = createClient();
    console.log('📡 [MasterSync] Pushing Full Metadata for:', slug);
    
    // RESOLVE FIELDS
    const settingsObj = metadata.settings || metadata;
    const logoUrl = metadata.logo_url || settingsObj.logoDataUrl;
    
    console.log(`📤 [MasterSync] Pushing Metadata for ${slug}:`, { 
        name, 
        logo: logoUrl ? (logoUrl.startsWith('data:') ? `BASE64 (${Math.round(logoUrl.length/1024)}KB)` : logoUrl) : 'NONE' 
    });
    const themeKey = metadata.theme || settingsObj.themeKey || settingsObj.theme_key;

    // 1. Update 'studios' table (discovery - LEAN)
    const discoverySettings = {
        ...settingsObj,
        staff: undefined,
        students: undefined,
        groups: undefined,
        halls: undefined,
        calendar_events: undefined,
        subscription_plans: undefined
    };

    const { data, error } = await supabase
        .from('studios')
        .upsert({
            studio_slug: slug,
            studio_name: name,
            logo_url: logoUrl,
            theme_key: themeKey,
            currency: settingsObj.currency,
            language: settingsObj.language,
            owner_info: settingsObj.owner_info,
            plan: settingsObj.plan,
            suspended: settingsObj.suspended,
            is_deleted: settingsObj.is_deleted,
            settings: discoverySettings
        }, { onConflict: 'studio_slug' })
        .select('org_id')
        .maybeSingle();
    
    if (error) {
        console.error('❌ [MasterSync] Studios table push failed:', error.message);
    }
    
    const orgId = data?.org_id;

    // 2. Update 'studio_settings' table (full recovery blob - OPTIMIZED)
    if (orgId) {
        const leanSettings = { ...settingsObj };
        // Strip base64 photos from staff to save space in the blob
        if (Array.isArray(leanSettings.staff)) {
            leanSettings.staff = leanSettings.staff.map((s: any) => ({ ...s, photo_url: s.photo_url?.startsWith('data:') ? 'EXISTS' : s.photo_url }));
        }
        
        const staffEmails = Array.isArray(settingsObj.staff) ? settingsObj.staff.map((s: any) => s.email?.toLowerCase().trim()).filter(Boolean) : [];
        
        await supabase
            .from('studio_settings')
            .upsert({
                org_id: orgId,
                settings: leanSettings,
                staff_emails: staffEmails,
                updated_at: new Date().toISOString()
            }, { onConflict: 'org_id' });
    }
    
    return orgId;
}

export async function pushCollectionToCloud(table: string, items: any[], orgId: string) {
    const supabase = createClient();
    if (!orgId || !items || items.length === 0) return false;

    console.log(`📡 [MasterSync] Bulk Pushing ${items.length} records to ${table}...`);
    
    // Chunking to avoid large payload errors
    const chunkSize = 50;
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize).map(item => ({
            ...item,
            org_id: orgId,
            data: item // Parity with unwrap
        }));

        const { error } = await supabase
            .from(table)
            .upsert(chunk, { onConflict: 'id' });

        if (error) {
            console.error(`❌ [MasterSync] Bulk push failed for ${table} chunk:`, error.message);
            return false;
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
    const supabase = createClient();
    if (!orgId || !id) return false;

    console.log(`🗑️ [MasterSync] Permanent deletion from ${table}:`, id);
    const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)
        .eq('org_id', orgId);

    if (error) {
        console.error(`❌ [MasterSync] Delete failed for ${table}:`, error.message);
        return false;
    }
    return true;
}
