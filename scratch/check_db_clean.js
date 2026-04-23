
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkTables() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
        .from('pg_tables')
        .select('tablename')
        .eq('schemaname', 'public');
    
    // Fallback: try to query a common table name to see if it exists
    const { error: studioError } = await supabase.from('studios').select('count', { count: 'exact', head: true });
    const { error: settingsError } = await supabase.from('studio_settings').select('count', { count: 'exact', head: true });

    console.log('--- Database Audit ---');
    if (studioError && studioError.code === '42P01') console.log('✅ "studios" deleted');
    else console.log('❌ "studios" still exists or error:', studioError?.message);

    if (settingsError && settingsError.code === '42P01') console.log('✅ "studio_settings" deleted');
    else console.log('❌ "studio_settings" still exists or error:', settingsError?.message);
    
    console.log('----------------------');
}

checkTables();
