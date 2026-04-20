import { createClient } from '../src/lib/supabase/client';

async function probe() {
    const supabase = createClient();
    console.log('Probing studio_settings for staff_emails population...');
    const { data, error } = await supabase
        .from('studio_settings')
        .select('studio_slug, staff_emails, updated_at')
        .order('updated_at', { ascending: false });
    
    if (error) {
        console.error('Error probing studio_settings:', error);
    } else {
        console.log('Results:');
        data.forEach(row => {
            const emailCount = Array.isArray(row.staff_emails) ? row.staff_emails.length : 'NULL';
            console.log(`Slug: ${row.studio_slug} | updated_at: ${row.updated_at} | Emails count: ${emailCount}`);
            if (emailCount > 0) {
                console.log(`  Sample emails: ${row.staff_emails.slice(0, 3).join(', ')}`);
            }
        });
    }
}

probe();
