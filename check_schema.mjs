import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function check() {
    let res = await supabase.from('halls').select('*').limit(1);
    console.log("Halls fields:", res.data ? Object.keys(res.data[0] || {}) : res.error);
    res = await supabase.from('subscriptions').select('*').limit(1);
    console.log("Subscriptions fields:", res.data ? Object.keys(res.data[0] || {}) : res.error);
    res = await supabase.from('students').select('*').limit(1);
    console.log("Students fields:", res.data ? Object.keys(res.data[0] || {}) : res.error);
    res = await supabase.from('groups').select('*').limit(1);
    console.log("Groups fields:", res.data ? Object.keys(res.data[0] || {}) : res.error);
}
check();
