import { createClient } from './src/lib/supabase/client';

async function probe() {
    const supabase = createClient();
    console.log('Probing studio_settings table...');
    const { data, error } = await supabase
        .from('studio_settings')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error('Error probing studio_settings:', error);
    } else {
        console.log('Studio Settings columns:', Object.keys(data[0] || {}));
    }
}

probe();
