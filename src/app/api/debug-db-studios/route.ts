import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Config missing' });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Check studios table
        const { data: studios, error: studiosError } = await supabase.from('studios').select('*');
        
        // Check studio_settings table
        const { data: settings, error: settingsError } = await supabase.from('studio_settings').select('studio_slug');

        return NextResponse.json({ 
            studios: studios || [], 
            studiosError: studiosError?.message,
            settings: settings || [],
            settingsError: settingsError?.message
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message });
    }
}
