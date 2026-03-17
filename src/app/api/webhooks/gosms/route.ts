import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), '.sms-logs.json');

export async function POST(req: Request) {
    try {
        const payload = await req.json();

        // Ensure log file exists
        let logs: any[] = [];
        if (fs.existsSync(LOG_FILE)) {
            const raw = fs.readFileSync(LOG_FILE, 'utf-8');
            try {
                logs = JSON.parse(raw);
            } catch (e) {
                logs = [];
            }
        }

        // Add new webhook payload to logs
        const logEntry = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            data: payload
        };

        logs.unshift(logEntry); // Add to beginning (newest first)

        // Keep only last 500 logs to prevent file from growing indefinitely
        if (logs.length > 500) {
            logs = logs.slice(0, 500);
        }

        fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));

        return NextResponse.json({ success: true, message: 'Webhook received' });
    } catch (error) {
        console.error('Webhook processing error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
