
import { createClient } from '@supabase/supabase-js';

async function checkStudio() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing env vars');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const slug = 'flylifeballet';

    console.log(`Checking studio: ${slug}`);

    const { data: studio, error: studioError } = await supabase
        .from('studios')
        .select('*')
        .eq('studio_slug', slug)
        .maybeSingle();

    console.log('Studios table result:', studio, studioError);

    const { data: settings, error: settingsError } = await supabase
        .from('studio_settings')
        .select('studio_slug')
        .eq('studio_slug', slug)
        .maybeSingle();

    console.log('Studio Settings table result:', settings, settingsError);
}

checkStudio();
