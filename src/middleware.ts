import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 1. Identify Route Type first (Zero-cost logic)
    const publicRoutes = ['/', '/login', '/sa-login', '/sa-admin', '/registration', '/forgot-password', '/reset-password', '/checkin', '/nfc-checkin', '/terms-and-conditions', '/auth/confirm'];
    const isPublicStatic = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));
    const segments = pathname.split('/').filter(Boolean);
    const isPortal = segments.length === 2 && !publicRoutes.includes('/' + segments[0]);
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
    
    // If they have a session cookie, let them pass to the page (where full auth can be checked more stably)
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

        // 5. Access Control (Redirect to login ONLY if we are sure there is no user)
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
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
