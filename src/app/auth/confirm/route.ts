import { type EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'

import { createClient as createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type') as EmailOtpType | null
    const next = searchParams.get('next') ?? '/dashboard'

    if (token_hash && type) {
        const supabase = await createServerClient()

        const { data, error } = await supabase.auth.verifyOtp({
            type,
            token_hash,
        })
        
        if (!error && data.user) {
            // Activation Logic: Automatically set is_activated to true if user just confirmed email
            if (type === 'signup' || type === 'invite') {
                const adminClient = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!
                )
                
                await adminClient.auth.admin.updateUserById(data.user.id, {
                    user_metadata: { ...data.user.user_metadata, is_activated: true }
                })
                
                // Redirect to login with success status so the UI can show the activation message
                return NextResponse.redirect(new URL('/login?status=activated', request.url))
            }
            
            // redirect user to specified redirect URL or root of app
            return NextResponse.redirect(new URL(next, request.url))
        }
    }

    // redirect the user to an error page with some instructions
    return NextResponse.redirect(new URL('/login?error=auth', request.url))
}
