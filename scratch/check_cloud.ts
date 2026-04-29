
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceKey);

async function check() {
    const { data: studios } = await supabase.from('studios').select('*');
    
    studios?.forEach(s => {
        if (s.studio_name?.toLowerCase().includes('dance') || s.studio_slug?.toLowerCase().includes('dance') || s.studio_slug?.toLowerCase().includes('st')) {
             console.log('MATCH:', s.studio_slug, '| NAME:', s.studio_name, '| ORG:', s.org_id);
        }
    });
}

check();
