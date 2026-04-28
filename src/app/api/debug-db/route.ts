import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/halls', {
            method: 'OPTIONS',
            headers: { 
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
            }
        });
        const resText = await response.text();
        const response2 = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/subscriptions', {
            method: 'OPTIONS',
            headers: { 
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
            }
        });
        const resText2 = await response2.text();
        
        return NextResponse.json({ halls: JSON.parse(resText), subs: JSON.parse(resText2) });
        
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
