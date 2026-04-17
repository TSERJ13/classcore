import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('uid');
    
    if (!userId) {
        return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        // Use auth.admin to update metadata
        const { error } = await supabase.auth.admin.updateUserById(userId, {
            user_metadata: { is_activated: true }
        });

        if (error) {
            console.error('Activation failure:', error);
            return NextResponse.redirect(new URL('/login?error=activation_failed', request.url));
        }

        // Successfully activated, redirect to login with success msg
        return NextResponse.redirect(new URL('/login?status=activated', request.url));
    } catch (err) {
        console.error('Activation error:', err);
        return NextResponse.redirect(new URL('/login?error=server', request.url));
    }
}
