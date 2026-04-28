/**
 * cache-buster.ts
 * Forces a one-time clear of localStorage for production launch
 * to ensure no legacy mock data persists in users' browsers.
 */

const CURRENT_CACHE_VERSION = 'v2.4.0-stable';
const VERSION_KEY = 'cc_system_version';

export function checkCacheVersion(): void {
    if (typeof window === 'undefined') return;

    try {
        const storedVersion = localStorage.getItem(VERSION_KEY);

        if (storedVersion !== CURRENT_CACHE_VERSION) {
            console.warn(`[CacheBuster] Version mismatch (${storedVersion} vs ${CURRENT_CACHE_VERSION}). Purging local storage...`);
            
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('cc_') || key === 'sb-token' || key === 'supabase.auth.token')) {
                    // NEVER purge the version key itself (prevents infinite purge loop)
                    if (key === VERSION_KEY) continue;
                    // NEVER purge SuperAdmin data (fetched from API, not stale cache)
                    if (key.startsWith('cc_sa_')) continue;
                    // NEVER purge identity anchoring keys (needed for getScopedKey to resolve correctly)
                    if (key === 'cc_active_studio_slug') continue;
                    if (key.startsWith('cc_org_id_override_')) continue;
                    if (key.startsWith('cc_org_id_')) continue;
                    if (key.startsWith('cc_studio_settings_')) continue;
                    if (key.startsWith('cc_active_branch_')) continue;
                    // NEVER purge session flags
                    if (key.startsWith('cc_rescue_done_')) continue;
                    if (key.startsWith('cc_bday_notif_')) continue;
                    if (key.startsWith('cc_last_sync_')) continue;
                    keysToRemove.push(key);
                }
            }

            // Execute purge
            keysToRemove.forEach(key => localStorage.removeItem(key));

            // Set new version
            localStorage.setItem(VERSION_KEY, CURRENT_CACHE_VERSION);
            
            console.log('[CacheBuster] Purge complete. System is now at version:', CURRENT_CACHE_VERSION);
            
            // We no longer force a hard reload here to avoid the "double refresh" experience.
            // The system will pick up new changes on the next mount or manual refresh.
        }
    } catch (e) {
        console.error('[CacheBuster] Failed to process cache version check', e);
    }
}
