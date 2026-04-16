const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length > 0) acc[key.trim()] = val.join('=').trim();
  return acc;
}, {});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function nuclearCleanup() {
  console.log('🚀 Starting Nuclear System Cleanup...');

  // 1. Fetch all users to identify who to delete
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) return console.error('Error listing users:', listError);

  const adminEmail = 'adminclasscore@gmail.com';
  const usersToDelete = users.filter(u => u.email !== adminEmail);

  console.log(`🗑️ Deleting ${usersToDelete.length} users (except SuperAdmin)...`);
  for (const user of usersToDelete) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) console.error(`Failed to delete user ${user.email}:`, error.message);
    else console.log(`✅ Deleted user: ${user.email}`);
  }

  // 2. Wipe all studios
  console.log('☢️ Wiping ALL studio records...');
  const { error: dbError } = await supabase.from('studio_settings').delete().neq('studio_slug', 'PROTECT_NOTHING');
  if (dbError) console.error('Error wiping studios:', dbError.message);
  else console.log('✅ All studio records wiped.');

  // 3. Clear all related tables (just in case)
  const tables = ['profiles', 'organizations', 'groups_classes', 'attendance_logs', 'hall_rentals', 'subscriptions'];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', 'PROTECT_NOTHING');
    if (error) console.warn(`⚠️ Warning: Failed to wipe table ${table} (might not exist or have RLS issues):`, error.message);
    else console.log(`✅ Table ${table} wiped.`);
  }

  console.log('✨ SYSTEM IS CRITICAL-CLEAN. Ready for fresh registration.');
}

nuclearCleanup();
