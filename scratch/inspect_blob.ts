import { createClient } from '../src/lib/supabase/client';

async function inspectBlob() {
    const supabase = createClient();
    console.log('Inspecting staff_data blob contents...');
    
    // Check for a few studios
    const { data, error } = await supabase
        .from('studio_settings')
        .select('studio_slug, staff_data, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    data.forEach(row => {
        const unified = row.staff_data || {};
        const operations = unified._operations || {};
        const staff = unified._staff || [];
        
        console.log(`--- Slug: ${row.studio_slug} (Updated: ${row.updated_at}) ---`);
        console.log(`  Staff count: ${staff.length}`);
        console.log(`  Keys in operations: ${Object.keys(operations).join(', ')}`);
        
        if (operations.cc_groups) {
           console.log(`  Groups found! Count: ${operations.cc_groups.length}`);
        } else {
           console.log(`  Groups MISSING in _operations blob.`);
        }
    });
}

inspectBlob();
