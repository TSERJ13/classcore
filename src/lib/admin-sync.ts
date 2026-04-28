import { getStudioRegistry } from './settings-store';

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
        const data = await res.json();
        
        if (data && data.studios && Array.isArray(data.studios)) {
            if (data.debug) {
                console.log('📡 [AdminSync] API Diagnostics:', data.debug);
                if (data.debug.stdError || data.debug.settingsError) {
                    console.error('❌ [AdminSync] Sync Errors Detected:', { std: data.debug.stdError, settings: data.debug.settingsError });
                }
            }
            const studios: any[] = data.studios;
            const cloudSlugs: string[] = studios.map(s => s.slug).filter(Boolean);
            const localRegistry = getStudioRegistry();
            
            // 🚨 STRICT CLOUD TRUTH: We ONLY keep what is verified in the cloud.
            const nextList = [...new Set(cloudSlugs)];
            
            // 🚨 HARD WIPE: Clean up orphans and ghosts
            const listToClean = localRegistry.filter(slug => !nextList.includes(slug) && slug !== 'demo.classcore.ge');
            
            listToClean.forEach(slug => {
                console.log(`🧹 [Sync] Purging ghost studio: ${slug}`);
                localStorage.removeItem(`cc_studio_settings_${slug}`);
                localStorage.removeItem(`cc_sa_meta_${slug}`);
                localStorage.removeItem(`cc_student_data_${slug}`);
                localStorage.removeItem(`cc_groups_${slug}`);
                localStorage.removeItem(`cc_halls_${slug}`);
                localStorage.removeItem(`cc_saas_billing_${slug}`);
                localStorage.removeItem(`cc_active_branch_${slug}`);
                localStorage.removeItem(`cc_org_id_override_${slug}`);
            });

            // Update Registry with Cloud Truth
            localStorage.setItem('cc_studios_list', JSON.stringify([...new Set(nextList)]));
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
