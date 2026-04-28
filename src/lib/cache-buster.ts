/**
 * cache-buster.ts
 * Forces a one-time clear of localStorage for production launch
 * to ensure no legacy mock data persists in users' browsers.
 */

const CURRENT_CACHE_VERSION = 'v2.3.2-nuclear-fix';
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
                    // NEVER purge SuperAdmin data (cc_sa_*) — it's fetched from API, not stale cache
                    // NEVER purge rescue/sync flags
                    if (key === VERSION_KEY) continue;
                    if (key.startsWith('cc_sa_')) continue;
                    if (key.startsWith('cc_rescue_done_')) continue;
                    if (key.startsWith('cc_bday_notif_')) continue;
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
