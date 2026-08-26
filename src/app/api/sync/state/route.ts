import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedOrgId } from '@/lib/sync-auth';

function applySecurityFilters(payload: any, callerStaff: any) {
    if (!callerStaff || callerStaff.role === 'owner') return payload;
    const p = callerStaff.permissions;
    if (p) {
        if (!p.canViewBilling) {
            payload.sales = [];
            payload.expenses = [];
            payload.subscriptions = [];
        }
        if (!p.canViewStudents) {
            payload.students = [];
        }
        if (!p.canViewAttendance) {
            payload.attendance = [];
        }
    }
    const allowedBranches = callerStaff.allowedBranchIds;
    if (Array.isArray(allowedBranches) && allowedBranches.length > 0) {
        const allowed = new Set(allowedBranches);
        if (payload.groups) payload.groups = payload.groups.filter((g: any) => !g.branch_id || allowed.has(g.branch_id));
        if (payload.calendar_events) payload.calendar_events = payload.calendar_events.filter((e: any) => !e.branch_id || allowed.has(e.branch_id));
        if (payload.students) payload.students = payload.students.filter((s: any) => !s.branch_id || allowed.has(s.branch_id));
    }
    return payload;
}

// Use Service Role to BYPASS all RLS policies!
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const slug = searchParams.get('slug');
        const orgId = searchParams.get('orgId');
        const studentId = searchParams.get('studentId');
        const isClientPortal = searchParams.get('isClientPortal') === 'true';

        // 1. Auth Logic (Strict for Admins, Lenient for Portals)
        let callerOrgId: string | null = null;
        let callerEmail: string | undefined = undefined;
        let auth: any = null;
        if (!isClientPortal) {
            auth = await getAuthenticatedOrgId(req);
            if (!auth) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            callerOrgId = auth.orgId;
            callerEmail = auth.email;
        }

        // 2. Resolve target OrgID
        let targetOrgId = orgId;
        let targetStudio = null;

        if (!targetOrgId && slug) {
            const { data } = await supabaseAdmin.from('studios').select('*').ilike('studio_slug', slug).maybeSingle();
            if (data) {
                targetOrgId = data.org_id;
                targetStudio = data;
            }
        } else if (targetOrgId) {
            const { data } = await supabaseAdmin.from('studios').select('*').eq('org_id', targetOrgId).maybeSingle();
            targetStudio = data;
        }

        if (!targetOrgId) {
            return NextResponse.json({ error: 'Could not resolve OrgID' }, { status: 404 });
        }

        if (!isClientPortal && (!auth || !auth.hasAccessToOrg(targetOrgId))) {
            return NextResponse.json({ error: 'Forbidden: org mismatch' }, { status: 403 });
        }

        // 3. Fetch Data
        const responses = await Promise.all([
            supabaseAdmin.from('students').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('staff').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('groups').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('branches').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('halls').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('studio_settings').select('*').eq('org_id', targetOrgId).maybeSingle(),
            supabaseAdmin.from('subscriptions').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('attendance').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('calendar_events').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('subscription_plans').select('*').eq('org_id', targetOrgId),
            supabaseAdmin.from('products').select('*').eq('org_id', targetOrgId)
        ]);

        const data = responses.map((r, idx) => {
            if (idx === 5) return r.data;
            return r.data || [];
        });

        return NextResponse.json({
            studio: targetStudio || { studio_slug: slug, studio_name: (data[5] as any)?.studio_name || 'Studio', org_id: targetOrgId },
            settingsRecord: data[5] || null,
            students: data[0] || [],
            staff: data[1] || [],
            groups: data[2] || [],
            branches: data[3] || [],
            halls: data[4] || [],
            subscriptions: data[6] || [],
            attendance: data[7] || [],
            calendar_events: data[8] || [],
            subscription_plans: data[9] || [],
            products: data[10] || [],
            org_id: targetOrgId
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: 'System config error: missing service key' }, { status: 500 });
        }

        const { slug, orgId, isClientPortal, studentId, chunk } = await req.json();

        // 1. Verify User Session (Bypass for Portals)
        let callerOrgId: string | null = null;
        let callerEmail: string | undefined = undefined;
        let auth: any = null;
        if (!isClientPortal) {
            auth = await getAuthenticatedOrgId(req);
            if (!auth) {
                console.error('❌ [SyncAPI] Unauthorized: No valid token or session.');
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
            callerOrgId = auth.orgId;
            callerEmail = auth.email;
        }

        // 2. Resolve target OrgID
        let targetOrgId = orgId;
        let targetStudio = null;

        if (!targetOrgId && slug) {
            const { data, error } = await supabaseAdmin.from('studios').select('*').ilike('studio_slug', slug).maybeSingle();
            if (error) return NextResponse.json({ error: 'DB lookup failed', details: error.message }, { status: 500 });
            if (!data) return NextResponse.json({ error: `Studio not found: ${slug}` }, { status: 404 });
            targetOrgId = data.org_id;
            targetStudio = data;
        } else if (targetOrgId) {
            const { data } = await supabaseAdmin.from('studios').select('*').eq('org_id', targetOrgId).maybeSingle();
            targetStudio = data;
        }

        if (!targetOrgId) {
            console.error('❌ [SyncAPI] Could not resolve OrgID for slug:', slug);
            return NextResponse.json({ error: 'Could not resolve OrgID' }, { status: 404 });
        }

        if (!isClientPortal && !auth.hasAccessToOrg(targetOrgId)) {
            return NextResponse.json({ error: 'Forbidden: org mismatch' }, { status: 403 });
        }

        console.log(`📡 [SyncAPI] Fetching Full State for OrgID: ${targetOrgId} (${slug || 'No Slug'})`);

        // 3. Fetch EVERYTHING with Admin privileges
        // 🚀 OPTIMIZATION: If studentId is provided, fetch ONLY relevant data for the portal
        const isCore = !chunk || chunk === 'core';
        const isHeavy = !chunk || chunk === 'heavy';

        const responses = await Promise.all([
            // 0: Students (For client portal, fetch ONLY the single target student)
            isHeavy ? (isClientPortal && studentId
                ? supabaseAdmin.from('students').select('*').eq('org_id', targetOrgId).or(`id.ilike.${studentId},student_id.ilike.${studentId}`)
                : supabaseAdmin.from('students').select('*').eq('org_id', targetOrgId)) : Promise.resolve({ data: [] }),
            // 1: Staff
            isCore ? (isClientPortal 
                ? supabaseAdmin.from('staff').select('*').eq('org_id', targetOrgId).limit(5)
                : supabaseAdmin.from('staff').select('*').eq('org_id', targetOrgId)) : Promise.resolve({ data: [] }),
            // 2: Groups
            isCore ? supabaseAdmin.from('groups').select('*').eq('org_id', targetOrgId) : Promise.resolve({ data: [] }),
            // 3: Branches
            isCore ? supabaseAdmin.from('branches').select('*').eq('org_id', targetOrgId) : Promise.resolve({ data: [] }),
            // 4: Halls
            isCore ? supabaseAdmin.from('halls').select('*').eq('org_id', targetOrgId) : Promise.resolve({ data: [] }),
            // 5: Settings
            isCore ? supabaseAdmin.from('studio_settings').select('*').eq('org_id', targetOrgId).maybeSingle() : Promise.resolve({ data: null }),
            // 6: Subscriptions
            isHeavy ? (studentId
                ? supabaseAdmin.from('subscriptions').select('*').eq('org_id', targetOrgId).ilike('student_id', studentId)
                : supabaseAdmin.from('subscriptions').select('*').eq('org_id', targetOrgId)) : Promise.resolve({ data: [] }),
            // 7: Attendance
            isHeavy ? (studentId
                ? supabaseAdmin.from('attendance').select('*').eq('org_id', targetOrgId).ilike('student_id', studentId)
                : supabaseAdmin.from('attendance').select('*').eq('org_id', targetOrgId)) : Promise.resolve({ data: [] }),
            // 8: Sales
            (isHeavy && !isClientPortal) ? supabaseAdmin.from('sales').select('*').eq('org_id', targetOrgId) : Promise.resolve({ data: [] }),
            // 9: Expenses
            (isHeavy && !isClientPortal) ? supabaseAdmin.from('expenses').select('*').eq('org_id', targetOrgId) : Promise.resolve({ data: [] }),
            // 10: Trash
            (isHeavy && !isClientPortal) ? supabaseAdmin.from('trash').select('*').eq('org_id', targetOrgId) : Promise.resolve({ data: [] }),
            // 11: Events
            (isHeavy && !isClientPortal) ? supabaseAdmin.from('calendar_events').select('*').eq('org_id', targetOrgId) : Promise.resolve({ data: [] }),
            // 12: Plans
            isHeavy ? supabaseAdmin.from('subscription_plans').select('*').eq('org_id', targetOrgId) : Promise.resolve({ data: [] }),
            // 13: Products
            (isHeavy && !isClientPortal) ? supabaseAdmin.from('products').select('*').eq('org_id', targetOrgId) : Promise.resolve({ data: [] })
        ]);

        const data = responses.map((r, idx) => {
            if (idx === 5) return r.data; // studio_settings is maybeSingle
            return r.data || [];
        });
        
        return NextResponse.json({
            studio: targetStudio || { studio_slug: slug, studio_name: (data[5] as any)?.studio_name || 'Studio', org_id: targetOrgId },
            settingsRecord: data[5] || null,
            students: data[0] || [],
            staff: data[1] || [],
            groups: data[2] || [],
            branches: data[3] || [],
            halls: data[4] || [],
            subscriptions: data[6] || [],
            attendance: data[7] || [],
            sales: data[8] || [],
            expenses: data[9] || [],
            trash: data[10] || [],
            calendar_events: data[11] || [],
            subscription_plans: data[12] || [],
            products: data[13] || [],
            org_id: targetOrgId
        });

    } catch (err: any) {
        console.error('❌ [API/Sync] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
