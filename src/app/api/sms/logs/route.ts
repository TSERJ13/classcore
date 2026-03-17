import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), '.sms-logs.json');

export async function GET() {
    try {
        let logs: any[] = [];
        if (fs.existsSync(LOG_FILE)) {
            const raw = fs.readFileSync(LOG_FILE, 'utf-8');
            try {
                logs = JSON.parse(raw);
            } catch (e) {
                logs = [];
            }
        }

        return NextResponse.json({ success: true, logs });
    } catch (error) {
        console.error('Error fetching SMS logs:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
