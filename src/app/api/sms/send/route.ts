import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), '.sms-logs.json');

function saveLog(logEntry: any) {
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

        // Keep only last 1000 logs to prevent file from growing indefinitely
        if (logs.length > 1000) {
            logs = logs.slice(0, 1000);
        }

        logs.unshift(logEntry); // Add to beginning
        fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
    } catch (e) {
        console.error('Failed to save SMS log', e);
    }
}

export async function POST(req: Request) {
    let to, text, studentName;
    try {
        const body = await req.json();
        to = body.to;
        text = body.text;
        studentName = body.studentName || 'უცნობი';

        if (!to || !text) {
            saveLog({
                id: Math.random().toString(36).substring(2, 10),
                timestamp: new Date().toISOString(),
                studentName,
                to: to || 'Unknown',
                text: text || '',
                status: 'error',
                error: 'Missing "to" or "text"'
            });
            return NextResponse.json({ success: false, error: 'Missing "to" or "text"' }, { status: 400 });
        }

        const apiKey = process.env.GOSMS_API_KEY;
        const from = process.env.NEXT_PUBLIC_GOSMS_SENDER_ID || 'ClassCore';

        if (!apiKey) {
            saveLog({
                id: Math.random().toString(36).substring(2, 10),
                timestamp: new Date().toISOString(),
                studentName,
                to,
                text,
                status: 'error',
                error: 'Server configuration error (API Key missing)'
            });
            console.error('Missing GOSMS_API_KEY environment variable');
            return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
        }

        const response = await fetch('https://api.gosms.ge/api/sendsms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: apiKey,
                from: from,
                to: to,
                text: text
            }),
        });

        const data = await response.json();
        const isSuccess = data.success || (Array.isArray(data) && data[0]?.success);

        if (!response.ok || !isSuccess) {
            console.error('GOSMS Error:', data);
            saveLog({
                id: data.message_id || (Array.isArray(data) && data[0]?.message_id) || Math.random().toString(36).substring(2, 10),
                timestamp: new Date().toISOString(),
                studentName,
                to,
                text,
                status: 'error',
                error: data.error || (Array.isArray(data) && data[0]?.error) || 'Failed to send SMS'
            });
            return NextResponse.json({ success: false, error: data.error || 'Failed to send SMS' }, { status: response.status || 500 });
        }

        saveLog({
            id: data.message_id || (Array.isArray(data) && data[0]?.message_id) || Math.random().toString(36).substring(2, 10),
            timestamp: new Date().toISOString(),
            studentName,
            to,
            text,
            status: 'success'
        });

        return NextResponse.json(data);
    } catch (error) {
        console.error('SMS Send Error:', error);
        saveLog({
            id: Math.random().toString(36).substring(2, 10),
            timestamp: new Date().toISOString(),
            studentName: studentName || 'უცნობი',
            to: to || 'Unknown',
            text: text || '',
            status: 'error',
            error: 'Internal server error'
        });
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
