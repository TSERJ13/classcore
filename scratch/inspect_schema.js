const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectSchema() {
    console.log('🕵️ Inspecting Database Schema...');

    const { data: tables, error: tError } = await supabase.rpc('get_tables_and_columns'); 
    
    // Fallback: Use information_schema via query if RPC fails
    const { data: infoSchema, error: iError } = await supabase
        .from('pg_catalog.pg_tables') // This might not be accessible via rest
        .select('tablename')
        .eq('schemaname', 'public');

    // Most reliable for us: Just try to select from likely candidates
    const candidates = ['studio_settings', 'studios', 'profiles'];
    for (const table of candidates) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`❌ Table [${table}] check failed:`, error.message);
        } else {
            console.log(`✅ Table [${table}] exists. Columns:`, data[0] ? Object.keys(data[0]) : 'Empty table');
        }
    }
}

inspectSchema();
