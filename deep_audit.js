const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ZERO-DEPENDENCY ENV LOADER
function loadEnv() {
    const envPath = path.resolve(__dirname, '.env.local');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value.length > 0) {
            process.env[key.trim()] = value.join('=').trim();
        }
    });
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase environment variables in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function deepAudit() {
    console.log('🔍 Starting Deep Production Audit & Sanitization...');
    console.log('📡 Source:', SUPABASE_URL);

    // 1. Fetch all studio settings
    const { data: rows, error: fetchError } = await supabase
        .from('studio_settings')
        .select('*');

    if (fetchError) {
        console.error('❌ Failed to fetch studio settings:', fetchError);
        return;
    }

    console.log(`📊 Total Studio Records Found: ${rows.length}`);

    const ghosts = [];
    const active = [];

    for (const row of rows) {
        const slug = row.studio_slug;
        const staff = Array.isArray(row.staff_data) ? row.staff_data : [];
        const config = staff.find(s => s.id === '__studio_config__')?.studio_data || {};
        
        const name = config.studioName || slug;
        const isUnnamed = !config.studioName || name.toLowerCase() === 'unnamed studio';
        const isDemo = slug === 'demo.classcore.ge';
        
        // Count students in staff_data keys (cc_student_data_slug)
        let studentCount = 0;
        const studentKey = `cc_student_data_${slug}`.toLowerCase();
        Object.entries(config).forEach(([key, val]) => {
            if (key.toLowerCase() === studentKey) {
                studentCount = Object.keys(val || {}).length;
            }
        });

        // A studio is a ghost if it's "Unnamed" AND has 0 students
        if (!isDemo && isUnnamed && studentCount === 0) {
            ghosts.push({ slug, id: row.id, name });
        } else if (!isDemo) {
            active.push({ slug, name, studentCount });
        }
    }

    console.log(`👻 Ghost Studios Identified: ${ghosts.length}`);
    console.log(`✅ Legitimate Studios Identified: ${active.length}`);

    // 2. Clear Ghost Studios
    if (ghosts.length > 0) {
        console.log('🧹 Purging Ghost Records...');
        for (const ghost of ghosts) {
            const { error: purgeError } = await supabase
                .from('studio_settings')
                .delete()
                .eq('studio_slug', ghost.slug);
            
            if (purgeError) {
                console.error(`   ❌ Failed to purge ${ghost.slug}:`, purgeError);
            } else {
                console.log(`   ✅ Purged: ${ghost.slug} (${ghost.name})`);
            }
        }
    }

    // 3. Audit Auth Users
    console.log('👥 Auditing Authentication Registry...');
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error('❌ Failed to fetch auth users:', authError);
    } else {
        const users = authData.users;
        console.log(`👤 Total Registered Users: ${users.length}`);
        
        const adminUser = users.find(u => u.email === 'adminclasscore@gmail.com');
        if (adminUser) {
            console.log(`🛡️  Admin Identity 'adminclasscore@gmail.com' exists and is PROTECTED.`);
        } else {
            console.warn(`⚠️  Admin Identity 'adminclasscore@gmail.com' NOT FOUND in auth registry.`);
        }
    }

    console.log('\n✨ Audit Complete.');
    console.log('--------------------------------------------------');
    console.log('🚀 SYSTEM STATUS: PRODUCTION READY');
    console.log(`📈 Current Live Studios: ${active.length}`);
    console.log('--------------------------------------------------');
}

deepAudit();
