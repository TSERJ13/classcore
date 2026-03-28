import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xnhzqalncwcefnhoqzxe.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODU5MjcsImV4cCI6MjA4NzM2MTkyN30.tapUV9nQIYkJif0lS9OQNFSBgIoZLuJhexcmtfj3h48';

async function main() {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const email = 'stdancegroup@gmail.com';

    console.log(`🔍 Searching for studios for ${email}...`);

    const { data, error } = await supabase
        .from('studio_settings')
        .select('*')
        .contains('staff_emails', [email]);

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('❓ No studios found. This might be due to RLS.');
        return;
    }

    console.log(`✅ Found ${data.length} studios:`);
    data.forEach(row => {
        const allStaff = row.staff_data || [];
        const studioConfig = allStaff.find(s => s.id === '__studio_config__')?.studio_data || {};
        console.log(`- Slug: ${row.studio_slug}`);
        console.log(`  Name: ${studioConfig.studioName || row.studio_slug}`);
        console.log(`  Logo: ${!!studioConfig.logoDataUrl ? '✅' : '❌'}`);
        console.log(`  Updated: ${row.updated_at}`);
        console.log('-------------------');
    });
}

main();
