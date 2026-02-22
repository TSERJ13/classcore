/**
 * QR code utilities for StudioFlow student check-in
 */
import QRCode from 'qrcode';

/** Generate a random 6-character alphanumeric student code (e.g. "SF4A3B") */
export function generateStudentCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'SF';
    for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

/**
 * Generate a QR code as a Data URL (PNG) that encodes the check-in URL.
 * Returns the data URL string or empty string on error.
 */
export async function generateQRDataUrl(code: string, baseUrl = ''): Promise<string> {
    const url = `${baseUrl}/checkin?code=${code}`;
    try {
        return await QRCode.toDataURL(url, {
            width: 200,
            margin: 1,
            color: { dark: '#ffffff', light: '#00000000' },
            errorCorrectionLevel: 'M',
        });
    } catch {
        return '';
    }
}
