import { createClient } from '../src/lib/supabase/client';

async function checkSchema() {
    const supabase = createClient();
    console.log('Checking schemas...');

    // studios table
    const { data: studiosData, error: studiosError } = await supabase
        .from('studios')
        .select('*')
        .limit(1);
    
    if (studiosError) {
        console.error('Studios table error:', studiosError);
    } else {
        console.log('Studios table keys:', Object.keys(studiosData[0] || {}));
    }

    // studio_settings table
    const { data: settingsData, error: settingsError } = await supabase
        .from('studio_settings')
        .select('*')
        .limit(1);

    if (settingsError) {
        console.error('Studio_settings table error:', settingsError);
    } else {
        console.log('Studio_settings table keys:', Object.keys(settingsData[0] || {}));
    }
}

checkSchema();
