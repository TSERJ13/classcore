import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
    // Skip Supabase session handling if env vars aren't configured yet (local dev without Supabase)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        // No Supabase configured — allow all traffic through (development mode)
        return NextResponse.next();
    }

    // Lazy import only when Supabase is configured
    const { createServerClient } = await import('@supabase/ssr');

    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) =>
                    request.cookies.set(name, value)
                );
                supabaseResponse = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) =>
                    supabaseResponse.cookies.set(name, value, options)
                );
            },
        },
    });

    // Refresh session — important to prevent auth token expiry
    await supabase.auth.getUser();

    // Auth guard (uncomment when ready to protect routes):
    // const { pathname } = request.nextUrl;
    // const { data: { user } } = await supabase.auth.getUser();
    // if (!user && !pathname.startsWith('/login')) {
    //   const url = request.nextUrl.clone();
    //   url.pathname = '/login';
    //   return NextResponse.redirect(url);
    // }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
