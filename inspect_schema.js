
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    const { data, error } = await supabase
        .from('studio_settings')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching schema:', error);
    } else {
        console.log('Columns in studio_settings:', Object.keys(data[0] || {}));
        console.log('Sample data:', data[0]);
    }
}

checkSchema();
