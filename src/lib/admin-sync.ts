import { getStudioRegistry } from './settings-store';

export async function syncGlobalAdminRegistry() {
    try {
        const res = await fetch(`/api/superadmin/studios/list?t=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'Pragma': 'no-cache' }
        });
        const data = await res.json();
        
        if (data.studios) {
            const studios: any[] = data.studios;
            const cloudSlugs: string[] = studios.map(s => s.slug);
            const localRegistry = getStudioRegistry();
            
            // For Admins, we ONLY keep what is in the cloud + demo
            const nextList = cloudSlugs.filter(s => s !== 'demo.classcore.ge');
            if (localRegistry.includes('demo.classcore.ge')) nextList.unshift('demo.classcore.ge');
            
            // Clean up orphans
            localRegistry.forEach(slug => {
                if (!nextList.includes(slug) && slug !== 'demo.classcore.ge') {
                    localStorage.removeItem(`cc_studio_settings_${slug}`);
                    localStorage.removeItem(`cc_sa_meta_${slug}`);
                    localStorage.removeItem(`cc_student_data_${slug}`);
                    localStorage.removeItem(`cc_groups_${slug}`);
                    localStorage.removeItem(`cc_halls_${slug}`);
                    localStorage.removeItem(`cc_saas_billing_${slug}`);
                }
            });

            localStorage.setItem('cc_studios_list', JSON.stringify([...new Set(nextList)]));
            // Store the full details for pages that need it without hitting API again
            localStorage.setItem('cc_sa_studios_data', JSON.stringify(studios));

            return studios;
        }
    } catch (err) {
        console.error('Failed to sync global admin registry:', err);
    }
    return [];
}
