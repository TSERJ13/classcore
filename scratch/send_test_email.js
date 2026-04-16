const tls = require('tls');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
    const [key, ...val] = line.split('=');
    if (key && val.length > 0) acc[key.trim()] = val.join('=').trim();
    return acc;
}, {});

const config = {
    host: env.SMTP_HOST || 'mail.domenebi.ge',
    port: parseInt(env.SMTP_PORT || '465'),
    auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
    }
};

const options = {
    from: `"ClassCore Test" <${config.auth.user}>`,
    to: 'stdancegroup@gmail.com', // External test
    subject: '🚀 ClassCore SMTP External Test',
    text: 'If you are reading this, your SMTP configuration (Port 465) is working perfectly!',
    html: `
        <div style="font-family: sans-serif; padding: 40px; border: 1px solid #eee; border-radius: 20px; max-width: 500px; margin: auto;">
            <h1 style="color: #4f46e5;">🚀 SMTP Verification Successful!</h1>
            <p style="color: #666; font-size: 16px;">Everything is correctly configured. Click the button below to see the <b>Activated</b> UI:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://classcore.ge/login?status=activated" style="background: #4f46e5; color: white; padding: 15px 30px; border-radius: 12px; text-decoration: none; font-weight: bold;">VIEW ACTIVATED UI</a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #999;">Sent at ${new Date().toLocaleString()}</p>
        </div>
    `
};

function send() {
    console.log(`📡 Connecting to ${config.host}:${config.port}...`);
    
    const socket = tls.connect(config.port, config.host, { rejectUnauthorized: false }, () => {
        console.log('✅ Connected to SMTP server.');
    });

    let step = 0;
    socket.on('data', (data) => {
        const response = data.toString();
        process.stdout.write(`Server: ${response}`);
        const code = parseInt(response.substring(0, 3));

        if (code >= 400) {
            console.error('\n❌ SMTP Error:', response);
            socket.destroy();
            return;
        }

        switch (step) {
            case 0:
                socket.write(`EHLO ${config.host}\r\n`);
                step++;
                break;
            case 1:
                socket.write('AUTH LOGIN\r\n');
                step++;
                break;
            case 2:
                socket.write(Buffer.from(config.auth.user).toString('base64') + '\r\n');
                step++;
                break;
            case 3:
                socket.write(Buffer.from(config.auth.pass).toString('base64') + '\r\n');
                step++;
                break;
            case 4:
                socket.write(`MAIL FROM:<${config.auth.user}>\r\n`);
                step++;
                break;
            case 5:
                socket.write(`RCPT TO:<${options.to}>\r\n`);
                step++;
                break;
            case 6:
                socket.write('DATA\r\n');
                step++;
                break;
            case 7:
                const boundary = `----=_Part_${Date.now()}`;
                const rawContent = [
                    `From: ${options.from}`,
                    `To: ${options.to}`,
                    `Subject: ${options.subject}`,
                    'MIME-Version: 1.0',
                    `Content-Type: multipart/alternative; boundary="${boundary}"`,
                    '',
                    `--${boundary}`,
                    'Content-Type: text/plain; charset=UTF-8',
                    'Content-Transfer-Encoding: 7bit',
                    '',
                    options.text,
                    '',
                    `--${boundary}`,
                    'Content-Type: text/html; charset=UTF-8',
                    'Content-Transfer-Encoding: 7bit',
                    '',
                    options.html,
                    '',
                    `--${boundary}--`,
                    '.',
                    ''
                ].join('\r\n');
                socket.write(rawContent + '\r\n');
                step++;
                break;
            case 8:
                socket.write('QUIT\r\n');
                step++;
                break;
            case 9:
                console.log('\n✨ Test Email Sent Successfully!');
                socket.destroy();
                break;
        }
    });

    socket.on('error', (err) => console.error('❌ Socket Error:', err));
}

send();
