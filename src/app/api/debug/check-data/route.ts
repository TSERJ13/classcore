import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: studios } = await supabase.from('studios').select('org_id, studio_slug, studio_name, owner_info');
    const { data: profiles } = await supabase.from('profiles').select('org_id, email, role, full_name, phone');
    return NextResponse.json({ studios, profiles });
}
