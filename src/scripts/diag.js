
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xnhzqalncwcefnhoqzxe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODU5MjcsImV4cCI6MjA4NzM2MTkyN30.tapUV9nQIYkJif0lS9OQNFSBgIoZLuJhexcmtfj3h48';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const slug = 'stdancestudio';
    console.log(`\n🔍 --- CLOUD DIAGNOSTICS FOR: ${slug} ---`);

    const { data: studio, error: sErr } = await supabase
        .from('studios')
        .select('org_id, studio_name')
        .eq('studio_slug', slug)
        .single();
    
    if (sErr || !studio) {
        console.error('❌ Studio NOT found in Database.');
        return;
    }

    const orgId = studio.org_id;
    console.log(`✅ FOUND STUDIO: ${studio.studio_name} [${orgId}]`);

    const tables = [
        'students', 'staff', 'groups', 'branches', 'halls', 
        'subscriptions', 'subscription_plans', 'attendance', 'calendar_events'
    ];

    console.log('\n📊 --- ATOMIC COLLECTIONS ---');
    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId);
        
        if (error) {
            console.log(`  - ${table.padEnd(20)}: ❌ ERROR (${error.message})`);
        } else {
            console.log(`  - ${table.padEnd(20)}: ${count} records`);
        }
    }

    console.log('\n📦 --- SETTINGS BLOB (BACKUP) ---');
    const { data: settings } = await supabase
        .from('studio_settings')
        .select('data')
        .eq('org_id', orgId)
        .maybeSingle();
    
    if (settings?.data) {
        const d = settings.data;
        console.log(`  - JSON Backup: FOUND`);
        console.log(`  - Students:    ${d.students?.length || Object.keys(d.students || {}).length || 0}`);
        console.log(`  - Plans:       ${d.subscription_plans?.length || d.plans?.length || 0}`);
        console.log(`  - Subs:        ${d.subscriptions?.length || Object.keys(d.subscriptions || {}).length || 0}`);
    } else {
        console.log('  - JSON Backup: EMPTY');
    }
    console.log('\n-----------------------------------\n');
}

checkData();
