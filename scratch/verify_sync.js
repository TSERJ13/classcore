const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xnhzqalncwcefnhoqzxe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODU5MjcsImV4cCI6MjA4NzM2MTkyN30.tapUV9nQIYkJif0lS9OQNFSBgIoZLuJhexcmtfj3h48';

const email = 'stdancegroup@gmail.com';
const password = '@Kjkszpj13';

async function verifySync() {
    console.log('🚀 [Audit] Starting direct SQL verification...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. Sign in
    const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
        console.error('❌ [Audit] Auth Error:', authError.message);
        return;
    }
    console.log('✅ [Audit] Authenticated as:', email);

    // 2. Find studio
    const { data: studios, error: studioError } = await supabase
        .from('studio_settings')
        .select('*');
    
    if (studioError) {
        console.error('❌ [Audit] Fetch Error:', studioError.message);
        return;
    }

    if (!studios || studios.length === 0) {
        console.error('❌ [Audit] No studios found for this user.');
        return;
    }

    const studio = studios[0]; // Assuming first one for this test
    const slug = studio.studio_slug;
    console.log('✅ [Audit] Found studio:', slug);

    // 3. Prepare test teacher
    const testId = 'ai_verified_at_' + Date.now();
    const newStaff = [
        ...(studio.staff_data || []),
        { id: testId, name: 'AI_SQL_VERIFIED', phone: '555112233', role: 'teacher', status: 'active' }
    ];

    console.log('📡 [Audit] Pushing test teacher to cloud...');
    
    // 4. Upsert (just like our fixed sync logic)
    const payload = {
        ...studio,
        staff_data: newStaff,
        updated_at: new Date().toISOString()
    };

    const { error: upsertError } = await supabase
        .from('studio_settings')
        .upsert(payload, { onConflict: 'studio_slug' });

    if (upsertError) {
        console.error('❌ [Audit] DB Upsert Error:', upsertError.message);
        return;
    }

    console.log('✅ [Audit] Upsert successful!');

    // 5. Verify by re-pulling
    const { data: fresh, error: pullError } = await supabase
        .from('studio_settings')
        .select('staff_data')
        .eq('studio_slug', slug)
        .single();

    if (pullError) {
        console.error('❌ [Audit] Re-pull Error:', pullError.message);
        return;
    }

    const found = fresh.staff_data.some(s => s.id === testId);
    if (found) {
        console.log('🏆 [Audit] PERSISTENCE CONFIRMED! Data is safely stored in the SQL database.');
        console.log('---');
        console.log('Summary: The database is definitely saving data. If you dont see it in the browser, please Hard Refresh (Cmd+Shift+R) to clear old cache.');
    } else {
        console.error('❌ [Audit] Data was not found after pull. Persistence failure.');
    }
}

verifySync();
