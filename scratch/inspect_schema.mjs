import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xnhzqalncwcefnhoqzxe.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc4NTkyNywiZXhwIjoyMDg3MzYxOTI3fQ.2m-8sdbn-vb7a1M2gdc02ZwCo5Rh1wclHnAh3i5WrqY';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data, error } = await supabase
    .from('studios')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
    console.log('Sample Data:', data[0]);
  } else {
    console.log('No data in studios table');
  }
}

check();
