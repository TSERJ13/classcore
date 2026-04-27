
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const slug = 'stdancestudio';
    console.log(`🔍 Checking data for slug: ${slug}...`);

    // 1. Find OrgID
    const { data: studio, error: sErr } = await supabase
        .from('studios')
        .select('org_id, studio_name')
        .eq('studio_slug', slug)
        .single();
    
    if (sErr || !studio) {
        console.error('❌ Studio not found in DB:', sErr?.message);
        return;
    }

    const orgId = studio.org_id;
    console.log(`✅ Found Studio: ${studio.studio_name} (OrgID: ${orgId})`);

    // 2. Check collections
    const collections = [
        'students', 'staff', 'groups', 'branches', 'halls', 
        'subscriptions', 'subscription_plans', 'attendance', 'calendar_events'
    ];

    for (const table of collections) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .eq('org_id', orgId);
        
        if (error) {
            console.log(`❌ Table [${table}]: Error - ${error.message}`);
        } else {
            console.log(`📊 Table [${table}]: ${count} records`);
        }
    }

    // 3. Check Settings Blob
    const { data: settings } = await supabase
        .from('studio_settings')
        .select('data')
        .eq('org_id', orgId)
        .single();
    
    if (settings?.data) {
        const d = settings.data;
        console.log(`📦 Settings Blob found. Internal counts:`, {
            students: d.students?.length || Object.keys(d.students || {}).length,
            plans: d.subscription_plans?.length || d.plans?.length || 0,
            subs: d.subscriptions?.length || Object.keys(d.subscriptions || {}).length
        });
    } else {
        console.log('📦 Settings Blob: EMPTY');
    }
}

checkData();
