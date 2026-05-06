import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xnhzqalncwcefnhoqzxe.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc4NTkyNywiZXhwIjoyMDg3MzYxOTI3fQ.2m-8sdbn-vb7a1M2gdc02ZwCo5Rh1wclHnAh3i5WrqY';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const slug = 'stdancestudio';

  console.log(`Checking for ALL studios with slug: ${slug}...`);
  const { data: studios, error } = await supabase
    .from('studios')
    .select('*')
    .eq('studio_slug', slug);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Found ${studios?.length || 0} studios.`);
    studios?.forEach(s => {
      console.log(' - ID:', s.id, 'OrgID:', s.org_id, 'Name:', s.studio_name);
    });
  }
}

check();
