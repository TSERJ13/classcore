const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listStudios() {
  const { data, error } = await supabase
    .from('studio_settings')
    .select('studio_slug, studio_name, org_id');

  if (error) {
    console.error('Error fetching studios:', error);
    return;
  }

  console.log('--- CURRENT STUDIOS IN CLOUD ---');
  data.forEach(s => {
    console.log(`- [${s.studio_slug}] : ${s.studio_name} (Owner ID: ${s.org_id})`);
  });
  console.log('--------------------------------');
}

listStudios();
