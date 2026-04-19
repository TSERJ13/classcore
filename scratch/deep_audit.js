const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xnhzqalncwcefnhoqzxe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuaHpxYWxuY3djZWZuaG9xenhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODU5MjcsImV4cCI6MjA4NzM2MTkyN30.tapUV9nQIYkJif0lS9OQNFSBgIoZLuJhexcmtfj3h48';

const email = 'stdancegroup@gmail.com';
const password = '@Kjkszpj13';

async function deepAudit() {
    console.log('🔍 [Audit] Starting deep identity audit...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 1. Sign in
    const { data: { user, session }, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
        console.error('❌ [Audit] Auth Error:', authError.message);
        return;
    }

    console.log('✅ [Audit] Authenticated. User ID:', user.id);
    console.log('📦 [Audit] User Metadata:', JSON.stringify(user.user_metadata, null, 2));

    const metaSlug = user.user_metadata?.studio_slug;
    console.log('📍 [Audit] Slug in Metadata:', metaSlug);

    // 2. Check Studio Settings
    const { data: studios, error: studioError } = await supabase
        .from('studio_settings')
        .select('studio_slug, org_id, studio_data');
    
    if (studioError) {
        console.error('❌ [Audit] Studio Fetch Error:', studioError.message);
    } else {
        console.log('🏢 [Audit] All accessible studios in DB:', studios.map(s => s.studio_slug).join(', '));
    }

    // 3. Test Write to the METADATA slug
    if (metaSlug) {
        console.log(`📡 [Audit] Attempting test write to: ${metaSlug}...`);
        const { data: current } = await supabase.from('studio_settings').select('*').eq('studio_slug', metaSlug).maybeSingle();
        
        if (!current) {
            console.error(`❌ [Audit] NO RECORD FOUND in studio_settings for slug: ${metaSlug}`);
            console.log('💡 [Prediction] This is why it doesnt save! The app is using a slug that doesnt exist in the database.');
        } else {
            console.log('✅ [Audit] Found record for metadata slug.');
        }
    }
}

deepAudit();
