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
                    keysToRemove.push(key);
                }
            }

            // Execute purge
            keysToRemove.forEach(key => localStorage.removeItem(key));

            // Set new version
            localStorage.setItem(VERSION_KEY, CURRENT_CACHE_VERSION);
            
            console.log('[CacheBuster] Purge complete. System is now at version:', CURRENT_CACHE_VERSION);
            
            // Forces a one-time reload to ensure all stores re-initialize from scratch
            // We reload with a unique parameter to bypass some CDN/Service Worker caches
            window.location.href = window.location.pathname + '?v=' + Date.now();
        }
    } catch (e) {
        console.error('[CacheBuster] Failed to process cache version check', e);
    }
}
