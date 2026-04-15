import { NextResponse } from 'next/server';

/**
 * AUTH STUB: Resolves 404 errors for /api/auth/session requests.
 * Since the app uses Supabase for authentication, this route handles 
 * any leftover calls from legacy components or browser extensions 
 * that expect NextAuth endpoints.
 */
export async function GET() {
    return NextResponse.json({ user: null, session: null }, { status: 200 });
}

export async function POST() {
    return NextResponse.json({ message: 'Auth stub' }, { status: 200 });
}
