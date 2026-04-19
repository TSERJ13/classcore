const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xnhzqalncwcefnhoqzxe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODU5MjcsImV4cCI6MjA4NzM2MTkyN30.tapUV9nQIYkJif0lS9OQNFSBgIoZLuJhexcmtfj3h48';

const slug = 'stdance'; // Assuming this is the user's slug based on previous logs

async function checkData() {
    console.log('🧐 [Audit] Checking granular SQL tables for slug:', slug);
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. Get OrgId from studio_settings
    const { data: studio, error: studioError } = await supabase
        .from('studio_settings')
        .select('org_id')
        .eq('studio_slug', slug)
        .single();

    if (studioError || !studio) {
        console.error('❌ [Audit] Could not find studio record to get OrgId');
        return;
    }

    const orgId = studio.org_id;
    console.log('✅ [Audit] Found OrgId:', orgId);

    const tables = ['students', 'groups', 'halls', 'calendar_events', 'studios'];
    
    for (const table of tables) {
        const { data, error, count } = await supabase
            .from(table)
            .select('*', { count: 'exact' })
            .eq('org_id', orgId);
        
        if (error) {
            console.error(`❌ [Audit] Error reading ${table}:`, error.message);
        } else {
            console.log(`📊 [Audit] Table [${table}]: ${count} records found.`);
            if (data && data.length > 0) {
                console.log(`   Sample ID: ${data[0].id}`);
            }
        }
    }
}

checkData();
