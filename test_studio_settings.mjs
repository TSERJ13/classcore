import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://xnhzqalncwcefnhoqzxe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODU5MjcsImV4cCI6MjA4NzM2MTkyN30.tapUV9nQIYkJif0lS9OQNFSBgIoZLuJhexcmtfj3h48';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const orgId = 'bbddb54e-eace-4623-ac4e-ae9703649fc6';
    
    console.log("Checking studio_settings...");
    const { data, error } = await supabase
        .from('studio_settings')
        .upsert({
            org_id: orgId,
            settings: { 
                test: "test_update",
                halls: [{ id: "test_hall", name: "Hall A", capacity: 100 }]
            }
        }, { onConflict: 'org_id' })
        .select('*');

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Success:", data);
    }
}
run();
