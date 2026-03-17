import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/smtp';

export async function POST(req: Request) {
    try {
        const { name, phone, message } = await req.json();

        // Validate basic fields
        if (!name || !phone) {
            return NextResponse.json(
                { error: 'Name and phone are required' },
                { status: 400 }
            );
        }

        // Configure SMTP settings
        const smtpConfig = {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 465, // Defaulting to 465 for SSL/TLS
            secure: process.env.SMTP_SECURE !== 'false', // Default to true for SSL/TLS
            auth: {
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || '',
            },
        };

        const mailOptions = {
            from: process.env.SMTP_USER || '',
            to: 'support@classcore.ge, adminclasscore@gmail.com',
            subject: `New Consultation Request from ${name}`,
            text: `
                Name: ${name}
                Phone: ${phone}
                Message: ${message || 'No message provided'}
            `,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #4f46e5;">New Consultation Request</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Phone:</strong> ${phone}</p>
                    <p><strong>Message:</strong></p>
                    <div style="background: #f9fafb; padding: 15px; border-radius: 5px; border-left: 4px solid #4f46e5;">
                        ${message || 'No message provided'}
                    </div>
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
                    <p style="font-size: 12px; color: #6b7280;">This email was sent from the ClassCore Landing Page contact form.</p>
                </div>
            `,
        };

        await sendEmail(smtpConfig, mailOptions);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Email sending error:', error);
        return NextResponse.json(
            { error: 'Failed to send email. Please try again later.' },
            { status: 500 }
        );
    }
}
