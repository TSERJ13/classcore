import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://xnhzqalncwcefnhoqzxe.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc4NTkyNywiZXhwIjoyMDg3MzYxOTI3fQ.2m-8sdbn-vb7a1M2gdc02ZwCo5Rh1wclHnAh3i5WrqY'
);

async function check() {
  const { data: studio } = await supabase.from('studios').select('*').eq('studio_slug', 'stdancestudio').maybeSingle();
  console.log('DB PLAN IN SETTINGS:', studio?.settings?.plan);
  console.log('DB BILLING IN SETTINGS:', studio?.settings?.billing);
  
  const { data: settings } = await supabase.from('studio_settings').select('*').eq('studio_slug', 'stdancestudio').maybeSingle();
  console.log('DB SETTINGS STAFF_DATA OPERATIONS:', JSON.stringify(settings?.staff_data?._operations, null, 2));
}
check();
