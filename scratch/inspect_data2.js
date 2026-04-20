const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data, error } = await supabase
    .from('studio_settings')
    .select('studio_slug, staff_data')
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error) console.error(error);
  else {
    data.forEach(d => {
        console.log("=== SLUG:", d.studio_slug, "===");
        if (d.staff_data && d.staff_data._operations) {
            console.log("Operations keys:", Object.keys(d.staff_data._operations));
            console.log("Settings keys:", Object.keys(d.staff_data._operations.cc_studio_settings || {}));
        } else {
            console.log("Old Format or Wiped");
        }
    });
  }
}
inspect();
