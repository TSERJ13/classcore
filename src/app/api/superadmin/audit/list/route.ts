import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/superadmin-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const auth = await requireSuperAdmin(req);
        if (!auth.authorized) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json({ error: 'Administrative configuration missing' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // 1. Fetch ALL Auth Users
        const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) throw authError;

        // 2. Fetch ALL Studio Rows for cross-referencing
        const { data: studios, error: studioError } = await supabase
            .from('studio_settings')
            .select('studio_slug, staff_data, updated_at');
        
        if (studioError) throw studioError;

        // Map studio slugs to their owners for fast lookup
        const studioOwnerMap = new Map();
        studios.forEach(s => {
            const staff = (s.staff_data as any[]) || [];
            const owner = staff.find(m => m.role === 'owner');
            if (owner?.email) {
                studioOwnerMap.set(owner.email.toLowerCase(), s.studio_slug);
            }
        });

        // 3. Process & Merge
        const auditList = users.map(user => {
            const email = user.email?.toLowerCase();
            const confirmedAt = user.email_confirmed_at;
            const createdAt = user.created_at;
            const meta = user.user_metadata || {};
            
            const linkedSlug = meta.studio_slug || studioOwnerMap.get(email || '');
            const hasStudioRow = studios.some(s => s.studio_slug === linkedSlug);
            
            const isConfirmed = !!confirmedAt;
            const isPending = !isConfirmed;
            
            // Flag as "Stale" if unconfirmed for more than 24 hours
            const ageHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
            const isStale = isPending && ageHours > 24;

            return {
                id: user.id,
                email: user.email,
                firstName: meta.first_name || 'N/A',
                lastName: meta.last_name || 'N/A',
                studioName: meta.studio_name || 'N/A',
                requestedSlug: linkedSlug || 'N/A',
                createdAt,
                confirmedAt,
                isConfirmed,
                hasStudioRow,
                isStale,
                lastSignIn: user.last_sign_in_at
            };
        });

        // Sort: Pending first, then by date
        auditList.sort((a, b) => {
            if (a.isConfirmed !== b.isConfirmed) return a.isConfirmed ? 1 : -1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        return NextResponse.json({ 
            users: auditList,
            total: auditList.length,
            pendingCount: auditList.filter(u => !u.isConfirmed).length,
            ghostCount: auditList.filter(u => u.isConfirmed && !u.hasStudioRow).length
        });

    } catch (err: any) {
        console.error('❌ Audit List Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
