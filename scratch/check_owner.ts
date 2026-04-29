
import { createClient } from '@supabase/supabase-js';

async function checkOwnerInfo() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing env vars');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const slug = 'flylifeballet';

    const { data: settings } = await supabase
        .from('studio_settings')
        .select('staff_data')
        .eq('studio_slug', slug)
        .maybeSingle();

    const staffData = settings?.staff_data || {};
    const ops = staffData._operations || {};
    console.log('Owner Info in cc_sa_meta:', ops.cc_sa_meta?.owner_info);
    console.log('Owner Info in cc_studio_settings:', ops.cc_studio_settings?.owner_info);
    
    const owner = (staffData._staff || []).find((s: any) => s.role === 'owner');
    console.log('Owner in staff list:', owner ? { email: owner.email, phone: owner.phone } : 'Not found');
}

checkOwnerInfo();
