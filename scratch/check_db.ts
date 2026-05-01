
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
    const { data, error } = await supabase.from('studios').select('*').limit(1);
    if (error) console.error('Error:', error);
    else console.log('Studios:', data.length);
}

check();
