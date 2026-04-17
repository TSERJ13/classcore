import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/smtp';

export async function POST(request: Request) {
    try {
        const { email, firstName, activationLink } = await request.json();

        if (!email || !activationLink) {
            return NextResponse.json({ error: 'Email and link are required' }, { status: 400 });
        }

        const smtpConfig = {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '465'),
            secure: true,
            auth: {
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || ''
            }
        };

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 40px auto; padding: 40px; border: 1px solid #f1f5f9; border-radius: 24px; background: #ffffff; }
                    .logo { text-align: center; margin-bottom: 30px; }
                    .logo img { width: 60px; height: 60px; border-radius: 16px; box-shadow: 0 10px 25px rgba(79, 70, 229, 0.2); }
                    h1 { color: #0f172a; text-align: center; font-size: 24px; font-weight: 900; margin-bottom: 20px; }
                    p { font-size: 16px; color: #64748b; margin-bottom: 20px; text-align: center; }
                    .button-container { text-align: center; margin: 40px 0; }
                    .button { background-color: #4f46e5; color: #ffffff !important; padding: 16px 40px; text-decoration: none; border-radius: 16px; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; transition: all 0.3s ease; box-shadow: 0 10px 20px rgba(79, 70, 229, 0.3); }
                    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 30px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="logo">
                        <img src="https://classcore.ge/logo.svg" alt="ClassCore">
                    </div>
                    <h1>მოგესალმებით ClassCore-ზე!</h1>
                    <p>თქვენი ანგარიშის გასააქტიურებლად, გთხოვთ გამოიყენოთ ქვემოთ მოცემული აქტივაციის ღილაკი.</p>
                    <div class="button-container">
                        <a href="${activationLink}" class="button">ACTIVATION</a>
                    </div>
                    <p>თუ ღილაკი არ მუშაობს, დააკოპირეთ ეს ბმული ბრაუზერში:</p>
                    <p style="font-size: 11px; word-break: break-all; opacity: 0.7;">${activationLink}</p>
                    <div class="footer">
                        &copy; ${new Date().getFullYear()} ClassCore.ge. ყველა უფლება დაცულია.
                    </div>
                </div>
            </body>
            </html>
        `;

        await sendEmail(smtpConfig, {
            from: `"ClassCore" <${smtpConfig.auth.user}>`,
            to: email,
            subject: 'ClassCore - აქტივაცია',
            text: `გამარჯობა! თქვენი აქტივაციის ბმული: ${activationLink}`,
            html
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('Mail send error:', err);
        return NextResponse.json({ error: 'Failed to send activation email' }, { status: 500 });
    }
}
