import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://xnhzqalncwcefnhoqzxe.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc4NTkyNywiZXhwIjoyMDg3MzYxOTI3fQ.2m-8sdbn-vb7a1M2gdc02ZwCo5Rh1wclHnAh3i5WrqY');
async function test() {
    let res = await supabase.from('halls').upsert({ id: 't1', org_id: 'e2071ef5-e51b-4f9e-87fe-f26eaf1e44ef', name: 'T', description: 'a' });
    console.log("description:", res.error);
    
    res = await supabase.from('halls').upsert({ id: 't1', org_id: 'e2071ef5-e51b-4f9e-87fe-f26eaf1e44ef', name: 'T', photo_url: 'a' });
    console.log("photo_url:", res.error);

    res = await supabase.from('halls').upsert({ id: 't1', org_id: 'e2071ef5-e51b-4f9e-87fe-f26eaf1e44ef', name: 'T', is_active: false });
    console.log("is_active:", res.error);
    
    res = await supabase.from('subscriptions').upsert({ id: 't1', org_id: 'e2071ef5-e51b-4f9e-87fe-f26eaf1e44ef', student_id: '1', status: 'active' });
    console.log("status:", res.error);
}
test();
