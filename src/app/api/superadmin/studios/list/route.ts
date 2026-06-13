import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Canonical platform pricing (mirror of PLATFORM_PLAN_PRICES in saas-billing.ts).
// Keyed by the ACTUAL plan names used in the app. 'basic'/'enterprise' are
// legacy aliases kept so old rows still resolve.
const PLAN_PRICE: Record<string, number> = {
    trial: 0, pro: 49, custom: 0, special: 0, basic: 49, enterprise: 0,
};

export async function GET() {
    const responseHeaders = {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
    };
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
                                 process.env.SERVICE_ROLE_KEY ||
                                 process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
                                 process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        const isUsingServiceRole = !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY);

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }
        if (!isUsingServiceRole) {
            console.warn('⚠️ [SuperAdmin API] No SERVICE_ROLE_KEY — counts may be blocked by RLS.');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // ── Master table ─────────────────────────────────────────────────────
        const { data: stdData, error: stdError } = await supabase
            .from('studios')
            .select('studio_slug, owner_info, studio_name, logo_url, created_at, org_id, plan, suspended, is_deleted')
            .order('created_at', { ascending: false });
        if (stdError) console.error('⚠️ [SuperAdmin API] studios fetch:', stdError.message);
        const stdList = stdData || [];

        // ── Pull supporting rows ONCE (org_id only / minimal cols), aggregate in JS ──
        // A failure on any single table must not blank the whole panel.
        const safe = async (q: Promise<any>) => { try { const r = await q; return r.data || []; } catch { return []; } };

        const [students, groups, subs, sales, profileData] = await Promise.all([
            safe(supabase.from('students').select('org_id, status')),
            safe(supabase.from('groups').select('org_id')),
            safe(supabase.from('subscriptions').select('org_id, status, price, amount_paid, currency')),
            safe(supabase.from('sales').select('org_id, price, quantity')),
            safe(supabase.from('profiles').select('org_id, email, role, full_name, first_name, last_name, phone')),
        ]);

        // ── Per-org aggregation ──────────────────────────────────────────────
        const byOrg: Record<string, any> = {};
        const bucket = (org: string) => (byOrg[org] = byOrg[org] || {
            students: 0, groups: 0, activeSubs: 0, subsRevenue: 0, shopRevenue: 0, currency: 'GEL',
        });

        students.forEach((s: any) => { if (s.org_id) bucket(s.org_id).students++; });
        groups.forEach((g: any) => { if (g.org_id) bucket(g.org_id).groups++; });
        subs.forEach((sub: any) => {
            if (!sub.org_id) return;
            const b = bucket(sub.org_id);
            if (sub.status === 'active') b.activeSubs++;
            const amount = Number(sub.amount_paid) > 0 ? Number(sub.amount_paid) : (Number(sub.price) || 0);
            b.subsRevenue += amount;
            if (sub.currency) b.currency = sub.currency;
        });
        sales.forEach((sale: any) => {
            if (!sale.org_id) return;
            const b = bucket(sale.org_id);
            b.shopRevenue += (Number(sale.price) || 0) * (Number(sale.quantity) || 1);
        });

        // ── Auth users for ultimate owner fallback (registration stores name/phone here) ──
        let authUsers: any[] = [];
        try {
            const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
            authUsers = data?.users || [];
        } catch { /* ignore */ }

        // ── Build response ───────────────────────────────────────────────────
        const studios = stdList.map((row: any) => {
            const org = row.org_id;
            const agg = (org && byOrg[org]) || { students: 0, groups: 0, activeSubs: 0, subsRevenue: 0, shopRevenue: 0, currency: 'GEL' };
            const masterOwner = row.owner_info || {};

            let ownerName: string | null = null;
            let ownerEmail: string | null = null;
            let ownerPhone: string | null = null;

            // 1) studios.owner_info
            if (masterOwner.email && masterOwner.email !== 'N/A') {
                ownerName = `${masterOwner.first_name || ''} ${masterOwner.last_name || ''}`.trim() || masterOwner.full_name || null;
                ownerEmail = masterOwner.email;
                ownerPhone = masterOwner.phone || null;
            }
            // 2) profiles by org_id
            if (!ownerEmail && org) {
                const orgProfiles = profileData.filter((p: any) => p.org_id === org);
                const ownerProfile = orgProfiles.find((p: any) => p.role === 'owner') || orgProfiles[0];
                if (ownerProfile) {
                    ownerName = ownerProfile.full_name || `${ownerProfile.first_name || ''} ${ownerProfile.last_name || ''}`.trim() || null;
                    ownerEmail = ownerProfile.email || null;
                    ownerPhone = ownerProfile.phone || null;
                }
            }
            // 3) auth user metadata by studio_slug
            if (!ownerEmail) {
                const u = authUsers.find((au: any) => au.user_metadata?.studio_slug === row.studio_slug);
                if (u) {
                    const m = u.user_metadata || {};
                    ownerName = `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.full_name || ownerName;
                    ownerEmail = u.email || ownerEmail;
                    ownerPhone = m.phone || ownerPhone;
                }
            }

            const plan = row.plan || 'trial';
            const subsRevenue = Math.round(agg.subsRevenue);
            const shopRevenue = Math.round(agg.shopRevenue);

            return {
                slug: row.studio_slug,
                name: row.studio_name || row.studio_slug,
                ownerName: ownerName || '—',
                ownerEmail: ownerEmail || '—',
                ownerPhone: ownerPhone || '—',
                updatedAt: row.created_at,
                createdAt: row.created_at,
                logoUrl: row.logo_url,
                studentCount: agg.students,
                groupCount: agg.groups,
                hallCount: 0,
                activeSubsCount: agg.activeSubs,
                subsRevenue,
                shopRevenue,
                revenue: subsRevenue + shopRevenue,
                currency: agg.currency || 'GEL',
                plan,
                mrr: PLAN_PRICE[plan] ?? 0,
                suspended: row.suspended === true,
                billingStatus: row.suspended === true ? 'suspended' : 'active',
                nextDue: null,
                daysLeft: 30,
                deleted: row.is_deleted === true,
            };
        });

        return NextResponse.json({ studios }, { headers: responseHeaders });
    } catch (err: any) {
        console.error('❌ SuperAdmin Studio List API Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
