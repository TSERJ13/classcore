const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    const envPath = path.join(__dirname, '.env.local');
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) env[key.trim()] = value.join('=').trim().replace(/^"(.*)"$/, '$1');
    });
    return env;
}

const env = loadEnv();

async function restoreAdmin() {
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('❌ Keys missing in .env.local');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const email = 'admindancescore@gmail.com';
    const slug = 'tserj13';

    console.log(`🚀 Finalizing Advanced Registry for: ${slug}...`);

    // The logic in /api/superadmin/studios/list expects specific staff_data structure
    const staff_data = [
        {
            id: 'admin-id',
            email: email,
            role: 'owner',
            first_name: 'Sergi',
            last_name: 'Tsivtsivadze',
            full_name: 'Sergi Tsivtsivadze'
        },
        {
            id: '__studio_config__',
            studio_data: {
                studioName: 'ClassCore HQ',
                owner_info: {
                    first_name: 'Sergi',
                    last_name: 'Tsivtsivadze',
                    email: email,
                    phone: '+995 5xx xxx xxx'
                },
                plan: 'pro',
                is_activated: true
            }
        }
    ];

    const { error: dbError } = await supabase
        .from('studio_settings')
        .upsert({
            studio_slug: slug,
            updated_at: new Date().toISOString(),
            staff_data: staff_data
        });

    if (dbError) {
        console.error('❌ DB Error:', dbError.message);
    } else {
        console.log('✅ Admin Studio Registry entry FULLY RESTORED with Name & Metadata.');
    }
}

restoreAdmin();
