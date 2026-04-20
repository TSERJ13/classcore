const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error: fetchErr } = await supabase.from('studio_settings').select('staff_data').eq('studio_slug', 'stdancestudio').single();
  if (fetchErr) return console.error(fetchErr);
  
  const currentData = data.staff_data || {};
  if (!currentData._operations) currentData._operations = {};
  if (!currentData._operations.cc_sa_meta) currentData._operations.cc_sa_meta = {};
  if (!currentData._operations.cc_studio_settings) currentData._operations.cc_studio_settings = {};

  currentData._operations.cc_sa_meta.plan = 'pro';
  currentData._operations.cc_studio_settings.plan = 'pro';

  const { error: updErr } = await supabase.from('studio_settings').update({ staff_data: currentData }).eq('studio_slug', 'stdancestudio');
  if (updErr) console.error("Update ERR:", updErr);
  else console.log("SUCCESSFULLY MERGED!");
}
test();
