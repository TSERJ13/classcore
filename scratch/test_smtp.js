const { sendEmail } = require('../src/lib/smtp');
require('dotenv').config({ path: '.env.local' });

async function testSmtp() {
    const smtpConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    };

    console.log('🧪 Testing SMTP Connection with:', smtpConfig.auth.user);

    try {
        await sendEmail(smtpConfig, {
            from: `"ClassCore Test" <${process.env.SMTP_USER}>`,
            to: process.env.SMTP_USER, // Send to self
            subject: 'ClassCore SMTP Test',
            text: 'This is a test email to verify SMTP configuration.',
            html: '<h1>ClassCore SMTP Test</h1><p>This is a test email to verify SMTP configuration.</p>'
        });
        console.log('✅ SMTP Test Successful! Check your inbox.');
    } catch (err) {
        console.error('❌ SMTP Test Failed:', err.message);
    }
}

testSmtp();
