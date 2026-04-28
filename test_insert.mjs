import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://xnhzqalncwcefnhoqzxe.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc4NTkyNywiZXhwIjoyMDg3MzYxOTI3fQ.2m-8sdbn-vb7a1M2gdc02ZwCo5Rh1wclHnAh3i5WrqY');
async function test() {
    let res = await supabase.from('halls').upsert({ id: 'test_hall', name: 'Test', org_id: 'bbddb54e-eace-4623-ac4e-ae9703649fc6' });
    console.log("Halls minimal:", res.error);
    
    res = await supabase.from('halls').upsert({ id: 'test_hall', name: 'Test', org_id: 'bbddb54e-eace-4623-ac4e-ae9703649fc6', capacity: 10 });
    console.log("Halls with capacity:", res.error);
    
    res = await supabase.from('halls').upsert({ id: 'test_hall', name: 'Test', org_id: 'bbddb54e-eace-4623-ac4e-ae9703649fc6', color: '#fff' });
    console.log("Halls with color:", res.error);
    
    // Testing subscriptions schema similarly
    let sres = await supabase.from('subscriptions').upsert({ id: 'test', org_id: 'bbddb54e-eace-4623-ac4e-ae9703649fc6', student_id: '123', plan: 'Yoga' });
    console.log("Subs minimal:", sres.error);
}
test();
