import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { keepSlug } = await req.json();
        
        if (!keepSlug) {
            return NextResponse.json({ error: 'Missing keepSlug' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Delete all studios except the one to keep
        const { error: deleteError } = await supabase
            .from('studio_settings')
            .delete()
            .neq('studio_slug', keepSlug);

        if (deleteError) throw deleteError;

        // 2. Reset the kept studio's data
        // We fetch the current data first to preserve the owner
        const { data: studio, error: fetchError } = await supabase
            .from('studio_settings')
            .select('*')
            .eq('studio_slug', keepSlug)
            .single();

        if (fetchError) throw fetchError;

        const staffData = (studio.staff_data as any[]) || [];
        const owner = staffData.find(s => s.role === 'owner');
        const studioConfig = staffData.find(s => s.id === '__studio_config__');

        // Clean staff_data: Keep only owner and studio config skeleton
        const newStaffData = [];
        if (owner) {
            // Ensure owner has a clean state (no enrolled groups, etc. if that's stored there)
            newStaffData.push({
                ...owner,
                enrolled_group_ids: [],
                subscription_ids: [],
                attendance_history: []
            });
        }
        
        if (studioConfig) {
            newStaffData.push({
                ...studioConfig,
                // Optionally reset some studio_data fields if needed
            });
        } else {
            // Create default config if missing
            newStaffData.push({
                id: '__studio_config__',
                studio_data: {
                    studioName: keepSlug,
                    studioSlug: keepSlug,
                    currency: 'GEL',
                    language: 'ka',
                    branches: [{ id: 'main', name: 'Main Branch', address: '' }]
                }
            });
        }

        const { error: updateError } = await supabase
            .from('studio_settings')
            .update({
                staff_data: newStaffData,
                updated_at: new Date().toISOString()
            })
            .eq('studio_slug', keepSlug);

        if (updateError) throw updateError;

        return NextResponse.json({ 
            success: true, 
            message: `System reset complete. Preserved studio: ${keepSlug}. Removed other studios and purged data.` 
        });

    } catch (err: any) {
        console.error('❌ Master Reset API Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
