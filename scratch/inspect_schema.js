const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xnhzqalncwcefnhoqzxe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODU5MjcsImV4cCI6MjA4NzM2MTkyN30.tapUV9nQIYkJif0lS9OQNFSBgIoZLuJhexcmtfj3h48';

async function inspectSchema() {
    console.log('🧐 [Audit] Inspecting studio_settings schema...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data, error } = await supabase
        .from('studio_settings')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ [Audit] Error:', error.message);
        return;
    }

    if (data && data.length > 0) {
        console.log('📋 [Audit] Available columns:', Object.keys(data[0]).join(', '));
        console.log('📄 [Audit] Row Sample:', JSON.stringify(data[0], null, 2));
    } else {
        console.log('⚠️ [Audit] No data found to inspect columns.');
    }
}

inspectSchema();
