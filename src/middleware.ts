import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const publicStaticRoutes = ['/', '/login', '/sa-login', '/sa-admin', '/registration', '/forgot-password', '/reset-password', '/checkin', '/nfc-checkin', '/privacy', '/terms', '/terms-and-conditions', '/auth/confirm', '/manifest.webmanifest', '/favicon.ico'];
    const isPublicStatic = publicStaticRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));
    const segments = pathname.split('/').filter(Boolean);
    
    // Dashboard pages in src/app/(dashboard)
    const studioDashboardPages = ['dashboard', 'settings', 'billing', 'analytics', 'history', 'attendance', 'students', 'teachers', 'halls', 'groups', 'calendar', 'shop', 'sms-manager', 'subscriptions', 'trash'];

    // Check if URL is legacy slug-prefixed dashboard URL: e.g. /[slug]/students or /[slug]/dashboard
    const isPrefixedDashboard = segments.length >= 2 
        && !publicStaticRoutes.includes('/' + segments[0])
        && studioDashboardPages.includes(segments[1]);

    // A Student Portal URL is /[slug]/[studentId] where second segment is NOT a dashboard page
    const isPortal = (segments.length === 2 || segments.length === 3) 
        && !publicStaticRoutes.includes('/' + segments[0])
        && !studioDashboardPages.includes(segments[1])
        && segments[1] !== 'registration';

    // Redirect /sa-admin to /sa-login
    if (pathname === '/sa-admin') {
        return NextResponse.redirect(new URL('/sa-login', request.url));
    }

    // 🚀 Handle legacy /[slug]/[dashboardPage] URLs: Extract slug to cookie & redirect to clean un-prefixed dashboard URL
    if (isPrefixedDashboard) {
        const slug = segments[0];
        const pagePath = '/' + segments.slice(1).join('/');
        const url = request.nextUrl.clone();
        url.pathname = pagePath;
        const res = NextResponse.redirect(url);
        res.cookies.set('cc_active_slug', slug, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
        return res;
    }

    let response = NextResponse.next({
        request: { headers: request.headers },
    });

    // Public static routes & Student Portals pass through without auth
    if (isPublicStatic || isPortal) {
        return response;
    }

    if (!supabaseUrl || !supabaseKey) {
        return response;
    }

    // Fast path for logged-in staff/users
    const hasStaffToken = !!request.cookies.get('cc_staff_token')?.value;
    const hasStaffCookie = request.cookies.get('cc_staff_auth')?.value === 'true' || hasStaffToken;
    const hasSupabaseCookie = request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
    
    if (hasStaffCookie || hasSupabaseCookie) {
        return response;
    }

    try {
        const supabase = createServerClient(supabaseUrl, supabaseKey, {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = NextResponse.next({ request: { headers: request.headers } });
                    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                },
            },
        });

        const { data: { user } } = await supabase.auth.getUser();
        
        // Keep active slug in sync with user metadata if available
        if (user?.user_metadata?.studio_slug) {
            const metaSlug = user.user_metadata.studio_slug;
            const cookieSlug = request.cookies.get('cc_active_slug')?.value;
            if (cookieSlug !== metaSlug) {
                response.cookies.set('cc_active_slug', metaSlug, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
            }
        }

        // Access Control: Redirect unauthenticated users to login
        if (!user && !hasStaffCookie) {
            const url = request.nextUrl.clone();
            url.pathname = pathname.startsWith('/superadmin') ? '/sa-login' : '/login';
            return NextResponse.redirect(url);
        }
    } catch (e) {
        console.error('Middleware error:', e);
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};
