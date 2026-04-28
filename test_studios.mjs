import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://xnhzqalncwcefnhoqzxe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODU5MjcsImV4cCI6MjA4NzM2MTkyN30.tapUV9nQIYkJif0lS9OQNFSBgIoZLuJhexcmtfj3h48';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const orgId = 'bbddb54e-eace-4623-ac4e-ae9703649fc6';
    
    // Check if studios Table has 'settings' column
    const { data, error } = await supabase.from('studios').select('*').limit(1);
    console.log("Studios Cols:", data && data.length > 0 ? Object.keys(data[0]) : "No data", error);
}
run();
