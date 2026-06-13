import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://xnhzqalncwcefnhoqzxe.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTc4NTkyNywiZXhwIjoyMDg3MzYxOTI3fQ.2m-8sdbn-vb7a1M2gdc02ZwCo5Rh1wclHnAh3i5WrqY'
);

async function checkRLS() {
  const { data, error } = await supabase.rpc('get_policies'); // or direct query
  if (error) {
    // Fallback: query pg_policies
    const { data: policies, error: pgError } = await supabase.from('pg_policies').select('*').eq('tablename', 'students');
    if (pgError) {
      // Let's run raw SQL
      const { data: rawSql, error: sqlError } = await supabase.rpc('run_sql', { sql_query: "SELECT * FROM pg_policies WHERE tablename = 'students';" });
      console.log('SQL POLICY DATA:', rawSql, sqlError);
    } else {
      console.log('PG POLICIES:', policies);
    }
  } else {
    console.log('POLICIES:', data);
  }
}
checkRLS();
