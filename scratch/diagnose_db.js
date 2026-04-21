
const { createClient } = require('@supabase/supabase-js');
// Load from .env.local if exists
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) { process.env[k] = envConfig[k]; }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('MISSING ENV VARS');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('🔍 Starting Cloud Data Diagnosis...');
  
  // 1. Find the studio
  const { data: studios, error: sErr } = await supabase
    .from('studios')
    .select('*')
    .ilike('studio_slug', '%stdance%'); // Searching for dancer studio
    
  if (sErr) { console.error('Error fetching studios:', sErr); return; }
  
  if (!studios || studios.length === 0) {
    console.log('❌ No studio found with slug containing "stdance"');
    // List all just in case
    const { data: all } = await supabase.from('studios').select('studio_slug, studio_name').limit(10);
    console.log('Recent studios:', all);
    return;
  }

  const studio = studios[0];
  console.log(`✅ Found Studio: ${studio.studio_name} (${studio.studio_slug})`);
  console.log(`   Org ID: ${studio.org_id}`);
  console.log(`   Logo URL: ${studio.logo_url ? 'PRESENT' : 'MISSING'}`);

  // 2. Check settings blob
  const { data: settings } = await supabase
    .from('studio_settings')
    .select('*')
    .eq('studio_slug', studio.studio_slug)
    .maybeSingle();
    
  if (settings) {
    const staff = settings.staff_data?._staff || (Array.isArray(settings.staff_data) ? settings.staff_data : []);
    console.log(`📦 Blob Staff Count: ${staff.length}`);
  } else {
    console.log('📦 No settings blob found.');
  }

  // 3. Check standalone staff
  const { data: staffTable } = await supabase
    .from('staff')
    .select('*')
    .eq('org_id', studio.org_id);
    
  console.log(`👥 Standalone Staff Table Count: ${staffTable?.length || 0}`);
  if (staffTable && staffTable.length > 0) {
    console.log('   Sample names:', staffTable.map(s => s.full_name).join(', '));
  }
}

diagnose();
