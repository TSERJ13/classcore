import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SETTINGS_TABLE = 'studio_settings';

export async function POST(req: NextRequest) {
    const { studio, studentId, messages } = await req.json();
    if (!studio || !studentId || !messages) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const MAX_RETRIES = 3;
    let lastError: any = null;

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const supabase = await createClient();

            // Pull current state
            const { data: current, error: pullError } = await supabase
                .from(SETTINGS_TABLE)
                .select('staff_data, updated_at')
                .eq('studio_slug', studio)
                .maybeSingle();

            if (pullError) throw pullError;
            if (!current) {
                return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
            }

            const staffData = (current.staff_data as any[]) || [];
            const configIndex = staffData.findIndex(s => s.id === '__studio_config__');
            
            if (configIndex === -1) {
                return NextResponse.json({ error: 'Studio config not found' }, { status: 404 });
            }

            const studioData = staffData[configIndex].studio_data || {};
            const chatData = studioData.chat_data || {};

            // Merge messages: take the student messages and ensure we don't accidentally wipe manager replies
            // However, since the client sends the FULL student chat array, we update that key.
            chatData[studentId] = messages;
            studioData.chat_data = chatData;
            staffData[configIndex].studio_data = studioData;

            // Push back with optimistic locking
            const { error: pushError } = await supabase
                .from(SETTINGS_TABLE)
                .update({
                    staff_data: staffData,
                    updated_at: new Date().toISOString()
                })
                .eq('studio_slug', studio)
                .eq('updated_at', current.updated_at);

            if (!pushError) {
                return NextResponse.json({ success: true });
            }

            // If conflict (409), retry. Otherwise throw.
            if (pushError.code === '23505' || pushError.message?.includes('conflict') || i < MAX_RETRIES - 1) {
                lastError = pushError;
                // Tiny delay before retry
                await new Promise(r => setTimeout(r, 100 * (i + 1)));
                continue;
            }
            throw pushError;
        } catch (err: any) {
            lastError = err;
            if (i === MAX_RETRIES - 1) break;
            await new Promise(r => setTimeout(r, 100 * (i + 1)));
        }
    }

    console.error('Chat sync final failure:', lastError);
    return NextResponse.json({ error: lastError?.message || 'Sync failed after retries', code: lastError?.code }, { status: 409 });
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const studio = searchParams.get('studio');
        const studentId = searchParams.get('studentId');

        if (!studio) {
            return NextResponse.json({ error: 'Missing studio' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: current, error: pullError } = await supabase
            .from(SETTINGS_TABLE)
            .select('staff_data')
            .eq('studio_slug', studio)
            .maybeSingle();

        if (pullError) throw pullError;
        if (!current) return NextResponse.json({ messages: [] });

        const staffData = (current.staff_data as any[]) || [];
        const config = staffData.find(s => s.id === '__studio_config__');
        const chatData = config?.studio_data?.chat_data || {};

        if (studentId) {
            return NextResponse.json({ messages: chatData[studentId] || [] });
        }

        // If no studentId, return all chats (for manager)
        return NextResponse.json({ chats: chatData });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
