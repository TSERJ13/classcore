export async function syncGlobalAdminRegistry(force = false) {
    try {
        // 🛡️ CACHE LAYER: 10-second stale-while-revalidate (Reduced from 5m for debugging)
        const lastSync = parseInt(localStorage.getItem('cc_sa_last_sync') || '0');
        const now = Date.now();
        const studiosData = localStorage.getItem('cc_sa_studios_data');
        
        if (!force && lastSync && (now - lastSync < 10 * 1000) && studiosData) {
            console.log('⚡ [AdminSync] Using fresh cache (v4.7)');
            try {
                return JSON.parse(studiosData);
            } catch { /* fallback to fetch */ }
        }

        const res = await fetch(`/api/superadmin/studios/list?t=${now}`, {
            cache: 'no-store',
            headers: { 'Pragma': 'no-cache' }
        });

        if (res.status === 401) {
            console.error('🔒 [AdminSync] Not authorized as superadmin — log in at /sa-login with a superadmin account.');
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('cc_sync_pull_error', { detail: { type: 'admin', status: 401 } }));
            }
            return null;
        }

        const data = await res.json();

        if (!res.ok) {
            console.error('❌ [AdminSync] studios/list failed:', res.status, data?.error);
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('cc_sync_pull_error', { detail: { type: 'admin', status: res.status } }));
            }
            return [];
        }

        if (data && data.studios && Array.isArray(data.studios)) {
            const studios: any[] = data.studios;
            const cloudSlugs: string[] = studios.map(s => s.slug).filter(Boolean);

            // 🛡️ SAFETY: only reconcile if the cloud actually returned studios.
            // A transient empty/failed response must NEVER trigger a purge.
            if (cloudSlugs.length === 0) {
                console.warn('🛡️ [AdminSync] Cloud returned 0 studios — skipping reconcile to avoid data loss.');
                return studios;
            }

            const nextList = [...new Set(cloudSlugs)];

            // 🛡️ NON-DESTRUCTIVE: previously we hard-deleted every localStorage key
            // for any slug missing from the cloud list. A single API hiccup could
            // wipe a live studio's students/groups ("disappears then reappears").
            // We now only update the registry pointer. Orphan data keys are inert —
            // they're never read unless the slug is in the registry — so leaving
            // them is safe and reversible. Real deletions go through the explicit
            // superadmin delete-studio flow, not this background sync.
            localStorage.setItem('cc_studios_list', JSON.stringify(nextList));
            localStorage.setItem('cc_sa_studios_data', JSON.stringify(studios));
            localStorage.setItem('cc_sa_last_sync', now.toString());

            // 📢 DISPATCH FEEDBACK EVENTS
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('cc_sync_pull_ok', { detail: { time: new Date().toISOString(), type: 'admin' } }));
            }

            return studios;
        }
    } catch (err) {
        console.error('Failed to sync global admin registry:', err);
    }
    return [];
}
