const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runAudit() {
    console.log('🔍 Starting Cloud Integrity Audit...');

    // 1. Check Profiles table
    const { data: profiles, error: pError } = await supabase.from('profiles').select('*').limit(5);
    if (pError) {
        if (pError.code === '42P01') console.error('❌ CRITICAL: "profiles" table is MISSING in Supabase.');
        else console.error('❌ Error fetching profiles:', pError);
    } else {
        console.log('✅ "profiles" table exists. Sample count:', profiles.length);
    }

    // 2. Check Studios table
    const { data: studios, error: sError } = await supabase.from('studios').select('org_id, studio_slug').limit(5);
    if (sError) console.error('❌ Error fetching studios:', sError);
    else console.log('✅ "studios" table exists. Sample count:', studios.length);

    // 3. Check RLS policies directly
    const { data: policies, error: polError } = await supabase.rpc('get_policies'); // This might not work without custom RPC
    if (polError) {
        console.log('ℹ️ Cannot list policies via RPC, trying manual query...');
        const { data: polManual, error: pmError } = await supabase.from('pg_policies').select('*').limit(1); 
        // Note: pg_policies might require higher privs or direct SQL
    }
}

runAudit();
