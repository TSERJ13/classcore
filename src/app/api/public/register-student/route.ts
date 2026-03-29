import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SETTINGS_TABLE = 'studio_settings';

export async function POST(req: Request) {
    try {
        const { studio, student } = await req.json();
        
        if (!studio || !student || !student.id) {
            return NextResponse.json({ error: 'Missing studio or student data' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        const supabase = createClient(supabaseUrl, supabaseServiceKey!, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        // 1. Pull current state (Optimistic Locking)
        const { data: current, error: pullError } = await supabase
            .from(SETTINGS_TABLE)
            .select('staff_data, updated_at')
            .eq('studio_slug', studio)
            .maybeSingle();

        if (pullError) throw pullError;
        if (!current) {
             return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
        }

        const allData = (current.staff_data as any[]) || [];
        const configEntry = allData.find(item => item.id === '__studio_config__');
        const studioConfig = configEntry?.studio_data || {};
        
        // 2. Append/Merge student
        const studentData = studioConfig.cc_student_data || {};
        studentData[student.id] = student;
        
        studioConfig.cc_student_data = studentData;

        // 3. Update staff_data with new config
        const nextStaffData = [
            ...allData.filter(item => item.id !== '__studio_config__'),
            { id: '__studio_config__', studio_data: studioConfig }
        ];

        const { error: pushError } = await supabase
            .from(SETTINGS_TABLE)
            .update({ 
                staff_data: nextStaffData,
                updated_at: new Date().toISOString()
            })
            .eq('studio_slug', studio);

        if (pushError) throw pushError;

        return NextResponse.json({ success: true, studentId: student.id });
    } catch (err: any) {
        console.error('❌ [PublicRegistrationAPI] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
