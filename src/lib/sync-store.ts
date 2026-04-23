
/**
 * SYNC STORE v3.0 (CLEAN)
 * Legacy blob-based sync has been decommissioned.
 * This file now serves as a bridge for the UI while MasterSync handles actual data.
 */

import { markLocalUpdate as markUtilsUpdate } from './utils';

export function markLocalUpdate() {
    markUtilsUpdate();
}

export function triggerInstantSync() {
    window.dispatchEvent(new Event('cc_instant_sync_request'));
}

export async function pullStudioStateFromCloud(slug: string, orgId?: string): Promise<any> {
    // console.log('☁️ [SyncStore] Legacy Pull redirected to MasterSync...');
    return null; 
}

export async function pushStudioStateToCloud(
    slug: string, 
    deletedIds: string[] = [], 
    localData: Record<string, any> = {}
): Promise<boolean> {
    // console.log('☁️ [SyncStore] Legacy Push neutralized.');
    return true; 
}

export async function forceIntegrityCheck() {
    return true;
}

// Keep constants if any components use them
export const SYNC_VERSION = '3.0.0-normalized';
