import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://xnhzqalncwcefnhoqzxe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODU5MjcsImV4cCI6MjA4NzM2MTkyN30.tapUV9nQIYkJif0lS9OQNFSBgIoZLuJhexcmtfj3h48';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // Try to get an actual row
    const { data } = await supabase.from('studio_settings').select('*').limit(1);
    console.log("Cols:", data && data.length > 0 ? Object.keys(data[0]) : "No data");
    
    // Test inserting with 'data'
    const { data: d2, error: e2 } = await supabase.from('studio_settings')
        .upsert({ org_id: 'bbddb54e-eace-4623-ac4e-ae9703649fc6', data: { test: 1 } }, { onConflict: 'org_id' })
        .select('*');
        
    console.log("Insert 'data' error:", e2);
    
    // Test inserting with 'metadata'
    const { data: d3, error: e3 } = await supabase.from('studio_settings')
        .upsert({ org_id: 'bbddb54e-eace-4623-ac4e-ae9703649fc6', metadata: { test: 1 } }, { onConflict: 'org_id' })
        .select('*');
        
    console.log("Insert 'metadata' error:", e3);
}
run();
