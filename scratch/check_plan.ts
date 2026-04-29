
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

    const { data: studio } = await supabase
        .from('studios')
        .select('studio_slug, plan')
        .eq('studio_slug', slug)
        .maybeSingle();

    console.log('Studios table plan:', studio?.plan);

    const { data: settings } = await supabase
        .from('studio_settings')
        .select('staff_data')
        .eq('studio_slug', slug)
        .maybeSingle();

    const staffData = settings?.staff_data || {};
    const ops = staffData._operations || {};
    console.log('Studio Settings cc_sa_meta plan:', ops.cc_sa_meta?.plan);
    console.log('Studio Settings cc_studio_settings plan:', ops.cc_studio_settings?.plan);
}

checkStudio();
