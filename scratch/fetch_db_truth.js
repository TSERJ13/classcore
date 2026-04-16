const { createClient } = require('@supabase/supabase-js');

// Load environment from .env.local manually
const fs = require('fs');
const path = require('path');
const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length > 0) acc[key.trim()] = val.join('=').trim();
  return acc;
}, {});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('studio_settings').select('studio_slug, staff_data, updated_at');
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('JSON_START');
  console.log(JSON.stringify(data, null, 2));
  console.log('JSON_END');
}

run();
