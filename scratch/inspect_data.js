const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data, error } = await supabase
    .from('studio_settings')
    .select('studio_slug, staff_data, org_id')
    .order('updated_at', { ascending: false })
    .limit(3);

  if (error) console.error(error);
  else {
    data.forEach(d => {
        console.log("=== SLUG:", d.studio_slug, "===");
        if (!d.staff_data) {
           console.log("NO STAFF DATA");
           return;
        }
        if (Array.isArray(d.staff_data)) {
           console.log("IS ARRAY of length", d.staff_data.length);
        } else {
           console.log("IS UNIFIED. _staff length:", d.staff_data._staff?.length);
           console.log("first staff:", d.staff_data._staff?.[0]);
           if (d.staff_data._operations && d.staff_data._operations.cc_studio_settings) {
               console.log("cc_studio_settings:", d.staff_data._operations.cc_studio_settings);
           } else {
               console.log("Searching operations for cc_studio...");
               const keyed = Object.keys(d.staff_data._operations || {}).find(k => k.startsWith('cc_studio_settings'));
               if (keyed) {
                   console.log(`Found keyed setting ${keyed}. `);
                   console.log("owner_info:", d.staff_data._operations[keyed].owner_info);
                   console.log("studioName:", d.staff_data._operations[keyed].studioName);
               } else {
                   console.log("NO cc_studio_settings FOUND", Object.keys(d.staff_data._operations || {}));
               }
           }
        }
    });
  }
}
inspect();
