const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xnhzqalncwcefnhoqzxe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODU5MjcsImV4cCI6MjA4NzM2MTkyN30.tapUV9nQIYkJif0lS9OQNFSBgIoZLuJhexcmtfj3h48';

const email = 'stdancegroup@gmail.com';
const password = '@Kjkszpj13';

async function checkRLS() {
    console.log('🧐 [Audit] Checking RLS Integrity for:', email);
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. Sign in
    const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
        console.error('❌ [Audit] Auth Error:', authError.message);
        return;
    }
    const userId = auth.user.id;
    console.log('✅ [Audit] Authenticated. User ID:', userId);

    // 2. Check Profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (profileError) {
        console.error('❌ [Audit] Profile Fetch Error:', profileError.message);
    } else if (!profile) {
        console.error('❌ [Audit] NO PROFILE FOUND for this user ID. RLS will block all access!');
    } else {
        console.log('✅ [Audit] Profile found:', JSON.stringify(profile, null, 2));
    }

    // 3. Check Studio
    const { data: studio, error: studioError } = await supabase
        .from('studio_settings')
        .select('*')
        .eq('studio_slug', 'stdancestudio')
        .maybeSingle();
    
    if (studioError) {
        console.error('❌ [Audit] Studio Settings error:', studioError.message);
    } else {
        console.log('✅ [Audit] Studio OrgId in DB:', studio?.org_id);
    }

    // 4. Test Write to 'students' (The ultimate proof)
    if (profile && studio) {
        console.log('🧪 [Audit] Testing write to [students] table...');
        const testStudent = {
            id: 'rls_test_' + Date.now(),
            name: 'RLS_TEST_STUDENT',
            org_id: studio.org_id
        };
        const { error: writeError } = await supabase.from('students').insert(testStudent);
        if (writeError) {
            console.error('❌ [Audit] RLS BLOCK CONFIRMED! Write failed:', writeError.message);
        } else {
            console.log('🏆 [Audit] RLS PASS! Write successful.');
            // Cleanup
            await supabase.from('students').delete().eq('id', testStudent.id);
        }
    }
}

checkRLS();
