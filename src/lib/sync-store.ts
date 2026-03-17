import { createClient } from './supabase/client';
import { type StaffMember } from './settings-store';

const SETTINGS_TABLE = 'studio_settings';

/**
 * Consolidates all studio state into a single push to prevent race conditions or overwrites.
 * Updates staff_data, staff_emails, and studio_data in one UPSERT.
 */
export async function pushStudioStateToCloud(slug: string, staff: StaffMember[], studioData: any) {
    if (typeof window === 'undefined') return;
    if (!slug || slug === 'demo.classcore.ge') return;

    try {
        const supabase = createClient();

        // WORKAROUND: Embedding studio settings into staff_data because studio_data column is missing in Supabase
        const consolidatedStaff = [
            ...staff.filter(s => s.id !== '__studio_config__'),
            { id: '__studio_config__', studio_data: studioData } as any
        ];

        const { error } = await supabase
            .from(SETTINGS_TABLE)
            .upsert({
                studio_slug: slug,
                staff_data: consolidatedStaff,
                staff_emails: staff.filter(s => s.email).map(s => s.email!.toLowerCase().trim()),
                // studio_data: studioData, // REMOVED: column does not exist
                updated_at: new Date().toISOString()
            }, { onConflict: 'studio_slug' });

        if (error) {
            console.error('❌ Cloud Sync Consolidated Push Failed:', error.message);
        } else {
            console.log('✅ Cloud Sync Consolidated Push Successful for:', slug);
        }
    } catch (err) {
        console.error('❌ Consolidated Sync Critical Error:', err);
    }
}

/** 
 * Fetches the entire studio row from Supabase.
 */
export async function pullStudioStateFromCloud(slug: string): Promise<{ staff_data: StaffMember[], studio_data: any } | null> {
    if (typeof window === 'undefined') return null;
    if (!slug || slug === 'demo.classcore.ge') return null;

    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from(SETTINGS_TABLE)
            .select('staff_data, updated_at') // Removed studio_data
            .eq('studio_slug', slug)
            .maybeSingle();

        if (error || !data) return null;

        const allData = data.staff_data as any[];
        const configEntry = allData.find(item => item.id === '__studio_config__');
        const realStaff = allData.filter(item => item.id !== '__studio_config__');

        return {
            staff_data: realStaff as StaffMember[],
            studio_data: configEntry?.studio_data || {}
        };
    } catch {
        return null;
    }
}

// Keep legacy functions for backward compatibility or simple leaf calls if needed, 
// but preferred use is the consolidated ones above.

export async function syncStaffToCloud(slug: string, staff: StaffMember[]) {
    return pushStudioStateToCloud(slug, staff, {}); // Partial push (risky if not careful)
}

export async function fetchStaffFromCloud(slug: string): Promise<StaffMember[] | null> {
    const state = await pullStudioStateFromCloud(slug);
    return state?.staff_data || null;
}

export async function findStudioByStaffEmail(email: string): Promise<{ staff: StaffMember, slug: string } | null> {
    if (typeof window === 'undefined') return null;
    const cleanEmail = email.trim().toLowerCase();

    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from(SETTINGS_TABLE)
            .select('studio_slug, staff_data, staff_emails')
            .contains('staff_emails', [cleanEmail])
            .limit(1)
            .maybeSingle();

        if (error || !data) return null;

        const staff = (data.staff_data as StaffMember[]).find(s =>
            s.email?.toLowerCase().trim() === cleanEmail
        );

        if (staff) return { staff, slug: data.studio_slug };
        return null;
    } catch (err) {
        return null;
    }
}

export async function checkCloudConnection(slug: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!slug || slug === 'demo.classcore.ge') return false;

    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from(SETTINGS_TABLE)
            .select('studio_slug')
            .eq('studio_slug', slug)
            .maybeSingle();

        return !error && !!data;
    } catch {
        return false;
    }
}

export async function syncStudioDataToCloud(slug: string, data: any) {
    // Redirection to consolidated push to maintain backward compatibility safely
    // Note: We don't have the staff list here, so we load it from local first
    const { loadSettings } = await import('./settings-store');
    const settings = loadSettings(slug);
    return pushStudioStateToCloud(slug, settings.staff, data);
}

export async function fetchStudioDataFromCloud(slug: string): Promise<any | null> {
    const state = await pullStudioStateFromCloud(slug);
    return state?.studio_data || null;
}
