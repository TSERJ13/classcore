
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://xnhzqalncwcefnhoqzxe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODU5MjcsImV4cCI6MjA4NzM2MTkyN30.tapUV9nQIYkJif0lS9OQNFSBgIoZLuJhexcmtfj3h48';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const orgId = '04fcd615-255c-4f6d-9444-50308118db04';
    const tables = ['subscriptions', 'student_subscriptions'];
    for (const t of tables) {
        const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true }).eq('org_id', orgId);
        console.log(`${t}: ${count} records ${error? '('+error.message+')' : ''}`);
    }
}
check();
