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
        const { pathname } = request.nextUrl;
        const hasStaffCookie = request.cookies.get('cc_staff_auth')?.value === 'true';

        const publicRoutes = ['/', '/login', '/sa-login', '/registration', '/checkin', '/nfc-checkin', '/terms-and-conditions', '/auth/confirm'];
        const isPublicStatic = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));

        // Portal routes are like /[studio]/[studentId] - 2 segments
        // We exclude static assets and known public routes
        const segments = pathname.split('/').filter(Boolean);
        const isPortal = segments.length === 2 && !publicRoutes.includes('/' + segments[0]);

        const isPublic = isPublicStatic || isPortal;

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
