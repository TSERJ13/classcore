import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xnhzqalncwcefnhoqzxe.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc4NTkyNywiZXhwIjoyMDg3MzYxOTI3fQ.2m-8sdbn-vb7a1M2gdc02ZwCo5Rh1wclHnAh3i5WrqY';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const slug = 'stdancestudio';
  const studentId = 'ad3956749';

  console.log(`Checking studio: ${slug}...`);
  const { data: studio, error: sError } = await supabase
    .from('studios')
    .select('*')
    .eq('studio_slug', slug)
    .maybeSingle();

  if (sError) {
    console.error('Studio error:', sError);
  } else if (!studio) {
    console.log('Studio NOT found!');
  } else {
    const orgId = studio.org_id;
    const { data: students } = await supabase.from('students').select('*').eq('org_id', orgId);
    
    const student = students?.find(s => s.id.toLowerCase() === studentId.toLowerCase());
    if (student) {
      console.log('Student FOUND in DB:');
      console.log('ID:', student.id);
      console.log('Name:', student.full_name);
      console.log('OrgID:', student.org_id);
    } else {
      console.log('Student NOT found in DB!');
    }
  }
}

check();
