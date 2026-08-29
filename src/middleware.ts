import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 1. Identify Route Type first (Zero-cost logic)
    const publicRoutes = ['/', '/login', '/sa-login', '/sa-admin', '/registration', '/forgot-password', '/reset-password', '/checkin', '/nfc-checkin', '/privacy', '/terms', '/terms-and-conditions', '/auth/confirm', '/manifest.webmanifest', '/favicon.ico'];
    const isPublicStatic = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));
    const segments = pathname.split('/').filter(Boolean);
    
    // Studio dashboard paths that should NOT be treated as student portals
    const studioPaths = ['dashboard', 'settings', 'billing', 'analytics', 'history', 'attendance', 'students', 'teachers', 'halls', 'groups', 'calendar', 'shop', 'sms-manager', 'subscriptions', 'trash', 'registration'];
    // A portal URL is /{slug}/{studentId} — but NOT /{slug}/{studioPath}
    const isPortal = (segments.length === 2 || segments.length === 3) 
        && !publicRoutes.includes('/' + segments[0])
        && !studioPaths.includes(segments[1]); // If second segment is a known studio page, it's NOT a portal
    const isPublic = isPublicStatic || isPortal;

    // Redirect /sa-admin to /sa-login for user-friendliness
    if (pathname === '/sa-admin') {
        return NextResponse.redirect(new URL('/sa-login', request.url));
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    // 2. Authentication Bypass for Public Routes
    if (isPublic) {
        return response;
    }

    if (!supabaseUrl || !supabaseKey) {
        return response;
    }

    // 3. Fast Path for Authenticated Users (Mitigate 504 Timeout)
    const hasStaffCookie = request.cookies.get('cc_staff_auth')?.value === 'true';
    const hasSupabaseCookie = request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
    const cachedSlug = request.cookies.get('cc_active_slug')?.value;
    
    // If they have a session cookie, still check if we need to redirect to a slug-prefixed URL
    if (hasStaffCookie || hasSupabaseCookie) {
        // If we have a cached slug and the URL is a generic path (no slug), redirect to slug path
        const genericDashboardPaths = ['/dashboard', '/settings', '/billing', '/analytics', '/history', '/attendance', '/students', '/teachers', '/halls', '/groups', '/calendar', '/shop', '/sms-manager', '/subscriptions', '/trash'];
        const invalidSlugs = ['api', '_next', 'auth', 'login', 'superadmin', 'favicon.ico', 'manifest.webmanifest'];
        
        if (cachedSlug && !invalidSlugs.includes(cachedSlug) && genericDashboardPaths.some(p => pathname === p || pathname.startsWith(p + '/'))) {
            const targetPath = pathname === '/dashboard' ? `/${cachedSlug}/dashboard` : `/${cachedSlug}${pathname}`;
            const url = request.nextUrl.clone();
            url.pathname = targetPath;
            return NextResponse.redirect(url);
        }
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
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        });

        // 4. User Authentication (Heavy Operation - Only for potential new logins or specific redirects)
        const { data: { user } } = await supabase.auth.getUser();
        
        // SYNC: Ensure cc_active_slug cookie matches user metadata to prevent flickering
        if (user?.user_metadata?.studio_slug) {
            const metaSlug = user.user_metadata.studio_slug;
            const cookieSlug = request.cookies.get('cc_active_slug')?.value;
            
            if (cookieSlug !== metaSlug) {
                response.cookies.set('cc_active_slug', metaSlug, {
                    path: '/',
                    maxAge: 60 * 60 * 24 * 365,
                    sameSite: 'lax'
                });
            }
        }

        // 5. Portal Enforcement (Redirect generic /dashboard to specific /[slug]/dashboard)
        if (user || hasStaffCookie) {
            const activeSlug = (() => {
                const raw = request.cookies.get('cc_active_slug')?.value || user?.user_metadata?.studio_slug;
                // Never treat system paths as valid slugs
                const invalidSlugs = ['api', '_next', 'auth', 'login', 'superadmin', 'favicon.ico', 'manifest.webmanifest'];
                return (raw && !invalidSlugs.includes(raw)) ? raw : user?.user_metadata?.studio_slug;
            })();
            const genericDashboardPaths = ['/dashboard', '/settings', '/billing', '/analytics', '/history', '/attendance', '/students', '/teachers', '/halls', '/groups', '/calendar', '/shop', '/sms-manager', '/subscriptions', '/trash'];
            
            if (activeSlug && genericDashboardPaths.some(p => pathname === p || pathname.startsWith(p + '/'))) {
                const targetPath = pathname === '/dashboard' ? `/${activeSlug}/dashboard` : `/${activeSlug}${pathname}`;
                const url = request.nextUrl.clone();
                url.pathname = targetPath;
                return NextResponse.redirect(url);
            }
        }

        // 6. Access Control (Redirect to login ONLY if we are sure there is no user)
        if (!user && !hasStaffCookie) {
            const url = request.nextUrl.clone();
            if (pathname.startsWith('/superadmin')) {
                url.pathname = '/sa-login';
            } else {
                url.pathname = '/login';
            }
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
