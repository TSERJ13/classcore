import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.next();
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

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

        const { data: { user } } = await supabase.auth.getUser();
        
        // SYNC: Ensure cc_active_slug cookie matches user metadata to prevent flickering
        if (user?.user_metadata?.studio_slug) {
            const metaSlug = user.user_metadata.studio_slug;
            const cookieSlug = request.cookies.get('cc_active_slug')?.value;
            
            if (cookieSlug !== metaSlug) {
                // Set cookie on response so SSR picks it up immediately on redirect or next load
                response.cookies.set('cc_active_slug', metaSlug, {
                    path: '/',
                    maxAge: 60 * 60 * 24 * 365,
                    sameSite: 'lax'
                });
            }
        }

        const { pathname } = request.nextUrl;
        const hasStaffCookie = request.cookies.get('cc_staff_auth')?.value === 'true';

        const publicRoutes = ['/', '/login', '/sa-login', '/sa-admin', '/registration', '/forgot-password', '/reset-password', '/checkin', '/nfc-checkin', '/terms-and-conditions', '/auth/confirm'];
        const isPublicStatic = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));

        // Portal routes are like /[studio]/[studentId] - 2 segments
        const segments = pathname.split('/').filter(Boolean);
        const isPortal = segments.length === 2 && !publicRoutes.includes('/' + segments[0]);

        const isPublic = isPublicStatic || isPortal;

        // Redirect /sa-admin to /sa-login for user-friendliness
        if (pathname === '/sa-admin') {
            return NextResponse.redirect(new URL('/sa-login', request.url));
        }

        if (!user && !hasStaffCookie && !isPublic) {
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
