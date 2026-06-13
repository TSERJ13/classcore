import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://xnhzqalncwcefnhoqzxe.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc4NTkyNywiZXhwIjoyMDg3MzYxOTI3fQ.2m-8sdbn-vb7a1M2gdc02ZwCo5Rh1wclHnAh3i5WrqY'
);

async function testDelete() {
  // Let's try to delete a student that the user might have tried to delete
  // Or let's fetch students first
  const { data: students } = await supabase.from('students').select('*').limit(5);
  console.log('STUDENTS IN DB:', students.map(s => ({ id: s.id, name: s.full_name })));
  
  if (students && students.length > 0) {
    const target = students[0];
    console.log(`Testing delete of student ${target.id} (${target.full_name})...`);
    const { error } = await supabase.from('students').delete().eq('id', target.id);
    if (error) {
      console.error('❌ DELETE ERROR:', error);
    } else {
      console.log('✅ Delete simulated/succeeded!');
    }
  }
}
testDelete();
