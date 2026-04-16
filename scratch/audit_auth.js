const { createClient } = require('@supabase/supabase-js');
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
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) { console.error(error); return; }
  
  console.log('--- AUTH USERS ---');
  users.forEach(u => {
    console.log(`- ${u.email} (${u.id}) : Studio: ${u.user_metadata?.studio_slug || 'N/A'}`);
  });
}

run();
