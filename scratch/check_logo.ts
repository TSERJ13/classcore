
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkLogo() {
    const slug = 's_t_dance_studio'; // Likely slug
    console.log('🔍 Checking logo for slug:', slug);
    
    const { data, error } = await supabase
        .from('studios')
        .select('*')
        .eq('studio_slug', slug)
        .maybeSingle();
        
    if (error) {
        console.error('❌ Error fetching studio:', error);
        return;
    }
    
    if (!data) {
        console.log('⚠️ Studio not found for slug:', slug);
        // Try to list all studios to find the right one
        const { data: all } = await supabase.from('studios').select('studio_slug, studio_name').limit(10);
        console.log('📋 All studios:', all);
        return;
    }
    
    console.log('✅ Studio Found:', {
        slug: data.studio_slug,
        name: data.studio_name,
        logo_url_length: data.logo_url?.length || 0,
        logo_preview: data.logo_url ? data.logo_url.substring(0, 50) + '...' : 'NULL',
        org_id: data.org_id
    });
}

checkLogo();
