import net from 'net';
import tls from 'tls';

interface SmtpConfig {
    host: string;
    port: number;
    secure?: boolean;
    auth: {
        user: string;
        pass: string;
    };
}

interface MailOptions {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
}

export async function sendEmail(config: SmtpConfig, options: MailOptions): Promise<void> {
    return new Promise((resolve, reject) => {
        const { host, port, secure, auth } = config;
        const socket = secure
            ? tls.connect(port, host, { rejectUnauthorized: false })
            : net.connect(port, host);

        let step = 0;
        const commands: string[] = [];

        const log = (msg: string) => console.log(`[SMTP] ${msg}`);

        socket.on('data', (data) => {
            const response = data.toString();
            log(`Server: ${response.trim()}`);
            const code = parseInt(response.substring(0, 3));

            if (code >= 400) {
                reject(new Error(`SMTP Error: ${response}`));
                socket.destroy();
                return;
            }

            switch (step) {
                case 0: // Connection established, server sent 220
                    socket.write(`EHLO ${host}\r\n`);
                    step++;
                    break;
                case 1: // EHLO response (250)
                    socket.write('AUTH LOGIN\r\n');
                    step++;
                    break;
                case 2: // Result of AUTH LOGIN (334)
                    socket.write(Buffer.from(auth.user).toString('base64') + '\r\n');
                    step++;
                    break;
                case 3: // Username accepted (334)
                    socket.write(Buffer.from(auth.pass).toString('base64') + '\r\n');
                    step++;
                    break;
                case 4: // Auth success (235)
                    socket.write(`MAIL FROM:<${options.from}>\r\n`);
                    step++;
                    break;
                case 5: // MAIL FROM accepted (250)
                    // Currently supports single recipient, can be expanded for multiple
                    const recipients = options.to.split(',').map(r => r.trim());
                    recipients.forEach((rcpt, index) => {
                        socket.write(`RCPT TO:<${rcpt}>\r\n`);
                    });
                    step += 1;
                    break;
                case 6: // RCPT TO accepted (250)
                    socket.write('DATA\r\n');
                    step++;
                    break;
                case 7: // DATA command accepted (354)
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
                        options.html || options.text,
                        '',
                        `--${boundary}--`,
                        '.',
                        ''
                    ].join('\r\n');
                    socket.write(rawContent + '\r\n');
                    step++;
                    break;
                case 8: // Data accepted (250)
                    socket.write('QUIT\r\n');
                    step++;
                    break;
                case 9: // QUIT accepted (221)
                    socket.destroy();
                    resolve();
                    break;
            }
        });

        socket.on('error', (err) => {
            log(`Socket Error: ${err.message}`);
            reject(err);
        });

        socket.on('end', () => {
            log('Connection closed');
        });
    });
}
