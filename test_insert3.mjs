import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://xnhzqalncwcefnhoqzxe.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc4NTkyNywiZXhwIjoyMDg3MzYxOTI3fQ.2m-8sdbn-vb7a1M2gdc02ZwCo5Rh1wclHnAh3i5WrqY');
async function test() {
    let res = await supabase.from('halls').upsert({ id: 't1', org_id: 'e2071ef5-e51b-4f9e-87fe-f26eaf1e44ef', sq_meters: 1, branch_id: null });
    console.log("halls extras:", res.error);
    
    res = await supabase.from('subscriptions').upsert({ id: 't1', org_id: 'e2071ef5-e51b-4f9e-87fe-f26eaf1e44ef', student_id: '1', sessions_total: 10, sessions_used: 1, expires_at: '2027-01-01', amount_paid: 10 });
    console.log("subs extras:", res.error);
}
test();
